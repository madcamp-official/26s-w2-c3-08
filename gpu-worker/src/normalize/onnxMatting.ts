// AI 배경 분리(매팅) — ONNX 세그멘테이션(isnet-general-use, rembg 계열)을 CPU로 실행.
// 왜 CPU: 배경 분리는 업로드 1장당 1회 전처리라 수 초면 되고(Wan 생성은 분 단위), 16GB VRAM을
// Wan(GGUF 9.4GB×2 + CLIP 6GB)과 나눠 쓰는 위험을 아예 피한다 (ai-pipeline "GPU는 영상 생성만" 방침).
// 모델(~170MB)은 첫 사용 시 rembg 공식 릴리스에서 gpu-worker/models/ 로 1회 자동 다운로드.
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { pipelineConfig } from "../config/index.js";

const MODELS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "models");

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const cfg = pipelineConfig.sourceNormalization.matting;
      const modelPath = path.join(MODELS_DIR, cfg.modelFile);
      if (!existsSync(modelPath)) await downloadModel(cfg.modelUrl, modelPath);
      return ort.InferenceSession.create(modelPath);
    })();
    // 실패 시 다음 호출이 재시도할 수 있게 캐시 무효화
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

async function downloadModel(url: string, dest: string): Promise<void> {
  mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`[matting] 모델 없음 — 다운로드 시작 (~170MB): ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`matting model download HTTP ${res.status}: ${url}`);
  const tmp = `${dest}.download`;
  try {
    await streamPipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
    const size = statSync(tmp).size;
    if (size < 10_000_000) throw new Error(`matting model too small (${size}B) — 다운로드 손상 의심`);
    await rename(tmp, dest);
    console.log(`[matting] 모델 다운로드 완료 (${(size / 1e6).toFixed(0)}MB): ${dest}`);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/**
 * PNG(불투명 배경)에서 전경 알파 마스크를 추정해 투명 PNG로 반환.
 * @returns 알파 적용된 PNG와 전경 커버리지(0~1) — 신뢰 판정은 호출자(normalizeSource)가 한다.
 */
export async function mattingCutout(png: Buffer): Promise<{ png: Buffer; coverage: number }> {
  const cfg = pipelineConfig.sourceNormalization.matting;
  const session = await getSession();
  const size = cfg.inputSize;

  const meta = await sharp(png).metadata();
  const ow = meta.width ?? 0;
  const oh = meta.height ?? 0;

  // isnet 전처리: size×size로 리사이즈(fill), RGB float32 CHW, x/255 후 mean 0.5 빼기(std 1)
  const { data } = await sharp(png)
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const chw = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let p = 0; p < plane; p++) {
    chw[p] = data[p * 3] / 255 - 0.5;
    chw[plane + p] = data[p * 3 + 1] / 255 - 0.5;
    chw[2 * plane + p] = data[p * 3 + 2] / 255 - 0.5;
  }

  const input = new ort.Tensor("float32", chw, [1, 3, size, size]);
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const mask = outputs[session.outputNames[0]].data as Float32Array;

  // 출력 정규화(min-max, rembg와 동일) 후 0~255 마스크로
  let mi = Infinity;
  let ma = -Infinity;
  for (let i = 0; i < plane; i++) {
    const v = mask[i];
    if (v < mi) mi = v;
    if (v > ma) ma = v;
  }
  const range = Math.max(1e-6, ma - mi);
  const mask8 = Buffer.alloc(plane);
  for (let i = 0; i < plane; i++) {
    const v = (mask[i] - mi) / range;
    mask8[i] = v < cfg.maskThreshold ? 0 : Math.round(v * 255);
  }

  // 마스크를 원본 크기로 되돌려 알파 채널로 합성
  const alphaResized = await sharp(mask8, { raw: { width: size, height: size, channels: 1 } })
    .resize(ow, oh, { fit: "fill" })
    .raw()
    .toBuffer();

  const rgb = await sharp(png).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(ow * oh * 4);
  let fg = 0;
  for (let p = 0; p < ow * oh; p++) {
    rgba[p * 4] = rgb[p * 3];
    rgba[p * 4 + 1] = rgb[p * 3 + 1];
    rgba[p * 4 + 2] = rgb[p * 3 + 2];
    const a = alphaResized[p];
    rgba[p * 4 + 3] = a;
    if (a > 200) fg++;
  }

  const outPng = await sharp(rgba, { raw: { width: ow, height: oh, channels: 4 } }).png().toBuffer();
  return { png: outPng, coverage: fg / (ow * oh) };
}

// Stage 1 — 소스 정규화: 파이프라인의 입력 계약("투명 배경 PNG")을 소스 타입별로 보장한다.
//   drawn:    캔버스 출력은 투명이 보장되어야 정상 — 알파가 전혀 없으면(불투명 흰배경 등)
//             생성까지 가봤자 크로마키에서 실패하므로 여기서 즉시 명확한 에러로 끊는다.
//   uploaded: 서버가 업로드 시점에 싼 분리(flood-fill)를 이미 시도했다(sourceNormalize.ts).
//             여기 오는 uploaded+normPending은 그게 실패한 복잡 배경 — ① flood-fill 재시도
//             (서버와 파라미터 다를 수 있어 한 번 더) → ② AI 매팅(ONNX, CPU) → ③ 실패.
// 실패는 NormalizationError로 구분 — 워커 루프가 에셋 단위 fail(norm-fail)로 승격해
// 같은 에셋의 다른 액션 잡들이 헛되이 GPU를 잡지 않게 한다.
import {
  alphaStats,
  estimateBorderColor,
  floodFillRemove,
  type RgbaImage,
} from "shared/imaging";
import { pngToFrame, frameToPng } from "../image/raster.js";
import { mattingCutout } from "./onnxMatting.js";
import { pipelineConfig } from "../config/index.js";

/** 소스가 파이프라인 입력 계약을 만족시킬 수 없음 — 에셋 단위 즉시 실패 대상 */
export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormalizationError";
  }
}

export interface NormalizeResult {
  png: Buffer;
  /** true면 이 잡에서 새로 정규화한 것 — 서버에 persist(norm-source)할 가치가 있음 */
  changed: boolean;
}

export async function normalizeSource(
  sourcePng: Buffer,
  sourceType: "drawn" | "uploaded",
  normPending: boolean,
): Promise<NormalizeResult> {
  const cfg = pipelineConfig.sourceNormalization;
  const frame = await pngToFrame(sourcePng);
  const stats = alphaStats(frame);

  if (stats.opaque === 0) throw new NormalizationError("source image is fully transparent");

  // 이미 투명 배경(drawn 정상 케이스, 또는 서버 정규화본) — 그대로 통과
  if (stats.transparent / stats.total >= cfg.alreadyTransparentMin) {
    return { png: sourcePng, changed: false };
  }

  if (sourceType === "drawn") {
    // 캔버스 출력인데 투명이 전혀 없음 — 클라 버그 또는 잘못된 제출. 생성 낭비 전에 끊는다.
    throw new NormalizationError("drawn source has no transparent background");
  }

  if (!normPending) {
    // 서버가 정규화본을 내려줬는데 투명이 없다? 데이터 불일치 — 그래도 아래 경로로 구제 시도.
  }

  // ① flood-fill (단색 배경이면 AI 없이 해결)
  const cutout = tryFloodFill(frame, cfg);
  if (cutout) return { png: await frameToPng(cutout), changed: true };

  // ② AI 매팅 (CPU ONNX)
  const { png, coverage } = await mattingCutout(sourcePng);
  if (coverage < cfg.matting.coverageMin || coverage > cfg.matting.coverageMax) {
    throw new NormalizationError(
      `background separation failed (matting coverage ${(coverage * 100).toFixed(1)}%)`,
    );
  }
  return { png, changed: true };
}

function tryFloodFill(
  frame: RgbaImage,
  cfg: typeof pipelineConfig.sourceNormalization,
): RgbaImage | null {
  const { color, varianceNorm } = estimateBorderColor(frame, pipelineConfig.chromaKey.borderBandPx);
  if (varianceNorm > cfg.borderVarianceMax) return null;
  const clone: RgbaImage = { width: frame.width, height: frame.height, data: frame.data.slice() };
  const removed = floodFillRemove(clone, color, cfg.floodThreshold);
  const ratio = removed / (frame.width * frame.height);
  if (ratio < cfg.removedRatioMin || ratio > cfg.removedRatioMax) return null;
  return clone;
}

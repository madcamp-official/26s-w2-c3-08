// 업로드 소스 이미지 수령(ingest) — 검증·재인코딩 + "싼" 배경 분리(테두리 flood-fill)를
// 업로드 시점에 즉시 시도한다. 설계 근거(100유저 병렬 전제):
//   - flood-fill은 1024²에서 수십 ms(CPU)라 업로드 요청 안에서 처리 가능 → 유저가 제출 순간
//     배경 분리 성공/실패 피드백을 받는다(잡이 GPU까지 갔다가 실패하는 왕복 낭비 제거).
//   - 여기서 실패한(복잡한 배경) 이미지만 워커의 AI 매팅(ONNX)으로 넘어간다 — 비싼 것만 워커로.
//   - 게임 서버(Colyseus)와 CPU를 나눠 쓰므로 동시 정규화는 세마포어로 제한.
// 픽셀 로직은 shared/imaging — 워커의 크로마키 제거와 동일 구현.
import sharp from "sharp";
import {
  alphaStats,
  estimateBorderColor,
  floodFillRemove,
  type RgbaImage,
} from "shared/imaging";

/** 정규화 파라미터 — gpu-worker config/pipeline.json chromaKey 값과 의도적으로 동일 계열 */
const MAX_EDGE_PX = 1024;          // 이 이상은 다운스케일(저장·전송·후속 처리 비용 상한)
const BORDER_BAND_PX = 4;
const BORDER_VARIANCE_MAX = 0.06;  // 테두리 분산이 이보다 크면 "단색 배경 아님" → AI로
const FLOOD_THRESHOLD = 0.12;
const REMOVED_RATIO_MIN = 0.1;     // 배경이 거의 안 지워졌으면 실패(전경=배경색과 유사 의심)
const REMOVED_RATIO_MAX = 0.985;   // 거의 다 지워졌으면 전경까지 날린 것 → 실패
const ALREADY_TRANSPARENT_MIN = 0.02; // 투명 픽셀이 이 비율 이상이면 "이미 투명 배경"으로 간주

export interface IngestResult {
  /** EXIF 회전·다운스케일·PNG 재인코딩된 원본 */
  rawPng: Buffer;
  /** flood-fill로 배경 분리에 성공한 투명 PNG. 실패(복잡 배경)면 null → 워커 AI 매팅 대상 */
  normPng: Buffer | null;
  width: number;
  height: number;
}

/** 게임 서버 CPU 보호 — 동시 정규화 상한 */
const MAX_CONCURRENT = 2;
let running = 0;
const waiters: Array<() => void> = [];
async function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return;
  }
  await new Promise<void>((r) => waiters.push(r));
  running++;
}
function release(): void {
  running--;
  const next = waiters.shift();
  if (next) next();
}

/**
 * 업로드 파일 1건 수령: 포맷 검증 → EXIF 회전 → 다운스케일 → PNG 재인코딩 → 배경 분리 시도.
 * 지원 불가 포맷·손상 파일은 sharp가 throw → 라우터가 400으로 변환.
 */
export async function ingestUploadedImage(file: Buffer): Promise<IngestResult> {
  await acquire();
  try {
    // rotate(): EXIF Orientation 반영(폰 사진 회전 문제). 재인코딩 자체가 포맷 검증·악성 파일 차단 역할.
    const base = sharp(file, { limitInputPixels: 32_000_000 }).rotate();
    const meta = await base.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 16 || h < 16) throw new Error("이미지가 너무 작습니다 (최소 16px)");

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h));
    const resized = scale < 1 ? base.resize(Math.round(w * scale), Math.round(h * scale)) : base;

    const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const img: RgbaImage = {
      width: info.width,
      height: info.height,
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    };
    const rawPng = await rgbaToPng(img);

    const stats = alphaStats(img);
    if (stats.transparent / stats.total >= ALREADY_TRANSPARENT_MIN && stats.opaque > 0) {
      // 이미 투명 배경(캔버스 export·기존 누끼 PNG 등) — 그대로 정규화본으로 인정
      return { rawPng, normPng: rawPng, width: img.width, height: img.height };
    }

    const norm = tryFloodFillCutout(img);
    return { rawPng, normPng: norm ? await rgbaToPng(norm) : null, width: img.width, height: img.height };
  } finally {
    release();
  }
}

/** 테두리 단색 배경이면 flood-fill로 분리. 신뢰 못 하면 null(→ AI 매팅). */
function tryFloodFillCutout(img: RgbaImage): RgbaImage | null {
  const { color, varianceNorm } = estimateBorderColor(img, BORDER_BAND_PX);
  if (varianceNorm > BORDER_VARIANCE_MAX) return null;

  const clone: RgbaImage = { width: img.width, height: img.height, data: img.data.slice() };
  const removed = floodFillRemove(clone, color, FLOOD_THRESHOLD);
  const ratio = removed / (img.width * img.height);
  if (ratio < REMOVED_RATIO_MIN || ratio > REMOVED_RATIO_MAX) return null;
  return clone;
}

async function rgbaToPng(img: RgbaImage): Promise<Buffer> {
  const buf = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return sharp(buf, { raw: { width: img.width, height: img.height, channels: 4 } }).png().toBuffer();
}

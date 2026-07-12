// PNG ↔ RgbaFrame 변환 (sharp). 픽셀 단위 stage(크로마키·bbox)는 RgbaFrame으로,
// 저장·리사이즈는 PNG로 오간다.
import sharp from "sharp";
import type { RgbaFrame } from "../pipeline/types.js";

export async function pngToFrame(png: Buffer): Promise<RgbaFrame> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

export async function frameToPng(f: RgbaFrame): Promise<Buffer> {
  const buf = Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength);
  return sharp(buf, { raw: { width: f.width, height: f.height, channels: 4 } }).png().toBuffer();
}

/** 빈(전부 투명) 프레임 생성 — 앵커링 시 이동으로 노출된 영역 채우기용 */
export function emptyFrame(width: number, height: number): RgbaFrame {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** nearest 다운스케일 (64px 그리드 정렬용) — 픽셀아트 경계 보존 */
export async function resizeNearest(f: RgbaFrame, width: number, height: number): Promise<RgbaFrame> {
  const buf = Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength);
  const out = await sharp(buf, { raw: { width: f.width, height: f.height, channels: 4 } })
    .resize(width, height, { kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: out.info.width, height: out.info.height, data: new Uint8ClampedArray(out.data) };
}

// Stage 5h — 최종 프레임들을 가로로 이어붙여 스프라이트시트 PNG 1장으로. 셀 크기 고정(frameW×frameH).
// 산출물 계약(Stage 6): 시트 PNG + { frameCount, frameW, frameH }.
import sharp from "sharp";
import type { RgbaFrame } from "../pipeline/types.js";

export interface SpriteSheet {
  png: Buffer;
  frameCount: number;
  frameW: number;
  frameH: number;
}

export async function packSheet(frames: RgbaFrame[]): Promise<SpriteSheet> {
  if (frames.length === 0) throw new Error("packSheet: no frames");
  const frameW = frames[0].width;
  const frameH = frames[0].height;
  const sheetW = frameW * frames.length;

  const composites = await Promise.all(
    frames.map(async (f, i) => {
      const buf = Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength);
      const png = await sharp(buf, { raw: { width: f.width, height: f.height, channels: 4 } }).png().toBuffer();
      return { input: png, left: i * frameW, top: 0 };
    }),
  );

  const png = await sharp({
    create: { width: sheetW, height: frameH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return { png, frameCount: frames.length, frameW, frameH };
}

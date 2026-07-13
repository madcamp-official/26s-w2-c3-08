// Stage 3 — 투명 배경 원본을 크로마키 단색 위에 합성해 I2V용 RGB start_image를 만든다.
// 생성 해상도(width×height)에 맞춰 비율 유지로 담고, 남는 여백은 키색으로 채운다.
import sharp from "sharp";
import { hexToRgb } from "./color.js";

export async function compositeOnChroma(
  transparentPng: Buffer,
  chromaHex: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const { r, g, b } = hexToRgb(chromaHex);
  return sharp(transparentPng)
    .resize(width, height, { fit: "contain", background: { r, g, b, alpha: 1 } })
    .flatten({ background: { r, g, b } }) // 남은 투명 영역을 키색으로
    .png()
    .toBuffer();
}

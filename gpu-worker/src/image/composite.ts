// Stage 3 — 투명 배경 원본을 크로마키 단색 위에 합성해 I2V용 RGB start_image를 만든다.
// 원본 타일 비율(contentWidth×contentHeight)로 캐릭터를 담고, 그보다 넓은 캔버스
// (paddedWidth×paddedHeight)의 중앙에 배치 — 사방 여백은 팔 휘두르기 등 원본 정지 실루엣
// 밖으로 튀어나오는 동작이 생성 캔버스 경계에서 잘리지 않도록 하는 여유 공간(패딩, config
// generation.resolution.paddingTiles). paddedWidth/Height를 생략하면 여백 없이 기존 동작과 동일.
import sharp from "sharp";
import { hexToRgb } from "./color.js";

export async function compositeOnChroma(
  transparentPng: Buffer,
  chromaHex: string,
  contentWidth: number,
  contentHeight: number,
  paddedWidth: number = contentWidth,
  paddedHeight: number = contentHeight,
): Promise<Buffer> {
  const { r, g, b } = hexToRgb(chromaHex);
  const content = await sharp(transparentPng)
    .resize(contentWidth, contentHeight, { fit: "contain", background: { r, g, b, alpha: 1 } })
    .flatten({ background: { r, g, b } }) // 남은 투명 영역을 키색으로
    .png()
    .toBuffer();
  if (paddedWidth === contentWidth && paddedHeight === contentHeight) return content;

  const offsetX = Math.round((paddedWidth - contentWidth) / 2);
  const offsetY = Math.round((paddedHeight - contentHeight) / 2);
  return sharp({ create: { width: paddedWidth, height: paddedHeight, channels: 3, background: { r, g, b } } })
    .composite([{ input: content, left: offsetX, top: offsetY }])
    .png()
    .toBuffer();
}

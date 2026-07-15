// 고정 크기 부속품(아이콘 칩·idle/walk/onAir 탭·작은 버튼)용 손그림 상자.
// SketchBox와 동작은 같으나 width/height를 명시적으로 고정 — "미리 그려둔 부속품" 역할.
import { forwardRef } from "react";
import { SketchBox } from "./SketchBox.js";
import type { SketchBoxProps } from "./SketchBox.js";

export interface SketchTileProps extends Omit<SketchBoxProps, "style"> {
  w: number;
  h: number;
  style?: React.CSSProperties;
}

export const SketchTile = forwardRef<HTMLElement, SketchTileProps>(function SketchTile(
  { w, h, style, radius = 8, preset = "chip", ...rest },
  ref,
) {
  return (
    <SketchBox
      ref={ref}
      radius={radius}
      preset={preset}
      style={{ width: w, height: h, flex: "none", ...style }}
      {...rest}
    />
  );
});

// 타일 격자 오버레이 — 큰 색면(타이틀 밴드·배경·큰 버튼) 위에 얹는 표시 전용 패턴.
import { TILE_OVERLAY } from "../tokens/index.js";

export function TileTexture({ tilePx = 28 }: { tilePx?: number }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${TILE_OVERLAY} 1px, transparent 1px), linear-gradient(90deg, ${TILE_OVERLAY} 1px, transparent 1px)`,
        backgroundSize: `${tilePx}px ${tilePx}px`,
      }}
    />
  );
}

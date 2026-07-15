// 맵 캔버스 — 패널·버튼에 가려지는 공간을 뺀 나머지 전체가 편집 영역(2026-07-15, 박스로 안 그림).
// 휠 = 확대/축소(범위 제한, 커서 기준 줌), 우클릭 드래그 = 이동(팬, 범위 제한).
// 지금은 배치 로직 없이 40×20 타일 테스트 격자만 표시.
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { edgeTransition, fromCenter } from "../motionTokens.js";

const EDITOR_TILE_PX = 48;
const MAP_TILES_W = 40;
const MAP_TILES_H = 20;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
/** 휠 deltaY 1당 배율 변화량 */
const ZOOM_SENSITIVITY = 0.0015;

const WORLD_W = MAP_TILES_W * EDITOR_TILE_PX;
const WORLD_H = MAP_TILES_H * EDITOR_TILE_PX;

export function MapCanvas({ index, closing }: { index: number; closing: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const centeredOnce = useRef(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function clampPan(nx: number, ny: number, z: number, viewport: { w: number; h: number }) {
    const ww = WORLD_W * z;
    const wh = WORLD_H * z;
    const minX = Math.min(0, viewport.w - ww);
    const maxX = Math.max(0, viewport.w - ww);
    const minY = Math.min(0, viewport.h - wh);
    const maxY = Math.max(0, viewport.h - wh);
    return { x: Math.min(maxX, Math.max(minX, nx)), y: Math.min(maxY, Math.max(minY, ny)) };
  }

  // 처음 크기를 알게 되면 한 번만 중앙 정렬
  useEffect(() => {
    if (centeredOnce.current || size.w === 0) return;
    centeredOnce.current = true;
    setPan(clampPan((size.w - WORLD_W) / 2, (size.h - WORLD_H) / 2, 1, size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = hostRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx - pan.x) / zoom;
    const worldY = (my - pan.y) / zoom;
    const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * (1 - e.deltaY * ZOOM_SENSITIVITY)));
    const nx = mx - worldX * nextZoom;
    const ny = my - worldY * nextZoom;
    setZoom(nextZoom);
    setPan(clampPan(nx, ny, nextZoom, size));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 2) return; // 우클릭만 팬
    e.preventDefault();
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    if (!panStart.current) return;
    const nx = panStart.current.panX + (e.clientX - panStart.current.x);
    const ny = panStart.current.panY + (e.clientY - panStart.current.y);
    setPan(clampPan(nx, ny, zoom, size));
  }
  function onPointerUp() {
    panStart.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  return (
    <motion.div
      variants={fromCenter}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      ref={hostRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        flex: 1,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: WORLD_W,
          height: WORLD_H,
          transformOrigin: "0 0",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          border: "2px solid #fff",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: `${EDITOR_TILE_PX}px ${EDITOR_TILE_PX}px`,
        }}
      />
    </motion.div>
  );
}

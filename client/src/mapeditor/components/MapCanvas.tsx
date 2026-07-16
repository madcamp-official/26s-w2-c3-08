// 맵 캔버스 — <canvas> 2D 렌더 + 입력. 배치(좌클릭)·삭제(우클릭)·팬(좌우 동시)·줌(휠)·깃발 드래그.
// 연속배치/연속삭제(드래그 중 지나가는 타일마다 계속) + 판정 정밀도 차등(드래그 중엔 타일 중앙 부근만 인정).
// 렌더는 CanvasRenderer.drawEditor, 상태는 editorStore. rAF 루프로 매 프레임 다시 그린다.
//
// 좌우 동시 팬: 마우스는 버튼 하나가 이미 눌린 채로 다른 버튼을 누르면 브라우저가 새 pointerdown을
// 안 쏘고 pointermove의 buttons 비트마스크로만 알려준다 — 그래서 버튼 상태는 항상 e.buttons로 판정한다
// (onPointerDown에서만 판정하면 두 번째 버튼 누름을 놓치는 버그가 있었음, 2026-07-16 수정).
//
// 리사이즈 깜빡임: canvas.width/height를 다시 쓰면 그 순간 내용이 즉시 지워지는데, 독립된 rAF 루프가
// "다음 프레임"에야 다시 그려서 옆 패널이 스프링 애니메이션 중일 때마다 한 프레임씩 빈 화면이 보였다
// — 리사이즈 직후 draw()를 즉시 동기 호출해서 해결(2026-07-16).
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { edgeTransition, fromCenter } from "../motionTokens.js";
import { useEditorStore } from "../editorStore.js";
import { drawEditor, type GhostInfo } from "../render/CanvasRenderer.js";
import { GRID_W, GRID_H, EDITOR_TILE_PX as TILE, inBounds } from "../engine/grid.js";
import { anchorToTopLeft, occupiedTiles, canPlace } from "../engine/placement.js";
import { flagForbiddenTiles, bothFlagsForbidden } from "../engine/flags.js";
import { playSound } from "../../audio/sfx.js";
import { getSlotImage } from "../render/images.js";
import { setCanvasHost } from "../testmode/testRunner.js";

const WORLD_W = GRID_W * TILE;
const WORLD_H = GRID_H * TILE;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_SENSITIVITY = 0.0015;
/** 연속 드래그 중 타일 인정 범위 — 타일 중앙 기준 이 폭(0~1)만 인정(가장자리 스침 제외) */
const DRAG_CENTER_WINDOW = 0.5;

const BTN_LEFT = 1;
const BTN_RIGHT = 2;
/** 좌우 동시누름 팬 유예(ms) — 이 시간 안에 반대 버튼이 오면 단독 동작(배치/삭제/깃발잡기)을
 *  실행하지 않고 팬으로 전환한다(스펙: "클릭 즉시 반응하지 않고 짧게 대기"). 한쪽이 미세하게
 *  먼저 눌려도 오배치가 없도록 pointerdown에서는 절대 즉시 실행하지 않는다. */
const PAN_GRACE_MS = 90;

interface Tile { x: number; y: number }

export function MapCanvas({ index, closing }: { index: number; closing: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 카메라·뷰포트 (렌더 루프가 읽는 mutable 상태 — 리렌더 유발 안 함)
  const pan = useRef({ x: 0, y: 0 });
  const zoom = useRef(1);
  const css = useRef({ w: 0, h: 0, dpr: 1 });
  const centered = useRef(false);
  const hover = useRef<Tile | null>(null);
  const hoverFrac = useRef({ fx: 0.5, fy: 0.5 }); // 타일 내 상대위치(0~1) — 드래그 판정정밀도용
  const drawRef = useRef<() => void>(() => {});

  // 제스처 상태
  const g = useRef({
    buttons: 0, // 최신 e.buttons 비트마스크(1=좌,2=우)
    panning: false,
    dragMode: null as null | "place" | "erase",
    flag: null as null | "start" | "end",
    lastActedTile: null as string | null, // 연속배치/삭제 중복 방지
    panLast: { x: 0, y: 0 },
    // 팬 유예 중 보류된 단독 동작 — 타이머 만료 시 실행, 반대 버튼 오면 폐기
    pending: null as null | { mode: "place" | "erase" | "flag"; flag?: "start" | "end"; tile: Tile; timer: number },
  });

  /** 보류 동작 폐기(타이머 포함) */
  function cancelPending() {
    const p = g.current.pending;
    if (p) { clearTimeout(p.timer); g.current.pending = null; }
  }

  /** 보류 동작을 지금 실행(유예 만료 or 유예 중 pointerup) */
  function commitPending() {
    const p = g.current.pending;
    if (!p) return;
    clearTimeout(p.timer);
    g.current.pending = null;
    if (p.mode === "flag") {
      g.current.flag = p.flag!;
      useEditorStore.getState().setLiftedFlag(p.flag!);
      playSound("pick");
      return;
    }
    g.current.dragMode = p.mode;
    g.current.lastActedTile = null;
    actOnTile(p.tile, p.mode, false); // 단일 클릭 첫 타일 — 느슨한 판정으로 즉시 인정
    g.current.lastActedTile = `${p.tile.x},${p.tile.y}`;
  }

  function clampPan(nx: number, ny: number, z: number) {
    const ww = WORLD_W * z, wh = WORLD_H * z;
    const { w, h } = css.current;
    const minX = Math.min(0, w - ww), maxX = Math.max(0, w - ww);
    const minY = Math.min(0, h - wh), maxY = Math.max(0, h - wh);
    return { x: Math.min(maxX, Math.max(minX, nx)), y: Math.min(maxY, Math.max(minY, ny)) };
  }

  /** 포인터 → 타일(+타일 내 상대위치 0~1, 격자 밖일 수 있음) */
  function tileUnder(e: { clientX: number; clientY: number }): Tile {
    const rect = canvasRef.current!.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - pan.current.x) / zoom.current;
    const worldY = (e.clientY - rect.top - pan.current.y) / zoom.current;
    const tx = Math.floor(worldX / TILE), ty = Math.floor(worldY / TILE);
    hoverFrac.current = { fx: worldX / TILE - tx, fy: worldY / TILE - ty };
    return { x: tx, y: ty };
  }

  /** 드래그 중엔 타일 중앙 부근만 인정(가장자리 스침으로 옆 타일 오염 방지) */
  function nearTileCenter(): boolean {
    const { fx, fy } = hoverFrac.current;
    const lo = (1 - DRAG_CENTER_WINDOW) / 2, hi = 1 - lo;
    return fx >= lo && fx <= hi && fy >= lo && fy <= hi;
  }

  function inFlagZone(t: Tile, which: "start" | "end"): boolean {
    const s = useEditorStore.getState();
    const flag = which === "start" ? s.startFlag : s.endFlag;
    return flagForbiddenTiles(flag).includes(`${t.x},${t.y}`);
  }

  /** 현재 타일에 배치/삭제 시도(단일클릭=판정 느슨, 연속드래그=중앙판정+중복타일 스킵) */
  function actOnTile(t: Tile, mode: "place" | "erase", continuous: boolean) {
    if (continuous) {
      const key = `${t.x},${t.y}`;
      if (key === g.current.lastActedTile) return;
      if (!nearTileCenter()) return;
      g.current.lastActedTile = key;
    }
    const s = useEditorStore.getState();
    if (mode === "place") {
      if (!inBounds(t.x, t.y)) return;
      playSound(s.placeAtAnchor(t.x, t.y) ? "place" : "denied");
    } else {
      if (s.eraseAt(t.x, t.y)) playSound("erase");
    }
  }

  // 캔버스 크기·DPR 추적 — 리사이즈 직후 즉시 재드로우(깜빡임 방지)
  // 테스트 모드가 이 호스트 위에 Phaser 게임을 얹을 수 있게 등록(testRunner.ts)
  useEffect(() => {
    setCanvasHost(hostRef.current);
    return () => { setCanvasHost(null); cancelPending(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const measure = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = host.clientWidth, h = host.clientHeight;
      css.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (!centered.current && w > 0) {
        centered.current = true;
        pan.current = clampPan((w - WORLD_W) / 2, (h - WORLD_H) / 2, 1);
      }
      drawRef.current();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // rAF 렌더 루프 — draw()는 measure()에서도 직접 호출되므로 ref에 담아 공유
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const { dpr } = css.current;
      const z = zoom.current, px = pan.current.x, py = pan.current.y;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, css.current.w, css.current.h);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * px, dpr * py);

      const s = useEditorStore.getState();
      const items = Object.values(s.placements);

      let ghost: GhostInfo | null = null;
      const brush = s.brush();
      const hv = hover.current;
      if (brush && hv && inBounds(hv.x, hv.y) && brush.category !== "background" && brush.category !== "avatar") {
        const tl = anchorToTopLeft(hv.x, hv.y, brush.h);
        const occ = occupiedTiles(items);
        const forb = bothFlagsForbidden(s.startFlag, s.endFlag);
        ghost = { x: tl.x, y: tl.y, w: brush.w, h: brush.h, ok: canPlace(tl.x, tl.y, brush.w, brush.h, occ, forb) };
      }

      drawEditor(ctx, { placements: items, startFlag: s.startFlag, endFlag: s.endFlag, ghost, testing: false, liftedFlag: s.liftedFlag });

      // 커스텀 커서 이미지 있으면 적용(로드 전엔 null → 기본 크로스헤어 유지)
      const cursorImg = getSlotImage("cursor");
      const wantCursor = cursorImg ? `url(${cursorImg.src}) 4 4, crosshair` : "crosshair";
      if (canvas.style.cursor !== wantCursor) canvas.style.cursor = wantCursor;
    };
    drawRef.current = draw;

    let raf = 0;
    const frame = () => { draw(); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const worldX = (mx - pan.current.x) / zoom.current;
    const worldY = (my - pan.current.y) / zoom.current;
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.current * (1 - e.deltaY * ZOOM_SENSITIVITY)));
    zoom.current = nz;
    pan.current = clampPan(mx - worldX * nz, my - worldY * nz, nz);
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    const t = tileUnder(e);
    hover.current = t;
    g.current.buttons = e.buttons;

    if ((g.current.buttons & BTN_LEFT) && (g.current.buttons & BTN_RIGHT)) {
      cancelPending();
      startPanning(e);
      return;
    }
    // 단독 버튼 — 즉시 실행하지 않고 PAN_GRACE_MS 보류(반대 버튼이 오면 팬으로 전환, 오배치 방지)
    cancelPending();
    let pending: { mode: "place" | "erase" | "flag"; flag?: "start" | "end"; tile: Tile; timer: number } | null = null;
    if (e.button === 0) {
      if (inFlagZone(t, "start")) pending = { mode: "flag", flag: "start", tile: t, timer: 0 };
      else if (inFlagZone(t, "end")) pending = { mode: "flag", flag: "end", tile: t, timer: 0 };
      else pending = { mode: "place", tile: t, timer: 0 };
    } else if (e.button === 2) {
      pending = { mode: "erase", tile: t, timer: 0 };
    }
    if (pending) {
      pending.timer = window.setTimeout(commitPending, PAN_GRACE_MS);
      g.current.pending = pending;
    }
  }

  function startPanning(e: { clientX: number; clientY: number }) {
    g.current.panning = true;
    g.current.dragMode = null;
    if (g.current.flag) useEditorStore.getState().setLiftedFlag(null);
    g.current.flag = null;
    g.current.panLast = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const t = tileUnder(e);
    hover.current = t;
    g.current.buttons = e.buttons;

    // 반대쪽 버튼이 추가로 눌리면 팬으로 전환 — 보류 중이던 단독 동작은 폐기(오배치 방지 핵심)
    if (!g.current.panning && (g.current.buttons & BTN_LEFT) && (g.current.buttons & BTN_RIGHT)) {
      cancelPending();
      startPanning(e);
      return;
    }

    if (g.current.panning) {
      const dx = e.clientX - g.current.panLast.x, dy = e.clientY - g.current.panLast.y;
      pan.current = clampPan(pan.current.x + dx, pan.current.y + dy, zoom.current);
      g.current.panLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (g.current.flag) {
      useEditorStore.getState().moveFlag(g.current.flag, t.x, t.y);
      return;
    }
    if (g.current.dragMode) {
      actOnTile(t, g.current.dragMode, true); // 연속배치/삭제 — 타일 중앙판정+중복스킵
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    g.current.buttons = e.buttons;
    // 유예가 안 끝난 빠른 클릭 — 놓는 순간 실행(클릭 손실 없음). 깃발 잡기는 클릭 후 즉시 놓으면 들었다 놓는 셈이라 무시.
    if (g.current.pending) {
      if (g.current.pending.mode !== "flag") commitPending();
      else cancelPending();
    }
    if (!(g.current.buttons & BTN_LEFT) && !(g.current.buttons & BTN_RIGHT)) {
      g.current.panning = false;
      g.current.dragMode = null;
      if (g.current.flag) useEditorStore.getState().setLiftedFlag(null);
      g.current.flag = null;
      g.current.lastActedTile = null;
      try { canvasRef.current!.releasePointerCapture(e.pointerId); } catch { /* 이미 해제됨 */ }
    }
  }

  return (
    <motion.div
      variants={fromCenter}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      ref={hostRef}
      style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", background: "#16212e" }}
    >
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: "block", touchAction: "none", cursor: "crosshair" }}
      />
    </motion.div>
  );
}

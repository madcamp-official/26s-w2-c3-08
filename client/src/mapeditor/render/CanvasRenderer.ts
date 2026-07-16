// 맵 캔버스 2D 렌더 — 순수 함수. 호출부(MapCanvas)가 pan/zoom 변환을 이미 적용한 상태로 넘긴다.
// 스프라이트 실물 전까지 배치물은 카테고리색 사각형으로 자리표시(폴백과 동일 철학).
// 깃발·기단 이미지는 client/public/mapeditor-assets/에 파일만 넣으면 코드 수정 없이 반영(images.ts).
import { GRID_W, GRID_H, EDITOR_TILE_PX as TILE } from "../engine/grid.js";
import type { PlacedItem } from "../engine/placement.js";
import { flagForbiddenTiles, type FlagPos } from "../engine/flags.js";
import { FLAGPOLE } from "shared/race";
import { WORLD } from "../../design/tokens/index.js";
import { getSlotImage, getAssetImage } from "./images.js";

/** 배치 카테고리 대표색 — design/tokens WORLD 팔레트와 통일(창고 카드 색과 동일 기준) */
const CAT_FILL: Record<string, string> = {
  block: WORLD.device,
  monster: WORLD.enemy,
  item: WORLD.item,
};

/** 배치 미리보기 고스트(좌상단 타일 + 크기 + 가능여부) */
export interface GhostInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  ok: boolean;
}

export interface RenderParams {
  placements: PlacedItem[];
  startFlag: FlagPos;
  endFlag: FlagPos;
  ghost: GhostInfo | null;
  /** 테스트 중이면 격자 숨김(P2). P1은 항상 false. */
  testing: boolean;
  /** 드래그로 들려 있는 깃발 — 흔들흔들+그림자 연출(스펙: 꾹 누르면 들림 표시) */
  liftedFlag?: "start" | "end" | null;
}

export function drawEditor(ctx: CanvasRenderingContext2D, p: RenderParams): void {
  const worldW = GRID_W * TILE;
  const worldH = GRID_H * TILE;

  // 플레이 영역 배경 — 인게임 하늘색 수직 그라데이션(screen-design.md UI테마: 스카이블루=배경) 재사용
  const sky = ctx.createLinearGradient(0, 0, 0, worldH);
  sky.addColorStop(0, "#8FC6EE");
  sky.addColorStop(1, "#4A9DE0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, worldW, worldH);

  // 깃발 금지구역 — 옅은 빨강 틴트
  ctx.fillStyle = "rgba(229,37,33,0.16)";
  for (const flag of [p.startFlag, p.endFlag]) {
    for (const key of flagForbiddenTiles(flag)) {
      const [fx, fy] = key.split(",").map(Number);
      if (fx < 0 || fx >= GRID_W || fy < 0 || fy >= GRID_H) continue;
      ctx.fillRect(fx * TILE, fy * TILE, TILE, TILE);
    }
  }

  // 격자 — 타일마다 옅은 선 + 4타일마다 굵은 기준선(가독성), 재질감 있는 흰 오버레이
  if (!p.testing) {
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID_W; x++) { ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, worldH); }
    for (let y = 0; y <= GRID_H; y++) { ctx.moveTo(0, y * TILE); ctx.lineTo(worldW, y * TILE); }
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= GRID_W; x += 4) { ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, worldH); }
    for (let y = 0; y <= GRID_H; y += 4) { ctx.moveTo(0, y * TILE); ctx.lineTo(worldW, y * TILE); }
    ctx.stroke();
  }

  // 플레이 영역 테두리
  ctx.strokeStyle = "rgba(59,47,20,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, worldW - 3, worldH - 3);

  // 배치물 — 실제 원본 그림 있으면 그걸로, 없으면 카테고리색 사각형 폴백
  for (const it of p.placements) {
    const x = it.x * TILE + 2, y = it.y * TILE + 2, w = it.w * TILE - 4, h = it.h * TILE - 4;
    const img = it.sourceImageUrl ? getAssetImage(it.sourceImageUrl) : null;
    if (img) {
      ctx.save();
      if (it.flipX) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); }
      else ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = CAT_FILL[it.category] ?? "#888";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      if (it.flipX) {
        // 좌우반전 표시 — 좌상단 작은 삼각(폴백 사각형에서만, 실그림은 위에서 이미 반전됨)
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 14, y + 4); ctx.lineTo(x + 4, y + 14);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // 깃발 — 들려 있는 쪽은 흔들흔들 + 그림자
  drawFlag(ctx, p.startFlag, "#1D9E75", "flagStart", p.liftedFlag === "start");
  drawFlag(ctx, p.endFlag, "#F6BE00", "flagEnd", p.liftedFlag === "end");

  // 배치 고스트
  if (p.ghost) {
    const g = p.ghost;
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = g.ok ? "#4A9DE0" : "#E52521";
    ctx.fillRect(g.x * TILE, g.y * TILE, g.w * TILE, g.h * TILE);
    ctx.globalAlpha = 1;
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, flag: FlagPos, color: string, slot: "flagStart" | "flagEnd", lifted = false): void {
  const half = Math.floor(FLAGPOLE.baseWidthTiles / 2);
  const cx = (flag.x + 0.5) * TILE;
  const baseTop = (flag.y + 1) * TILE;
  const poleTop = (flag.y - (FLAGPOLE.poleHeightTiles - 1)) * TILE;
  const baseLeft = (flag.x - half) * TILE;
  const baseW = FLAGPOLE.baseWidthTiles * TILE;

  ctx.save();
  if (lifted) {
    // 들림 연출 — 발밑 타원 그림자(제자리) + 깃발 전체 살짝 위로 + 시간 기반 좌우 흔들흔들 회전
    ctx.fillStyle = "rgba(59,47,20,0.30)";
    ctx.beginPath();
    ctx.ellipse(cx, baseTop + TILE + 4, baseW * 0.42, TILE * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    const t = performance.now() / 1000;
    const wobble = Math.sin(t * 9) * 0.05; // ±약 3도
    const pivotX = cx, pivotY = baseTop + TILE; // 기단 바닥 기준으로 흔들리게
    ctx.translate(pivotX, pivotY - 7); // 살짝 들림
    ctx.rotate(wobble);
    ctx.translate(-pivotX, -pivotY);
  }

  // 기단 3×1 — 이미지 있으면 그걸로, 없으면 반투명 채움
  const baseImg = getSlotImage("flagBase");
  if (baseImg) ctx.drawImage(baseImg, baseLeft, baseTop, baseW, TILE);
  else {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(baseLeft, baseTop, baseW, TILE);
  }

  // 깃발+깃대 — 이미지 있으면 그걸로(깃대 높이 영역에 맞춤), 없으면 벡터
  const flagImg = getSlotImage(slot);
  const poleH = baseTop - poleTop;
  if (flagImg) {
    const w = poleH * (flagImg.naturalWidth / flagImg.naturalHeight);
    ctx.drawImage(flagImg, cx - w * 0.15, poleTop, w, poleH);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, baseTop);
    ctx.lineTo(cx, poleTop);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, poleTop);
    ctx.lineTo(cx + TILE * 0.8, poleTop + TILE * 0.3);
    ctx.lineTo(cx, poleTop + TILE * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

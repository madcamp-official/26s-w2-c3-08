// 아이템 파츠 (§58): 6종. 획득 = 자기 클라 판정, 경합 = 서버 가중랜덤(§60).
import { TUNING, type Tuning } from "../physics/tuning.js";
import type { Terrain } from "../physics/terrain.js";
import { type Body, createBody, moveAndCollide } from "../physics/body.js";
import type { Avatar } from "./avatar.js";
import { applySizeStage } from "./avatar.js";

export type ItemKind = "speed" | "sizeUp" | "sizeDown" | "hpUp" | "invincible" | "score" | "giant";

export interface ItemSpec {
  id: string;
  kind: ItemKind;
  x: number; y: number;
  asset?: string;
  durationMs?: number;        // 종료 옵션: 지속시간 (§58)
  removeOnHit?: boolean;      // 종료 옵션: 피해 시 제거
  score?: number;
}

export interface ItemInstance {
  spec: ItemSpec;
  taken: boolean;
  respawnLeftMs: number;
  /** 물음표 블록을 내려찍어(pound) 나온 아이템만 중력을 받아 바닥까지 떨어짐(§B, 2026-07-16).
   *  머리치기로 나온 아이템은 원작처럼 제자리에 뜬 채로 유지(gravity 없음). */
  body?: Body;
  falling: boolean;
}

export function createItem(spec: ItemSpec, falling = false): ItemInstance {
  const body = falling ? createBody(spec.x, spec.y, TUNING.sizes.item, TUNING.sizes.item, ["item"]) : undefined;
  return { spec, taken: false, respawnLeftMs: 0, body, falling };
}

/** 매 틱: 내려찍기로 나온 아이템만 중력+충돌 적용, 착지하면 정지(§B) */
export function stepItemPhysics(item: ItemInstance, terrain: Terrain, dtMs: number, t: Tuning = TUNING): void {
  if (!item.falling || !item.body) return;
  const b = item.body;
  b.vy = Math.min(b.vy + t.gravity.base * (dtMs / 1000), t.gravity.maxFallSpeed);
  moveAndCollide(b, terrain, dtMs, t);
  item.spec.x = b.x; item.spec.y = b.y;
  if (b.grounded) { item.falling = false; b.vy = 0; }
}

/** 획득 적용 (서버 중재 승리 후, 자기 클라에서). 0.4초 고정 + 하이라이트(§58) */
export function applyItem(a: Avatar, spec: ItemSpec, t: Tuning = TUNING): void {
  // 0.4초 고정은 크기 전환에만 (그 외 정지 없음 — 2026-07-12)
  if (spec.kind === "sizeUp" || spec.kind === "sizeDown") a.freezeLeftMs = t.item.pickupFreezeMs;
  a.fx.add("pickup");
  switch (spec.kind) {
    case "speed":
      a.speedMult = t.item.speedBoostMult;
      a.speedMultLeftMs = spec.durationMs ?? t.item.speedBoostMs;
      break;
    case "sizeUp":
      applySizeStage(a, a.sizeStage >= 3 ? 3 : ((a.sizeStage + 1) as 1 | 2 | 3), t);
      break;
    case "giant":
      // 거대버섯(ItemAttrs effect=giant_mushroom): 생명+1 + 크기 확대 — 둘 다 (asset-attributes §4)
      a.hp = Math.min(2, a.hp + 1);
      applySizeStage(a, a.sizeStage >= 3 ? 3 : ((a.sizeStage + 1) as 1 | 2 | 3), t);
      a.freezeLeftMs = t.item.pickupFreezeMs;   // 크기 전환 고정(§58) — kind 분기 위에서 못 잡으므로 여기서
      break;
    case "sizeDown":
      applySizeStage(a, a.sizeStage <= 1 ? 1 : ((a.sizeStage - 1) as 1 | 2 | 3), t);
      break;
    case "hpUp":
      a.hp = Math.min(2, a.hp + 1);   // 최대 2 (§58)
      break;
    case "invincible":
      a.invincibleLeftMs = spec.durationMs ?? t.item.invincibleMs;
      break;
    case "score":
      break; // 점수는 서버 집계 (세부는 게임 흐름 때)
  }
}

/** 라인 이탈 시 효과 전부 소멸 (§58) */
export function clearItemEffects(a: Avatar, t: Tuning = TUNING): void {
  a.speedMult = 1; a.speedMultLeftMs = 0;
  a.invincibleLeftMs = 0;
  applySizeStage(a, 2, t);
}

/** 피해 시: removeOnHit 효과 제거는 호출부(피해 처리)에서 이 함수로 */
export function onAvatarHit(a: Avatar, activeRemoveOnHit: boolean, t: Tuning = TUNING): void {
  if (activeRemoveOnHit) clearItemEffects(a, t);
}

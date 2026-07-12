// 아이템 파츠 (§58): 6종. 획득 = 자기 클라 판정, 경합 = 서버 가중랜덤(§60).
import { TUNING, type Tuning } from "../physics/tuning.js";
import type { Avatar } from "./avatar.js";
import { applySizeStage } from "./avatar.js";

export type ItemKind = "speed" | "sizeUp" | "sizeDown" | "hpUp" | "invincible" | "score";

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
}

export function createItem(spec: ItemSpec): ItemInstance {
  return { spec, taken: false, respawnLeftMs: 0 };
}

/** 획득 적용 (서버 중재 승리 후, 자기 클라에서). 0.4초 고정 + 하이라이트(§58) */
export function applyItem(a: Avatar, spec: ItemSpec, t: Tuning = TUNING): void {
  a.freezeLeftMs = t.item.pickupFreezeMs;
  a.fx.add("pickup");
  switch (spec.kind) {
    case "speed":
      a.speedMult = t.item.speedBoostMult;
      a.speedMultLeftMs = spec.durationMs ?? t.item.speedBoostMs;
      break;
    case "sizeUp":
      applySizeStage(a, a.sizeStage >= 3 ? 3 : ((a.sizeStage + 1) as 1 | 2 | 3), t);
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

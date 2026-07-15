// 게임 상태 → 액션명(ActionName) 결정. 매니페스트에 그 액션이 없으면 호출부가 idle로
// 재시도하고, idle도 없으면 폴백(사각형)으로 떨어진다 — 여기는 "이상적으로 뭘 틀지"만 answer.
import type { ActionName } from "shared/actions";
import type { Body } from "shared/physics";

const WALK_VX_THRESHOLD = 20;   // px/s — 이보다 느리면 정지로 취급(발끝 미세 잔진동 무시)

/** 아바타(플레이어) 몸 상태 → 액션. 웅크림·슬라이드·내려찍기 등은 액션이 아니라
 *  기존 squash/crouchSpring 연출로 표현(§actions/catalog.ts 방침) — 여기서 분기 안 함. */
export function resolveAvatarAction(b: Pick<Body, "grounded" | "vx">): ActionName {
  if (!b.grounded) return "onair";
  if (Math.abs(b.vx) > WALK_VX_THRESHOLD) return "walk";
  return "idle";
}

/** 몬스터 currentAction(behavior do-type 문자열) → 대략 대응되는 액션. 매핑 없으면 idle. */
const MONSTER_ACTION_MAP: Record<string, ActionName> = {
  patrol: "walk", walk: "walk", chase: "walk",
  fly: "fly", hover: "fly",
  climb: "climb",
  shoot: "attack", slamDown: "attack", chargeSide: "attack",
};
export function resolveMonsterAction(currentAction: string): ActionName {
  return MONSTER_ACTION_MAP[currentAction] ?? "idle";
}

// PvP 로컬 판정 (§14): 밀기 = "내 몸만" 고스트에서 빠져나옴. 밟기 = 당하는 쪽 확정.
// 전부 "자기 클라"에서 자기 아바타에 대해서만 실행한다.
import { TUNING, type Tuning } from "../physics/tuning.js";
import type { Body } from "../physics/body.js";
import { left, right, top, bottom } from "../physics/body.js";
import type { Avatar } from "./avatar.js";

export interface Ghost { x: number; y: number; w: number; h: number; }

function overlap(b: Body, g: Ghost): { ox: number; oy: number } | null {
  const gl = g.x - g.w / 2, gr = g.x + g.w / 2, gt = g.y - g.h, gb = g.y;
  const ox = Math.min(right(b), gr) - Math.max(left(b), gl);
  const oy = Math.min(bottom(b), gb) - Math.max(top(b), gt);
  return ox > 0 && oy > 0 ? { ox, oy } : null;
}

/** 밀기: 겹친 고스트에서 나만 soft push로 빠져나옴 (§14-4).
 *  intents[i]=true = "내가 이 고스트를 미는 중(상대는 저항 안 함)". 이때는 작은 겹침(contactPad)을
 *  남겨 상대 클라가 상대를 밀어내도록 함 → 걷기 속도로도 밀기 성립. 초과분만 진입 반대로 제거(관통 방지). */
export function pushSelfOut(me: Body, ghosts: Ghost[], t: Tuning = TUNING, intents?: boolean[]): void {
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    const o = overlap(me, g);
    if (!o) continue;
    if (o.oy <= t.stomp.headBandPx) continue; // 머리 밴드는 밟기/서기 몫
    // 탈출 방향 = 내가 들어온 쪽(이동 방향의 반대)으로 고정 → 반대편으로 뒤집혀 관통하는 것 방지.
    const dir = me.vx > 0 ? -1 : me.vx < 0 ? 1 : (me.x < g.x ? -1 : 1);
    // 내가 미는 중이면 contactPad만큼 겹침 유지(상대가 밀림), 아니면 전부 빼냄(깔끔한 분리/벽)
    const keep = intents && intents[i] ? t.push.contactPad : 0;
    const amount = Math.min(Math.max(0, o.ox - keep), t.push.separatePerTick);
    me.x += dir * amount;
  }
}

/** 내가 밟혔는가 (당하는 쪽 판정): 고스트 발이 내 머리 밴드에 + 빠른 낙하 */
export function checkStompedMe(me: Avatar, ghosts: (Ghost & { vy: number; pound?: number })[], t: Tuning = TUNING): boolean {
  const b = me.body;
  for (const g of ghosts) {
    if (g.vy < t.stomp.minFallSpeed) continue;
    const hOv = Math.min(right(b), g.x + g.w / 2) - Math.max(left(b), g.x - g.w / 2);
    if (hOv <= b.w * 0.3) continue;
    if (g.y >= top(b) && g.y <= top(b) + t.stomp.headBandPx) {
      if (g.pound) {
        // 내려찍기에 밟힘 → 넉백 + 기절 (§원작 멀티)
        b.vx = (b.x >= g.x ? 1 : -1) * t.item.knockbackVx;
        b.vy = t.item.knockbackVy;
        me.stunLeftMs = t.stomp.stunMs;
      } else {
        b.vy = b.vy < 0 ? t.stomp.downVelocity : b.vy + t.stomp.downVelocity;
      }
      return true;
    }
  }
  return false;
}

/** 내가 밟았는가 (공격자 연출·튕김 즉시, §14-5). 밟은 고스트 index 반환, 없으면 -1.
 *  reachMult: 내려찍기 시 판정 확대 배율 (아바타 한정 — 지형·블록은 무관) */
export function checkIStomped(me: Avatar, ghosts: Ghost[], t: Tuning = TUNING, reachMult = 1, prevBottom = -Infinity): number {
  const b = me.body;
  if (b.vy < t.stomp.minFallSpeed) return -1;
  const band = t.stomp.headBandPx * reachMult;
  const minOv = b.w * 0.3 / reachMult;
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    const hOv = Math.min(right(b), g.x + g.w / 2) - Math.max(left(b), g.x - g.w / 2);
    if (hOv <= minOv) continue;
    const gTop = g.y - g.h;
    // 밴드 내 or 스윕(직전엔 머리 위였는데 지금 통과) — 빠른 낙하 터널링에도 밟기 성립
    const within = bottom(b) >= gTop && bottom(b) <= gTop + band;
    const crossed = prevBottom <= gTop && bottom(b) >= gTop;
    if (within || crossed) {
      b.vy = t.stomp.bounceVelocity;
      b.y = gTop;
      me.stompComboLeftMs = t.stomp.jumpWindowMs;   // 밟기 직후 강화 점프 창
      return i;
    }
  }
  return -1;
}

/** 머리 위 서기: 느리게 내려앉으면 고스트 머리를 바닥처럼 지지 */
export function headStand(me: Body, ghosts: Ghost[], t: Tuning = TUNING): void {
  if (me.vy < 0) return;
  for (const g of ghosts) {
    const hOv = Math.min(right(me), g.x + g.w / 2) - Math.max(left(me), g.x - g.w / 2);
    if (hOv <= me.w * 0.3) continue;
    const gTop = g.y - g.h;
    if (bottom(me) >= gTop && bottom(me) <= gTop + t.stomp.headBandPx) {
      me.y = gTop; me.vy = 0; me.grounded = true;
    }
  }
}

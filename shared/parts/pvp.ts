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

/** 밀기: 겹친 고스트에서 나만 soft push로 빠져나옴 (§14-4) */
export function pushSelfOut(me: Body, ghosts: Ghost[], t: Tuning = TUNING): void {
  for (const g of ghosts) {
    const o = overlap(me, g);
    if (!o) continue;
    if (o.oy <= t.stomp.headBandPx) continue; // 머리 밴드는 밟기/서기 몫
    const dir = me.x < g.x ? -1 : 1;
    me.x += dir * Math.min(o.ox, t.push.separatePerTick);
  }
}

/** 내가 밟혔는가 (당하는 쪽 판정): 고스트 발이 내 머리 밴드에 + 빠른 낙하 */
export function checkStompedMe(me: Avatar, ghosts: (Ghost & { vy: number })[], t: Tuning = TUNING): boolean {
  const b = me.body;
  for (const g of ghosts) {
    if (g.vy < t.stomp.minFallSpeed) continue;
    const hOv = Math.min(right(b), g.x + g.w / 2) - Math.max(left(b), g.x - g.w / 2);
    if (hOv <= b.w * 0.3) continue;
    if (g.y >= top(b) && g.y <= top(b) + t.stomp.headBandPx) {
      b.vy = b.vy < 0 ? t.stomp.downVelocity : b.vy + t.stomp.downVelocity;
      return true;
    }
  }
  return false;
}

/** 내가 밟았는가 (공격자 연출·튕김 즉시, §14-5). 밟은 고스트 index 반환, 없으면 -1.
 *  reachMult: 내려찍기 시 판정 확대 배율 (아바타 한정 — 지형·블록은 무관) */
export function checkIStomped(me: Avatar, ghosts: Ghost[], t: Tuning = TUNING, reachMult = 1): number {
  const b = me.body;
  if (b.vy < t.stomp.minFallSpeed) return -1;
  const band = t.stomp.headBandPx * reachMult;
  const minOv = b.w * 0.3 / reachMult;
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    const hOv = Math.min(right(b), g.x + g.w / 2) - Math.max(left(b), g.x - g.w / 2);
    if (hOv <= minOv) continue;
    const gTop = g.y - g.h;
    if (bottom(b) >= gTop && bottom(b) <= gTop + band) {
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

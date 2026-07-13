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

/** 밀기 (§14-4): 겹친 고스트에서 내 몸만 소프트 상한으로 빠져나옴. 밀기는 겹침 기반(상대 클라가 처리). */
export function pushSelfOut(me: Body, ghosts: Ghost[], t: Tuning = TUNING): void {
  for (const g of ghosts) {
    const o = overlap(me, g);
    if (!o) continue;
    if (o.oy <= t.stomp.headBandPx) continue; // 머리 밴드는 밟기/서기 몫
    const dir = me.x < g.x ? -1 : 1;
    me.x += dir * Math.min(o.ox, t.push.separatePerTick);
    // 중심 넘기 금지: 상대 중심 반대편에 머무름 (원본 느낌 유지, 반대편 관통 완화)
    if (dir < 0) me.x = Math.min(me.x, g.x);
    else me.x = Math.max(me.x, g.x);
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
export function checkIStomped(me: Avatar, ghosts: Ghost[], t: Tuning = TUNING, pounding = false, prevBottom = -Infinity): number {
  const b = me.body;
  if (b.vy < t.stomp.minFallSpeed) return -1;
  const band = t.stomp.headBandPx * (pounding ? t.stomp.poundReachMult : 1);   // 세로 밴드(기존)
  const hMult = pounding ? t.stomp.poundReachH : t.stomp.reachH;               // 가로 배율(신규 1.2/1.15)
  const minOv = b.w * 0.3 / hMult;
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

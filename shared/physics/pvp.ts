// 플레이어 간 상호작용 — 판정(밀기·밟기)은 서버 권위.
// 밀림·밟힘은 서버 상태 수신(보정)으로만 반영된다.
// 예외: headStand는 상대의 "현재 위치"만 필요하므로 클라 예측에서도 실행한다.

import type { PlayerPhys } from "./types.js";
import { TUNING, type Tuning } from "./tuning.js";

/** headStand 등에서 상대 정보로 필요한 최소 형태 (서버 PlayerPhys / 클라 스키마 겸용) */
export interface OtherPlayer {
  x: number;
  y: number;
  crouch?: boolean;
  slide?: boolean;
}

/** 상대의 실제 히트박스 상단 y (웅크리기·슬라이딩 = 축소) */
function topOf(o: OtherPlayer, t: Tuning): number {
  const shrunk = o.crouch || o.slide;
  return shrunk
    ? o.y + (t.world.playerH - t.crouch.heightTiles * t.world.tileSize)
    : o.y;
}

/** 좌우 겹침 밀어내기. 내려찍기 중인 쪽은 절대 밀리지 않음 */
export function resolvePush(players: PlayerPhys[], t: Tuning = TUNING): void {
  const W = t.world.playerW;
  const H = t.world.playerH;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const ox = Math.min(a.x + W, b.x + W) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + H, b.y + H) - Math.max(topOf(a, t), topOf(b, t));
      if (ox <= 0 || oy <= 0) continue;          // 안 겹침
      if (oy <= t.stomp.headBandPx) continue;    // 머리 근처 겹침은 밟기 판정 몫

      const push = Math.min(ox / 2, t.push.maxSeparatePerTick);
      const aLocked = a.pound !== 0;             // 내려찍기 = 불가침
      const bLocked = b.pound !== 0;
      const sign = a.x < b.x ? 1 : -1;
      if (aLocked && bLocked) continue;
      if (aLocked) b.x += sign * push * 2;
      else if (bLocked) a.x -= sign * push * 2;
      else { a.x -= sign * push; b.x += sign * push; }
    }
  }
}

export interface StompEvent { stomperIdx: number; victimIdx: number; }

/** 머리 밟기 판정. 밟은 쪽은 튕겨 오르고, 밟힌 쪽은 하강 디메리트 (player-spec) */
export function resolveStomps(players: PlayerPhys[], t: Tuning = TUNING): StompEvent[] {
  const W = t.world.playerW;
  const H = t.world.playerH;
  const events: StompEvent[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < players.length; j++) {
      if (i === j) continue;
      const a = players[i]; // 밟는 후보 (낙하 중)
      const b = players[j];
      // 일정 낙하속도 이상일 때만 "밟기". 느리게 내려앉으면 headStand가 지지
      if (a.vy < t.stomp.minFallSpeed) continue;
      const hOverlap = Math.min(a.x + W, b.x + W) - Math.max(a.x, b.x);
      if (hOverlap <= W * 0.3) continue;
      const bTop = topOf(b, t);
      const aBottom = a.y + H;
      if (aBottom < bTop || aBottom > bTop + t.stomp.headBandPx) continue;

      // 밟은 쪽: 위로 튕김 + 머리 위에 정렬
      a.vy = t.stomp.bounceVelocity;
      a.y = bTop - H;
      if (a.pound !== 0) a.pound = 0;
      // 밟힌 쪽: 상승 중이면 하강 고정, 하강 중이면 가산
      b.vy = b.vy < 0 ? t.stomp.downVelocity : b.vy + t.stomp.downVelocity;
      events.push({ stomperIdx: i, victimIdx: j });
    }
  }
  return events;
}

/**
 * 머리 위 서 있기 지지. 느리게(밟기 임계값 미만) 내려앉은 플레이어를
 * 상대 머리 위에 바닥처럼 고정한다.
 * 클라 예측에서도 호출 가능 — others는 서버 상태의 좌표·자세만 있으면 됨.
 */
export function headStand(
  a: PlayerPhys,
  others: OtherPlayer[],
  t: Tuning = TUNING,
): void {
  if (a.vy < 0 || a.pound !== 0) return; // 상승·내려찍기 중엔 지지 없음
  const W = t.world.playerW;
  const H = t.world.playerH;
  for (const b of others) {
    const hOverlap = Math.min(a.x + W, b.x + W) - Math.max(a.x, b.x);
    if (hOverlap <= W * 0.3) continue;
    const bTop = topOf(b, t);
    const aBottom = a.y + H;
    if (aBottom < bTop || aBottom > bTop + t.stomp.headBandPx) continue;
    a.y = bTop - H;
    a.vy = 0;
    a.grounded = true;
  }
}

/** 서버용: 전원에 대해 headStand 적용 */
export function resolveHeadStand(players: PlayerPhys[], t: Tuning = TUNING): void {
  for (let i = 0; i < players.length; i++) {
    headStand(players[i], players.filter((_, j) => j !== i), t);
  }
}

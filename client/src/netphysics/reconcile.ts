// 자기 상태 송신 (역할 축소 §14-6): 서버로 relay만, 보정 수신 없음.
import type { Room } from "@colyseus/sdk";
import type { Avatar } from "shared/parts";

export function sendAvatarState(room: Room, a: Avatar, tick: number, dead: boolean): void {
  const b = a.body;
  room.send("avatar", {
    x: b.x, y: b.y, vx: b.vx, vy: b.vy, w: b.w, h: b.h,
    facing: b.facing, pound: a.pound, crouch: a.crouch, slide: a.slide, grounded: b.grounded,
    touchingWall: b.touchingWall, dead, wallJumpSeq: a.wallJumpSeq,
    invincible: a.invincibleLeftMs > 0,
    frozen: a.freezeLeftMs > 0, sizeStage: a.sizeStage, hp: a.hp, tick,
  });
}

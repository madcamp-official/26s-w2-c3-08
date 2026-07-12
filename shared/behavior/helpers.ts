// 조건·행동 공용 헬퍼
import type { Body } from "../physics/body.js";

export function dist(a: Body, b: Body): number {
  return Math.hypot(a.x - b.x, (a.y - a.h / 2) - (b.y - b.h / 2));
}
export function distPreset(name: unknown, t: { detect: { nearPx: number; normalPx: number; farPx: number } }): number {
  if (name === "near") return t.detect.nearPx;
  if (name === "far") return t.detect.farPx;
  return t.detect.normalPx;
}
export function speedPreset(name: unknown, t: { projectile: { slowSpeed: number; normalSpeed: number; fastSpeed: number } }): number {
  if (name === "slow") return t.projectile.slowSpeed;
  if (name === "fast") return t.projectile.fastSpeed;
  return t.projectile.normalSpeed;
}

// EffectName(shared/effects) → 저크 프리미티브 조합. "겹쳐서" 고퀄로.
// 히어로(explosion·poofDeath)는 여러 겹 + 셰이크, 잔챙이(dust)는 가볍게.
import type Phaser from "phaser";
import type { EffectName } from "shared/effects";
import { FX_TEX } from "./textures.js";
import { flash, shockwaveRing, particleBurst, screenShake } from "./juice.js";

export function playEffect(scene: Phaser.Scene, name: EffectName, x: number, y: number): void {
  switch (name) {
    case "explosion":
      flash(scene, x, y, { color: 0xffe08a, scale: 3, duration: 260 });
      shockwaveRing(scene, x, y, { color: 0xffa030, scale: 3, duration: 340, width: 4 });
      particleBurst(scene, x, y, { count: 22, texture: FX_TEX.glow, speed: { min: 120, max: 360 }, scale: { start: 0.8, end: 0 }, lifespan: 420, tint: [0xffffff, 0xffe08a, 0xff8020], additive: true });
      particleBurst(scene, x, y, { count: 14, texture: FX_TEX.debris, speed: { min: 80, max: 280 }, scale: { start: 1, end: 0.2 }, lifespan: 600, tint: 0x552200, gravityY: 600 });
      particleBurst(scene, x, y, { count: 10, texture: FX_TEX.glow, speed: { min: 20, max: 80 }, scale: { start: 1.2, end: 0 }, lifespan: 700, tint: 0x333333 }); // 연기
      screenShake(scene, 180, 0.008);
      break;

    case "poofDeath":
      flash(scene, x, y, { color: 0xffffff, scale: 1.6, duration: 180 });
      particleBurst(scene, x, y, { count: 16, texture: FX_TEX.glow, speed: { min: 40, max: 140 }, scale: { start: 1, end: 0 }, lifespan: 500, tint: [0xffffff, 0xcccccc], additive: true });
      shockwaveRing(scene, x, y, { color: 0xffffff, scale: 1.6, duration: 260, width: 2 });
      break;

    case "hitFlash":
      flash(scene, x, y, { color: 0xffffff, scale: 1.4, duration: 140 });
      particleBurst(scene, x, y, { count: 8, texture: FX_TEX.spark, speed: { min: 100, max: 220 }, scale: { start: 0.8, end: 0 }, lifespan: 260, tint: 0xffffff, additive: true });
      break;

    case "dust":
      particleBurst(scene, x, y, { count: 8, texture: FX_TEX.glow, speed: { min: 30, max: 90 }, scale: { start: 0.5, end: 0 }, lifespan: 350, tint: 0xccb890, angle: { min: 200, max: 340 }, gravityY: 120 });
      break;

    case "stunStars":
      particleBurst(scene, x, y - 20, { count: 6, texture: FX_TEX.spark, speed: { min: 20, max: 60 }, scale: { start: 1, end: 0.4 }, lifespan: 600, tint: 0xffe040, angle: { min: 250, max: 290 }, gravityY: -30, additive: true });
      break;

    case "spawnSparkle":
      flash(scene, x, y, { color: 0x88ddff, scale: 1.4, duration: 220 });
      particleBurst(scene, x, y, { count: 14, texture: FX_TEX.spark, speed: { min: 60, max: 180 }, scale: { start: 0.9, end: 0 }, lifespan: 500, tint: [0x88ddff, 0xffffff], additive: true });
      break;

    case "pickupGlow":
      flash(scene, x, y, { color: 0xffe040, scale: 1.6, duration: 300 });
      particleBurst(scene, x, y, { count: 12, texture: FX_TEX.spark, speed: { min: 40, max: 120 }, scale: { start: 0.8, end: 0 }, lifespan: 500, tint: 0xffe040, angle: { min: 230, max: 310 }, gravityY: -60, additive: true });
      break;
  }
}

// 저크(juice) 프리미티브 — 이펙트를 "겹쳐서" 고퀄로 만드는 재사용 조각들.
// effects.ts가 이걸 조합한다. 전부 스스로 정리(트윈 완료/수명 후 destroy).
import Phaser from "phaser";
import { ensureFxTextures, FX_TEX } from "./textures.js";

const DEPTH = 9999;

/** 순간 발광 플래시 (additive) — 커지며 사라짐 */
export function flash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { color?: number; scale?: number; duration?: number } = {},
): void {
  ensureFxTextures(scene);
  const s = scene.add
    .image(x, y, FX_TEX.glow)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(opts.color ?? 0xffffff)
    .setScale(0.2)
    .setDepth(DEPTH);
  scene.tweens.add({
    targets: s,
    scale: opts.scale ?? 2,
    alpha: { from: 1, to: 0 },
    duration: opts.duration ?? 220,
    ease: "Cubic.Out",
    onComplete: () => s.destroy(),
  });
}

/** 충격파 링 — 빠르게 커지며 얇아짐(스케일+알파). 스트로크 원을 스케일. */
export function shockwaveRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { color?: number; scale?: number; duration?: number; width?: number } = {},
): void {
  const ring = scene.add
    .circle(x, y, 20, 0x000000, 0)
    .setStrokeStyle(opts.width ?? 3, opts.color ?? 0xffffff, 1)
    .setScale(0.1)
    .setDepth(DEPTH - 1);
  scene.tweens.add({
    targets: ring,
    scale: opts.scale ?? 2.2,
    alpha: { from: 0.9, to: 0 },
    duration: opts.duration ?? 300,
    ease: "Cubic.Out",
    onComplete: () => ring.destroy(),
  });
}

/** 파티클 폭발 버스트 (1회 explode 후 자동 정리) */
export function particleBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: {
    count?: number;
    texture?: string;
    speed?: number | { min: number; max: number };
    scale?: { start: number; end: number };
    lifespan?: number;
    tint?: number | number[];
    gravityY?: number;
    angle?: { min: number; max: number };
    additive?: boolean;
  } = {},
): void {
  ensureFxTextures(scene);
  const lifespan = opts.lifespan ?? 500;
  const emitter = scene.add.particles(x, y, opts.texture ?? FX_TEX.spark, {
    speed: opts.speed ?? { min: 60, max: 220 },
    scale: opts.scale ?? { start: 1, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan,
    tint: opts.tint,
    gravityY: opts.gravityY ?? 0,
    angle: opts.angle ?? { min: 0, max: 360 },
    blendMode: opts.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
    emitting: false,
  });
  emitter.setDepth(DEPTH);
  emitter.explode(opts.count ?? 16);
  scene.time.delayedCall(lifespan + 80, () => emitter.destroy());
}

/** 스크린 셰이크 (카메라) */
export function screenShake(scene: Phaser.Scene, duration = 120, intensity = 0.004): void {
  scene.cameras.main.shake(duration, intensity);
}

/** 위로 떠오르며 사라지는 텍스트 (콤보·데미지 표시 등) */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { color?: string; size?: number; rise?: number } = {},
): void {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: "sans-serif",
      fontSize: `${opts.size ?? 16}px`,
      color: opts.color ?? "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH + 1);
  scene.tweens.add({
    targets: t,
    y: y - (opts.rise ?? 30),
    alpha: { from: 1, to: 0 },
    duration: 700,
    ease: "Cubic.Out",
    onComplete: () => t.destroy(),
  });
}

/** 스쿼시&스트레치 1회 (착지·타격 임팩트) — 대상의 scaleX/scaleY를 순간 변형 후 복귀 */
export function squashPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform,
  opts: { amount?: number; duration?: number } = {},
): void {
  const a = opts.amount ?? 0.2;
  scene.tweens.add({
    targets: target,
    scaleX: 1 + a,
    scaleY: 1 - a,
    duration: (opts.duration ?? 240) / 2,
    yoyo: true,
    ease: "Sine.InOut",
  });
}

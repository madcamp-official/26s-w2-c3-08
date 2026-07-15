// SoundName(shared/effects) → 합성 파라미터 프리셋 + playSound(name).
// 값은 레트로 SFX 시작점 — 라이브로 튜닝 가능. 원본 창작(저작권 프리).
import type { SoundName } from "shared/effects";
import { playSfx, type Sfx } from "./zzfx.js";
import { computeSpatial } from "./listener.js";

const PRESETS: Record<SoundName, Sfx> = {
  jump:       { freq: 320, shape: 3, attack: 0.005, decay: 0.02, release: 0.12, slide: 900, volume: 0.3 },
  land:       { freq: 120, shape: 0, attack: 0.001, decay: 0.03, release: 0.06, slide: -200, noiseMix: 0.3, volume: 0.35 },
  stomp:      { freq: 180, shape: 3, attack: 0.001, decay: 0.02, release: 0.1, slide: -400, noiseMix: 0.2, volume: 0.4 },
  hurt:       { freq: 400, shape: 2, attack: 0.005, decay: 0.05, release: 0.15, slide: -500, volume: 0.35 },
  die:        { freq: 500, shape: 3, attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3, slide: -600, vibrato: 20, vibratoRate: 8, volume: 0.35 },
  pickup:     { freq: 600, shape: 3, attack: 0.005, decay: 0.03, release: 0.1, slide: 1200, volume: 0.3 },
  switch:     { freq: 800, shape: 3, attack: 0.001, decay: 0.01, release: 0.03, volume: 0.3 },
  break:      { freq: 200, shape: 4, attack: 0.001, decay: 0.05, release: 0.1, noiseMix: 1, volume: 0.35 },
  shoot:      { freq: 900, shape: 2, attack: 0.001, decay: 0.03, release: 0.08, slide: -1200, volume: 0.3 },
  hop:        { freq: 400, shape: 3, attack: 0.003, decay: 0.02, release: 0.08, slide: 500, volume: 0.25 },
  charge:     { freq: 200, shape: 2, attack: 0.05, decay: 0.1, sustain: 0.1, release: 0.1, slide: 400, volume: 0.25 },
  teleport:   { freq: 600, shape: 0, attack: 0.01, decay: 0.1, release: 0.2, slide: -300, vibrato: 60, vibratoRate: 20, volume: 0.3 },
  emerge:     { freq: 150, shape: 0, attack: 0.02, decay: 0.1, release: 0.1, slide: 400, volume: 0.3 },
  enrage:     { freq: 250, shape: 2, attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.15, slide: 200, vibrato: 30, vibratoRate: 12, volume: 0.35 },
  stun:       { freq: 500, shape: 0, attack: 0.01, decay: 0.2, release: 0.2, slide: -100, vibrato: 80, vibratoRate: 14, volume: 0.3 },
  shell:      { freq: 700, shape: 3, attack: 0.001, decay: 0.02, release: 0.06, slide: -200, noiseMix: 0.4, volume: 0.3 },
  revive:     { freq: 400, shape: 3, attack: 0.01, decay: 0.05, sustain: 0.05, release: 0.15, slide: 800, volume: 0.3 },
  bump:       { freq: 160, shape: 3, attack: 0.001, decay: 0.02, release: 0.05, slide: -100, volume: 0.3 },
  boing:      { freq: 300, shape: 0, attack: 0.002, decay: 0.05, release: 0.15, slide: 600, vibrato: 120, vibratoRate: 18, volume: 0.35 },
  slam_start: { freq: 300, shape: 2, attack: 0.02, decay: 0.08, release: 0.05, slide: -200, volume: 0.3 },
  slam_hit:   { freq: 120, shape: 4, attack: 0.001, decay: 0.04, release: 0.12, slide: -100, noiseMix: 0.7, volume: 0.4 },
  throw:      { freq: 500, shape: 2, attack: 0.001, decay: 0.02, release: 0.06, slide: -400, volume: 0.28 },
  aggro:      { freq: 180, shape: 2, attack: 0.01, decay: 0.08, sustain: 0.05, release: 0.15, slide: 60, vibrato: 25, vibratoRate: 10, volume: 0.3 },
  flap:       { freq: 350, shape: 1, attack: 0.005, decay: 0.04, release: 0.08, slide: -150, noiseMix: 0.15, volume: 0.22 },
  crawl:      { freq: 150, shape: 4, attack: 0.01, decay: 0.06, release: 0.08, noiseMix: 0.6, volume: 0.18 },
  wallKick:   { freq: 260, shape: 3, attack: 0.002, decay: 0.03, release: 0.1, slide: 700, noiseMix: 0.2, volume: 0.3 },
  wallGrab:   { freq: 220, shape: 4, attack: 0.001, decay: 0.04, release: 0.06, noiseMix: 0.8, volume: 0.2 },
  slide:      { freq: 180, shape: 4, attack: 0.01, decay: 0.08, release: 0.15, slide: -60, noiseMix: 0.7, volume: 0.22 },
  powerUp:    { freq: 400, shape: 3, attack: 0.01, decay: 0.06, sustain: 0.08, sustainLevel: 0.6, release: 0.2, slide: 500, volume: 0.32 },
};

/**
 * 이름으로 SFX 재생. 미등록 이름은 조용히 무시.
 * @param pos 소리가 나는 월드 좌표 — 주면 리스너(로컬 플레이어) 거리로 감쇠·좌우 팬 적용.
 *   생략하면 항상 풀 볼륨·정면(콘솔 오디션, 리스너 미설정 상태 등).
 */
export function playSound(name: SoundName, pos?: { x: number; y: number }): void {
  const p = PRESETS[name];
  if (!p) return;
  if (!pos) { playSfx(p); return; }
  const { volumeMult, pan } = computeSpatial(pos.x, pos.y);
  if (volumeMult <= 0) return;
  playSfx(p, { volumeMult, pan });
}

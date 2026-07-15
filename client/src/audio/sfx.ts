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
  // ── 레이스 진행 (2026-07-15) ──
  fall:       { freq: 700, shape: 1, attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.25, slide: -900, vibrato: 15, vibratoRate: 10, volume: 0.32 },
  respawn:    { freq: 300, shape: 0, attack: 0.02, decay: 0.08, sustain: 0.05, release: 0.2, slide: 700, volume: 0.3 },
  sweepWarn:  { freq: 440, shape: 3, attack: 0.005, decay: 0.05, sustain: 0.15, sustainLevel: 0.7, release: 0.1, vibrato: 40, vibratoRate: 16, volume: 0.3 },
  sweepHit:   { freq: 90, shape: 4, attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.4, slide: -40, noiseMix: 0.85, volume: 0.45 },
  whistle:    { freq: 1400, shape: 0, attack: 0.01, decay: 0.05, sustain: 0.35, sustainLevel: 0.8, release: 0.15, vibrato: 30, vibratoRate: 14, volume: 0.28 },
  // ── 에디터 ──
  place:      { freq: 500, shape: 3, attack: 0.002, decay: 0.03, release: 0.06, slide: -150, volume: 0.26 },
  erase:      { freq: 350, shape: 4, attack: 0.002, decay: 0.05, release: 0.08, slide: -200, noiseMix: 0.5, volume: 0.24 },
  pick:       { freq: 600, shape: 3, attack: 0.002, decay: 0.02, release: 0.04, slide: 250, volume: 0.22 },
  flip:       { freq: 450, shape: 1, attack: 0.003, decay: 0.03, release: 0.06, slide: 500, volume: 0.24 },
  denied:     { freq: 180, shape: 3, attack: 0.003, decay: 0.06, sustain: 0.05, release: 0.08, slide: -30, volume: 0.3 },
  favAdd:     { freq: 700, shape: 3, attack: 0.003, decay: 0.03, release: 0.08, slide: 600, volume: 0.24 },
  favRemove:  { freq: 550, shape: 3, attack: 0.003, decay: 0.03, release: 0.08, slide: -350, volume: 0.22 },
  timeWarn:   { freq: 880, shape: 3, attack: 0.002, decay: 0.04, release: 0.05, volume: 0.28 },
  // ── UI 공통 ──
  uiHover:    { freq: 900, shape: 1, attack: 0.002, decay: 0.02, release: 0.03, slide: 150, volume: 0.12 },
  uiClick:    { freq: 650, shape: 3, attack: 0.002, decay: 0.025, release: 0.05, slide: 200, volume: 0.22 },
  uiBack:     { freq: 500, shape: 3, attack: 0.002, decay: 0.03, release: 0.05, slide: -250, volume: 0.2 },
  modalOpen:  { freq: 400, shape: 1, attack: 0.005, decay: 0.05, release: 0.1, slide: 450, volume: 0.22 },
  modalClose: { freq: 550, shape: 1, attack: 0.005, decay: 0.05, release: 0.08, slide: -350, volume: 0.2 },
  toast:      { freq: 750, shape: 0, attack: 0.005, decay: 0.04, release: 0.12, slide: 300, volume: 0.22 },
  playerJoin: { freq: 480, shape: 1, attack: 0.005, decay: 0.04, sustain: 0.03, release: 0.1, slide: 350, volume: 0.24 },
  playerLeave:{ freq: 520, shape: 1, attack: 0.005, decay: 0.04, sustain: 0.03, release: 0.1, slide: -300, volume: 0.22 },
  assetReady: { freq: 620, shape: 3, attack: 0.005, decay: 0.05, sustain: 0.06, sustainLevel: 0.6, release: 0.15, slide: 500, volume: 0.28 },
  assetFail:  { freq: 300, shape: 2, attack: 0.005, decay: 0.08, sustain: 0.06, release: 0.15, slide: -180, volume: 0.26 },
  // ── 월드 옵션 (배선은 emit 통로 작업 후) ──
  iceSkid:    { freq: 1100, shape: 4, attack: 0.005, decay: 0.1, release: 0.15, slide: -400, noiseMix: 0.85, volume: 0.2 },
  dashPad:    { freq: 350, shape: 2, attack: 0.002, decay: 0.05, release: 0.12, slide: 1400, volume: 0.3 },
  crumble:    { freq: 140, shape: 4, attack: 0.01, decay: 0.12, sustain: 0.08, release: 0.15, noiseMix: 0.7, vibrato: 20, vibratoRate: 22, volume: 0.26 },
  sizeDown:   { freq: 550, shape: 3, attack: 0.005, decay: 0.06, sustain: 0.05, sustainLevel: 0.6, release: 0.15, slide: -450, volume: 0.28 },
  score:      { freq: 850, shape: 3, attack: 0.002, decay: 0.03, release: 0.08, slide: 400, volume: 0.24 },
  // ── 잡기·던지기 ──
  grab:           { freq: 380, shape: 1, attack: 0.003, decay: 0.03, sustain: 0.02, release: 0.06, slide: 150, noiseMix: 0.15, volume: 0.24 },
  grabDenied:     { freq: 200, shape: 3, attack: 0.003, decay: 0.04, release: 0.06, slide: -60, volume: 0.22 },
  projectileHit:  { freq: 160, shape: 4, attack: 0.001, decay: 0.03, release: 0.08, slide: -80, noiseMix: 0.6, volume: 0.28 },
  objectRespawn:  { freq: 500, shape: 0, attack: 0.02, decay: 0.06, sustain: 0.04, release: 0.15, slide: 350, volume: 0.24 },
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

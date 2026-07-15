// 초소형 절차적 SFX 신스 (Web Audio) — 오디오 파일 0. zzfx(Frank Force, MIT) 방식의 파라미터 사운드를
// 샘플 단위로 합성한다. 원본 마리오 사운드 대신 "레트로 느낌"의 원본 창작 SFX(저작권 프리).
//
// 브라우저는 사용자 제스처 전엔 오디오를 막으므로, 첫 클릭/키에서 unlockAudio()를 한 번 호출할 것.
import { effectiveVolume } from "./settings.js";

export const SR = 44100;

let ctx: AudioContext | null = null;
/** 공용 AudioContext — SFX·BGM이 같은 컨텍스트를 써야 unlock·시계가 일치한다 */
export function audioContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}
const audio = audioContext;
/** 첫 사용자 제스처에서 호출 — 자동재생 정책 해제 */
export function unlockAudio(): void {
  const c = audio();
  if (c.state === "suspended") void c.resume();
}

/** 파형: 0 사인 · 1 삼각 · 2 톱니 · 3 사각 · 4 노이즈 */
export type Shape = 0 | 1 | 2 | 3 | 4;

export interface Sfx {
  volume?: number;        // 0~1
  freq?: number;          // 시작 주파수(Hz)
  shape?: Shape;
  attack?: number;        // 초
  decay?: number;
  sustain?: number;       // 서스테인 유지 시간(초)
  sustainLevel?: number;  // 0~1
  release?: number;
  slide?: number;         // 피치 슬라이드(Hz/초, 선형)
  vibrato?: number;       // 비브라토 깊이(Hz)
  vibratoRate?: number;   // 비브라토 속도(Hz)
  noiseMix?: number;      // 0~1 (파형에 노이즈 섞기)
}

function osc(shape: Shape, phase: number): number {
  const x = phase - Math.floor(phase); // 0~1
  switch (shape) {
    case 0: return Math.sin(2 * Math.PI * x);
    case 1: return 4 * Math.abs(x - 0.5) - 1; // 삼각
    case 2: return 2 * x - 1;                 // 톱니
    case 3: return x < 0.5 ? 1 : -1;          // 사각
    default: return Math.random() * 2 - 1;    // 노이즈
  }
}

/** 파라미터 → 오디오 버퍼 합성 (짧은 SFX라 매 재생 새로 만들어도 저렴 = 노이즈 매번 신선) */
export function synth(p: Sfx): AudioBuffer {
  const volume = p.volume ?? 0.3;
  const freq = p.freq ?? 440;
  const shape = p.shape ?? 0;
  const attack = p.attack ?? 0.01;
  const decay = p.decay ?? 0.05;
  const sustain = p.sustain ?? 0;
  const sustainLevel = p.sustainLevel ?? 0.4;
  const release = p.release ?? 0.08;
  const slide = p.slide ?? 0;
  const vibrato = p.vibrato ?? 0;
  const vibratoRate = p.vibratoRate ?? 0;
  const noiseMix = p.noiseMix ?? 0;

  const total = attack + decay + sustain + release;
  const n = Math.max(1, Math.floor(total * SR));
  const buf = audio().createBuffer(1, n, SR);
  const d = buf.getChannelData(0);

  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // ADSR (선형)
    let env: number;
    if (t < attack) env = t / attack;
    else if (t < attack + decay) env = 1 - (1 - sustainLevel) * ((t - attack) / decay);
    else if (t < attack + decay + sustain) env = sustainLevel;
    else env = sustainLevel * (1 - (t - attack - decay - sustain) / release);
    if (env < 0) env = 0;

    const vib = vibrato ? Math.sin(2 * Math.PI * vibratoRate * t) * vibrato : 0;
    const curF = Math.max(1, freq + slide * t + vib);
    phase += curF / SR;

    let s = osc(shape, phase);
    if (noiseMix) s = s * (1 - noiseMix) + (Math.random() * 2 - 1) * noiseMix;
    d[i] = s * env * volume;
  }
  return buf;
}

export interface PlaybackOpts {
  /** 거리감쇠 등 추가 배율(0~1). settings.ts의 sfxVolume/뮤트와 곱해짐 */
  volumeMult?: number;
  /** 스테레오 팬 -1(좌)~1(우) */
  pan?: number;
}

/** 버퍼 즉시 재생 — 재생 순간 설정(볼륨/뮤트)을 반영(settings.ts). 뮤트거나 거리감쇠로 0이면 재생 생략. */
export function playBuffer(buf: AudioBuffer, opts: PlaybackOpts = {}): void {
  const vol = effectiveVolume() * (opts.volumeMult ?? 1);
  if (vol <= 0) return;
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = vol;
  if (opts.pan) {
    const panner = c.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
    src.connect(gain).connect(panner).connect(c.destination);
  } else {
    src.connect(gain).connect(c.destination);
  }
  src.start();
}

/** 파라미터로 바로 재생 */
export function playSfx(p: Sfx, opts?: PlaybackOpts): void {
  playBuffer(synth(p), opts);
}

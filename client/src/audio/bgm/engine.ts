// BGM 엔진 — 노트 시퀀스를 AudioBuffer로 렌더(캐시)하고 15초 격자에서 샘플 정확 스케줄링.
// 오디오 파일 0 원칙(zzfx와 동일): 곡 = TS 데이터, 소리 = 코드 합성.
//
// 시간 격자(설계 확정 2026-07-15):
//  - 루프 곡(grid=true)의 모든 세그먼트는 정확히 15초의 배수 — 렌더 시 검증(어기면 throw).
//  - 곡 전환(queueBgm)은 항상 "현재 세그먼트 끝"에서 일어난다. 게임시간이 30초 배수이므로
//    라스트댄스 진입 등 모든 전환점이 세그먼트 경계와 정확히 일치한다.
//  - 루프 이음새: 노트 릴리즈 꼬리를 버퍼 끝에서 앞으로 되감아(wrap) 기록 — 끝↔시작이 이어짐.
import { SR, audioContext } from "../zzfx.js";
import { effectiveBgmVolume, onAudioSettingsChange } from "../settings.js";
import type { NoteEvent } from "./theory.js";

/** 15초 격자 (레이스 15s 세그먼트 / 30s 루프·라스트댄스의 공약수) */
export const GRID_SEC = 15;

/** 악기: zzfx Shape(0~4) 또는 퍼커션 이름 */
export type Instrument = 0 | 1 | 2 | 3 | 4 | "kick" | "snare" | "hat";

export interface Track {
  inst: Instrument;
  vol: number;              // 0~1 (믹스 배율)
  notes: NoteEvent[];
  attack?: number;          // 초 (기본 0.008)
  release?: number;         // 초 (기본: 음길이의 30%, 최대 0.12)
  sustainLevel?: number;    // 0~1 (기본 0.7)
  vibrato?: number;         // Hz 깊이
  vibratoRate?: number;
}

export interface Segment {
  bpm: number;
  beats: number;            // 총 박 수 → 길이(초) = beats * 60/bpm
  tracks: Track[];
}

export interface Song {
  name: string;
  /** true = 세그먼트 길이 15초 배수 강제 + 릴리즈 랩어라운드(루프 이음새) */
  grid: boolean;
  /** 1회 재생 후 segments로 진입 (result 팡파레 등) */
  intro?: Segment;
  /** 순환 세그먼트들. 여러 개면 변주 체인(A→A′→A″→A…) */
  segments: Segment[];
  /** false = 원샷: segments를 한 바퀴만 재생하고 정지 (lastdance) */
  loop: boolean;
}

export function segmentSec(seg: Segment): number {
  return (seg.beats * 60) / seg.bpm;
}

// ── 렌더 ─────────────────────────────────────────────────────────────────
function oscSample(inst: 0 | 1 | 2 | 3 | 4, phase: number): number {
  const x = phase - Math.floor(phase);
  switch (inst) {
    case 0: return Math.sin(2 * Math.PI * x);
    case 1: return 4 * Math.abs(x - 0.5) - 1;
    case 2: return 2 * x - 1;
    case 3: return x < 0.5 ? 1 : -1;
    default: return Math.random() * 2 - 1;
  }
}

/** 퍼커션 1타 렌더 파라미터 (짧은 원샷 — 노트 f/d 무시하고 자체 길이) */
const PERC: Record<"kick" | "snare" | "hat", { lenSec: number; render: (t: number, ph: { p: number }) => number }> = {
  kick: {
    lenSec: 0.11,
    render: (t, ph) => {
      const f = 150 - 950 * t;               // 150→~45Hz 급강하
      ph.p += Math.max(35, f) / SR;
      return Math.sin(2 * Math.PI * ph.p) * (1 - t / 0.11);
    },
  },
  snare: {
    lenSec: 0.09,
    render: (t, ph) => {
      ph.p += 190 / SR;
      const tone = (4 * Math.abs(ph.p - Math.floor(ph.p) - 0.5) - 1) * 0.4;
      const noise = (Math.random() * 2 - 1) * 0.8;
      return (tone + noise) * (1 - t / 0.09);
    },
  },
  hat: {
    lenSec: 0.035,
    render: (t) => {
      // 필터 없이 밝은 느낌: 노이즈를 이전 샘플과 차분(고역 강조 근사)
      const n = Math.random() * 2 - 1;
      return n * (1 - t / 0.035);
    },
  },
};

/**
 * 세그먼트 → 모노 AudioBuffer.
 * wrap=true(그리드 루프 곡)면 버퍼 끝을 넘는 릴리즈 꼬리를 앞으로 되감아 이음새를 없앤다.
 */
function renderSegment(seg: Segment, wrap: boolean): AudioBuffer {
  const spb = 60 / seg.bpm;
  const durSec = seg.beats * spb;
  const n = Math.round(durSec * SR);
  const data = new Float32Array(n);

  for (const tr of seg.tracks) {
    const attack = tr.attack ?? 0.008;
    const susLevel = tr.sustainLevel ?? 0.7;

    for (const note of tr.notes) {
      const v = tr.vol * (note.v ?? 1);
      const start = Math.round(note.t * spb * SR);

      if (tr.inst === "kick" || tr.inst === "snare" || tr.inst === "hat") {
        const perc = PERC[tr.inst];
        const len = Math.round(perc.lenSec * SR);
        const ph = { p: 0 };
        for (let i = 0; i < len; i++) {
          const idx = wrap ? (start + i) % n : start + i;
          if (idx >= n) break;
          data[idx] += perc.render(i / SR, ph) * v;
        }
        continue;
      }

      const noteSec = note.d * spb;
      const release = tr.release ?? Math.min(0.12, noteSec * 0.3);
      const len = Math.round((noteSec + release) * SR);
      let phase = 0;
      for (let i = 0; i < len; i++) {
        const idx = wrap ? (start + i) % n : start + i;
        if (!wrap && idx >= n) break;
        const t = i / SR;
        // 엔벨로프: attack → 0.06s에 걸쳐 sustain으로 감쇠 → 노트 끝에서 release
        let env: number;
        if (t < attack) env = t / attack;
        else if (t < noteSec) {
          const decayT = Math.min(1, (t - attack) / 0.06);
          env = 1 - (1 - susLevel) * decayT;
        } else env = susLevel * (1 - (t - noteSec) / release);
        if (env <= 0) continue;

        const vib = tr.vibrato ? Math.sin(2 * Math.PI * (tr.vibratoRate ?? 6) * t) * tr.vibrato : 0;
        phase += (note.f + vib) / SR;
        data[idx] += oscSample(tr.inst, phase) * env * v;
      }
    }
  }

  // 소프트 리미터 — 트랙 합산 피크를 부드럽게 눌러 클리핑 방지
  for (let i = 0; i < n; i++) data[i] = Math.tanh(data[i]);

  const buf = audioContext().createBuffer(1, n, SR);
  buf.getChannelData(0).set(data);
  return buf;
}

function assertGrid(song: Song, seg: Segment): void {
  const sec = segmentSec(seg);
  if (Math.abs(sec / GRID_SEC - Math.round(sec / GRID_SEC)) > 1e-9 || sec < GRID_SEC - 1e-9) {
    throw new Error(`[bgm] '${song.name}' 세그먼트 길이 ${sec.toFixed(3)}s — ${GRID_SEC}초 배수가 아님 (bpm=${seg.bpm}, beats=${seg.beats})`);
  }
}

// ── 재생 스케줄러 ─────────────────────────────────────────────────────────
interface Rendered { buffers: AudioBuffer[]; intro: AudioBuffer | null }
const renderCache = new Map<string, Rendered>();

function rendered(song: Song): Rendered {
  let r = renderCache.get(song.name);
  if (r) return r;
  if (song.grid) for (const s of song.segments) assertGrid(song, s);
  r = {
    buffers: song.segments.map((s) => renderSegment(s, song.grid && song.loop)),
    intro: song.intro ? renderSegment(song.intro, false) : null,
  };
  renderCache.set(song.name, r);
  return r;
}

interface Scheduled { src: AudioBufferSourceNode; startAt: number; endAt: number }

let bgmGain: GainNode | null = null;
function gain(): GainNode {
  if (!bgmGain) {
    const c = audioContext();
    bgmGain = c.createGain();
    bgmGain.gain.value = effectiveBgmVolume();
    bgmGain.connect(c.destination);
    onAudioSettingsChange(() => {
      if (bgmGain) bgmGain.gain.setTargetAtTime(effectiveBgmVolume(), audioContext().currentTime, 0.05);
    });
  }
  return bgmGain;
}

let currentSong: Song | null = null;
let queuedSong: Song | null = null;
let segCursor = 0;                 // 다음에 스케줄할 세그먼트 인덱스
let scheduled: Scheduled[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

const LOOKAHEAD_SEC = 1.5;         // 다음 세그먼트를 이만큼 앞서 예약

function scheduleBuffer(buf: AudioBuffer, at: number): Scheduled {
  const c = audioContext();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(gain());
  src.start(at);
  const s: Scheduled = { src, startAt: at, endAt: at + buf.duration };
  scheduled.push(s);
  return s;
}

function pump(): void {
  if (!currentSong) return;
  const c = audioContext();
  const now = c.currentTime;
  scheduled = scheduled.filter((s) => s.endAt > now - 0.1);

  const last = scheduled[scheduled.length - 1];
  if (!last) { stopBgm(0); return; }             // 원샷 종료 후 정리
  if (last.endAt - now > LOOKAHEAD_SEC) return;  // 아직 여유

  // 경계 도달 임박 — 예약된 전환이 있으면 그 곡으로, 아니면 현재 곡 진행
  if (queuedSong) {
    const next = queuedSong;
    queuedSong = null;
    startSongAt(next, last.endAt);
    return;
  }
  const r = rendered(currentSong);
  if (segCursor >= r.buffers.length) {
    if (!currentSong.loop) {                     // 원샷(lastdance): 한 바퀴로 끝
      if (scheduled.length === 0) stopBgm(0);
      return;
    }
    segCursor = 0;
  }
  scheduleBuffer(r.buffers[segCursor], last.endAt);
  segCursor += 1;
}

function startSongAt(song: Song, at: number): void {
  currentSong = song;
  segCursor = 0;
  const r = rendered(song);
  if (r.intro) scheduleBuffer(r.intro, at);
  else { scheduleBuffer(r.buffers[0], at); segCursor = 1; }
  if (!timer) timer = setInterval(pump, 250);
}

/** 즉시 재생 (재생 중이면 짧은 페이드 후 교체) */
export function playBgm(song: Song): void {
  const c = audioContext();
  if (c.state === "suspended") void c.resume();
  cancelAll();
  gain().gain.setValueAtTime(effectiveBgmVolume(), c.currentTime);
  startSongAt(song, c.currentTime + 0.03);
}

/**
 * 다음 세그먼트 경계에서 곡 전환 — 레이스→hurry→라스트댄스가 박자 이음새 없이 이어진다.
 * 재생 중이 아니면 즉시 재생.
 */
export function queueBgm(song: Song): void {
  if (!currentSong || scheduled.length === 0) { playBgm(song); return; }
  queuedSong = song;
  // 경계 너머로 이미 예약된 세그먼트가 있으면 취소 (마지막 하나만 남김 = 현재/직후 재생분)
  const now = audioContext().currentTime;
  const playing = scheduled.filter((s) => s.startAt <= now + LOOKAHEAD_SEC);
  const future = scheduled.filter((s) => s.startAt > now + LOOKAHEAD_SEC);
  for (const f of future) { try { f.src.stop(); } catch { /* 이미 정지 */ } }
  scheduled = playing;
}

function cancelAll(): void {
  for (const s of scheduled) { try { s.src.stop(); } catch { /* 이미 정지 */ } }
  scheduled = [];
  queuedSong = null;
  currentSong = null;
  segCursor = 0;
  if (timer) { clearInterval(timer); timer = null; }
}

/** 정지 (기본 0.4초 페이드아웃) */
export function stopBgm(fadeSec = 0.4): void {
  const c = audioContext();
  const g = gain();
  if (fadeSec > 0 && scheduled.length > 0) {
    g.gain.setValueAtTime(g.gain.value, c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + fadeSec);
    const toStop = scheduled;
    setTimeout(() => { for (const s of toStop) { try { s.src.stop(); } catch { /* */ } } }, fadeSec * 1000 + 50);
    scheduled = [];
    queuedSong = null;
    currentSong = null;
    segCursor = 0;
    if (timer) { clearInterval(timer); timer = null; }
  } else {
    cancelAll();
  }
}

/** 재생 중인 곡 이름 (콘솔 조회용) */
export function currentBgmName(): string | null {
  return currentSong?.name ?? null;
}

/** 징글(원샷 멜로디) 렌더+재생 — BGM 볼륨 계열로 재생 */
export function playJingleSegment(name: string, seg: Segment): void {
  const c = audioContext();
  if (c.state === "suspended") void c.resume();
  let r = renderCache.get(`jingle:${name}`);
  if (!r) {
    r = { buffers: [renderSegment(seg, false)], intro: null };
    renderCache.set(`jingle:${name}`, r);
  }
  const src = c.createBufferSource();
  src.buffer = r.buffers[0];
  src.connect(gain());
  src.start();
}

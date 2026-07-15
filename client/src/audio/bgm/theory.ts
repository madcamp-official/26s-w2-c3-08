// 음이름→주파수 + 곡 데이터 조립 헬퍼 (순수 함수, Web Audio 무의존).
// 곡은 "박(beat) 단위 노트 이벤트"의 배열 — 렌더는 engine.ts가 담당.
//
// 시간 격자 규칙(설계 확정): 루프 곡은 전부 15초의 배수 길이.
// BPM은 15초가 정수 박이 되는 값만 사용 — 128(15s=32박), 96(15s=24박), 160(15s=40박).

/** 노트 이벤트 — t/d는 박(beat) 단위 */
export interface NoteEvent {
  t: number;        // 시작 박
  d: number;        // 길이 (박)
  f: number;        // 주파수 Hz (퍼커션 트랙에선 무시)
  v?: number;       // 개별 볼륨 배율 (트랙 vol에 곱)
}

/** A4 = 440Hz 기준 평균율 */
export function nf(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`잘못된 음이름: ${name}`);
  const base: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  let semi = base[m[1].toLowerCase()];
  if (m[2] === "#") semi += 1;
  else if (m[2] === "b") semi -= 1;
  const midi = semi + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 주파수를 반음 단위로 이조 (+12 = 한 옥타브 위) */
export function tr(freq: number, semitones: number): number {
  return freq * Math.pow(2, semitones / 12);
}

/** NoteEvent 배열 전체 이조 — 변주(키 올림) 생성용 */
export function transpose(notes: NoteEvent[], semitones: number): NoteEvent[] {
  return notes.map((n) => ({ ...n, f: tr(n.f, semitones) }));
}

/** NoteEvent 배열을 박 오프셋만큼 뒤로 밀기 */
export function shift(notes: NoteEvent[], beats: number): NoteEvent[] {
  return notes.map((n) => ({ ...n, t: n.t + beats }));
}

/** 여러 패턴 병합 */
export function merge(...groups: NoteEvent[][]): NoteEvent[] {
  return groups.flat();
}

/**
 * 간이 시퀀스 표기: [시작박, 길이, "음이름"|주파수, 볼륨?][] → NoteEvent[].
 * 예: seq([0, 1, "A2"], [1, 0.5, "C3", 0.8])
 */
export function seq(...rows: [number, number, string | number, number?][]): NoteEvent[] {
  return rows.map(([t, d, note, v]) => ({ t, d, f: typeof note === "number" ? note : nf(note), ...(v !== undefined ? { v } : {}) }));
}

/**
 * 반복 패턴: 한 단위(unitBeats)짜리 패턴을 times회 이어붙임.
 * 베이스 라인·드럼 루프 등 "같은 리듬을 코드만 바꿔" 만들 때는 chordCycle과 조합.
 */
export function repeat(pattern: NoteEvent[], unitBeats: number, times: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let i = 0; i < times; i++) out.push(...shift(pattern, unitBeats * i));
  return out;
}

/**
 * 코드 진행 헬퍼: roots 순회하며 각 코드 구간(barBeats)마다 make(rootFreq, 구간시작박)를 호출해 병합.
 * 예: chordCycle(["A2","F2","C3","G2"], 8, (r, at) => bass8th(r, at))
 */
export function chordCycle(
  roots: (string | number)[],
  beatsPerChord: number,
  make: (rootFreq: number, atBeat: number, index: number) => NoteEvent[],
): NoteEvent[] {
  const out: NoteEvent[] = [];
  roots.forEach((root, i) => {
    out.push(...make(typeof root === "number" ? root : nf(root), i * beatsPerChord, i));
  });
  return out;
}

/** 아르페지오: 주어진 음들을 step 박 간격으로 count개 순환 배치 */
export function arp(
  notes: (string | number)[],
  atBeat: number,
  count: number,
  step: number,
  dur: number,
  v?: number,
): NoteEvent[] {
  const freqs = notes.map((n) => (typeof n === "number" ? n : nf(n)));
  const out: NoteEvent[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ t: atBeat + i * step, d: dur, f: freqs[i % freqs.length], ...(v !== undefined ? { v } : {}) });
  }
  return out;
}

// ── 드럼 패턴 (퍼커션 트랙은 f를 안 쓰므로 0) ─────────────────────────────
const hit = (t: number, d = 0.1, v?: number): NoteEvent => ({ t, d, f: 0, ...(v !== undefined ? { v } : {}) });

/** 4비트 킥 (매 박) */
export function fourOnFloor(totalBeats: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let b = 0; b < totalBeats; b++) out.push(hit(b));
  return out;
}

/** 백비트 스네어 (2·4박) */
export function backbeat(totalBeats: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let b = 1; b < totalBeats; b += 2) out.push(hit(b));
  return out;
}

/** 오프비트 해트 (엇박 8분) */
export function offbeatHats(totalBeats: number, v = 1): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let b = 0; b < totalBeats; b++) out.push(hit(b + 0.5, 0.05, v));
  return out;
}

/** 16분 해트 (밀도 업 — hurry/피크용) */
export function sixteenthHats(totalBeats: number, v = 0.7): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let b = 0; b < totalBeats * 4; b++) out.push(hit(b / 4, 0.03, b % 4 === 0 ? v : v * 0.6));
  return out;
}

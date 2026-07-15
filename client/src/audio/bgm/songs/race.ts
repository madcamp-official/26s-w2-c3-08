// 레이스 BGM — 변주 체인 (A → A′ → A″ → A …), 세그먼트당 정확 15초.
// BPM 128 → 15초 = 32박(8마디). 코드 진행 Am–F–C–G (2마디씩) — G가 Am으로 해결돼
// 어떤 세그먼트 뒤에 어떤 세그먼트가 와도(그리고 라스트댄스로 넘어가도) 매끄럽다.
// A″만 +2 이조(Bm 계열) 후 A로 복귀 — 반복 지루함 방지용 리프트.
import type { Segment, Song, Track } from "../engine.js";
import {
  nf, seq, arp, merge, transpose, chordCycle,
  fourOnFloor, backbeat, offbeatHats, sixteenthHats,
  type NoteEvent,
} from "../theory.js";

const BEATS = 32; // 8마디 @128 = 15.000s

// ── 공통 리듬 섹션 ────────────────────────────────────────────────────────
const drumsBasic = (): Track[] => [
  { inst: "kick", vol: 0.5, notes: fourOnFloor(BEATS) },
  { inst: "snare", vol: 0.3, notes: backbeat(BEATS) },
  { inst: "hat", vol: 0.16, notes: offbeatHats(BEATS) },
];

/** 베이스: 코드당 8박, 8분음표 루트↔옥타브 펌핑 */
function bassline(roots: string[]): NoteEvent[] {
  return chordCycle(roots, 8, (r, at) => arp([r, r * 2], at, 16, 0.5, 0.42));
}

// ── 멜로디 (A 세그먼트, 32박) ─────────────────────────────────────────────
const leadA: NoteEvent[] = seq(
  // Am (0–8)
  [0, 0.5, "A4"], [0.5, 0.5, "C5"], [1, 0.5, "E5"], [1.5, 0.5, "A5"],
  [2, 1, "G5"], [3, 1, "E5"],
  [4, 0.5, "F5"], [4.5, 0.5, "E5"], [5, 0.5, "D5"], [5.5, 0.5, "C5"],
  [6, 1.5, "D5"], [7.5, 0.5, "B4"],
  // F (8–16)
  [8, 0.5, "A4"], [8.5, 0.5, "C5"], [9, 0.5, "F5"], [9.5, 0.5, "E5"],
  [10, 1, "C5"], [11, 1, "A4"],
  [12, 0.5, "B4"], [12.5, 0.5, "C5"], [13, 1, "D5"], [14, 2, "C5"],
  // C (16–24)
  [16, 0.5, "G4"], [16.5, 0.5, "C5"], [17, 0.5, "E5"], [17.5, 0.5, "G5"],
  [18, 1, "E5"], [19, 1, "C5"],
  [20, 0.5, "D5"], [20.5, 0.5, "E5"], [21, 1, "F5"], [22, 2, "E5"],
  // G (24–32) — 다음 Am으로 상행 해결
  [24, 0.5, "D5"], [24.5, 0.5, "B4"], [25, 0.5, "G4"], [25.5, 0.5, "B4"],
  [26, 1, "D5"], [27, 1, "G5"],
  [28, 0.5, "F5"], [28.5, 0.5, "E5"], [29, 0.5, "D5"], [29.5, 0.5, "B4"],
  [30, 1, "G4"], [31, 0.5, "E5"], [31.5, 0.5, "G5"],
);

/** 코드 트라이어드 (카운터 아르페지오용) */
const TRIADS: string[][] = [
  ["A4", "C5", "E5"],
  ["F4", "A4", "C5"],
  ["C5", "E5", "G5"],
  ["G4", "B4", "D5"],
];

/** A′용 16분 카운터 아르페지오 — 코드당 8박 상하행 */
function counterArp(): NoteEvent[] {
  const out: NoteEvent[] = [];
  TRIADS.forEach((tri, i) => {
    const up = tri.map(nf);
    const cyc = [...up, up[1]]; // 상행-되돌기 4음 순환
    out.push(...arp(cyc, i * 8, 16, 0.5, 0.22, 0.8));
  });
  return out;
}

// ── 세그먼트 A: 기본 ──────────────────────────────────────────────────────
const segA: Segment = {
  bpm: 128,
  beats: BEATS,
  tracks: [
    ...drumsBasic(),
    { inst: 2, vol: 0.2, notes: bassline(["A1", "F1", "C2", "G1"]), sustainLevel: 0.8 },
    { inst: 3, vol: 0.16, notes: leadA, sustainLevel: 0.6 },
  ],
};

// ── 세그먼트 A′: 카운터 아르페지오 + 해트 밀도 업 ─────────────────────────
const segA2: Segment = {
  bpm: 128,
  beats: BEATS,
  tracks: [
    { inst: "kick", vol: 0.5, notes: fourOnFloor(BEATS) },
    { inst: "snare", vol: 0.3, notes: backbeat(BEATS) },
    { inst: "hat", vol: 0.14, notes: sixteenthHats(BEATS, 0.8) },
    { inst: 2, vol: 0.2, notes: bassline(["A1", "F1", "C2", "G1"]), sustainLevel: 0.8 },
    { inst: 3, vol: 0.16, notes: leadA, sustainLevel: 0.6 },
    { inst: 1, vol: 0.12, notes: counterArp(), release: 0.05 },
  ],
};

// ── 세그먼트 A″: +2 이조(Bm–G–D–A) 리프트 — 마지막 A코드가 Am 복귀를 준비 ──
const segA3: Segment = {
  bpm: 128,
  beats: BEATS,
  tracks: [
    ...drumsBasic(),
    { inst: 2, vol: 0.2, notes: transpose(bassline(["A1", "F1", "C2", "G1"]), 2), sustainLevel: 0.8 },
    { inst: 3, vol: 0.16, notes: transpose(leadA, 2), sustainLevel: 0.6 },
    { inst: 1, vol: 0.11, notes: transpose(counterArp(), 2), release: 0.05 },
  ],
};

export const RACE: Song = {
  name: "race",
  grid: true,
  segments: [segA, segA2, segA3],
  loop: true,
};

// ── hurry: +3 이조 + 16분 해트 + 더블 킥 — 같은 32박 그리드라 경계 전환 무결 ──
const hurryKicks: NoteEvent[] = merge(
  fourOnFloor(BEATS),
  // 엇박 보강 킥 (마디 끝)
  seq(...Array.from({ length: 8 }, (_, bar) => [bar * 4 + 3.5, 0.1, 0, 0.7] as [number, number, number, number])),
);

const segHurry: Segment = {
  bpm: 128,
  beats: BEATS,
  tracks: [
    { inst: "kick", vol: 0.5, notes: hurryKicks },
    { inst: "snare", vol: 0.32, notes: backbeat(BEATS) },
    { inst: "hat", vol: 0.15, notes: sixteenthHats(BEATS) },
    { inst: 2, vol: 0.21, notes: transpose(bassline(["A1", "F1", "C2", "G1"]), 3), sustainLevel: 0.85 },
    { inst: 3, vol: 0.17, notes: transpose(leadA, 3), sustainLevel: 0.6 },
    { inst: 1, vol: 0.12, notes: transpose(counterArp(), 3), release: 0.05 },
  ],
};

export const RACE_HURRY: Song = {
  name: "race_hurry",
  grid: true,
  segments: [segHurry],
  loop: true,
};

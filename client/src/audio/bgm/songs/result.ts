// 결과 화면 BGM — 팡파레 인트로(1회) + 30초 잔잔한 루프. A장조.
// 라스트댄스가 E(도미넌트)로 끝난 직후 이 팡파레(A장조)가 해결음으로 이어진다.
// 인트로는 그리드 면제(1회성), 루프부는 30초 = 15초 배수.
import type { Segment, Song } from "../engine.js";
import { seq, arp, merge, chordCycle, type NoteEvent } from "../theory.js";

// ── 인트로 팡파레: 8박 @128 (3.75초) ─────────────────────────────────────
const fanfare: Segment = {
  bpm: 128,
  beats: 8,
  tracks: [
    {
      inst: 3, vol: 0.2, sustainLevel: 0.7,
      notes: seq(
        [0, 0.5, "A4"], [0.5, 0.5, "C#5"], [1, 0.5, "E5"], [1.5, 0.5, "A5"],
        [2, 1.5, "E5"], [3.5, 0.5, "A5"],
        [4, 3.5, "C#6", 0.9],
      ),
    },
    {
      // 화음 받침 (A 트라이어드 스태브)
      inst: 1, vol: 0.12,
      notes: merge(
        seq([0, 1, "A3"], [2, 1, "A3"], [4, 3.5, "A3"]),
        seq([0, 1, "C#4"], [2, 1, "C#4"], [4, 3.5, "C#4"]),
        seq([0, 1, "E4"], [2, 1, "E4"], [4, 3.5, "E4"]),
      ),
    },
    { inst: "snare", vol: 0.25, notes: Array.from({ length: 8 }, (_, i) => ({ t: i / 4, d: 0.05, f: 0, v: 0.4 + i * 0.07 })) },
    { inst: "kick", vol: 0.45, notes: seq([0, 0.1, 0], [2, 0.1, 0], [4, 0.1, 0]) },
  ],
};

// ── 루프: 64박 @128 (30초), A–D–E–D 잔잔한 그루브 ────────────────────────
const bass: NoteEvent[] = chordCycle(["A1", "D2", "E2", "D2"], 16, (r, at) =>
  seq([at, 3, r], [at + 3, 1, r * 2], [at + 4, 3, r], [at + 7, 1, r * 1.5], [at + 8, 4, r], [at + 12, 4, r]),
);

const TRIADS: string[][] = [
  ["A3", "C#4", "E4"],
  ["D4", "F#4", "A4"],
  ["E4", "G#4", "B4"],
  ["D4", "F#4", "A4"],
];
const pads: NoteEvent[] = merge(
  ...TRIADS.map((tri, i) => arp([...tri, tri[1]], i * 16, 32, 0.5, 0.4, 0.6)),
);

const lead: NoteEvent[] = seq(
  [0, 2, "C#5"], [2, 1, "B4"], [3, 1, "A4"], [4, 4, "E5"],
  [8, 2, "C#5"], [10, 2, "A4"], [12, 4, "B4"],
  [16, 2, "D5"], [18, 1, "C#5"], [19, 1, "B4"], [20, 4, "A4"],
  [24, 2, "F#4"], [26, 2, "A4"], [28, 4, "B4"],
  [32, 2, "E5"], [34, 1, "D5"], [35, 1, "C#5"], [36, 4, "B4"],
  [40, 2, "G#4"], [42, 2, "B4"], [44, 4, "E4"],
  [48, 2, "D5"], [50, 1, "C#5"], [51, 1, "B4"], [52, 2, "A4"], [54, 2, "F#4"],
  [56, 2, "A4"], [58, 2, "B4"], [60, 4, "C#5"],
);

const loopSeg: Segment = {
  bpm: 128,
  beats: 64,
  tracks: [
    { inst: "kick", vol: 0.3, notes: Array.from({ length: 16 }, (_, i) => ({ t: i * 4, d: 0.1, f: 0 })) },
    { inst: "hat", vol: 0.09, notes: Array.from({ length: 64 }, (_, i) => ({ t: i + 0.5, d: 0.04, f: 0, v: 0.7 })) },
    { inst: 0, vol: 0.22, notes: bass, sustainLevel: 0.85 },
    { inst: 1, vol: 0.09, notes: pads, release: 0.08 },
    { inst: 1, vol: 0.16, notes: lead, sustainLevel: 0.75, vibrato: 3, vibratoRate: 5 },
  ],
};

export const RESULT: Song = {
  name: "result",
  grid: true,
  intro: fanfare,
  segments: [loopSeg],
  loop: true,
};

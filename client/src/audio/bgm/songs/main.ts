// 메인·로비 BGM — 30초 루프, BPM 96(30s = 48박, 12마디). C장조, 느긋한 톤.
// 진행 C–Am–F–G (12박씩) — G→C 해결로 루프 이음새 자연.
import type { Segment, Song } from "../engine.js";
import { seq, arp, merge, chordCycle, type NoteEvent } from "../theory.js";

const BEATS = 48;

// 베이스(사인): 코드당 12박 — 루트 중심 + 5도 경과음
const bass: NoteEvent[] = chordCycle(["C2", "A1", "F1", "G1"], 12, (r, at) =>
  seq(
    [at, 3, r], [at + 3, 1, r * 1.5],
    [at + 4, 3, r], [at + 7, 1, r * 0.75],
    [at + 8, 4, r],
  ),
);

// 잔잔한 트라이어드 아르페지오 (8분, 낮은 볼륨)
const TRIADS: string[][] = [
  ["C4", "E4", "G4"],
  ["A3", "C4", "E4"],
  ["F3", "A3", "C4"],
  ["G3", "B3", "D4"],
];
const pads: NoteEvent[] = merge(
  ...TRIADS.map((tri, i) => arp([...tri, tri[1]], i * 12, 24, 0.5, 0.4, 0.7)),
);

// 멜로디(삼각파) — 성긴 2분·4분 위주
const lead: NoteEvent[] = seq(
  // C
  [0, 2, "E4"], [2, 1, "G4"], [3, 1, "A4"], [4, 3, "G4"], [8, 2, "E4"], [10, 2, "D4"],
  // Am
  [12, 2, "C4"], [14, 1, "E4"], [15, 1, "A4"], [16, 3, "G4"], [20, 2, "E4"], [22, 2, "C4"],
  // F
  [24, 2, "A4"], [26, 1, "G4"], [27, 1, "F4"], [28, 3, "A4"], [32, 2, "C5"], [34, 2, "A4"],
  // G — C로 해결 준비
  [36, 2, "B4"], [38, 1, "A4"], [39, 1, "G4"], [40, 2, "D4"], [42, 2, "G4"], [44, 2, "E4"], [46, 2, "D4"],
);

// 가벼운 퍼커션 — 마디 첫 박 킥 + 엇박 해트만
const kicks: NoteEvent[] = Array.from({ length: 12 }, (_, i) => ({ t: i * 4, d: 0.1, f: 0 }));
const hats: NoteEvent[] = Array.from({ length: BEATS }, (_, i) => ({ t: i + 0.5, d: 0.04, f: 0, v: 0.7 }));

const seg: Segment = {
  bpm: 96,
  beats: BEATS,
  tracks: [
    { inst: "kick", vol: 0.28, notes: kicks },
    { inst: "hat", vol: 0.08, notes: hats },
    { inst: 0, vol: 0.22, notes: bass, sustainLevel: 0.85 },
    { inst: 1, vol: 0.1, notes: pads, release: 0.08 },
    { inst: 1, vol: 0.17, notes: lead, sustainLevel: 0.75, vibrato: 3, vibratoRate: 5 },
  ],
};

export const MAIN: Song = { name: "main", grid: true, segments: [seg], loop: true };

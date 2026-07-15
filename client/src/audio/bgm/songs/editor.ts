// 제작 페이즈(맵 에디터) BGM — 30초 루프, BPM 128(30s = 64박, 16마디). D장조, 통통 튀는 톤.
// 진행 D–G–D–A (16박씩) — A→D 해결로 루프 이음새 자연. 레이스보다 가볍게(작업 집중 방해 금지).
import type { Segment, Song } from "../engine.js";
import { seq, arp, chordCycle, backbeat, offbeatHats, type NoteEvent } from "../theory.js";

const BEATS = 64;

// 바운시 베이스(사각): 코드당 16박 — 루트·옥타브·5도 순환 8분
const bass: NoteEvent[] = chordCycle(["D2", "G1", "D2", "A1"], 16, (r, at) =>
  arp([r, r * 2, r * 1.5, r * 2], at, 32, 0.5, 0.38, 0.9),
);

// 플러키 리드(사각) — 8분 + 쉼표로 통통 튀게
const lead: NoteEvent[] = seq(
  // D (0–16)
  [0, 0.4, "D5"], [1, 0.4, "F#5"], [2, 0.4, "A5"], [3, 0.4, "F#5"],
  [4, 1, "B5"], [6, 0.4, "A5"], [7, 0.4, "F#5"],
  [8, 0.4, "G5"], [9, 0.4, "F#5"], [10, 0.4, "E5"], [11, 0.4, "F#5"],
  [12, 2, "D5"],
  // G (16–32)
  [16, 0.4, "G4"], [17, 0.4, "B4"], [18, 0.4, "D5"], [19, 0.4, "B4"],
  [20, 1, "E5"], [22, 0.4, "D5"], [23, 0.4, "B4"],
  [24, 0.4, "C5"], [25, 0.4, "B4"], [26, 0.4, "A4"], [27, 0.4, "B4"],
  [28, 2, "G4"],
  // D 변주 (32–48)
  [32, 0.4, "A5"], [33, 0.4, "F#5"], [34, 0.4, "D5"], [35, 0.4, "F#5"],
  [36, 1, "A5"], [38, 1, "B5"],
  [40, 0.4, "A5"], [41, 0.4, "G5"], [42, 0.4, "F#5"], [43, 0.4, "E5"],
  [44, 2, "F#5"],
  // A (48–64) — D로 해결 준비
  [48, 0.4, "E5"], [49, 0.4, "C#5"], [50, 0.4, "A4"], [51, 0.4, "C#5"],
  [52, 1, "E5"], [54, 1, "F#5"],
  [56, 0.4, "E5"], [57, 0.4, "D5"], [58, 0.4, "C#5"], [59, 0.4, "B4"],
  [60, 1, "C#5"], [61, 1, "E5"], [62, 2, "A4"],
);

// 드럼 — 킥은 1·3박만(가볍게), 백비트 스네어 약하게, 엇박 해트
const kicks: NoteEvent[] = Array.from({ length: BEATS / 2 }, (_, i) => ({ t: i * 2, d: 0.1, f: 0 }));

const seg: Segment = {
  bpm: 128,
  beats: BEATS,
  tracks: [
    { inst: "kick", vol: 0.35, notes: kicks },
    { inst: "snare", vol: 0.18, notes: backbeat(BEATS) },
    { inst: "hat", vol: 0.13, notes: offbeatHats(BEATS) },
    { inst: 3, vol: 0.15, notes: bass, sustainLevel: 0.7 },
    { inst: 3, vol: 0.13, notes: lead, sustainLevel: 0.5, release: 0.05 },
  ],
};

export const EDITOR: Song = { name: "editor", grid: true, segments: [seg], loop: true };

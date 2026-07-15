// 라스트댄스 — 정확 30초 원샷 빌드업 (루프 아님). GAME_RULES.lastDanceSec=30과 정합.
// BPM 128 → 30초 = 64박(16마디). 레이스와 같은 키(Am)·같은 BPM이라 세그먼트 경계에서
// 레이스 BGM으로부터 이음새 없이 이어진다. 4마디 단위로 레이어가 쌓여 마지막 4마디에 피크,
// 종지는 E(도미넌트) 롱톤 — 종료 직후 결과 팡파레(A장조)로 해결된다.
import { GAME_RULES } from "shared";
import type { Segment, Song } from "../engine.js";
import {
  nf, seq, arp, merge, shift,
  backbeat, offbeatHats, sixteenthHats,
  type NoteEvent,
} from "../theory.js";

const BPM = 128;
const BEATS = (GAME_RULES.lastDanceSec * BPM) / 60; // 30s → 64박. 상수가 바뀌면 길이도 추종
if (!Number.isInteger(BEATS)) throw new Error("[bgm] lastDanceSec가 BPM 128 정수 박과 안 맞음");

// ── 드럼: 구간별 밀도 상승 ────────────────────────────────────────────────
const kicks: NoteEvent[] = merge(
  // 0–16: 마디 첫 박만 (긴장 시작)
  seq([0, 0.1, 0], [4, 0.1, 0], [8, 0.1, 0], [12, 0.1, 0]),
  // 16–64: 포온플로어
  Array.from({ length: 48 }, (_, i) => ({ t: 16 + i, d: 0.1, f: 0 })),
);
const snares: NoteEvent[] = merge(
  shift(backbeat(32), 16),            // 16–48 백비트
  shift(backbeat(12), 48),            // 48–60 백비트 유지
  // 60–64: 16분 스네어 롤 크레셴도
  Array.from({ length: 16 }, (_, i) => ({ t: 60 + i / 4, d: 0.05, f: 0, v: 0.4 + (i / 16) * 0.6 })),
);
const hats: NoteEvent[] = merge(
  shift(offbeatHats(16), 16),         // 16–32 엇박
  shift(sixteenthHats(32), 32),       // 32–64 16분
);

// ── 베이스: A 페달 8분 펌핑 — 후반부 옥타브 상승 ─────────────────────────
const bass: NoteEvent[] = merge(
  arp(["A1", "A1"], 0, 32, 0.5, 0.42, 0.8),        // 0–16 낮게
  arp(["A1", "A2"], 16, 32, 0.5, 0.42),            // 16–32 옥타브 펌핑
  arp(["A2", "A3"], 32, 32, 0.5, 0.42),            // 32–48 한 옥타브 위
  arp(["A2", "E3", "A3", "E3"], 48, 24, 0.5, 0.42), // 48–60 5도 추가
  seq([60, 4, "E2", 1]),                            // 60–64 도미넌트 페달
);

// ── 아르페지오: 8분 → 16분 → 상행 질주 ──────────────────────────────────
const arps: NoteEvent[] = merge(
  arp(["A3", "C4", "E4", "C4"], 8, 16, 0.5, 0.3, 0.7),                  // 8–16 예열
  arp(["A4", "C5", "E5", "C5"], 16, 32, 0.5, 0.3),                      // 16–32 8분
  arp(["A4", "C5", "E5", "A5"], 32, 64, 0.25, 0.18),                    // 32–48 16분
  arp(["A5", "E5", "C5", "E5"], 48, 48, 0.25, 0.18),                    // 48–60 16분 상성부
);

// ── 리드: 후반 진입, 마지막 4마디 스케일 상행 → E 롱톤 ───────────────────
const lead: NoteEvent[] = merge(
  seq(
    [32, 1, "E5"], [33, 0.5, "D5"], [33.5, 0.5, "C5"], [34, 2, "E5"],
    [36, 1, "A5"], [37, 1, "G5"], [38, 2, "E5"],
    [40, 1, "F5"], [41, 0.5, "E5"], [41.5, 0.5, "D5"], [42, 2, "C5"],
    [44, 1, "D5"], [45, 1, "E5"], [46, 2, "G5"],
  ),
  // 48–60: A 마이너 스케일 상행 질주 (반박씩)
  seq(
    [48, 0.5, "A4"], [48.5, 0.5, "B4"], [49, 0.5, "C5"], [49.5, 0.5, "D5"],
    [50, 0.5, "E5"], [50.5, 0.5, "F5"], [51, 0.5, "G5"], [51.5, 0.5, "A5"],
    [52, 1, "E5"], [53, 1, "G5"], [54, 2, "A5"],
    [56, 0.5, "A5"], [56.5, 0.5, "B5"], [57, 0.5, "C6"], [57.5, 0.5, "B5"],
    [58, 1, "A5"], [59, 1, "G5"],
  ),
  // 60–64: 피크 — E 도미넌트 롱톤 (+옥타브 겹)
  [
    { t: 60, d: 4, f: nf("E5"), v: 1 },
    { t: 60, d: 4, f: nf("E6"), v: 0.5 },
    { t: 60, d: 4, f: nf("B5"), v: 0.6 },
  ],
);

const seg: Segment = {
  bpm: BPM,
  beats: BEATS,
  tracks: [
    { inst: "kick", vol: 0.52, notes: kicks },
    { inst: "snare", vol: 0.3, notes: snares },
    { inst: "hat", vol: 0.14, notes: hats },
    { inst: 2, vol: 0.2, notes: bass, sustainLevel: 0.85 },
    { inst: 1, vol: 0.12, notes: arps, release: 0.05 },
    { inst: 3, vol: 0.16, notes: lead, sustainLevel: 0.6, vibrato: 5, vibratoRate: 6 },
  ],
};

export const LASTDANCE: Song = {
  name: "lastdance",
  grid: true,       // 30s = 15s 배수 — 레이스에서 경계 전환 가능
  segments: [seg],
  loop: false,      // 원샷: 30초 후 자연 종료 → 결과 팡파레로
};

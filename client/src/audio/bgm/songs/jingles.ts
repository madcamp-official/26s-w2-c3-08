// 징글 — 짧은 멜로디형 신호음 (원샷, 그리드 무관). SFX(단일음)와 달리 여러 음의 악구.
// BGM 볼륨 계열로 재생(playJingle). 게임 진행 이벤트용.
import type { Segment } from "../engine.js";
import { seq, merge } from "../theory.js";

export const JINGLES = {
  /** 체크포인트 깃발 터치 — 빠른 상행 아르페지오 */
  checkpoint: {
    bpm: 128,
    beats: 3,
    tracks: [
      {
        inst: 3 as const, vol: 0.22, release: 0.1,
        notes: seq([0, 0.25, "E5"], [0.25, 0.25, "G5"], [0.5, 0.25, "B5"], [0.75, 1.25, "E6"]),
      },
    ],
  },
  /** 카운트다운 틱 (3·2·1 각각 1회 재생) */
  countTick: {
    bpm: 128,
    beats: 1,
    tracks: [{ inst: 3 as const, vol: 0.2, release: 0.06, notes: seq([0, 0.4, "G5"]) }],
  },
  /** GO! — 틱보다 높고 길게 + 화음 */
  countGo: {
    bpm: 128,
    beats: 3,
    tracks: [
      { inst: 3 as const, vol: 0.22, notes: seq([0, 0.3, "G5"], [0.3, 1.7, "C6"]) },
      { inst: 1 as const, vol: 0.12, notes: merge(seq([0.3, 1.7, "C5"]), seq([0.3, 1.7, "E5"]), seq([0.3, 1.7, "G5"])) },
      { inst: "kick" as const, vol: 0.4, notes: seq([0.3, 0.1, 0]) },
    ],
  },
  /** 내 골인 — 승리 팡파레(짧은) */
  goalSelf: {
    bpm: 128,
    beats: 6,
    tracks: [
      {
        inst: 3 as const, vol: 0.22, sustainLevel: 0.7,
        notes: seq(
          [0, 0.5, "C5"], [0.5, 0.5, "E5"], [1, 0.5, "G5"], [1.5, 0.5, "C6"],
          [2, 0.75, "G5"], [2.75, 0.25, "A5"], [3, 2.5, "C6"],
        ),
      },
      { inst: 1 as const, vol: 0.1, notes: merge(seq([3, 2.5, "C5"]), seq([3, 2.5, "E5"]), seq([3, 2.5, "G5"])) },
      { inst: "snare" as const, vol: 0.22, notes: seq([0, 0.05, 0], [0.5, 0.05, 0], [1, 0.05, 0], [1.5, 0.05, 0], [2, 0.05, 0, 0.7], [3, 0.08, 0]) },
    ],
  },
  /** 남의 골인 — 짧은 중립 알림 */
  goalOther: {
    bpm: 128,
    beats: 2,
    tracks: [{ inst: 1 as const, vol: 0.18, release: 0.08, notes: seq([0, 0.4, "E5"], [0.5, 0.8, "C5"]) }],
  },
  /** 라인 테스트 성공 */
  testPass: {
    bpm: 128,
    beats: 4,
    tracks: [
      {
        inst: 3 as const, vol: 0.2, release: 0.08,
        notes: seq([0, 0.4, "C5"], [0.5, 0.4, "E5"], [1, 0.4, "G5"], [1.5, 1.5, "C6"]),
      },
    ],
  },
  /** 라인 테스트 실패 — 하행 반음 */
  testFail: {
    bpm: 128,
    beats: 4,
    tracks: [
      {
        inst: 2 as const, vol: 0.18, sustainLevel: 0.6,
        notes: seq([0, 0.6, "Eb5"], [0.75, 0.6, "D5"], [1.5, 1.5, "Db5"]),
      },
    ],
  },
  /** 리타이어 확정 — 느린 하행 3음 */
  retire: {
    bpm: 128,
    beats: 6,
    tracks: [
      {
        inst: 1 as const, vol: 0.18, sustainLevel: 0.7,
        notes: seq([0, 1, "A4"], [1.5, 1, "F4"], [3, 2.5, "D4"]),
      },
    ],
  },
  /** 게임(레이스) 시작 — 상행 스윕 + 임팩트 */
  gameStart: {
    bpm: 128,
    beats: 4,
    tracks: [
      {
        inst: 3 as const, vol: 0.2, release: 0.1,
        notes: seq([0, 0.25, "D5"], [0.25, 0.25, "E5"], [0.5, 0.25, "F#5"], [0.75, 0.25, "A5"], [1, 2, "D6"]),
      },
      { inst: "kick" as const, vol: 0.45, notes: seq([1, 0.1, 0]) },
      { inst: "snare" as const, vol: 0.25, notes: seq([1, 0.08, 0]) },
    ],
  },
} satisfies Record<string, Segment>;

export type JingleName = keyof typeof JINGLES;
export const JINGLE_NAMES = Object.keys(JINGLES) as JingleName[];

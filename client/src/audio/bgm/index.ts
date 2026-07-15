// BGM 공개 API — 곡 레지스트리 + 이름 기반 재생/전환/정지.
// 사용처: 화면 진입 시 playBgm("main") 한 줄, 레이스 종료 임박 시 queueBgm("race_hurry") 등.
// 오디션: 개발자 콘솔 `playbgm <이름|list|stop>` / `playjingle <이름|list>`.
import {
  playBgm as enginePlay, queueBgm as engineQueue, stopBgm, currentBgmName,
  playJingleSegment, type Song,
} from "./engine.js";
import { MAIN } from "./songs/main.js";
import { EDITOR } from "./songs/editor.js";
import { RACE, RACE_HURRY } from "./songs/race.js";
import { LASTDANCE } from "./songs/lastdance.js";
import { RESULT } from "./songs/result.js";
import { JINGLES, JINGLE_NAMES, type JingleName } from "./songs/jingles.js";

const SONGS = {
  main: MAIN,
  editor: EDITOR,
  race: RACE,
  race_hurry: RACE_HURRY,
  lastdance: LASTDANCE,
  result: RESULT,
} satisfies Record<string, Song>;

export type BgmName = keyof typeof SONGS;
export const BGM_NAMES = Object.keys(SONGS) as BgmName[];

/** 즉시 재생 (재생 중이면 교체) */
export function playBgm(name: BgmName): void {
  enginePlay(SONGS[name]);
}

/** 다음 15초 세그먼트 경계에서 전환 — race→race_hurry→lastdance 이음새 없는 연결용 */
export function queueBgm(name: BgmName): void {
  engineQueue(SONGS[name]);
}

export { stopBgm, currentBgmName };

export function playJingle(name: JingleName): void {
  playJingleSegment(name, JINGLES[name]);
}
export { JINGLE_NAMES, type JingleName };

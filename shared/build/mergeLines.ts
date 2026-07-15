// 라인[] → WorldDef 병합. 가로는 순서대로 이어붙이고, 세로는 깃발 y를 맞춰 누적한다
// (게임 규칙: "병합맵 세로는 깃발 y 누적으로 무제한 — 오르내림 맵").
// 라인 순서(랜덤 셔플)는 호출부 책임 — 여기는 주어진 순서 그대로 붙인다.
// 깃발 아래 3×1 기단은 여기서 지형(solid)으로 생성 — 에디터·저장 데이터엔 없음(깃발 좌표에서 파생).
import { TUNING } from "../physics/tuning.js";
import { SOLID_ALL } from "../physics/terrain.js";
import { FLAGPOLE } from "../race/flagpole.js";
import type { WorldDef } from "./worldDef.js";
import { loadLine, type LineRecord } from "./loadLine.js";

const T = TUNING.world.tileSize;
const WALL_PAD_TILES = 30;   // 좌우 벽 세로 여유 (깃발 y 범위 밖으로 충분히)
const FALL_PAD_TILES = 6;    // 최하단 콘텐츠 아래 추락사 여유

export interface FlagTile { x: number; y: number }

export interface MergedMap {
  worldDef: WorldDef;
  /** 첫 라인의 진짜 시작 / 마지막 라인의 진짜 골 (병합 좌표, 타일) — 깃대를 길게 구분할 대상 */
  startFlagTiles: FlagTile;
  goalFlagTiles: FlagTile;
  /** 라인별 [시작, 끝] 깃발(병합 좌표) — 체크포인트·파괴 스윕용 */
  lineFlags: { start: FlagTile; end: FlagTile }[];
  /** 라인별 가로 범위(타일, 병합 좌표) — 파괴 스윕 대상 판정용 */
  lineRanges: { startX: number; endX: number }[];
  /** 이 아래(px)로 떨어지면 추락사 */
  fallY: number;
}

/** 깃발 아래 3×1 기단(깃발 x 중심) — 지형 solid */
function flagBaseRect(flag: FlagTile) {
  const half = Math.floor(FLAGPOLE.baseWidthTiles / 2);
  return { x: (flag.x - half) * T, y: (flag.y + 1) * T, w: FLAGPOLE.baseWidthTiles * T, h: T, faces: SOLID_ALL };
}

export function mergeLines(lines: LineRecord[]): MergedMap {
  if (lines.length === 0) throw new Error("병합할 라인이 없습니다");

  let offsetX = 0;
  let offsetY = 0;
  const blocks: WorldDef["blocks"] = [];
  const monsters: WorldDef["monsters"] = [];
  const flagBases: ReturnType<typeof flagBaseRect>[] = [];
  const lineFlags: MergedMap["lineFlags"] = [];
  const lineRanges: MergedMap["lineRanges"] = [];
  let startFlagTiles: FlagTile = { x: 0, y: 0 };
  let goalFlagTiles: FlagTile = { x: 0, y: 0 };
  let minY = Infinity, maxY = -Infinity;
  let contentMaxY = -Infinity;

  lines.forEach((line, i) => {
    const loaded = loadLine(line, offsetX, offsetY);
    blocks.push(...loaded.blocks);
    monsters.push(...loaded.monsters);
    flagBases.push(flagBaseRect(loaded.startFlag), flagBaseRect(loaded.endFlag));
    lineFlags.push({ start: loaded.startFlag, end: loaded.endFlag });
    if (i === 0) startFlagTiles = loaded.startFlag;
    goalFlagTiles = loaded.endFlag;
    minY = Math.min(minY, loaded.startFlag.y, loaded.endFlag.y);
    maxY = Math.max(maxY, loaded.startFlag.y, loaded.endFlag.y);
    contentMaxY = Math.max(contentMaxY, loaded.contentMaxYTiles);

    lineRanges.push({ startX: offsetX, endX: offsetX + loaded.tileLength });

    const next = lines[i + 1];
    offsetX += loaded.tileLength;
    // 다음 라인 시작 깃발 y를 이 라인 끝 깃발 y에 맞춤 (원본 미오프셋 좌표 기준)
    if (next) offsetY += line.endFlagY - next.startFlagY;
  });

  const totalWidthTiles = offsetX;
  const wallTop = (minY - WALL_PAD_TILES) * T;
  const wallHeight = (maxY - minY + WALL_PAD_TILES * 2) * T;

  const worldDef: WorldDef = {
    terrain: {
      solids: [
        { x: -T, y: wallTop, w: T, h: wallHeight, faces: SOLID_ALL },
        { x: totalWidthTiles * T, y: wallTop, w: T, h: wallHeight, faces: SOLID_ALL },
        ...flagBases,
      ],
      slopes: [],
    },
    blocks, monsters, items: [],
    line: { startX: 0, endX: totalWidthTiles * T, index: 0 },
    // 스폰 = 시작 깃발 기단 윗면 (body y = 발 위치)
    spawn: { x: startFlagTiles.x * T + T / 2, y: (startFlagTiles.y + 1) * T },
  };

  return {
    worldDef, startFlagTiles, goalFlagTiles, lineFlags, lineRanges,
    fallY: (contentMaxY + FALL_PAD_TILES) * T,
  };
}

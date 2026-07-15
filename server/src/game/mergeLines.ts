// 라인[] → WorldDef 병합. 가로는 순서대로 이어붙이고, 세로는 깃발 y를 맞춰 누적한다
// (게임 규칙: "병합맵 세로는 깃발 y 누적으로 무제한 — 오르내림 맵").
// 라인 순서(랜덤 셔플)는 호출부(resolveMemberLines) 책임 — 여기는 주어진 순서 그대로 붙인다.
import { TUNING } from "shared/physics";
import { SOLID_ALL } from "shared/physics";
import type { WorldDef } from "../rooms/base/PhysicsRoom.js";
import { loadLine, type LineWithPlacements } from "./loadLine.js";

const T = TUNING.world.tileSize;
const WALL_PAD_TILES = 30;   // 좌우 벽 세로 여유 (깃발 y 범위 밖으로 충분히)

export interface MergedMap {
  worldDef: WorldDef;
  /** 첫 라인의 진짜 시작 / 마지막 라인의 진짜 골 (병합 좌표, 타일) — 깃대를 길게 구분할 대상 */
  startFlagTiles: { x: number; y: number };
  goalFlagTiles: { x: number; y: number };
}

export function mergeLines(lines: LineWithPlacements[]): MergedMap {
  if (lines.length === 0) throw new Error("병합할 라인이 없습니다");

  let offsetX = 0;
  let offsetY = 0;
  const blocks: WorldDef["blocks"] = [];
  const monsters: WorldDef["monsters"] = [];
  let startFlagTiles = { x: 0, y: 0 };
  let goalFlagTiles = { x: 0, y: 0 };
  let minY = Infinity, maxY = -Infinity;

  lines.forEach((line, i) => {
    const loaded = loadLine(line, offsetX, offsetY);
    blocks.push(...loaded.blocks);
    monsters.push(...loaded.monsters);
    if (i === 0) startFlagTiles = loaded.startFlag;
    goalFlagTiles = loaded.endFlag;
    minY = Math.min(minY, loaded.startFlag.y, loaded.endFlag.y);
    maxY = Math.max(maxY, loaded.startFlag.y, loaded.endFlag.y);

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
      ],
      slopes: [],
    },
    blocks, monsters, items: [],
    line: { startX: 0, endX: totalWidthTiles * T, index: 0 },
    spawn: { x: startFlagTiles.x * T, y: startFlagTiles.y * T },
  };

  return { worldDef, startFlagTiles, goalFlagTiles };
}

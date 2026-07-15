// 테스트 라인 픽스처 — 에디터 완성 전, 병합·레이스 경로를 돌리기 위한 손제작 라인 3개.
// assetKey는 서버 시드(server/src/seed/systemAssets.ts)의 시스템 에셋 key("sys.*").
// 시드가 이 픽스처를 MapLine/MapLinePlacement 행으로도 삽입한다(testPassedAt=now).
import type { LineData, LinePlacementData } from "./lineTypes.js";

/** 지면 블록(1×1) 가로 연속 배치 헬퍼 */
function groundRun(x0: number, x1: number, y: number): LinePlacementData[] {
  const out: LinePlacementData[] = [];
  for (let x = x0; x <= x1; x++) out.push({ assetKey: "sys.ground", x, y });
  return out;
}

/** 라인1 평지형: 바닥 + 계단 + 굼바 + 트램펄린. 깃발 y 동일 */
const flatLine: LineData = {
  name: "test.flat",
  tileLength: 24,
  startFlag: { x: 1, y: 17 },
  endFlag: { x: 22, y: 17 },
  placements: [
    ...groundRun(0, 23, 18),
    // 계단 (1칸씩)
    { assetKey: "sys.ground", x: 10, y: 17 },
    { assetKey: "sys.ground", x: 11, y: 17 },
    { assetKey: "sys.ground", x: 11, y: 16 },
    { assetKey: "sys.goomba", x: 14, y: 17 },
    { assetKey: "sys.spring", x: 18, y: 17 },
  ],
};

/** 라인2 갭점프형: 반통과 발판 징검다리 + 가시 섬 + 왕복 발판(끝점 핸들). 깃발 y 동일 */
const gapLine: LineData = {
  name: "test.gap",
  tileLength: 28,
  startFlag: { x: 1, y: 17 },
  endFlag: { x: 26, y: 17 },
  placements: [
    ...groundRun(0, 5, 18),
    ...groundRun(10, 12, 18),
    { assetKey: "sys.spike", x: 11, y: 17 },
    { assetKey: "sys.platform", x: 7, y: 16 },       // 3×1 반통과
    { assetKey: "sys.platform", x: 14, y: 15 },
    { assetKey: "sys.platform", x: 16, y: 14, endX: 20, endY: 14 }, // 왕복 발판
    ...groundRun(22, 27, 18),
    { assetKey: "sys.spiky", x: 24, y: 17 },
  ],
};

/** 라인3 오르내림형: 끝 깃발이 시작보다 6타일 높음(병합 y 이어붙임 검증) + 스위치/게이트 */
const climbLine: LineData = {
  name: "test.climb",
  tileLength: 24,
  startFlag: { x: 1, y: 17 },
  endFlag: { x: 22, y: 11 },
  placements: [
    ...groundRun(0, 7, 18),
    { assetKey: "sys.switch", x: 3, y: 17 },
    // 1칸 계단 상승
    { assetKey: "sys.ground", x: 9, y: 17 },
    { assetKey: "sys.ground", x: 11, y: 16 },
    { assetKey: "sys.ground", x: 13, y: 15 },
    { assetKey: "sys.ground", x: 15, y: 14 },
    { assetKey: "sys.ground", x: 17, y: 13 },
    // 스위치 ON일 때만 나타나는 지름길 발판
    { assetKey: "sys.gate", x: 14, y: 13 },
    ...groundRun(19, 23, 12),
  ],
};

export const TESTLINES: LineData[] = [flatLine, gapLine, climbLine];

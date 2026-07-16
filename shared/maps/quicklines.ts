// 간이 레이스(?quick) 전용 라인 2개 — quick.line1(쉬움)·quick.line2(어려움).
// 바닥은 전 구간 연속(추락사 없음). assetKey는 server/src/seed/systemAssets.ts의 "sys.*".
import type { LineData, LinePlacementData } from "./lineTypes.js";

function groundRun(x0: number, x1: number, y: number): LinePlacementData[] {
  const out: LinePlacementData[] = [];
  for (let x = x0; x <= x1; x++) out.push({ assetKey: "sys.ground", x, y });
  return out;
}

/** 세로 기둥(벽타기 샤프트용). y0(위)~y1(아래) */
function pillar(x: number, y0: number, y1: number): LinePlacementData[] {
  const out: LinePlacementData[] = [];
  for (let y = y0; y <= y1; y++) out.push({ assetKey: "sys.ground", x, y });
  return out;
}

/** 라인1 — 잡몹 조금 + 스위치/반응 블록만 대충, 그냥 지나가면 되는 쉬운 라인 */
const quickLine1: LineData = {
  name: "quick.line1",
  tileLength: 20,
  startFlag: { x: 1, y: 17 },
  endFlag: { x: 18, y: 17 },
  placements: [
    ...groundRun(0, 19, 18),
    { assetKey: "sys.switch", x: 3, y: 17 },
    { assetKey: "sys.goomba", x: 6, y: 17 },
    { assetKey: "sys.gate", x: 12, y: 16 },
    { assetKey: "sys.spiky", x: 9, y: 17 },
    { assetKey: "sys.goomba", x: 16, y: 17 },
  ],
};

/** 라인2 — 어려움: 계단식 점프 2세트(바닥 연속, 추락사 없음) → 가시열+스프링 →
 *  벽타기 샤프트(기둥 꼭대기 = 물음표 블록, 거대화 지급) */
const quickLine2: LineData = {
  name: "quick.line2",
  tileLength: 38,
  startFlag: { x: 1, y: 17 },
  endFlag: { x: 35, y: 17 },
  placements: [
    ...groundRun(0, 37, 18),
    // 계단식 점프 2세트 (반통과 발판, 3×1) — 바닥이 이미 연속이라 놓쳐도 안 죽음
    { assetKey: "sys.platform", x: 4, y: 17 },
    { assetKey: "sys.platform", x: 6, y: 16 },
    { assetKey: "sys.platform", x: 8, y: 15 },
    { assetKey: "sys.platform", x: 11, y: 15 },
    { assetKey: "sys.platform", x: 13, y: 14 },
    { assetKey: "sys.platform", x: 15, y: 13 },
    // 가시열 + 중앙 스프링(한 번 밟고 튕겨 오르는 지점)
    { assetKey: "sys.spike", x: 20, y: 17 },
    { assetKey: "sys.spike", x: 21, y: 17 },
    { assetKey: "sys.spike", x: 22, y: 17 },
    { assetKey: "sys.spike", x: 23, y: 17 },
    { assetKey: "sys.spring", x: 24, y: 17 },
    { assetKey: "sys.spike", x: 25, y: 17 },
    { assetKey: "sys.spike", x: 26, y: 17 },
    { assetKey: "sys.spike", x: 27, y: 17 },
    { assetKey: "sys.spike", x: 28, y: 17 },
    // 벽타기 샤프트 — 기둥 꼭대기가 물음표 블록(거대화)
    ...pillar(30, 12, 17),
    { assetKey: "sys.qblock", x: 30, y: 11 },
    ...pillar(32, 12, 17),
    { assetKey: "sys.qblock", x: 32, y: 11 },
  ],
};

export const QUICKLINES: LineData[] = [quickLine1, quickLine2];

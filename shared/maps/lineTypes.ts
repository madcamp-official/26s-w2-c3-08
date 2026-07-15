// 라인 데이터 계약 — 에디터 저장·서버 API·테스트 픽스처가 공유하는 형태 (DB MapLine/MapLinePlacement와 1:1).
// 좌표 규약: 라인 로컬 타일 좌표, (0,0)=좌상단, y 아래로 증가. placement (x,y)=에셋 좌상단 타일.
// 깃발 (x,y)=깃발이 서 있는 빈 타일(지면 블록 바로 위 행).
import { GAME_RULES } from "../constants.js";

export interface LinePlacementData {
  /** 픽스처=시드 key("sys.*"), DB 로드 시=assetId 문자열 */
  assetKey: string;
  x: number;
  y: number;
  flipX?: boolean;
  /** patrol/ride 이동 끝점 (타일). 정적이면 생략 */
  endX?: number;
  endY?: number;
}

export interface LineData {
  /** 재사용 브라우징·픽스처 식별용 */
  name: string;
  /** 시작~끝 깃발 가로 거리(타일). GAME_RULES.lineMaxWidthTiles 이하 */
  tileLength: number;
  startFlag: { x: number; y: number };
  endFlag: { x: number; y: number };
  placements: LinePlacementData[];
}

/** 계약 위반 조기 발견용 최소 검증 (에디터 저장·서버 수신 공용) */
export function validateLineData(l: LineData): string | null {
  if (l.tileLength <= 0 || l.tileLength > GAME_RULES.lineMaxWidthTiles) return "tileLength 범위 초과";
  if (l.endFlag.x < l.startFlag.x) return "끝 깃발이 시작 깃발보다 왼쪽";
  return null;
}

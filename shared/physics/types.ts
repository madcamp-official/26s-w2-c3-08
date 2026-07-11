// 클라(예측)·서버(권위)가 공유하는 물리 타입.
// 환경 의존(Phaser/DOM) 금지 — 순수 데이터만.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 경사면. (x,y,w,h)는 바운딩 박스, 빗면이 바닥 역할.
 * dir=1: 오른쪽으로 올라감 (왼아래→오른위), dir=-1: 오른쪽으로 내려감
 */
export interface Slope {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 1 | -1;
}

/** 지형 = 사각 솔리드 + 경사면 */
export interface Terrain {
  solids: Rect[];
  slopes: Slope[];
}

/** 클라 → 서버로 보내는 입력 (틱마다 1개) */
export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;   // 누르고 있는 상태 (엣지는 물리에서 판정)
  down: boolean;   // 지상=웅크리기, 공중=내려찍기
  run: boolean;    // 달리기 (Shift)
  tick: number;
}

/** 내려찍기 상태 머신 */
export type PoundState = 0 | 1 | 2; // 0=none, 1=hang(공중 정지), 2=fall(수직 낙하)

/** 물리 시뮬레이션 대상 플레이어 상태 (서버 권위 원본 / 클라 예측 사본) */
export interface PlayerPhys {
  x: number;          // 좌상단 기준
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  pound: PoundState;
  poundHangLeftMs: number;
  crouch: boolean;       // 지상 웅크리기 (히트박스 실제 축소)
  spinLeftMs: number;    // 공중 스핀 남은 시간 (연출 + 낙하 감속)
  spinUsed: boolean;     // 공중 스핀 사용 여부 — 착지해야 리셋 (갤럭시식 쿨타임)
  poundLandLeftMs: number; // 내려찍기 착지 후 강화 점프 유효 시간 (3D월드식)
  slide: boolean;        // 슬라이딩 (경사 내려찍기 착지 / 고속 웅크리기)
  onSlopeDir: 0 | 1 | -1;    // 이번 틱 경사면 접지 방향 (integrate가 갱신)
  touchingWall: 0 | 1 | -1;  // 이번 틱 벽 접촉 방향 (1=오른쪽 벽)
  jumpChain: number;     // 트리플 점프 단계 (0~2)
  chainLeftMs: number;   // 착지 후 연속 점프 유효 시간
  wasAirborne: boolean;  // 착지 순간 검출용
  coyoteLeftMs: number;
  jumpBufferLeftMs: number;
  prevJumpHeld: boolean; // 점프 엣지 검출용
}

export function createPlayerPhys(x: number, y: number): PlayerPhys {
  return {
    x, y, vx: 0, vy: 0,
    grounded: false, facing: 1,
    pound: 0, poundHangLeftMs: 0,
    crouch: false, spinLeftMs: 0, spinUsed: false, poundLandLeftMs: 0,
    slide: false, onSlopeDir: 0, touchingWall: 0,
    jumpChain: 0, chainLeftMs: 0, wasAirborne: false,
    coyoteLeftMs: 0, jumpBufferLeftMs: 0,
    prevJumpHeld: false,
  };
}

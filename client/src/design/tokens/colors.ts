// 손그림 UI 팔레트 (screen-design.md "UI 테마" 2026-07-16 개정: 노랑 단일 hue 램프).
// 원칙: 화면당 채도 있는 주역=노랑 하나. 나머지는 노랑 명도 변주 + 잉크(검정 대체). 순검정 금지.
// 화면 코드에 hex 하드코딩 금지 — 여기서만.

/** 노랑 램프 — 배경부터 눌림까지 전부 노랑의 명도 변주. */
export const YELLOW = {
  card: "#FFFDF5",    // 카드면(가장 밝음, 거의 크림)
  list: "#FFF6DB",    // 목록/패널 배경
  barLight: "#FFD54A",// 밝은 바(메인으로 등 얇은 띠)
  base: "#F6BE00",    // 주역 — 주 버튼·바·활성 상태
  pressed: "#D9A400", // 눌림
} as const;

/** 잉크 — 순검정 대신 노랑에 어울리는 짙은 갈흑색. 텍스트·손그림 테두리 기본색. */
export const INK = "#3B2F14";
export const INK_SOFT = "#8A6D1F";   // 보조 텍스트/수치

/** 신호색 — 화면당 소량만. UI 대면적에 쓰지 않음. */
export const SIGNAL = {
  danger: "#E52521",   // 위험·강조 숫자·진행중 시간
  ok: "#1D9E75",       // 대기중·성공
} as const;

/** 인게임 월드/카테고리 전용(UI 크롬 아님) — 안내판 틴트·오버레이 등에만. */
export const WORLD = {
  device: "#4A9DE0",   // 장치=파랑
  enemy: "#E24B4A",    // 적군=빨강
  item: "#F6BE00",     // 아이템=노랑
  terrain: "#43A047",
  dirt: "#8B5A2B",
} as const;

// 기존 화면 코드 호환(점진 교체) — 기존 키를 새 팔레트로 매핑.
export const COLORS = {
  buildYellow: YELLOW.base,
  skyBlue: WORLD.device,
  marioRed: SIGNAL.danger,
  terrainGreen: WORLD.terrain,
  dirtBrown: WORLD.dirt,
  ink: INK,
  inkSoft: INK_SOFT,
} as const;

/** 타일 격자 오버레이 — 노랑 대면적 위 은은한 흰 선. */
export const TILE_OVERLAY = "rgba(255,255,255,0.10)";

// 크기 토큰 — "유아틱하게 큼지막하게"(2026-07-14 지시). 색은 design/tokens(YELLOW/INK)에서 관리.
// 즉흥값 대신 여기서만 관리.
export const GAP = 12;
export const PAD = 16;

export const FONT_SM = 14;
export const FONT_MD = 17;

// 즐겨찾기 카드 — 정사각형(이미지 자리, 2026-07-14). 리사이즈 없음 — 접기(1줄)만.
// 좌측 창고 카드도 동일 크기(2026-07-15) — 최소 폭은 카드 1개가 여유 있게 보이는 정도까지만 줄어들게.
export const FAV_CARD_SIZE = 76;

export const LEFT_PANEL_MIN = FAV_CARD_SIZE + PAD * 2 + 20; // 카드 1개 + 여백 + 스크롤바 여유
export const LEFT_PANEL_MAX = 480;
export const LEFT_PANEL_COLLAPSED_WIDTH = 44;

export const TOOLBAR_WIDTH = 96;

export const FAV_HEADER_HEIGHT = 44; // 타이틀 텍스트 제거, 접기 버튼만
export const FAV_GROUP_PADDING = 16; // 그룹 박스 상하 패딩 합
/** 접힘(1줄) 상태 고정 높이 — 카드 한 줄이 잘리지 않고 온전히 들어가는 값 */
export const FAVORITES_ONE_ROW_HEIGHT = FAV_HEADER_HEIGHT + FAV_GROUP_PADDING + FAV_CARD_SIZE; // = 136

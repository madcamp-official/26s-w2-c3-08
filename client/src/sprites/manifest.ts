// 스프라이트 매니페스트 — "이 에셋의 액션별 시트가 어디 있고 몇 프레임인가"를 나타내는 단일 형태.
// 시스템 기본 에셋(DB 시드)이든 유저 제작 에셋(GPU 워커 생성)이든 서버 API(GET /api/assets/:id)가
// 항상 이 형태로 응답한다 — 로더는 출처를 몰라도 됨(§2026-07-16 설계).
import type { ActionName } from "shared/actions";

export interface SpriteSheetInfo {
  /** 서버 정적 서빙 상대 경로 (예: /storage/sprites/123.png). HTTP_BASE와 합쳐 절대 URL로 씀. */
  url: string;
  frameCount: number;
  frameW: number;
  frameH: number;
}

export interface AssetManifest {
  /** 캐시·텍스처 키 접두사로 쓰는 유일 식별자 (에셋 DB id 문자열). */
  key: string;
  category: string;
  /** 준비된 액션만 들어있다(생성 중/실패인 액션은 응답에서 빠짐) — 없는 액션은 폴백(§resolve). */
  actions: Partial<Record<ActionName, SpriteSheetInfo>>;
}

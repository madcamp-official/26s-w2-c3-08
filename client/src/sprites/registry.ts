// 매니페스트 레지스트리 — "게임 안 로컬 키(TESTMAP 몬스터 asset명·블록 물성·아이템 kind)" →
// 시스템 에셋 DB 이름 매핑 + fetch 결과 캐시(Promise 캐시라 동시 요청도 1회만 나감).
// 매핑이 없거나 404·시트 미준비면 null — 호출부는 폴백(사각형) 유지(§2026-07-16).
import { HTTP_BASE } from "../net/rest.js";
import type { AssetManifest } from "./manifest.js";

/**
 * 로컬 키 → 시스템 에셋 이름(server/src/seed/systemAssets.ts의 name과 일치해야 함).
 * 2026-07-16: 76개 실그림 에셋(server/src/seed 별도 시드) 중 근접 매칭 7개로 갱신.
 * spike/gate/platform/invincible/thwomp/chaser/shove/splitter는 대응 에셋 없음 → 매핑 없이 폴백 유지
 * (거짓 매칭 금지 — 크기·의미가 안 맞는 걸 억지로 붙이지 않음).
 */
const SYSTEM_NAME: Record<string, string> = {
  // 아바타
  avatar: "mario",
  // 몬스터 (TESTMAP asset명) — goomba만 정확히 일치, spiky는 매핑 없음(가시돌이 성격과 안 맞음 → 폴백)
  goomba: "goomba",
  // 아이템 (ItemKind)
  speed: "speed boost",
  sizeUp: "giant mushroom",
  // 블록 (TESTMAP 블록 성격별) — ground는 일반 블록 대표(물음표·파괴블록 등)라 brick block으로 대체
  ground: "brick block",
  spring: "spring",
  switch: "switch block (on)",
};

const cache = new Map<string, Promise<AssetManifest | null>>();

/** 로컬 키로 매니페스트 조회(캐시). 매핑 없음/실패/빈 매니페스트 → null. */
export function fetchManifestByKey(localKey: string): Promise<AssetManifest | null> {
  const name = SYSTEM_NAME[localKey];
  if (!name) return Promise.resolve(null);
  let p = cache.get(name);
  if (!p) {
    p = fetch(`${HTTP_BASE}/api/assets/by-name/${encodeURIComponent(name)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const m = (await res.json()) as AssetManifest;
        // ①액션시트 또는 ②원본 중 하나라도 있으면 통과 — 렌더 티어 판단은 stepSpriteView가 함.
        const hasActions = m.actions && Object.keys(m.actions).length > 0;
        return hasActions || m.sourceImage ? m : null;
      })
      .catch(() => null);
    cache.set(name, p);
  }
  return p;
}

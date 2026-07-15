// 매니페스트 레지스트리 — "게임 안 로컬 키(TESTMAP 몬스터 asset명·블록 물성·아이템 kind)" →
// 시스템 에셋 DB 이름 매핑 + fetch 결과 캐시(Promise 캐시라 동시 요청도 1회만 나감).
// 매핑이 없거나 404·시트 미준비면 null — 호출부는 폴백(사각형) 유지(§2026-07-16).
import { HTTP_BASE } from "../net/rest.js";
import type { AssetManifest } from "./manifest.js";

/** 로컬 키 → 시스템 에셋 이름(server/src/seed/systemAssets.ts의 name과 일치해야 함) */
const SYSTEM_NAME: Record<string, string> = {
  // 아바타
  avatar: "졸라맨",
  // 몬스터 (TESTMAP asset명) — 시드에 없는 것(thwomp/chaser/shove/splitter)은 매핑 없음 → 폴백
  goomba: "굼바",
  spiky: "가시돌이",
  // 아이템 (ItemKind) — 시드에 없는 것(invincible/hpUp 등)은 폴백
  speed: "가속",
  sizeUp: "거대버섯",
  // 블록 (TESTMAP 블록 성격별) — 대응 시드 에셋
  ground: "기본 땅",
  platform: "반통과 발판",
  spike: "가시",
  spring: "트램펄린",
  switch: "스위치",
  gate: "스위치 발판",
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
        return m.actions && Object.keys(m.actions).length > 0 ? m : null;
      })
      .catch(() => null);
    cache.set(name, p);
  }
  return p;
}

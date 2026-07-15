// 깃발·기단·커서 이미지 드롭인 로더 — client/public/mapeditor-assets/에 파일만 넣으면
// 코드 수정 없이 바로 반영(Vite가 public/을 그대로 서빙). 로드 전·실패 시엔 null → 호출부가
// 기존 벡터 드로잉으로 폴백(항상 폴백 가능 원칙, §sprites와 동일 철학).
import { HTTP_BASE } from "../../net/rest.js";

const BASE = "/mapeditor-assets";

export type ImageSlot = "flagStart" | "flagEnd" | "flagBase" | "cursor";

const FILE: Record<ImageSlot, string> = {
  flagStart: "flag-start.png",
  flagEnd: "flag-end.png",
  flagBase: "flag-base.png",
  cursor: "cursor.png",
};

const cache = new Map<ImageSlot, HTMLImageElement | null | undefined>();

/** 이미지 로드 시도(비동기, 결과는 캐시). 아직 로딩 중이거나 실패면 null. */
export function getSlotImage(slot: ImageSlot): HTMLImageElement | null {
  const cached = cache.get(slot);
  if (cached !== undefined) return cached ?? null;
  cache.set(slot, undefined); // 중복 로드 방지(로딩 중 표시)
  const img = new Image();
  img.onload = () => cache.set(slot, img);
  img.onerror = () => cache.set(slot, null);
  img.src = `${BASE}/${FILE[slot]}`;
  return null;
}

const assetCache = new Map<string, HTMLImageElement | null | undefined>();

/** 배치물 원본 그림(서버 상대경로, 예: /storage/sources/*.png) 로드·캐시. 실제 DB 에셋 렌더용. */
export function getAssetImage(relUrl: string): HTMLImageElement | null {
  const cached = assetCache.get(relUrl);
  if (cached !== undefined) return cached ?? null;
  assetCache.set(relUrl, undefined);
  const img = new Image();
  img.onload = () => assetCache.set(relUrl, img);
  img.onerror = () => assetCache.set(relUrl, null);
  img.src = `${HTTP_BASE}${relUrl}`;
  return null;
}

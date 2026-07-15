// 생성된 스프라이트 시트·소스 이미지 저장/서빙. 오브젝트 스토리지 도입 전 잠정: VM 로컬 디스크 + express.static.
// (임시방편입니다 — 스케일/영속성 필요 시 S3 등으로 교체. 지금은 단일 VM이라 로컬로 충분.)
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/** 시트 저장 루트 (env로 재정의 가능). 기본은 server/storage/sprites. */
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(process.cwd(), "storage", "sprites");

/** 업로드 소스(원본·정규화본) 저장 디렉터리 — 기본은 sprites의 형제 폴더(storage/sources). */
export const SOURCES_DIR = process.env.SOURCES_DIR
  ? path.resolve(process.env.SOURCES_DIR)
  : path.resolve(STORAGE_DIR, "..", "sources");

/** 정적 서빙 경로 프리픽스 — DB에는 이 상대경로로 저장(도메인 하드코딩 회피). */
export const STORAGE_URL_PREFIX = "/storage/sprites";
export const SOURCES_URL_PREFIX = "/storage/sources";

mkdirSync(STORAGE_DIR, { recursive: true });
mkdirSync(SOURCES_DIR, { recursive: true });

/** 시트 PNG를 저장하고 서빙용 상대 URL을 반환. */
export async function saveSheetPng(spriteId: string | bigint, png: Buffer): Promise<string> {
  const filename = `${spriteId}.png`;
  await writeFile(path.join(STORAGE_DIR, filename), png);
  return `${STORAGE_URL_PREFIX}/${filename}`;
}

/**
 * 소스 PNG(업로드 원본/정규화본)를 저장하고 서빙용 상대 URL 반환.
 * basename 유일성은 호출자가 보장(업로드: 랜덤 id, 워커 정규화본: <assetId>_norm).
 */
export async function saveSourcePng(basename: string, png: Buffer): Promise<string> {
  const filename = `${basename}.png`;
  await writeFile(path.join(SOURCES_DIR, filename), png);
  return `${SOURCES_URL_PREFIX}/${filename}`;
}

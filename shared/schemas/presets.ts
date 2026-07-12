// 공용 프리셋 enum — asset-attributes.md 서두 "수치 정책 (2026-07-10 확정)".
// 자유 수치 입력 없음: 전부 3단(일부 2단) 프리셋. 실제 물리값 매핑은 shared/constants.ts의 PRESET에서만.
import { z } from "zod";

/** 속도 n → slow / normal / fast */
export const Speed3 = z.enum(["slow", "normal", "fast"]);
export type Speed3 = z.infer<typeof Speed3>;

/** 주기 n → short / normal / long */
export const Period3 = z.enum(["short", "normal", "long"]);
export type Period3 = z.infer<typeof Period3>;

/** 감지 거리·반경 n → near / normal / far */
export const Range3 = z.enum(["near", "normal", "far"]);
export type Range3 = z.infer<typeof Range3>;

/** 반발력·도약 높이 n → low / high (원작 2단) */
export const Power2 = z.enum(["low", "high"]);
export type Power2 = z.infer<typeof Power2>;

/** 생명력 n → 1 / 2 / 3 */
export const Hp3 = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Hp3 = z.infer<typeof Hp3>;

/**
 * 예외 — 크기: 타일 단위 가로 n × 세로 m 수치 입력 허용 (md 서두 예외 조항).
 * 상한 4×4 확정(2026-07-12, md는 "상한 필요(예 1~8)"로만 열어둠 — 팀 확정치로 4 채택).
 */
export const SIZE_CELL_MAX = 4;
export const SizeCells = z.object({
  w: z.number().int().min(1).max(SIZE_CELL_MAX),
  h: z.number().int().min(1).max(SIZE_CELL_MAX),
});
export type SizeCells = z.infer<typeof SizeCells>;

/** 4면 플래그 — 충돌면(§1 충돌 방식)·감지면(§1 접촉 반응) 공용. Phaser checkCollision/touching과 1:1 */
export const Faces = z.object({
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
});
export type Faces = z.infer<typeof Faces>;

/** 감지면 기본값 = 상면만 (md §1: "원작 도넛 블록의 '밟으면'과 동일") */
export const FACES_TOP_ONLY: Faces = { up: true, down: false, left: false, right: false };
export const FACES_ALL: Faces = { up: true, down: true, left: true, right: true };

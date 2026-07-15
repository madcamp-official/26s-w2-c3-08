// attrs(에셋 속성) Zod 검증의 단일 소스 — 클라 폼 검증과 서버 저장 검증이 같은 정의를 사용 (architecture.md §2).
// 형식의 원본 명세: docs/KJH/asset-attributes.md. DB(Asset.attrs Json)는 그릇만, 강제는 여기서.
//
// ⚠️ 원칙: category는 Asset.category 컬럼이 단일 소스 — attrs JSON 안에 category를 중복 저장하지 않는다.
//   검증 시 parseAttrs(category, json)처럼 컬럼 값을 함께 넘긴다.
import { z } from "zod";
import { AvatarAttrs, defaultAvatarAttrs } from "./avatar.js";
import { BackgroundAttrs, defaultBackgroundAttrs } from "./background.js";
import { ItemAttrs } from "./item.js";
import { MonsterAttrs, defaultMonsterAttrs } from "./monster.js";
import { BlockAttrs, defaultBlockAttrs } from "./block.js";

export * from "./presets.js";
export * from "./block.js";
export * from "./monster.js";
export * from "./background.js";
export * from "./avatar.js";
export * from "./item.js";

/** Asset.category 허용 값 (schema.prisma 주석과 동일) */
export const CATEGORIES = ["avatar", "block", "monster", "background", "item"] as const;
export type Category = (typeof CATEGORIES)[number];

export const attrsSchemaByCategory = {
  avatar: AvatarAttrs,
  block: BlockAttrs,          // platform+obstacle 통합 (2026-07-14)
  monster: MonsterAttrs,
  background: BackgroundAttrs,
  item: ItemAttrs, // 시스템 전용 — 유저 제출 경로에서는 서버가 카테고리 자체를 거부해야 함
} as const;

export type AttrsByCategory = {
  avatar: AvatarAttrs;
  block: BlockAttrs;
  monster: MonsterAttrs;
  background: BackgroundAttrs;
  item: ItemAttrs;
};
export type AssetAttrs = AttrsByCategory[Category];

/** 저장/폼 검증 공용 진입점. 실패 시 ZodError throw (서버는 400으로 변환) */
export function parseAttrs<C extends Category>(category: C, json: unknown): AttrsByCategory[C] {
  const schema = attrsSchemaByCategory[category];
  return schema.parse(json) as AttrsByCategory[C];
}

/** 스튜디오 폼 초기값 팩토리 (유저 제작 4종만 — item은 시스템 시드에서 직접 구성) */
export const defaultAttrsByCategory = {
  avatar: defaultAvatarAttrs,
  block: defaultBlockAttrs,
  monster: defaultMonsterAttrs,
  background: defaultBackgroundAttrs,
} as const;

/**
 * attrs → DB 조회용 미러 컬럼 산출.
 * Asset.colliderType / slopeDir / widthCells / heightCells 컬럼은 에디터 배치·조회 편의용 미러이며
 * 원본은 attrs다. 서버는 저장 시 반드시 이 함수로 컬럼을 동기화한다 (이중 기입 금지).
 */
export function deriveColumnMirror(
  category: Category,
  attrs: AssetAttrs,
): { colliderType: "rect" | "slope" | "none"; slopeDir: string | null; widthCells: number | null; heightCells: number | null } {
  if (category === "avatar") {
    // 아바타는 1×2 고정 — 컬럼 NULL (schema.prisma 주석)
    return { colliderType: "rect", slopeDir: null, widthCells: null, heightCells: null };
  }
  if (category === "background") {
    const a = attrs as BackgroundAttrs;
    return { colliderType: "none", slopeDir: null, widthCells: a.size.w, heightCells: a.size.h };
  }
  if (category === "block") {
    const a = attrs as BlockAttrs;
    return {
      colliderType: a.collision.type === "none" ? "none" : a.shape.type === "slope" ? "slope" : "rect",
      slopeDir: a.shape.type === "slope" ? a.shape.dir : null,
      widthCells: a.size.w,
      heightCells: a.size.h,
    };
  }
  const a = attrs as MonsterAttrs | ItemAttrs;
  const size = "size" in a ? a.size : { w: 1, h: 1 };
  return { colliderType: "rect", slopeDir: null, widthCells: size.w, heightCells: size.h };
}

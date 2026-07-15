// 에셋 제출 → 액션 파생 → AssetSprite 잡 큐 적재. (архив: sprite-pipeline-next.md §B)
//
// 흐름: submitAsset()가 Asset 1행 + deriveActions로 정해진 액션마다 AssetSprite(status=queued) N행을 만든다.
//   prompt 컬럼은 여기선 비운다(NULL) — 3090 Qwen 확장(§C) 전까지는 워커/오케스트레이터 쪽에서 채운다.
//   (백엔드가 적재 시 LLM을 직접 부르는 안도 있으나, VPN 단일세션·Qwen 미확장이라 골격에선 보류.)
import { type Category, parseAttrs, deriveColumnMirror } from "shared/schemas";
import { deriveActions } from "shared/actions";
import { prisma } from "../prisma.js";

export interface SubmitAssetInput {
  creatorId?: bigint | null;
  category: Category;
  name: string;
  description?: string | null;
  /** 검증 전 원본 attrs(JSON). parseAttrs로 카테고리 스키마 검증. */
  attrs: unknown;
  sourceImageUrl: string;
  /** "drawn"(캔버스, 투명 보장) | "uploaded"(파일 업로드 — 배경 분리 필요할 수 있음). 기본 drawn */
  sourceType?: "drawn" | "uploaded";
  /** uploaded 원본 보존 URL (upload-source 응답의 rawUrl) */
  rawSourceUrl?: string | null;
  /** 서버 flood-fill이 즉시 성공한 정규화본 URL (upload-source 응답의 normUrl) */
  normSourceUrl?: string | null;
  isSystem?: boolean;
}

/**
 * 에셋을 만들고 생성 큐에 적재한다.
 * - attrs는 parseAttrs(category, ...)로 강제 검증 (실패 시 ZodError throw → 라우터가 400).
 * - deriveActions(category, attrs)가 만들 액션 세트를 결정 → 액션당 AssetSprite(queued) 1행.
 * - 미러 컬럼(colliderType/slopeDir/widthCells/heightCells)은 deriveColumnMirror로 동기화.
 */
export async function submitAsset(input: SubmitAssetInput) {
  const attrs = parseAttrs(input.category, input.attrs); // throws ZodError on invalid
  const mirror = deriveColumnMirror(input.category, attrs);
  const actions = deriveActions(input.category, attrs);

  return prisma.asset.create({
    data: {
      creatorId: input.creatorId ?? null,
      isSystem: input.isSystem ?? false,
      category: input.category,
      name: input.name,
      description: input.description ?? null,
      attrs: attrs as object,
      colliderType: mirror.colliderType,
      slopeDir: mirror.slopeDir,
      widthCells: mirror.widthCells,
      heightCells: mirror.heightCells,
      sourceImageUrl: input.sourceImageUrl,
      sourceType: input.sourceType ?? "drawn",
      rawSourceUrl: input.rawSourceUrl ?? null,
      normSourceUrl: input.normSourceUrl ?? null,
      status: "generating",
      sprites: {
        create: actions.map((a, i) => ({
          action: a.name,
          // motionHint는 잡 페이로드로 워커에 전달할 때 다시 계산(deriveActions)하거나,
          // Qwen 확장 후 prompt에 실어둔다. 골격 단계에선 prompt=NULL.
          status: "queued",
          priority: i === 0 ? 10 : 0, // idle(첫 항목) 먼저 — 미리보기 빨리 뜨게
        })),
      },
    },
    include: { sprites: true },
  });
}

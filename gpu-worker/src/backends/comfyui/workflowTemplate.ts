// ComfyUI 워크플로우를 "외부 JSON + 제목 기반 주입"으로 다룬다 (config/comfyui/README.md 참조).
// 코드는 노드 id를 모른다 — _meta.title로 주입 지점을 찾으므로, ComfyUI UI에서 재export해도 제목만
// 유지되면 안 깨진다. 그래프 구조·튜닝값은 전부 JSON에서 편집.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}
export type ComfyWorkflow = Record<string, ComfyNode>;

/** 코드가 값을 꽂는 노드 제목들 — README 표와 1:1. 오타 방지용 상수 */
export const WF_TITLE = {
  inputImage: "INPUT_IMAGE",
  positive: "POSITIVE_PROMPT",
  negative: "NEGATIVE_PROMPT",
  videoSize: "VIDEO_SIZE",
  samplerHigh: "SAMPLER_HIGH",
  samplerLow: "SAMPLER_LOW",
  unetHigh: "UNET_HIGH",
  unetLow: "UNET_LOW",
  loraHigh: "LORA_HIGH",
  loraLow: "LORA_LOW",
  output: "OUTPUT",
} as const;

const DEFAULT_WORKFLOW_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "config",
  "comfyui",
  "workflow.i2v.json",
);

export function loadWorkflow(workflowPath: string = DEFAULT_WORKFLOW_PATH): ComfyWorkflow {
  return JSON.parse(readFileSync(workflowPath, "utf-8")) as ComfyWorkflow;
}

export type TitleOverrides = Record<string, Record<string, unknown>>;

/**
 * 제목이 일치하는 노드의 inputs에 override를 병합한 새 워크플로우 반환(원본 불변).
 * override에 명시한 제목이 워크플로우에 없으면 즉시 에러 — 오타/구조 변경을 조용히 넘기지 않는다.
 */
export function applyOverridesByTitle(wf: ComfyWorkflow, overrides: TitleOverrides): ComfyWorkflow {
  const clone = structuredClone(wf);
  const remaining = new Set(Object.keys(overrides));
  for (const node of Object.values(clone)) {
    const title = node._meta?.title;
    if (title && overrides[title]) {
      Object.assign(node.inputs, overrides[title]);
      remaining.delete(title);
    }
  }
  if (remaining.size > 0) {
    throw new Error(`workflow has no node(s) titled: ${[...remaining].join(", ")}`);
  }
  return clone;
}

/** 제목으로 노드 id를 찾음 (결과 프레임 추출 시 OUTPUT 노드 id 필요) */
export function findNodeIdByTitle(wf: ComfyWorkflow, title: string): string | null {
  for (const [id, node] of Object.entries(wf)) {
    if (node._meta?.title === title) return id;
  }
  return null;
}

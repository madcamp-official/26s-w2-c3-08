// 최종 wan 프롬프트 조립 (방식 A: 외형은 LLM이 1회, 모션·안정화는 워커가 액션별로 얹음).
// catalog.ts 계약: [외형(wan_prompt)] + [motionHint] + [poseHint] + [공통 안정화] + [크로마키 배경].
import { pipelineConfig } from "../config/index.js";

/** LLM(또는 스텁)이 준 에셋 외형 — 액션 무관, 재사용됨 */
export interface Appearance {
  wanPrompt: string;
  wanNegativePrompt: string;
}

/** 한 액션의 모션 요구 (shared/actions ActionSpec에서 옴, 잡 페이로드로 전달) */
export interface ActionMotion {
  motionHint: string;
  poseHint?: string | null;
  negativeExtra?: string[];
}

export interface AssembledPrompt {
  positive: string;
  negative: string;
}

/**
 * 양성 = [외형] + [모션] + [자세] + [안정화(배경색 치환)].
 * 음성 = [외형 네거티브] + [공통 네거티브] + [액션 네거티브].
 * @param chromaColorName 자동 선택된 크로마키 색 이름(예: "green") — 안정화 문구 {bg}에 치환.
 */
export function assemblePrompt(
  appearance: Appearance,
  motion: ActionMotion,
  chromaColorName: string,
): AssembledPrompt {
  const cfg = pipelineConfig.prompt;
  const stabilization = cfg.stabilizationPositive.replaceAll("{bg}", chromaColorName);

  const positive = [appearance.wanPrompt, motion.motionHint, motion.poseHint ?? "", stabilization]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  const negative = [appearance.wanNegativePrompt, cfg.baseNegative, ...(motion.negativeExtra ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  return { positive, negative };
}

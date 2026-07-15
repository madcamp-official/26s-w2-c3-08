// 파이프라인 조정값의 단일 소스 — 실측 전 잠정값 전부 여기(config/pipeline.json)로 모음.
// 숫자만 바꿔야 할 때 TypeScript를 안 건드리도록 분리. zod로 검증해 오타·범위 실수를 로드 시점에 잡는다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "hex color must be #RRGGBB");

const PipelineConfigSchema = z.object({
  bbox: z.object({
    /** alpha > 이 값인 픽셀만 불투명으로 취급 (0~255) */
    alphaThreshold: z.number().int().min(0).max(255),
    /** 전체 불투명 면적 대비 이 비율 미만인 연결요소는 노이즈로 무시 */
    noiseCutoffRatio: z.number().min(0).max(1),
  }),
  anatomy: z.object({
    /** alpha > 이 값인 픽셀만 불투명(실루엣)으로 취급 (0~255) */
    alphaThreshold: z.number().int().min(0).max(255),
    /** 골격 끝점이 몸 중심(root)에서 이 비율(bbox 대각선 대비) 이상 떨어져야 "사지 후보"로 본다 */
    minReachRatio: z.number().min(0).max(1),
    /** 끝점의 뻗은 방향을 잴 때 골격을 거슬러 올라갈 걸음 수(픽셀 단위, 경로가 짧으면 자동 축소) */
    directionTracebackSteps: z.number().int().positive(),
    /** 끝점의 bbox 내 상대 y가 이 값 미만이면서 수평 방향으로 뻗었으면 팔 후보 */
    armYThreshold: z.number().min(0).max(1),
    /** 끝점의 bbox 내 상대 y가 이 값 초과면서 수직 방향으로 뻗었으면 다리 후보 */
    legYThreshold: z.number().min(0).max(1),
  }),
  chromaKey: z.object({
    /** 정규화 거리(0~1) 이하면 "배경과 같은 색"으로 flood fill 대상 */
    colorDistanceThreshold: z.number().min(0).max(1),
    /** 테두리 배경색 추정에 사용할 바깥 밴드 두께(px) */
    borderBandPx: z.number().int().positive(),
    /** 디스필(경계 잔여 키색 기운 제거) 수행 여부 */
    despill: z.boolean(),
    /** 프레임 테두리 색 분산이 이 값(정규화)을 넘으면 "단색 배경 아님"으로 의심 */
    failVarianceThreshold: z.number().min(0).max(1),
    /** 의심 프레임 비율이 이 값을 넘으면 이 액션 생성 자체를 실패 처리 */
    failFrameRatio: z.number().min(0).max(1),
    /** 갇힌-배경 회수를 켤 최소 margin(정규화 RGB, 키색-캐릭터 거리). 이하이면 회수 off(색색 캐릭터 보호) */
    enclosedReclaimMarginGate: z.number().min(0).max(1),
    /** 회수 임계 상한 — margin이 커도 이 값 넘게 공격적으로는 안 지움(캐릭터 경계 보호) */
    enclosedReclaimMaxThreshold: z.number().min(0).max(1),
    /** 회수 임계 = min(상한, margin × 이 비율). margin에 비례해 자동 조정 */
    enclosedReclaimMarginFrac: z.number().min(0).max(1),
    /** 키 색 자동 선택 후보 — 그림 색과 HSV 거리가 가장 먼 것 채택 */
    candidates: z.array(z.object({ name: z.string(), hex: HexColor })).min(1),
  }),
  anchor: z.object({
    /** 바닥-중앙 앵커링 시 발이 닿을 세로 위치(캔버스 높이 비율, 0~1) */
    baselineYRatio: z.number().min(0).max(1),
    /**
     * 앵커 보정 강도(0~1). 1이면 매 프레임 발 위치를 기준점에 완전 스냅(로봇처럼 뻣뻣),
     * <1이면 그 비율만큼만 당겨 자연스러운 미세 흔들림을 남긴다(부분보간).
     * 잠정 0.75 — 5080 실측으로 조정 필요.
     */
    lerp: z.number().min(0).max(1),
  }),
  scaleNormalization: z.object({
    /** idle 기준 키 대비 프레임별 허용 편차 — 이 이상만 클램프해서 당김(완전 스냅 아님) */
    perFrameClampRatio: z.number().min(0).max(1),
    /**
     * 밴드 밖 프레임을 밴드 경계까지 당기는 강도(0~1). 1이면 경계까지 완전 스냅,
     * <1이면 그 비율만큼만 당겨 급격한 크기 변화 튐을 완화(부분보간). 잠정 0.75 — 5080 실측.
     */
    lerp: z.number().min(0).max(1),
  }),
  generation: z.object({
    resolution: z.object({
      /** 최종 타일 픽셀 크기(긴 변) 대비 이 배수 이상으로 생성 — 그대로면 품질 급락(ai-pipeline.md 실측) */
      upscaleFactor: z.number().min(1),
      /** 작은 에셋도 최소 이 긴변 이상으로 생성 (품질 하한선) */
      minGenLongPx: z.number().int().positive(),
      /** 큰 에셋(다타일)이 배수 적용으로 너무 커지지 않도록 하는 VRAM/시간 상한 */
      maxGenLongPx: z.number().int().positive(),
      /** Wan2.2 VAE 요구사항 — 이 배수로 반올림 */
      roundToMultiple: z.number().int().positive(),
      /** 극단적 종횡비 방지용 최소 변 길이 */
      minSidePx: z.number().int().positive(),
    }),
    /**
     * 생성 길이·fps — 액션 이름 하나하나 나열하지 않고 "반복 재생되는가(loop)"로 분기한다.
     * 앞으로 액션이 아무리 늘어나도(shared/actions/catalog.ts) 이 두 버킷 + 예외(overrides)만으로
     * 커버됨 — walk/fly/climb 등 사이클성 동작은 loop, onair/attack처럼 1회성은 oneShot.
     * overrides는 정말 예외적인 경우(예: idle은 walk보다 짧아도 됨)에만 개별 지정.
     */
    duration: z.object({
      loop: z.object({ durationSec: z.number().positive(), fps: z.number().positive() }),
      oneShot: z.object({ durationSec: z.number().positive(), fps: z.number().positive() }),
      overrides: z.record(z.string(), z.object({ durationSec: z.number().positive(), fps: z.number().positive() })),
    }),
    model: z.object({
      variant: z.enum(["gguf-q5", "fp8-scaled"]),
      highNoiseCheckpoint: z.string().min(1),
      lowNoiseCheckpoint: z.string().min(1),
      lightningLora: z.object({ high: z.string().min(1), low: z.string().min(1) }),
      steps: z.number().int().positive(),
      cfg: z.number().positive(),
    }),
  }),
  /**
   * 최종 프롬프트 조립의 고정 부분(액션 무관). 오케스트레이터가
   * [외형(LLM)] + [motionHint] + [poseHint] + [stabilizationPositive] 로 양성 프롬프트를,
   * [baseNegative] + [액션 negativeExtra] 로 음성 프롬프트를 만든다.
   * {bg}는 자동 선택된 크로마키 색 이름으로 치환 — 배경 단색 유지를 프롬프트로도 강화(키잉 안정).
   * ⚠️ 실제 문구는 5080 실측으로 조정. 특히 "side view" 강제 여부는 시작이미지(정면 그림)와 충돌 가능해 기본은 넣지 않음.
   */
  prompt: z.object({
    stabilizationPositive: z.string().min(1),
    baseNegative: z.string().min(1),
  }),
  loopSelection: z.object({
    algorithm: z.enum(["phash", "mse"]),
  }),
  output: z.object({
    frameCount: z.number().int().positive(),
    tilePx: z.number().int().positive(),
  }),
  network: z.object({
    /** 백엔드 GET/POST 짧은 호출(잡 claim·fail 보고) 타임아웃 */
    serverRequestTimeoutMs: z.number().int().positive(),
    /** 시트 업로드(postResult) — 페이로드 커서 더 넉넉히 */
    serverUploadTimeoutMs: z.number().int().positive(),
    /** ComfyUI 헬스체크 — 죽어있으면 즉시 알아채야 하므로 짧게 */
    comfyHealthTimeoutMs: z.number().int().positive(),
    /** ComfyUI 짧은 호출(업로드·큐잉·view) 타임아웃 */
    comfyRequestTimeoutMs: z.number().int().positive(),
    /** /history 폴링 1회 호출 타임아웃(전체 상한은 backend.generateTimeoutMs가 별도 관리) */
    comfyPollRequestTimeoutMs: z.number().int().positive(),
  }),
  llmGateway: z.object({
    /** 게이트웨이 QWEN_MAX_CONCURRENCY와 반드시 맞출 것 (실측 전 잠정값) */
    maxConcurrency: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    maxRetries: z.number().int().nonnegative(),
    retryBaseDelayMs: z.number().int().positive(),
  }),
});
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

const DEFAULT_CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "config",
  "pipeline.json",
);

export function loadPipelineConfig(configPath: string = DEFAULT_CONFIG_PATH): PipelineConfig {
  const raw = readFileSync(configPath, "utf-8");
  return PipelineConfigSchema.parse(JSON.parse(raw));
}

/** 대부분의 호출부는 이 싱글턴만 import해서 쓰면 됨 */
export const pipelineConfig = loadPipelineConfig();

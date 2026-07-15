// 파이프라인 공용 자료형 — 후처리 stage들이 주고받는 프레임/컨텍스트.
// 확장 원칙: stage는 이 컨텍스트만 읽고 쓴다. stage 추가 = 새 파일 + 배열에 한 줄, 기존 코드 무수정.
import type { Category } from "shared/schemas";
import type { PipelineConfig } from "../config/index.js";

/** 픽셀 단위 접근이 필요한 stage(크로마키·bbox)를 위한 raw RGBA 프레임. data 길이 = w*h*4 */
export interface RgbaFrame {
  width: number;
  height: number;
  /** RGBA, row-major, 0~255 */
  data: Uint8ClampedArray;
}

/** 축 정렬 경계 상자 (bbox stage 산출) */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 한 액션(=한 잡)에 대한 파이프라인 입력. 잡 출처(local/server)가 이 형태로 정규화해서 넘긴다. */
export interface AssetJob {
  jobId: string;
  category: Category;
  action: string;
  /** 반복 재생 동작인지 (shared/actions derive 결과) — 생성 길이·루프 처리 분기 */
  loop: boolean;
  /** 원본 raw 클립 시작에서 건너뛸 프레임 수(ActionSpec.skipLeadFrames) — loop-select 전에 적용 */
  skipLeadFrames: number;
  tilesW: number;
  tilesH: number;
  /** 정규화된 투명 배경 원본 PNG (Stage 1 완료본) */
  sourceImagePng: Buffer;
  /** LLM 게이트웨이가 준 최종 프롬프트 — 우리가 조립하지 않고 그대로 사용 */
  wanPrompt: string;
  wanNegativePrompt: string;
  /** 자동 선택된 크로마키 키색 (#RRGGBB) */
  chromaKeyHex: string;
  /** 키색과 그림 색 간 최소 정규화 RGB 거리(0~1). 크로마키 갇힌-배경 회수의 margin 게이트용 */
  chromaMargin: number;
}

/**
 * stage 간 전달 컨텍스트. `frames`는 대부분의 stage가 변형하는 작업 버퍼,
 * `scratch`는 stage가 서로에게 남기는 자유 주석(예: 앵커 기준 좌표, idle 기준 키 높이).
 * 타입 안전이 필요한 교차참조는 scratch 대신 명시 필드로 승격할 것.
 */
export interface PipelineContext {
  readonly job: AssetJob;
  readonly config: PipelineConfig;
  frames: RgbaFrame[];
  /** stage 간 공유 메타 — 키는 stage 이름으로 네임스페이스 권장 */
  scratch: Map<string, unknown>;
  log: StageLogger;
}

export interface StageLogger {
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
}

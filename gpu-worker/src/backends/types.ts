// 생성 백엔드 인터페이스 — "start_image + 프롬프트 → 프레임들"을 추상화.
// 확장 원칙: ComfyUI+Wan2.2는 이 인터페이스의 한 구현일 뿐. 다른 모델·다른 서버로 교체 가능하도록
// 파이프라인은 이 인터페이스에만 의존한다. 백엔드 선택은 config/env로.
import type { RgbaFrame } from "../pipeline/types.js";

export interface GenerationRequest {
  /** 크로마키 배경 위에 합성된 RGB 시작 이미지 (Stage 3 결과) */
  startImagePng: Buffer;
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  positivePrompt: string;
  negativePrompt: string;
  /** 재현·디버깅용 시드. 미지정 시 백엔드가 랜덤 */
  seed?: number;
}

export interface GenerationBackend {
  /** 로깅·선택용 식별자 (예: "comfyui-wan2.2-i2v") */
  readonly id: string;
  /** 서버 가용성 사전 점검 (모델 로드 여부 등) — 잡 시작 전 1회 */
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
  /** raw 프레임(크로마키 배경 유지, 아직 후처리 전)들을 반환 */
  generate(req: GenerationRequest): Promise<RgbaFrame[]>;
}

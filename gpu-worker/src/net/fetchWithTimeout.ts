// 공용 fetch 타임아웃 래퍼 — 워커의 모든 외부 HTTP 호출(백엔드·ComfyUI)이 이걸 거친다.
// AbortController 없는 평범한 fetch는 연결이 반쯤 죽은 채(half-open) 걸리면 응답도 에러도 없이
// 영원히 안 끝난다 — 2026-07-15 5080 실측: 터널이 한 번 흔들린 뒤 워커가 10분+ 멈춤(healthCheck의
// 무제한 fetch에서 걸림). LLM 게이트웨이 클라이언트(gatewayClient.ts)는 이미 자체 AbortController로
// 이 문제가 없었다 — 그 패턴을 공용화한 것.
export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`fetch timed out after ${timeoutMs}ms: ${url}`);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new FetchTimeoutError(url, timeoutMs);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

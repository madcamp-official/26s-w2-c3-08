// REST 클라이언트 — x-user-token 헤더 자동 부착. HTTP_BASE 도출은 devconsole 명령들과 동일 패턴.
import { useSessionStore } from "../store/session.js";

export const HTTP_BASE: string = (() => {
  const ws = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/$/, "");
  return `${location.protocol}//${location.hostname}:2567`;
})();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 서버 무응답 시 무한 대기(커튼 멈춤) 방지 — 이 시간(ms) 넘으면 abort→에러. */
const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useSessionStore.getState().token;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${HTTP_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-user-token": token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(0, "서버 응답 없음(타임아웃) — 백엔드가 실행 중인지 확인하세요");
    }
    throw new ApiError(0, "서버에 연결할 수 없습니다");
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};

/** 임의 토큰으로 GET /api/me 검증 — 계정 연동(설정에서 다른 토큰 입력) 전용, 현재 세션 토큰과 무관 */
export async function verifyToken<T>(token: string): Promise<T> {
  const res = await fetch(`${HTTP_BASE}/api/me`, { headers: { "x-user-token": token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

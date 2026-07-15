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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useSessionStore.getState().token;
  const res = await fetch(`${HTTP_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-user-token": token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

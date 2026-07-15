// S1. 로그인 — 세션(토큰) 유무에 따라 두 모드.
// 세션 있음: 닉네임 미리 채워짐(읽기전용) + "시작하기" — API 호출 없이 바로 진입.
// 세션 없음: 닉네임 직접 입력 + "새로 시작하기" — 신규 계정 생성.
import { useState } from "react";
import { COLORS } from "../../design/tokens/index.js";
import { TileTexture, SpringButton } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { api, ApiError } from "../../net/rest.js";

interface SessionResponse { userId: string; token: string; nickname: string }

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const existingToken = useSessionStore((s) => s.token);
  const existingNickname = useSessionStore((s) => s.nickname);
  const hasSession = !!existingToken;

  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();
  const setSession = useSessionStore((s) => s.setSession);

  const displayValue = hasSession ? (existingNickname ?? "") : nickname;
  const valid = hasSession || (nickname.trim().length >= 1 && nickname.trim().length <= 12);

  const submit = () => {
    if (!valid) return;
    setError(null);

    if (hasSession) {
      // 이미 검증된 세션 — API 호출 없이 커튼만 재생하고 바로 진입
      void trigger(async () => { onDone(); }).catch(() => {});
      return;
    }

    void trigger(async () => {
      const res = await api.post<SessionResponse>("/api/session", { nickname: nickname.trim() });
      setSession({ token: res.token, userId: res.userId, nickname: res.nickname, avatarAssetId: null, avatar: null });
      onDone();
    }).catch((e) => setError(e instanceof ApiError ? e.message : "로그인 실패"));
  };

  return (
    <div className="dsScreen">
      <TileTexture />
      <div style={{
        position: "relative", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24, minHeight: "100vh",
      }}>
        <h1 className="dsPointFont" style={{ fontSize: 40, color: COLORS.buildYellow, margin: 0 }}>
          게임 제목
        </h1>
        <input
          value={displayValue}
          onChange={(e) => !hasSession && setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="닉네임 (1~12자)"
          maxLength={12}
          readOnly={hasSession}
          style={{
            padding: "12px 16px", borderRadius: 8, border: "none", fontSize: 16,
            width: 240, textAlign: "center", fontFamily: "var(--font-body)",
            background: hasSession ? "#e5e5e5" : "#fff", color: hasSession ? "#666" : "#111",
            cursor: hasSession ? "default" : "text",
          }}
        />
        {error && <p style={{ color: COLORS.marioRed, margin: 0 }}>{error}</p>}
        <SpringButton ref={ref} onClick={submit} disabled={!valid}>
          {hasSession ? "시작하기" : "새로 시작하기"}
        </SpringButton>
      </div>
    </div>
  );
}

// S1. 로그인 — 닉네임 1필드 + [시작하기]. 성공 시 토큰 저장 후 메인으로.
import { useState } from "react";
import { COLORS } from "../../design/tokens/index.js";
import { TileTexture, SpringButton } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { api, ApiError } from "../../net/rest.js";

interface SessionResponse { userId: string; token: string; nickname: string }

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();
  const setSession = useSessionStore((s) => s.setSession);

  const valid = nickname.trim().length >= 1 && nickname.trim().length <= 12;

  const submit = () => {
    if (!valid) return;
    setError(null);
    void trigger(async () => {
      const res = await api.post<SessionResponse>("/api/session", { nickname: nickname.trim() });
      setSession({ token: res.token, userId: res.userId, nickname: res.nickname, avatarAssetId: null, avatar: null });
      onDone();
    }).catch((e) => setError(e instanceof ApiError ? e.message : "로그인 실패"));
  };

  return (
    <div className="dsScreen" style={{ background: `linear-gradient(180deg, ${COLORS.skyBlue}, #1c3a5e)` }}>
      <TileTexture />
      <div style={{
        position: "relative", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24, minHeight: "100vh",
      }}>
        <h1 className="dsPointFont" style={{ fontSize: 40, color: COLORS.buildYellow, margin: 0 }}>
          게임 제목
        </h1>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="닉네임 (1~12자)"
          maxLength={12}
          style={{
            padding: "12px 16px", borderRadius: 8, border: "none", fontSize: 16,
            width: 240, textAlign: "center", fontFamily: "var(--font-body)",
          }}
        />
        {error && <p style={{ color: COLORS.marioRed, margin: 0 }}>{error}</p>}
        <SpringButton ref={ref} onClick={submit} disabled={!valid}>
          시작하기
        </SpringButton>
      </div>
    </div>
  );
}

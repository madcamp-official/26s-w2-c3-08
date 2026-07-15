// S1. 로그인 — 세션(토큰) 유무에 따라 두 모드.
// 세션 있음: 닉네임 미리 채워짐(읽기전용) + "시작하기" — API 호출 없이 바로 진입.
// 세션 없음: 닉네임 직접 입력 + "새로 시작하기" — 신규 계정 생성.
import { useState } from "react";
import { YELLOW, INK, INK_SOFT, SIGNAL } from "../../design/tokens/index.js";
import { SketchButton, SketchBox } from "../../design/sketch/index.js";
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
    <div className="dsScreen" style={{ background: YELLOW.list }}>
      <div style={{
        position: "relative", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 28, minHeight: "100vh",
      }}>
        <h1 className="dsPointFont" style={{ fontSize: 44, color: INK, margin: 0 }}>
          게임 제목
        </h1>
        {/* 닉네임 입력 — 손그림 테두리 상자 안에 투명 input */}
        <SketchBox fill={YELLOW.card} stroke={INK} radius={12} preset="chip" style={{ width: 280, height: 56 }}>
          <input
            value={displayValue}
            onChange={(e) => !hasSession && setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="닉네임 (1~12자)"
            maxLength={12}
            readOnly={hasSession}
            style={{
              width: "82%", border: "none", outline: "none", background: "transparent",
              fontSize: 16, textAlign: "center", fontFamily: "var(--font-body)",
              color: hasSession ? INK_SOFT : INK, cursor: hasSession ? "default" : "text",
            }}
          />
        </SketchBox>
        {error && <p style={{ color: SIGNAL.danger, margin: 0 }}>{error}</p>}
        <div style={{ width: 280, height: 64 }}>
          <SketchButton ref={ref} onClick={submit} disabled={!valid}>
            {hasSession ? "시작하기" : "새로 시작하기"}
          </SketchButton>
        </div>
      </div>
    </div>
  );
}

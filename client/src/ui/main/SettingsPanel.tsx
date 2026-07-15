// S2c. 설정 모달 — 닉네임 변경 + 볼륨 + 계정 연동(토큰 보기/복사/다른 토큰으로 전환).
import { useState } from "react";
import { SpringPanel, SpringButton } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { api, verifyToken, ApiError } from "../../net/rest.js";
import { getAudioSettings, setSfxVolume, setBgmVolume, setMuted } from "../../audio/settings.js";

interface MeResponse {
  userId: string; nickname: string; avatarAssetId: string | null;
  avatar: { id: string; name: string; status: string } | null;
}

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const token = useSessionStore((s) => s.token);
  const nickname = useSessionStore((s) => s.nickname);
  const setSession = useSessionStore((s) => s.setSession);
  const userId = useSessionStore((s) => s.userId);
  const avatarAssetId = useSessionStore((s) => s.avatarAssetId);
  const avatar = useSessionStore((s) => s.avatar);
  const [nameInput, setNameInput] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkToken, setLinkToken] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const { ref: linkRef, trigger: triggerLink } = useMorphTransition<HTMLButtonElement>();
  const audio = getAudioSettings();

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 1 || trimmed.length > 12 || trimmed === nickname) return;
    setSaving(true); setError(null);
    try {
      await api.patch("/api/me", { nickname: trimmed });
      setSession({ userId: userId!, nickname: trimmed, avatarAssetId, avatar });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "변경 실패");
    } finally {
      setSaving(false);
    }
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const linkAccount = () => {
    const t = linkToken.trim();
    if (!t) return;
    setLinkError(null);
    void triggerLink(async () => {
      try {
        const me = await verifyToken<MeResponse>(t);
        setSession({ token: t, userId: me.userId, nickname: me.nickname, avatarAssetId: me.avatarAssetId, avatar: me.avatar });
        setLinkToken("");
        onClose();
      } catch (e) {
        setLinkError(e instanceof ApiError ? "유효하지 않은 토큰입니다" : "연동 실패");
      }
    }).catch(() => {});
  };

  return (
    <SpringPanel open={open} onClose={onClose} title="설정">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, opacity: 0.8 }}>닉네임</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={12}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none" }}
            />
            <button onClick={saveName} disabled={saving} style={{ padding: "8px 14px", borderRadius: 6, border: "none" }}>
              변경
            </button>
          </div>
          {error && <p style={{ color: "#E52521", fontSize: 12 }}>{error}</p>}
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, opacity: 0.8 }}>효과음 볼륨</label>
          <input type="range" min={0} max={1} step={0.01} defaultValue={audio.sfxVolume}
            onChange={(e) => setSfxVolume(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, opacity: 0.8 }}>배경음 볼륨</label>
          <input type="range" min={0} max={1} step={0.01} defaultValue={audio.bgmVolume}
            onChange={(e) => setBgmVolume(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" defaultChecked={audio.muted} onChange={(e) => setMuted(e.target.checked)} />
          음소거
        </label>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.15)", margin: 0 }} />

        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, opacity: 0.8 }}>내 토큰(다른 기기에서 이 계정으로 연동할 때 사용)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={token ?? ""} readOnly
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", fontFamily: "monospace", fontSize: 12, background: "#e5e5e5", color: "#333" }}
            />
            <button onClick={copyToken} style={{ padding: "8px 14px", borderRadius: 6, border: "none" }}>
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, opacity: 0.8 }}>토큰으로 계정 연동</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={linkToken} onChange={(e) => setLinkToken(e.target.value)}
              placeholder="다른 계정의 토큰 붙여넣기"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", fontFamily: "monospace", fontSize: 12 }}
            />
            <SpringButton ref={linkRef} variant="ghost" onClick={linkAccount} disabled={!linkToken.trim()} style={{ padding: "8px 14px", fontSize: 13, minWidth: "auto" }}>
              연동
            </SpringButton>
          </div>
          {linkError && <p style={{ color: "#E52521", fontSize: 12 }}>{linkError}</p>}
        </div>
      </div>
    </SpringPanel>
  );
}

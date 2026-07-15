// S2c. 설정 모달 — 닉네임 변경 + 볼륨 + 계정 연동(토큰 보기/복사/다른 토큰으로 전환). 손그림 재도장.
import { useState } from "react";
import { YELLOW, INK, INK_SOFT, SIGNAL } from "../../design/tokens/index.js";
import { SketchPanel, SketchButton } from "../../design/sketch/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { api, verifyToken, ApiError } from "../../net/rest.js";
import { getAudioSettings, setSfxVolume, setBgmVolume, setMuted } from "../../audio/settings.js";

interface MeResponse {
  userId: string; nickname: string; avatarAssetId: string | null;
  avatar: { id: string; name: string; status: string } | null;
}

const field: React.CSSProperties = {
  flex: 1, padding: "9px 13px", borderRadius: 8, border: "none", outline: "none",
  background: YELLOW.card, color: INK, fontSize: 15, fontFamily: "var(--font-body)", boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 13, color: INK_SOFT };

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
    <SketchPanel open={open} onClose={onClose} title="설정" width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, color: INK }}>
        <div>
          <label style={label}>닉네임</label>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={12} style={field} />
            <div style={{ width: 76 }}>
              <SketchButton fill={YELLOW.base} radius={8} onClick={saveName} disabled={saving}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>변경</span>
              </SketchButton>
            </div>
          </div>
          {error && <p style={{ color: SIGNAL.danger, fontSize: 12, margin: "6px 0 0" }}>{error}</p>}
        </div>

        <div>
          <label style={label}>효과음 볼륨</label>
          <input type="range" min={0} max={1} step={0.01} defaultValue={audio.sfxVolume}
            onChange={(e) => setSfxVolume(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={label}>배경음 볼륨</label>
          <input type="range" min={0} max={1} step={0.01} defaultValue={audio.bgmVolume}
            onChange={(e) => setBgmVolume(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" defaultChecked={audio.muted} onChange={(e) => setMuted(e.target.checked)} />
          음소거
        </label>

        <hr style={{ border: "none", borderTop: `1.5px solid ${INK_SOFT}`, opacity: 0.4, margin: 0 }} />

        <div>
          <label style={label}>내 토큰(다른 기기에서 이 계정으로 연동할 때 사용)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input value={token ?? ""} readOnly
              style={{ ...field, fontFamily: "monospace", fontSize: 12, color: INK_SOFT }} />
            <div style={{ width: 76 }}>
              <SketchButton fill={YELLOW.barLight} radius={8} onClick={copyToken}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{copied ? "복사됨" : "복사"}</span>
              </SketchButton>
            </div>
          </div>
        </div>

        <div>
          <label style={label}>토큰으로 계정 연동</label>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input value={linkToken} onChange={(e) => setLinkToken(e.target.value)} placeholder="다른 계정의 토큰 붙여넣기"
              style={{ ...field, fontFamily: "monospace", fontSize: 12 }} />
            <div style={{ width: 76 }} ref={linkRef as never}>
              <SketchButton fill={YELLOW.base} radius={8} onClick={linkAccount} disabled={!linkToken.trim()}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>연동</span>
              </SketchButton>
            </div>
          </div>
          {linkError && <p style={{ color: SIGNAL.danger, fontSize: 12, margin: "6px 0 0" }}>{linkError}</p>}
        </div>
      </div>
    </SketchPanel>
  );
}

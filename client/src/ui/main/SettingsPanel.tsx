// S2c. 설정 모달 — 닉네임 변경 + 볼륨(기존 audio/settings.ts 연결). 기기 연동은 이번 배치 제외.
import { useState } from "react";
import { SpringPanel } from "../../design/primitives/index.js";
import { useSessionStore } from "../../store/session.js";
import { api, ApiError } from "../../net/rest.js";
import { getAudioSettings, setSfxVolume, setBgmVolume, setMuted } from "../../audio/settings.js";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nickname = useSessionStore((s) => s.nickname);
  const setSession = useSessionStore((s) => s.setSession);
  const userId = useSessionStore((s) => s.userId);
  const avatarAssetId = useSessionStore((s) => s.avatarAssetId);
  const avatar = useSessionStore((s) => s.avatar);
  const [nameInput, setNameInput] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      </div>
    </SpringPanel>
  );
}

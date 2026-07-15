// S2. 메인 — 버튼 4개 + 아바타 패널. 에셋 만들기/내 창고는 캔버스·렌더 필요해 이번 배치 미구현.
import { useState } from "react";
import { COLORS } from "../../design/tokens/index.js";
import { TileTexture, SpringButton } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { SettingsPanel } from "./SettingsPanel.js";

export function MainScreen({ onLobby }: { onLobby: () => void }) {
  const nickname = useSessionStore((s) => s.nickname);
  const avatar = useSessionStore((s) => s.avatar);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const goLobby = () => void trigger(async () => { await new Promise((r) => setTimeout(r, 0)); onLobby(); });
  const showNotice = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 1800); };

  return (
    <div className="dsScreen">
      <TileTexture />
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="설정"
        style={{
          position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%",
          border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 20, cursor: "pointer",
        }}
      >
        ⚙️
      </button>

      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 32,
      }}>
        <h2 className="dsPointFont" style={{ color: COLORS.buildYellow, margin: 0, fontSize: 22 }}>
          {nickname}님, 환영합니다
        </h2>

        {/* 아바타 패널 — 썸네일 렌더 없음(스프라이트 시스템 미구현), 텍스트만 */}
        <div style={{
          width: 140, height: 200, borderRadius: 12, background: "rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff",
        }}>
          <span style={{ fontSize: 40 }}>🧍</span>
          <span>{avatar ? avatar.name : "졸라맨(기본)"}</span>
          {avatar && avatar.status !== "ready" && <span style={{ fontSize: 12, opacity: 0.7 }}>생성 중</span>}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <SpringButton ref={ref} onClick={goLobby}>게임하기</SpringButton>
          <SpringButton variant="ghost" onClick={() => showNotice("에셋 만들기는 준비 중입니다")}>에셋 만들기</SpringButton>
          <SpringButton variant="ghost" onClick={() => showNotice("내 창고는 준비 중입니다")}>내 창고</SpringButton>
        </div>
        {notice && <p style={{ color: "#fff", opacity: 0.85 }}>{notice}</p>}
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

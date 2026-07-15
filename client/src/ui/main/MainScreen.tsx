// S2. 메인 — 확정 레이아웃(좌 45% 아바타 패널 / 우 55% 액션 스택). 손그림 벡터 재도장.
import { useState } from "react";
import { motion } from "framer-motion";
import { YELLOW, INK, INK_SOFT, SPRING_POP } from "../../design/tokens/index.js";
import { SketchButton, SketchBox } from "../../design/sketch/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { playSound } from "../../audio/sfx.js";
import { SettingsPanel } from "./SettingsPanel.js";

type AvatarAction = "idle" | "walk" | "onAir";
const ACTIONS: { key: AvatarAction; label: string }[] = [
  { key: "idle", label: "idle" },
  { key: "walk", label: "walk" },
  { key: "onAir", label: "onAir" },
];

export function MainScreen({ onLobby }: { onLobby: () => void }) {
  const nickname = useSessionStore((s) => s.nickname);
  const avatar = useSessionStore((s) => s.avatar);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<AvatarAction>("idle");

  const goLobby = () => void trigger(async () => { await new Promise((r) => setTimeout(r, 0)); onLobby(); });
  const showNotice = (msg: string) => { playSound("uiBack"); setNotice(msg); setTimeout(() => setNotice(null), 1800); };
  const pickAction = (a: AvatarAction) => { if (a !== action) { playSound("switch"); setAction(a); } };

  return (
    <div className="dsScreen" style={{ background: YELLOW.list, display: "flex", overflow: "hidden" }}>
      {/* ── 좌측 45%: 아바타 패널 ── */}
      <div style={{ width: "45%", height: "100vh", position: "relative", padding: 20, boxSizing: "border-box" }}>
        <SketchBox fill={YELLOW.card} stroke={INK} preset="panel" center={false}
          style={{ width: "100%", height: "100%" }}
          contentStyle={{ display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", color: INK, fontFamily: "var(--font-point)", fontSize: 20, marginBottom: 8 }}>
            {nickname}의 아바타
          </div>
          {/* 미리보기 영역 — 스프라이트 마운트는 후속(sprites 시스템). 지금은 정돈된 빈 영역. */}
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: INK_SOFT, fontSize: 14 }}>
              {avatar ? avatar.name : "졸라맨 (기본)"}
              {avatar && avatar.status !== "ready" ? " · 생성 중" : ""}
              {` · ${action}`}
            </span>
          </div>
        </SketchBox>

        {/* idle/walk/onAir — 하단 테두리에 박힌 물리 스위치 탭(항상 둥근+낙서 테두리). */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 2, display: "flex", justifyContent: "center", gap: 14 }}>
          {ACTIONS.map(({ key, label }) => {
            const pressed = action === key;
            return (
              <motion.button
                key={key}
                onClick={() => pickAction(key)}
                animate={{ y: pressed ? 10 : 0 }}
                transition={SPRING_POP}
                style={{ width: 56, height: 84, border: "none", background: "transparent", padding: 0, cursor: "pointer", position: "relative" }}
              >
                <SketchBox fill={pressed ? YELLOW.pressed : YELLOW.barLight} stroke={INK} radius={12} jiggle preset="chip"
                  style={{ width: "100%", height: "100%" }} />
                {/* 눌린 상태에서도 라벨은 위로 떠올라 항상 보이게. */}
                <motion.span animate={{ y: pressed ? -16 : 0 }} transition={SPRING_POP}
                  style={{ position: "absolute", left: 0, right: 0, top: 8, textAlign: "center", color: INK, fontSize: 12, fontWeight: 700, pointerEvents: "none" }}>
                  {label}
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── 우측 55%: 액션 스택 ── */}
      <div style={{ width: "55%", height: "100vh", display: "flex", flexDirection: "column", gap: 6, padding: "20px 20px 20px 0", boxSizing: "border-box" }}>
        <div style={{ flex: 5 }}><SketchButton ref={ref} onClick={goLobby}>게임하기</SketchButton></div>
        <div style={{ flex: 5 }}><SketchButton fill={YELLOW.card} onClick={() => showNotice("에셋 만들기는 준비 중입니다")}>에셋 만들기</SketchButton></div>
        <div style={{ flex: 5 }}><SketchButton fill={YELLOW.card} onClick={() => showNotice("내 창고는 준비 중입니다")}>내 창고</SketchButton></div>
        <div style={{ flex: 1.3 }}>
          <SketchButton fill={YELLOW.barLight} radius={10} onClick={() => { playSound("modalOpen"); setSettingsOpen(true); }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>설정</span>
          </SketchButton>
        </div>
      </div>

      {notice && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_POP}
          style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", color: INK, background: YELLOW.card, padding: "10px 18px", borderRadius: 10, fontSize: 14 }}>
          {notice}
        </motion.div>
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

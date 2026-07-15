// 우하단 바 — [시간단축][시간추가](붙여서) → 남은시간 → 여백 → [테스트하기](우측 22% 세로 꽉, 2026-07-16 확정).
// 시간조정 로직은 아직 미구현 — §P1 스펙 7 항목. 테스트 모드(testRunner)는 연결됨.
import { useState } from "react";
import { motion } from "framer-motion";
import { GAP, PAD } from "../sizeTokens.js";
import { edgeTransition, fromBottom } from "../motionTokens.js";
import { SketchBox, SketchButton } from "../../design/sketch/index.js";
import { YELLOW, INK, SIGNAL } from "../../design/tokens/index.js";
import { startTest, stopTest, type TestBadge } from "../testmode/testRunner.js";

const BAR_HEIGHT = 64;

const BADGE_LABEL: Record<TestBadge, string> = {
  unverified: "미검증", running: "테스트 중…", passed: "통과됨", error: "오류",
};
const BADGE_COLOR: Record<TestBadge, string> = {
  unverified: INK, running: INK, passed: SIGNAL.ok, error: SIGNAL.danger,
};

export function BottomBar({ index, closing }: { index: number; closing: boolean }) {
  const [badge, setBadge] = useState<TestBadge>("unverified");
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onBadge(b: TestBadge, m?: string) {
    setBadge(b);
    setMsg(m ?? null);
    if (b === "error") setTesting(false);
  }

  async function onToggleTest() {
    if (testing) {
      stopTest();
      setTesting(false);
      setBadge("unverified");
      setMsg(null);
      return;
    }
    setTesting(true);
    await startTest(onBadge);
  }

  return (
    <motion.div
      variants={fromBottom}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      style={{ padding: `${GAP / 2}px ${PAD}px`, flexShrink: 0 }}
    >
      <SketchBox fill={YELLOW.list} stroke={INK} preset="panel" center={false}
        contentStyle={{ display: "flex", alignItems: "center", gap: 0, padding: `${GAP / 2}px ${GAP}px`, height: BAR_HEIGHT, boxSizing: "border-box" }}
        style={{ width: "100%", height: BAR_HEIGHT + GAP }}
      >
        {/* 시간단축/시간추가 — 붙여서(사이 간격 없음) */}
        <div style={{ display: "flex", height: "70%" }}>
          <div style={{ width: 96 }}><SketchButton fill={YELLOW.card} radius={0}><span style={{ fontSize: 13 }}>시간단축</span></SketchButton></div>
          <div style={{ width: 96 }}><SketchButton fill={YELLOW.card} radius={0}><span style={{ fontSize: 13 }}>시간추가</span></SketchButton></div>
        </div>

        <span className="dsPointFont" style={{ marginLeft: GAP, fontSize: 18, color: INK, fontWeight: 700 }}>03:00</span>

        {/* 검증 상태 뱃지 */}
        <span style={{ marginLeft: GAP, fontSize: 12, fontWeight: 700, color: BADGE_COLOR[badge] }}>
          ● {BADGE_LABEL[badge]}{msg ? ` — ${msg}` : ""}
        </span>

        <div style={{ flex: 1 }} />

        {/* 테스트하기/중단 — 하단바 우측 22% 세로 꽉 채움(일반 버튼 아님, 공통 "꽉 찬 요소" 취급) */}
        <div style={{ width: "22%", height: "100%" }}>
          <SketchButton fill={testing ? YELLOW.pressed : YELLOW.base} onClick={() => void onToggleTest()}>
            <span style={{ fontSize: 15 }}>{testing ? "테스트 중단" : "테스트하기"}</span>
          </SketchButton>
        </div>
      </SketchBox>
    </motion.div>
  );
}

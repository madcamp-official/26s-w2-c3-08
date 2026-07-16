// 우하단 바 — [시간단축][시간추가](붙여서) → 남은시간 → 여백 → [테스트하기](우측 22% 세로 꽉, 2026-07-16 확정).
// 룸 연결 시(building): 남은시간 = RaceState.phaseEndsAt 실시간, 시간조정 ±30s(평생 1회, ≤45s 단축 불가),
// 누군가 조정하면 시간 옆 토스트. 룸 없이(콘솔 mapedit) 열면 더미 03:00 + 조정 비활성.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RACE_MSG, RACE_S2C_MSG, type TimeAdjustedPayload } from "shared/race";
import { GAP, PAD } from "../sizeTokens.js";
import { edgeTransition, fromBottom } from "../motionTokens.js";
import { SketchBox, SketchButton } from "../../design/sketch/index.js";
import { YELLOW, INK, SIGNAL, SPRING_POP } from "../../design/tokens/index.js";
import { useRoomStore } from "../../store/room.js";
import { playSound } from "../../audio/sfx.js";
import { startTest, stopTest, type TestBadge } from "../testmode/testRunner.js";

const BAR_HEIGHT = 64;

const BADGE_LABEL: Record<TestBadge, string> = {
  unverified: "미검증", running: "테스트 중…", passed: "통과됨", error: "오류",
};
const BADGE_COLOR: Record<TestBadge, string> = {
  unverified: INK, running: INK, passed: SIGNAL.ok, error: SIGNAL.danger,
};

interface RaceSnap {
  phase: string; phaseEndsAt: number; serverTime: number;
  members: { get: (id: string) => { usedTimeAdjust: boolean } | undefined };
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BottomBar({ index, closing }: { index: number; closing: boolean }) {
  const [badge, setBadge] = useState<TestBadge>("unverified");
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);   // 상태 패치마다 리렌더(남은시간 갱신)

  const state = room?.state as unknown as RaceSnap | undefined;
  const building = state?.phase === "building";
  const leftSec = building && state.phaseEndsAt > 0
    ? Math.max(0, Math.ceil((state.phaseEndsAt - state.serverTime) / 1000))
    : null;
  const usedAdjust = room ? state?.members.get(room.sessionId)?.usedTimeAdjust ?? false : false;
  const canAdjust = building && !usedAdjust;
  const canReduce = canAdjust && (leftSec ?? 0) > 45;
  const timeWarn = leftSec !== null && leftSec < 20;

  // 시간조정 broadcast → 토스트(살짝 위로 올라왔다 페이드아웃)
  useEffect(() => {
    if (!room) return;
    const unsubscribe = room.onMessage(RACE_S2C_MSG.timeAdjusted, (m: TimeAdjustedPayload) => {
      playSound("toast");
      setToast(`${m.nickname}님이 시간을 ${m.direction === "add" ? "증가" : "단축"}하였습니다.`);
      clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2600);
    });
    return () => { unsubscribe(); clearTimeout(toastTimer.current); };
  }, [room]);

  function adjust(direction: "add" | "reduce") {
    if (!room || !canAdjust || (direction === "reduce" && !canReduce)) { playSound("denied"); return; }
    playSound("uiClick");
    room.send(RACE_MSG.adjustTime, { direction });
  }

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
        {/* 시간단축/시간추가 — 붙여서(사이 간격 없음). 평생 1회 사용 시 둘 다 비활성 */}
        <div style={{ display: "flex", height: "70%" }}>
          <div style={{ width: 96 }}>
            <SketchButton fill={YELLOW.card} radius={0} disabled={!canReduce} onClick={() => adjust("reduce")}>
              <span style={{ fontSize: 13 }}>시간단축</span>
            </SketchButton>
          </div>
          <div style={{ width: 96 }}>
            <SketchButton fill={YELLOW.card} radius={0} disabled={!canAdjust} onClick={() => adjust("add")}>
              <span style={{ fontSize: 13 }}>시간추가</span>
            </SketchButton>
          </div>
        </div>

        {/* 남은시간 — <20s 빨강+흔들림 */}
        <motion.span
          className="dsPointFont"
          animate={timeWarn ? { x: [0, -2, 2, -2, 0], color: SIGNAL.danger } : { x: 0, color: INK }}
          transition={timeWarn ? { x: { repeat: Infinity, duration: 0.4 }, color: { duration: 0.2 } } : SPRING_POP}
          style={{ marginLeft: GAP, fontSize: 18, fontWeight: 700, display: "inline-block" }}
        >
          {leftSec !== null ? fmt(leftSec) : "03:00"}
        </motion.span>

        {/* 시간조정 토스트 — 남은시간 옆에서 살짝 위로 올라왔다 페이드아웃 */}
        <AnimatePresence>
          {toast && (
            <motion.span
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={SPRING_POP}
              style={{ marginLeft: 10, fontSize: 12, color: INK, fontWeight: 700 }}
            >
              {toast}
            </motion.span>
          )}
        </AnimatePresence>

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

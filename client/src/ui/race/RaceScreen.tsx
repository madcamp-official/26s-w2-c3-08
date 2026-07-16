// E. 레이스 — racing/lastdance 페이즈. 서버가 확정한 라인 순서(state.lineIds)로 클라가 같은
// 병합맵을 조립(§14)해 BaseworldScene을 풀화면 마운트하고, 그 위에 HUD를 얹는다.
// HUD 확정 스펙(screen-design.md E절): 배경 없는 텍스트만, 흰 글씨+검정 외곽선.
// 좌상단 "n위/총원" 크게 + top5 리스트(내 항목 굵게+밑줄, 스프링 슬라이드·페이드),
// 우상단 남은시간(1등 카운트다운·라스트댄스 = 빨간색 전환, 신규 UI 없음).
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { mergeLines, type LineRecord } from "shared/build";
import { YELLOW, INK, SIGNAL, SPRING_POP } from "../../design/tokens/index.js";
import { useRoomStore } from "../../store/room.js";
import { startGame, stopGame } from "../../rooms/baseworld/boot.js";
import { worldFromMerged } from "../../rooms/baseworld/sceneWorld.js";
import { HTTP_BASE } from "../../net/rest.js";

interface MemberSnap { nickname: string; rank: number; finishMs: number; bestX: number }
interface RaceSnap {
  phase: string; phaseEndsAt: number; serverTime: number; lineIds: string;
  members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void };
}

/** 흰 글씨 + 검정 외곽선(배경 없는 HUD 텍스트 필수 스타일) */
const OUTLINE: React.CSSProperties = {
  color: "#fff",
  textShadow: "-2px 0 #000, 2px 0 #000, 0 -2px #000, 0 2px #000, -1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000",
  fontFamily: "var(--font-point)",
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RaceScreen() {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);
  const hostRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const state = room?.state as unknown as RaceSnap | undefined;

  // 병합맵 조립 → 게임 마운트(1회). lineIds는 racing 진입 시 확정돼 이 화면이 뜰 땐 항상 존재.
  useEffect(() => {
    if (!room || !hostRef.current) return;
    const lineIds = (room.state as unknown as RaceSnap).lineIds;
    if (!lineIds) { setLoadError("라인 정보가 없습니다(서버 병합 실패)"); return; }
    let cancelled = false;
    void (async () => {
      try {
        const lines = await Promise.all(lineIds.split(",").map(async (id) => {
          const res = await fetch(`${HTTP_BASE}/api/lines/${id}`);
          if (!res.ok) throw new Error(`라인 ${id} 조회 실패 ${res.status}`);
          return (await res.json()) as LineRecord;
        }));
        if (cancelled || !hostRef.current) return;
        startGame(room, hostRef.current, worldFromMerged(mergeLines(lines)));
        setReady(true);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "맵 로드 실패");
      }
    })();
    return () => { cancelled = true; stopGame(); };
  }, [room]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!room || !state) return null;

  // ── 순위 계산: 완주자(rank>0) rank순 → 미완주자 bestX 내림차순 ──
  const all: (MemberSnap & { sessionId: string })[] = [];
  state.members?.forEach((m, id) => all.push({ ...m, sessionId: id }));
  const finished = all.filter((m) => m.rank > 0).sort((a, b) => a.rank - b.rank);
  const running = all.filter((m) => m.rank === 0).sort((a, b) => b.bestX - a.bestX);
  const standings = [...finished, ...running];
  const myIdx = standings.findIndex((m) => m.sessionId === room.sessionId);
  const myPlace = myIdx >= 0 ? myIdx + 1 : 0;

  const leftSec = state.phaseEndsAt > 0 ? Math.max(0, Math.ceil((state.phaseEndsAt - state.serverTime) / 1000)) : null;
  // 시간 빨강 전환: 1등 도달 후 카운트다운(완주자 존재) 또는 라스트댄스
  const timeRed = state.phase === "lastdance" || finished.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#1a1a24" }}>
      {/* 게임 마운트 호스트 */}
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {!ready && !loadError && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: YELLOW.list }}>
          <span style={{ color: INK, fontFamily: "var(--font-point)", fontSize: 20 }}>맵 조립 중…</span>
        </div>
      )}
      {loadError && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: YELLOW.list }}>
          <span style={{ color: SIGNAL.danger, fontFamily: "var(--font-point)", fontSize: 18 }}>{loadError}</span>
        </div>
      )}

      {/* ── HUD: 좌상단 순위 ── */}
      <div style={{ position: "absolute", top: 14, left: 18, pointerEvents: "none" }}>
        <div style={{ ...OUTLINE, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
          {myPlace > 0 ? `${myPlace}위` : "-"}
          <span style={{ fontSize: 16, marginLeft: 6 }}>/{standings.length}</span>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
          <AnimatePresence>
            {standings.slice(0, 5).map((m, i) => {
              const mine = m.sessionId === room.sessionId;
              return (
                <motion.div
                  key={m.sessionId}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING_POP}
                  style={{
                    ...OUTLINE, fontSize: 15,
                    fontWeight: mine ? 700 : 400,
                    textDecoration: mine ? "underline" : "none",
                  }}
                >
                  {i + 1}. {m.nickname}{m.rank > 0 ? " ✔" : ""}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── HUD: 우상단 남은시간 ── */}
      {leftSec !== null && (
        <div style={{
          position: "absolute", top: 14, right: 18, pointerEvents: "none",
          ...OUTLINE, fontSize: 30, fontWeight: 700,
          color: timeRed ? SIGNAL.danger : "#fff",
        }}>
          {fmt(leftSec)}
        </div>
      )}
    </div>
  );
}

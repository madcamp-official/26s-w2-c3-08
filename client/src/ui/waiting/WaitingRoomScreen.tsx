// C. 방 대기실 — 참가자 목록·방장 표시·[시작]. 손그림 재도장.
import { useEffect } from "react";
import { RACE_MSG } from "shared/race";
import { YELLOW, INK, INK_SOFT } from "../../design/tokens/index.js";
import { SketchButton, SketchBox } from "../../design/sketch/index.js";
import { StaggerList, StaggerItem } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useRoomStore } from "../../store/room.js";
import { playSound } from "../../audio/sfx.js";
import { waitForPhaseChange } from "../../net/raceRoom.js";

interface MemberSnap { userId: string; nickname: string; isHost: boolean; canBuild: boolean }
interface RaceStateSnap {
  phase: string; phaseEndsAt: number; serverTime: number;
  members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void };
}

export function WaitingRoomScreen({ onLeave, onFinished }: { onLeave: () => void; onFinished: () => void }) {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();

  const state = room?.state as unknown as RaceStateSnap | undefined;

  useEffect(() => {
    if (state?.phase === "finished") onFinished();
  }, [state?.phase]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!room || !state) {
    return (
      <div className="dsScreen" style={{ background: YELLOW.list, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: INK, fontFamily: "var(--font-point)", fontSize: 20 }}>방 정보를 불러오는 중…</span>
      </div>
    );
  }

  const members: (MemberSnap & { sessionId: string })[] = [];
  state.members.forEach((m, id) => members.push({ ...m, sessionId: id }));
  const me = members.find((m) => m.sessionId === room.sessionId);
  const isHost = me?.isHost ?? false;
  const leftSec = state.phaseEndsAt > 0 ? Math.max(0, Math.ceil((state.phaseEndsAt - state.serverTime) / 1000)) : null;

  const start = () => void trigger(async () => {
    playSound("uiClick");
    room.send(RACE_MSG.start);
    await waitForPhaseChange(room, "lobby");
  });
  const leave = () => { playSound("uiBack"); void room.leave(); onLeave(); };

  return (
    <div className="dsScreen" style={{ background: YELLOW.list, overflow: "auto" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 32 }}>
        <h1 className="dsPointFont" style={{ color: INK, fontSize: 28, margin: "0 0 8px" }}>방 대기실</h1>

        {state.phase !== "lobby" && (
          <p style={{ fontSize: 15, color: INK }}>
            현재 페이즈: <b>{state.phase}</b>{leftSec !== null && ` (${leftSec}s 남음)`}
          </p>
        )}

        <StaggerList style={{ display: "flex", flexDirection: "column", gap: 10, margin: "18px 0" }}>
          {members.map((m) => (
            <StaggerItem key={m.sessionId}>
              <SketchBox fill={YELLOW.card} stroke={INK} radius={12} preset="frame" center={false}
                style={{ minHeight: 48 }}
                contentStyle={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", boxSizing: "border-box" }}>
                <span style={{ color: INK, fontSize: 15, fontWeight: m.isHost ? 700 : 400 }}>
                  {m.isHost ? "★ " : ""}{m.nickname}
                </span>
                {state.phase === "building" && !m.canBuild && (
                  <span style={{ color: INK_SOFT, fontSize: 12 }}>(관전)</span>
                )}
              </SketchBox>
            </StaggerItem>
          ))}
        </StaggerList>

        <div style={{ display: "flex", gap: 12, height: 60 }}>
          {state.phase === "lobby" && isHost && (
            <div style={{ flex: 1 }}><SketchButton ref={ref} onClick={start}>시작</SketchButton></div>
          )}
          <div style={{ flex: 1 }}><SketchButton fill={YELLOW.card} onClick={leave}>나가기</SketchButton></div>
        </div>
      </div>
    </div>
  );
}

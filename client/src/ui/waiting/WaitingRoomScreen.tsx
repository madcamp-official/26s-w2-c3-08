// C. 방 대기실 — 참가자 목록·방장 표시·[시작]. lobby 이후 페이즈는 이번 배치에서 텍스트 상태만
// (맵 에디터·레이스 실제 렌더는 별도 배치 — 사용자 작업/후속 작업).
import { useEffect } from "react";
import { RACE_MSG } from "shared/race";
import { COLORS } from "../../design/tokens/index.js";
import { TileTexture, SpringButton, StaggerList, StaggerItem } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useRoomStore } from "../../store/room.js";
import { waitForPhaseChange } from "../../net/raceRoom.js";

interface MemberSnap { userId: string; nickname: string; isHost: boolean; canBuild: boolean }
interface RaceStateSnap {
  phase: string; phaseEndsAt: number; serverTime: number;
  members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void };
}

export function WaitingRoomScreen({ onLeave, onFinished }: { onLeave: () => void; onFinished: () => void }) {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);   // 리렌더 트리거만
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();

  const state = room?.state as unknown as RaceStateSnap | undefined;

  useEffect(() => {
    if (state?.phase === "finished") onFinished();
  }, [state?.phase]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!room || !state) return null;

  const members: (MemberSnap & { sessionId: string })[] = [];
  state.members.forEach((m, id) => members.push({ ...m, sessionId: id }));
  const me = members.find((m) => m.sessionId === room.sessionId);
  const isHost = me?.isHost ?? false;
  const leftSec = state.phaseEndsAt > 0 ? Math.max(0, Math.ceil((state.phaseEndsAt - state.serverTime) / 1000)) : null;

  const start = () => void trigger(async () => {
    room.send(RACE_MSG.start);
    await waitForPhaseChange(room, "lobby");
  });

  const leave = () => { void room.leave(); onLeave(); };

  return (
    <div className="dsScreen" style={{ background: `linear-gradient(180deg, ${COLORS.skyBlue}, #1c3a5e)`, padding: 32 }}>
      <TileTexture />
      <div style={{ position: "relative", maxWidth: 480, margin: "0 auto", color: "#fff" }}>
        <h1 className="dsPointFont" style={{ color: COLORS.buildYellow, fontSize: 26 }}>방 대기실</h1>

        {state.phase !== "lobby" && (
          <p style={{ fontSize: 15 }}>
            현재 페이즈: <b>{state.phase}</b>{leftSec !== null && ` (${leftSec}s 남음)`}
          </p>
        )}

        <StaggerList style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
          {members.map((m) => (
            <StaggerItem key={m.sessionId}>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px" }}>
                {m.isHost ? "★ " : ""}{m.nickname}
                {state.phase === "building" && !m.canBuild && " (관전)"}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>

        <div style={{ display: "flex", gap: 12 }}>
          {state.phase === "lobby" && isHost && (
            <SpringButton ref={ref} onClick={start}>시작</SpringButton>
          )}
          <SpringButton variant="ghost" onClick={leave}>나가기</SpringButton>
        </div>
      </div>
    </div>
  );
}

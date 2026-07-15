// F. 결과 — 이미 연결된 룸(finished 페이즈)의 RaceState를 그대로 읽어 순위표.
import { RACE_MSG } from "shared/race";
import { COLORS } from "../../design/tokens/index.js";
import { TileTexture, SpringButton, StaggerList, StaggerItem } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useRoomStore } from "../../store/room.js";
import { waitForPhaseChange } from "../../net/raceRoom.js";

interface MemberSnap { userId: string; nickname: string; isHost: boolean; rank: number; finishMs: number; bestX: number }
interface RaceStateSnap {
  phase: string;
  members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void };
}

const MEDAL = ["🥇", "🥈", "🥉"];

export function ResultScreen({ onLobby, onRestart }: { onLobby: () => void; onRestart: () => void }) {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();

  const state = room?.state as unknown as RaceStateSnap | undefined;
  if (!room || !state) return null;

  const members: (MemberSnap & { sessionId: string })[] = [];
  state.members.forEach((m, id) => members.push({ ...m, sessionId: id }));
  members.sort((a, b) => a.rank - b.rank);
  const isHost = members.find((m) => m.sessionId === room.sessionId)?.isHost ?? false;

  const restart = () => void trigger(async () => {
    room.send(RACE_MSG.restart);
    await waitForPhaseChange(room, "finished");
    onRestart();
  });
  const backToLobby = () => { void room.leave(); onLobby(); };

  return (
    <div className="dsScreen" style={{ padding: 32 }}>
      <TileTexture />
      <div style={{ position: "relative", maxWidth: 480, margin: "0 auto", color: "#fff" }}>
        <h1 className="dsPointFont" style={{ color: COLORS.buildYellow, fontSize: 28 }}>결과</h1>

        <StaggerList style={{ display: "flex", flexDirection: "column", gap: 10, margin: "20px 0" }}>
          {members.map((m) => (
            <StaggerItem key={m.sessionId}>
              <div style={{
                background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>{MEDAL[m.rank - 1] ?? `${m.rank}위`} {m.nickname}</span>
                <span style={{ fontSize: 13, opacity: 0.75 }}>
                  {m.finishMs > 0 ? `${(m.finishMs / 1000).toFixed(1)}s` : "리타이어"}
                </span>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>

        <div style={{ display: "flex", gap: 12 }}>
          {isHost && <SpringButton ref={ref} onClick={restart}>다시하기</SpringButton>}
          <SpringButton variant="ghost" onClick={backToLobby}>로비로</SpringButton>
        </div>
      </div>
    </div>
  );
}

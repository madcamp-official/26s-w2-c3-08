// F. 결과 — RaceState(finished) 순위표 + 우측 [메인으로] 큰 버튼 하나(2026-07-16: 다시하기/로비로 제거).
import { YELLOW, INK, INK_SOFT, WORLD } from "../../design/tokens/index.js";
import { SketchButton, SketchBox } from "../../design/sketch/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { StaggerList, StaggerItem } from "../../design/primitives/index.js";
import { useRoomStore } from "../../store/room.js";
import { playSound } from "../../audio/sfx.js";

interface MemberSnap { userId: string; nickname: string; isHost: boolean; rank: number; finishMs: number; bestX: number }
interface RaceStateSnap {
  phase: string;
  members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void };
}

/** 금/은/동 뱃지 색(순검정 금지, 팔레트 재사용). */
const MEDAL_BG = [YELLOW.base, "#B4B2A9", WORLD.dirt];

export function ResultScreen({ onMain }: { onLobby: () => void; onRestart: () => void; onMain: () => void }) {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);
  const { ref, trigger } = useMorphTransition<HTMLButtonElement>();

  const state = room?.state as unknown as RaceStateSnap | undefined;
  if (!room || !state) {
    return (
      <div className="dsScreen" style={{ background: YELLOW.list, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: INK, fontFamily: "var(--font-point)", fontSize: 20 }}>결과를 불러오는 중…</span>
      </div>
    );
  }

  const members: (MemberSnap & { sessionId: string })[] = [];
  state.members?.forEach((m, id) => members.push({ ...m, sessionId: id }));
  members.sort((a, b) => a.rank - b.rank);

  const goMain = () => void trigger(async () => { playSound("uiBack"); void room.leave(); onMain(); });

  return (
    <div className="dsScreen" style={{ background: YELLOW.list, display: "flex", overflow: "hidden" }}>
      {/* 좌측: 순위표 */}
      <div style={{ flex: 1, height: "100vh", padding: 28, boxSizing: "border-box", overflowY: "auto" }}>
        <h1 className="dsPointFont" style={{ color: INK, fontSize: 30, margin: "4px 0 20px" }}>결과</h1>
        <StaggerList style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((m) => {
            const medal = m.rank >= 1 && m.rank <= 3 ? MEDAL_BG[m.rank - 1] : null;
            const retired = m.finishMs <= 0;
            return (
              <StaggerItem key={m.sessionId}>
                <SketchBox fill={YELLOW.card} stroke={INK} radius={12} preset="frame" center={false}
                  style={{ minHeight: 54, opacity: retired ? 0.6 : 1 }}
                  contentStyle={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", boxSizing: "border-box" }}>
                  <span style={{
                    width: 34, height: 34, flex: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: medal ?? "transparent", color: medal ? INK : INK_SOFT, fontWeight: 700, fontSize: 15,
                    border: medal ? "none" : `1.5px solid ${INK_SOFT}`,
                  }}>{m.rank}</span>
                  <span style={{ flex: 1, color: INK, fontSize: 15, fontWeight: 700 }}>{m.nickname}</span>
                  <span style={{ fontSize: 13, color: INK_SOFT }}>
                    {retired ? "리타이어" : `${(m.finishMs / 1000).toFixed(1)}s`}
                  </span>
                </SketchBox>
              </StaggerItem>
            );
          })}
        </StaggerList>
      </div>

      {/* 우측: 메인으로 큰 버튼 하나 */}
      <div style={{ width: "34%", height: "100vh", padding: 28, boxSizing: "border-box", display: "flex" }}>
        <SketchButton ref={ref} onClick={goMain}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>메인으로</span>
        </SketchButton>
      </div>
    </div>
  );
}

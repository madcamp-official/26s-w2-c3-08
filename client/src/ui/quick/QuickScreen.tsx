// 간이 레이스 모드(?quick) — 이벤트용 최소 화면. UI 장식 없음(40분 제약).
// 접속하면 자동 세션+자동 입장 → "접속 N명"만 표시. 시작/중단은 브라우저 콘솔에서
// startstart() / stopstop() (비공개 — window 전역, 화면에 아무 안내 없음).
import { useEffect, useState } from "react";
import { useSessionStore } from "../../store/session.js";
import { useRoomStore, attachRoom } from "../../store/room.js";
import { api } from "../../net/rest.js";
import { createRace, listRaceRooms, joinRaceById } from "../../net/raceRoom.js";
import { RaceScreen } from "../race/RaceScreen.js";

interface SessionResponse { userId: string; token: string; nickname: string }
interface MemberSnap { nickname: string; rank: number; finishMs: number }
interface Snap { phase: string; members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void } }

export function QuickScreen() {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);
  const [error, setError] = useState<string | null>(null);

  // 자동 세션 + 자동 입장(공개 lobby 방 있으면 합류, 없으면 생성) + 콘솔 명령 등록
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let token = useSessionStore.getState().token;
        if (!token) {
          const nick = `P${Math.random().toString(36).slice(2, 6)}`;
          const res = await api.post<SessionResponse>("/api/session", { nickname: nick });
          useSessionStore.getState().setSession({ token: res.token, userId: res.userId, nickname: res.nickname, avatarAssetId: null, avatar: null });
          token = res.token;
        }
        const rooms = await listRaceRooms();
        const open = rooms.find((r) => r.status === "lobby");
        const joined = open
          ? await joinRaceById(open.colyseusRoomId, { userToken: token })
          : await createRace({ userToken: token, isPublic: true });
        if (!alive) { void joined.leave(); return; }
        attachRoom(joined);
        // 비공개 콘솔 명령 — 화면 어디에도 안내하지 않는다.
        (window as unknown as Record<string, unknown>).startstart = () => joined.send("startstart");
        (window as unknown as Record<string, unknown>).stopstop = () => joined.send("stopstop");
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "접속 실패");
      }
    })();
    return () => { alive = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const state = room?.state as unknown as Snap | undefined;
  const phase = state?.phase ?? "connecting";

  if (error) return <div style={{ padding: 40, fontSize: 24 }}>{error}</div>;

  if (phase === "racing" || phase === "lastdance") return <RaceScreen />;

  if (phase === "finished") {
    const members: MemberSnap[] = [];
    state?.members?.forEach((m) => members.push(m));
    members.sort((a, b) => a.rank - b.rank);
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>결과</h1>
        {members.map((m, i) => (
          <div key={i} style={{ fontSize: 22 }}>
            {m.rank}위 — {m.nickname} {m.finishMs > 0 ? `(${(m.finishMs / 1000).toFixed(1)}s)` : "(리타이어)"}
          </div>
        ))}
      </div>
    );
  }

  // 대기(lobby/connecting) — 접속 인원수만
  let count = 0;
  state?.members?.forEach(() => count++);
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 64, fontWeight: 700 }}>
        {room ? `접속 ${count}명` : "접속 중…"}
      </div>
    </div>
  );
}

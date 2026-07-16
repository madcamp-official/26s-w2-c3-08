// 간이 레이스 모드(?quick) — 이벤트용 최소 화면. UI 장식 없음.
// 접속하면 매칭 허브(quickhub)에 자동 입장 → "접속 N명"만 표시.
// startstart()/stopstop()는 게임 콘솔(`)에서 devconsole 명령으로 실행(quickCommands.ts).
//   startstart → 허브가 전원을 최대 4명 그룹으로 배차. 각 클라는 goRace 예약을 소비해 레이스 방으로 이동.
//   stopstop → 모든 레이스 방이 backToHub → 전원 허브 복귀.
import { useEffect, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import { QUICK_HUB_MSG, type GoRacePayload } from "shared/race";
import { useSessionStore } from "../../store/session.js";
import { useRoomStore, attachRoom } from "../../store/room.js";
import { api } from "../../net/rest.js";
import { RaceScreen } from "../race/RaceScreen.js";

interface SessionResponse { userId: string; token: string; nickname: string }
interface MemberSnap { nickname: string; rank: number; finishMs: number }
interface HubSnap { members: { size: number } }
interface RaceSnap { phase: string; members: Map<string, MemberSnap> & { forEach: (fn: (m: MemberSnap, id: string) => void) => void } }

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;

let client: Client | null = null;
function getClient(): Client { return (client ??= new Client(SERVER_URL)); }

export function QuickScreen() {
  const room = useRoomStore((s) => s.room);
  useRoomStore((s) => s.version);
  const [error, setError] = useState<string | null>(null);
  const [inRace, setInRace] = useState(false);

  useEffect(() => {
    let alive = true;
    let hub: Room | null = null;

    const wireHub = (h: Room) => {
      hub = h;
      attachRoom(h);
      setInRace(false);
      // 배차: 좌석 예약을 소비해 레이스 방으로 이동
      h.onMessage(QUICK_HUB_MSG.goRace, (p: GoRacePayload) => {
        void (async () => {
          try {
            const race = await getClient().consumeSeatReservation(p.reservation as never);
            if (!alive) { void race.leave(); return; }
            void h.leave();
            attachRoom(race);
            setInRace(true);
            // 레이스 방 → 허브 복귀(stopstop 또는 종료 후)
            race.onMessage(QUICK_HUB_MSG.backToHub, () => { void returnToHub(); });
          } catch (e) {
            if (alive) setError(e instanceof Error ? e.message : "레이스 입장 실패");
          }
        })();
      });
    };

    const returnToHub = async () => {
      try {
        const cur = useRoomStore.getState().room;
        if (cur) void cur.leave();
        const token = useSessionStore.getState().token!;
        const h = await getClient().joinOrCreate("quickhub", { userToken: token, nickname: useSessionStore.getState().nickname ?? "" });
        if (!alive) { void h.leave(); return; }
        wireHub(h);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "허브 복귀 실패");
      }
    };

    void (async () => {
      try {
        let token = useSessionStore.getState().token;
        if (!token) {
          const nick = `P${Math.random().toString(36).slice(2, 6)}`;
          const res = await api.post<SessionResponse>("/api/session", { nickname: nick });
          useSessionStore.getState().setSession({ token: res.token, userId: res.userId, nickname: res.nickname, avatarAssetId: null, avatar: null });
          token = res.token;
        }
        const h = await getClient().joinOrCreate("quickhub", { userToken: token, nickname: useSessionStore.getState().nickname ?? "" });
        if (!alive) { void h.leave(); return; }
        wireHub(h);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "접속 실패");
      }
    })();

    return () => { alive = false; void hub?.leave(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div style={{ padding: 40, fontSize: 24 }}>{error}</div>;

  const state = room?.state as unknown as (RaceSnap | HubSnap | undefined);
  const phase = (state as RaceSnap | undefined)?.phase;

  // 레이스 방 소속(배차됨)
  if (inRace) {
    if (phase === "racing" || phase === "lastdance") return <RaceScreen />;
    if (phase === "finished") {
      const members: MemberSnap[] = [];
      (state as RaceSnap).members?.forEach((m) => members.push(m));
      members.sort((a, b) => a.rank - b.rank);
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif" }}>
          <h1>결과</h1>
          {members.map((m, i) => (
            <div key={i} style={{ fontSize: 22 }}>
              {m.rank}위 — {m.nickname} {m.finishMs > 0 ? `(${(m.finishMs / 1000).toFixed(1)}s)` : "(리타이어)"}
            </div>
          ))}
          <div style={{ marginTop: 20, opacity: 0.6 }}>레이스 방 대기 중… (30초 뒤 자동 진행/`stopstop`으로 대기 복귀)</div>
        </div>
      );
    }
    // 레이스 방 lobby(자동 시작 직전)
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>매칭 완료 — 곧 시작</div>;
  }

  // 허브(대기) — 접속 인원수만
  const count = (state as HubSnap | undefined)?.members?.size ?? 0;
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 64, fontWeight: 700 }}>
        {room ? `접속 ${count}명` : "접속 중…"}
      </div>
    </div>
  );
}

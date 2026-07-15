// race 명령 — RaceRoom 페이즈 상태기계 검증용. COMMANDS에 자기 등록(side-effect import).
// commands.ts와 분리한 이유: 그 파일은 다른 세션(사운드)이 작업 중이라 충돌 회피.
import { Client, type Room } from "@colyseus/sdk";
import { RACE_MSG } from "shared/race";
import { COMMANDS } from "./commands.js";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
const HTTP_BASE: string = SERVER_URL.replace(/^ws/, "http").replace(/\/$/, "");

let raceRoom: Room | null = null;

interface RaceStateSnap {
  phase: string;
  phaseEndsAt: number;
  serverTime: number;
  lineCount: number;
  members: Map<string, { nickname: string; isHost: boolean; canBuild: boolean }>;
}

COMMANDS.race = {
  usage: "race join <닉> | start | restart | state | leave",
  desc: "RaceRoom 접속·페이즈 상태기계 테스트",
  run: async (a, ctx) => {
    const sub = a[0];
    if (sub === "join") {
      if (raceRoom) { ctx.print("이미 접속 중 — race leave 먼저"); return; }
      const nickname = a[1] ?? "tester";
      const res = await fetch(`${HTTP_BASE}/api/session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      if (!res.ok) { ctx.print(`세션 발급 실패 ${res.status}`); return; }
      const { token } = (await res.json()) as { token: string };
      raceRoom = await new Client(SERVER_URL).joinOrCreate("race", { userToken: token });
      ctx.print(`race 입장 (${nickname}) sessionId=${raceRoom.sessionId}`);
      let lastPhase = "";
      raceRoom.onStateChange((s) => {
        const st = s as unknown as RaceStateSnap;
        if (st.phase !== lastPhase) {
          lastPhase = st.phase;
          const left = st.phaseEndsAt > 0 ? ` (${Math.ceil((st.phaseEndsAt - st.serverTime) / 1000)}s)` : "";
          ctx.print(`phase → ${st.phase}${left} lineCount=${st.lineCount}`);
        }
      });
      raceRoom.onLeave(() => { raceRoom = null; ctx.print("race 퇴장"); });
      return;
    }
    if (!raceRoom) { ctx.print("미접속 — race join <닉> 먼저"); return; }
    if (sub === "start" || sub === "restart") {
      raceRoom.send(sub === "start" ? RACE_MSG.start : RACE_MSG.restart);
      return;
    }
    if (sub === "state") {
      const st = raceRoom.state as unknown as RaceStateSnap;
      const left = st.phaseEndsAt > 0 ? Math.ceil((st.phaseEndsAt - st.serverTime) / 1000) : null;
      ctx.print(`phase=${st.phase}${left !== null ? ` 남은 ${left}s` : ""} lineCount=${st.lineCount}`);
      st.members.forEach((m, id) =>
        ctx.print(`  ${m.isHost ? "★" : "-"} ${m.nickname} (${id}) canBuild=${m.canBuild}`));
      return;
    }
    if (sub === "leave") { await raceRoom.leave(); return; }
    ctx.print("usage: race join <닉> | start | restart | state | leave");
  },
};

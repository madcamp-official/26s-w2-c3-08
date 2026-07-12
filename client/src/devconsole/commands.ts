// 개발자 콘솔 명령 (DEV 빌드 전용 — §32-3)
import { joinBaseworld, leaveBaseworld, getRoom } from "../rooms/baseworld/connect.js";
import { startGame, stopGame, getScene } from "../rooms/baseworld/boot.js";
import { TUNING } from "shared/physics";

export interface CmdCtx { print: (line: string) => void }
export interface Command {
  usage: string;
  desc: string;
  run: (args: string[], ctx: CmdCtx) => void | Promise<void>;
}

export const COMMANDS: Record<string, Command> = {
  help: {
    usage: "help",
    desc: "명령 목록 + serverview 옵션 설명",
    run: (_a, ctx) => {
      for (const c of Object.values(COMMANDS)) ctx.print(`${c.usage.padEnd(30)} ${c.desc}`);
      ctx.print("");
      ctx.print("serverview 옵션 (§19): 1=스프라이트 박스(보이는 모습, 반투명)");
      ctx.print("  2=히트박스(실제 판정, 진한 테두리·소속색)  3=서버 수신 상태(청록=나, 연두=남)");
      ctx.print("  주체: all|player|terrain|monster. 예) serverview player 1 2 / serverview off");
    },
  },
  join: {
    usage: "join [닉네임]",
    desc: "baseworld 접속 + 게임 시작",
    run: async (args, ctx) => {
      const room = await joinBaseworld(args[0]);
      startGame(room);
      ctx.print(`접속: ${room.roomId} (${room.sessionId})`);
      ctx.print("조작: ←→/AD 이동 · Space 점프 · ↓ 웅크리기/내려찍기 · Shift 달리기 · K 잡기");
    },
  },
  leave: {
    usage: "leave",
    desc: "나가기",
    run: async (_a, ctx) => { stopGame(); await leaveBaseworld(); ctx.print("나갔습니다."); },
  },
  players: {
    usage: "players",
    desc: "접속자 목록",
    run: (_a, ctx) => {
      const room = getRoom();
      if (!room) { ctx.print("접속 중 아님"); return; }
      let n = 0;
      room.state.players.forEach((p: { x: number; y: number; nickname: string }, id: string) => {
        ctx.print(`${id}${id === room.sessionId ? " (나)" : ""} ${p.nickname || "-"} (${Math.round(p.x)}, ${Math.round(p.y)})`);
        n++;
      });
      ctx.print(`총 ${n}명`);
    },
  },
  tp: {
    usage: "tp <x> <y>",
    desc: "순간이동",
    run: (args, ctx) => {
      const room = getRoom();
      const x = Number(args[0]), y = Number(args[1]);
      if (!room || !Number.isFinite(x) || !Number.isFinite(y)) { ctx.print("사용법: tp <x> <y>"); return; }
      room.send("tp", { x, y });
    },
  },
  tune: {
    usage: "tune <경로> <값>",
    desc: "수치 실시간 변경 (예: tune jump.velocity -900)",
    run: (args, ctx) => {
      const room = getRoom();
      const path = args[0], value = Number(args[1]);
      if (!room || !path || !Number.isFinite(value)) { ctx.print("사용법: tune <경로> <값>"); return; }
      room.send("tune", { path, value });
      ctx.print(`tune ${path} = ${value}`);
    },
  },
  tuning: {
    usage: "tuning",
    desc: "현재 수치 전체 출력",
    run: (_a, ctx) => { for (const l of JSON.stringify(TUNING, null, 1).split("\n")) ctx.print(l); },
  },
  serverview: {
    usage: "serverview [주체] [1|2|3...] | off",
    desc: "디버그 뷰어 (help 참고)",
    run: (args, ctx) => {
      const sc = getScene();
      if (!sc) { ctx.print("게임 미실행 — join 먼저"); return; }
      if (args[0] === "off" || args.length === 0) { sc.svOpts.clear(); ctx.print("serverview off"); return; }
      const subjects = ["all", "player", "terrain", "monster"] as const;
      let i = 0;
      if ((subjects as readonly string[]).includes(args[0])) { sc.svSubject = args[0] as typeof sc.svSubject; i = 1; }
      else sc.svSubject = "all";
      sc.svOpts.clear();
      for (; i < args.length; i++) {
        const n = Number(args[i]);
        if (n >= 1 && n <= 3) sc.svOpts.add(n);
      }
      ctx.print(`serverview ${sc.svSubject} [${[...sc.svOpts].join(",")}]`);
    },
  },
  macro: {
    usage: "macro record|stop|play reset|play loop|status",
    desc: "키 입력 녹화·반복 (혼자 2인 테스트용 §11)",
    run: (args, ctx) => {
      const sc = getScene();
      if (!sc) { ctx.print("게임 미실행 — join 먼저"); return; }
      const sub = args[0];
      if (sub === "record") {
        sc.macroBuf = []; sc.macroIdx = 0;
        sc.macroStart = { x: sc.me.body.x, y: sc.me.body.y };
        sc.macroState = "recording";
        ctx.print("녹화 시작 — macro stop으로 종료");
      } else if (sub === "stop") {
        if (sc.macroState === "recording") ctx.print(`녹화 종료 (${sc.macroBuf.length}틱 저장)`);
        else ctx.print("재생 중단");
        sc.macroState = "idle";
      } else if (sub === "play") {
        if (sc.macroBuf.length === 0) { ctx.print("저장된 매크로 없음 — macro record 먼저"); return; }
        sc.macroMode = args[1] === "reset" ? "reset" : "loop";
        sc.macroIdx = 0;
        sc.macroState = "playing";
        ctx.print(`재생 시작 (${sc.macroMode}) — macro stop으로 중단`);
      } else {
        ctx.print(`상태: ${sc.macroState}` + (sc.macroState === "recording" ? ` (${sc.macroBuf.length}틱)` :
          sc.macroState === "playing" ? ` (${sc.macroMode}, ${sc.macroIdx}/${sc.macroBuf.length})` :
          ` (버퍼 ${sc.macroBuf.length}틱)`));
      }
    },
  },
  clear: { usage: "clear", desc: "출력 지우기", run: () => {} },
};

export async function execute(raw: string, ctx: CmdCtx): Promise<"clear" | void> {
  const [name, ...args] = raw.trim().split(/\s+/);
  if (!name) return;
  if (name === "clear") return "clear";
  const cmd = COMMANDS[name];
  if (!cmd) { ctx.print(`알 수 없는 명령: ${name} (help)`); return; }
  try { await cmd.run(args, ctx); }
  catch (e) { ctx.print(`오류: ${e instanceof Error ? e.message : String(e)}`); }
}

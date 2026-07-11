// 개발자 콘솔 명령 정의. UI(Console.tsx)와 분리해 명령만 추가하기 쉽게 유지.
import { joinBaseworld, leaveBaseworld, getRoom } from "../net/baseworld.js";
import { startGame, stopGame, setServerView } from "../game/boot.js";
import { TUNING } from "shared/physics";

export interface CmdCtx {
  print: (line: string) => void;
}

export interface Command {
  usage: string;
  desc: string;
  run: (args: string[], ctx: CmdCtx) => void | Promise<void>;
}

export const COMMANDS: Record<string, Command> = {
  help: {
    usage: "help",
    desc: "명령 목록",
    run: (_args, ctx) => {
      for (const c of Object.values(COMMANDS)) {
        ctx.print(`${c.usage.padEnd(24)} ${c.desc}`);
      }
    },
  },
  join: {
    usage: "join [닉네임]",
    desc: "baseworld 접속 + 게임 시작",
    run: async (args, ctx) => {
      const room = await joinBaseworld(args[0]);
      startGame(room);
      ctx.print(`접속: ${room.roomId} (sessionId ${room.sessionId})`);
      ctx.print("조작: ←→/AD 이동, Space/W/↑ 점프, ↓/S 내려찍기");
    },
  },
  leave: {
    usage: "leave",
    desc: "baseworld 나가기",
    run: async (_args, ctx) => {
      stopGame();
      await leaveBaseworld();
      ctx.print("나갔습니다.");
    },
  },
  players: {
    usage: "players",
    desc: "접속 중인 플레이어 목록",
    run: (_args, ctx) => {
      const room = getRoom();
      if (!room) { ctx.print("접속 중이 아닙니다."); return; }
      let n = 0;
      (room.state as any).players.forEach((p: any, id: string) => {
        const me = id === room.sessionId ? " (나)" : "";
        ctx.print(`${id}${me} ${p.nickname || "-"} (${Math.round(p.x)}, ${Math.round(p.y)})`);
        n++;
      });
      ctx.print(`총 ${n}명`);
    },
  },
  tp: {
    usage: "tp <x> <y>",
    desc: "순간이동 (서버 권위)",
    run: (args, ctx) => {
      const room = getRoom();
      if (!room) { ctx.print("접속 중이 아닙니다."); return; }
      const x = Number(args[0]);
      const y = Number(args[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        ctx.print("사용법: tp <x> <y>"); return;
      }
      room.send("tp", { x, y });
      ctx.print(`tp → (${x}, ${y})`);
    },
  },
  tune: {
    usage: "tune <경로> <값>",
    desc: "조작감 수치 실시간 변경 (예: tune jump.velocity -900)",
    run: (args, ctx) => {
      const room = getRoom();
      if (!room) { ctx.print("접속 중이 아닙니다."); return; }
      const path = args[0];
      const value = Number(args[1]);
      if (!path || !Number.isFinite(value)) { ctx.print("사용법: tune <경로> <값>"); return; }
      room.send("tune", { path, value });
      ctx.print(`tune 요청: ${path} = ${value} (서버 적용 후 전 클라 동기화. 경로는 tuning 참고)`);
    },
  },
  hitbox: {
    usage: "hitbox <가로> <세로>",
    desc: "플레이어 히트박스 크기 변경 (tune 단축)",
    run: (args, ctx) => {
      const room = getRoom();
      if (!room) { ctx.print("접속 중이 아닙니다."); return; }
      const w = Number(args[0]);
      const h = Number(args[1]);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        ctx.print("사용법: hitbox <가로px> <세로px>"); return;
      }
      room.send("tune", { path: "world.playerW", value: w });
      room.send("tune", { path: "world.playerH", value: h });
      ctx.print(`히트박스 → ${w}×${h}px (스펙: 키 105~125px 범위)`);
    },
  },
  serverview: {
    usage: "serverview [on|off]",
    desc: "서버 원본 좌표·히트박스 오버레이 (연출 없음)",
    run: (args, ctx) => {
      const on = args[0] === "on" ? true : args[0] === "off" ? false : undefined;
      const result = setServerView(on);
      if (result === null) { ctx.print("게임이 실행 중이 아닙니다. 먼저 join 하십시오."); return; }
      ctx.print(`서버 뷰: ${result ? "켜짐 (초록 = 서버 상태 그대로)" : "꺼짐"}`);
    },
  },
  tuning: {
    usage: "tuning",
    desc: "현재 조작감 수치(JSON) 출력",
    run: (_args, ctx) => {
      for (const line of JSON.stringify(TUNING, null, 2).split("\n")) ctx.print(line);
    },
  },
  clear: {
    usage: "clear",
    desc: "출력 지우기",
    run: () => { /* Console.tsx에서 특수 처리 */ },
  },
};

export async function execute(raw: string, ctx: CmdCtx): Promise<"clear" | void> {
  const [name, ...args] = raw.trim().split(/\s+/);
  if (!name) return;
  if (name === "clear") return "clear";
  const cmd = COMMANDS[name];
  if (!cmd) { ctx.print(`알 수 없는 명령: ${name} (help 참고)`); return; }
  try {
    await cmd.run(args, ctx);
  } catch (e) {
    ctx.print(`오류: ${e instanceof Error ? e.message : String(e)}`);
  }
}

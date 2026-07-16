// 간이 레이스 비공개 명령 — 백틱(`) 게임 콘솔에서 startstart / stopstop.
// help 목록에 노출되지 않도록 COMMANDS 등록 시 desc를 비워두지 않고… 는 불가능하므로
// (help는 COMMANDS 전체를 돌며 출력) 최소한의 설명만 둔다. 현재 접속된 룸(useRoomStore)에 전송.
import { COMMANDS } from "./commands.js";
import { useRoomStore } from "../store/room.js";

function send(msg: string, print: (l: string) => void): void {
  const room = useRoomStore.getState().room;
  if (!room) { print("접속된 방 없음(?quick 화면에서 실행)"); return; }
  room.send(msg);
  print(`${msg} 전송`);
}

COMMANDS.startstart = {
  usage: "startstart",
  desc: "(이벤트) 간이 레이스 시작",
  run: (_a, ctx) => send("startstart", ctx.print),
};

COMMANDS.stopstop = {
  usage: "stopstop",
  desc: "(이벤트) 대기 상태로 복귀",
  run: (_a, ctx) => send("stopstop", ctx.print),
};

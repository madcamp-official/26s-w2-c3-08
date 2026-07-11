// baseworld 접속 관리. 개발자 콘솔의 join/leave 명령이 사용한다.
import { Client, type Room } from "@colyseus/sdk";
import { applyTuning } from "shared/physics";

// 기본: 같은 호스트의 2567 포트. 터널/배포 시 VITE_SERVER_URL로 덮어쓴다.
const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;

let room: Room | null = null;

export function getRoom(): Room | null {
  return room;
}

export async function joinBaseworld(nickname?: string): Promise<Room> {
  if (room) throw new Error("이미 baseworld에 접속 중입니다. 먼저 leave 하십시오.");
  const client = new Client(SERVER_URL);
  room = await client.joinOrCreate("baseworld", { nickname });
  room.onLeave(() => { room = null; });
  // 서버가 확정·전파하는 런타임 튜닝을 예측 물리에도 반영
  room.onMessage("tune", (msg: { path: string; value: number }) => {
    applyTuning(msg.path, msg.value);
  });
  return room;
}

export async function leaveBaseworld(): Promise<void> {
  if (!room) return;
  const r = room;
  room = null;
  await r.leave();
}

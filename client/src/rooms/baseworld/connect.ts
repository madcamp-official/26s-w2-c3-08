// baseworld 접속 (콘솔 join/leave가 사용)
import { Client, type Room } from "@colyseus/sdk";
import { applyTuning } from "shared/physics";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;

let room: Room | null = null;
export function getRoom(): Room | null { return room; }

export async function joinBaseworld(nickname?: string): Promise<Room> {
  if (room) throw new Error("이미 접속 중입니다. leave 먼저.");
  const client = new Client(SERVER_URL);
  room = await client.joinOrCreate("baseworld", { nickname });
  room.onLeave(() => { room = null; });
  room.onMessage("tune", (m: { path: string; value: number }) => applyTuning(m.path, m.value));
  return room;
}

export async function leaveBaseworld(): Promise<void> {
  const r = room; room = null;
  if (r) await r.leave();
}

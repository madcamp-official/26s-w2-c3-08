// race 룸 접속 헬퍼. 방 목록은 @colyseus/sdk 0.17에 네이티브 조회가 없어 REST(/api/rooms)로.
import { Client, type Room } from "@colyseus/sdk";
import type { RaceJoinOptions, RoomListing } from "shared/race";
import { api } from "./rest.js";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;

let client: Client | null = null;
function getClient(): Client {
  if (!client) client = new Client(SERVER_URL);
  return client;
}

export function listRaceRooms(): Promise<RoomListing[]> {
  return api.get<RoomListing[]>("/api/rooms");
}

export function createRace(options: RaceJoinOptions): Promise<Room> {
  return getClient().create("race", options);
}

export function joinRaceById(colyseusRoomId: string, options: RaceJoinOptions): Promise<Room> {
  return getClient().joinById(colyseusRoomId, options);
}

/** 코드로 방 찾기(비밀방 입장) — 목록에서 code로 매칭 후 joinById */
export async function joinRaceByCode(code: string, password: string, userToken: string): Promise<Room> {
  const rooms = await listRaceRooms();
  const found = rooms.find((r) => r.code === code);
  if (!found) throw new Error("해당 코드의 방을 찾을 수 없습니다");
  return joinRaceById(found.colyseusRoomId, { userToken, password });
}

/** phase가 from과 달라질 때까지 대기 — 커튼 loadFn에서 사용 */
export function waitForPhaseChange(room: Room, from: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const onChange = (state: { phase: string }) => {
      if (state.phase !== from) {
        clearTimeout(timer);
        room.onStateChange.remove(onChange);
        resolve();
      }
    };
    const timer = setTimeout(() => {
      room.onStateChange.remove(onChange);
      reject(new Error("페이즈 전환 대기 시간 초과"));
    }, timeoutMs);
    room.onStateChange(onChange);
  });
}

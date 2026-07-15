// 현재 접속 중인 RaceRoom 인스턴스 보관 — 로비에서 접속한 뒤 대기실·결과 화면이 이어받아 쓴다.
// RaceState는 Colyseus가 살아있는 객체를 mutate하므로, version 카운터로 리렌더만 트리거하고
// 실제 값은 room.state에서 직접 읽는다(스냅샷 복제 안 함 — 대량 필드 불필요).
import { create } from "zustand";
import type { Room } from "@colyseus/sdk";

interface RoomStore {
  room: Room | null;
  version: number;
  setRoom: (room: Room | null) => void;
  bump: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  version: 0,
  setRoom: (room) => set({ room, version: 0 }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** room 세팅 + onStateChange 구독(리렌더 트리거) 일괄 처리 */
export function attachRoom(room: Room): void {
  useRoomStore.getState().setRoom(room);
  room.onStateChange(() => useRoomStore.getState().bump());
  room.onLeave(() => useRoomStore.getState().setRoom(null));
}

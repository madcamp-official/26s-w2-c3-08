// 유저 세션 — 토큰 localStorage 영속 (S1 재방문 판정).
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionAvatar { id: string; name: string; status: string }

interface SessionStore {
  token: string | null;
  userId: string | null;
  nickname: string | null;
  avatarAssetId: string | null;
  avatar: SessionAvatar | null;
  setSession: (s: { token?: string; userId: string; nickname: string; avatarAssetId: string | null; avatar: SessionAvatar | null }) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      token: null, userId: null, nickname: null, avatarAssetId: null, avatar: null,
      setSession: (s) => set((prev) => ({
        token: s.token ?? prev.token,
        userId: s.userId, nickname: s.nickname, avatarAssetId: s.avatarAssetId, avatar: s.avatar,
      })),
      clear: () => set({ token: null, userId: null, nickname: null, avatarAssetId: null, avatar: null }),
    }),
    { name: "session" },
  ),
);

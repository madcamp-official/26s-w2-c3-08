// 화면 전환 상태기계 — 라우터 없음(architecture.md 원안 유지, 규모상 불필요).
import { useEffect, useState } from "react";
import { MorphCurtain } from "../design/transition/index.js";
import "../design/global.css";
import { useSessionStore } from "../store/session.js";
import { api } from "../net/rest.js";
import { LoginScreen } from "./login/LoginScreen.js";
import { MainScreen } from "./main/MainScreen.js";
import { LobbyScreen } from "./lobby/LobbyScreen.js";
import { WaitingRoomScreen } from "./waiting/WaitingRoomScreen.js";
import { ResultScreen } from "./result/ResultScreen.js";

export type ScreenName = "login" | "main" | "lobby" | "waiting" | "result";

interface MeResponse {
  userId: string; nickname: string; avatarAssetId: string | null;
  avatar: { id: string; name: string; status: string } | null;
}

export function AppShell() {
  const [screen, setScreen] = useState<ScreenName | null>(null);   // null = 부팅 검증 중
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    // zustand persist는 localStorage 복원이 비동기다 — 복원 완료 전에 token을 읽으면 항상 null이라
    // 재방문 시에도 매번 로그인 화면이 뜨고 새 계정이 생기는 버그가 있었다. 복원 완료를 기다린다.
    const checkSession = async () => {
      const currentToken = useSessionStore.getState().token;
      if (!currentToken) { setScreen("login"); return; }
      try {
        const me = await api.get<MeResponse>("/api/me");
        setSession(me);
        setScreen("main");
      } catch {
        useSessionStore.getState().clear();
        setScreen("login");
      }
    };
    if (useSessionStore.persist.hasHydrated()) {
      void checkSession();
    } else {
      const unsub = useSessionStore.persist.onFinishHydration(() => {
        unsub();
        void checkSession();
      });
    }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <MorphCurtain />
      {screen === "login" && <LoginScreen onDone={() => setScreen("main")} />}
      {screen === "main" && <MainScreen onLobby={() => setScreen("lobby")} />}
      {screen === "lobby" && <LobbyScreen onJoined={() => setScreen("waiting")} />}
      {screen === "waiting" && (
        <WaitingRoomScreen onLeave={() => setScreen("lobby")} onFinished={() => setScreen("result")} />
      )}
      {screen === "result" && (
        <ResultScreen onLobby={() => setScreen("lobby")} onRestart={() => setScreen("waiting")} />
      )}
    </>
  );
}

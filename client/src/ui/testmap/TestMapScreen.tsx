// ?testmap — baseworld(TESTMAP) 접속해 테스트맵을 스프라이트 없이(폴백 사각형) 풀화면으로 열람.
// 에셋 파이프라인 전혀 안 씀. 조작: ←→/AD 이동, Space 점프, ↓ 웅크리기/내려찍기, Shift 달리기, K 잡기.
import { useEffect, useRef, useState } from "react";
import { startGame, stopGame } from "../../rooms/baseworld/boot.js";
import { joinBaseworld, leaveBaseworld } from "../../rooms/baseworld/connect.js";

export function TestMapScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        // connect.ts 경유 — 콘솔 명령(tp/players 등)이 보는 getRoom()에 등록되게.
        const room = await joinBaseworld(`V${Math.random().toString(36).slice(2, 5)}`);
        if (!alive) { void leaveBaseworld(); return; }
        startGame(room, hostRef.current ?? undefined, undefined, { noSprites: true });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "접속 실패");
      }
    })();
    return () => { alive = false; stopGame(); void leaveBaseworld(); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#1a1a24" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22 }}>{error}</div>
      )}
      <div style={{ position: "absolute", bottom: 10, left: 12, color: "#fff", fontSize: 12, opacity: 0.7, pointerEvents: "none" }}>
        ←→/AD 이동 · Space 점프 · ↓ 웅크리기/내려찍기 · Shift 달리기 · K 잡기
      </div>
    </div>
  );
}

// S3. 로비 — 공개방 목록(REST /api/rooms, 5초 폴링) + 생성/입장.
import { useEffect, useState } from "react";
import type { RoomListing } from "shared/race";
import { COLORS } from "../../design/tokens/index.js";
import { TileTexture, SpringButton, SpringPanel, StaggerList, StaggerItem } from "../../design/primitives/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { attachRoom } from "../../store/room.js";
import { listRaceRooms, createRace, joinRaceById, joinRaceByCode } from "../../net/raceRoom.js";

const POLL_MS = 5000;

export function LobbyScreen({ onJoined }: { onJoined: () => void }) {
  const token = useSessionStore((s) => s.token)!;
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinPrivateOpen, setJoinPrivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ref: createRef, trigger: triggerCreate } = useMorphTransition<HTMLButtonElement>();
  const { ref: joinRef, trigger: triggerJoin } = useMorphTransition<HTMLButtonElement>();

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const list = await listRaceRooms();
        if (alive) setRooms(list.filter((r) => r.isPublic));
      } catch { /* 폴링 실패는 조용히 다음 주기로 */ }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const enterRoom = async (join: () => Promise<import("@colyseus/sdk").Room>) => {
    try {
      const room = await join();
      attachRoom(room);
      onJoined();
    } catch (e) {
      setError(e instanceof Error ? e.message : "입장 실패");
      throw e;
    }
  };

  return (
    <div className="dsScreen" style={{ background: `linear-gradient(180deg, ${COLORS.skyBlue}, #1c3a5e)`, padding: 32 }}>
      <TileTexture />
      <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 className="dsPointFont" style={{ color: COLORS.buildYellow, fontSize: 28 }}>로비</h1>
          <div style={{ display: "flex", gap: 12 }}>
            <SpringButton ref={joinRef} variant="ghost" onClick={() => setJoinPrivateOpen(true)}>비밀방 입장</SpringButton>
            <SpringButton ref={createRef} onClick={() => setCreateOpen(true)}>방 생성하기</SpringButton>
          </div>
        </div>

        {error && <p style={{ color: COLORS.marioRed }}>{error}</p>}

        <StaggerList style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rooms.map((r) => {
            const joinable = r.status === "lobby" || r.status === "building" || r.status === "preview";
            return (
              <StaggerItem key={r.colyseusRoomId}>
                <div
                  onClick={() => joinable && void triggerJoin(() => enterRoom(() => joinRaceById(r.colyseusRoomId, { userToken: token })))}
                  style={{
                    background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 16,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: joinable ? "pointer" : "not-allowed", opacity: joinable ? 1 : 0.6, color: "#fff",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.name || `${r.hostNickname}님의 방`}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>{r.memberCount}/{r.maxPlayers}</div>
                  </div>
                  <div style={{ fontSize: 13, color: joinable ? COLORS.terrainGreen : COLORS.marioRed }}>
                    {joinable ? "대기 중" : "진행 중"}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
          {rooms.length === 0 && <p style={{ color: "#fff", opacity: 0.6 }}>열린 방이 없습니다.</p>}
        </StaggerList>
      </div>

      <CreateRoomPanel
        open={createOpen} onClose={() => setCreateOpen(false)}
        onCreate={(opts) => void triggerCreate(() => enterRoom(() => createRace({ userToken: token, ...opts }))).then(() => setCreateOpen(false))}
      />
      <JoinPrivatePanel
        open={joinPrivateOpen} onClose={() => setJoinPrivateOpen(false)}
        onJoin={(code, password) => void triggerJoin(() => enterRoom(() => joinRaceByCode(code, password, token))).then(() => setJoinPrivateOpen(false))}
      />
    </div>
  );
}

function CreateRoomPanel({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (opts: { name?: string; isPublic: boolean; password?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  return (
    <SpringPanel open={open} onClose={onClose} title="방 생성">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input placeholder="방 이름(선택)" value={name} onChange={(e) => setName(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "none" }} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          공개방
        </label>
        {!isPublic && (
          <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "none" }} />
        )}
        <SpringButton onClick={() => onCreate({ name: name || undefined, isPublic, password: isPublic ? undefined : password })}>
          생성
        </SpringButton>
      </div>
    </SpringPanel>
  );
}

function JoinPrivatePanel({ open, onClose, onJoin }: { open: boolean; onClose: () => void; onJoin: (code: string, password: string) => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  return (
    <SpringPanel open={open} onClose={onClose} title="비밀방 입장">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input placeholder="초대 코드" value={code} onChange={(e) => setCode(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "none" }} />
        <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "none" }} />
        <SpringButton onClick={() => onJoin(code, password)}>입장</SpringButton>
      </div>
    </SpringPanel>
  );
}

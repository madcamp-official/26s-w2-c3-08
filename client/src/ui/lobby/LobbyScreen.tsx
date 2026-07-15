// S3. 로비 — 확정 레이아웃(메인으로 얇은 바 → 방생성/공개방입장 풀블리드 2단 바 → 방 카드 목록).
// 스크롤 시: 메인으로 바는 완전히 찌부(height 0), 방생성/공개방입장 바는 스프링 압축.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RoomListing } from "shared/race";
import { YELLOW, INK, INK_SOFT, SIGNAL, SPRING_POP } from "../../design/tokens/index.js";
import { SketchButton, SketchBox, SketchPanel } from "../../design/sketch/index.js";
import { useMorphTransition } from "../../design/transition/index.js";
import { useSessionStore } from "../../store/session.js";
import { attachRoom } from "../../store/room.js";
import { playSound } from "../../audio/sfx.js";
import { listRaceRooms, createRace, joinRaceById, joinRaceByCode } from "../../net/raceRoom.js";

const POLL_MS = 5000;

export function LobbyScreen({ onJoined, onMain }: { onJoined: () => void; onMain: () => void }) {
  const token = useSessionStore((s) => s.token)!;
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinPrivateOpen, setJoinPrivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { ref: createRef, trigger: triggerCreate } = useMorphTransition<HTMLButtonElement>();
  const { ref: joinRef, trigger: triggerJoin } = useMorphTransition<HTMLButtonElement>();
  const listRef = useRef<HTMLDivElement>(null);

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

  const joinable = (r: RoomListing) => r.status === "lobby" || r.status === "building" || r.status === "preview";
  const quickJoin = () => {
    const first = rooms.find(joinable);
    if (!first) { setError("입장 가능한 공개방이 없습니다."); return; }
    void triggerJoin(() => enterRoom(() => joinRaceById(first.colyseusRoomId, { userToken: token })));
  };

  return (
    <div className="dsScreen" style={{ background: YELLOW.list, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 메인으로 — 스크롤 시 완전히 찌부 */}
      <motion.div animate={{ height: scrolled ? 0 : 40, opacity: scrolled ? 0 : 1 }} transition={SPRING_POP}
        style={{ overflow: "hidden", flex: "none", padding: scrolled ? 0 : "0 12px" }}>
        <div style={{ height: 40, paddingTop: 4 }}>
          <SketchButton fill={YELLOW.barLight} radius={8} onClick={() => { playSound("uiBack"); onMain(); }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>메인으로</span>
          </SketchButton>
        </div>
      </motion.div>

      {/* 방 생성하기 / 공개방 입장하기 — 풀블리드 2단 바, 스크롤 시 스프링 압축 */}
      <motion.div animate={{ height: scrolled ? 54 : 82 }} transition={SPRING_POP} style={{ flex: "none", padding: "4px 12px" }}>
        <SketchButton ref={createRef} onClick={() => { playSound("modalOpen"); setCreateOpen(true); }}>방 생성하기</SketchButton>
      </motion.div>
      <motion.div animate={{ height: scrolled ? 54 : 82 }} transition={SPRING_POP} style={{ flex: "none", padding: "4px 12px" }}>
        <SketchButton ref={joinRef} fill={YELLOW.card} onClick={quickJoin}>공개방 입장하기</SketchButton>
      </motion.div>

      {/* 목록 헤더: 비밀방 입장(코드) + 에러 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px 4px" }}>
        <span style={{ color: INK_SOFT, fontSize: 13 }}>공개방 {rooms.length}개</span>
        <button onClick={() => { playSound("modalOpen"); setJoinPrivateOpen(true); }}
          style={{ border: "none", background: "transparent", color: INK, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
          비밀방 입장
        </button>
      </div>
      {error && <p style={{ color: SIGNAL.danger, margin: "0 16px 4px", fontSize: 13 }}>{error}</p>}

      {/* 방 카드 목록 — 스크롤 컨테이너 */}
      <div ref={listRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
        style={{ flex: 1, overflowY: "auto", padding: "6px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {rooms.map((r) => {
          const ok = joinable(r);
          return (
            <SketchBox key={r.colyseusRoomId} fill={YELLOW.card} stroke={INK} radius={14} preset="frame"
              center={false} style={{ minHeight: 62, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.55 }}
              contentStyle={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", boxSizing: "border-box" }}
              onClick={() => ok && void triggerJoin(() => enterRoom(() => joinRaceById(r.colyseusRoomId, { userToken: token })))}>
              <span style={{ fontSize: 11, color: INK_SOFT, border: `1.5px solid ${INK_SOFT}`, borderRadius: 6, padding: "2px 7px" }}>
                {r.isPublic ? "공개" : "비밀"}
              </span>
              <span style={{ flex: 1, color: INK, fontSize: 15, fontWeight: 700 }}>{r.name || `${r.hostNickname}님의 방`}</span>
              <span style={{ color: INK_SOFT, fontSize: 13 }}>{r.memberCount}/{r.maxPlayers}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ok ? SIGNAL.ok : SIGNAL.danger }}>{ok ? "대기중" : "진행중"}</span>
            </SketchBox>
          );
        })}
        {rooms.length === 0 && <p style={{ color: INK_SOFT, textAlign: "center", marginTop: 24 }}>열린 방이 없습니다.</p>}
      </div>

      <CreateRoomPanel open={createOpen} onClose={() => setCreateOpen(false)}
        onCreate={(opts) => void triggerCreate(() => enterRoom(() => createRace({ userToken: token, ...opts }))).then(() => setCreateOpen(false))} />
      <JoinPrivatePanel open={joinPrivateOpen} onClose={() => setJoinPrivateOpen(false)}
        onJoin={(code, password) => void triggerJoin(() => enterRoom(() => joinRaceByCode(code, password, token))).then(() => setJoinPrivateOpen(false))} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "none", outline: "none", background: YELLOW.card,
  padding: "10px 14px", borderRadius: 8, fontSize: 15, color: INK, fontFamily: "var(--font-body)", boxSizing: "border-box",
};

function CreateRoomPanel({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (opts: { name?: string; isPublic: boolean; password?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  return (
    <SketchPanel open={open} onClose={onClose} title="방 생성">
      <div style={{ display: "flex", flexDirection: "column", gap: 14, color: INK }}>
        <input placeholder="방 이름(선택)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          공개방
        </label>
        {!isPublic && (
          <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        )}
        <div style={{ height: 52 }}>
          <SketchButton onClick={() => onCreate({ name: name || undefined, isPublic, password: isPublic ? undefined : password })}>생성</SketchButton>
        </div>
      </div>
    </SketchPanel>
  );
}

function JoinPrivatePanel({ open, onClose, onJoin }: { open: boolean; onClose: () => void; onJoin: (code: string, password: string) => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  return (
    <SketchPanel open={open} onClose={onClose} title="비밀방 입장">
      <div style={{ display: "flex", flexDirection: "column", gap: 14, color: INK }}>
        <input placeholder="초대 코드" value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
        <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        <div style={{ height: 52 }}>
          <SketchButton onClick={() => onJoin(code, password)}>입장</SketchButton>
        </div>
      </div>
    </SketchPanel>
  );
}

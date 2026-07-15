// testline 명령 — 자기 라인 혼자 테스트(완주 판정) 검증용 헤드리스 하네스.
// Phaser 없이 shared 물리(stepAvatar)를 setInterval로 돌리고 relay만 전송한다.
// 지형은 서버와 같은 mergeLines(shared/build)로 클라가 스스로 조립 — 동일 소스 원칙(§14).
// 골 깃대 접촉 시 goalLock(마리오식): 입력 잠금 → 깃대 스냅 → 하강 → 기단에서 대기.
import { Client, type Room } from "@colyseus/sdk";
import { TUNING, SOLID_ALL, type Terrain } from "shared/physics";
import { createAvatar, stepAvatar, type Avatar, type AvatarInput } from "shared/parts";
import { mergeLines, type MergedMap, type LineRecord } from "shared/build";
import { flagpoleRect, overlapsFlagpole, FLAGPOLE, TESTLINE_MSG } from "shared/race";
import { sendAvatarState } from "../netphysics/reconcile.js";
import { COMMANDS } from "./commands.js";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
const HTTP_BASE: string = SERVER_URL.replace(/^ws/, "http").replace(/\/$/, "");

const FIXED_MS = 1000 / TUNING.world.tickRate;
const T = TUNING.world.tileSize;

interface Harness {
  room: Room;
  merged: MergedMap;
  avatar: Avatar;
  timer: number;
  tick: number;
  sendAcc: number;
  auto: boolean;
  stuckMs: number;
  goalLock: boolean;
  print: (line: string) => void;
}
let h: Harness | null = null;

/** 정적 지형 + 라인 블록을 합친 충돌 지형 (하네스는 블록 상태변화 미반영 — 정적 근사) */
function harnessTerrain(m: MergedMap): Terrain {
  const solids = [...m.worldDef.terrain.solids];
  for (const b of m.worldDef.blocks) {
    if (b.visibility === "hidden" || b.switchReact) continue;   // 숨김·스위치 연동은 비충돌 근사
    solids.push({ x: b.x, y: b.y, w: b.w, h: b.h, faces: b.faces ?? SOLID_ALL });
  }
  return { solids, slopes: m.worldDef.terrain.slopes };
}

function step(): void {
  if (!h) return;
  h.tick++;
  const b = h.avatar.body;
  const goalRect = flagpoleRect(h.merged.goalFlagTiles, T, true);
  const baseY = (h.merged.goalFlagTiles.y + 1) * T;

  if (h.goalLock) {
    // 깃대 슬라이드: 기단 윗면까지 하강 후 대기 (완주 확정은 접촉 순간 서버가 이미 기록)
    b.vx = 0; b.vy = 0;
    b.x = goalRect.x + goalRect.w / 2;
    b.y = Math.min(b.y + FLAGPOLE.slideSpeedPxs * (FIXED_MS / 1000), baseY);
  } else {
    // 자동 주행: 오른쪽 홀드 + 막히면(속도 0 지속) 점프 펄스
    if (Math.abs(b.vx) < 5 && b.grounded) h.stuckMs += FIXED_MS;
    else if (b.grounded) h.stuckMs = 0;
    const jump = h.auto && h.stuckMs > 250 && h.stuckMs % 600 < FIXED_MS * 2;
    const input: AvatarInput = {
      left: false, right: h.auto, jump, down: false, run: h.auto, grab: false, tick: h.tick,
    };
    stepAvatar(h.avatar, input, FIXED_MS, harnessTerrain(h.merged));

    if (overlapsFlagpole(b.x, b.y, b.w, b.h, goalRect)) {
      h.goalLock = true;
      h.print(`깃대 접촉! (${Math.round(b.x / T)}타일) — 하강 연출 시작`);
    }
  }

  h.sendAcc += FIXED_MS;
  if (h.sendAcc >= 1000 / TUNING.net.sendRateHz) {
    h.sendAcc = 0;
    sendAvatarState(h.room, h.avatar, h.tick, false);
  }
}

COMMANDS.testline = {
  usage: "testline join <lineId> | auto on|off | state | leave",
  desc: "자기 라인 테스트(완주 판정) 헤드리스 하네스",
  run: async (a, ctx) => {
    const sub = a[0];
    if (sub === "join") {
      if (h) { ctx.print("이미 실행 중 — testline leave 먼저"); return; }
      const lineId = a[1];
      if (!lineId) { ctx.print("usage: testline join <lineId>"); return; }

      const sess = await fetch(`${HTTP_BASE}/api/session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "linetest" }),
      });
      if (!sess.ok) { ctx.print(`세션 발급 실패 ${sess.status}`); return; }
      const { token } = (await sess.json()) as { token: string };

      const lineRes = await fetch(`${HTTP_BASE}/api/lines/${lineId}`);
      if (!lineRes.ok) { ctx.print(`라인 조회 실패 ${lineRes.status}`); return; }
      const line = (await lineRes.json()) as LineRecord;
      const merged = mergeLines([line]);

      const room = await new Client(SERVER_URL).joinOrCreate("testline", { userToken: token, lineId });
      const avatar = createAvatar(merged.worldDef.spawn.x, merged.worldDef.spawn.y, TUNING.sizes.playerHeight);
      h = {
        room, merged, avatar, tick: 0, sendAcc: 0, auto: true, stuckMs: 0, goalLock: false,
        print: ctx.print,
        timer: window.setInterval(step, FIXED_MS),
      };
      room.onMessage(TESTLINE_MSG.testPassed, (m: { lineId: string }) =>
        ctx.print(`✅ 테스트 통과 기록됨 (lineId=${m.lineId}) — lines get ${m.lineId}로 확인 가능`));
      room.onMessage(TESTLINE_MSG.respawnAt, (m: { x: number; y: number }) => {
        if (!h) return;
        h.avatar = createAvatar(m.x, m.y, TUNING.sizes.playerHeight);
        h.stuckMs = 0;
        ctx.print(`추락 — 스폰(${Math.round(m.x / T)},${Math.round(m.y / T)}타일)으로 리스폰`);
      });
      room.onLeave(() => { if (h) { clearInterval(h.timer); h = null; ctx.print("testline 퇴장"); } });
      ctx.print(`testline 입장 — 라인 ${lineId}, 폭 ${line.tileLength}타일, auto=on (진행: testline state)`);
      return;
    }
    if (!h) { ctx.print("미실행 — testline join <lineId> 먼저"); return; }
    if (sub === "auto") { h.auto = a[1] !== "off"; ctx.print(`auto=${h.auto ? "on" : "off"}`); return; }
    if (sub === "state") {
      const b = h.avatar.body;
      ctx.print(`x=${Math.round(b.x / T)}타일 y=${Math.round(b.y / T)}타일 vx=${Math.round(b.vx)} goalLock=${h.goalLock} 골=${h.merged.goalFlagTiles.x}타일`);
      return;
    }
    if (sub === "leave") { const r = h.room; clearInterval(h.timer); h = null; await r.leave(); return; }
    ctx.print("usage: testline join <lineId> | auto on|off | state | leave");
  },
};

// lines 명령 — MapLine 저장/조회 API 검증용. COMMANDS에 자기 등록(side-effect import).
// commands.ts와 분리한 이유: 그 파일은 다른 세션(사운드)이 작업 중이라 충돌 회피.
import { COMMANDS } from "./commands.js";

const HTTP_BASE: string = (() => {
  const ws = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/$/, "");
  return `${location.protocol}//${location.hostname}:2567`;
})();

let token: string | null = null;

/** 시드된 시스템 에셋 id — server/src/seed/systemAssets.ts 삽입 순서 고정(1=졸라맨..4=기본 땅). 디버그 전용. */
const SEED_GROUND_ASSET_ID = "4";

COMMANDS.lines = {
  usage: "lines session <닉> | save | mine | pool | get <id>",
  desc: "MapLine 저장/조회 API 테스트",
  run: async (a, ctx) => {
    const sub = a[0];
    if (sub === "session") {
      const res = await fetch(`${HTTP_BASE}/api/session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: a[1] ?? "linetester" }),
      });
      if (!res.ok) { ctx.print(`세션 발급 실패 ${res.status}`); return; }
      const j = (await res.json()) as { token: string };
      token = j.token;
      ctx.print(`토큰 발급 완료 (${token.slice(0, 8)}...)`);
      return;
    }
    if (sub === "save") {
      if (!token) { ctx.print("lines session <닉> 먼저"); return; }
      const body = {
        name: "console-test",
        tileLength: 10,
        startFlag: { x: 1, y: 5 }, endFlag: { x: 8, y: 5 },
        placements: [
          { assetId: SEED_GROUND_ASSET_ID, x: 0, y: 6 },
          { assetId: SEED_GROUND_ASSET_ID, x: 1, y: 6 },
          { assetId: SEED_GROUND_ASSET_ID, x: 2, y: 6 },
        ],
        isPublic: true,
      };
      const res = await fetch(`${HTTP_BASE}/api/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-token": token },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      ctx.print(res.ok ? `저장 완료 lineId=${j.lineId}` : `저장 실패 ${res.status}: ${JSON.stringify(j)}`);
      return;
    }
    if (sub === "mine") {
      if (!token) { ctx.print("lines session <닉> 먼저"); return; }
      const res = await fetch(`${HTTP_BASE}/api/lines/mine`, { headers: { "x-user-token": token } });
      const j = await res.json();
      ctx.print(`내 라인 ${j.length}개: ${j.map((l: { id: string; name: string }) => `${l.id}:${l.name}`).join(", ")}`);
      return;
    }
    if (sub === "pool") {
      const res = await fetch(`${HTTP_BASE}/api/lines/pool`);
      const j = await res.json();
      ctx.print(`공개 라인 풀 ${j.length}개: ${j.map((l: { id: string; name: string }) => `${l.id}:${l.name}`).join(", ")}`);
      return;
    }
    if (sub === "get") {
      const res = await fetch(`${HTTP_BASE}/api/lines/${a[1]}`);
      const j = await res.json();
      ctx.print(res.ok ? `id=${j.id} placements=${j.placements.length}` : `실패 ${res.status}`);
      return;
    }
    ctx.print("usage: lines session <닉> | save | mine | pool | get <id>");
  },
};

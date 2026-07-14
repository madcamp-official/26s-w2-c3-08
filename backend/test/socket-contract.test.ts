import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Socket.IO realtime contract", () => {
  const source = readBackendFile("src/socket/index.ts");

  it("keeps V2 room readiness compatible with the client adapter", () => {
    expect(source).toMatch(/interface RoomPlayerState \{[\s\S]*isReady: boolean;/);
    expect(source).toMatch(/interface RoomReadyPayload extends PhasePayload \{[\s\S]*isReady\?: boolean;/);
    expect(source).toMatch(/socket\.on\("room:ready"/);
    expect(source).toMatch(/player\.isReady = payload\.isReady \?\? payload\.is_ready \?\? false;/);
    expect(source).toMatch(/io\.to\(room\.id\)\.emit\("room:state", toRoomSnapshot\(room\)\);/);
  });

  it("emits schema-complete room and result player payloads", () => {
    expect(source).toMatch(/isReady: isHost,/);
    expect(source).toMatch(/player\.isReady = true;/);
    expect(source).toMatch(/player\.isReady = false;/);
    expect(source).toMatch(/players: Array\.from\(room\.players\.values\(\)\)\.map\(\(player\) => \(\{/);
    expect(source).toMatch(/\.\.\.player,[\s\S]*raceDistanceToGoal: getRaceDistanceToGoal\(player\),/);
    expect(source).toMatch(/players: buildRaceResults\(room\),/);
  });

  it("keeps last dance and finish countdown visible in the room contract", () => {
    expect(source).toMatch(/applyApiLastDance\(room\.id\);/);
    expect(source).toMatch(/isOvertime: true,/);
    expect(source).toMatch(/isFinishCountdown: true,/);
    expect(source).toMatch(/getApiRoomRaceDurationMs\(room\.id\)/);
  });

  it("does not bypass REST late-join policy from realtime joins", () => {
    expect(source).toMatch(/"rejected" in apiRoomJoin/);
    expect(source).toMatch(/ROOM_NOT_JOINABLE/);
    expect(source).toMatch(/apiRoomJoin\.message/);
  });

  it("does not silently downgrade remote realtime to local transport", () => {
    expect(source).toMatch(/import \{ Server, type Socket \} from "socket\.io";/);
    expect(source).not.toMatch(/BroadcastChannel|localRealtime|mock/i);
  });

  it("uses the shared CORS origin parser for Socket.IO deployments", () => {
    expect(source).toMatch(/import \{ env, parseCorsOrigins \} from "\.\.\/config\/env\.js";/);
    expect(source).toMatch(/origin: parseCorsOrigins\(env\.CORS_ORIGIN\),/);
  });

  it("broadcasts backend asset job updates over the V2 Socket.IO contract", () => {
    expect(source).toMatch(/onApiAssetJobUpdated/);
    expect(source).toMatch(/io\.emit\("asset_job:updated", job\);/);
    expect(source).toMatch(/httpServer\.on\("close", unsubscribeAssetJobs\);/);
  });
});

function readBackendFile(path: string) {
  return readFileSync(join(backendRoot, path), "utf8");
}

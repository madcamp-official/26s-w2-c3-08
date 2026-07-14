import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  joinApiRoomFromRealtime,
  setApiRoomPhase,
  setApiRoomReadyFromRealtime,
} from "../src/http/routes/apiRoutes.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Socket.IO realtime contract", () => {
  const source = readBackendFile("src/socket/index.ts");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps V2 room readiness compatible with the client adapter", () => {
    expect(source).toMatch(/interface RoomPlayerState \{[\s\S]*isReady: boolean;/);
    expect(source).toMatch(/interface RoomReadyPayload extends PhasePayload \{[\s\S]*isReady\?: boolean;/);
    expect(source).toMatch(/socket\.on\("room:ready"/);
    expect(source).toMatch(/setApiRoomReadyFromRealtime\(room\.id, userId, isReady\);/);
    expect(source).toMatch(/player\.isReady = isReady;/);
    expect(source).toMatch(/io\.to\(room\.id\)\.emit\("room:state", toRoomSnapshot\(room\)\);/);
  });

  it("persists realtime ready changes into API room snapshots", () => {
    const roomId = `socket-ready-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    joinApiRoomFromRealtime(roomId, `${roomId}-host`, "Host");
    joinApiRoomFromRealtime(roomId, `${roomId}-guest`, "Guest");

    const readySnapshot = setApiRoomReadyFromRealtime(roomId, `${roomId}-guest`, true);

    expect(readySnapshot?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: `${roomId}-guest`,
          is_ready: true,
        }),
      ]),
    );

    const notReadySnapshot = setApiRoomReadyFromRealtime(roomId, `${roomId}-guest`, false);

    expect(notReadySnapshot?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: `${roomId}-guest`,
          is_ready: false,
        }),
      ]),
    );
    expect(setApiRoomReadyFromRealtime(roomId, `${roomId}-missing`, true)).toBeNull();
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
    expect(source).toMatch(/setApiRoomPhase\(room\.id, phase, durationMs\)/);
  });

  it("persists realtime race duration into API room phase snapshots", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T02:00:00.000Z"));

    const roomId = `socket-race-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    joinApiRoomFromRealtime(roomId, `${roomId}-host`, "Host");
    joinApiRoomFromRealtime(roomId, `${roomId}-guest`, "Guest");

    const room = setApiRoomPhase(roomId, "racing", 80_000);

    expect(room?.phase).toBe("racing");
    expect(room?.phaseEndsAt).toBe("2026-07-14T02:01:20.000Z");
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

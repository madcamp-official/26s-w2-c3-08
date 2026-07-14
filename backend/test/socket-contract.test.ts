import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adjustApiRoomPhaseEndsAtFromRealtime,
  finishApiRoomRaceFromRealtime,
  joinApiRoomFromRealtime,
  setApiRoomRaceProgressFromRealtime,
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

  it("persists phase-ready changes into API room snapshots", () => {
    expect(source).toMatch(/socket\.on\("phase:ready"/);
    expect(source).toMatch(/setApiRoomReadyFromRealtime\(room\.id, userId, true\);/);
    expect(source).toMatch(/ROOM_PLAYER_NOT_FOUND/);
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

  it("persists realtime time vote updates into API room phase snapshots", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T02:00:00.000Z"));

    const roomId = `socket-time-vote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    joinApiRoomFromRealtime(roomId, `${roomId}-host`, "Host");
    joinApiRoomFromRealtime(roomId, `${roomId}-guest`, "Guest");
    setApiRoomPhase(roomId, "building", 180_000);

    const extendedRoom = adjustApiRoomPhaseEndsAtFromRealtime(roomId, "building", 15);

    expect(extendedRoom?.phase).toBe("building");
    expect(extendedRoom?.phaseEndsAt).toBe("2026-07-14T02:03:15.000Z");

    const reducedRoom = adjustApiRoomPhaseEndsAtFromRealtime(roomId, "building", -15);

    expect(reducedRoom?.phaseEndsAt).toBe("2026-07-14T02:03:00.000Z");
    expect(adjustApiRoomPhaseEndsAtFromRealtime(roomId, "validating", 15)).toBeNull();
  });

  it("persists realtime race progress into API race snapshots", () => {
    const roomId = `socket-race-progress-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    joinApiRoomFromRealtime(roomId, `${roomId}-host`, "Host");
    joinApiRoomFromRealtime(roomId, `${roomId}-guest`, "Guest");

    const progressSnapshot = setApiRoomRaceProgressFromRealtime(roomId, `${roomId}-guest`, 64, 36);

    expect(progressSnapshot?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: `${roomId}-guest`,
          race_progress: 64,
          race_distance_to_goal: 36,
        }),
      ]),
    );
    expect(setApiRoomRaceProgressFromRealtime(roomId, `${roomId}-missing`, 64, 36)).toBeNull();
    expect(source).toMatch(/socket\.on\("race:position"/);
    expect(source).toMatch(/setApiRoomRaceProgressFromRealtime\(room\.id, userId, nextProgress, nextDistanceToGoal\);/);
  });

  it("persists realtime race finishes into API result snapshots", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T02:00:00.000Z"));

    const roomId = `socket-race-finish-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    joinApiRoomFromRealtime(roomId, `${roomId}-host`, "Host");
    joinApiRoomFromRealtime(roomId, `${roomId}-guest`, "Guest");
    setApiRoomPhase(roomId, "racing", 80_000);

    const hostFinish = finishApiRoomRaceFromRealtime(roomId, `${roomId}-host`, 73_400);

    expect(hostFinish?.room.phase).toBe("racing");
    expect(hostFinish?.room.phaseEndsAt).toBe("2026-07-14T02:00:10.000Z");
    expect(hostFinish?.result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: `${roomId}-host`, race_finished_at_ms: 73_400 }),
      ]),
    );

    const slowerDuplicate = finishApiRoomRaceFromRealtime(roomId, `${roomId}-host`, 90_000);

    expect(slowerDuplicate?.result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: `${roomId}-host`, race_finished_at_ms: 73_400 }),
      ]),
    );

    const fasterDuplicate = finishApiRoomRaceFromRealtime(roomId, `${roomId}-host`, 70_000);

    expect(fasterDuplicate?.result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: `${roomId}-host`, race_finished_at_ms: 70_000 }),
      ]),
    );

    const guestFinish = finishApiRoomRaceFromRealtime(roomId, `${roomId}-guest`, 81_250);

    expect(guestFinish?.room.phase).toBe("finished");
    expect(guestFinish?.room.phaseEndsAt).toBeNull();
    expect(guestFinish?.result.players[0]).toEqual(
      expect.objectContaining({ user_id: `${roomId}-host`, rank: 1 }),
    );
    expect(finishApiRoomRaceFromRealtime(roomId, `${roomId}-missing`, 81_250)).toBeNull();
    expect(source).toMatch(/finishApiRoomRaceFromRealtime\(room\.id, userId, payload\.finishTimeMs\);/);
    expect(source).toMatch(/finishSocketRoomFromApi\(io, room, apiFinish\.result\);/);
    expect(source).toMatch(/io\.to\(room\.id\)\.emit\("results:final", result\);/);
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

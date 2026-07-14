import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import { createAppConfig } from "../src/app.config.js";

const appConfig = createAppConfig();

describe("frontend v2 api", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  it("supports the remote frontend session, room, and game slice", async () => {
    const sessionResponse = await postJson(colyseus, "/api/session", { nickname: "릴레이러" });
    const session = sessionResponse.session;

    assert.equal(typeof session.id, "string");
    assert.equal(session.nickname, "릴레이러");
    assert.equal(typeof session.token, "string");

    const encodedSessionId = encodeURIComponent(session.id);

    await assertHttpStatus(colyseus, `/api/assets?user_id=${encodedSessionId}`, 401);
    await assertHttpStatus(colyseus, `/api/assets?user_id=someone-else`, 403, session.token);

    const assetsResponse = await getJson(colyseus, `/api/assets?user_id=${encodedSessionId}`, session.token);
    const assets = assetsResponse.assets;

    assert.equal(Array.isArray(assets), true);
    assert.equal(assets.some((asset: any) => asset.category === "platform"), true);

    const createdAssetResponse = await postJson(colyseus, "/api/assets/generate", {
        user_id: session.id,
        category: "platform",
        name: "테스트 발판",
        description: "테스트용 플랫폼",
        image: "data:image/png;base64,AA==",
        attrs: { kind: "platform" },
        width_cells: 2,
        height_cells: 1,
    }, session.token);

    assert.equal(createdAssetResponse.asset.user_id, session.id);
    assert.equal(createdAssetResponse.asset.category, "platform");
    assert.equal(createdAssetResponse.asset.status, "queued");
    assert.equal(createdAssetResponse.job.outputAssetId, createdAssetResponse.asset.id);
    assert.match(createdAssetResponse.job.id, new RegExp(`^job-${createdAssetResponse.asset.id}-asset-`));

    const createdJobsResponse = await getJson(
      colyseus,
      `/api/asset-jobs?user_id=${encodedSessionId}`,
      session.token,
    );

    assert.equal(
      createdJobsResponse.jobs.some((job: any) => job.id === createdAssetResponse.job.id),
      true,
    );

    const completedAssetResponse = await completeNextWorkerJob(
      colyseus,
      createdAssetResponse.asset.id,
      createdAssetResponse.job.id,
    );

    assert.equal(completedAssetResponse.asset.status, "ready");

    const avatarResponse = await postJson(colyseus, "/api/assets/generate", {
        user_id: session.id,
        category: "avatar",
        name: "테스트 아바타",
        description: "테스트용 아바타",
        image: "data:image/png;base64,AA==",
        attrs: { kind: "avatar" },
    }, session.token);
    const completedAvatarResponse = await completeNextWorkerJob(colyseus, avatarResponse.asset.id);

    assert.equal(completedAvatarResponse.asset.status, "ready");

    const equippedResponse = await postJson(
      colyseus,
      `/api/assets/${avatarResponse.asset.id}/equip-avatar`,
      { user_id: session.id },
      session.token,
    );

    assert.equal(equippedResponse.session.avatarAssetId, avatarResponse.asset.id);

    const regeneratedResponse = await postJson(
      colyseus,
      `/api/assets/${createdAssetResponse.asset.id}/sprites/static/regenerate`,
      { user_id: session.id },
      session.token,
    );

    assert.equal(regeneratedResponse.asset.id, createdAssetResponse.asset.id);
    assert.equal(
      regeneratedResponse.asset.sprites.find((sprite: any) => sprite.action === "static").status,
      "generating",
    );
    const jobsResponse = await getJson(
      colyseus,
      `/api/asset-jobs?user_id=${encodedSessionId}`,
      session.token,
    );

    assert.equal(Array.isArray(jobsResponse.jobs), true);
    assert.equal(
      jobsResponse.jobs.some((job: any) => job.outputAssetId === createdAssetResponse.asset.id),
      true,
    );
    await assertPostStatus(
      colyseus,
      `/api/assets/${createdAssetResponse.asset.id}/sprites/static/regenerate`,
      { user_id: session.id },
      429,
      session.token,
    );

    const roomResponse = await postJson(colyseus, "/api/rooms", {
        user_id: session.id,
        name: "테스트 방",
        is_public: true,
        max_players: 4,
    }, session.token);
    const room = roomResponse.room;

    assert.equal(room.name, "테스트 방");
    assert.equal(room.phase, "lobby");

    const guestSessionResponse = await postJson(colyseus, "/api/session", { nickname: "손님" });
    const guestSession = guestSessionResponse.session;

    await postJson(colyseus, `/api/rooms/${room.id}/join`, {
      user_id: guestSession.id,
    }, guestSession.token);

    await assertPostStatus(
      colyseus,
      `/api/rooms/${room.id}/start`,
      { user_id: session.id },
      409,
      session.token,
    );

    const readyResponse = await postJson(colyseus, `/api/rooms/${room.id}/ready`, {
      user_id: guestSession.id,
      is_ready: true,
    }, guestSession.token);

    assert.equal(readyResponse.room.id, room.id);
    assert.equal(
      readyResponse.players.find((player: any) => player.user_id === guestSession.id).is_ready,
      true,
    );

    const startedRoomResponse = await postJson(colyseus, `/api/rooms/${room.id}/start`, {
      user_id: session.id,
    }, session.token);

    assert.equal(startedRoomResponse.room.phase, "building");
    assert.equal(startedRoomResponse.room.players, 2);
    assert.equal(typeof startedRoomResponse.room.phaseEndsAt, "string");

    const buildingSnapshotResponse = await getJson(colyseus, `/api/rooms/${room.id}`, session.token);

    assert.equal(buildingSnapshotResponse.room.phase, "building");
    assert.equal(buildingSnapshotResponse.room.phaseEndsAt, startedRoomResponse.room.phaseEndsAt);
    assert.equal(buildingSnapshotResponse.players.length, 2);
    assert.equal(
      buildingSnapshotResponse.players.find((player: any) => player.user_id === session.id).is_ready,
      true,
    );
    assert.equal(
      buildingSnapshotResponse.players.find((player: any) => player.user_id === guestSession.id).is_ready,
      true,
    );

    const platform = assets.find((asset: any) => asset.category === "platform");
    const segmentResponse = await postJson(colyseus, `/api/rooms/${room.id}/segments`, {
        user_id: session.id,
        start_point: { x: 1, y: 7 },
        end_point: { x: 8, y: 7 },
        assets: [
          {
            asset_id: platform.id,
            x: 1,
            y: 8,
            width_cells: 3,
            height_cells: 1,
            rotation: 0,
          },
        ],
    }, session.token);
    const segment = segmentResponse.segment;

    assert.equal(segment.room_id, room.id);
    assert.equal(segment.creator_id, session.id);
    assert.equal(typeof segment.segment_hash, "string");
    assert.equal(segmentResponse.room.phase, "building");
    assert.equal(typeof segmentResponse.room.phaseEndsAt, "string");

    const guestSegmentResponse = await postJson(colyseus, `/api/rooms/${room.id}/segments`, {
        user_id: guestSession.id,
        start_point: { x: 8, y: 7 },
        end_point: { x: 15, y: 7 },
        assets: [
          {
            asset_id: platform.id,
            x: 8,
            y: 8,
            width_cells: 3,
            height_cells: 1,
            rotation: 0,
          },
        ],
    }, guestSession.token);
    const guestSegment = guestSegmentResponse.segment;

    assert.equal(guestSegment.room_id, room.id);
    assert.equal(guestSegment.creator_id, guestSession.id);
    assert.equal(guestSegmentResponse.room.phase, "validating");
    assert.equal(typeof guestSegmentResponse.room.phaseEndsAt, "string");

    const validatingSnapshotResponse = await getJson(colyseus, `/api/rooms/${room.id}`, guestSession.token);

    assert.equal(validatingSnapshotResponse.room.phase, "validating");
    assert.equal(validatingSnapshotResponse.room.phaseEndsAt, guestSegmentResponse.room.phaseEndsAt);
    assert.equal(validatingSnapshotResponse.players.length, 2);

    const segmentReloadResponse = await getJson(
      colyseus,
      `/api/rooms/${room.id}/segments/${segment.id}`,
      session.token,
    );

    assert.equal(segmentReloadResponse.segment.id, segment.id);
    assert.equal(segmentReloadResponse.segment.room_id, room.id);

    const validationResponse = await postJson(colyseus, `/api/rooms/${room.id}/segments/validate`, {
        user_id: session.id,
        segment_hash: segment.segment_hash,
        cleared: true,
        clear_time_ms: 61400,
    }, session.token);

    assert.equal(validationResponse.segment.is_validated, true);
    assert.equal(validationResponse.segment.clear_time_ms, 61400);
    assert.equal(validationResponse.room.phase, "validating");
    assert.equal(typeof validationResponse.room.phaseEndsAt, "string");

    const guestValidationResponse = await postJson(colyseus, `/api/rooms/${room.id}/segments/validate`, {
        user_id: guestSession.id,
        segment_hash: guestSegment.segment_hash,
        cleared: true,
        clear_time_ms: 59800,
    }, guestSession.token);

    assert.equal(guestValidationResponse.segment.is_validated, true);
    assert.equal(guestValidationResponse.segment.clear_time_ms, 59800);
    assert.equal(guestValidationResponse.room.phase, "merging");
    assert.equal(guestValidationResponse.room.phaseEndsAt, null);

    const mergingSnapshotResponse = await getJson(colyseus, `/api/rooms/${room.id}`, session.token);

    assert.equal(mergingSnapshotResponse.room.phase, "merging");
    assert.equal(mergingSnapshotResponse.room.phaseEndsAt, null);
    assert.equal(mergingSnapshotResponse.players.length, 2);

    const mergeResponse = await postJson(colyseus, `/api/rooms/${room.id}/merge`, {
      user_id: session.id,
    }, session.token);

    assert.equal(mergeResponse.mergedMap.room_id, room.id);
    assert.equal(Array.isArray(mergeResponse.mergedMap.placements), true);
    assert.equal(mergeResponse.mergedMap.used_fallback, false);
    assert.equal(mergeResponse.room.phase, "racing");
    assert.equal(typeof mergeResponse.room.phaseEndsAt, "string");

    const racingSnapshotResponse = await getJson(colyseus, `/api/rooms/${room.id}`, session.token);

    assert.equal(racingSnapshotResponse.room.phase, "racing");
    assert.equal(racingSnapshotResponse.room.phaseEndsAt, mergeResponse.room.phaseEndsAt);
    assert.equal(racingSnapshotResponse.players.length, 2);

    const mergedMapReloadResponse = await getJson(
      colyseus,
      `/api/rooms/${room.id}/merged-map?merged_map_id=${encodeURIComponent(mergeResponse.mergedMap.id)}`,
      session.token,
    );

    assert.equal(mergedMapReloadResponse.mergedMap.id, mergeResponse.mergedMap.id);
    assert.equal(mergedMapReloadResponse.mergedMap.room_id, room.id);

    const progressResponse = await postJson(colyseus, `/api/rooms/${room.id}/race/progress`, {
      user_id: guestSession.id,
      progress: 67,
      race_distance_to_goal: 33,
    }, guestSession.token);

    assert.equal(progressResponse.result.room_id, room.id);
    assert.equal(
      progressResponse.result.players.find((player: any) => player.user_id === guestSession.id).race_progress,
      67,
    );

    const raceFinishResponse = await postJson(colyseus, `/api/rooms/${room.id}/race/finish`, {
      user_id: session.id,
      finish_time_ms: 73400,
    }, session.token);

    assert.equal(raceFinishResponse.result.room_id, room.id);
    assert.equal(raceFinishResponse.result.players[0].user_id, session.id);
    assert.equal(raceFinishResponse.result.players[0].race_progress, 100);
    assert.equal(raceFinishResponse.result.players[0].rank, 1);
    assert.equal(raceFinishResponse.room.phase, "racing");

    await assertHttpStatus(colyseus, `/api/rooms/${room.id}/results`, 404, session.token);

    const guestRaceFinishResponse = await postJson(colyseus, `/api/rooms/${room.id}/race/finish`, {
      user_id: guestSession.id,
      finish_time_ms: 81200,
    }, guestSession.token);

    assert.equal(guestRaceFinishResponse.room.phase, "finished");

    const resultsResponse = await getJson(colyseus, `/api/rooms/${room.id}/results`, session.token);

    assert.equal(resultsResponse.result.room_id, room.id);
    assert.equal(resultsResponse.result.players[0].race_finished_at_ms, 73400);
    assert.equal(
      resultsResponse.result.players.find((player: any) => player.user_id === guestSession.id).race_progress,
      100,
    );

    const finishedSnapshotResponse = await getJson(colyseus, `/api/rooms/${room.id}`, session.token);

    assert.equal(finishedSnapshotResponse.room.phase, "finished");
    assert.equal(finishedSnapshotResponse.room.phaseEndsAt, null);
    assert.equal(finishedSnapshotResponse.players.length, 2);

    const outsiderSessionResponse = await postJson(colyseus, "/api/session", { nickname: "외부인" });

    await assertHttpStatus(
      colyseus,
      `/api/rooms/${room.id}`,
      404,
      outsiderSessionResponse.session.token,
    );
  });

  it("advances expired timed room phases when room snapshots are read", async () => {
    const hostResponse = await postJson(colyseus, "/api/session", { nickname: "타이머방장" });
    const guestResponse = await postJson(colyseus, "/api/session", { nickname: "타이머손님" });
    const host = hostResponse.session;
    const guest = guestResponse.session;
    const roomResponse = await postJson(colyseus, "/api/rooms", {
      user_id: host.id,
      name: "만료 전환 테스트",
      is_public: true,
      max_players: 2,
    }, host.token);
    const room = roomResponse.room;

    await postJson(colyseus, `/api/rooms/${room.id}/join`, {
      user_id: guest.id,
    }, guest.token);
    await postJson(colyseus, `/api/rooms/${room.id}/ready`, {
      user_id: guest.id,
      is_ready: true,
    }, guest.token);

    const startedRoomResponse = await withDateNow(1_000, () =>
      postJson(colyseus, `/api/rooms/${room.id}/start`, {
        user_id: host.id,
      }, host.token),
    );

    assert.equal(startedRoomResponse.room.phase, "building");
    assert.equal(startedRoomResponse.room.phaseEndsAt, new Date(181_000).toISOString());

    const roomsResponse = await withDateNow(181_000, () => getJson(colyseus, "/api/rooms", host.token));
    const advancedRoom = roomsResponse.rooms.find((candidate: any) => candidate.id === room.id);

    assert.equal(advancedRoom.phase, "validating");
    assert.equal(advancedRoom.phaseEndsAt, new Date(301_000).toISOString());
  });
});

async function getJson(
  colyseus: ColyseusTestServer<typeof appConfig>,
  path: string,
  token?: string,
) {
  const response = await fetch(`${baseUrl(colyseus)}${path}`, {
    headers: createHeaders(token),
  });

  return readJsonResponse(response);
}

async function postJson(
  colyseus: ColyseusTestServer<typeof appConfig>,
  path: string,
  body: Record<string, unknown>,
  token?: string,
  headers = createHeaders(token),
) {
  const response = await fetch(`${baseUrl(colyseus)}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return readJsonResponse(response);
}

async function assertHttpStatus(
  colyseus: ColyseusTestServer<typeof appConfig>,
  path: string,
  status: number,
  token?: string,
) {
  const response = await fetch(`${baseUrl(colyseus)}${path}`, {
    headers: createHeaders(token),
  });
  const text = await response.text();

  assert.equal(response.status, status, text);
}

async function completeNextWorkerJob(
  colyseus: ColyseusTestServer<typeof appConfig>,
  expectedAssetId: string,
  expectedJobId?: string,
) {
  const nextResponse = await fetch(`${baseUrl(colyseus)}/api/ai/jobs/next`, {
    headers: createWorkerHeaders(),
  });
  const nextText = await nextResponse.text();

  assert.equal(nextResponse.status, 200, nextText);

  const nextBody = JSON.parse(nextText);

  assert.equal(nextBody.job.assetId, expectedAssetId);
  if (expectedJobId) {
    assert.equal(nextBody.job.id, expectedJobId);
  }

  return postJson(
    colyseus,
    `/api/ai/jobs/${nextBody.job.id}/result`,
    {
      status: "ready",
      sheetUrl: `data:image/png;base64,${Buffer.from(expectedAssetId).toString("base64")}`,
    },
    undefined,
    createWorkerHeaders(),
  );
}

async function assertPostStatus(
  colyseus: ColyseusTestServer<typeof appConfig>,
  path: string,
  body: Record<string, unknown>,
  status: number,
  token?: string,
) {
  const response = await fetch(`${baseUrl(colyseus)}${path}`, {
    method: "POST",
    headers: createHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await response.text();

  assert.equal(response.status, status, text);
}

function createHeaders(token?: string) {
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function createWorkerHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer dev-worker-token",
    "x-worker-id": "test-worker",
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  assert.equal(response.ok, true, text);

  return JSON.parse(text);
}

function baseUrl(colyseus: ColyseusTestServer<typeof appConfig>) {
  return `http://127.0.0.1:${(colyseus.server as any).port}`;
}

async function withDateNow<T>(nowMs: number, callback: () => Promise<T>) {
  const originalDateNow = Date.now;

  Date.now = () => nowMs;

  try {
    return await callback();
  } finally {
    Date.now = originalDateNow;
  }
}

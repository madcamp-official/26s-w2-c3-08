import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackendReadiness, parseCorsOrigins } from "../src/config/env.js";
import { createApp } from "../src/http/app.js";
import { onApiAssetJobUpdated } from "../src/http/routes/apiRoutes.js";
import { validateInternalRouteToken } from "../src/http/routes/qwenRoutes.js";

describe("V2 HTTP API contract", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses single and comma-separated CORS origins for production deployments", () => {
    expect(parseCorsOrigins("https://relay.example.test")).toBe("https://relay.example.test");
    expect(parseCorsOrigins(" https://relay.example.test , https://admin.example.test , https://relay.example.test ")).toEqual([
      "https://relay.example.test",
      "https://admin.example.test",
    ]);
  });

  it("keeps public health non-sensitive and exposes sanitized readiness", async () => {
    const app = createApp();

    const healthResponse = await request(app)
      .get("/health")
      .expect(200);

    expect(healthResponse.body).toEqual({
      ok: true,
      service: "relay-map-maker-backend",
    });
    expect(healthResponse.body).not.toHaveProperty("qwen_base_url");

    const readinessResponse = await request(app)
      .get("/ready")
      .expect(200);

    expect(readinessResponse.body).toEqual(expect.objectContaining({
      ok: true,
      service: "relay-map-maker-backend",
      environment: "test",
    }));
    expect(readinessResponse.body.checks).toEqual(expect.objectContaining({
      corsOrigins: expect.any(Number),
      qwenConfigured: expect.any(Boolean),
      workerAuthConfigured: expect.any(Boolean),
      internalAuthConfigured: expect.any(Boolean),
      generatedAssetStaticServing: expect.any(Boolean),
    }));
    expect(JSON.stringify(readinessResponse.body)).not.toContain("172.10.5.138");
  });

  it("marks production readiness false when backend secrets are missing", () => {
    expect(getBackendReadiness({
      NODE_ENV: "production",
      PORT: 3000,
      CORS_ORIGIN: "https://relay.example.test",
      QWEN_BASE_URL: "http://qwen.internal:8001",
      QWEN_API_TOKEN: undefined,
      QWEN_TIMEOUT_MS: 45000,
      WORKER_TOKEN: undefined,
      INTERNAL_API_TOKEN: undefined,
      IMAGE_STORAGE_DIR: undefined,
      IMAGE_PUBLIC_PATH: "/generated-assets",
    })).toEqual(expect.objectContaining({
      ok: false,
      environment: "production",
    }));
    expect(getBackendReadiness({
      NODE_ENV: "production",
      PORT: 3000,
      CORS_ORIGIN: "https://relay.example.test,https://admin.example.test",
      QWEN_BASE_URL: "http://qwen.internal:8001",
      QWEN_API_TOKEN: "qwen-token-123456",
      QWEN_TIMEOUT_MS: 45000,
      WORKER_TOKEN: "worker-token-123456",
      INTERNAL_API_TOKEN: "internal-token-123456",
      IMAGE_STORAGE_DIR: "/srv/relay/generated-assets",
      IMAGE_PUBLIC_PATH: "/generated-assets",
    })).toEqual(expect.objectContaining({
      ok: true,
      checks: expect.objectContaining({
        corsOrigins: 2,
        qwenConfigured: true,
        workerAuthConfigured: true,
        internalAuthConfigured: true,
        generatedAssetStaticServing: true,
      }),
    }));
  });

  it("requires backend internal auth for production Qwen proxy routes", () => {
    expect(validateInternalRouteToken({
      nodeEnv: "production",
      expectedToken: undefined,
    })).toEqual(expect.objectContaining({
      ok: false,
      status: 503,
      code: "INTERNAL_API_TOKEN_MISSING",
    }));
    expect(validateInternalRouteToken({
      nodeEnv: "production",
      expectedToken: "internal-token",
      authorization: "Bearer wrong-token",
    })).toEqual(expect.objectContaining({
      ok: false,
      status: 401,
      code: "INTERNAL_API_AUTHENTICATION_FAILED",
    }));
    expect(validateInternalRouteToken({
      nodeEnv: "production",
      expectedToken: "internal-token",
      backendInternalToken: "internal-token",
    })).toEqual({ ok: true });
    expect(validateInternalRouteToken({
      nodeEnv: "test",
      expectedToken: undefined,
    })).toEqual({ ok: true });
  });

  it("supports remote session and warehouse asset job flow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));

    const app = createApp();
    const sessionResponse = await request(app)
      .post("/api/session")
      .send({ nickname: "릴레이러" })
      .expect(200);
    const session = sessionResponse.body.session;

    expect(session.id).toEqual(expect.any(String));
    expect(session.token).toEqual(expect.any(String));

    const validationResponse = await request(app)
      .post("/api/session/validate")
      .send({ token: session.token })
      .expect(200);

    expect(validationResponse.body.session.id).toBe(session.id);

    const nicknameResponse = await request(app)
      .post("/api/session/nickname")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ nickname: "새닉네임" })
      .expect(200);

    expect(nicknameResponse.body.session.nickname).toBe("새닉네임");

    const avatarResponse = await request(app)
      .post("/api/assets/generate")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        user_id: session.id,
        category: "avatar",
        name: "테스트 아바타",
        description: "테스트용 아바타",
        image: "data:image/png;base64,AA==",
      })
      .expect(202);
    const avatar = avatarResponse.body.asset;

    expect(avatar.status).toBe("queued");
    expect(avatarResponse.body.job.outputAssetId).toBe(avatar.id);

    const queuedJobsResponse = await request(app)
      .get(`/api/asset-jobs?user_id=${encodeURIComponent(session.id)}`)
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(queuedJobsResponse.body.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputAssetId: avatar.id,
          status: "queued",
        }),
        expect.objectContaining({
          outputAssetId: avatar.id,
          action: "idle",
          status: "queued",
        }),
      ]),
    );

    await request(app)
      .post(`/api/assets/${avatar.id}/equip-avatar`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ user_id: session.id })
      .expect(409);

    vi.setSystemTime(new Date("2026-07-14T00:00:09.000Z"));

    const readyAssetsResponse = await request(app)
      .get(`/api/assets?user_id=${encodeURIComponent(session.id)}`)
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);
    const readyAvatar = readyAssetsResponse.body.assets.find((asset: { id: string }) => asset.id === avatar.id);

    expect(readyAvatar.status).toBe("ready");

    const equippedResponse = await request(app)
      .post(`/api/assets/${avatar.id}/equip-avatar`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ user_id: session.id })
      .expect(200);

    expect(equippedResponse.body.session.avatarAssetId).toBe(avatar.id);

    const regeneratedResponse = await request(app)
      .post(`/api/assets/${avatar.id}/sprites/idle/regenerate`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ user_id: session.id })
      .expect(200);

    expect(regeneratedResponse.body.asset.status).toBe("generating");
    expect(
      regeneratedResponse.body.asset.sprites.find((sprite: { action: string }) => sprite.action === "idle").status,
    ).toBe("generating");

    await request(app)
      .post(`/api/assets/${avatar.id}/sprites/idle/regenerate`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ user_id: session.id })
      .expect(409);

    const generatingJobsResponse = await request(app)
      .get(`/api/asset-jobs?user_id=${encodeURIComponent(session.id)}`)
      .set("Authorization", `Bearer ${session.token}`)
      .expect(200);

    expect(generatingJobsResponse.body.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputAssetId: avatar.id,
          action: "idle",
          status: "generating",
        }),
      ]),
    );

    const pushedJobs: Array<{ outputAssetId?: string; action?: string | null; status?: string }> = [];
    const unsubscribePushedJobs = onApiAssetJobUpdated((job) => {
      pushedJobs.push(job);
    });

    const claimedJobResponse = await request(app)
      .get("/api/ai/jobs/next")
      .set("Authorization", "Bearer dev-worker-token")
      .set("x-worker-id", "contract-worker")
      .expect(200);

    expect(claimedJobResponse.body.job).toEqual(
      expect.objectContaining({
        outputAssetId: avatar.id,
        action: "idle",
        requestedActions: ["idle"],
      }),
    );
    expect(pushedJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputAssetId: avatar.id,
          action: "idle",
          status: "generating",
        }),
      ]),
    );

    const workerResultResponse = await request(app)
      .post(`/api/ai/jobs/${encodeURIComponent(claimedJobResponse.body.job.id)}/result`)
      .set("Authorization", "Bearer dev-worker-token")
      .send({
        status: "ready",
        sheetUrl: "https://assets.example.test/avatar-idle.png",
      })
      .expect(200);

    expect(workerResultResponse.body.job.status).toBe("ready");
    expect(workerResultResponse.body.asset.status).toBe("ready");
    expect(
      workerResultResponse.body.asset.sprites.find((sprite: { action: string }) => sprite.action === "idle"),
    ).toEqual(
      expect.objectContaining({
        status: "ready",
        sheetUrl: "https://assets.example.test/avatar-idle.png",
      }),
    );
    expect(pushedJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputAssetId: avatar.id,
          action: "idle",
          status: "ready",
        }),
      ]),
    );
    unsubscribePushedJobs();
  });

  it("supports remote room and game phase flow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T01:00:00.000Z"));

    const app = createApp();
    const hostResponse = await request(app)
      .post("/api/session")
      .send({ nickname: "호스트" })
      .expect(200);
    const guestResponse = await request(app)
      .post("/api/session")
      .send({ nickname: "게스트" })
      .expect(200);
    const host = hostResponse.body.session;
    const guest = guestResponse.body.session;

    const createRoomResponse = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        user_id: host.id,
        name: "원격 플로우 방",
        is_public: false,
        password: "1234",
        max_players: 2,
      })
      .expect(201);
    const room = createRoomResponse.body.room;

    expect(room.phase).toBe("lobby");
    expect(room.phaseEndsAt).toBeNull();
    expect(room.hostId).toBe(host.id);

    await request(app)
      .post(`/api/rooms/${room.id}/join`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ user_id: guest.id, password: "1234" })
      .expect(200);

    await request(app)
      .post(`/api/rooms/${room.id}/start`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ user_id: host.id })
      .expect(409);

    const readyResponse = await request(app)
      .post(`/api/rooms/${room.id}/ready`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ user_id: guest.id, is_ready: true })
      .expect(200);

    expect(readyResponse.body.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: host.id, isHost: true, isReady: true }),
        expect.objectContaining({ userId: guest.id, isHost: false, isReady: true }),
      ]),
    );

    const startResponse = await request(app)
      .post(`/api/rooms/${room.id}/start`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ user_id: host.id })
      .expect(200);

    expect(startResponse.body.room.phase).toBe("building");
    expect(startResponse.body.room.phaseEndsAt).toBe("2026-07-14T01:03:00.000Z");

    const snapshotResponse = await request(app)
      .get(`/api/rooms/${room.id}`)
      .set("Authorization", `Bearer ${host.token}`)
      .expect(200);

    expect(snapshotResponse.body.room.phase).toBe("building");
    expect(snapshotResponse.body.players).toHaveLength(2);

    const hostSegmentResponse = await request(app)
      .post(`/api/rooms/${room.id}/segments`)
      .set("Authorization", `Bearer ${host.token}`)
      .send(createSegmentPayload(host.id, 1))
      .expect(201);
    const hostSegment = hostSegmentResponse.body.segment;

    expect(hostSegmentResponse.body.room.phase).toBe("building");

    const guestSegmentResponse = await request(app)
      .post(`/api/rooms/${room.id}/segments`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send(createSegmentPayload(guest.id, 6))
      .expect(201);
    const guestSegment = guestSegmentResponse.body.segment;

    expect(guestSegmentResponse.body.room.phase).toBe("validating");
    expect(guestSegmentResponse.body.room.phaseEndsAt).toBe("2026-07-14T01:02:00.000Z");

    const fetchedSegmentResponse = await request(app)
      .get(`/api/rooms/${room.id}/segments/${hostSegment.id}`)
      .set("Authorization", `Bearer ${host.token}`)
      .expect(200);

    expect(fetchedSegmentResponse.body.segment.segmentHash).toBe(hostSegment.segmentHash);

    const hostValidationResponse = await request(app)
      .post(`/api/rooms/${room.id}/segments/validate`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        user_id: host.id,
        segment_hash: hostSegment.segmentHash,
        cleared: true,
        clear_time_ms: 61_400,
      })
      .expect(200);

    expect(hostValidationResponse.body.room.phase).toBe("validating");

    const guestValidationResponse = await request(app)
      .post(`/api/rooms/${room.id}/segments/validate`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({
        user_id: guest.id,
        segment_hash: guestSegment.segmentHash,
        cleared: true,
        clear_time_ms: 70_200,
      })
      .expect(200);

    expect(guestValidationResponse.body.room.phase).toBe("merging");

    const mergeResponse = await request(app)
      .post(`/api/rooms/${room.id}/merge`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ user_id: host.id })
      .expect(200);
    const mergedMap = mergeResponse.body.mergedMap;

    expect(mergeResponse.body.room.phase).toBe("racing");
    expect(mergeResponse.body.room.phaseEndsAt).toBe("2026-07-14T01:01:20.000Z");
    expect(mergedMap.roomId).toBe(room.id);
    expect(mergedMap.segments).toHaveLength(2);

    const fetchedMapResponse = await request(app)
      .get(`/api/rooms/${room.id}/merged-map?merged_map_id=${encodeURIComponent(mergedMap.id)}`)
      .set("Authorization", `Bearer ${host.token}`)
      .expect(200);

    expect(fetchedMapResponse.body.mergedMap.id).toBe(mergedMap.id);

    const progressResponse = await request(app)
      .post(`/api/rooms/${room.id}/race/progress`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        user_id: host.id,
        progress: 42,
        race_distance_to_goal: 58,
      })
      .expect(200);

    expect(progressResponse.body.result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: host.id, raceProgress: 42, raceDistanceToGoal: 58 }),
      ]),
    );

    const hostFinishResponse = await request(app)
      .post(`/api/rooms/${room.id}/race/finish`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ user_id: host.id, finish_time_ms: 73_400 })
      .expect(200);

    expect(hostFinishResponse.body.room.phase).toBe("racing");
    expect(hostFinishResponse.body.room.phaseEndsAt).toBe("2026-07-14T01:00:10.000Z");

    const guestFinishResponse = await request(app)
      .post(`/api/rooms/${room.id}/race/finish`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ user_id: guest.id, finish_time_ms: 81_250 })
      .expect(200);

    expect(guestFinishResponse.body.room.phase).toBe("finished");
    expect(guestFinishResponse.body.room.phaseEndsAt).toBeNull();
    expect(guestFinishResponse.body.result.players[0]).toEqual(
      expect.objectContaining({ userId: host.id, rank: 1 }),
    );

    const resultsResponse = await request(app)
      .get(`/api/rooms/${room.id}/results`)
      .set("Authorization", `Bearer ${host.token}`)
      .expect(200);

    expect(resultsResponse.body.room.phase).toBe("finished");
    expect(resultsResponse.body.result.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: host.id, raceFinishedAtMs: 73_400 }),
        expect.objectContaining({ userId: guest.id, raceFinishedAtMs: 81_250 }),
      ]),
    );
  });

  it("allows build-phase late join only before the last minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-14T02:00:00.000Z"));

    const app = createApp();
    const host = (await request(app).post("/api/session").send({ nickname: "방장" }).expect(200)).body.session;
    const guest = (await request(app).post("/api/session").send({ nickname: "손님" }).expect(200)).body.session;
    const late = (await request(app).post("/api/session").send({ nickname: "늦참" }).expect(200)).body.session;
    const tooLate = (await request(app).post("/api/session").send({ nickname: "관전" }).expect(200)).body.session;

    const room = (await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        user_id: host.id,
        name: "중간 입장 방",
        is_public: true,
        max_players: 4,
      })
      .expect(201)).body.room;

    await request(app)
      .post(`/api/rooms/${room.id}/join`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ user_id: guest.id })
      .expect(200);
    await request(app)
      .post(`/api/rooms/${room.id}/ready`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ user_id: guest.id, is_ready: true })
      .expect(200);
    await request(app)
      .post(`/api/rooms/${room.id}/start`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ user_id: host.id })
      .expect(200);

    vi.setSystemTime(new Date("2026-07-14T02:01:30.000Z"));

    const lateJoinResponse = await request(app)
      .post(`/api/rooms/${room.id}/join`)
      .set("Authorization", `Bearer ${late.token}`)
      .send({ user_id: late.id })
      .expect(200);

    expect(lateJoinResponse.body.room.phase).toBe("building");
    expect(lateJoinResponse.body.room.players).toBe(3);

    vi.setSystemTime(new Date("2026-07-14T02:02:10.000Z"));

    const blockedResponse = await request(app)
      .post(`/api/rooms/${room.id}/join`)
      .set("Authorization", `Bearer ${tooLate.token}`)
      .send({ user_id: tooLate.id })
      .expect(409);

    expect(blockedResponse.body.error.code).toBe("BUILD_LATE_JOIN_CLOSED");
  });
});

function createSegmentPayload(userId: string, startX: number) {
  return {
    user_id: userId,
    start_point: { x: startX, y: 8 },
    end_point: { x: startX + 4, y: 8 },
    assets: [
      {
        asset_id: "system-platform-grass",
        asset_category: "platform",
        x: startX,
        y: 9,
        width_cells: 2,
        height_cells: 1,
        rotation: 0,
      },
    ],
  };
}

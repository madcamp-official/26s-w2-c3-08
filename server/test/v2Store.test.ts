import assert from "assert";

import {
  advanceExpiredRoomPhase,
  claimNextAssetJob,
  completeAssetJob,
  createGeneratedAsset,
  createRoom,
  createSession,
  createV2InMemoryStore,
  equipAvatarAsset,
  getRaceResult,
  getRoomPhaseEndsAt,
  joinRoom,
  mergeRoomMap,
  recordRaceFinish,
  recordRaceProgress,
  regenerateAssetAction,
  retryAssetGeneration,
  saveMapSegment,
  setRoomReady,
  startRoom,
  validateMapSegment,
} from "../src/services/v2InMemoryStore.js";

describe("frontend v2 in-memory store", () => {
  it("handles warehouse asset actions with ownership and cooldown rules", () => {
    const store = createV2InMemoryStore();
    const session = createSession(store, "릴레이러");
    const failedAssetResult = createGeneratedAsset(store, {
      userId: session.id,
      category: "platform",
      name: "고장난 발판",
      description: "다시 시도할 에셋",
      status: "failed",
    });
    const avatarResult = createGeneratedAsset(store, {
      userId: session.id,
      category: "avatar",
      name: "테스트 아바타",
      description: "장착할 아바타",
    });
    const readyAssetResult = createGeneratedAsset(store, {
      userId: session.id,
      category: "monster",
      name: "테스트 몬스터",
      description: "재생성할 에셋",
    });
    const failedAsset = failedAssetResult.asset;
    const avatar = avatarResult.asset;
    const readyAsset = readyAssetResult.asset;
    const otherSession = createSession(store, "다른유저");

    const retryResult = retryAssetGeneration(store, session, failedAsset.id);
    const equipResult = equipAvatarAsset(store, session, avatar.id);
    const deniedRetryResult = retryAssetGeneration(store, otherSession, failedAsset.id);
    const regeneratedResult = regenerateAssetAction(store, session, readyAsset.id, "static", 1_000);
    const cooldownResult = regenerateAssetAction(store, session, readyAsset.id, "static", 2_000);
    const claimedRetryJob = claimNextAssetJob(store, "worker-a", 3_000);
    const completedRetryJob = claimedRetryJob
      ? completeAssetJob(store, claimedRetryJob.job.id, {
          status: "ready",
          sheetUrl: "data:image/png;base64,retry",
        }, 4_000)
      : null;
    const claimedSpriteJob = claimNextAssetJob(store, "worker-a", 5_000);
    const completedSpriteJob = claimedSpriteJob
      ? completeAssetJob(store, claimedSpriteJob.job.id, {
          status: "ready",
          sheetUrl: "data:image/png;base64,sprite",
        }, 6_000)
      : null;
    const noJobAfterCompletion = claimNextAssetJob(store, "worker-a", 7_000);

    assert.equal(claimedRetryJob?.job.outputAssetId, failedAsset.id);
    assert.equal(claimedRetryJob?.job.leasedBy, "worker-a");
    assert.equal(claimedSpriteJob?.job.outputAssetId, readyAsset.id);
    assert.equal(claimedSpriteJob?.job.action, "static");
    assert.equal(noJobAfterCompletion, null);

    const leaseExpiredAssetResult = createGeneratedAsset(store, {
      userId: session.id,
      category: "obstacle",
      name: "임대 만료 테스트",
      description: "워커 lease 만료 테스트",
      status: "failed",
    });
    const leaseExpiredAsset = leaseExpiredAssetResult.asset;
    const expiredJob = retryAssetGeneration(store, session, leaseExpiredAsset.id);
    const claimedExpiredJob = claimNextAssetJob(store, "worker-a", 8_000);
    const reclaimedExpiredJob = claimNextAssetJob(
      store,
      "worker-b",
      (claimedExpiredJob?.job.leaseExpiresAtMs ?? 8_000) + 1,
    );

    assert.equal(retryResult.ok, true);
    assert.equal(retryResult.ok && retryResult.asset.status, "generating");
    assert.equal(equipResult.ok, true);
    assert.equal(equipResult.ok && equipResult.session.avatarAssetId, avatar.id);
    assert.equal(deniedRetryResult.ok, false);
    assert.equal(deniedRetryResult.ok === false && deniedRetryResult.status, 403);
    assert.equal(regeneratedResult.ok, true);
    assert.equal(regeneratedResult.ok && regeneratedResult.asset.status, "ready");
    assert.equal(
      regeneratedResult.ok &&
        regeneratedResult.asset.sprites.find((sprite) => sprite.action === "static")?.status,
      "generating",
    );
    assert.equal(cooldownResult.ok, false);
    assert.equal(cooldownResult.ok === false && cooldownResult.status, 429);
    assert.equal(completedRetryJob?.ok, true);
    assert.equal(completedRetryJob?.ok && completedRetryJob.job.status, "ready");
    assert.equal(completedSpriteJob?.ok, true);
    assert.equal(completedSpriteJob?.ok && completedSpriteJob.job.status, "ready");
    assert.equal(store.assets.get(failedAsset.id)?.status, "ready");
    assert.equal(
      store.assets.get(readyAsset.id)?.sprites.find((sprite) => sprite.action === "static")?.status,
      "ready",
    );
    assert.equal(expiredJob.ok, true);
    assert.equal(claimedExpiredJob?.job.leasedBy, "worker-a");
    assert.equal(reclaimedExpiredJob?.job.leasedBy, "worker-b");
  });

  it("advances expired game phases without fabricating missing player submissions", () => {
    const store = createV2InMemoryStore();
    const host = createSession(store, "방장");
    const guest = createSession(store, "손님");
    const room = createRoom(store, {
      userId: host.id,
      name: "타이머 테스트",
      isPublic: true,
      maxPlayers: 2,
    });

    assert.equal(joinRoom(store, room.id, guest.id).ok, true);
    assert.equal(startRoom(store, room.id, host.id).ok, false);
    assert.equal(setRoomReady(store, room.id, guest.id, true).ok, true);
    assert.equal(startRoom(store, room.id, host.id).ok, true);

    const startedRoom = store.rooms.get(room.id);

    assert.ok(startedRoom);
    store.rooms.set(room.id, {
      ...startedRoom,
      createdAtMs: 1_000,
    });

    const beforeExpiry = advanceExpiredRoomPhase(store, room.id, 180_999);

    assert.equal(beforeExpiry?.phase, "building");
    assert.equal(store.segments.size, 0);

    const validating = advanceExpiredRoomPhase(store, room.id, 181_000);

    assert.equal(validating?.phase, "validating");
    assert.equal(validating && getRoomPhaseEndsAt(validating), new Date(301_000).toISOString());
    assert.equal(store.segments.size, 0);
    assert.equal(
      saveMapSegment(store, {
        roomId: room.id,
        userId: host.id,
        startPoint: { x: 1, y: 7 },
        endPoint: { x: 8, y: 7 },
        assets: [],
      }),
      null,
    );

    const merging = advanceExpiredRoomPhase(store, room.id, 301_000);

    assert.equal(merging?.phase, "merging");
    assert.equal(mergeRoomMap(store, room.id), null);
  });

  it("allows build-phase late join until the final minute", () => {
    const originalNow = Date.now;
    const store = createV2InMemoryStore();
    const host = createSession(store, "방장");
    const guest = createSession(store, "손님");
    const late = createSession(store, "늦참");
    const tooLate = createSession(store, "관전");
    const room = createRoom(store, {
      userId: host.id,
      name: "중간 입장 테스트",
      isPublic: true,
      maxPlayers: 4,
    });

    try {
      assert.equal(joinRoom(store, room.id, guest.id).ok, true);
      assert.equal(setRoomReady(store, room.id, guest.id, true).ok, true);
      assert.equal(startRoom(store, room.id, host.id).ok, true);

      const buildingRoom = store.rooms.get(room.id);

      assert.ok(buildingRoom);
      store.rooms.set(room.id, {
        ...buildingRoom,
        createdAtMs: 1_000,
      });

      Date.now = () => 121_000;
      const lateJoin = joinRoom(store, room.id, late.id);

      assert.equal(lateJoin.ok, true);
      assert.equal(lateJoin.ok && lateJoin.room.phase, "building");
      assert.equal(lateJoin.ok && lateJoin.room.players, 3);

      Date.now = () => 122_000;
      const blockedJoin = joinRoom(store, room.id, tooLate.id);

      assert.equal(blockedJoin.ok, false);
      assert.equal(blockedJoin.ok === false && blockedJoin.status, 409);
      assert.match(blockedJoin.ok === false ? blockedJoin.message : "", /1분 미만/);
    } finally {
      Date.now = originalNow;
    }
  });

  it("uses a thirty second last dance before ranking no-finisher races", () => {
    const store = createV2InMemoryStore();
    const host = createSession(store, "레이서A");
    const guest = createSession(store, "레이서B");
    const room = createRoom(store, {
      userId: host.id,
      name: "레이스 타임아웃",
      isPublic: true,
      maxPlayers: 2,
    });

    assert.equal(joinRoom(store, room.id, guest.id).ok, true);
    assert.equal(setRoomReady(store, room.id, guest.id, true).ok, true);
    assert.equal(startRoom(store, room.id, host.id).ok, true);

    const hostSegment = saveMapSegment(store, {
      roomId: room.id,
      userId: host.id,
      startPoint: { x: 1, y: 7 },
      endPoint: { x: 8, y: 7 },
      assets: [{ assetId: "system-platform-solid", x: 1, y: 8 }],
    });
    const guestSegment = saveMapSegment(store, {
      roomId: room.id,
      userId: guest.id,
      startPoint: { x: 8, y: 7 },
      endPoint: { x: 15, y: 7 },
      assets: [{ assetId: "system-platform-solid", x: 8, y: 8 }],
    });

    assert.ok(hostSegment);
    assert.ok(guestSegment);
    assert.equal(store.rooms.get(room.id)?.phase, "validating");
    assert.ok(validateMapSegment(store, {
      roomId: room.id,
      userId: host.id,
      segmentHash: hostSegment.segmentHash,
      cleared: true,
      clearTimeMs: 31_000,
    }));
    assert.ok(validateMapSegment(store, {
      roomId: room.id,
      userId: guest.id,
      segmentHash: guestSegment.segmentHash,
      cleared: true,
      clearTimeMs: 29_000,
    }));
    assert.equal(store.rooms.get(room.id)?.phase, "merging");
    assert.ok(mergeRoomMap(store, room.id));
    assert.equal(store.rooms.get(room.id)?.phase, "racing");
    const raceRoomAfterMerge = store.rooms.get(room.id)!;
    assert.equal(
      getRoomPhaseEndsAt(raceRoomAfterMerge),
      new Date(raceRoomAfterMerge.createdAtMs + 80_000).toISOString(),
    );
    assert.ok(recordRaceProgress(store, {
      roomId: room.id,
      userId: guest.id,
      progress: 64,
      raceDistanceToGoal: 36,
    }));

    const racingRoom = store.rooms.get(room.id);

    assert.ok(racingRoom);
    store.rooms.set(room.id, {
      ...racingRoom,
      createdAtMs: 1_000,
    });

    const lastDance = advanceExpiredRoomPhase(store, room.id, 81_000);

    assert.equal(lastDance?.phase, "racing");
    assert.equal(lastDance?.hasOvertime, true);
    assert.equal(lastDance && getRoomPhaseEndsAt(lastDance), new Date(111_000).toISOString());

    const finished = advanceExpiredRoomPhase(store, room.id, 111_000);
    const result = getRaceResult(store, room.id);
    const guestResult = result?.players.find((player) => player.userId === guest.id);

    assert.equal(finished?.phase, "finished");
    assert.equal(finished && getRoomPhaseEndsAt(finished), null);
    assert.ok(result);
    assert.equal(result.players.length, 2);
    assert.equal(guestResult?.raceProgress, 64);
    assert.equal(guestResult?.rank, 1);
    assert.equal(
      recordRaceFinish(store, {
        roomId: room.id,
        userId: host.id,
        finishTimeMs: 82_000,
      }),
      null,
    );
  });

  it("keeps racing open for ten seconds after the first finisher", () => {
    const store = createV2InMemoryStore();
    const host = createSession(store, "레이서A");
    const guest = createSession(store, "레이서B");
    const room = createRoom(store, {
      userId: host.id,
      name: "첫 완주 카운트다운",
      isPublic: true,
      maxPlayers: 2,
    });

    assert.equal(joinRoom(store, room.id, guest.id).ok, true);
    assert.equal(setRoomReady(store, room.id, guest.id, true).ok, true);
    assert.equal(startRoom(store, room.id, host.id).ok, true);

    const hostSegment = saveMapSegment(store, {
      roomId: room.id,
      userId: host.id,
      startPoint: { x: 1, y: 7 },
      endPoint: { x: 8, y: 7 },
      assets: [{ assetId: "system-platform-solid", x: 1, y: 8 }],
    });
    const guestSegment = saveMapSegment(store, {
      roomId: room.id,
      userId: guest.id,
      startPoint: { x: 8, y: 7 },
      endPoint: { x: 15, y: 7 },
      assets: [{ assetId: "system-platform-solid", x: 8, y: 8 }],
    });

    assert.ok(hostSegment);
    assert.ok(guestSegment);
    assert.ok(validateMapSegment(store, {
      roomId: room.id,
      userId: host.id,
      segmentHash: hostSegment.segmentHash,
      cleared: true,
      clearTimeMs: 31_000,
    }));
    assert.ok(validateMapSegment(store, {
      roomId: room.id,
      userId: guest.id,
      segmentHash: guestSegment.segmentHash,
      cleared: true,
      clearTimeMs: 29_000,
    }));
    assert.ok(mergeRoomMap(store, room.id));

    const result = recordRaceFinish(store, {
      roomId: room.id,
      userId: host.id,
      finishTimeMs: 42_000,
    });
    const racingRoom = store.rooms.get(room.id);

    assert.ok(result);
    assert.equal(racingRoom?.phase, "racing");
    assert.equal(racingRoom && getRoomPhaseEndsAt(racingRoom), new Date(racingRoom.createdAtMs + 10_000).toISOString());

    const finalResult = recordRaceFinish(store, {
      roomId: room.id,
      userId: guest.id,
      finishTimeMs: 49_000,
    });

    assert.ok(finalResult);
    assert.equal(store.rooms.get(room.id)?.phase, "finished");
    assert.equal(finalResult.players[0].userId, host.id);
  });
});

import type { Application, Request, Response } from "express";
import express from "express";
import {
  advanceExpiredRoomPhase,
  advanceExpiredRooms,
  claimNextAssetJob,
  completeAssetJob,
  consumeDeviceCode,
  createGeneratedAsset,
  createRoom,
  createSession,
  createV2InMemoryStore,
  equipAvatarAsset,
  getMergedMap,
  getMapSegment,
  getRoomById,
  getRaceResult,
  getRoomPhaseEndsAt,
  getRoomSnapshot,
  getSessionByToken,
  issueDeviceCode,
  joinPublicRoom,
  joinRoom,
  leaveRoom,
  listAssetJobsForUser,
  listAssetsForUser,
  mergeRoomMap,
  regenerateAssetAction,
  retryAssetGeneration,
  recordRaceFinish,
  recordRaceProgress,
  saveMapSegment,
  setRoomReady,
  startRoom,
  updateSessionNickname,
  validateMapSegment,
  type AssetCategory,
  type AssetSpriteAction,
} from "../services/v2InMemoryStore.js";

const store = createV2InMemoryStore();

export function registerV2ApiRoutes(app: Application) {
  app.use("/api", express.json({ limit: "12mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "relay-map-maker-v2" });
  });

  app.post("/api/session", (req, res) => {
    const nickname = readString(req.body?.nickname);

    if (!nickname || nickname.trim().length < 1 || nickname.trim().length > 12) {
      sendError(res, 400, "INVALID_NICKNAME", "닉네임은 1~12자로 입력해주세요.");
      return;
    }

    res.json({ session: createSession(store, nickname) });
  });

  app.post("/api/session/validate", (req, res) => {
    const token = readString(req.body?.token) ?? readBearerToken(req);
    const session = getSessionByToken(store, token);

    if (!session) {
      sendError(res, 401, "SESSION_EXPIRED", "세션이 만료되었어요.");
      return;
    }

    res.json({ session });
  });

  app.post("/api/session/nickname", (req, res) => {
    const session = requireSession(req, res);
    const nickname = readString(req.body?.nickname);

    if (!session) {
      return;
    }

    if (!nickname || nickname.trim().length < 1 || nickname.trim().length > 12) {
      sendError(res, 400, "INVALID_NICKNAME", "닉네임은 1~12자로 입력해주세요.");
      return;
    }

    const updatedSession = updateSessionNickname(store, session.token, nickname);

    if (!updatedSession) {
      sendError(res, 401, "SESSION_EXPIRED", "세션이 만료되었어요.");
      return;
    }

    res.json({ session: updatedSession });
  });

  app.get("/api/assets", (req, res) => {
    const userId = readString(req.query.user_id) ?? readString(req.query.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    res.json({ assets: listAssetsForUser(store, userId) });
  });

  app.get("/api/asset-jobs", (req, res) => {
    const userId = readString(req.query.user_id) ?? readString(req.query.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    res.json({
      jobs: listAssetJobsForUser(store, userId).map(toAssetJobResponse),
    });
  });

  app.post("/api/assets/generate", (req, res) => {
    const userId = readString(req.body?.userId) ?? readString(req.body?.user_id);
    const category = normalizeAssetCategory(readString(req.body?.category));
    const name = readString(req.body?.name);
    const description = readString(req.body?.description) ?? "";

    if (!userId || !category || !name) {
      sendError(res, 400, "INVALID_ASSET_REQUEST", "에셋 생성 요청을 확인해주세요.");
      return;
    }

    if (category === "item") {
      sendError(res, 400, "INVALID_ASSET_CATEGORY", "item은 사용자 제작 에셋으로 만들 수 없어요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    const result = createGeneratedAsset(store, {
      userId,
      category,
      name,
      description,
      attrs: readAttrs(req.body?.attrs),
      widthCells: readNumber(req.body?.widthCells) ?? readNumber(req.body?.width_cells),
      heightCells: readNumber(req.body?.heightCells) ?? readNumber(req.body?.height_cells),
      remixOfId: readString(req.body?.remixOfId) ?? readString(req.body?.remix_of_id) ?? null,
      image: readString(req.body?.image),
      status: "queued",
    });

    res.status(201).json({
      asset: result.asset,
      job: toAssetJobResponse(result.job),
    });
  });

  app.post("/api/assets/:assetId/equip-avatar", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    const session = requireSession(req, res, userId);

    if (!session) {
      return;
    }

    const result = equipAvatarAsset(store, session, req.params.assetId);

    if (!result.ok) {
      sendError(res, result.status, "ASSET_ACTION_FAILED", result.message);
      return;
    }

    res.json({ session: result.session });
  });

  app.post("/api/assets/:assetId/retry", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    const session = requireSession(req, res, userId);

    if (!session) {
      return;
    }

    const result = retryAssetGeneration(store, session, req.params.assetId);

    if (!result.ok) {
      sendError(res, result.status, "ASSET_ACTION_FAILED", result.message);
      return;
    }

    res.json({ asset: result.asset });
  });

  app.post("/api/assets/:assetId/sprites/:action/regenerate", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const action = normalizeSpriteAction(req.params.action);

    if (!userId || !action) {
      sendError(res, 400, "INVALID_ASSET_ACTION", "액션 재생성 요청을 확인해주세요.");
      return;
    }

    const session = requireSession(req, res, userId);

    if (!session) {
      return;
    }

    const result = regenerateAssetAction(store, session, req.params.assetId, action);

    if (!result.ok) {
      sendError(res, result.status, "ASSET_ACTION_FAILED", result.message);
      return;
    }

    res.json({ asset: result.asset });
  });

  app.get("/api/rooms", (req, res) => {
    if (!requireSession(req, res)) {
      return;
    }

    advanceExpiredRooms(store);

    res.json({ rooms: [...store.rooms.values()].map(toRoomResponse) });
  });

  app.post("/api/rooms", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const name = readString(req.body?.name);
    const maxPlayers = normalizeMaxPlayers(readNumber(req.body?.max_players) ?? readNumber(req.body?.maxPlayers));

    if (!userId || !name || !maxPlayers) {
      sendError(res, 400, "INVALID_ROOM_REQUEST", "방 생성 요청을 확인해주세요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    const room = createRoom(store, {
      userId,
      name,
      isPublic: readBoolean(req.body?.is_public) ?? readBoolean(req.body?.isPublic) ?? true,
      password: readString(req.body?.password),
      maxPlayers,
    });

    res.status(201).json({ room: toRoomResponse(room) });
  });

  app.post("/api/rooms/public/join", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRooms(store);

    const result = joinPublicRoom(store, userId);

    if (!result.ok) {
      sendError(res, result.status, "ROOM_JOIN_FAILED", result.message);
      return;
    }

    res.json({ room: toRoomResponse(result.room) });
  });

  app.post("/api/rooms/:roomId/join", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);

    const result = joinRoom(store, req.params.roomId, userId, readString(req.body?.password));

    if (!result.ok) {
      sendError(res, result.status, "ROOM_JOIN_FAILED", result.message);
      return;
    }

    res.json({ room: toRoomResponse(result.room) });
  });

  app.get("/api/rooms/:roomId", (req, res) => {
    const session = requireSession(req, res);

    if (!session) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);
    const snapshot = getRoomSnapshot(store, req.params.roomId);

    if (!snapshot || !snapshot.room.memberIds.includes(session.id)) {
      sendError(res, 404, "ROOM_NOT_FOUND", "방 상태를 조회할 수 없어요.");
      return;
    }

    res.json(toRoomSnapshotResponse(snapshot));
  });

  app.post("/api/rooms/:roomId/ready", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const isReady = readBoolean(req.body?.is_ready) ?? readBoolean(req.body?.isReady);

    if (!userId || isReady === undefined) {
      sendError(res, 400, "INVALID_READY_REQUEST", "준비 상태 요청을 확인해주세요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);
    const result = setRoomReady(store, req.params.roomId, userId, isReady);

    if (!result.ok) {
      sendError(res, result.status, "ROOM_READY_FAILED", result.message);
      return;
    }

    const snapshot = getRoomSnapshot(store, req.params.roomId);

    if (!snapshot) {
      sendError(res, 404, "ROOM_NOT_FOUND", "방 상태를 조회할 수 없어요.");
      return;
    }

    res.json(toRoomSnapshotResponse(snapshot));
  });

  app.post("/api/rooms/:roomId/leave", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    const result = leaveRoom(store, req.params.roomId, userId);

    if (!result.ok) {
      sendError(res, result.status, "ROOM_LEAVE_FAILED", result.message);
      return;
    }

    const snapshot = result.room ? getRoomSnapshot(store, result.room.id) : null;

    res.json(snapshot ? toRoomSnapshotResponse(snapshot) : { room: null, players: [] });
  });

  app.post("/api/rooms/:roomId/start", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    const result = startRoom(store, req.params.roomId, userId);

    if (!result.ok) {
      sendError(res, result.status, "ROOM_START_FAILED", result.message);
      return;
    }

    res.json({ room: toRoomResponse(result.room) });
  });

  app.post("/api/rooms/:roomId/segments", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const startPoint = readPoint(req.body?.start_point) ?? readPoint(req.body?.startPoint);
    const endPoint = readPoint(req.body?.end_point) ?? readPoint(req.body?.endPoint);
    const assets: Record<string, unknown>[] = Array.isArray(req.body?.assets)
      ? req.body.assets.filter(isRecord)
      : [];

    if (!userId || !startPoint || !endPoint) {
      sendError(res, 400, "INVALID_SEGMENT_REQUEST", "맵 조각 저장 요청을 확인해주세요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);

    const segment = saveMapSegment(store, {
      roomId: req.params.roomId,
      userId,
      startPoint,
      endPoint,
      assets: assets.map((asset) => ({
        assetId: readString(asset.assetId) ?? readString(asset.asset_id) ?? "system-platform-solid",
        x: readNumber(asset.x) ?? 0,
        y: readNumber(asset.y) ?? 0,
        widthCells: readNumber(asset.widthCells) ?? readNumber(asset.width_cells) ?? undefined,
        heightCells: readNumber(asset.heightCells) ?? readNumber(asset.height_cells) ?? undefined,
        rotation: readNumber(asset.rotation) ?? undefined,
      })),
    });

    if (!segment) {
      sendError(res, 404, "ROOM_NOT_FOUND", "맵 조각을 저장할 방을 찾을 수 없어요.");
      return;
    }

    const room = getRoomById(store, req.params.roomId);

    res.status(201).json({
      segment,
      room: room ? toRoomResponse(room) : null,
    });
  });

  app.get("/api/rooms/:roomId/segments/:segmentId", (req, res) => {
    const session = requireSession(req, res);

    if (!session) {
      return;
    }

    const room = advanceExpiredRoomPhase(store, req.params.roomId) ?? getRoomById(store, req.params.roomId);

    if (!room || !room.memberIds.includes(session.id)) {
      sendError(res, 404, "ROOM_NOT_FOUND", "맵 스냅샷을 조회할 방을 찾을 수 없어요.");
      return;
    }

    const segment = getMapSegment(store, req.params.roomId, req.params.segmentId);

    if (!segment) {
      sendError(res, 404, "SEGMENT_NOT_FOUND", "검증할 맵 스냅샷이 없습니다.");
      return;
    }

    res.json({
      segment,
      room: room ? toRoomResponse(room) : null,
    });
  });

  app.post("/api/rooms/:roomId/segments/validate", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const segmentHash = readString(req.body?.segment_hash) ?? readString(req.body?.segmentHash);

    if (!userId || !segmentHash || typeof req.body?.cleared !== "boolean") {
      sendError(res, 400, "INVALID_VALIDATION_REQUEST", "검증 요청을 확인해주세요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);

    const segment = validateMapSegment(store, {
      roomId: req.params.roomId,
      userId,
      segmentHash,
      cleared: req.body.cleared,
      clearTimeMs: readNumber(req.body?.clear_time_ms) ?? readNumber(req.body?.clearTimeMs) ?? 0,
    });

    if (!segment) {
      sendError(res, 404, "SEGMENT_NOT_FOUND", "검증할 맵 스냅샷이 없습니다.");
      return;
    }

    const room = getRoomById(store, req.params.roomId);

    res.json({
      segment,
      room: room ? toRoomResponse(room) : null,
    });
  });

  app.post("/api/rooms/:roomId/merge", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const room = advanceExpiredRoomPhase(store, req.params.roomId) ?? getRoomById(store, req.params.roomId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    if (!room || !room.memberIds.includes(userId)) {
      sendError(res, 404, "ROOM_NOT_FOUND", "병합할 방을 찾을 수 없어요.");
      return;
    }

    const mergedMap = mergeRoomMap(store, req.params.roomId);

    if (!mergedMap) {
      sendError(res, 404, "SEGMENT_NOT_FOUND", "병합할 맵 조각이 없습니다.");
      return;
    }

    const nextRoom = getRoomById(store, req.params.roomId);

    res.json({
      mergedMap,
      room: nextRoom ? toRoomResponse(nextRoom) : null,
    });
  });

  app.get("/api/rooms/:roomId/merged-map", (req, res) => {
    const session = requireSession(req, res);

    if (!session) {
      return;
    }

    const room = advanceExpiredRoomPhase(store, req.params.roomId) ?? getRoomById(store, req.params.roomId);

    if (!room || !room.memberIds.includes(session.id)) {
      sendError(res, 404, "ROOM_NOT_FOUND", "병합 맵을 조회할 방을 찾을 수 없어요.");
      return;
    }

    const mergedMap = getMergedMap(
      store,
      req.params.roomId,
      readString(req.query.merged_map_id) ?? readString(req.query.mergedMapId) ?? null,
    );

    if (!mergedMap) {
      sendError(res, 404, "MERGED_MAP_NOT_FOUND", "레이스 맵을 찾을 수 없어요.");
      return;
    }

    res.json({ mergedMap });
  });

  app.post("/api/rooms/:roomId/race/progress", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const progress = readNumber(req.body?.progress);

    if (!userId || progress === null) {
      sendError(res, 400, "INVALID_RACE_PROGRESS", "레이스 진행률 요청을 확인해주세요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);

    const result = recordRaceProgress(store, {
      roomId: req.params.roomId,
      userId,
      progress,
      raceDistanceToGoal:
        readNumber(req.body?.race_distance_to_goal) ??
        readNumber(req.body?.raceDistanceToGoal) ??
        Math.max(0, 100 - progress),
    });

    if (!result) {
      sendError(res, 404, "ROOM_NOT_FOUND", "진행률을 저장할 방을 찾을 수 없어요.");
      return;
    }

    res.json({ result });
  });

  app.post("/api/rooms/:roomId/race/finish", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);
    const finishTimeMs = readNumber(req.body?.finish_time_ms) ?? readNumber(req.body?.finishTimeMs);

    if (!userId || finishTimeMs === null) {
      sendError(res, 400, "INVALID_RACE_FINISH", "완주 기록 요청을 확인해주세요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    advanceExpiredRoomPhase(store, req.params.roomId);

    const result = recordRaceFinish(store, {
      roomId: req.params.roomId,
      userId,
      finishTimeMs,
    });

    if (!result) {
      sendError(res, 404, "ROOM_NOT_FOUND", "완주 기록을 저장할 방을 찾을 수 없어요.");
      return;
    }

    const room = getRoomById(store, req.params.roomId);

    res.json({
      result,
      room: room ? toRoomResponse(room) : null,
    });
  });

  app.get("/api/rooms/:roomId/results", (req, res) => {
    const session = requireSession(req, res);

    if (!session) {
      return;
    }

    const room = advanceExpiredRoomPhase(store, req.params.roomId) ?? getRoomById(store, req.params.roomId);

    if (!room || !room.memberIds.includes(session.id)) {
      sendError(res, 404, "ROOM_NOT_FOUND", "결과를 조회할 방을 찾을 수 없어요.");
      return;
    }

    if (room.phase !== "finished") {
      sendError(res, 404, "RESULT_NOT_READY", "아직 레이스 결과가 없어요.");
      return;
    }

    const result = getRaceResult(store, req.params.roomId);

    if (!result) {
      sendError(res, 404, "RESULT_NOT_FOUND", "아직 레이스 결과가 없어요.");
      return;
    }

    res.json({ result });
  });

  app.post("/api/device-link-codes", (req, res) => {
    const userId = readString(req.body?.user_id) ?? readString(req.body?.userId);

    if (!userId) {
      sendError(res, 400, "MISSING_USER_ID", "user_id가 필요해요.");
      return;
    }

    if (!requireSession(req, res, userId)) {
      return;
    }

    const ticket = issueDeviceCode(store, userId);

    res.status(201).json({ ticket });
  });

  app.post("/api/device-link-codes/consume", (req, res) => {
    const code = readString(req.body?.code);

    if (!code) {
      sendError(res, 400, "MISSING_CODE", "코드를 입력해주세요.");
      return;
    }

    const result = consumeDeviceCode(store, code);

    if (!result.ok) {
      sendError(res, result.status, "DEVICE_CODE_INVALID", result.message);
      return;
    }

    res.json({ session: result.session });
  });

  app.get("/api/ai/jobs/next", (req, res) => {
    if (!requireWorker(req, res)) {
      return;
    }

    const workerId = readString(req.header("x-worker-id")) ?? "gpu-worker";
    const claimedJob = claimNextAssetJob(store, workerId);

    if (!claimedJob) {
      res.status(204).send();
      return;
    }

    res.json({ job: toWorkerJobResponse(claimedJob.job, claimedJob.asset) });
  });

  app.post("/api/ai/jobs/:jobId/result", (req, res) => {
    if (!requireWorker(req, res)) {
      return;
    }

    const status = normalizeWorkerResultStatus(readString(req.body?.status));

    if (!status) {
      sendError(res, 400, "INVALID_JOB_RESULT", "작업 결과 상태를 확인해주세요.");
      return;
    }

    const result = completeAssetJob(store, req.params.jobId, {
      status,
      sheetUrl: readString(req.body?.sheetUrl) ?? readString(req.body?.sheet_url) ?? null,
      sourceImageUrl: readString(req.body?.sourceImageUrl) ?? readString(req.body?.source_image_url) ?? null,
      errorCode: readString(req.body?.errorCode) ?? readString(req.body?.error_code) ?? null,
      errorMessage: readString(req.body?.errorMessage) ?? readString(req.body?.error_message) ?? null,
    });

    if (!result.ok) {
      sendError(res, result.status, "ASSET_JOB_RESULT_FAILED", result.message);
      return;
    }

    res.json({
      job: toAssetJobResponse(result.job),
      asset: result.asset,
    });
  });
}

function requireSession(req: Request, res: Response, expectedUserId?: string) {
  const token = readBearerToken(req) ?? readString(req.body?.token);
  const session = getSessionByToken(store, token);

  if (!session) {
    sendError(res, 401, "SESSION_EXPIRED", "세션이 만료되었어요.");
    return null;
  }

  if (expectedUserId && session.id !== expectedUserId) {
    sendError(res, 403, "SESSION_USER_MISMATCH", "다른 사용자의 요청은 처리할 수 없어요.");
    return null;
  }

  return session;
}

function requireWorker(req: Request, res: Response) {
  const configuredToken = process.env.WORKER_TOKEN;
  const expectedToken = configuredToken || (process.env.NODE_ENV === "production" ? undefined : "dev-worker-token");

  if (!expectedToken) {
    sendError(res, 503, "WORKER_TOKEN_MISSING", "Worker token이 설정되지 않았어요.");
    return false;
  }

  const providedToken = readBearerToken(req) ?? readString(req.header("x-worker-token"));

  if (providedToken !== expectedToken) {
    sendError(res, 401, "WORKER_AUTHENTICATION_FAILED", "Worker 인증에 실패했어요.");
    return false;
  }

  return true;
}

function readBearerToken(req: Request) {
  const authorization = req.header("authorization");

  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");

  return scheme?.toLowerCase() === "bearer" ? readString(token) : undefined;
}

function toRoomResponse(room: ReturnType<typeof createRoom>) {
  const phaseEndsAt = getRoomPhaseEndsAt(room);

  return {
    ...room,
    phaseEndsAt,
    phase_ends_at: phaseEndsAt,
    elapsedSeconds:
      room.phase === "lobby"
        ? room.elapsedSeconds
        : Math.max(room.elapsedSeconds, Math.floor((Date.now() - room.createdAtMs) / 1000)),
    elapsed_seconds:
      room.phase === "lobby"
        ? room.elapsed_seconds
        : Math.max(room.elapsed_seconds, Math.floor((Date.now() - room.createdAtMs) / 1000)),
  };
}

function toRoomSnapshotResponse(snapshot: NonNullable<ReturnType<typeof getRoomSnapshot>>) {
  return {
    room: toRoomResponse(snapshot.room),
    players: snapshot.players,
  };
}

function toAssetJobResponse(job: ReturnType<typeof listAssetJobsForUser>[number]) {
  return {
    id: job.id,
    status: job.status,
    targetType: job.targetType,
    target_type: job.targetType,
    outputAssetId: job.outputAssetId,
    output_asset_id: job.outputAssetId,
    action: job.action,
    errorCode: job.errorCode,
    error_code: job.errorCode,
    errorMessage: job.errorMessage,
    error_message: job.errorMessage,
    updatedAtMs: job.updatedAtMs,
    updated_at_ms: job.updatedAtMs,
  };
}

function toWorkerJobResponse(
  job: NonNullable<ReturnType<typeof claimNextAssetJob>>["job"],
  asset: NonNullable<ReturnType<typeof claimNextAssetJob>>["asset"],
) {
  return {
    ...toAssetJobResponse(job),
    assetId: asset?.id ?? job.outputAssetId,
    asset_id: asset?.id ?? job.outputAssetId,
    category: asset?.category ?? null,
    name: asset?.name ?? "",
    description: asset?.description ?? "",
    image: asset?.sourceImageUrl ?? "",
    attrs: asset?.attrs ?? {},
    widthCells: asset?.widthCells ?? null,
    width_cells: asset?.width_cells ?? null,
    heightCells: asset?.heightCells ?? null,
    height_cells: asset?.height_cells ?? null,
    requestedActions: job.action
      ? [job.action]
      : asset?.sprites.map((sprite) => sprite.action) ?? [],
    requested_actions: job.action
      ? [job.action]
      : asset?.sprites.map((sprite) => sprite.action) ?? [],
  };
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function normalizeAssetCategory(value: string | undefined): AssetCategory | null {
  if (
    value === "avatar" ||
    value === "platform" ||
    value === "obstacle" ||
    value === "monster" ||
    value === "background" ||
    value === "item"
  ) {
    return value;
  }

  return null;
}

function normalizeSpriteAction(value: string | undefined): AssetSpriteAction | null {
  if (value === "idle" || value === "walk" || value === "onair" || value === "static") {
    return value;
  }

  return null;
}

function normalizeWorkerResultStatus(value: string | undefined): "ready" | "failed" | null {
  return value === "ready" || value === "failed" ? value : null;
}

function normalizeMaxPlayers(value: number | null): 2 | 3 | 4 | null {
  return value === 2 || value === 3 || value === 4 ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readPoint(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const x = readNumber(value.x);
  const y = readNumber(value.y);

  return x === null || y === null ? null : { x, y };
}

function readAttrs(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
      const entryValue = entry[1];

      return (
        typeof entryValue === "string" ||
        typeof entryValue === "number" ||
        typeof entryValue === "boolean" ||
        entryValue === null
      );
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

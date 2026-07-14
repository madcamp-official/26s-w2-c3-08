import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";

type AssetCategory = "avatar" | "platform" | "obstacle" | "monster" | "background" | "item";
type AssetStatus = "queued" | "generating" | "ready" | "failed";
type RoomPhase = "lobby" | "building" | "validating" | "merging" | "racing" | "finished";

interface UserSession {
  id: string;
  nickname: string;
  token: string;
  avatarAssetId: string | null;
}

interface AssetSprite {
  action: "idle" | "walk" | "onair" | "static";
  status: AssetStatus;
  sheetUrl: string | null;
  frameCount: number | null;
  lastRegenAt: string | null;
}

interface Asset {
  id: string;
  creatorId: string | null;
  isSystem: boolean;
  category: AssetCategory;
  name: string;
  description: string;
  attrs: Record<string, string | number | boolean | null>;
  colliderType: "rect" | "slope" | "none";
  widthCells: number | null;
  heightCells: number | null;
  sourceImageUrl: string;
  remixOfId: string | null;
  status: AssetStatus;
  isPublic: boolean;
  createdAt: string;
  sprites: AssetSprite[];
}

interface RoomSummary {
  id: string;
  name: string;
  hostNickname: string;
  isPublic: boolean;
  players: number;
  maxPlayers: number;
  phase: RoomPhase;
  elapsedSeconds: number;
  phaseEndsAt: string | null;
  createdAt: number;
}

interface MapPoint {
  x: number;
  y: number;
}

interface MapSegmentAssetSnapshot {
  assetId: string;
  assetCategory?: AssetCategory;
  assetAttrs?: Record<string, string | number | boolean | null>;
  colliderType?: Asset["colliderType"];
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  rotation: number;
}

interface MapSegmentSnapshot {
  id: string;
  roomId: string;
  creatorId: string;
  startPoint: MapPoint;
  endPoint: MapPoint;
  placements: [];
  assetRefs: MapSegmentAssetSnapshot[];
  segmentHash: string;
  isValidated: boolean;
  submittedAt: string;
  validatedAt: string | null;
  clearTimeMs: number | null;
}

interface MergedMapPlacement {
  assetId: string;
  assetCategory?: AssetCategory;
  assetAttrs?: Record<string, string | number | boolean | null>;
  colliderType?: Asset["colliderType"];
  sourceSegmentId: string;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  rotation: number;
}

interface MergedMap {
  id: string;
  roomId: string;
  globalStart: MapPoint;
  globalEnd: MapPoint;
  placements: MergedMapPlacement[];
  segments: MapSegmentSnapshot[];
  usedFallback: boolean;
  createdAt: string;
}

interface RacePlayerState {
  validationCleared: boolean;
  raceProgress: number;
  raceFinishedAtMs: number | null;
  raceDistanceToGoal: number;
}

interface DeviceLinkTicket {
  code: string;
  userId: string;
  expiresAt: string;
}

interface AssetJobLease {
  leasedBy: string;
  leaseExpiresAtMs: number;
}

const DEVICE_LINK_TTL_MS = 5 * 60 * 1000;
const ACTION_REGEN_COOLDOWN_MS = 5 * 60 * 1000;
const ASSET_JOB_LEASE_MS = 2 * 60 * 1000;
export const RACE_MS_PER_LINE = 40 * 1000;
export const FIRST_FINISH_COUNTDOWN_MS = 10 * 1000;
export const LAST_DANCE_MS = 30 * 1000;
export const BUILD_LATE_JOIN_CUTOFF_MS = 60 * 1000;
const ROOM_PHASE_DURATIONS_MS: Record<RoomPhase, number | null> = {
  lobby: null,
  building: 3 * 60 * 1000,
  validating: 2 * 60 * 1000,
  merging: 30 * 1000,
  racing: null,
  finished: null
};

const sessions = new Map<string, UserSession>();
const assets = new Map<string, Asset>();
const rooms = new Map<string, RoomSummary>();
const roomPlayers = new Map<string, Set<string>>();
const roomHosts = new Map<string, string>();
const roomPasswords = new Map<string, string>();
const roomReadyPlayers = new Map<string, Set<string>>();
const segments = new Map<string, MapSegmentSnapshot>();
const mergedMaps = new Map<string, MergedMap>();
const racePlayerStates = new Map<string, Map<string, RacePlayerState>>();
const deviceLinks = new Map<string, DeviceLinkTicket>();
const assetJobLeases = new Map<string, AssetJobLease>();

export function ensureApiRoomForRealtime(roomId: string, nickname?: string) {
  const existingRoom = rooms.get(roomId);

  if (existingRoom !== undefined) {
    return toRoomSummary(existingRoom);
  }

  const room: RoomSummary = {
    id: roomId,
    name: "실시간 테스트 방",
    hostNickname: nickname ?? "host",
    isPublic: true,
    players: 0,
    maxPlayers: 4,
    phase: "lobby",
    elapsedSeconds: 0,
    phaseEndsAt: null,
    createdAt: Date.now()
  };

  rooms.set(room.id, room);
  roomPlayers.set(room.id, new Set());
  return toRoomSummary(room);
}

export function joinApiRoomFromRealtime(roomId: string, userId: string, nickname: string) {
  if (!rooms.has(roomId)) {
    ensureApiRoomForRealtime(roomId, nickname);
  }

  const storedRoom = rooms.get(roomId);

  if (storedRoom === undefined) {
    return { isHost: true, phase: "lobby" as RoomPhase };
  }

  if (!sessions.has(userId)) {
    sessions.set(userId, {
      id: userId,
      nickname,
      token: crypto.randomUUID(),
      avatarAssetId: null
    });
  }

  const players = roomPlayers.get(roomId) ?? new Set<string>();
  const existingHostId = roomHosts.get(roomId);
  const isHost = existingHostId === undefined || existingHostId === userId;
  const isExistingPlayer = players.has(userId);

  if (!isExistingPlayer && !canJoinRoomPhase(storedRoom)) {
    return {
      isHost: false,
      phase: storedRoom.phase,
      rejected: true as const,
      message: storedRoom.phase === "building"
        ? "제작 시간이 1분 미만이라 새 제작자로 입장할 수 없어요."
        : "room cannot be joined",
    };
  }

  if (existingHostId === undefined) {
    roomHosts.set(roomId, userId);
  }

  players.add(userId);
  roomPlayers.set(roomId, players);
  storedRoom.players = players.size;
  setPlayerReady(roomId, userId, isHost);

  if (isHost) {
    storedRoom.hostNickname = nickname;
  }

  return { isHost, phase: storedRoom.phase };
}

export function leaveApiRoomFromRealtime(roomId: string, userId: string) {
  const players = roomPlayers.get(roomId);
  const room = rooms.get(roomId);

  if (players === undefined || room === undefined) {
    return;
  }

  players.delete(userId);
  room.players = players.size;
  roomReadyPlayers.get(roomId)?.delete(userId);
  racePlayerStates.get(roomId)?.delete(userId);

  if (roomHosts.get(roomId) === userId) {
    roomHosts.delete(roomId);
    assignNextHost(room);
  }
}

export function setApiRoomPhase(roomId: string, phase: RoomPhase) {
  const room = rooms.get(roomId);

  if (room === undefined) {
    return;
  }

  setRoomPhase(room, phase);
}

export function getApiRoomRaceDurationMs(roomId: string) {
  return getRaceDurationMs(mergedMaps.get(roomId)?.segments.length ?? 1);
}

export function applyApiFirstFinishCountdown(roomId: string, nowMs = Date.now()) {
  const room = rooms.get(roomId);

  if (room === undefined || room.phase !== "racing") {
    return null;
  }

  applyFirstFinishCountdown(room, nowMs);
  return toRoomSummary(room);
}

export function applyApiLastDance(roomId: string, nowMs = Date.now()) {
  const room = rooms.get(roomId);

  if (room === undefined || room.phase !== "racing") {
    return null;
  }

  room.createdAt = nowMs;
  room.phaseEndsAt = new Date(nowMs + LAST_DANCE_MS).toISOString();
  return toRoomSummary(room);
}

export function getApiRoomPhase(roomId: string): RoomPhase {
  return rooms.get(roomId)?.phase ?? "lobby";
}

export function mergeApiRoomMap(roomId: string) {
  const room = rooms.get(roomId);

  if (room === undefined) {
    return null;
  }

  const validatedSegments = Array.from(segments.values()).filter(
    (segment) => segment.roomId === roomId && segment.isValidated
  );
  const usedFallback = validatedSegments.length === 0;
  const sourceSegments = usedFallback ? [buildFallbackSegment(roomId)] : shuffleSegments(validatedSegments);
  const mergedMap = buildMergedMap(roomId, sourceSegments, usedFallback);

  mergedMaps.set(roomId, mergedMap);
  setRoomPhase(room, "racing", getRaceDurationMs(mergedMap.segments.length));
  return mergedMap;
}

const sessionSchema = z.object({
  nickname: z.string().trim().min(1).max(12)
});

const sessionValidateSchema = z.object({
  token: z.string().min(1).optional()
});

const nicknameSchema = z.object({
  token: z.string().min(1).optional(),
  nickname: z.string().trim().min(1).max(12)
});

const userActionSchema = z.object({
  user_id: z.string().min(1).optional(),
  userId: z.string().min(1).optional()
});

const assetGenerateSchema = z.object({
  userId: z.string().min(1).optional(),
  user_id: z.string().min(1).optional(),
  category: z.enum(["avatar", "platform", "obstacle", "monster", "background", "item"]).default("avatar"),
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().max(500).optional(),
  prompt: z.string().max(500).optional(),
  image: z.string().min(1),
  attrs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  widthCells: z.number().int().min(1).max(8).nullable().optional(),
  width_cells: z.number().int().min(1).max(8).nullable().optional(),
  heightCells: z.number().int().min(1).max(8).nullable().optional(),
  height_cells: z.number().int().min(1).max(8).nullable().optional(),
  remixOfId: z.string().nullable().optional(),
  remix_of_id: z.string().nullable().optional()
});

const workerResultSchema = z.object({
  status: z.enum(["ready", "failed"]),
  sheetUrl: z.string().min(1).optional(),
  sheet_url: z.string().min(1).optional(),
  sourceImageUrl: z.string().min(1).optional(),
  source_image_url: z.string().min(1).optional(),
  errorCode: z.string().min(1).nullable().optional(),
  error_code: z.string().min(1).nullable().optional(),
  errorMessage: z.string().min(1).nullable().optional(),
  error_message: z.string().min(1).nullable().optional()
});

const createRoomSchema = z.object({
  user_id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  is_public: z.boolean(),
  password: z.string().nullable().optional(),
  max_players: z.number().int().min(2).max(4).default(4)
});

const joinRoomSchema = z.object({
  user_id: z.string().min(1),
  password: z.string().nullable().optional()
});

const readyRoomSchema = z.object({
  user_id: z.string().min(1),
  is_ready: z.boolean()
});

const mapPointSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0)
});

const assetAttrsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

const segmentAssetSchema = z.object({
  asset_id: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  asset_category: z.enum(["avatar", "platform", "obstacle", "monster", "background", "item"]).optional(),
  assetCategory: z.enum(["avatar", "platform", "obstacle", "monster", "background", "item"]).optional(),
  asset_attrs: assetAttrsSchema.optional(),
  assetAttrs: assetAttrsSchema.optional(),
  collider_type: z.enum(["rect", "slope", "none"]).optional(),
  colliderType: z.enum(["rect", "slope", "none"]).optional(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width_cells: z.number().int().min(1).max(8).optional(),
  widthCells: z.number().int().min(1).max(8).optional(),
  height_cells: z.number().int().min(1).max(8).optional(),
  heightCells: z.number().int().min(1).max(8).optional(),
  rotation: z.number().default(0)
});

const saveSegmentSchema = z.object({
  user_id: z.string().min(1),
  start_point: mapPointSchema,
  end_point: mapPointSchema,
  assets: z.array(segmentAssetSchema).default([])
});

const validateSegmentSchema = z.object({
  user_id: z.string().min(1),
  segment_hash: z.string().min(1),
  cleared: z.boolean(),
  clear_time_ms: z.number().int().nonnegative()
});

const raceProgressSchema = z.object({
  user_id: z.string().min(1),
  progress: z.number().min(0).max(100),
  race_distance_to_goal: z.number().nonnegative().default(0)
});

const raceFinishSchema = z.object({
  user_id: z.string().min(1),
  finish_time_ms: z.number().int().nonnegative()
});

const deviceCodeSchema = z.object({
  user_id: z.string().min(1)
});

const consumeDeviceCodeSchema = z.object({
  code: z.string().trim().min(1)
});

seedDefaults();

export const apiRoutes = Router();

apiRoutes.post("/session", (req, res) => {
  const body = parseBody(sessionSchema, req.body, res);

  if (body === null) {
    return;
  }

  const session: UserSession = {
    id: crypto.randomUUID(),
    nickname: body.nickname,
    token: crypto.randomUUID(),
    avatarAssetId: null
  };

  sessions.set(session.id, session);
  res.json({ ok: true, session });
});

apiRoutes.post("/session/validate", (req, res) => {
  const body = parseBody(sessionValidateSchema, req.body, res);

  if (body === null) {
    return;
  }

  const session = getSessionByToken(body.token ?? readBearerToken(req));

  if (session === null) {
    res.status(401).json({ ok: false, error: { code: "SESSION_EXPIRED", message: "session expired" } });
    return;
  }

  res.json({ ok: true, session });
});

apiRoutes.post("/session/nickname", (req, res) => {
  const body = parseBody(nicknameSchema, req.body, res);

  if (body === null) {
    return;
  }

  const session = getSessionByToken(body.token ?? readBearerToken(req));

  if (session === null) {
    res.status(401).json({ ok: false, error: { code: "SESSION_EXPIRED", message: "session expired" } });
    return;
  }

  session.nickname = body.nickname;
  res.json({ ok: true, session });
});

apiRoutes.post("/device-link-codes", (req, res) => {
  const body = parseBody(deviceCodeSchema, req.body, res);

  if (body === null) {
    return;
  }

  if (!sessions.has(body.user_id)) {
    res.status(404).json({ ok: false, error: { code: "SESSION_NOT_FOUND", message: "session not found" } });
    return;
  }

  const ticket: DeviceLinkTicket = {
    code: makeDeviceCode(),
    userId: body.user_id,
    expiresAt: new Date(Date.now() + DEVICE_LINK_TTL_MS).toISOString()
  };

  deviceLinks.set(ticket.code, ticket);
  res.json({ ok: true, ticket: { code: ticket.code, expiresAt: ticket.expiresAt } });
});

apiRoutes.post("/device-link-codes/consume", (req, res) => {
  const body = parseBody(consumeDeviceCodeSchema, req.body, res);

  if (body === null) {
    return;
  }

  const code = normalizeDeviceCode(body.code);
  const ticket = deviceLinks.get(code);

  if (ticket === undefined || new Date(ticket.expiresAt).getTime() <= Date.now()) {
    deviceLinks.delete(code);
    res.status(404).json({ ok: false, error: { code: "DEVICE_CODE_NOT_FOUND", message: "device code expired or missing" } });
    return;
  }

  const session = sessions.get(ticket.userId);

  if (session === undefined) {
    res.status(404).json({ ok: false, error: { code: "SESSION_NOT_FOUND", message: "session not found" } });
    return;
  }

  res.json({ ok: true, session });
});

apiRoutes.get("/assets", (req, res) => {
  const userId = typeof req.query.user_id === "string" ? req.query.user_id : null;
  updateAssetGenerationStates();
  const visibleAssets = Array.from(assets.values()).filter(
    (asset) => asset.isSystem || asset.isPublic || asset.creatorId === userId
  );

  res.json({ ok: true, assets: visibleAssets });
});

apiRoutes.get("/asset-jobs", (req, res) => {
  const userId = typeof req.query.user_id === "string" ? req.query.user_id : null;
  updateAssetGenerationStates();

  res.json({
    ok: true,
    jobs: listAssetJobs(userId)
  });
});

apiRoutes.get("/ai/jobs/next", (req, res) => {
  if (!requireWorker(req, res)) {
    return;
  }

  const workerId = readHeaderString(req.headers["x-worker-id"]) ?? "gpu-worker";
  const claimedJob = claimNextAssetJob(workerId);

  if (claimedJob === null) {
    res.status(204).send();
    return;
  }

  res.json({ ok: true, job: toWorkerJob(claimedJob.asset, claimedJob.sprite) });
});

apiRoutes.post("/ai/jobs/:jobId/result", (req, res) => {
  if (!requireWorker(req, res)) {
    return;
  }

  const body = parseBody(workerResultSchema, req.body, res);

  if (body === null) {
    return;
  }

  const result = completeAssetJob(req.params.jobId, {
    status: body.status,
    sheetUrl: body.sheetUrl ?? body.sheet_url ?? null,
    sourceImageUrl: body.sourceImageUrl ?? body.source_image_url ?? null,
    errorCode: body.errorCode ?? body.error_code ?? null,
    errorMessage: body.errorMessage ?? body.error_message ?? null
  });

  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: { code: result.code, message: result.message } });
    return;
  }

  res.json({ ok: true, job: toAssetJob(result.asset, result.sprite), asset: result.asset });
});

apiRoutes.post("/assets/generate", (req, res) => {
  const body = parseBody(assetGenerateSchema, req.body, res);

  if (body === null) {
    return;
  }

  const userId = body.userId ?? body.user_id ?? null;
  const now = new Date().toISOString();
  const asset: Asset = {
    id: crypto.randomUUID(),
    creatorId: userId,
    isSystem: false,
    category: body.category,
    name: body.name ?? (body.category === "avatar" ? "새 아바타" : "새 에셋"),
    description: body.description ?? body.prompt ?? "",
    attrs: body.attrs,
    colliderType: inferColliderType(body.category, body.attrs),
    widthCells: body.widthCells ?? body.width_cells ?? null,
    heightCells: body.heightCells ?? body.height_cells ?? null,
    sourceImageUrl: body.image,
    remixOfId: body.remixOfId ?? body.remix_of_id ?? null,
    status: "queued",
    isPublic: true,
    createdAt: now,
    sprites: createSpriteJobs(body.category, now)
  };

  assets.set(asset.id, asset);
  res.status(202).json({ ok: true, asset, job: toAssetJob(asset, null) });
});

apiRoutes.post("/assets/:assetId/equip-avatar", (req, res) => {
  const body = parseBody(userActionSchema, req.body, res);

  if (body === null) {
    return;
  }

  const userId = body.user_id ?? body.userId;
  const session = resolveActionSession(userId, req, res);

  if (session === null) {
    return;
  }

  const asset = assets.get(req.params.assetId);

  if (asset === undefined || asset.category !== "avatar") {
    res.status(404).json({ ok: false, error: { code: "ASSET_NOT_FOUND", message: "avatar asset not found" } });
    return;
  }

  updateAssetGenerationStates();

  if (asset.status !== "ready") {
    res.status(409).json({ ok: false, error: { code: "ASSET_NOT_READY", message: "avatar asset is not ready" } });
    return;
  }

  session.avatarAssetId = asset.id;
  res.json({ ok: true, session });
});

apiRoutes.post("/assets/:assetId/retry", (req, res) => {
  const body = parseBody(userActionSchema, req.body, res);

  if (body === null) {
    return;
  }

  const session = resolveActionSession(body.user_id ?? body.userId, req, res);

  if (session === null) {
    return;
  }

  const asset = assets.get(req.params.assetId);

  if (asset === undefined || !canUseAsset(session.id, asset)) {
    res.status(404).json({ ok: false, error: { code: "ASSET_NOT_FOUND", message: "asset not found" } });
    return;
  }

  if (asset.status !== "failed") {
    res.status(409).json({ ok: false, error: { code: "ASSET_NOT_FAILED", message: "asset is not failed" } });
    return;
  }

  queueAssetGeneration(asset, new Date());
  res.json({ ok: true, asset });
});

apiRoutes.post("/assets/:assetId/sprites/:action/regenerate", (req, res) => {
  const body = parseBody(userActionSchema, req.body, res);

  if (body === null) {
    return;
  }

  const session = resolveActionSession(body.user_id ?? body.userId, req, res);

  if (session === null) {
    return;
  }

  const asset = assets.get(req.params.assetId);
  const action = normalizeSpriteAction(req.params.action);

  if (asset === undefined || action === null || !canUseAsset(session.id, asset)) {
    res.status(404).json({ ok: false, error: { code: "ASSET_ACTION_NOT_FOUND", message: "asset action not found" } });
    return;
  }

  const sprite = asset.sprites.find((candidateSprite) => candidateSprite.action === action);

  if (sprite === undefined) {
    res.status(404).json({ ok: false, error: { code: "ASSET_ACTION_NOT_FOUND", message: "asset action not found" } });
    return;
  }

  updateAssetGenerationStates();

  if (asset.status !== "ready") {
    res.status(409).json({ ok: false, error: { code: "ASSET_NOT_READY", message: "asset is not ready" } });
    return;
  }

  if (sprite.lastRegenAt !== null && Date.now() - Date.parse(sprite.lastRegenAt) < ACTION_REGEN_COOLDOWN_MS) {
    res.status(429).json({ ok: false, error: { code: "ASSET_ACTION_COOLDOWN", message: "asset action is cooling down" } });
    return;
  }

  const now = new Date();
  asset.status = "generating";
  asset.createdAt = now.toISOString();
  asset.sprites = asset.sprites.map((candidateSprite) =>
    candidateSprite.action === action
      ? {
          ...candidateSprite,
          status: "generating",
          sheetUrl: null,
          frameCount: null,
          lastRegenAt: now.toISOString()
        }
      : candidateSprite
  );

  res.json({ ok: true, asset });
});

apiRoutes.get("/rooms", (_req, res) => {
  res.json({ ok: true, rooms: Array.from(rooms.values()).map(toRoomSummary) });
});

apiRoutes.post("/rooms", (req, res) => {
  const body = parseBody(createRoomSchema, req.body, res);

  if (body === null) {
    return;
  }

  const host = sessions.get(body.user_id);
  const room: RoomSummary = {
    id: crypto.randomUUID(),
    name: body.name,
    hostNickname: host?.nickname ?? "host",
    isPublic: body.is_public,
    players: 1,
    maxPlayers: body.max_players,
    phase: "lobby",
    elapsedSeconds: 0,
    phaseEndsAt: null,
    createdAt: Date.now()
  };

  rooms.set(room.id, room);
  roomPlayers.set(room.id, new Set([body.user_id]));
  roomHosts.set(room.id, body.user_id);
  setPlayerReady(room.id, body.user_id, true);

  if (!body.is_public && body.password !== undefined && body.password !== null) {
    roomPasswords.set(room.id, body.password);
  }

  res.status(201).json({ ok: true, room: toRoomSummary(room) });
});

apiRoutes.post("/rooms/public/join", (req, res) => {
  const body = parseBody(z.object({ user_id: z.string().min(1) }), req.body, res);

  if (body === null) {
    return;
  }

  const room = Array.from(rooms.values()).find(
    (candidateRoom) =>
      candidateRoom.isPublic &&
      canJoinRoomPhase(candidateRoom) &&
      getRoomPlayerCount(candidateRoom.id) < candidateRoom.maxPlayers
  );

  if (room === undefined) {
    res.status(404).json({ ok: false, error: { code: "NO_PUBLIC_ROOM", message: "no public room is joinable" } });
    return;
  }

  joinRoomState(room, body.user_id);
  res.json({ ok: true, room: toRoomSummary(room) });
});

apiRoutes.post("/rooms/:roomId/join", (req, res) => {
  const body = parseBody(joinRoomSchema, req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);

  if (room === undefined) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_JOINABLE", message: "room cannot be joined" } });
    return;
  }

  if (!canJoinRoomPhase(room)) {
    const isLateBuildJoin = room.phase === "building";
    res.status(isLateBuildJoin ? 409 : 404).json({
      ok: false,
      error: {
        code: isLateBuildJoin ? "BUILD_LATE_JOIN_CLOSED" : "ROOM_NOT_JOINABLE",
        message: isLateBuildJoin
          ? "제작 시간이 1분 미만이라 새 제작자로 입장할 수 없어요."
          : "room cannot be joined",
      },
    });
    return;
  }

  if (getRoomPlayerCount(room.id) >= room.maxPlayers) {
    res.status(409).json({ ok: false, error: { code: "ROOM_FULL", message: "room is full" } });
    return;
  }

  if (!room.isPublic && (body.password ?? "") !== roomPasswords.get(room.id)) {
    res.status(403).json({ ok: false, error: { code: "INVALID_PASSWORD", message: "password did not match" } });
    return;
  }

  joinRoomState(room, body.user_id);
  res.json({ ok: true, room: toRoomSummary(room) });
});

apiRoutes.get("/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);

  if (room === undefined) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "room not found" } });
    return;
  }

  res.json(toRoomSnapshot(room));
});

apiRoutes.post("/rooms/:roomId/start", (req, res) => {
  const body = parseBody(z.object({ user_id: z.string().min(1) }), req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);

  if (room === undefined) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "room not found" } });
    return;
  }

  if (roomHosts.get(room.id) !== body.user_id) {
    res.status(403).json({ ok: false, error: { code: "HOST_REQUIRED", message: "host is required" } });
    return;
  }

  if (!canStartRoom(room.id)) {
    res.status(409).json({ ok: false, error: { code: "ROOM_NOT_READY", message: "아직 준비하지 않은 플레이어가 있어요." } });
    return;
  }

  setRoomPhase(room, "building");
  resetRoomReadiness(room.id);
  res.json({ ok: true, room: toRoomSummary(room) });
});

apiRoutes.post("/rooms/:roomId/ready", (req, res) => {
  const body = parseBody(readyRoomSchema, req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);
  const players = roomPlayers.get(req.params.roomId);

  if (room === undefined || players === undefined || !players.has(body.user_id)) {
    res.status(404).json({ ok: false, error: { code: "ROOM_PLAYER_NOT_FOUND", message: "room player not found" } });
    return;
  }

  setPlayerReady(room.id, body.user_id, body.is_ready);
  res.json(toRoomSnapshot(room));
});

apiRoutes.post("/rooms/:roomId/leave", (req, res) => {
  const body = parseBody(z.object({ user_id: z.string().min(1) }), req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);
  const players = roomPlayers.get(req.params.roomId);

  if (room === undefined || players === undefined || !players.has(body.user_id)) {
    res.status(404).json({ ok: false, error: { code: "ROOM_PLAYER_NOT_FOUND", message: "room player not found" } });
    return;
  }

  players.delete(body.user_id);
  roomReadyPlayers.get(room.id)?.delete(body.user_id);
  racePlayerStates.get(room.id)?.delete(body.user_id);
  room.players = players.size;

  if (players.size === 0) {
    rooms.delete(room.id);
    roomPlayers.delete(room.id);
    roomHosts.delete(room.id);
    roomPasswords.delete(room.id);
    roomReadyPlayers.delete(room.id);
    racePlayerStates.delete(room.id);
    mergedMaps.delete(room.id);
    res.json({ ok: true, room: null, players: [] });
    return;
  }

  if (roomHosts.get(room.id) === body.user_id) {
    roomHosts.delete(room.id);
    assignNextHost(room);
  }

  res.json(toRoomSnapshot(room));
});

apiRoutes.post("/rooms/:roomId/segments", (req, res) => {
  const body = parseBody(saveSegmentSchema, req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);

  if (room === undefined) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "room not found" } });
    return;
  }

  const assetRefs = body.assets.map(normalizeSegmentAsset);
  const segment: MapSegmentSnapshot = {
    id: crypto.randomUUID(),
    roomId: room.id,
    creatorId: body.user_id,
    startPoint: body.start_point,
    endPoint: body.end_point,
    placements: [],
    assetRefs,
    segmentHash: makeSegmentHash(body.start_point, body.end_point, assetRefs),
    isValidated: false,
    submittedAt: new Date().toISOString(),
    validatedAt: null,
    clearTimeMs: null
  };

  Array.from(segments.values())
    .filter((storedSegment) => storedSegment.roomId === room.id && storedSegment.creatorId === body.user_id)
    .forEach((storedSegment) => segments.delete(storedSegment.id));
  segments.set(segment.id, segment);
  setPlayerReady(room.id, body.user_id, true);

  if (hasEveryCurrentPlayerSubmitted(room.id)) {
    setRoomPhase(room, "validating");
    resetRoomReadiness(room.id);
  }

  res.status(201).json({ ok: true, segment, room: toRoomSummary(room) });
});

apiRoutes.get("/rooms/:roomId/segments/:segmentId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  const segment = segments.get(req.params.segmentId);

  if (room === undefined || segment === undefined || segment.roomId !== room.id) {
    res.status(404).json({ ok: false, error: { code: "SEGMENT_NOT_FOUND", message: "segment was not found" } });
    return;
  }

  res.json({ ok: true, segment, room: toRoomSummary(room) });
});

apiRoutes.post("/rooms/:roomId/segments/validate", (req, res) => {
  const body = parseBody(validateSegmentSchema, req.body, res);

  if (body === null) {
    return;
  }

  const segment = Array.from(segments.values()).find(
    (candidateSegment) =>
      candidateSegment.roomId === req.params.roomId &&
      candidateSegment.creatorId === body.user_id &&
      candidateSegment.segmentHash === body.segment_hash
  );

  if (segment === undefined) {
    res.status(404).json({ ok: false, error: { code: "SEGMENT_NOT_FOUND", message: "segment hash was not found" } });
    return;
  }

  const validatedSegment: MapSegmentSnapshot = {
    ...segment,
    isValidated: body.cleared,
    validatedAt: new Date().toISOString(),
    clearTimeMs: body.clear_time_ms
  };

  segments.set(validatedSegment.id, validatedSegment);
  setPlayerReady(validatedSegment.roomId, body.user_id, true);
  setPlayerRaceState(validatedSegment.roomId, body.user_id, {
    validationCleared: body.cleared
  });

  const room = rooms.get(validatedSegment.roomId);

  if (room !== undefined && hasEveryCurrentPlayerValidated(room.id)) {
    setRoomPhase(room, "merging");
    resetRoomReadiness(room.id);
  }

  res.json({ ok: true, segment: validatedSegment, room: room ? toRoomSummary(room) : undefined });
});

apiRoutes.post("/rooms/:roomId/merge", (req, res) => {
  const mergedMap = mergeApiRoomMap(req.params.roomId);
  const room = rooms.get(req.params.roomId);

  if (mergedMap === null || room === undefined) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "room not found" } });
    return;
  }

  res.json({ ok: true, mergedMap, room: toRoomSummary(room) });
});

apiRoutes.get("/rooms/:roomId/merged-map", (req, res) => {
  const room = rooms.get(req.params.roomId);
  const mergedMap = mergedMaps.get(req.params.roomId);
  const requestedMapId = typeof req.query.merged_map_id === "string" ? req.query.merged_map_id : null;

  if (room === undefined || mergedMap === undefined || (requestedMapId !== null && mergedMap.id !== requestedMapId)) {
    res.status(404).json({ ok: false, error: { code: "MERGED_MAP_NOT_FOUND", message: "merged map was not found" } });
    return;
  }

  res.json({ ok: true, mergedMap, room: toRoomSummary(room) });
});

apiRoutes.post("/rooms/:roomId/race/progress", (req, res) => {
  const body = parseBody(raceProgressSchema, req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);

  if (room === undefined || !isRoomPlayer(room.id, body.user_id)) {
    res.status(404).json({ ok: false, error: { code: "ROOM_PLAYER_NOT_FOUND", message: "room player not found" } });
    return;
  }

  setPlayerRaceState(room.id, body.user_id, {
    raceProgress: body.progress,
    raceDistanceToGoal: body.race_distance_to_goal
  });

  res.json({ ok: true, result: toRaceResult(room.id), room: toRoomSummary(room) });
});

apiRoutes.post("/rooms/:roomId/race/finish", (req, res) => {
  const body = parseBody(raceFinishSchema, req.body, res);

  if (body === null) {
    return;
  }

  const room = rooms.get(req.params.roomId);

  if (room === undefined || !isRoomPlayer(room.id, body.user_id)) {
    res.status(404).json({ ok: false, error: { code: "ROOM_PLAYER_NOT_FOUND", message: "room player not found" } });
    return;
  }

  const wasFirstFinisher = !hasAnyCurrentPlayerFinished(room.id);

  setPlayerReady(room.id, body.user_id, true);
  setPlayerRaceState(room.id, body.user_id, {
    raceProgress: 100,
    raceDistanceToGoal: 0,
    raceFinishedAtMs: body.finish_time_ms
  });

  if (hasEveryCurrentPlayerFinished(room.id)) {
    setRoomPhase(room, "finished");
  } else if (wasFirstFinisher) {
    applyFirstFinishCountdown(room);
  }

  res.json({ ok: true, result: toRaceResult(room.id), room: toRoomSummary(room) });
});

apiRoutes.get("/rooms/:roomId/results", (req, res) => {
  const room = rooms.get(req.params.roomId);

  if (room === undefined) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "room not found" } });
    return;
  }

  if (room.phase !== "finished") {
    res.status(404).json({ ok: false, error: { code: "RESULT_NOT_READY", message: "아직 레이스 결과가 없어요." } });
    return;
  }

  res.json({ ok: true, result: toRaceResult(room.id), room: toRoomSummary(room) });
});

function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } }
): z.infer<T> | null {
  const parsed = schema.safeParse(body);

  if (parsed.success) {
    return parsed.data;
  }

  res.status(400).json({
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: "request body did not match the API contract",
      details: parsed.error.flatten()
    }
  });
  return null;
}

function toRoomSummary(room: RoomSummary) {
  return {
    id: room.id,
    name: room.name,
    hostId: roomHosts.get(room.id) ?? null,
    host_id: roomHosts.get(room.id) ?? null,
    hostNickname: room.hostNickname,
    host_nickname: room.hostNickname,
    isPublic: room.isPublic,
    is_public: room.isPublic,
    players: getRoomPlayerCount(room.id),
    maxPlayers: room.maxPlayers,
    max_players: room.maxPlayers,
    phase: room.phase,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - room.createdAt) / 1000)),
    elapsed_seconds: Math.max(0, Math.floor((Date.now() - room.createdAt) / 1000)),
    phaseEndsAt: room.phaseEndsAt,
    phase_ends_at: room.phaseEndsAt
  };
}

function toRoomSnapshot(room: RoomSummary) {
  return {
    ok: true,
    room: toRoomSummary(room),
    players: toRoomPlayers(room.id)
  };
}

function readBearerToken(req: { headers: { authorization?: string | string[] } }) {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (value === undefined) {
    return undefined;
  }

  const [scheme, token] = value.split(/\s+/u);

  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function requireWorker(
  req: { headers: { authorization?: string | string[]; "x-worker-token"?: string | string[] } },
  res: { status: (code: number) => { json: (body: unknown) => void } }
) {
  const expectedToken = env.WORKER_TOKEN ?? (env.NODE_ENV === "production" ? undefined : "dev-worker-token");

  if (expectedToken === undefined) {
    res.status(503).json({
      ok: false,
      error: { code: "WORKER_TOKEN_MISSING", message: "worker token is required" }
    });
    return false;
  }

  const providedToken = readBearerToken(req) ?? readHeaderString(req.headers["x-worker-token"]);

  if (providedToken !== expectedToken) {
    res.status(401).json({
      ok: false,
      error: { code: "WORKER_AUTHENTICATION_FAILED", message: "worker authentication failed" }
    });
    return false;
  }

  return true;
}

function getSessionByToken(token: string | undefined) {
  if (token === undefined) {
    return null;
  }

  return Array.from(sessions.values()).find((session) => session.token === token) ?? null;
}

function resolveActionSession(
  userId: string | undefined,
  req: { headers: { authorization?: string | string[] } },
  res: { status: (code: number) => { json: (body: unknown) => void } }
) {
  const session = getSessionByToken(readBearerToken(req)) ?? (userId ? sessions.get(userId) ?? null : null);

  if (session === null) {
    res.status(401).json({ ok: false, error: { code: "SESSION_REQUIRED", message: "session is required" } });
    return null;
  }

  if (userId !== undefined && session.id !== userId) {
    res.status(403).json({ ok: false, error: { code: "SESSION_FORBIDDEN", message: "session user mismatch" } });
    return null;
  }

  return session;
}

function canUseAsset(userId: string, asset: Asset) {
  return asset.creatorId === userId || asset.isPublic || asset.isSystem;
}

function queueAssetGeneration(asset: Asset, now: Date) {
  const isoNow = now.toISOString();

  asset.status = "generating";
  asset.createdAt = isoNow;
  asset.sprites = asset.sprites.map((sprite) => ({
    ...sprite,
    status: "queued",
    sheetUrl: null,
    frameCount: null,
    lastRegenAt: isoNow
  }));
}

function claimNextAssetJob(workerId: string) {
  const nowMs = Date.now();

  for (const asset of assets.values()) {
    if (asset.isSystem || asset.status === "ready" || asset.status === "failed") {
      continue;
    }

    const wholeAssetJob = toAssetJob(asset, null);

    if (isWholeAssetGenerationPending(asset) && canLeaseAssetJob(wholeAssetJob.id, nowMs)) {
      asset.status = "generating";
      assetJobLeases.set(wholeAssetJob.id, { leasedBy: workerId, leaseExpiresAtMs: nowMs + ASSET_JOB_LEASE_MS });
      return { asset, sprite: null };
    }

    for (const sprite of asset.sprites) {
      const spriteJob = toAssetJob(asset, sprite);

      if ((sprite.status === "queued" || sprite.status === "generating") && canLeaseAssetJob(spriteJob.id, nowMs)) {
        asset.status = "generating";
        sprite.status = "generating";
        sprite.lastRegenAt = new Date(nowMs).toISOString();
        assetJobLeases.set(spriteJob.id, { leasedBy: workerId, leaseExpiresAtMs: nowMs + ASSET_JOB_LEASE_MS });
        return { asset, sprite };
      }
    }
  }

  return null;
}

function completeAssetJob(
  jobId: string,
  payload: {
    status: "ready" | "failed";
    sheetUrl: string | null;
    sourceImageUrl: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  }
) {
  const target = resolveAssetJob(jobId);

  if (target === null) {
    return {
      ok: false as const,
      status: 404,
      code: "ASSET_JOB_NOT_FOUND",
      message: "asset job not found"
    };
  }

  const { asset, sprite } = target;
  const now = new Date().toISOString();
  assetJobLeases.delete(jobId);

  if (payload.status === "failed") {
    if (sprite === null) {
      asset.status = "failed";
      asset.sprites = asset.sprites.map((candidateSprite) => ({
        ...candidateSprite,
        status: candidateSprite.status === "ready" ? "ready" : "failed"
      }));
    } else {
      sprite.status = "failed";
      sprite.lastRegenAt = now;
      asset.status = "failed";
    }

    return { ok: true as const, asset, sprite };
  }

  const outputUrl = payload.sheetUrl ?? payload.sourceImageUrl ?? asset.sourceImageUrl;

  if (payload.sourceImageUrl !== null) {
    asset.sourceImageUrl = payload.sourceImageUrl;
  }

  if (sprite === null) {
    asset.status = "ready";
    asset.sprites = asset.sprites.map((candidateSprite) => ({
      ...candidateSprite,
      status: "ready",
      sheetUrl: outputUrl,
      frameCount: candidateSprite.action === "static" ? 1 : candidateSprite.frameCount ?? 8,
      lastRegenAt: candidateSprite.lastRegenAt ?? now
    }));
  } else {
    sprite.status = "ready";
    sprite.sheetUrl = outputUrl;
    sprite.frameCount = sprite.action === "static" ? 1 : sprite.frameCount ?? 8;
    sprite.lastRegenAt = now;
    asset.status = asset.sprites.every((candidateSprite) => candidateSprite.status === "ready") ? "ready" : "generating";
  }

  return { ok: true as const, asset, sprite };
}

function resolveAssetJob(jobId: string) {
  for (const asset of assets.values()) {
    if (toAssetJob(asset, null).id === jobId) {
      return { asset, sprite: null };
    }

    for (const sprite of asset.sprites) {
      if (toAssetJob(asset, sprite).id === jobId) {
        return { asset, sprite };
      }
    }
  }

  return null;
}

function isWholeAssetGenerationPending(asset: Asset) {
  return asset.status === "queued" || asset.sprites.every((sprite) => sprite.status !== "ready");
}

function canLeaseAssetJob(jobId: string, nowMs: number) {
  const lease = assetJobLeases.get(jobId);

  return lease === undefined || lease.leaseExpiresAtMs <= nowMs;
}

function listAssetJobs(userId: string | null) {
  return Array.from(assets.values())
    .filter((asset) => !asset.isSystem && (asset.isPublic || asset.creatorId === userId))
    .flatMap((asset) => [
      toAssetJob(asset, null),
      ...asset.sprites.map((sprite) => toAssetJob(asset, sprite))
    ]);
}

function toAssetJob(asset: Asset, sprite: AssetSprite | null) {
  const status = sprite?.status ?? asset.status;
  const updatedAt = sprite?.lastRegenAt ?? asset.createdAt;

  return {
    id: sprite === null ? `job-${asset.id}-asset` : `job-${asset.id}-sprite-${sprite.action}`,
    userId: asset.creatorId,
    user_id: asset.creatorId,
    status,
    targetType: sprite === null ? asset.category : "sprite",
    target_type: sprite === null ? asset.category : "sprite",
    outputAssetId: asset.id,
    output_asset_id: asset.id,
    action: sprite?.action ?? null,
    errorCode: status === "failed" ? "GENERATION_FAILED" : null,
    error_code: status === "failed" ? "GENERATION_FAILED" : null,
    errorMessage: status === "failed" ? "에셋 생성에 실패했어요." : null,
    error_message: status === "failed" ? "에셋 생성에 실패했어요." : null,
    updatedAtMs: Date.parse(updatedAt),
    updated_at_ms: Date.parse(updatedAt)
  };
}

function toWorkerJob(asset: Asset, sprite: AssetSprite | null) {
  const requestedActions = sprite === null ? asset.sprites.map((candidateSprite) => candidateSprite.action) : [sprite.action];

  return {
    ...toAssetJob(asset, sprite),
    assetId: asset.id,
    asset_id: asset.id,
    category: asset.category,
    name: asset.name,
    description: asset.description,
    image: asset.sourceImageUrl,
    attrs: asset.attrs,
    widthCells: asset.widthCells,
    width_cells: asset.widthCells,
    heightCells: asset.heightCells,
    height_cells: asset.heightCells,
    requestedActions,
    requested_actions: requestedActions
  };
}

function joinRoomState(room: RoomSummary, userId: string) {
  const players = roomPlayers.get(room.id) ?? new Set<string>();
  const isHost = roomHosts.get(room.id) === undefined || roomHosts.get(room.id) === userId;

  if (isHost && roomHosts.get(room.id) === undefined) {
    roomHosts.set(room.id, userId);
  }

  players.add(userId);
  roomPlayers.set(room.id, players);
  room.players = players.size;
  setPlayerReady(room.id, userId, isHost);
}

function getRoomPlayerCount(roomId: string) {
  return roomPlayers.get(roomId)?.size ?? rooms.get(roomId)?.players ?? 0;
}

function canJoinRoomPhase(room: RoomSummary) {
  if (room.phase === "lobby") {
    return true;
  }

  if (room.phase !== "building" || room.phaseEndsAt === null) {
    return false;
  }

  return Date.parse(room.phaseEndsAt) - Date.now() >= BUILD_LATE_JOIN_CUTOFF_MS;
}

function toRoomPlayers(roomId: string) {
  const players = Array.from(roomPlayers.get(roomId) ?? []);
  const hostId = roomHosts.get(roomId);
  const readyPlayers = roomReadyPlayers.get(roomId) ?? new Set<string>();
  const raceStates = racePlayerStates.get(roomId) ?? new Map<string, RacePlayerState>();

  return players.map((userId) => {
    const session = sessions.get(userId);
    const raceState = raceStates.get(userId) ?? createDefaultRacePlayerState();
    const isHost = hostId === userId;
    const nickname = session?.nickname ?? (isHost ? rooms.get(roomId)?.hostNickname ?? "host" : "플레이어");

    return {
      userId,
      user_id: userId,
      nickname,
      isHost,
      is_host: isHost,
      isReady: isHost || readyPlayers.has(userId),
      is_ready: isHost || readyPlayers.has(userId),
      validationCleared: raceState.validationCleared,
      validation_cleared: raceState.validationCleared,
      raceProgress: raceState.raceProgress,
      race_progress: raceState.raceProgress,
      raceFinishedAtMs: raceState.raceFinishedAtMs,
      race_finished_at_ms: raceState.raceFinishedAtMs,
      raceDistanceToGoal: raceState.raceDistanceToGoal,
      race_distance_to_goal: raceState.raceDistanceToGoal
    };
  });
}

function setRoomPhase(room: RoomSummary, phase: RoomPhase, durationOverrideMs?: number) {
  const durationMs = durationOverrideMs ?? ROOM_PHASE_DURATIONS_MS[phase];

  room.phase = phase;
  room.createdAt = Date.now();
  room.phaseEndsAt = durationMs === null ? null : new Date(Date.now() + durationMs).toISOString();
}

function applyFirstFinishCountdown(room: RoomSummary, nowMs = Date.now()) {
  room.createdAt = nowMs;
  room.phaseEndsAt = new Date(nowMs + FIRST_FINISH_COUNTDOWN_MS).toISOString();
}

function setPlayerReady(roomId: string, userId: string, isReady: boolean) {
  const readyPlayers = roomReadyPlayers.get(roomId) ?? new Set<string>();

  if (isReady) {
    readyPlayers.add(userId);
  } else {
    readyPlayers.delete(userId);
  }

  roomReadyPlayers.set(roomId, readyPlayers);
}

function resetRoomReadiness(roomId: string) {
  roomReadyPlayers.set(roomId, new Set<string>());
}

function assignNextHost(room: RoomSummary) {
  const nextHostId = roomPlayers.get(room.id)?.values().next().value as string | undefined;

  if (nextHostId === undefined) {
    return;
  }

  roomHosts.set(room.id, nextHostId);
  setPlayerReady(room.id, nextHostId, true);
  room.hostNickname = sessions.get(nextHostId)?.nickname ?? "host";
}

function canStartRoom(roomId: string) {
  const players = Array.from(roomPlayers.get(roomId) ?? []);
  const hostId = roomHosts.get(roomId);
  const readyPlayers = roomReadyPlayers.get(roomId) ?? new Set<string>();

  return players.length >= 2 && players.every((userId) => userId === hostId || readyPlayers.has(userId));
}

function isRoomPlayer(roomId: string, userId: string) {
  return roomPlayers.get(roomId)?.has(userId) ?? false;
}

function hasEveryCurrentPlayerSubmitted(roomId: string) {
  const players = Array.from(roomPlayers.get(roomId) ?? []);

  return (
    players.length > 0 &&
    players.every((userId) =>
      Array.from(segments.values()).some((segment) => segment.roomId === roomId && segment.creatorId === userId)
    )
  );
}

function hasEveryCurrentPlayerValidated(roomId: string) {
  const players = Array.from(roomPlayers.get(roomId) ?? []);

  return (
    players.length > 0 &&
    players.every((userId) =>
      Array.from(segments.values()).some(
        (segment) => segment.roomId === roomId && segment.creatorId === userId && segment.validatedAt !== null
      )
    )
  );
}

function hasEveryCurrentPlayerFinished(roomId: string) {
  const players = Array.from(roomPlayers.get(roomId) ?? []);
  const raceStates = racePlayerStates.get(roomId) ?? new Map<string, RacePlayerState>();

  return players.length > 0 && players.every((userId) => typeof raceStates.get(userId)?.raceFinishedAtMs === "number");
}

function hasAnyCurrentPlayerFinished(roomId: string) {
  const raceStates = racePlayerStates.get(roomId) ?? new Map<string, RacePlayerState>();

  return Array.from(roomPlayers.get(roomId) ?? []).some(
    (userId) => typeof raceStates.get(userId)?.raceFinishedAtMs === "number"
  );
}

function getRaceDurationMs(segmentCount: number) {
  return Math.max(1, segmentCount) * RACE_MS_PER_LINE;
}

function setPlayerRaceState(roomId: string, userId: string, patch: Partial<RacePlayerState>) {
  const raceStates = racePlayerStates.get(roomId) ?? new Map<string, RacePlayerState>();
  const currentState = raceStates.get(userId) ?? createDefaultRacePlayerState();

  raceStates.set(userId, {
    ...currentState,
    ...patch
  });
  racePlayerStates.set(roomId, raceStates);
}

function createDefaultRacePlayerState(): RacePlayerState {
  return {
    validationCleared: false,
    raceProgress: 0,
    raceFinishedAtMs: null,
    raceDistanceToGoal: 100
  };
}

function toRaceResult(roomId: string) {
  const players = toRoomPlayers(roomId)
    .map((player) => ({
      userId: player.userId,
      user_id: player.userId,
      nickname: player.nickname,
      isHost: player.isHost,
      is_host: player.isHost,
      isReady: player.isReady,
      is_ready: player.isReady,
      validationCleared: player.validationCleared,
      validation_cleared: player.validationCleared,
      raceProgress: player.raceProgress,
      race_progress: player.raceProgress,
      raceFinishedAtMs: player.raceFinishedAtMs,
      race_finished_at_ms: player.raceFinishedAtMs,
      raceDistanceToGoal: player.raceDistanceToGoal,
      race_distance_to_goal: player.raceDistanceToGoal,
      rank: 0
    }))
    .sort((left, right) => compareRacePlayers(left, right))
    .map((player, index) => ({
      ...player,
      rank: index + 1
    }));

  return {
    roomId,
    room_id: roomId,
    players
  };
}

function compareRacePlayers(
  left: ReturnType<typeof toRoomPlayers>[number] & { rank: number },
  right: ReturnType<typeof toRoomPlayers>[number] & { rank: number }
) {
  if (left.raceFinishedAtMs !== null && right.raceFinishedAtMs !== null) {
    return left.raceFinishedAtMs - right.raceFinishedAtMs;
  }

  if (left.raceFinishedAtMs !== null) {
    return -1;
  }

  if (right.raceFinishedAtMs !== null) {
    return 1;
  }

  return right.raceProgress - left.raceProgress;
}

function normalizeSegmentAsset(asset: z.infer<typeof segmentAssetSchema>): MapSegmentAssetSnapshot {
  const assetId = asset.assetId ?? asset.asset_id ?? "unknown-asset";
  const storedAsset = assets.get(assetId);

  return {
    assetId,
    assetCategory: asset.assetCategory ?? asset.asset_category ?? storedAsset?.category,
    assetAttrs: asset.assetAttrs ?? asset.asset_attrs ?? storedAsset?.attrs,
    colliderType: asset.colliderType ?? asset.collider_type ?? storedAsset?.colliderType,
    x: asset.x,
    y: asset.y,
    widthCells: asset.widthCells ?? asset.width_cells ?? storedAsset?.widthCells ?? 1,
    heightCells: asset.heightCells ?? asset.height_cells ?? storedAsset?.heightCells ?? 1,
    rotation: asset.rotation
  };
}

function buildFallbackSegment(roomId: string): MapSegmentSnapshot {
  const groundAsset = assets.get("system-platform-grass");
  const startPoint = { x: 0, y: 8 };
  const endPoint = { x: 16, y: 8 };
  const assetRefs: MapSegmentAssetSnapshot[] = Array.from({ length: 18 }, (_, index) => ({
    assetId: groundAsset?.id ?? "system-platform-grass",
    assetCategory: groundAsset?.category ?? "platform",
    assetAttrs: groundAsset?.attrs,
    colliderType: groundAsset?.colliderType ?? "rect",
    x: index,
    y: 9,
    widthCells: groundAsset?.widthCells ?? 1,
    heightCells: groundAsset?.heightCells ?? 1,
    rotation: 0
  }));

  return {
    id: "server-fallback-segment",
    roomId,
    creatorId: "server",
    startPoint,
    endPoint,
    placements: [],
    assetRefs,
    segmentHash: "server-fallback-segment",
    isValidated: true,
    submittedAt: new Date().toISOString(),
    validatedAt: new Date().toISOString(),
    clearTimeMs: null
  };
}

function buildMergedMap(roomId: string, sourceSegments: MapSegmentSnapshot[], usedFallback: boolean): MergedMap {
  const groundAsset = assets.get("system-platform-grass");
  const placements: MergedMapPlacement[] = [];
  let globalStart: MapPoint = { x: 0, y: 8 };
  let currentGlobalEnd: MapPoint | null = null;

  sourceSegments.forEach((segment, segmentIndex) => {
    const connectorCells = segmentIndex === 0 ? 0 : 3;
    const offsetX =
      currentGlobalEnd === null
        ? -segment.startPoint.x
        : currentGlobalEnd.x + connectorCells - segment.startPoint.x;
    const offsetY =
      currentGlobalEnd === null ? 8 - segment.startPoint.y : currentGlobalEnd.y - segment.startPoint.y;

    if (currentGlobalEnd !== null) {
      for (let index = 0; index < connectorCells; index += 1) {
        placements.push({
          assetId: groundAsset?.id ?? "system-platform-grass",
          assetCategory: groundAsset?.category ?? "platform",
          assetAttrs: groundAsset?.attrs,
          colliderType: groundAsset?.colliderType ?? "rect",
          sourceSegmentId: "connector",
          x: currentGlobalEnd.x + index,
          y: currentGlobalEnd.y + 1,
          widthCells: groundAsset?.widthCells ?? 1,
          heightCells: groundAsset?.heightCells ?? 1,
          rotation: 0
        });
      }
    }

    segment.assetRefs.forEach((assetRef) => {
      placements.push({
        assetId: assetRef.assetId,
        assetCategory: assetRef.assetCategory ?? assets.get(assetRef.assetId)?.category,
        assetAttrs: assetRef.assetAttrs ?? assets.get(assetRef.assetId)?.attrs,
        colliderType: assetRef.colliderType ?? assets.get(assetRef.assetId)?.colliderType,
        sourceSegmentId: segment.id,
        x: assetRef.x + offsetX,
        y: assetRef.y + offsetY,
        widthCells: assetRef.widthCells,
        heightCells: assetRef.heightCells,
        rotation: assetRef.rotation
      });
    });

    const segmentStart = {
      x: segment.startPoint.x + offsetX,
      y: segment.startPoint.y + offsetY
    };
    const segmentEnd = {
      x: segment.endPoint.x + offsetX,
      y: segment.endPoint.y + offsetY
    };

    if (segmentIndex === 0) {
      globalStart = segmentStart;
    }

    currentGlobalEnd = segmentEnd;
  });

  return {
    id: crypto.randomUUID(),
    roomId,
    globalStart,
    globalEnd: currentGlobalEnd ?? globalStart,
    placements,
    segments: sourceSegments,
    usedFallback,
    createdAt: new Date().toISOString()
  };
}

function shuffleSegments<T>(values: T[]) {
  return [...values].sort(() => Math.random() - 0.5);
}

function createSpriteJobs(category: AssetCategory, now: string): AssetSprite[] {
  void now;

  if (category === "avatar" || category === "monster") {
    return [
      { action: "idle", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: null },
      { action: "walk", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: null },
      { action: "onair", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: null }
    ];
  }

  return [{ action: "static", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: null }];
}

function normalizeSpriteAction(value: string) {
  if (value === "idle" || value === "walk" || value === "onair" || value === "static") {
    return value;
  }

  return null;
}

function inferColliderType(
  category: AssetCategory,
  attrs: Record<string, string | number | boolean | null>
): Asset["colliderType"] {
  if (category === "background") {
    return "none";
  }

  if (category === "platform" && typeof attrs.shape === "string" && attrs.shape.startsWith("slope-")) {
    return "slope";
  }

  return "rect";
}

function updateAssetGenerationStates() {
  const now = Date.now();

  assets.forEach((asset) => {
    if (asset.isSystem || asset.status === "ready" || asset.status === "failed") {
      return;
    }

    const elapsedMs = now - new Date(asset.createdAt).getTime();

    if (elapsedMs >= 8_000) {
      asset.status = "ready";
      asset.sprites = asset.sprites.map((sprite) => ({
        ...sprite,
        status: "ready",
        sheetUrl: asset.sourceImageUrl || null,
        frameCount: sprite.action === "static" ? 1 : 8
      }));
      return;
    }

    if (elapsedMs >= 2_000) {
      asset.status = "generating";
      asset.sprites = asset.sprites.map((sprite) => ({
        ...sprite,
        status: sprite.status === "queued" ? "generating" : sprite.status
      }));
    }
  });
}

function makeSegmentHash(startPoint: MapPoint, endPoint: MapPoint, assetRefs: MapSegmentAssetSnapshot[]) {
  let hash = 5381;
  const value = JSON.stringify({ startPoint, endPoint, assetRefs });

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return `mem-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function makeDeviceCode() {
  const words = ["TIGER", "RAMP", "PIXEL", "RELAY", "BLOCK", "JUMP"];

  for (let index = 0; index < 20; index += 1) {
    const code = `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!deviceLinks.has(code)) {
      return code;
    }
  }

  return `RELAY-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalizeDeviceCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

function seedDefaults() {
  if (assets.size > 0) {
    return;
  }

  const createdAt = new Date(0).toISOString();
  const defaultAssets: Asset[] = [
    {
      id: "system-avatar-stick",
      creatorId: null,
      isSystem: true,
      category: "avatar",
      name: "졸라맨",
      description: "기본 제공 아바타",
      attrs: {},
      colliderType: "rect",
      widthCells: null,
      heightCells: null,
      sourceImageUrl: "",
      remixOfId: null,
      status: "ready",
      isPublic: false,
      createdAt,
      sprites: [
        { action: "idle", status: "ready", sheetUrl: null, frameCount: 1, lastRegenAt: null },
        { action: "walk", status: "ready", sheetUrl: null, frameCount: 1, lastRegenAt: null },
        { action: "onair", status: "ready", sheetUrl: null, frameCount: 1, lastRegenAt: null }
      ]
    },
    {
      id: "system-platform-grass",
      creatorId: null,
      isSystem: true,
      category: "platform",
      name: "잔디 발판",
      description: "기본 제공 지형",
      attrs: { collision: "solid", movement: "fixed" },
      colliderType: "rect",
      widthCells: 2,
      heightCells: 1,
      sourceImageUrl: "",
      remixOfId: null,
      status: "ready",
      isPublic: false,
      createdAt,
      sprites: [{ action: "static", status: "ready", sheetUrl: null, frameCount: 1, lastRegenAt: null }]
    },
    {
      id: "system-obstacle-spike",
      creatorId: null,
      isSystem: true,
      category: "obstacle",
      name: "가시 장애물",
      description: "기본 제공 장애물",
      attrs: { contactEffect: "damage", trigger: "always" },
      colliderType: "rect",
      widthCells: 1,
      heightCells: 1,
      sourceImageUrl: "",
      remixOfId: null,
      status: "ready",
      isPublic: false,
      createdAt,
      sprites: [{ action: "static", status: "ready", sheetUrl: null, frameCount: 1, lastRegenAt: null }]
    }
  ];

  defaultAssets.forEach((asset) => assets.set(asset.id, asset));

  const defaultRoom: RoomSummary = {
    id: "room-public-1",
    name: "그리드 점프 연습방",
    hostNickname: "maker01",
    isPublic: true,
    players: 1,
    maxPlayers: 4,
    phase: "lobby",
    elapsedSeconds: 0,
    phaseEndsAt: null,
    createdAt: Date.now()
  };

  rooms.set(defaultRoom.id, defaultRoom);
  roomPlayers.set(defaultRoom.id, new Set(["system-host"]));
  roomHosts.set(defaultRoom.id, "system-host");
  setPlayerReady(defaultRoom.id, "system-host", true);
}

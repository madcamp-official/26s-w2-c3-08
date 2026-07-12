import { Router } from "express";
import { z } from "zod";

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

interface DeviceLinkTicket {
  code: string;
  userId: string;
  expiresAt: string;
}

const DEVICE_LINK_TTL_MS = 5 * 60 * 1000;

const sessions = new Map<string, UserSession>();
const assets = new Map<string, Asset>();
const rooms = new Map<string, RoomSummary>();
const roomPlayers = new Map<string, Set<string>>();
const roomHosts = new Map<string, string>();
const roomPasswords = new Map<string, string>();
const segments = new Map<string, MapSegmentSnapshot>();
const mergedMaps = new Map<string, MergedMap>();
const deviceLinks = new Map<string, DeviceLinkTicket>();

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

  if (existingHostId === undefined) {
    roomHosts.set(roomId, userId);
  }

  players.add(userId);
  roomPlayers.set(roomId, players);
  storedRoom.players = players.size;

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

  if (roomHosts.get(roomId) === userId) {
    roomHosts.delete(roomId);
  }
}

export function setApiRoomPhase(roomId: string, phase: RoomPhase) {
  const room = rooms.get(roomId);

  if (room === undefined) {
    return;
  }

  room.phase = phase;
  room.createdAt = Date.now();
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
  return mergedMap;
}

const sessionSchema = z.object({
  nickname: z.string().trim().min(1).max(12)
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
    status: "generating",
    isPublic: true,
    createdAt: now,
    sprites: createSpriteJobs(body.category, now)
  };

  assets.set(asset.id, asset);
  res.status(202).json({ ok: true, asset, job: { id: asset.id, status: "queued" } });
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
    createdAt: Date.now()
  };

  rooms.set(room.id, room);
  roomPlayers.set(room.id, new Set([body.user_id]));
  roomHosts.set(room.id, body.user_id);

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
      candidateRoom.phase === "lobby" &&
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

  if (room === undefined || room.phase !== "lobby") {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_JOINABLE", message: "room cannot be joined" } });
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

  res.status(201).json({ ok: true, segment });
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
  res.json({ ok: true, segment: validatedSegment });
});

apiRoutes.post("/rooms/:roomId/merge", (req, res) => {
  const mergedMap = mergeApiRoomMap(req.params.roomId);

  if (mergedMap === null) {
    res.status(404).json({ ok: false, error: { code: "ROOM_NOT_FOUND", message: "room not found" } });
    return;
  }

  res.json({ ok: true, mergedMap });
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
    hostNickname: room.hostNickname,
    isPublic: room.isPublic,
    players: getRoomPlayerCount(room.id),
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - room.createdAt) / 1000))
  };
}

function joinRoomState(room: RoomSummary, userId: string) {
  const players = roomPlayers.get(room.id) ?? new Set<string>();
  players.add(userId);
  roomPlayers.set(room.id, players);
  room.players = players.size;
}

function getRoomPlayerCount(roomId: string) {
  return roomPlayers.get(roomId)?.size ?? rooms.get(roomId)?.players ?? 0;
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
  if (category === "avatar" || category === "monster") {
    return [
      { action: "idle", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: now },
      { action: "walk", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: now },
      { action: "onair", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: now }
    ];
  }

  return [{ action: "static", status: "queued", sheetUrl: null, frameCount: null, lastRegenAt: now }];
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
    createdAt: Date.now()
  };

  rooms.set(defaultRoom.id, defaultRoom);
  roomPlayers.set(defaultRoom.id, new Set(["system-host"]));
  roomHosts.set(defaultRoom.id, "system-host");
}

import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import {
  FIRST_FINISH_COUNTDOWN_MS,
  applyApiFirstFinishCountdown,
  applyApiLastDance,
  ensureApiRoomForRealtime,
  getApiRoomRaceDurationMs,
  getApiRoomPhase,
  joinApiRoomFromRealtime,
  leaveApiRoomFromRealtime,
  mergeApiRoomMap,
  onApiAssetJobUpdated,
  setApiRoomPhase
} from "../http/routes/apiRoutes.js";

type RoomPhase = "lobby" | "building" | "validating" | "merging" | "racing" | "finished";

interface RoomPlayerState {
  userId: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  validationCleared: boolean;
  raceProgress: number;
  raceFinishedAtMs: number | null;
}

interface RaceResultPlayer extends RoomPlayerState {
  rank: number;
  raceDistanceToGoal: number;
}

interface RoomState {
  id: string;
  phase: RoomPhase;
  phaseEndsAt: string | null;
  players: Map<string, RoomPlayerState>;
  submittedSegmentIds: Map<string, string>;
  hasOvertime: boolean;
  timer: NodeJS.Timeout | null;
}

interface RoomJoinPayload {
  roomId?: string;
  userId?: string;
  nickname?: string;
}

interface PhasePayload {
  roomId?: string;
  userId?: string;
  phase?: RoomPhase;
}

interface RoomReadyPayload extends PhasePayload {
  isReady?: boolean;
  is_ready?: boolean;
}

interface RoomLeavePayload extends PhasePayload {}

interface TimeVotePayload extends PhasePayload {
  deltaSec?: number;
}

interface SegmentSubmittedPayload {
  roomId?: string;
  userId?: string;
  segmentId?: string;
}

interface ValidationCompletedPayload {
  roomId?: string;
  userId?: string;
  cleared?: boolean;
  segmentHash?: string;
  clearTimeMs?: number;
}

interface RacePositionPayload {
  roomId?: string;
  userId?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  state?: string;
  progress?: number;
  clientTime?: number;
}

interface RaceFinishPayload {
  roomId?: string;
  userId?: string;
  finishTimeMs?: number;
}

const PHASE_DURATIONS_MS: Partial<Record<RoomPhase, number>> = {
  building: 180_000,
  validating: 120_000,
  merging: 3_000,
};

const rooms = new Map<string, RoomState>();

export function attachSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
    },
  });
  const unsubscribeAssetJobs = onApiAssetJobUpdated((job) => {
    io.emit("asset_job:updated", job);
  });

  httpServer.on("close", unsubscribeAssetJobs);

  io.on("connection", (socket) => {
    const authUserId = readAuthUserId(socket);

    socket.on("room:join", (payload: RoomJoinPayload) => {
      const roomId = payload.roomId;
      const userId = payload.userId ?? authUserId;

      if (roomId === undefined || userId === undefined) {
        emitSocketError(socket, "INVALID_ROOM_JOIN", "roomId and userId are required");
        return;
      }

      const nickname = payload.nickname?.trim() || `player-${userId.slice(0, 4)}`;
      const room = getRoom(roomId);
      const apiRoomJoin = joinApiRoomFromRealtime(roomId, userId, nickname);

      if ("rejected" in apiRoomJoin && apiRoomJoin.rejected) {
        emitSocketError(socket, "ROOM_NOT_JOINABLE", apiRoomJoin.message);
        return;
      }

      const isHost = apiRoomJoin.isHost || room.players.size === 0;

      room.phase = apiRoomJoin.phase;
      room.phaseEndsAt = ensureApiRoomForRealtime(roomId).phaseEndsAt;

      room.players.set(userId, {
        userId,
        nickname,
        isHost,
        isReady: isHost,
        validationCleared: false,
        raceProgress: 0,
        raceFinishedAtMs: null,
      });

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.emit("room:joined", toRoomSnapshot(room));
      io.to(roomId).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("room:ready", (payload: RoomReadyPayload) => {
      const room = findPayloadRoom(socket, payload);
      const userId = payload.userId ?? socket.data.userId;

      if (room === null || userId === undefined) {
        return;
      }

      const player = room.players.get(userId);

      if (player === undefined) {
        emitSocketError(socket, "PLAYER_NOT_FOUND", "player was not found in room");
        return;
      }

      player.isReady = payload.isReady ?? payload.is_ready ?? false;
      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("room:leave", (payload: RoomLeavePayload) => {
      const room = findPayloadRoom(socket, payload);
      const userId = payload.userId ?? socket.data.userId;

      if (room === null || userId === undefined) {
        return;
      }

      leaveApiRoomFromRealtime(room.id, userId);
      room.players.delete(userId);
      socket.leave(room.id);

      if (room.players.size === 0) {
        clearRoomTimer(room);
        rooms.delete(room.id);
        return;
      }

      ensureHost(room);
      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("room:start", (payload: PhasePayload) => {
      const room = findPayloadRoom(socket, payload);

      if (room === null) {
        return;
      }

      if (room.phase === "lobby") {
        if (!canStartLobby(room)) {
          emitSocketError(socket, "ROOM_NOT_READY", "all guest players must be ready before starting");
          return;
        }

        startPhase(io, room, "building");
        return;
      }

      startPhase(io, room, getNextPhase(room.phase));
    });

    socket.on("phase:ready", (payload: PhasePayload) => {
      const room = findPayloadRoom(socket, payload);

      if (room === null) {
        return;
      }

      const userId = payload.userId ?? socket.data.userId;
      const player = userId === undefined ? undefined : room.players.get(userId);

      if (player !== undefined) {
        player.isReady = true;
      }

      io.to(room.id).emit("phase:ready", {
        roomId: room.id,
        userId,
        phase: payload.phase ?? room.phase,
      });

      if (syncRoomPhaseFromApi(io, room)) {
        return;
      }

      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("time_vote:request", (payload: TimeVotePayload) => {
      const room = findPayloadRoom(socket, payload);
      const deltaSec = clampTimeVote(payload.deltaSec);

      if (room === null || deltaSec === 0 || room.phaseEndsAt === null) {
        return;
      }

      const nextEndsAt = new Date(new Date(room.phaseEndsAt).getTime() + deltaSec * 1000);
      room.phaseEndsAt = nextEndsAt.toISOString();
      io.to(room.id).emit("time_vote:updated", {
        roomId: room.id,
        phase: room.phase,
        deltaSec,
        phaseEndsAt: room.phaseEndsAt,
      });
      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("segment:submitted", (payload: SegmentSubmittedPayload) => {
      const room = findPayloadRoom(socket, payload);
      const userId = payload.userId ?? socket.data.userId;

      if (room === null || userId === undefined || payload.segmentId === undefined) {
        return;
      }

      const player = room.players.get(userId);

      if (player !== undefined) {
        player.isReady = true;
      }

      room.submittedSegmentIds.set(userId, payload.segmentId);
      io.to(room.id).emit("segment:submitted", {
        roomId: room.id,
        userId,
        segmentId: payload.segmentId,
      });

      if (syncRoomPhaseFromApi(io, room)) {
        return;
      }

      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("validation:completed", (payload: ValidationCompletedPayload) => {
      const room = findPayloadRoom(socket, payload);
      const userId = payload.userId ?? socket.data.userId;

      if (room === null || userId === undefined) {
        return;
      }

      const player = room.players.get(userId);
      const cleared = payload.cleared === true;

      if (player !== undefined) {
        player.isReady = true;
        player.validationCleared = cleared;
      }

      io.to(room.id).emit("validation:result", {
        roomId: room.id,
        userId,
        cleared,
        segmentHash: payload.segmentHash,
        clearTimeMs: payload.clearTimeMs,
        penaltyMs: cleared ? 0 : 15_000,
      });

      if (syncRoomPhaseFromApi(io, room)) {
        return;
      }

      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });

    socket.on("race:position", (payload: RacePositionPayload) => {
      const room = findPayloadRoom(socket, payload);
      const userId = payload.userId ?? socket.data.userId;

      if (room === null || userId === undefined) {
        return;
      }

      const player = room.players.get(userId);
      const progress = clampProgress(payload.progress);

      if (player !== undefined && progress !== null) {
        player.raceProgress = Math.max(player.raceProgress, progress);
      }

      socket.to(room.id).emit("race:position", {
        ...payload,
        roomId: room.id,
        userId,
        progress,
      });
    });

    socket.on("race:finish", (payload: RaceFinishPayload) => {
      const room = findPayloadRoom(socket, payload);
      const userId = payload.userId ?? socket.data.userId;

      if (room === null || userId === undefined || payload.finishTimeMs === undefined) {
        return;
      }

      const wasFirstFinisher = !hasAnyFinisher(room);
      const player = room.players.get(userId);

      if (player !== undefined) {
        player.isReady = true;
        player.raceProgress = 100;
        player.raceFinishedAtMs =
          player.raceFinishedAtMs === null
            ? payload.finishTimeMs
            : Math.min(player.raceFinishedAtMs, payload.finishTimeMs);
      }

      io.to(room.id).emit("race:finished", {
        roomId: room.id,
        userId,
        finishTimeMs: payload.finishTimeMs,
      });

      if (Array.from(room.players.values()).every((roomPlayer) => roomPlayer.raceFinishedAtMs !== null)) {
        startPhase(io, room, "finished");
      } else if (wasFirstFinisher && !room.hasOvertime) {
        applyFirstFinishCountdown(io, room);
      }
    });

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId as string | undefined;

      if (roomId === undefined) {
        return;
      }

      const room = rooms.get(roomId);

      if (room === undefined) {
        return;
      }

      io.to(room.id).emit("room:state", toRoomSnapshot(room));
    });
  });

  return io;
}

function getRoom(roomId: string): RoomState {
  const existingRoom = rooms.get(roomId);

  if (existingRoom !== undefined) {
    return existingRoom;
  }
  const apiRoom = ensureApiRoomForRealtime(roomId);

  const room: RoomState = {
    id: roomId,
    phase: apiRoom.phase,
    phaseEndsAt: apiRoom.phaseEndsAt,
    players: new Map(),
    submittedSegmentIds: new Map(),
    hasOvertime: false,
    timer: null,
  };

  rooms.set(roomId, room);
  return room;
}

function syncRoomPhaseFromApi(io: Server, room: RoomState) {
  const apiRoom = ensureApiRoomForRealtime(room.id);

  if (apiRoom.phase === room.phase && apiRoom.phaseEndsAt === room.phaseEndsAt) {
    return false;
  }

  clearRoomTimer(room);
  room.phase = apiRoom.phase;
  room.phaseEndsAt = apiRoom.phaseEndsAt;

  if (room.phase === "building" || room.phase === "validating" || room.phase === "racing") {
    room.players.forEach((player) => {
      player.isReady = false;
    });
  }

  if (room.phase === "racing") {
    room.hasOvertime = false;
    room.players.forEach((player) => {
      player.raceProgress = 0;
      player.raceFinishedAtMs = null;
    });
  }

  io.to(room.id).emit("phase:changed", {
    roomId: room.id,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
  });
  io.to(room.id).emit("room:state", toRoomSnapshot(room));

  if (room.phaseEndsAt !== null) {
    room.timer = setInterval(() => tickRoomTimer(io, room), 1_000);
  }

  if (room.phase === "finished") {
    io.to(room.id).emit("results:final", {
      roomId: room.id,
      players: buildRaceResults(room),
    });
  }

  return true;
}

function startPhase(io: Server, room: RoomState, phase: RoomPhase) {
  clearRoomTimer(room);
  room.phase = phase;
  const durationMs = phase === "racing" ? getApiRoomRaceDurationMs(room.id) : PHASE_DURATIONS_MS[phase];

  setApiRoomPhase(room.id, phase);
  const mergedMap = phase === "merging" ? mergeApiRoomMap(room.id) : null;
  room.phaseEndsAt =
    durationMs === undefined
      ? null
      : new Date(Date.now() + durationMs).toISOString();

  if (phase === "building" || phase === "validating" || phase === "racing") {
    room.players.forEach((player) => {
      player.isReady = false;
    });
  }

  if (phase === "racing") {
    room.hasOvertime = false;
    room.players.forEach((player) => {
      player.raceProgress = 0;
      player.raceFinishedAtMs = null;
    });
  }

  io.to(room.id).emit("phase:changed", {
    roomId: room.id,
    phase,
    phaseEndsAt: room.phaseEndsAt,
  });
  io.to(room.id).emit("room:state", toRoomSnapshot(room));

  if (mergedMap !== null) {
    io.to(room.id).emit("map:merged", mergedMap);
  }

  if (room.phaseEndsAt !== null) {
    room.timer = setInterval(() => tickRoomTimer(io, room), 1_000);
  }

  if (phase === "finished") {
    io.to(room.id).emit("results:final", {
      roomId: room.id,
      players: buildRaceResults(room),
    });
  }
}

function applyFirstFinishCountdown(io: Server, room: RoomState) {
  const countdownEndsAt = new Date(Date.now() + FIRST_FINISH_COUNTDOWN_MS).toISOString();

  room.phaseEndsAt = countdownEndsAt;
  applyApiFirstFinishCountdown(room.id);

  io.to(room.id).emit("phase:changed", {
    roomId: room.id,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    isFinishCountdown: true,
  });
  io.to(room.id).emit("room:state", toRoomSnapshot(room));
}

function tickRoomTimer(io: Server, room: RoomState) {
  if (room.phaseEndsAt === null) {
    return;
  }

  const remainingMs = Math.max(0, new Date(room.phaseEndsAt).getTime() - Date.now());

  io.to(room.id).emit("timer:tick", {
    roomId: room.id,
    phase: room.phase,
    remainingMs,
  });

  if (remainingMs > 0) {
    return;
  }

  if (room.phase === "racing" && !room.hasOvertime && !hasAnyFinisher(room)) {
    room.hasOvertime = true;
    room.phaseEndsAt = new Date(Date.now() + 30_000).toISOString();
    applyApiLastDance(room.id);
    io.to(room.id).emit("phase:changed", {
      roomId: room.id,
      phase: room.phase,
      phaseEndsAt: room.phaseEndsAt,
      isOvertime: true,
    });
    io.to(room.id).emit("room:state", toRoomSnapshot(room));
    return;
  }

  startPhase(io, room, getNextPhase(room.phase));
}

function toRoomSnapshot(room: RoomState) {
  return {
    roomId: room.id,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    players: Array.from(room.players.values()).map((player) => ({
      ...player,
      raceDistanceToGoal: getRaceDistanceToGoal(player),
    })),
    submittedSegmentIds: Object.fromEntries(room.submittedSegmentIds),
    hasOvertime: room.hasOvertime,
  };
}

function buildRaceResults(room: RoomState): RaceResultPlayer[] {
  return Array.from(room.players.values())
    .map((player) => ({
      ...player,
      raceDistanceToGoal: getRaceDistanceToGoal(player),
    }))
    .sort((left, right) => {
      const leftFinished = left.raceFinishedAtMs !== null;
      const rightFinished = right.raceFinishedAtMs !== null;

      if (leftFinished && rightFinished) {
        return (left.raceFinishedAtMs ?? 0) - (right.raceFinishedAtMs ?? 0);
      }

      if (leftFinished !== rightFinished) {
        return leftFinished ? -1 : 1;
      }

      return left.raceDistanceToGoal - right.raceDistanceToGoal;
    })
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

function getRaceDistanceToGoal(player: RoomPlayerState) {
  return Math.max(0, 100 - Math.min(100, Math.max(0, player.raceProgress)));
}

function findPayloadRoom(socket: Socket, payload: { roomId?: string }) {
  const roomId = payload.roomId ?? (socket.data.roomId as string | undefined);

  if (roomId === undefined) {
    emitSocketError(socket, "ROOM_NOT_JOINED", "join a room before sending room events");
    return null;
  }

  const room = rooms.get(roomId);

  if (room === undefined) {
    emitSocketError(socket, "ROOM_NOT_FOUND", "room state was not found");
    return null;
  }

  return room;
}

function getNextPhase(phase: RoomPhase): RoomPhase {
  if (phase === "lobby") {
    return "building";
  }

  if (phase === "building") {
    return "validating";
  }

  if (phase === "validating") {
    return "merging";
  }

  if (phase === "merging") {
    return "racing";
  }

  if (phase === "racing") {
    return "finished";
  }

  return "finished";
}

function clearRoomTimer(room: RoomState) {
  if (room.timer !== null) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function ensureHost(room: RoomState) {
  if (Array.from(room.players.values()).some((player) => player.isHost)) {
    return;
  }

  const [firstPlayer] = room.players.values();

  if (firstPlayer !== undefined) {
    firstPlayer.isHost = true;
    firstPlayer.isReady = true;
  }
}

function canStartLobby(room: RoomState) {
  const players = Array.from(room.players.values());

  return players.length >= 2 && players.every((player) => player.isHost || player.isReady);
}

function hasAnyFinisher(room: RoomState) {
  return Array.from(room.players.values()).some((player) => player.raceFinishedAtMs !== null);
}

function clampProgress(progress: number | undefined) {
  if (progress === undefined || Number.isNaN(progress)) {
    return null;
  }

  return Math.min(100, Math.max(0, progress));
}

function clampTimeVote(deltaSec: number | undefined) {
  if (deltaSec === undefined) {
    return 0;
  }

  if (deltaSec >= 15) {
    return 15;
  }

  if (deltaSec <= -15) {
    return -15;
  }

  return 0;
}

function readAuthUserId(socket: Socket) {
  const userId = socket.handshake.auth.userId;

  return typeof userId === "string" ? userId : undefined;
}

function emitSocketError(socket: Socket, code: string, message: string) {
  socket.emit("error", {
    ok: false,
    error: { code, message },
  });
}

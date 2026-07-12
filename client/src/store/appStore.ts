import { create, type StoreApi } from 'zustand'
import {
  consumeDeviceLinkCode,
  createAsset,
  createDeviceLinkCode,
  createRoom,
  createSession,
  getStoredSession,
  joinPublicRoom,
  joinRoom as joinRoomRequest,
  listAssets,
  listRooms,
  mergeRoomMap,
  saveMockAssets,
  saveMockRooms,
  saveMapSegment,
  saveStoredSession,
  validateMapSegment,
} from '../net/api'
import {
  connectRealtime,
  disconnectRealtime,
  leaveRealtimeRoom,
  notifyRealtimeMapMerged,
  notifyRealtimeMapSegmentSnapshot,
  notifyRealtimeLobbyReady,
  notifyRealtimeLobbyPresence,
  notifyRealtimeRoomsChanged,
  getRealtimeStatus,
  joinRealtimeRoom,
  notifyRealtimeRaceFinish,
  notifyRealtimeResultsFinal,
  notifyRealtimeSegmentSubmitted,
  notifyRealtimeValidationCompleted,
  readyRealtimePhase,
  requestRealtimeTimeVote,
  sendRealtimeRacePosition,
  startRealtimeRoom,
  type RealtimeRoomSnapshot,
  type RealtimeStatus,
} from '../net/realtime'
import type {
  AppView,
  Asset,
  CreateAssetPayload,
  CreateMapSegmentPayload,
  CreateRoomPayload,
  DeviceLinkTicket,
  MapPoint,
  MergedMap,
  MergedMapPlacement,
  MapSegmentAssetSnapshot,
  MapSegmentSnapshot,
  MapPlacement,
  RacePositionSnapshot,
  RoomSummary,
  RoomPlayer,
  UserSession,
  WarehouseTab,
} from '../types/domain'

interface UserSettings {
  bgmVolume: number
  sfxVolume: number
  bgmMuted: boolean
  sfxMuted: boolean
}

interface TimeVoteState {
  phase: RoomSummary['phase']
  deltaSeconds: number
  voterIds: string[]
  approved: boolean
  applied: boolean
}

interface AppState {
  view: AppView
  warehouseTab: WarehouseTab
  studioSourceAssetId: string | null
  session: UserSession | null
  assets: Asset[]
  rooms: RoomSummary[]
  currentRoom: RoomSummary | null
  roomPlayers: RoomPlayer[]
  mapSegments: MapSegmentSnapshot[]
  currentSegment: MapSegmentSnapshot | null
  mergedMap: MergedMap | null
  racePositions: Record<string, RacePositionSnapshot>
  apiSource: 'api' | 'mock'
  isLoading: boolean
  isSettingsOpen: boolean
  realtimeStatus: RealtimeStatus
  phaseRemainingMs: number | null
  currentTimeVote: TimeVoteState | null
  isRaceOvertime: boolean
  settings: UserSettings
  boot: () => Promise<void>
  login: (nickname: string) => Promise<void>
  logout: () => void
  navigate: (view: AppView) => void
  openWarehouse: (tab: WarehouseTab) => void
  openStudioWithAsset: (assetId: string, category: Asset['category']) => void
  clearStudioSourceAsset: () => void
  refreshAssets: () => Promise<void>
  refreshRooms: () => Promise<void>
  submitAsset: (payload: Omit<CreateAssetPayload, 'userId'>) => Promise<void>
  equipAvatar: (assetId: string) => void
  requestSpriteRegeneration: (assetId: string, action: Asset['sprites'][number]['action']) => void
  createRoom: (payload: Omit<CreateRoomPayload, 'userId'>) => Promise<void>
  enterRoom: (room: RoomSummary, password?: string) => Promise<boolean>
  enterPublicRoom: () => Promise<boolean>
  leaveRoom: () => void
  toggleLobbyReady: () => void
  advanceRoomPhase: () => void
  requestTimeVote: (deltaSeconds: number) => void
  submitMapSegment: (payload: Omit<CreateMapSegmentPayload, 'userId'>) => Promise<boolean>
  validateCurrentSegment: (cleared: boolean, clearTimeMs: number) => Promise<boolean>
  mergeCurrentRoomMap: () => Promise<MergedMap | null>
  markValidationCleared: () => void
  updateRaceProgress: (progressById: Record<string, number>) => void
  recordRaceFinish: (playerId: string, finishTimeMs: number) => void
  broadcastRacePosition: (position: Omit<RacePositionSnapshot, 'userId'>) => void
  tickMockGeneration: () => void
  tickRoomElapsed: () => void
  setSettingsOpen: (isOpen: boolean) => void
  updateSettings: (settings: Partial<UserSettings>) => void
  updateNickname: (nickname: string) => void
  issueDeviceLinkCode: () => Promise<DeviceLinkTicket | null>
  loadSessionByDeviceCode: (code: string) => Promise<boolean>
}

const SETTINGS_KEY = 'relay.settings'
const API_ASSET_POLL_INTERVAL_MS = 5_000
const MOCK_SPRITE_GENERATING_MS = 2_000
const MOCK_SPRITE_READY_MS = 8_000
let lastApiAssetPollAt = 0

const defaultSettings: UserSettings = {
  bgmVolume: 60,
  sfxVolume: 80,
  bgmMuted: false,
  sfxMuted: false,
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'main',
  warehouseTab: 'avatar',
  studioSourceAssetId: null,
  session: null,
  assets: [],
  rooms: [],
  currentRoom: null,
  roomPlayers: [],
  mapSegments: [],
  currentSegment: null,
  mergedMap: null,
  racePositions: {},
  apiSource: 'mock',
  isLoading: true,
  isSettingsOpen: false,
  realtimeStatus: 'idle',
  phaseRemainingMs: null,
  currentTimeVote: null,
  isRaceOvertime: false,
  settings: readSettings(),

  boot: async () => {
    const session = getStoredSession()
    set({ session, isLoading: false })

    if (session !== null) {
      connectStoreRealtime(session, set, get)
      await Promise.all([get().refreshAssets(), get().refreshRooms()])
    }
  },

  login: async (nickname) => {
    set({ isLoading: true })

    try {
      const result = await createSession({ nickname })
      set({ session: result.data, apiSource: result.source, view: 'main' })
      connectStoreRealtime(result.data, set, get)
      await Promise.all([get().refreshAssets(), get().refreshRooms()])
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    disconnectRealtime()
    saveStoredSession(null)
    set({
      session: null,
      assets: [],
      rooms: [],
      currentRoom: null,
      roomPlayers: [],
      mapSegments: [],
      currentSegment: null,
      mergedMap: null,
      racePositions: {},
      realtimeStatus: 'idle',
      phaseRemainingMs: null,
      currentTimeVote: null,
      isRaceOvertime: false,
      view: 'main',
      warehouseTab: 'avatar',
      studioSourceAssetId: null,
    })
  },

  navigate: (view) => set({ view, studioSourceAssetId: null }),

  openWarehouse: (tab) => set({ view: 'warehouse', warehouseTab: tab }),

  openStudioWithAsset: (assetId, category) =>
    set({
      view: category === 'avatar' ? 'avatar' : 'studio',
      warehouseTab: category === 'avatar' ? 'avatar' : 'component',
      studioSourceAssetId: assetId,
    }),

  clearStudioSourceAsset: () => set({ studioSourceAssetId: null }),

  refreshAssets: async () => {
    const { session } = get()
    if (session === null) {
      return
    }

    const result = await listAssets(session.id)
    set((state) => ({
      assets:
        result.source === 'api'
          ? mergeAssetsWithLocalWorkingCopies(result.data, state.assets)
          : result.data,
      apiSource: result.source,
    }))
  },

  refreshRooms: async () => {
    const result = await listRooms()
    const rooms = normalizeMockRoomsForSession(result.source, result.data, get().session)

    set({ rooms, apiSource: result.source })
  },

  submitAsset: async (payload) => {
    const { session } = get()
    if (session === null) {
      return
    }

    set({ isLoading: true })

    try {
      const result = await createAsset({ ...payload, userId: session.id })
      set((state) => ({
        assets: [result.data, ...state.assets.filter((asset) => asset.id !== result.data.id)],
        apiSource: result.source,
        view: payload.category === 'avatar' ? 'main' : 'warehouse',
        warehouseTab: payload.category === 'avatar' ? state.warehouseTab : 'component',
        studioSourceAssetId: null,
      }))
    } finally {
      set({ isLoading: false })
    }
  },

  equipAvatar: (assetId) => {
    const { session } = get()
    if (session === null) {
      return
    }

    const updatedSession = { ...session, avatarAssetId: assetId }
    saveStoredSession(updatedSession)
    set({ session: updatedSession })
  },

  requestSpriteRegeneration: (assetId, action) => {
    const requestedAt = new Date().toISOString()
    const assets = get().assets.map((asset) => {
      if (asset.id !== assetId) {
        return asset
      }

      return {
        ...asset,
        status: 'generating' as const,
        sprites: asset.sprites.map((sprite) =>
          sprite.action === action
            ? {
                ...sprite,
                status: 'queued' as const,
                sheetUrl: null,
                frameCount: null,
                lastRegenAt: requestedAt,
              }
            : sprite,
        ),
      }
    })

    saveMockAssets(assets)
    set({ assets })
  },

  createRoom: async (payload) => {
    const { session } = get()
    if (session === null) {
      return
    }

    const result = await createRoom({ ...payload, userId: session.id })
    const roomEntry = buildInitialRoomEntry(
      session,
      markSessionAsRoomHost(result.data, session),
      result.source,
    )

    set((state) => ({
      rooms: persistMockRoomsIfNeeded(result.source, [
        roomEntry.room,
        ...state.rooms.filter((room) => room.id !== roomEntry.room.id),
      ]),
      apiSource: result.source,
      currentRoom: roomEntry.room,
      roomPlayers: roomEntry.players,
      currentSegment: null,
      mergedMap: null,
      racePositions: {},
      phaseRemainingMs: null,
      currentTimeVote: null,
      isRaceOvertime: false,
      view: 'room',
    }))
    joinRealtimeRoom(result.data.id, session.id, session.nickname, true)
  },

  enterRoom: async (room, password) => {
    const { session } = get()
    if (session === null) {
      return false
    }

    const result = await joinRoomRequest(room.id, { userId: session.id, password })

    if (result === null) {
      return false
    }

    const rooms = get().rooms
    const roomEntry = buildInitialRoomEntry(session, result.data, result.source)
    const nextRooms = rooms.some((storedRoom) => storedRoom.id === roomEntry.room.id)
      ? rooms.map((storedRoom) =>
          storedRoom.id === roomEntry.room.id ? roomEntry.room : storedRoom,
        )
      : [roomEntry.room, ...rooms]

    set({
      rooms: persistMockRoomsIfNeeded(result.source, nextRooms),
      apiSource: result.source,
      currentRoom: roomEntry.room,
      roomPlayers: roomEntry.players,
      currentSegment: null,
      mergedMap: null,
      racePositions: {},
      phaseRemainingMs: null,
      currentTimeVote: null,
      isRaceOvertime: false,
      view: 'room',
    })
    joinRealtimeRoom(
      result.data.id,
      session.id,
      session.nickname,
      isSessionRoomHost(session, roomEntry.room),
    )
    return true
  },

  enterPublicRoom: async () => {
    const { session } = get()
    if (session === null) {
      return false
    }

    const result = await joinPublicRoom(session.id)

    if (result === null) {
      return false
    }

    const rooms = get().rooms
    const roomEntry = buildInitialRoomEntry(session, result.data, result.source)
    const nextRooms = rooms.some((room) => room.id === roomEntry.room.id)
      ? rooms.map((room) => (room.id === roomEntry.room.id ? roomEntry.room : room))
      : [roomEntry.room, ...rooms]

    set({
      rooms: persistMockRoomsIfNeeded(result.source, nextRooms),
      apiSource: result.source,
      currentRoom: roomEntry.room,
      roomPlayers: roomEntry.players,
      currentSegment: null,
      mergedMap: null,
      racePositions: {},
      phaseRemainingMs: null,
      currentTimeVote: null,
      isRaceOvertime: false,
      view: 'room',
    })
    joinRealtimeRoom(
      result.data.id,
      session.id,
      session.nickname,
      isSessionRoomHost(session, roomEntry.room),
    )
    return true
  },

  leaveRoom: () => {
    const { apiSource, currentRoom, rooms, session } = get()

    if (currentRoom !== null && session !== null) {
      leaveRealtimeRoom(currentRoom.id, session.id)
    }

    const roomsAfterLeave =
      apiSource === 'mock' && currentRoom !== null
        ? getMockRoomsAfterLeave(rooms, currentRoom, session)
        : rooms

    set((state) => {
      const rooms =
        apiSource === 'mock'
          ? persistMockRoomsIfNeeded(apiSource, roomsAfterLeave)
          : state.rooms

      return {
        rooms,
        currentRoom: null,
        roomPlayers: [],
        currentSegment: null,
        mergedMap: null,
        racePositions: {},
        phaseRemainingMs: null,
        currentTimeVote: null,
        isRaceOvertime: false,
        view: 'lobby',
      }
    })
  },

  toggleLobbyReady: () => {
    const { currentRoom, session } = get()

    if (currentRoom?.phase !== 'lobby' || session === null) {
      return
    }

    const currentPlayer = get().roomPlayers.find((player) => player.id === session.id)
    const nextIsReady = !(currentPlayer?.isReady ?? false)

    set((state) => ({
      roomPlayers: state.roomPlayers.map((player) =>
        player.id === session.id && !player.isHost
          ? { ...player, isReady: nextIsReady }
          : player,
      ),
    }))
    notifyRealtimeLobbyReady(currentRoom.id, session.id, nextIsReady)
  },

  advanceRoomPhase: () => {
    set((state) => {
      if (state.currentRoom === null) {
        return state
      }

      const nextPhase = getNextPhase(state.currentRoom.phase)
      const nextRoom = { ...state.currentRoom, phase: nextPhase, elapsedSeconds: 0 }
      const nextRooms = state.rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))

      if (state.session !== null) {
        startRealtimeRoom(state.currentRoom.id, state.session.id)
        readyRealtimePhase(state.currentRoom.id, state.session.id, nextPhase)

        if (nextPhase === 'finished') {
          notifyRealtimeResultsFinal(
            state.currentRoom.id,
            state.roomPlayers.map(toRealtimeRoomPlayer),
          )
        }
      }

      return {
        currentRoom: nextRoom,
        currentSegment: nextPhase === 'building' ? null : state.currentSegment,
        mergedMap: nextPhase === 'building' ? null : state.mergedMap,
        racePositions: nextPhase === 'racing' ? {} : state.racePositions,
        phaseRemainingMs: null,
        currentTimeVote: null,
        isRaceOvertime: false,
        rooms: persistMockRoomsIfNeeded(state.apiSource, nextRooms),
        roomPlayers: resetRoomPlayersForPhase(nextPhase, state.roomPlayers),
      }
    })
  },

  requestTimeVote: (deltaSeconds) => {
    const { currentRoom, session } = get()

    if (currentRoom === null || session === null) {
      return
    }

    requestRealtimeTimeVote(currentRoom.id, session.id, currentRoom.phase, deltaSeconds)
    set((state) => ({
      currentTimeVote: mergeTimeVoteState(state.currentTimeVote, {
        phase: currentRoom.phase,
        deltaSeconds,
        voterIds: [session.id],
        approved: false,
        applied: false,
      }),
    }))
  },

  submitMapSegment: async (payload) => {
    const { currentRoom, session } = get()
    if (currentRoom === null || session === null) {
      return false
    }

    const result = await saveMapSegment(currentRoom.id, { ...payload, userId: session.id })
    set((state) => {
      const mockPeerSegments =
        result.source === 'mock'
          ? buildMockPeerSegments(currentRoom.id, session.id, state.roomPlayers, state.assets)
          : []
      const mockPeerCreatorIds = new Set(mockPeerSegments.map((segment) => segment.creatorId))
      const mockPeerSegmentIds = new Set(mockPeerSegments.map((segment) => segment.id))

      return {
        apiSource: result.source,
        currentSegment: result.data,
        mapSegments: [
          result.data,
          ...mockPeerSegments,
          ...state.mapSegments.filter(
            (segment) => segment.id !== result.data.id && !mockPeerSegmentIds.has(segment.id),
          ),
        ],
        roomPlayers: state.roomPlayers.map((player) =>
          player.id === session.id || mockPeerCreatorIds.has(player.id)
            ? { ...player, isReady: true }
            : player,
        ),
      }
    })
    notifyRealtimeMapSegmentSnapshot(result.data)
    notifyRealtimeSegmentSubmitted(currentRoom.id, session.id, result.data.id)
    return true
  },

  mergeCurrentRoomMap: async () => {
    const { assets, currentRoom, mapSegments, session } = get()

    if (currentRoom === null) {
      return null
    }

    const apiMergedMap = await mergeRoomMap(currentRoom.id)

    if (apiMergedMap !== null) {
      set({ apiSource: apiMergedMap.source, mergedMap: apiMergedMap.data })
      notifyRealtimeMapMerged(apiMergedMap.data)
      return apiMergedMap.data
    }

    const validatedSegments = mapSegments.filter(
      (segment) => segment.roomId === currentRoom.id && segment.isValidated,
    )
    const usedFallback = validatedSegments.length === 0
    const segments = usedFallback
      ? [buildFallbackSegment(currentRoom.id, session?.id ?? 'fallback-user', assets)]
      : shuffleSegments(currentRoom.id, validatedSegments)
    const mergedMap = buildMergedMap(currentRoom.id, segments, assets, usedFallback)

    set({ mergedMap })
    notifyRealtimeMapMerged(mergedMap)
    return mergedMap
  },

  validateCurrentSegment: async (cleared, clearTimeMs) => {
    const { currentRoom, currentSegment, session } = get()
    if (currentRoom === null || currentSegment === null || session === null) {
      return false
    }

    const result = await validateMapSegment(currentRoom.id, currentSegment, {
      userId: session.id,
      segmentHash: currentSegment.segmentHash,
      cleared,
      clearTimeMs,
    })

    set((state) => {
      const mockPeerSegments =
        result.source === 'mock'
          ? buildValidatedMockPeerSegments({
              roomId: currentRoom.id,
              currentUserId: session.id,
              players: state.roomPlayers,
              assets: state.assets,
              existingSegments: state.mapSegments,
              clearTimeMs,
            })
          : []
      const mockPeerCreatorIds = new Set(mockPeerSegments.map((segment) => segment.creatorId))
      const hasResultSegment = state.mapSegments.some((segment) => segment.id === result.data.id)
      const updatedSegments = state.mapSegments.map((segment) => {
        if (segment.id === result.data.id) {
          return result.data
        }

        return mockPeerSegments.find((mockSegment) => mockSegment.id === segment.id) ?? segment
      })
      const nextMapSegments = [
        ...(hasResultSegment ? [] : [result.data]),
        ...mockPeerSegments.filter(
          (mockSegment) => !state.mapSegments.some((segment) => segment.id === mockSegment.id),
        ),
        ...updatedSegments,
      ]

      return {
        apiSource: result.source,
        currentSegment: result.data,
        mapSegments: nextMapSegments,
        roomPlayers: state.roomPlayers.map((player) =>
          player.id === session.id
            ? { ...player, validationCleared: cleared, isReady: true }
            : mockPeerCreatorIds.has(player.id)
              ? { ...player, validationCleared: true, isReady: true }
              : player,
        ),
      }
    })
    notifyRealtimeValidationCompleted({
      roomId: currentRoom.id,
      userId: session.id,
      cleared,
      segmentHash: currentSegment.segmentHash,
      clearTimeMs,
    })
    return true
  },

  markValidationCleared: () => {
    const { session } = get()
    if (session === null) {
      return
    }

    set((state) => ({
      roomPlayers: state.roomPlayers.map((player) =>
        player.id === session.id ? { ...player, validationCleared: true, isReady: true } : player,
      ),
    }))
  },

  updateRaceProgress: (progressById) => {
    set((state) => ({
      roomPlayers: state.roomPlayers.map((player) => {
        const nextProgress = progressById[player.id]

        if (nextProgress === undefined) {
          return player
        }

        return {
          ...player,
          raceProgress: Math.max(player.raceProgress, Math.min(100, nextProgress)),
          raceDistanceToGoal: Math.max(0, 100 - Math.max(player.raceProgress, Math.min(100, nextProgress))),
        }
      }),
    }))
  },

  recordRaceFinish: (playerId, finishTimeMs) => {
    const { currentRoom, session } = get()

    if (currentRoom !== null && session?.id === playerId) {
      notifyRealtimeRaceFinish(currentRoom.id, session.id, finishTimeMs)
    }

    set((state) => ({
      roomPlayers: state.roomPlayers.map((player) => {
        if (player.id !== playerId) {
          return player
        }

        return {
          ...player,
          raceProgress: 100,
          raceDistanceToGoal: 0,
          raceFinishedAtMs:
            player.raceFinishedAtMs === null
              ? finishTimeMs
              : Math.min(player.raceFinishedAtMs, finishTimeMs),
        }
      }),
    }))
  },

  broadcastRacePosition: (position) => {
    const { currentRoom, session } = get()

    if (currentRoom === null || session === null) {
      return
    }

    set((state) => ({
      racePositions: {
        ...state.racePositions,
        [session.id]: { ...position, userId: session.id },
      },
    }))
    sendRealtimeRacePosition({
      roomId: currentRoom.id,
      userId: session.id,
      ...position,
    })
  },

  tickMockGeneration: () => {
    const { assets, apiSource } = get()

    if (apiSource !== 'mock') {
      const now = Date.now()
      const hasPendingAsset = assets.some(
        (asset) => asset.status === 'queued' || asset.status === 'generating',
      )

      if (hasPendingAsset && now - lastApiAssetPollAt >= API_ASSET_POLL_INTERVAL_MS) {
        lastApiAssetPollAt = now
        void get().refreshAssets()
      }

      return
    }

    const now = Date.now()
    let hasChanged = false
    const nextAssets = assets.map((asset) => {
      if (asset.isSystem || asset.status === 'ready' || asset.status === 'failed') {
        return asset
      }

      const sprites = asset.sprites.map((sprite, index) => {
        if (sprite.status === 'ready' || sprite.status === 'failed') {
          return sprite
        }

        const startedAt = new Date(sprite.lastRegenAt ?? asset.createdAt).getTime()
        const elapsedMs = now - startedAt - index * 900

        if (elapsedMs >= MOCK_SPRITE_READY_MS) {
          hasChanged = true
          return {
            ...sprite,
            status: 'ready' as const,
            sheetUrl: asset.sourceImageUrl || null,
            frameCount: sprite.action === 'static' ? 1 : 8,
          }
        }

        if (elapsedMs >= MOCK_SPRITE_GENERATING_MS && sprite.status === 'queued') {
          hasChanged = true
          return { ...sprite, status: 'generating' as const }
        }

        return sprite
      })

      const nextStatus = sprites.every((sprite) => sprite.status === 'ready')
        ? ('ready' as const)
        : ('generating' as const)

      if (nextStatus !== asset.status) {
        hasChanged = true
      }

      return { ...asset, status: nextStatus, sprites }
    })

    if (!hasChanged) {
      return
    }

    saveMockAssets(nextAssets)
    set({ assets: nextAssets })
  },

  tickRoomElapsed: () => {
    set((state) => {
      const currentRoomId = state.currentRoom?.id ?? null
      let didUpdateRooms = false
      const rooms = state.rooms.map((room) => {
        if (!shouldCountRoomElapsed(room.phase)) {
          return room
        }

        didUpdateRooms = true
        return { ...room, elapsedSeconds: room.elapsedSeconds + 1 }
      })
      const currentRoom =
        state.currentRoom !== null && shouldCountRoomElapsed(state.currentRoom.phase)
          ? rooms.find((room) => room.id === currentRoomId) ?? {
              ...state.currentRoom,
              elapsedSeconds: state.currentRoom.elapsedSeconds + 1,
            }
          : state.currentRoom

      if (!didUpdateRooms && currentRoom === state.currentRoom) {
        return {}
      }

      return { rooms, currentRoom }
    })
  },

  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  updateSettings: (settings) => {
    const nextSettings = { ...get().settings, ...settings }
    writeSettings(nextSettings)
    set({ settings: nextSettings })
  },

  updateNickname: (nickname) => {
    const { session } = get()
    if (session === null) {
      return
    }

    const updatedSession = { ...session, nickname }
    saveStoredSession(updatedSession)
    set((state) => {
      const localPlayer = state.roomPlayers.find((player) => player.id === session.id)
      const isCurrentRoomHost =
        localPlayer?.isHost === true ||
        (state.currentRoom !== null && isSessionRoomHost(session, state.currentRoom))

      const nextRooms = state.rooms.map((room) =>
        shouldUpdateRoomHostNickname(room, session)
          ? { ...room, hostNickname: nickname, hostId: room.hostId ?? session.id }
          : room,
      )

      return {
        session: updatedSession,
        currentRoom:
          state.currentRoom !== null && isCurrentRoomHost
            ? { ...state.currentRoom, hostNickname: nickname, hostId: state.currentRoom.hostId ?? session.id }
            : state.currentRoom,
        rooms: persistMockRoomsIfNeeded(state.apiSource, nextRooms),
        roomPlayers: state.roomPlayers.map((player) =>
          player.id === session.id ? { ...player, nickname } : player,
        ),
      }
    })

    const { currentRoom, roomPlayers } = get()
    const localPlayer = roomPlayers.find((player) => player.id === updatedSession.id)

    if (currentRoom !== null) {
      notifyRealtimeLobbyPresence(
        currentRoom.id,
        updatedSession.id,
        updatedSession.nickname,
        localPlayer?.isHost === true || isSessionRoomHost(updatedSession, currentRoom),
      )
    }
  },

  issueDeviceLinkCode: async () => {
    const { session } = get()
    if (session === null) {
      return null
    }

    const result = await createDeviceLinkCode(session)
    set({ apiSource: result.source })
    return result.data
  },

  loadSessionByDeviceCode: async (code) => {
    const result = await consumeDeviceLinkCode(code)

    if (result === null) {
      return false
    }

    set({
      session: result.data,
      apiSource: result.source,
      currentRoom: null,
      roomPlayers: [],
      currentSegment: null,
      mergedMap: null,
      racePositions: {},
      phaseRemainingMs: null,
      currentTimeVote: null,
      isRaceOvertime: false,
      view: 'main',
    })
    connectStoreRealtime(result.data, set, get)
    await Promise.all([get().refreshAssets(), get().refreshRooms()])
    return true
  },
}))

function buildInitialRoomEntry(
  session: UserSession,
  room: RoomSummary,
  source: 'api' | 'mock',
) {
  const normalizedRoom =
    source === 'mock' && isSessionRoomHost(session, room)
      ? { ...room, hostId: room.hostId ?? session.id, hostNickname: session.nickname }
      : room
  const playerCount =
    source === 'mock'
      ? normalizedRoom.maxPlayers
      : Math.min(normalizedRoom.maxPlayers, Math.max(1, normalizedRoom.players))
  const players = buildMockPlayers(session, normalizedRoom, playerCount)

  return {
    room: normalizedRoom,
    players,
  }
}

function persistMockRoomsIfNeeded(
  source: 'api' | 'mock',
  rooms: RoomSummary[],
  shouldBroadcast = true,
) {
  if (source === 'mock') {
    saveMockRooms(rooms)

    if (shouldBroadcast) {
      notifyRealtimeRoomsChanged(rooms)
    }
  }

  return rooms
}

function getMockRoomsAfterLeave(
  rooms: RoomSummary[],
  currentRoom: RoomSummary,
  session: UserSession | null,
) {
  return rooms.flatMap((room) => {
    if (room.id !== currentRoom.id) {
      return [room]
    }

    if (session !== null && isSessionRoomHost(session, room)) {
      return []
    }

    const minimumPlayers = room.hostId === null ? 1 : 0
    const nextPlayers = Math.max(minimumPlayers, room.players - 1)

    if (room.hostId !== null && nextPlayers === 0) {
      return []
    }

    return [{ ...room, players: nextPlayers }]
  })
}

function normalizeMockRoomsForSession(
  source: 'api' | 'mock',
  rooms: RoomSummary[],
  session: UserSession | null,
  shouldBroadcast = true,
) {
  if (source !== 'mock' || session === null) {
    return rooms
  }

  const normalizedRooms = rooms.map((room) =>
    isSessionRoomHost(session, room)
      ? { ...room, hostId: room.hostId ?? session.id, hostNickname: session.nickname }
      : room,
  )

  return persistMockRoomsIfNeeded(source, normalizedRooms, shouldBroadcast)
}

function mergeAssetsWithLocalWorkingCopies(apiAssets: Asset[], currentAssets: Asset[]) {
  const apiAssetIds = new Set(apiAssets.map((asset) => asset.id))
  const apiGenerationJobIds = new Set(
    apiAssets.map(getAssetGenerationJobId).filter((jobId): jobId is string => jobId !== null),
  )
  const localWorkingAssets = currentAssets.filter((asset) => {
    if (!isWorkingAsset(asset)) {
      return false
    }

    const generationJobId = getAssetGenerationJobId(asset)

    return !apiAssetIds.has(asset.id) && (generationJobId === null || !apiGenerationJobIds.has(generationJobId))
  })

  return [...localWorkingAssets, ...apiAssets]
}

function getAssetGenerationJobId(asset: Asset) {
  const generationJobId = asset.attrs.generationJobId

  return typeof generationJobId === 'string' && generationJobId.length > 0 ? generationJobId : null
}

function isWorkingAsset(asset: Asset) {
  return asset.status === 'queued' || asset.status === 'generating'
}

function mergeTimeVoteState(
  currentVote: TimeVoteState | null,
  nextVote: TimeVoteState,
): TimeVoteState {
  if (
    currentVote === null ||
    currentVote.phase !== nextVote.phase ||
    currentVote.deltaSeconds !== nextVote.deltaSeconds
  ) {
    return nextVote
  }

  return {
    ...nextVote,
    voterIds: [...new Set([...currentVote.voterIds, ...nextVote.voterIds])],
    approved: currentVote.approved || nextVote.approved,
    applied: currentVote.applied || nextVote.applied,
  }
}

function buildMockPlayers(
  session: UserSession,
  room: RoomSummary,
  targetCount: number,
): RoomPlayer[] {
  const mockNames = ['maker01', 'builder', 'runner']
  const playerCount = Math.min(4, Math.max(1, targetCount))
  const realPlayerSlots = Math.min(playerCount, Math.max(1, room.players))
  const isCurrentUserHost = isSessionRoomHost(session, room)
  const hostPlayer = buildRoomPlayer({
    id: isCurrentUserHost ? session.id : room.hostId ?? `mock-host-${room.id}`,
    nickname: isCurrentUserHost ? session.nickname : room.hostNickname,
    isHost: true,
  })
  const buildSlotPlayer = (slot: number) => {
    const helperName = mockNames[(slot - 1) % mockNames.length] ?? `helper-${slot}`

    if (isCurrentUserHost) {
      if (slot < realPlayerSlots) {
        return buildRoomPlayer({
          id: `mock-joined-player-${slot}`,
          nickname: `플레이어 ${slot + 1}`,
          isHost: false,
          isReady: false,
        })
      }

      return buildRoomPlayer({
        id: `mock-player-${slot}`,
        nickname: helperName,
        isHost: false,
      })
    }

    if (slot === Math.max(1, realPlayerSlots - 1)) {
      return buildRoomPlayer({
        id: session.id,
        nickname: session.nickname,
        isHost: false,
        isReady: false,
      })
    }

    if (slot < realPlayerSlots) {
      return buildRoomPlayer({
        id: `mock-joined-player-${slot}`,
        nickname: `플레이어 ${slot + 1}`,
        isHost: false,
        isReady: false,
      })
    }

    return buildRoomPlayer({
      id: `mock-player-${slot}`,
      nickname: helperName,
      isHost: false,
    })
  }

  return [hostPlayer, ...Array.from({ length: playerCount - 1 }, (_, index) => buildSlotPlayer(index + 1))]
}

function buildRoomPlayer({
  id,
  nickname,
  isHost,
  isReady = true,
}: {
  id: string
  nickname: string
  isHost: boolean
  isReady?: boolean
}): RoomPlayer {
  return {
    id,
    nickname,
    isHost,
    isReady,
    validationCleared: !isHost,
    raceProgress: 0,
    raceFinishedAtMs: null,
    raceDistanceToGoal: 100,
  }
}

function mergeLobbyPlayer(
  players: RoomPlayer[],
  player: { id: string; nickname: string; isHost: boolean; isReady: boolean },
) {
  if (players.some((roomPlayer) => roomPlayer.id === player.id)) {
    return players.map((roomPlayer) =>
      roomPlayer.id === player.id
        ? {
            ...roomPlayer,
            nickname: player.nickname,
            isHost: roomPlayer.isHost || player.isHost,
            isReady: roomPlayer.isReady || player.isReady,
          }
        : roomPlayer,
    )
  }

  if (player.isHost) {
    const hostReplacementIndex = players.findIndex(
      (roomPlayer) => roomPlayer.isHost && roomPlayer.id.startsWith('mock-host-'),
    )
    const nextHostPlayer = buildRoomPlayer({ ...player, isReady: true })

    if (hostReplacementIndex >= 0) {
      return players.map((roomPlayer, index) =>
        index === hostReplacementIndex ? nextHostPlayer : roomPlayer,
      )
    }
  }

  const replacementIndex = players.findIndex(
    (roomPlayer) =>
      !roomPlayer.isHost &&
      (roomPlayer.id.startsWith('mock-joined-player-') ||
        roomPlayer.id.startsWith('mock-player-')),
  )
  const nextPlayer = buildRoomPlayer(player)

  if (replacementIndex >= 0) {
    return players.map((roomPlayer, index) => (index === replacementIndex ? nextPlayer : roomPlayer))
  }

  return [...players, nextPlayer].slice(0, 4)
}

function upsertMapSegment(segments: MapSegmentSnapshot[], segment: MapSegmentSnapshot) {
  const segmentIndex = segments.findIndex(
    (currentSegment) =>
      currentSegment.id === segment.id ||
      (currentSegment.roomId === segment.roomId && currentSegment.creatorId === segment.creatorId) ||
      (currentSegment.roomId === segment.roomId &&
        currentSegment.creatorId === segment.creatorId &&
        currentSegment.segmentHash === segment.segmentHash),
  )

  if (segmentIndex < 0) {
    return [segment, ...segments]
  }

  return segments.map((currentSegment, index) => (index === segmentIndex ? segment : currentSegment))
}

function isValidationResultForSegment(
  segment: MapSegmentSnapshot,
  payload: { roomId?: string; userId: string; segmentHash?: string },
) {
  if (payload.roomId !== undefined && segment.roomId !== payload.roomId) {
    return false
  }

  if (segment.creatorId !== payload.userId) {
    return false
  }

  return payload.segmentHash === undefined || segment.segmentHash === payload.segmentHash
}

function connectStoreRealtime(
  session: UserSession,
  set: StoreApi<AppState>['setState'],
  get: StoreApi<AppState>['getState'],
) {
  connectRealtime(session.id, {
    onStatusChange: (status) => {
      set({ realtimeStatus: status })

      if (status === 'connected') {
        const { currentRoom } = get()

        if (currentRoom !== null) {
          joinRealtimeRoom(
            currentRoom.id,
            session.id,
            session.nickname,
            isSessionRoomHost(session, currentRoom),
          )
        }
      }
    },
    onRoomJoined: (snapshot) => applyRealtimeRoomSnapshot(snapshot, set, get),
    onRoomState: (snapshot) => applyRealtimeRoomSnapshot(snapshot, set, get),
    onPhaseChanged: (payload) => {
      set((state) => {
        if (state.currentRoom?.id !== payload.roomId) {
          return {}
        }

        const nextRoom = { ...state.currentRoom, phase: payload.phase, elapsedSeconds: 0 }
        const nextRooms = state.rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))
        const phaseRemainingMs =
          payload.phaseEndsAt === null
            ? null
            : Math.max(0, new Date(payload.phaseEndsAt).getTime() - Date.now())

        return {
          currentRoom: nextRoom,
          rooms: persistMockRoomsIfNeeded(state.apiSource, nextRooms),
          currentSegment: payload.phase === 'building' ? null : state.currentSegment,
          mergedMap: payload.phase === 'building' ? null : state.mergedMap,
          racePositions: payload.phase === 'racing' ? {} : state.racePositions,
          phaseRemainingMs,
          currentTimeVote: null,
          isRaceOvertime:
            payload.phase === 'racing'
              ? payload.isOvertime === true
              : false,
          roomPlayers: resetRoomPlayersForPhase(payload.phase, state.roomPlayers),
        }
      })
    },
    onTimerTick: (payload) => {
      set((state) => {
        if (state.currentRoom?.id !== payload.roomId) {
          return {}
        }

        return {
          phaseRemainingMs: payload.remainingMs,
        }
      })
    },
    onTimeVoteUpdated: (payload) => {
      set((state) => {
        if (state.currentRoom?.id !== payload.roomId) {
          return {}
        }

        const phaseRemainingMs =
          payload.remainingMs ??
          (payload.phaseEndsAt === null || payload.phaseEndsAt === undefined
            ? state.phaseRemainingMs
            : Math.max(0, new Date(payload.phaseEndsAt).getTime() - Date.now()))

        return {
          phaseRemainingMs,
          currentTimeVote: mergeTimeVoteState(state.currentTimeVote, {
            phase: payload.phase,
            deltaSeconds: payload.deltaSec,
            voterIds: payload.voterIds,
            approved: payload.approved,
            applied: payload.applied,
          }),
        }
      })
    },
    onSegmentSubmitted: (payload) => {
      set((state) => {
        if (
          state.currentRoom !== null &&
          payload.roomId !== undefined &&
          state.currentRoom.id !== payload.roomId
        ) {
          return {}
        }

        return {
          roomPlayers: state.roomPlayers.map((player) =>
            player.id === payload.userId ? { ...player, isReady: true } : player,
          ),
        }
      })
    },
    onMapSegmentSnapshot: (segment) => {
      set((state) => {
        if (
          state.currentRoom?.id !== segment.roomId ||
          state.session?.id === segment.creatorId
        ) {
          return {}
        }

        return {
          mapSegments: upsertMapSegment(state.mapSegments, segment),
          roomPlayers: state.roomPlayers.map((player) =>
            player.id === segment.creatorId ? { ...player, isReady: true } : player,
          ),
        }
      })
    },
    onValidationResult: (payload) => {
      set((state) => ({
        mapSegments: state.mapSegments.map((segment) =>
          isValidationResultForSegment(segment, payload)
            ? {
                ...segment,
                isValidated: payload.cleared,
                clearTimeMs: payload.clearTimeMs ?? segment.clearTimeMs,
                validatedAt: new Date().toISOString(),
              }
            : segment,
        ),
        roomPlayers: state.roomPlayers.map((player) =>
          player.id === payload.userId
            ? { ...player, validationCleared: payload.cleared, isReady: true }
            : player,
        ),
      }))
    },
    onMapMerged: (mergedMap) => {
      set((state) => {
        if (state.currentRoom !== null && mergedMap.roomId !== '' && state.currentRoom.id !== mergedMap.roomId) {
          return {}
        }

        return { mergedMap }
      })
    },
    onRacePosition: (payload) => {
      const currentRoom = get().currentRoom

      if (payload.roomId !== undefined && currentRoom?.id !== payload.roomId) {
        return
      }

      const existingProgress =
        get().roomPlayers.find((player) => player.id === payload.userId)?.raceProgress ?? 0
      const nextProgress = Math.max(0, Math.min(100, payload.progress ?? existingProgress))

      if (payload.x !== undefined && payload.y !== undefined) {
        const nextPosition: RacePositionSnapshot = {
          userId: payload.userId,
          x: payload.x,
          y: payload.y,
          vx: payload.vx ?? 0,
          vy: payload.vy ?? 0,
          state: payload.state ?? 'running',
          progress: nextProgress,
          clientTime: payload.clientTime ?? Date.now(),
        }

        set((state) => ({
          racePositions: {
            ...state.racePositions,
            [payload.userId]: nextPosition,
          },
        }))
      }

      if (payload.progress === null || payload.progress === undefined) {
        return
      }

      get().updateRaceProgress({ [payload.userId]: nextProgress })
    },
    onRaceFinished: (payload) => {
      applyRaceFinish(payload.userId, payload.finishTimeMs, set)
    },
    onResultsFinal: (payload) => {
      set((state) => {
        if (state.currentRoom?.id !== payload.roomId) {
          return {}
        }

        const nextRoom = { ...state.currentRoom, phase: 'finished' as const, elapsedSeconds: 0 }
        const nextRooms = state.rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))
        const resultPlayers =
          payload.players.length > 0
            ? payload.players.map((player) => {
                const existingPlayer = state.roomPlayers.find((roomPlayer) => roomPlayer.id === player.userId)

                return toRoomPlayerFromRealtime(player, 'finished', existingPlayer)
              })
            : state.roomPlayers

        return {
          currentRoom: nextRoom,
          rooms: persistMockRoomsIfNeeded(state.apiSource, nextRooms),
          roomPlayers: resultPlayers,
        }
      })
    },
    onAssetJobUpdated: () => {
      void get().refreshAssets()
    },
    onRoomsChanged: (payload) => {
      set((state) => {
        if (state.apiSource !== 'mock') {
          return {}
        }

        const rooms = normalizeMockRoomsForSession('mock', payload.rooms, state.session, false)
        const currentRoom =
          state.currentRoom === null
            ? null
            : rooms.find((room) => room.id === state.currentRoom?.id) ?? state.currentRoom

        return { rooms, currentRoom }
      })
    },
    onLobbyPlayerJoined: (payload) => {
      const stateBeforeUpdate = get()
      const localPlayer = stateBeforeUpdate.roomPlayers.find(
        (player) => player.id === stateBeforeUpdate.session?.id,
      )

      if (
        stateBeforeUpdate.currentRoom?.id === payload.roomId &&
        stateBeforeUpdate.session !== null &&
        stateBeforeUpdate.session.id !== payload.userId &&
        localPlayer !== undefined
      ) {
        notifyRealtimeLobbyPresence(
          payload.roomId,
          stateBeforeUpdate.session.id,
          stateBeforeUpdate.session.nickname,
          localPlayer.isHost,
        )
      }

      set((state) => {
        if (state.currentRoom?.id !== payload.roomId || state.session?.id === payload.userId) {
          return {}
        }

        return {
          roomPlayers: mergeLobbyPlayer(state.roomPlayers, {
            id: payload.userId,
            nickname: payload.nickname,
            isHost: payload.isHost,
            isReady: false,
          }),
        }
      })
    },
    onLobbyReadyChanged: (payload) => {
      set((state) => {
        if (state.currentRoom?.id !== payload.roomId || state.session?.id === payload.userId) {
          return {}
        }

        return {
          roomPlayers: state.roomPlayers.map((player) =>
            player.id === payload.userId ? { ...player, isReady: payload.isReady } : player,
          ),
        }
      })
    },
    onLobbyPlayerLeft: (payload) => {
      set((state) => {
        if (state.currentRoom?.id !== payload.roomId || state.session?.id === payload.userId) {
          return {}
        }

        return {
          roomPlayers: state.roomPlayers.filter((player) => player.id !== payload.userId),
        }
      })
    },
  })

  set({ realtimeStatus: getRealtimeStatus() })
}

function isSessionRoomHost(session: UserSession, room: RoomSummary) {
  if (room.hostId !== null) {
    return room.hostId === session.id
  }

  return false
}

function markSessionAsRoomHost(room: RoomSummary, session: UserSession): RoomSummary {
  return {
    ...room,
    hostId: room.hostId ?? session.id,
    hostNickname: room.hostNickname === 'me' ? session.nickname : room.hostNickname,
  }
}

function shouldUpdateRoomHostNickname(
  room: RoomSummary,
  session: UserSession,
) {
  if (room.hostId !== null) {
    return room.hostId === session.id
  }

  return false
}

function applyRealtimeRoomSnapshot(
  snapshot: RealtimeRoomSnapshot,
  set: StoreApi<AppState>['setState'],
  get: StoreApi<AppState>['getState'],
) {
  const { currentRoom } = get()

  if (currentRoom === null || currentRoom.id !== snapshot.roomId) {
    return
  }

  const submittedSegmentIds = snapshot.submittedSegmentIds ?? {}
  const currentPlayers = get().roomPlayers
  const nextRoomPlayers =
    snapshot.players.length > 0
      ? snapshot.players.map((player) => {
          const existingPlayer = currentPlayers.find((roomPlayer) => roomPlayer.id === player.userId)
          const roomPlayer = toRoomPlayerFromRealtime(player, snapshot.phase, existingPlayer)

          if (snapshot.phase !== 'building') {
            return roomPlayer
          }

          return {
            ...roomPlayer,
            isReady: submittedSegmentIds[roomPlayer.id] !== undefined,
            validationCleared: false,
          }
        })
      : get().roomPlayers.map((player) =>
          snapshot.phase === 'building'
            ? {
                ...player,
                isReady: submittedSegmentIds[player.id] !== undefined,
                validationCleared: false,
              }
            : player,
        )

  set((state) => {
    if (state.currentRoom?.id !== snapshot.roomId) {
      return {}
    }

    const nextRoom = {
      ...state.currentRoom,
      phase: snapshot.phase,
      players: Math.max(snapshot.players.length, state.currentRoom.players),
    }
    const nextRooms = state.rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))

    return {
      currentRoom: nextRoom,
      rooms: persistMockRoomsIfNeeded(state.apiSource, nextRooms),
      currentSegment: snapshot.phase === 'building' ? null : state.currentSegment,
      mergedMap: snapshot.phase === 'building' ? null : state.mergedMap,
      racePositions: snapshot.phase === 'racing' ? {} : state.racePositions,
      roomPlayers: nextRoomPlayers,
      isRaceOvertime: snapshot.phase === 'racing' && snapshot.hasOvertime === true,
    }
  })
}

function toRoomPlayerFromRealtime(
  player: RealtimeRoomSnapshot['players'][number],
  phase: RoomSummary['phase'],
  existingPlayer?: RoomPlayer,
): RoomPlayer {
  const raceProgress = Math.min(100, Math.max(0, player.raceProgress))

  return {
    id: player.userId,
    nickname: player.nickname,
    isHost: player.isHost,
    isReady: getRealtimePlayerReadyState(player, phase, existingPlayer),
    validationCleared: player.validationCleared,
    raceProgress,
    raceFinishedAtMs: player.raceFinishedAtMs,
    raceDistanceToGoal: Math.max(0, player.raceDistanceToGoal ?? 100 - raceProgress),
  }
}

function getRealtimePlayerReadyState(
  player: RealtimeRoomSnapshot['players'][number],
  phase: RoomSummary['phase'],
  existingPlayer?: RoomPlayer,
) {
  if (phase === 'lobby') {
    return player.isHost || existingPlayer?.isReady === true
  }

  if (phase === 'validating') {
    return player.validationCleared || existingPlayer?.isReady === true
  }

  if (phase === 'building') {
    return existingPlayer?.isReady === true
  }

  return true
}

function toRealtimeRoomPlayer(player: RoomPlayer): RealtimeRoomSnapshot['players'][number] {
  return {
    userId: player.id,
    nickname: player.nickname,
    isHost: player.isHost,
    validationCleared: player.validationCleared,
    raceProgress: player.raceProgress,
    raceFinishedAtMs: player.raceFinishedAtMs,
    raceDistanceToGoal: player.raceDistanceToGoal,
  }
}

function resetRoomPlayersForPhase(
  phase: RoomSummary['phase'],
  players: RoomPlayer[],
): RoomPlayer[] {
  if (phase === 'building') {
    return players.map((player) => ({
      ...player,
      isReady: false,
      validationCleared: false,
      raceProgress: 0,
      raceFinishedAtMs: null,
      raceDistanceToGoal: 100,
    }))
  }

  if (phase === 'racing') {
    return players.map((player) => ({
      ...player,
      raceProgress: 0,
      raceFinishedAtMs: null,
      raceDistanceToGoal: 100,
    }))
  }

  if (phase === 'validating') {
    return players.map((player) => ({
      ...player,
      isReady: false,
    }))
  }

  return players
}

function applyRaceFinish(
  playerId: string,
  finishTimeMs: number,
  set: StoreApi<AppState>['setState'],
) {
  set((state) => ({
    roomPlayers: state.roomPlayers.map((player) => {
      if (player.id !== playerId) {
        return player
      }

      return {
        ...player,
        raceProgress: 100,
        raceDistanceToGoal: 0,
        raceFinishedAtMs:
          player.raceFinishedAtMs === null
            ? finishTimeMs
            : Math.min(player.raceFinishedAtMs, finishTimeMs),
      }
    }),
  }))
}

function buildFallbackSegment(roomId: string, creatorId: string, assets: Asset[]): MapSegmentSnapshot {
  const groundAsset = findGroundAsset(assets)
  const startPoint: MapPoint = { x: 0, y: 8 }
  const endPoint: MapPoint = { x: 16, y: 8 }
  const assetRefs: MapSegmentAssetSnapshot[] =
    groundAsset === null
      ? []
      : Array.from({ length: 18 }, (_, index) => ({
          assetId: groundAsset.id,
          assetCategory: groundAsset.category,
          assetAttrs: groundAsset.attrs,
          colliderType: groundAsset.colliderType,
          x: index,
          y: 9,
          widthCells: groundAsset.widthCells ?? 1,
          heightCells: groundAsset.heightCells ?? 1,
          rotation: 0,
        }))
  const placements: MapPlacement[] =
    groundAsset === null
      ? []
      : assetRefs.map((assetRef) => ({
          id: `fallback-${assetRef.x}-${assetRef.y}`,
          x: assetRef.x,
          y: assetRef.y,
          asset: groundAsset,
        }))

  return {
    id: 'mock-fallback-segment',
    roomId,
    creatorId,
    startPoint,
    endPoint,
    placements,
    assetRefs,
    segmentHash: 'mock-fallback-segment',
    isValidated: true,
    submittedAt: new Date().toISOString(),
    validatedAt: new Date().toISOString(),
    clearTimeMs: null,
  }
}

function buildMockPeerSegments(
  roomId: string,
  currentUserId: string,
  players: RoomPlayer[],
  assets: Asset[],
): MapSegmentSnapshot[] {
  const groundAsset = findGroundAsset(assets)
  const submittedAt = new Date().toISOString()
  const shouldAutoFillJoinedSlots = players.some((player) => player.id.startsWith('mock-host-'))

  return players
    .filter(
      (player) =>
        player.id !== currentUserId &&
        isMockAutoPeerPlayerId(player.id, shouldAutoFillJoinedSlots),
    )
    .map((player, index) => {
      const segmentLength = 16 + (index % 3) * 2
      const startPoint: MapPoint = { x: 0, y: 8 }
      const endPoint: MapPoint = { x: segmentLength, y: 8 }
      const assetRefs: MapSegmentAssetSnapshot[] =
        groundAsset === null
          ? []
          : Array.from({ length: segmentLength + 2 }, (_, x) => ({
              assetId: groundAsset.id,
              assetCategory: groundAsset.category,
              assetAttrs: groundAsset.attrs,
              colliderType: groundAsset.colliderType,
              x,
              y: 9,
              widthCells: groundAsset.widthCells ?? 1,
              heightCells: groundAsset.heightCells ?? 1,
              rotation: 0,
            }))
      const placements: MapPlacement[] =
        groundAsset === null
          ? []
          : assetRefs.map((assetRef) => ({
              id: `${getMockPeerSegmentId(roomId, player.id)}-${assetRef.x}-${assetRef.y}`,
              x: assetRef.x,
              y: assetRef.y,
              asset: groundAsset,
            }))

      return {
        id: getMockPeerSegmentId(roomId, player.id),
        roomId,
        creatorId: player.id,
        startPoint,
        endPoint,
        placements,
        assetRefs,
        segmentHash: `mock-peer-${roomId}-${player.id}-${segmentLength}`,
        isValidated: false,
        submittedAt,
        validatedAt: null,
        clearTimeMs: null,
      }
    })
}

function buildValidatedMockPeerSegments({
  roomId,
  currentUserId,
  players,
  assets,
  existingSegments,
  clearTimeMs,
}: {
  roomId: string
  currentUserId: string
  players: RoomPlayer[]
  assets: Asset[]
  existingSegments: MapSegmentSnapshot[]
  clearTimeMs: number
}): MapSegmentSnapshot[] {
  const validatedAt = new Date().toISOString()

  return buildMockPeerSegments(roomId, currentUserId, players, assets).map((segment, index) => {
    const existingSegment = existingSegments.find((storedSegment) => storedSegment.id === segment.id)

    return {
      ...(existingSegment ?? segment),
      isValidated: true,
      validatedAt,
      clearTimeMs: existingSegment?.clearTimeMs ?? clearTimeMs + (index + 1) * 900,
    }
  })
}

function getMockPeerSegmentId(roomId: string, playerId: string) {
  return `mock-peer-segment-${roomId}-${playerId}`
}

function isMockAutoPeerPlayerId(playerId: string, shouldAutoFillJoinedSlots: boolean) {
  return (
    playerId.startsWith('mock-host-') ||
    playerId.startsWith('mock-player-') ||
    (shouldAutoFillJoinedSlots && playerId.startsWith('mock-joined-player-'))
  )
}

function buildMergedMap(
  roomId: string,
  segments: MapSegmentSnapshot[],
  assets: Asset[],
  usedFallback: boolean,
): MergedMap {
  const groundAssetId = findGroundAsset(assets)?.id ?? 'system-platform-grass'
  const groundAsset = findGroundAsset(assets)
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const placements: MergedMapPlacement[] = []
  let globalStart: MapPoint = { x: 0, y: 8 }
  let currentGlobalEnd: MapPoint | null = null

  segments.forEach((segment, segmentIndex) => {
    const connectorCells = segmentIndex === 0 ? 0 : 3
    const offsetX =
      currentGlobalEnd === null
        ? -segment.startPoint.x
        : currentGlobalEnd.x + connectorCells - segment.startPoint.x
    const offsetY =
      currentGlobalEnd === null ? 8 - segment.startPoint.y : currentGlobalEnd.y - segment.startPoint.y

    const segmentStart = {
      x: segment.startPoint.x + offsetX,
      y: segment.startPoint.y + offsetY,
    }
    const segmentEnd = {
      x: segment.endPoint.x + offsetX,
      y: segment.endPoint.y + offsetY,
    }

    if (currentGlobalEnd !== null) {
      placements.push(
        ...buildConnectorPlacements({
          from: currentGlobalEnd,
          to: segmentStart,
          cells: connectorCells,
          groundAssetId,
          groundAsset,
        }),
      )
    }

    segment.assetRefs.forEach((asset) => {
      placements.push({
        assetId: asset.assetId,
        assetCategory: asset.assetCategory ?? assetById.get(asset.assetId)?.category,
        assetAttrs: asset.assetAttrs ?? assetById.get(asset.assetId)?.attrs,
        colliderType: asset.colliderType ?? assetById.get(asset.assetId)?.colliderType,
        sourceSegmentId: segment.id,
        x: asset.x + offsetX,
        y: asset.y + offsetY,
        widthCells: asset.widthCells,
        heightCells: asset.heightCells,
        rotation: asset.rotation,
      })
    })

    if (segmentIndex === 0) {
      globalStart = segmentStart
    }

    currentGlobalEnd = segmentEnd
  })

  return {
    id: getMergedMapId(roomId, segments, usedFallback),
    roomId,
    globalStart,
    globalEnd: currentGlobalEnd ?? globalStart,
    placements,
    segments,
    usedFallback,
    createdAt: new Date().toISOString(),
  }
}

function buildConnectorPlacements({
  from,
  to,
  cells,
  groundAssetId,
  groundAsset,
}: {
  from: MapPoint
  to: MapPoint
  cells: number
  groundAssetId: string
  groundAsset: Asset | null
}): MergedMapPlacement[] {
  return Array.from({ length: cells }, (_, index) => {
    const progress = cells <= 1 ? 1 : index / cells
    const interpolatedY = Math.round(from.y + (to.y - from.y) * progress)

    return {
      assetId: groundAssetId,
      assetCategory: 'platform',
      assetAttrs: groundAsset?.attrs,
      colliderType: groundAsset?.colliderType ?? 'rect',
      sourceSegmentId: 'connector',
      x: from.x + index,
      y: interpolatedY + 1,
      widthCells: 1,
      heightCells: 1,
      rotation: 0,
    }
  })
}

function getMergedMapId(roomId: string, segments: MapSegmentSnapshot[], usedFallback: boolean) {
  const segmentKey = segments
    .map((segment) => `${segment.creatorId}:${segment.segmentHash}:${segment.id}`)
    .join('|')
  const hash = hashStringToNumber(`${roomId}:${usedFallback ? 'fallback' : 'validated'}:${segmentKey}`)
    .toString(16)
    .padStart(8, '0')

  return `merged-${roomId}-${hash}`
}

function findGroundAsset(assets: Asset[]) {
  return (
    assets.find((asset) => asset.id === 'system-platform-grass') ??
    assets.find((asset) => asset.category === 'platform' && asset.status === 'ready') ??
    null
  )
}

function shuffleSegments(roomId: string, segments: MapSegmentSnapshot[]) {
  return [...segments].sort((left, right) => {
    const leftOrder = hashStringToNumber(getSegmentShuffleKey(roomId, left))
    const rightOrder = hashStringToNumber(getSegmentShuffleKey(roomId, right))

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.id.localeCompare(right.id)
  })
}

function getSegmentShuffleKey(roomId: string, segment: MapSegmentSnapshot) {
  return `${roomId}:${segment.creatorId}:${segment.segmentHash}:${segment.id}`
}

function hashStringToNumber(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function getNextPhase(phase: RoomSummary['phase']): RoomSummary['phase'] {
  if (phase === 'lobby') {
    return 'building'
  }

  if (phase === 'building') {
    return 'validating'
  }

  if (phase === 'validating') {
    return 'merging'
  }

  if (phase === 'merging') {
    return 'racing'
  }

  if (phase === 'racing') {
    return 'finished'
  }

  return 'lobby'
}

function shouldCountRoomElapsed(phase: RoomSummary['phase']) {
  return phase !== 'lobby' && phase !== 'finished'
}

function readSettings() {
  if (typeof localStorage === 'undefined') {
    return defaultSettings
  }

  let rawValue: string | null = null

  try {
    rawValue = localStorage.getItem(SETTINGS_KEY)
  } catch {
    return defaultSettings
  }

  if (rawValue === null) {
    return defaultSettings
  }

  try {
    const storedSettings = JSON.parse(rawValue) as Partial<UserSettings>

    return {
      bgmVolume:
        typeof storedSettings.bgmVolume === 'number'
          ? Math.min(100, Math.max(0, storedSettings.bgmVolume))
          : defaultSettings.bgmVolume,
      sfxVolume:
        typeof storedSettings.sfxVolume === 'number'
          ? Math.min(100, Math.max(0, storedSettings.sfxVolume))
          : defaultSettings.sfxVolume,
      bgmMuted:
        typeof storedSettings.bgmMuted === 'boolean'
          ? storedSettings.bgmMuted
          : defaultSettings.bgmMuted,
      sfxMuted:
        typeof storedSettings.sfxMuted === 'boolean'
          ? storedSettings.sfxMuted
          : defaultSettings.sfxMuted,
    }
  } catch {
    try {
      localStorage.removeItem(SETTINGS_KEY)
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    return defaultSettings
  }
}

function writeSettings(settings: UserSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Settings still apply in memory when storage is unavailable.
  }
}

import type { LoginDataMode, LoginSession, StoragePort } from '../login/loginControllerCore'
import type {
  LobbyCreateFormValue,
  LobbyRoomViewModel,
  LobbyScreenCallbacks,
  LobbyScreenProps,
  LobbyScreenState,
} from '../lobby/LobbyScreen'
import type {
  RoomConnectionStatus,
  RoomPlayerSlotViewModel,
  RoomScreenCallbacks,
  RoomScreenProps,
  RoomScreenState,
} from './RoomScreen'

export type RoomPhase =
  | 'lobby'
  | 'building'
  | 'validating'
  | 'merging'
  | 'racing'
  | 'finished'

export interface RoomControllerError {
  kind:
    | 'validation'
    | 'authentication'
    | 'authorization'
    | 'not_found'
    | 'conflict'
    | 'offline'
    | 'reconnecting'
    | 'server_unavailable'
    | 'malformed_response'
  message: string
  retryable: boolean
}

export type RoomResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: RoomControllerError
    }

export interface RoomSummaryRecord {
  id: string
  name: string
  hostId: string | null
  hostNickname: string
  isPublic: boolean
  players: number
  maxPlayers: 2 | 3 | 4
  phase: RoomPhase
  elapsedSeconds: number
  phaseEndsAt: string | null
}

export interface CreateRoomPayload {
  name: string
  isPublic: boolean
  password?: string
  maxPlayers: 2 | 3 | 4
}

export interface RoomRealtimePlayerRecord {
  userId: string
  nickname: string
  isHost: boolean
  isReady: boolean
  hasLeft?: boolean
}

export interface RoomRealtimeSnapshot {
  roomId: string
  phase: RoomPhase
  phaseEndsAt: string | null
  players: RoomRealtimePlayerRecord[]
}

export interface RoomRealtimeHandlers {
  onConnectionStatus?: (status: RoomConnectionStatus, message?: string) => void
  onRoomJoined?: (snapshot: RoomRealtimeSnapshot) => void
  onRoomStateChanged?: (snapshot: RoomRealtimeSnapshot) => void
  onPhaseChanged?: (payload: { roomId: string; phase: RoomPhase; phaseEndsAt: string | null }) => void
}

export interface RoomPort {
  listRooms(session: LoginSession, dataMode: LoginDataMode): Promise<RoomResult<RoomSummaryRecord[]>>
  getRoomSnapshot(
    session: LoginSession,
    roomId: string,
    dataMode: LoginDataMode,
  ): Promise<RoomResult<RoomRealtimeSnapshot>>
  createRoom(
    session: LoginSession,
    payload: CreateRoomPayload,
    dataMode: LoginDataMode,
  ): Promise<RoomResult<RoomSummaryRecord>>
  joinPublicRoom(session: LoginSession, dataMode: LoginDataMode): Promise<RoomResult<RoomSummaryRecord>>
  joinRoom(
    session: LoginSession,
    roomId: string,
    password: string | undefined,
    dataMode: LoginDataMode,
  ): Promise<RoomResult<RoomSummaryRecord>>
  startRoom(
    session: LoginSession,
    roomId: string,
    dataMode: LoginDataMode,
  ): Promise<RoomResult<RoomSummaryRecord>>
  setReady(
    session: LoginSession,
    roomId: string,
    isReady: boolean,
    dataMode: LoginDataMode,
  ): Promise<RoomResult<RoomRealtimeSnapshot>>
  leaveRoom(
    session: LoginSession,
    roomId: string,
    dataMode: LoginDataMode,
  ): Promise<RoomResult<RoomRealtimeSnapshot | null>>
}

export interface RoomRealtime {
  getConnectionStatus(): { status: RoomConnectionStatus; message?: string }
  connect(session: LoginSession, handlers: RoomRealtimeHandlers): Promise<RoomResult<void>>
  disconnect(): void
  joinRoom(payload: { roomId: string; userId: string; nickname: string; isHost?: boolean }): void
  leaveRoom(payload: { roomId: string; userId: string }): void
  setReady(payload: { roomId: string; userId: string; isReady: boolean }): void
  startRoom(payload: { roomId: string; userId: string }): void
}

export interface RoomRoutePort {
  navigateLogin(): void
  navigateMain(): void
  navigateLobby(): void
  navigateRoom(roomId: string): void
  navigateMapBuild(roomId: string): void
}

export interface RoomControllerState {
  session: LoginSession | null
  rooms: RoomSummaryRecord[]
  currentRoomId?: string
  currentRoomName: string
  currentMaxPlayers: 2 | 3 | 4
  currentRoom: RoomRealtimeSnapshot | null
  createForm: LobbyCreateFormValue
  selectedPrivateRoomId?: string
  passwordValue: string
  connectionStatus: RoomConnectionStatus
  connectionMessage?: string
  lobbyStateOverride?: LobbyScreenState
  roomStateOverride?: RoomScreenState
  refreshing: boolean
  creating: boolean
  joiningRoomId?: string
  starting: boolean
  lastErrorMessage?: string
}

export interface RoomControllerRuntime {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  roomPort: RoomPort
  roomRealtime: RoomRealtime
  routePort: RoomRoutePort
  getState: () => RoomControllerState
  setState: (updater: (state: RoomControllerState) => RoomControllerState) => void
}

export function createInitialRoomControllerState(roomId?: string): RoomControllerState {
  return {
    session: null,
    rooms: [],
    currentRoomId: roomId,
    currentRoomName: '방 대기실',
    currentMaxPlayers: 4,
    currentRoom: null,
    createForm: {
      name: '새 릴레이 방',
      isPublic: true,
      password: '',
      maxPlayers: 4,
    },
    selectedPrivateRoomId: undefined,
    passwordValue: '',
    connectionStatus: 'online',
    connectionMessage: undefined,
    lobbyStateOverride: undefined,
    roomStateOverride: undefined,
    refreshing: false,
    creating: false,
    joiningRoomId: undefined,
    starting: false,
    lastErrorMessage: undefined,
  }
}

export async function bootLobbyController(runtime: RoomControllerRuntime) {
  const session = runtime.sessionStoragePort.loadSession()
  const connection = runtime.roomRealtime.getConnectionStatus()

  runtime.setState((state) => ({
    ...state,
    session,
    connectionStatus: connection.status,
    connectionMessage: connection.message,
  }))

  if (!session) {
    runtime.routePort.navigateLogin()
    return { destination: 'login' as const, reason: 'no_session' as const }
  }

  const result = await loadLobbyRooms(runtime)

  return result.ok
    ? { destination: 'lobby' as const, reason: 'loaded' as const }
    : { destination: 'lobby' as const, reason: result.reason }
}

export async function bootRoomController(runtime: RoomControllerRuntime, roomId: string) {
  const session = runtime.sessionStoragePort.loadSession()
  const connection = runtime.roomRealtime.getConnectionStatus()

  runtime.setState((state) => ({
    ...state,
    session,
    currentRoomId: roomId,
    connectionStatus: connection.status,
    connectionMessage: connection.message,
    roomStateOverride: 'loading',
  }))

  if (!session) {
    runtime.routePort.navigateLogin()
    return { destination: 'login' as const, reason: 'no_session' as const }
  }

  const roomsResult = await runtime.roomPort.listRooms(session, runtime.dataMode)

  if (roomsResult.ok) {
    const roomSummary = roomsResult.value.find((room) => room.id === roomId)

    if (roomSummary) {
      runtime.setState((state) => ({
        ...state,
        rooms: roomsResult.value,
        currentRoomName: roomSummary.name,
        currentMaxPlayers: roomSummary.maxPlayers,
      }))
    }
  }

  let snapshotResult = await runtime.roomPort.getRoomSnapshot(session, roomId, runtime.dataMode)

  if (snapshotResult.ok) {
    snapshotResult = await ensureRoomMembership(runtime, session, snapshotResult.value)
  }

  if (snapshotResult.ok) {
    handleRoomRealtimeSnapshot(runtime, snapshotResult.value)
  } else {
    runtime.setState((state) => ({
      ...state,
      connectionStatus: mapErrorToConnectionStatus(snapshotResult.error),
      connectionMessage: snapshotResult.error.message,
      lastErrorMessage: snapshotResult.error.message,
      roomStateOverride: mapErrorToRoomState(snapshotResult.error),
    }))
  }

  const connected = await connectRoomRealtime(runtime)

  if (!connected.ok) {
    return {
      destination: 'room' as const,
      reason: snapshotResult.ok ? 'snapshot_only' as const : connected.reason,
    }
  }

  runtime.roomRealtime.joinRoom({
    roomId,
    userId: session.id,
    nickname: session.nickname,
  })
  runtime.setState((state) => ({
    ...state,
    roomStateOverride: undefined,
  }))

  return { destination: 'room' as const, reason: 'joined' as const }
}

async function ensureRoomMembership(
  runtime: RoomControllerRuntime,
  session: LoginSession,
  snapshot: RoomRealtimeSnapshot,
): Promise<RoomResult<RoomRealtimeSnapshot>> {
  const alreadyJoined = snapshot.players.some((player) => player.userId === session.id)

  if (alreadyJoined || snapshot.phase !== 'lobby') {
    return { ok: true, value: snapshot }
  }

  const joinResult = await runtime.roomPort.joinRoom(session, snapshot.roomId, undefined, runtime.dataMode)

  if (!joinResult.ok) {
    return joinResult
  }

  runtime.setState((state) => ({
    ...state,
    rooms: upsertRoomSummary(state.rooms, joinResult.value),
    currentRoomName: joinResult.value.name,
    currentMaxPlayers: joinResult.value.maxPlayers,
  }))

  return runtime.roomPort.getRoomSnapshot(session, snapshot.roomId, runtime.dataMode)
}

export async function loadLobbyRooms(runtime: RoomControllerRuntime) {
  const session = runtime.getState().session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((state) => ({
    ...state,
    session,
    refreshing: true,
    lobbyStateOverride: state.rooms.length === 0 ? 'loading' : undefined,
    lastErrorMessage: undefined,
  }))

  const result = await runtime.roomPort.listRooms(session, runtime.dataMode)

  if (!result.ok) {
    const connectionStatus = mapErrorToConnectionStatus(result.error)

    runtime.setState((state) => ({
      ...state,
      refreshing: false,
      connectionStatus,
      connectionMessage: result.error.message,
      lastErrorMessage: result.error.message,
      lobbyStateOverride: mapErrorToLobbyState(result.error),
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((state) => ({
    ...state,
    rooms: result.value,
    refreshing: false,
    connectionStatus: 'online',
    connectionMessage: undefined,
    lobbyStateOverride: undefined,
    lastErrorMessage: undefined,
  }))

  return { ok: true as const, rooms: result.value }
}

export function createLobbyScreenProps(runtime: RoomControllerRuntime): LobbyScreenProps {
  const state = runtime.getState()
  const rooms = state.rooms.map(mapRoomSummaryToLobbyViewModel)
  const selectedPrivateRoom = rooms.find((room) => room.id === state.selectedPrivateRoomId)

  return {
    state: deriveLobbyScreenState(state, rooms),
    rooms,
    createForm: state.createForm,
    connectionStatus: state.connectionStatus === 'error' ? 'error' : state.connectionStatus,
    refreshing: state.refreshing,
    creating: state.creating,
    joiningRoomId: state.joiningRoomId,
    selectedPrivateRoom,
    passwordValue: state.passwordValue,
    errorMessage: state.lastErrorMessage ?? state.connectionMessage,
    ...createLobbyScreenCallbacks(runtime),
  }
}

export function createRoomScreenProps(runtime: RoomControllerRuntime): RoomScreenProps {
  const state = runtime.getState()
  const slots = createRoomSlots(
    state.currentRoom,
    state.session,
    state.currentMaxPlayers,
  )
  const playerCount = slots.filter((slot) => slot.state !== 'empty').length
  const localSlot = slots.find((slot) => slot.isLocal)
  const allGuestsReady = slots
    .filter((slot) => slot.state !== 'empty' && !slot.isHost)
    .every((slot) => slot.isReady)

  return {
    state: deriveRoomScreenState(state, slots),
    roomName: state.currentRoomName,
    roomId: state.currentRoomId ?? 'unknown-room',
    currentNickname: state.session?.nickname ?? '플레이어',
    slots,
    connectionStatus: state.connectionStatus,
    readyDisabled: playerCount === 0 || localSlot?.isHost === true || state.starting,
    startDisabled:
      playerCount < 2 ||
      state.starting ||
      localSlot?.isHost !== true ||
      !allGuestsReady,
    starting: state.starting,
    errorMessage: state.lastErrorMessage ?? state.connectionMessage,
    statusMessage: getRoomStatusMessage(state, slots),
    ...createRoomScreenCallbacks(runtime),
  }
}

export function createLobbyScreenCallbacks(
  runtime: RoomControllerRuntime,
): LobbyScreenCallbacks {
  return {
    onGoMain: () => runtime.routePort.navigateMain(),
    onRefreshRooms: () => {
      void loadLobbyRooms(runtime)
    },
    onQuickJoin: () => {
      void quickJoinPublicRoom(runtime)
    },
    onCreateRoomChange: (patch) => updateCreateForm(runtime, patch),
    onCreateRoom: () => {
      void createLobbyRoom(runtime)
    },
    onJoinRoom: (roomId) => {
      void joinLobbyRoom(runtime, roomId, undefined)
    },
    onOpenPassword: (roomId) => openLobbyPassword(runtime, roomId),
    onClosePassword: () => closeLobbyPassword(runtime),
    onPasswordChange: (password) => updateLobbyPassword(runtime, password),
    onSubmitPassword: () => {
      const state = runtime.getState()
      if (state.selectedPrivateRoomId) {
        void joinLobbyRoom(runtime, state.selectedPrivateRoomId, state.passwordValue)
      }
    },
  }
}

export function createRoomScreenCallbacks(runtime: RoomControllerRuntime): RoomScreenCallbacks {
  return {
    onGoLobby: () => runtime.routePort.navigateLobby(),
    onToggleReady: () => {
      void toggleRoomReady(runtime)
    },
    onStartRoom: () => {
      void startRoom(runtime)
    },
    onLeaveRoom: () => {
      void leaveRoom(runtime)
    },
    onRetryConnection: () => {
      const roomId = runtime.getState().currentRoomId

      if (roomId) {
        void bootRoomController(runtime, roomId)
      }
    },
  }
}

export function updateCreateForm(
  runtime: RoomControllerRuntime,
  patch: Partial<LobbyCreateFormValue>,
) {
  runtime.setState((state) => ({
    ...state,
    createForm: {
      ...state.createForm,
      ...patch,
    },
  }))
}

export async function createLobbyRoom(runtime: RoomControllerRuntime) {
  const state = runtime.getState()
  const session = state.session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  const name = state.createForm.name.trim()

  if (name.length === 0) {
    runtime.setState((current) => ({
      ...current,
      lobbyStateOverride: 'error',
      lastErrorMessage: '방 이름을 입력해주세요.',
    }))
    return { ok: false as const, reason: 'validation' as const }
  }

  runtime.setState((current) => ({
    ...current,
    creating: true,
    lastErrorMessage: undefined,
  }))

  const result = await runtime.roomPort.createRoom(
    session,
    {
      name,
      isPublic: state.createForm.isPublic,
      password: state.createForm.isPublic ? undefined : state.createForm.password,
      maxPlayers: state.createForm.maxPlayers,
    },
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      creating: false,
      lobbyStateOverride: mapErrorToLobbyState(result.error),
      connectionStatus: mapErrorToConnectionStatus(result.error),
      lastErrorMessage: result.error.message,
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  const entered = await enterRoomAfterRestSuccess(runtime, result.value, true)

  runtime.setState((current) => ({
    ...current,
    creating: false,
  }))

  return entered
}

export async function quickJoinPublicRoom(runtime: RoomControllerRuntime) {
  const session = runtime.getState().session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((state) => ({
    ...state,
    joiningRoomId: 'quick-join',
    lastErrorMessage: undefined,
    lobbyStateOverride: undefined,
  }))

  const result = await runtime.roomPort.joinPublicRoom(session, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((state) => ({
      ...state,
      joiningRoomId: undefined,
      lobbyStateOverride: result.error.kind === 'not_found' ? 'quickJoinFailed' : mapErrorToLobbyState(result.error),
      connectionStatus: mapErrorToConnectionStatus(result.error),
      lastErrorMessage: result.error.message,
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  return enterRoomAfterRestSuccess(runtime, result.value, false)
}

export async function joinLobbyRoom(
  runtime: RoomControllerRuntime,
  roomId: string,
  password: string | undefined,
) {
  const state = runtime.getState()
  const session = state.session ?? runtime.sessionStoragePort.loadSession()
  const room = state.rooms.find((candidate) => candidate.id === roomId)

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  if (room && !canJoinRoomFromSummary(room)) {
    return { ok: false as const, reason: 'playing' as const }
  }

  if (room && room.players >= room.maxPlayers) {
    return { ok: false as const, reason: 'full' as const }
  }

  runtime.setState((current) => ({
    ...current,
    joiningRoomId: roomId,
    lastErrorMessage: undefined,
    lobbyStateOverride: undefined,
  }))

  const result = await runtime.roomPort.joinRoom(session, roomId, password?.trim() || undefined, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      joiningRoomId: undefined,
      lobbyStateOverride: result.error.kind === 'authorization' ? 'passwordError' : mapErrorToLobbyState(result.error),
      connectionStatus: mapErrorToConnectionStatus(result.error),
      lastErrorMessage: result.error.kind === 'authorization' ? '비밀번호를 확인해주세요.' : result.error.message,
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  return enterRoomAfterRestSuccess(runtime, result.value, false)
}

export function openLobbyPassword(runtime: RoomControllerRuntime, roomId: string) {
  runtime.setState((state) => ({
    ...state,
    selectedPrivateRoomId: roomId,
    passwordValue: '',
    lastErrorMessage: undefined,
    lobbyStateOverride: undefined,
  }))
}

export function closeLobbyPassword(runtime: RoomControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    selectedPrivateRoomId: undefined,
    passwordValue: '',
    lobbyStateOverride: undefined,
  }))
}

export function updateLobbyPassword(runtime: RoomControllerRuntime, password: string) {
  runtime.setState((state) => ({
    ...state,
    passwordValue: password,
  }))
}

export async function toggleRoomReady(runtime: RoomControllerRuntime) {
  const state = runtime.getState()
  const session = state.session
  const roomId = state.currentRoomId

  if (!session || !roomId) {
    runtime.routePort.navigateLogin()
    return
  }

  const localPlayer = state.currentRoom?.players.find((player) => player.userId === session.id)

  if (localPlayer?.isHost) {
    return
  }

  const nextReady = !localPlayer?.isReady
  const result = await runtime.roomPort.setReady(session, roomId, nextReady, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      roomStateOverride: mapErrorToRoomState(result.error),
      connectionStatus: mapErrorToConnectionStatus(result.error),
      lastErrorMessage: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  handleRoomRealtimeSnapshot(runtime, result.value)
  runtime.roomRealtime.setReady({
    roomId,
    userId: session.id,
    isReady: nextReady,
  })

  return { ok: true as const, room: result.value }
}

export async function startRoom(runtime: RoomControllerRuntime) {
  const state = runtime.getState()
  const session = state.session
  const roomId = state.currentRoomId
  const players = state.currentRoom?.players ?? []
  const localPlayer = players.find((player) => player.userId === session?.id)
  const guestsReady = players.filter((player) => !player.isHost).every((player) => player.isReady)

  if (!session || !roomId) {
    runtime.routePort.navigateLogin()
    return
  }

  if (!localPlayer?.isHost || players.length < 2 || !guestsReady) {
    runtime.setState((current) => ({
      ...current,
      roomStateOverride: 'notEnoughPlayers',
      lastErrorMessage: players.length < 2 ? '최소 2명이 필요해요.' : '아직 준비하지 않은 플레이어가 있어요.',
    }))
    return { ok: false as const, reason: 'blocked' as const }
  }

  runtime.setState((current) => ({
    ...current,
    starting: true,
    roomStateOverride: 'starting',
    lastErrorMessage: undefined,
  }))

  const result = await runtime.roomPort.startRoom(session, roomId, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      starting: false,
      roomStateOverride: mapErrorToRoomState(result.error),
      connectionStatus: mapErrorToConnectionStatus(result.error),
      lastErrorMessage: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((current) => ({
    ...current,
    rooms: upsertRoomSummary(current.rooms, result.value),
    currentRoom: current.currentRoom
      ? {
          ...current.currentRoom,
          phase: result.value.phase,
          phaseEndsAt: result.value.phaseEndsAt,
        }
      : current.currentRoom,
  }))
  runtime.roomRealtime.startRoom({ roomId, userId: session.id })
  runtime.routePort.navigateMapBuild(roomId)

  return { ok: true as const, room: result.value }
}

export async function leaveRoom(runtime: RoomControllerRuntime) {
  const state = runtime.getState()
  const session = state.session
  const roomId = state.currentRoomId

  if (session && roomId) {
    const result = await runtime.roomPort.leaveRoom(session, roomId, runtime.dataMode)

    if (result.ok && result.value) {
      handleRoomRealtimeSnapshot(runtime, result.value)
    }

    runtime.roomRealtime.leaveRoom({
      roomId,
      userId: session.id,
    })
  }

  runtime.routePort.navigateLobby()
}

export function handleRoomRealtimeSnapshot(
  runtime: RoomControllerRuntime,
  snapshot: RoomRealtimeSnapshot,
) {
  const previousPlayers = runtime.getState().currentRoom?.players ?? []
  const hasPlayerLeft = previousPlayers.length > snapshot.players.length

  runtime.setState((state) => ({
    ...state,
    currentRoomId: snapshot.roomId,
    currentRoom: snapshot,
    connectionStatus: 'online',
    connectionMessage: undefined,
    roomStateOverride: hasPlayerLeft ? 'playerLeft' : undefined,
    starting: snapshot.phase !== 'lobby' ? false : state.starting,
  }))
}

export function handleRoomConnectionStatus(
  runtime: RoomControllerRuntime,
  status: RoomConnectionStatus,
  message?: string,
) {
  runtime.setState((state) => ({
    ...state,
    connectionStatus: status,
    connectionMessage: message,
    lobbyStateOverride:
      status === 'offline' || status === 'reconnecting'
        ? status
        : status === 'error'
          ? 'error'
          : state.lobbyStateOverride,
    roomStateOverride:
      status === 'offline' || status === 'reconnecting'
        ? status
        : status === 'error'
          ? 'error'
          : state.roomStateOverride,
  }))
}

export function mapRoomSummaryToLobbyViewModel(room: RoomSummaryRecord): LobbyRoomViewModel {
  const canJoin = canJoinRoomFromSummary(room)
  const isFull = room.players >= room.maxPlayers
  const state = !canJoin ? 'playing' : isFull ? 'full' : room.isPublic ? 'open' : 'private'

  return {
    id: room.id,
    name: room.name,
    hostNickname: room.hostNickname,
    isPublic: room.isPublic,
    players: room.players,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    elapsedText: formatElapsedSeconds(room.elapsedSeconds),
    state,
    disabledReason:
      state === 'full'
        ? '정원이 찼어요.'
        : state === 'playing'
          ? `게임 중 · ${formatElapsedSeconds(room.elapsedSeconds)}`
          : undefined,
  }
}

function canJoinRoomFromSummary(room: RoomSummaryRecord) {
  if (room.phase === 'lobby') {
    return true
  }

  if (room.phase !== 'building' || !room.phaseEndsAt) {
    return false
  }

  return Date.parse(room.phaseEndsAt) - Date.now() >= 60_000
}

export function createRoomSlots(
  snapshot: RoomRealtimeSnapshot | null,
  session: LoginSession | null,
  maxPlayers: 2 | 3 | 4,
): RoomPlayerSlotViewModel[] {
  const players = snapshot?.players ?? []
  const slots: RoomPlayerSlotViewModel[] = players.slice(0, maxPlayers).map((player, index) => ({
    slotIndex: index + 1,
    state: player.hasLeft
      ? 'left'
      : player.isHost
        ? 'host'
        : player.isReady
          ? 'ready'
          : 'joined',
    playerId: player.userId,
    nickname: player.nickname,
    isHost: player.isHost,
    isLocal: player.userId === session?.id,
    isReady: player.isReady || player.isHost,
  }))

  while (slots.length < maxPlayers) {
    slots.push({
      slotIndex: slots.length + 1,
      state: 'empty',
    })
  }

  return slots
}

function createRoomRealtimeHandlers(runtime: RoomControllerRuntime): RoomRealtimeHandlers {
  return {
    onConnectionStatus: (status, message) => handleRoomConnectionStatus(runtime, status, message),
    onRoomJoined: (snapshot) => handleRoomRealtimeSnapshot(runtime, snapshot),
    onRoomStateChanged: (snapshot) => handleRoomRealtimeSnapshot(runtime, snapshot),
    onPhaseChanged: (payload) => {
      runtime.setState((state) => ({
        ...state,
        currentRoom: state.currentRoom
          ? {
              ...state.currentRoom,
              phase: payload.phase,
              phaseEndsAt: payload.phaseEndsAt,
            }
          : state.currentRoom,
        starting: false,
      }))

      if (payload.phase !== 'lobby') {
        runtime.routePort.navigateMapBuild(payload.roomId)
      }
    },
  }
}

async function connectRoomRealtime(runtime: RoomControllerRuntime) {
  const session = runtime.getState().session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  const result = await runtime.roomRealtime.connect(session, createRoomRealtimeHandlers(runtime))

  if (!result.ok) {
    runtime.setState((state) => ({
      ...state,
      connectionStatus: 'error',
      connectionMessage: result.error.message,
      lastErrorMessage: result.error.message,
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((state) => ({
    ...state,
    connectionStatus: 'online',
    connectionMessage: undefined,
  }))

  return { ok: true as const }
}

async function enterRoomAfterRestSuccess(
  runtime: RoomControllerRuntime,
  room: RoomSummaryRecord,
  isHost: boolean,
) {
  const session = runtime.getState().session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((state) => ({
    ...state,
    rooms: upsertRoomSummary(state.rooms, room),
    currentRoomId: room.id,
    currentRoomName: room.name,
    currentMaxPlayers: room.maxPlayers,
    selectedPrivateRoomId: undefined,
    passwordValue: '',
    joiningRoomId: undefined,
  }))

  const snapshotResult = await runtime.roomPort.getRoomSnapshot(session, room.id, runtime.dataMode)

  if (snapshotResult.ok) {
    handleRoomRealtimeSnapshot(runtime, snapshotResult.value)
  }

  const connected = await connectRoomRealtime(runtime)

  if (!connected.ok) {
    if (snapshotResult.ok) {
      runtime.routePort.navigateRoom(room.id)

      return { ok: true as const, room, realtime: connected.reason }
    }

    return connected
  }

  runtime.roomRealtime.joinRoom({
    roomId: room.id,
    userId: session.id,
    nickname: session.nickname,
    isHost,
  })
  runtime.routePort.navigateRoom(room.id)

  return { ok: true as const, room }
}

function deriveLobbyScreenState(
  state: RoomControllerState,
  rooms: LobbyRoomViewModel[],
): LobbyScreenState {
  if (state.lobbyStateOverride) {
    return state.lobbyStateOverride
  }

  if (state.connectionStatus === 'offline') {
    return 'offline'
  }

  if (state.connectionStatus === 'reconnecting') {
    return 'reconnecting'
  }

  if (state.refreshing && rooms.length === 0) {
    return 'loading'
  }

  if (rooms.length === 0) {
    return 'empty'
  }

  if (rooms.some((room) => room.state === 'open')) {
    return 'publicOpen'
  }

  if (rooms.some((room) => room.state === 'private')) {
    return 'privateOpen'
  }

  if (rooms.every((room) => room.state === 'full')) {
    return 'full'
  }

  if (rooms.some((room) => room.state === 'playing')) {
    return 'playing'
  }

  return 'empty'
}

function deriveRoomScreenState(
  state: RoomControllerState,
  slots: RoomPlayerSlotViewModel[],
): RoomScreenState {
  if (state.roomStateOverride) {
    return state.roomStateOverride
  }

  if (state.connectionStatus === 'offline') {
    return 'offline'
  }

  if (state.connectionStatus === 'reconnecting') {
    return 'reconnecting'
  }

  if (state.connectionStatus === 'error') {
    return 'error'
  }

  if (!state.currentRoom) {
    return 'loading'
  }

  const occupiedSlots = slots.filter((slot) => slot.state !== 'empty')
  const localSlot = slots.find((slot) => slot.isLocal)

  if (occupiedSlots.length === 0) {
    return 'emptySlot'
  }

  if (occupiedSlots.length < 2) {
    return 'notEnoughPlayers'
  }

  if (localSlot?.isHost) {
    return 'host'
  }

  if (localSlot?.isReady) {
    return 'ready'
  }

  if (localSlot) {
    return 'notReady'
  }

  return 'guest'
}

function getRoomStatusMessage(
  state: RoomControllerState,
  slots: RoomPlayerSlotViewModel[],
) {
  if (state.lastErrorMessage) {
    return state.lastErrorMessage
  }

  if (state.connectionStatus === 'offline') {
    return '오프라인입니다. 연결이 돌아오면 다시 시도해주세요.'
  }

  if (state.connectionStatus === 'reconnecting') {
    return '재연결 중입니다. 잠시만 기다려주세요.'
  }

  const occupiedSlots = slots.filter((slot) => slot.state !== 'empty')
  const localSlot = slots.find((slot) => slot.isLocal)

  if (occupiedSlots.length < 2) {
    return '최소 2명이 필요해요.'
  }

  if (localSlot?.isHost) {
    return '모두 준비되면 제작을 시작하세요.'
  }

  if (localSlot?.isReady) {
    return '방장이 시작할 때까지 기다려주세요.'
  }

  return '준비 버튼을 눌러 참가 상태를 알려주세요.'
}

function mapErrorToConnectionStatus(error: RoomControllerError): RoomConnectionStatus {
  if (error.kind === 'offline') {
    return 'offline'
  }

  if (error.kind === 'reconnecting') {
    return 'reconnecting'
  }

  if (error.kind === 'server_unavailable' || error.kind === 'malformed_response') {
    return 'error'
  }

  return 'online'
}

function mapErrorToLobbyState(error: RoomControllerError): LobbyScreenState {
  if (error.kind === 'offline') {
    return 'offline'
  }

  if (error.kind === 'reconnecting') {
    return 'reconnecting'
  }

  return 'error'
}

function mapErrorToRoomState(error: RoomControllerError): RoomScreenState {
  if (error.kind === 'offline') {
    return 'offline'
  }

  if (error.kind === 'reconnecting') {
    return 'reconnecting'
  }

  if (error.kind === 'conflict') {
    return 'notEnoughPlayers'
  }

  return 'error'
}

function upsertRoomSummary(
  rooms: RoomSummaryRecord[],
  nextRoom: RoomSummaryRecord,
) {
  const index = rooms.findIndex((room) => room.id === nextRoom.id)

  if (index === -1) {
    return [nextRoom, ...rooms]
  }

  return rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))
}

function formatElapsedSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

import type {
  LobbyConnectionStatus,
  LobbyCreateFormValue,
  LobbyRoomViewModel,
  LobbyScreenCallbacks,
  LobbyScreenProps,
  LobbyScreenState,
} from '../../pages/lobby/LobbyScreen'

export type LobbyFixtureViewport = '1280x720' | '1440x900' | '1920x1080'

export interface LobbyScreenFixture {
  id: string
  screenId: 'S3_LOBBY'
  title: string
  description: string
  state: LobbyScreenState
  viewport: LobbyFixtureViewport
  rooms: LobbyRoomViewModel[]
  connectionStatus?: LobbyConnectionStatus
  refreshing?: boolean
  creating?: boolean
  joiningRoomId?: string
  selectedPrivateRoomId?: string
  passwordValue?: string
  errorMessage?: string
  createForm?: LobbyCreateFormValue
}

const publicOpenRoom: LobbyRoomViewModel = {
  id: 'fixture-public-open',
  name: '공개 릴레이 방',
  hostNickname: '노란방장',
  isPublic: true,
  players: 1,
  maxPlayers: 4,
  phase: 'lobby',
  elapsedText: '0:00',
  state: 'open',
}

const privateOpenRoom: LobbyRoomViewModel = {
  id: 'fixture-private-open',
  name: '친구 전용 비공개방',
  hostNickname: '초대장',
  isPublic: false,
  players: 2,
  maxPlayers: 4,
  phase: 'lobby',
  elapsedText: '0:00',
  state: 'private',
}

const fullRoom: LobbyRoomViewModel = {
  id: 'fixture-full',
  name: '정원 마감 방',
  hostNickname: '가득이',
  isPublic: true,
  players: 4,
  maxPlayers: 4,
  phase: 'lobby',
  elapsedText: '0:00',
  state: 'full',
  disabledReason: '정원이 찼어요.',
}

const playingRoom: LobbyRoomViewModel = {
  id: 'fixture-playing',
  name: '제작 진행 중인 방',
  hostNickname: '달리는방장',
  isPublic: true,
  players: 2,
  maxPlayers: 4,
  phase: 'racing',
  elapsedText: '3:07',
  state: 'playing',
  disabledReason: '게임 중 · 3:07',
}

const defaultCreateForm: LobbyCreateFormValue = {
  name: '새 릴레이 방',
  isPublic: true,
  password: '',
  maxPlayers: 4,
}

export const lobbyScreenFixtures: LobbyScreenFixture[] = [
  createLobbyFixture({
    id: 's3-lobby-loading',
    title: '로비 로딩',
    description: '방 목록을 불러오는 동안 높이를 유지합니다.',
    state: 'loading',
    rooms: [],
    refreshing: true,
    viewport: '1280x720',
  }),
  createLobbyFixture({
    id: 's3-lobby-empty',
    title: '로비 빈 목록',
    description: '입장 가능한 방이 없는 상태입니다.',
    state: 'empty',
    rooms: [],
    viewport: '1280x720',
  }),
  createLobbyFixture({
    id: 's3-lobby-public-open',
    title: '공개방 열림',
    description: '공개방 입장 CTA를 표시합니다.',
    state: 'publicOpen',
    rooms: [publicOpenRoom, privateOpenRoom, fullRoom, playingRoom],
    viewport: '1440x900',
  }),
  createLobbyFixture({
    id: 's3-lobby-private-open',
    title: '비공개방 열림',
    description: '비공개방 입장 modal을 열 수 있는 상태입니다.',
    state: 'privateOpen',
    rooms: [privateOpenRoom],
    viewport: '1440x900',
  }),
  createLobbyFixture({
    id: 's3-lobby-full',
    title: '정원 마감',
    description: 'full 방의 disabled action과 사유를 표시합니다.',
    state: 'full',
    rooms: [fullRoom],
    viewport: '1440x900',
  }),
  createLobbyFixture({
    id: 's3-lobby-playing',
    title: '게임 중',
    description: 'playing 방의 disabled action과 경과 시간을 표시합니다.',
    state: 'playing',
    rooms: [playingRoom],
    viewport: '1440x900',
  }),
  createLobbyFixture({
    id: 's3-lobby-offline',
    title: '로비 오프라인',
    description: 'offline connection state입니다.',
    state: 'offline',
    rooms: [publicOpenRoom],
    connectionStatus: 'offline',
    errorMessage: '방 목록 연결이 끊어졌어요.',
    viewport: '1280x720',
  }),
  createLobbyFixture({
    id: 's3-lobby-reconnecting',
    title: '로비 재연결',
    description: 'reconnecting connection state입니다.',
    state: 'reconnecting',
    rooms: [publicOpenRoom],
    connectionStatus: 'reconnecting',
    errorMessage: '방 상태를 다시 연결하고 있어요.',
    viewport: '1280x720',
  }),
  createLobbyFixture({
    id: 's3-lobby-password-error',
    title: '비밀번호 오류',
    description: '비공개방 입장 modal의 오류 상태입니다.',
    state: 'passwordError',
    rooms: [privateOpenRoom],
    selectedPrivateRoomId: privateOpenRoom.id,
    passwordValue: '0000',
    errorMessage: '비밀번호를 확인해주세요.',
    viewport: '1440x900',
  }),
  createLobbyFixture({
    id: 's3-lobby-quick-join-failed',
    title: '빠른 입장 실패',
    description: '입장 가능한 공개방이 없는 오류입니다.',
    state: 'quickJoinFailed',
    rooms: [privateOpenRoom, fullRoom],
    errorMessage: '입장 가능한 공개방이 없습니다.',
    viewport: '1280x720',
  }),
]

export type LobbyScreenFixtureId = (typeof lobbyScreenFixtures)[number]['id']

export function getLobbyScreenFixture(id: string | undefined) {
  return lobbyScreenFixtures.find((fixture) => fixture.id === id) ?? lobbyScreenFixtures[0]
}

export function toLobbyScreenProps(
  fixture: LobbyScreenFixture,
  callbacks: Partial<LobbyScreenCallbacks> = {},
): LobbyScreenProps {
  const selectedPrivateRoom = fixture.rooms.find((room) => room.id === fixture.selectedPrivateRoomId)

  return {
    state: fixture.state,
    rooms: fixture.rooms,
    createForm: fixture.createForm ?? defaultCreateForm,
    connectionStatus: fixture.connectionStatus ?? 'online',
    refreshing: fixture.refreshing,
    creating: fixture.creating,
    joiningRoomId: fixture.joiningRoomId,
    selectedPrivateRoom,
    passwordValue: fixture.passwordValue ?? '',
    errorMessage: fixture.errorMessage,
    onGoMain: callbacks.onGoMain ?? noop,
    onRefreshRooms: callbacks.onRefreshRooms ?? noop,
    onQuickJoin: callbacks.onQuickJoin ?? noop,
    onCreateRoomChange: callbacks.onCreateRoomChange ?? noop,
    onCreateRoom: callbacks.onCreateRoom ?? noop,
    onJoinRoom: callbacks.onJoinRoom ?? noop,
    onOpenPassword: callbacks.onOpenPassword ?? noop,
    onClosePassword: callbacks.onClosePassword ?? noop,
    onPasswordChange: callbacks.onPasswordChange ?? noop,
    onSubmitPassword: callbacks.onSubmitPassword ?? noop,
  }
}

function createLobbyFixture(
  fixture: Omit<LobbyScreenFixture, 'screenId'>,
): LobbyScreenFixture {
  return {
    screenId: 'S3_LOBBY',
    ...fixture,
  }
}

function noop() {
  return undefined
}

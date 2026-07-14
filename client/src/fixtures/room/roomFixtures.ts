import type {
  RoomPlayerSlotViewModel,
  RoomScreenCallbacks,
  RoomScreenProps,
  RoomScreenState,
} from '../../pages/room/RoomScreen'

export type RoomFixtureViewport = '1280x720' | '1440x900' | '1920x1080'

export interface RoomScreenFixture {
  id: string
  screenId: 'C_ROOM_LOBBY'
  title: string
  description: string
  state: RoomScreenState
  viewport: RoomFixtureViewport
  roomName: string
  roomId: string
  currentNickname: string
  slots: RoomPlayerSlotViewModel[]
  connectionStatus?: RoomScreenProps['connectionStatus']
  readyDisabled?: boolean
  startDisabled?: boolean
  starting?: boolean
  errorMessage?: string
  statusMessage?: string
}

const hostSlot: RoomPlayerSlotViewModel = {
  slotIndex: 1,
  state: 'host',
  playerId: 'host-1',
  nickname: '노란방장',
  isHost: true,
  isLocal: true,
  isReady: true,
}

const guestSlot: RoomPlayerSlotViewModel = {
  slotIndex: 2,
  state: 'joined',
  playerId: 'guest-1',
  nickname: '초록손님',
  isHost: false,
  isLocal: false,
  isReady: false,
}

const readyGuestSlot: RoomPlayerSlotViewModel = {
  ...guestSlot,
  state: 'ready',
  isReady: true,
}

const localGuestSlot: RoomPlayerSlotViewModel = {
  slotIndex: 2,
  state: 'joined',
  playerId: 'guest-local',
  nickname: '나의닉네임',
  isHost: false,
  isLocal: true,
  isReady: false,
}

const localReadyGuestSlot: RoomPlayerSlotViewModel = {
  ...localGuestSlot,
  state: 'ready',
  isReady: true,
}

const emptySlot = (slotIndex: number): RoomPlayerSlotViewModel => ({
  slotIndex,
  state: 'empty',
})

export const roomScreenFixtures: RoomScreenFixture[] = [
  createRoomFixture({
    id: 'c-room-loading',
    title: '방 로딩',
    description: '방 참가자 상태를 불러오는 중입니다.',
    state: 'loading',
    slots: [emptySlot(1), emptySlot(2), emptySlot(3), emptySlot(4)],
    viewport: '1280x720',
  }),
  createRoomFixture({
    id: 'c-room-host',
    title: '방장',
    description: '방장이 참가자 준비 상태를 확인합니다.',
    state: 'host',
    slots: [hostSlot, readyGuestSlot, emptySlot(3), emptySlot(4)],
    startDisabled: false,
    readyDisabled: true,
    viewport: '1440x900',
  }),
  createRoomFixture({
    id: 'c-room-guest',
    title: '게스트',
    description: '게스트가 준비 전 상태입니다.',
    state: 'guest',
    slots: [{ ...hostSlot, isLocal: false }, localGuestSlot, emptySlot(3), emptySlot(4)],
    startDisabled: true,
    viewport: '1440x900',
  }),
  createRoomFixture({
    id: 'c-room-empty-slot',
    title: '빈 자리',
    description: '빈 슬롯을 함께 표시합니다.',
    state: 'emptySlot',
    slots: [hostSlot, emptySlot(2), emptySlot(3), emptySlot(4)],
    startDisabled: true,
    readyDisabled: true,
    viewport: '1280x720',
  }),
  createRoomFixture({
    id: 'c-room-joined',
    title: '참가 완료',
    description: '입장 직후 ready 전 상태입니다.',
    state: 'joined',
    slots: [{ ...hostSlot, isLocal: false }, localGuestSlot, emptySlot(3), emptySlot(4)],
    viewport: '1440x900',
  }),
  createRoomFixture({
    id: 'c-room-ready',
    title: '준비 완료',
    description: '게스트가 준비 완료한 상태입니다.',
    state: 'ready',
    slots: [{ ...hostSlot, isLocal: false }, localReadyGuestSlot, emptySlot(3), emptySlot(4)],
    viewport: '1440x900',
  }),
  createRoomFixture({
    id: 'c-room-not-ready',
    title: '준비 전',
    description: '게스트가 아직 준비하지 않은 상태입니다.',
    state: 'notReady',
    slots: [{ ...hostSlot, isLocal: false }, localGuestSlot, guestSlot, emptySlot(4)],
    viewport: '1440x900',
  }),
  createRoomFixture({
    id: 'c-room-not-enough-players',
    title: '최소 인원 부족',
    description: '제작 시작을 막는 상태입니다.',
    state: 'notEnoughPlayers',
    slots: [hostSlot, emptySlot(2), emptySlot(3), emptySlot(4)],
    startDisabled: true,
    statusMessage: '최소 2명이 필요해요.',
    viewport: '1280x720',
  }),
  createRoomFixture({
    id: 'c-room-starting',
    title: '시작 중',
    description: '제작 시작 요청 중 layout shift를 막습니다.',
    state: 'starting',
    slots: [hostSlot, readyGuestSlot, emptySlot(3), emptySlot(4)],
    starting: true,
    viewport: '1440x900',
  }),
  createRoomFixture({
    id: 'c-room-player-left',
    title: '참가자 나감',
    description: '참가자 이탈 안내입니다.',
    state: 'playerLeft',
    slots: [hostSlot, emptySlot(2), emptySlot(3), emptySlot(4)],
    errorMessage: '참가자가 나갔어요.',
    viewport: '1280x720',
  }),
  createRoomFixture({
    id: 'c-room-offline',
    title: '방 오프라인',
    description: '방 실시간 연결이 끊긴 상태입니다.',
    state: 'offline',
    connectionStatus: 'offline',
    slots: [hostSlot, readyGuestSlot, emptySlot(3), emptySlot(4)],
    errorMessage: '방 실시간 연결이 끊어졌어요.',
    viewport: '1280x720',
  }),
  createRoomFixture({
    id: 'c-room-reconnecting',
    title: '방 재연결',
    description: '방 실시간 상태 재연결 중입니다.',
    state: 'reconnecting',
    connectionStatus: 'reconnecting',
    slots: [hostSlot, readyGuestSlot, emptySlot(3), emptySlot(4)],
    errorMessage: '방 상태를 다시 연결하고 있어요.',
    viewport: '1280x720',
  }),
]

export type RoomScreenFixtureId = (typeof roomScreenFixtures)[number]['id']

export function getRoomScreenFixture(id: string | undefined) {
  return roomScreenFixtures.find((fixture) => fixture.id === id) ?? roomScreenFixtures[0]
}

export function toRoomScreenProps(
  fixture: RoomScreenFixture,
  callbacks: Partial<RoomScreenCallbacks> = {},
): RoomScreenProps {
  return {
    state: fixture.state,
    roomName: fixture.roomName,
    roomId: fixture.roomId,
    currentNickname: fixture.currentNickname,
    slots: fixture.slots,
    connectionStatus: fixture.connectionStatus ?? 'online',
    readyDisabled: fixture.readyDisabled,
    startDisabled: fixture.startDisabled,
    starting: fixture.starting,
    errorMessage: fixture.errorMessage,
    statusMessage: fixture.statusMessage,
    onGoLobby: callbacks.onGoLobby ?? noop,
    onToggleReady: callbacks.onToggleReady ?? noop,
    onStartRoom: callbacks.onStartRoom ?? noop,
    onLeaveRoom: callbacks.onLeaveRoom ?? noop,
    onRetryConnection: callbacks.onRetryConnection ?? noop,
  }
}

function createRoomFixture(
  fixture: Omit<RoomScreenFixture, 'screenId' | 'roomName' | 'roomId' | 'currentNickname'> &
    Partial<Pick<RoomScreenFixture, 'roomName' | 'roomId' | 'currentNickname'>>,
): RoomScreenFixture {
  return {
    screenId: 'C_ROOM_LOBBY',
    roomName: fixture.roomName ?? '공개 릴레이 방',
    roomId: fixture.roomId ?? 'fixture-room',
    currentNickname: fixture.currentNickname ?? '나의닉네임',
    ...fixture,
  }
}

function noop() {
  return undefined
}

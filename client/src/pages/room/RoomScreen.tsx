import {
  Badge,
  ConnectionState,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../design-system/components'
import { Button, Inline, Stack } from '../../design-system/primitives'
import { LauncherShell } from '../../design-system/shells'
import styles from './RoomScreen.module.css'

export type RoomScreenState =
  | 'loading'
  | 'host'
  | 'guest'
  | 'emptySlot'
  | 'joined'
  | 'ready'
  | 'notReady'
  | 'notEnoughPlayers'
  | 'starting'
  | 'playerLeft'
  | 'offline'
  | 'reconnecting'
  | 'error'

export type RoomConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'error'

export interface RoomPlayerSlotViewModel {
  slotIndex: number
  state: 'empty' | 'joined' | 'ready' | 'host' | 'left'
  playerId?: string
  nickname?: string
  isHost?: boolean
  isLocal?: boolean
  isReady?: boolean
}

export interface RoomScreenCallbacks {
  onGoLobby: () => void
  onToggleReady: () => void
  onStartRoom: () => void
  onLeaveRoom: () => void
  onRetryConnection: () => void
}

export interface RoomScreenProps extends RoomScreenCallbacks {
  state: RoomScreenState
  roomName: string
  roomId: string
  currentNickname: string
  slots: RoomPlayerSlotViewModel[]
  connectionStatus: RoomConnectionStatus
  readyDisabled?: boolean
  startDisabled?: boolean
  starting?: boolean
  errorMessage?: string
  statusMessage?: string
}

export function RoomScreen({
  state,
  roomName,
  roomId,
  currentNickname,
  slots,
  connectionStatus,
  readyDisabled = false,
  startDisabled = false,
  starting = false,
  errorMessage,
  statusMessage,
  onGoLobby,
  onToggleReady,
  onStartRoom,
  onLeaveRoom,
  onRetryConnection,
}: RoomScreenProps) {
  const localSlot = slots.find((slot) => slot.isLocal)
  const isHost = localSlot?.isHost === true
  const isReady = localSlot?.isReady === true
  const playerCount = slots.filter((slot) => slot.state !== 'empty').length

  return (
    <LauncherShell
      className={styles.shell}
      title="멀티플레이 AI 릴레이 맵 메이커"
      subtitle="C Room"
      state={connectionStatus === 'offline' ? 'offline' : connectionStatus === 'reconnecting' ? 'reconnecting' : 'default'}
      status={<Badge state={getConnectionBadge(connectionStatus)} label={getConnectionLabel(connectionStatus)} />}
      primaryNav={
        <Button size="small" variant="secondary" onClick={onGoLobby}>
          로비로
        </Button>
      }
      actions={
        <Button size="small" variant="secondary" onClick={onLeaveRoom}>
          로비로 나가기
        </Button>
      }
      data-v2-screen="c-room"
      data-v2-state={state}
    >
      <div className={styles.screen} data-v2-component="room-screen" data-v2-state={state}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>방 대기실</p>
            <h2>{roomName}</h2>
            <p>
              {currentNickname}님, 준비가 끝나면 방장이 제작을 시작할 수 있어요.
            </p>
          </div>
          <dl className={styles.roomMeta} aria-label="방 정보">
            <div>
              <dt>방 ID</dt>
              <dd>{roomId}</dd>
            </div>
            <div>
              <dt>인원</dt>
              <dd>{playerCount}/{slots.length}</dd>
            </div>
          </dl>
        </header>

        {connectionStatus !== 'online' ? (
          <ConnectionState
            status={connectionStatus === 'error' ? 'server_unavailable' : connectionStatus}
            message={errorMessage}
            action={{ label: '다시 연결', onPress: onRetryConnection }}
          />
        ) : null}

        {state === 'loading' ? (
          <LoadingState label="방 대기실을 불러오는 중" message="참가자 상태를 동기화하고 있어요." />
        ) : null}

        {state === 'playerLeft' ? (
          <ErrorState title="참가자가 나갔어요." message="빈 자리가 생겼습니다. 준비 상태를 다시 확인해주세요." />
        ) : null}

        {state === 'error' ? (
          <ErrorState
            title="방 상태를 불러오지 못했어요."
            message={errorMessage ?? '잠시 후 다시 연결해주세요.'}
            action={{ label: '다시 연결', onPress: onRetryConnection }}
          />
        ) : null}

        <section className={styles.slotGrid} aria-label="참가자 슬롯">
          {slots.map((slot) => (
            <PlayerSlot key={slot.slotIndex} slot={slot} />
          ))}
        </section>

        <footer className={styles.controlPanel}>
          <Stack gap="small">
            <p className={styles.statusText} role="status" aria-live="polite">
              {statusMessage ?? getDefaultStatusMessage({ isHost, isReady, playerCount })}
            </p>
            {playerCount < 2 ? (
              <EmptyState
                title="최소 2명이 필요해요."
                message="다른 플레이어가 들어오면 제작을 시작할 수 있어요."
              />
            ) : null}
          </Stack>

          <Inline gap="small" justify="end">
            <Button
              variant="secondary"
              disabled={readyDisabled || connectionStatus !== 'online'}
              onClick={onToggleReady}
            >
              {isReady ? '준비 취소' : '준비'}
            </Button>
            <Button
              loading={starting}
              disabled={!isHost || startDisabled || connectionStatus !== 'online'}
              onClick={onStartRoom}
            >
              제작 시작
            </Button>
          </Inline>
        </footer>
      </div>
    </LauncherShell>
  )
}

export interface PlayerSlotProps {
  slot: RoomPlayerSlotViewModel
}

export function PlayerSlot({ slot }: PlayerSlotProps) {
  const occupied = slot.state !== 'empty'

  return (
    <article
      className={styles.playerSlot}
      data-v2-component="player-slot"
      data-v2-state={slot.state}
      data-v2-local={slot.isLocal === true ? 'true' : 'false'}
    >
      <div className={styles.avatarMark} aria-hidden="true">
        {occupied ? slot.nickname?.slice(0, 1) : ''}
      </div>
      <div className={styles.slotCopy}>
        <h3>{occupied ? slot.nickname : '빈 자리'}</h3>
        <Inline gap="small">
          {slot.isHost ? <Badge state="ready" label="방장" /> : null}
          {slot.isLocal ? <Badge state="queued" label="나" /> : null}
          {occupied ? (
            <Badge state={slot.isReady || slot.isHost ? 'ready' : 'queued'} label={slot.isReady || slot.isHost ? '준비됨' : '준비 전'} />
          ) : (
            <Badge state="offline" label="대기 중" />
          )}
        </Inline>
      </div>
    </article>
  )
}

function getConnectionBadge(status: RoomConnectionStatus) {
  if (status === 'online') {
    return 'ready'
  }

  if (status === 'reconnecting') {
    return 'reconnecting'
  }

  return 'offline'
}

function getConnectionLabel(status: RoomConnectionStatus) {
  const labels: Record<RoomConnectionStatus, string> = {
    online: '연결됨',
    offline: '오프라인',
    reconnecting: '재연결 중',
    error: '연결 오류',
  }

  return labels[status]
}

function getDefaultStatusMessage({
  isHost,
  isReady,
  playerCount,
}: {
  isHost: boolean
  isReady: boolean
  playerCount: number
}) {
  if (playerCount < 2) {
    return '최소 2명이 필요해요.'
  }

  if (isHost) {
    return '모두 준비되면 제작을 시작하세요.'
  }

  if (isReady) {
    return '방장이 시작할 때까지 기다려주세요.'
  }

  return '준비 버튼을 눌러 참가 상태를 알려주세요.'
}

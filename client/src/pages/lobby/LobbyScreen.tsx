import { useId } from 'react'

import {
  Badge,
  ConnectionState,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
} from '../../design-system/components'
import { Button, Inline, Stack } from '../../design-system/primitives'
import { LauncherShell } from '../../design-system/shells'
import styles from './LobbyScreen.module.css'

export type LobbyScreenState =
  | 'loading'
  | 'empty'
  | 'publicOpen'
  | 'privateOpen'
  | 'full'
  | 'playing'
  | 'error'
  | 'offline'
  | 'reconnecting'
  | 'passwordError'
  | 'quickJoinFailed'

export type LobbyConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'error'

export interface LobbyRoomViewModel {
  id: string
  name: string
  hostNickname: string
  isPublic: boolean
  players: number
  maxPlayers: number
  phase: 'lobby' | 'building' | 'validating' | 'merging' | 'racing' | 'finished'
  elapsedText: string
  state: 'open' | 'private' | 'full' | 'playing'
  disabledReason?: string
}

export interface LobbyCreateFormValue {
  name: string
  isPublic: boolean
  password: string
  maxPlayers: 2 | 3 | 4
}

export interface LobbyScreenCallbacks {
  onGoMain: () => void
  onRefreshRooms: () => void
  onQuickJoin: () => void
  onCreateRoomChange: (patch: Partial<LobbyCreateFormValue>) => void
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
  onOpenPassword: (roomId: string) => void
  onClosePassword: () => void
  onPasswordChange: (password: string) => void
  onSubmitPassword: () => void
}

export interface LobbyScreenProps extends LobbyScreenCallbacks {
  state: LobbyScreenState
  rooms: LobbyRoomViewModel[]
  createForm: LobbyCreateFormValue
  connectionStatus: LobbyConnectionStatus
  refreshing?: boolean
  creating?: boolean
  joiningRoomId?: string
  selectedPrivateRoom?: LobbyRoomViewModel
  passwordValue: string
  errorMessage?: string
}

export function LobbyScreen({
  state,
  rooms,
  createForm,
  connectionStatus,
  refreshing = false,
  creating = false,
  joiningRoomId,
  selectedPrivateRoom,
  passwordValue,
  errorMessage,
  onGoMain,
  onRefreshRooms,
  onQuickJoin,
  onCreateRoomChange,
  onCreateRoom,
  onJoinRoom,
  onOpenPassword,
  onClosePassword,
  onPasswordChange,
  onSubmitPassword,
}: LobbyScreenProps) {
  const visibleRooms = rooms
  const isLoading = state === 'loading'
  const isEmpty = state === 'empty' || (!isLoading && visibleRooms.length === 0)

  return (
    <LauncherShell
      className={styles.shell}
      title="멀티플레이 AI 릴레이 맵 메이커"
      subtitle="S3 Lobby"
      state={connectionStatus === 'offline' ? 'offline' : connectionStatus === 'reconnecting' ? 'reconnecting' : 'default'}
      status={<Badge state={getConnectionBadge(connectionStatus)} label={getConnectionLabel(connectionStatus)} />}
      primaryNav={
        <Button size="small" variant="secondary" onClick={onGoMain}>
          메인으로
        </Button>
      }
      actions={
        <Button
          size="small"
          loading={refreshing}
          disabled={connectionStatus === 'offline'}
          onClick={onRefreshRooms}
        >
          방 목록 새로고침
        </Button>
      }
      data-v2-screen="s3-lobby"
      data-v2-state={state}
    >
      <div className={styles.screen} data-v2-component="lobby-screen" data-v2-state={state}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>로비</p>
            <h2>같이 만들 방을 고르거나 새로 만들어요</h2>
            <p>공개방은 바로 입장하고, 비공개방은 비밀번호를 입력합니다.</p>
          </div>
          <Button disabled={connectionStatus === 'offline'} onClick={onQuickJoin}>
            공개방 빠른 입장
          </Button>
        </header>

        {connectionStatus !== 'online' ? (
          <ConnectionState
            status={connectionStatus === 'error' ? 'server_unavailable' : connectionStatus}
            message={errorMessage}
            action={connectionStatus === 'offline' ? { label: '방 목록 새로고침', onPress: onRefreshRooms } : undefined}
          />
        ) : null}

        {state === 'quickJoinFailed' ? (
          <ErrorState title="입장 가능한 공개방이 없습니다." message="방을 새로 만들거나 비공개방 정보를 확인해주세요." />
        ) : null}

        {state === 'error' ? (
          <ErrorState
            title="방 목록을 불러오지 못했어요."
            message={errorMessage ?? '잠시 후 다시 시도해주세요.'}
            action={{ label: '방 목록 새로고침', onPress: onRefreshRooms }}
          />
        ) : null}

        <div className={styles.layout}>
          <section className={styles.roomList} aria-label="방 목록">
            {isLoading ? (
              <LoadingState label="방 목록을 불러오는 중" message="로비 상태를 확인하고 있어요." />
            ) : isEmpty ? (
              <EmptyState title="입장 가능한 방이 없어요." message="새 방을 만들거나 새로고침해 주세요." />
            ) : (
              visibleRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  loading={joiningRoomId === room.id}
                  onJoinRoom={onJoinRoom}
                  onOpenPassword={onOpenPassword}
                />
              ))
            )}
          </section>

          <CreateRoomPanel
            value={createForm}
            creating={creating}
            disabled={connectionStatus === 'offline' || connectionStatus === 'reconnecting'}
            onChange={onCreateRoomChange}
            onCreate={onCreateRoom}
          />
        </div>
      </div>

      <PasswordModal
        room={selectedPrivateRoom}
        passwordValue={passwordValue}
        error={state === 'passwordError' ? errorMessage ?? '비밀번호를 확인해주세요.' : undefined}
        loading={Boolean(joiningRoomId)}
        onClose={onClosePassword}
        onPasswordChange={onPasswordChange}
        onSubmitPassword={onSubmitPassword}
      />
    </LauncherShell>
  )
}

export interface RoomCardProps {
  room: LobbyRoomViewModel
  loading?: boolean
  onJoinRoom: (roomId: string) => void
  onOpenPassword: (roomId: string) => void
}

export function RoomCard({ room, loading = false, onJoinRoom, onOpenPassword }: RoomCardProps) {
  const disabled = Boolean(room.disabledReason)

  return (
    <article
      className={styles.roomCard}
      data-v2-component="room-card"
      data-v2-state={room.state}
      data-v2-id={room.id}
    >
      <div className={styles.roomCardHeader}>
        <div>
          <h3>{room.name}</h3>
          <p>방장 {room.hostNickname}</p>
        </div>
        <Badge state={room.state === 'open' || room.state === 'private' ? 'ready' : 'queued'} label={getRoomStateLabel(room)} />
      </div>
      <dl className={styles.roomMeta}>
        <div>
          <dt>인원</dt>
          <dd>{room.players}/{room.maxPlayers}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{room.phase === 'lobby' ? '대기 중' : `게임 중 · ${room.elapsedText}`}</dd>
        </div>
      </dl>
      {room.disabledReason ? <p className={styles.disabledReason}>{room.disabledReason}</p> : null}
      <Button
        loading={loading}
        disabled={disabled}
        onClick={() => {
          if (room.isPublic) {
            onJoinRoom(room.id)
            return
          }

          onOpenPassword(room.id)
        }}
      >
        {room.isPublic ? '입장하기' : '비공개방 입장'}
      </Button>
    </article>
  )
}

export interface CreateRoomPanelProps {
  value: LobbyCreateFormValue
  creating: boolean
  disabled: boolean
  onChange: (patch: Partial<LobbyCreateFormValue>) => void
  onCreate: () => void
}

export function CreateRoomPanel({
  value,
  creating,
  disabled,
  onChange,
  onCreate,
}: CreateRoomPanelProps) {
  const nameId = useId()
  const passwordId = useId()

  return (
    <form
      className={styles.createPanel}
      aria-label="방 만들기"
      data-v2-component="create-room-panel"
      onSubmit={(event) => {
        event.preventDefault()
        onCreate()
      }}
    >
      <Stack gap="medium">
        <div>
          <p className={styles.eyebrow}>방 만들기</p>
          <h3>새 방을 엽니다</h3>
        </div>
        <label className={styles.field} htmlFor={nameId}>
          <span>방 이름</span>
          <input
            id={nameId}
            value={value.name}
            placeholder="방 이름"
            disabled={disabled || creating}
            onChange={(event) => onChange({ name: event.currentTarget.value })}
          />
        </label>
        <fieldset className={styles.optionGroup} disabled={disabled || creating}>
          <legend>공개 여부</legend>
          <label>
            <input
              type="radio"
              checked={value.isPublic}
              onChange={() => onChange({ isPublic: true })}
            />
            <span>공개방</span>
          </label>
          <label>
            <input
              type="radio"
              checked={!value.isPublic}
              onChange={() => onChange({ isPublic: false })}
            />
            <span>비공개방</span>
          </label>
        </fieldset>
        {!value.isPublic ? (
          <label className={styles.field} htmlFor={passwordId}>
            <span>비밀번호</span>
            <input
              id={passwordId}
              value={value.password}
              placeholder="비밀번호"
              disabled={disabled || creating}
              onChange={(event) => onChange({ password: event.currentTarget.value })}
            />
          </label>
        ) : null}
        <label className={styles.field}>
          <span>최대 인원</span>
          <select
            value={value.maxPlayers}
            disabled={disabled || creating}
            onChange={(event) => onChange({ maxPlayers: Number(event.currentTarget.value) as 2 | 3 | 4 })}
          >
            <option value={2}>2명</option>
            <option value={3}>3명</option>
            <option value={4}>4명</option>
          </select>
        </label>
        <Button type="submit" loading={creating} disabled={disabled || value.name.trim().length === 0}>
          {creating ? '방 만드는 중' : '방 만들기'}
        </Button>
      </Stack>
    </form>
  )
}

interface PasswordModalProps {
  room?: LobbyRoomViewModel
  passwordValue: string
  error?: string
  loading: boolean
  onClose: () => void
  onPasswordChange: (password: string) => void
  onSubmitPassword: () => void
}

function PasswordModal({
  room,
  passwordValue,
  error,
  loading,
  onClose,
  onPasswordChange,
  onSubmitPassword,
}: PasswordModalProps) {
  return (
    <Modal
      open={Boolean(room)}
      title="비공개방 입장"
      description={room ? `${room.name} 방에 입장합니다.` : undefined}
      onClose={onClose}
      footer={
        <Inline gap="small">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button loading={loading} onClick={onSubmitPassword}>
            입장하기
          </Button>
        </Inline>
      }
    >
      <label className={styles.field}>
        <span>비밀번호</span>
        <input
          value={passwordValue}
          placeholder="비밀번호"
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => onPasswordChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmitPassword()
            }
          }}
        />
      </label>
      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}

function getConnectionBadge(status: LobbyConnectionStatus) {
  if (status === 'online') {
    return 'ready'
  }

  if (status === 'reconnecting') {
    return 'reconnecting'
  }

  return 'offline'
}

function getConnectionLabel(status: LobbyConnectionStatus) {
  const labels: Record<LobbyConnectionStatus, string> = {
    online: '연결됨',
    offline: '오프라인',
    reconnecting: '재연결 중',
    error: '연결 오류',
  }

  return labels[status]
}

function getRoomStateLabel(room: LobbyRoomViewModel) {
  if (room.state === 'full') {
    return '정원 마감'
  }

  if (room.state === 'playing') {
    return `게임 중 · ${room.elapsedText}`
  }

  return room.isPublic ? '공개방' : '비공개방'
}

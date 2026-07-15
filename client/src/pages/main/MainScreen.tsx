import {
  Badge,
  Modal,
  TextField,
  Toast,
  type BadgeState,
} from '../../design-system/components'
import { Button, IconButton, Text } from '../../design-system/primitives'
import { LauncherShell } from '../../design-system/shells'
import styles from './MainScreen.module.css'

export type MainScreenState =
  | 'systemAvatar'
  | 'avatarGenerating'
  | 'avatarReady'
  | 'avatarFailed'
  | 'assetToast'
  | 'settingsOpen'

export type SettingsModalState =
  | 'default'
  | 'issuing'
  | 'issued'
  | 'expired'
  | 'invalid'
  | 'submitting'
  | 'serverError'

export type AvatarPanelState = 'system' | 'generating' | 'ready' | 'failed'

export interface MainAvatarViewModel {
  state: AvatarPanelState
  title: string
  description: string
  statusText: string
  sourceImageUrl?: string
  estimateText?: string
}

export interface SettingsValues {
  bgmVolume: number
  sfxVolume: number
  muted: boolean
  nickname: string
  issuedCode?: string
  deviceCodeInput: string
}

export interface MainScreenCallbacks {
  onNavigateLobby: () => void
  onOpenAssetStudio: () => void
  onOpenWarehouse: (tab: 'avatar' | 'component') => void
  onOpenSettings: () => void
  onCloseSettings: () => void
  onDismissAssetToast: () => void
  onChangeBgmVolume: (value: number) => void
  onChangeSfxVolume: (value: number) => void
  onToggleMute: (muted: boolean) => void
  onChangeNickname: (nickname: string) => void
  onSaveNickname: (nickname: string) => void
  onIssueDeviceCode: () => void
  onChangeDeviceCode: (code: string) => void
  onConsumeDeviceCode: (code: string) => void
}

export interface MainScreenProps extends MainScreenCallbacks {
  state: MainScreenState
  nickname: string
  avatar: MainAvatarViewModel
  assetSummary: {
    total: number
    ready: number
    working: number
    failed: number
  }
  settingsOpen: boolean
  settingsState: SettingsModalState
  settingsValues: SettingsValues
}

export function MainScreen({
  state,
  nickname,
  avatar,
  assetSummary,
  settingsOpen,
  settingsState,
  settingsValues,
  onNavigateLobby,
  onOpenAssetStudio,
  onOpenWarehouse,
  onOpenSettings,
  onCloseSettings,
  onDismissAssetToast,
  onChangeBgmVolume,
  onChangeSfxVolume,
  onToggleMute,
  onChangeNickname,
  onSaveNickname,
  onIssueDeviceCode,
  onChangeDeviceCode,
  onConsumeDeviceCode,
}: MainScreenProps) {
  const showAssetToast = state === 'assetToast'
  const modalOpen = settingsOpen || state === 'settingsOpen'

  return (
    <LauncherShell
      className={styles.shell}
      title="멀티플레이 AI 릴레이 맵 메이커"
      subtitle="S2 Main"
      state="default"
      status={<Badge state="ready" label={`환영해요, ${nickname}`} />}
      actions={
        <IconButton
          icon={<SettingsIcon />}
          aria-label="설정 열기"
          onClick={onOpenSettings}
          data-v2-component="settings-open-button"
        />
      }
      toastLayer={
        showAssetToast ? (
          <Toast
            tone="success"
            title="에셋 요청을 받았어요"
            message="창고에서 진행 상황을 확인할 수 있어요."
            action={{ label: '창고에서 진행 상황 보기', onPress: () => onOpenWarehouse('component') }}
            onDismiss={onDismissAssetToast}
          />
        ) : undefined
      }
      data-v2-screen="s2-main"
      data-v2-state={state}
    >
      <div className={styles.layout} data-v2-component="main-screen" data-v2-state={state}>
        <section className={styles.hero} aria-labelledby="s2-main-title">
          <p className={styles.eyebrow}>메인</p>
          <h2 id="s2-main-title">릴레이 맵 제작을 시작해요</h2>
          <p>아바타를 확인하고, 게임에 들어가거나 새 에셋을 만들 수 있어요.</p>
          <div className={styles.ctaGrid}>
            <Button size="large" onClick={onNavigateLobby} data-v2-component="main-game-cta">
              게임하기
            </Button>
            <Button
              size="large"
              variant="secondary"
              onClick={onOpenAssetStudio}
              data-v2-component="main-asset-cta"
            >
              에셋 만들기
            </Button>
            <Button
              size="large"
              variant="secondary"
              onClick={() => onOpenWarehouse('avatar')}
              data-v2-component="main-warehouse-cta"
            >
              내 창고
            </Button>
          </div>
        </section>

        <AvatarPanel avatar={avatar} onOpenWarehouse={() => onOpenWarehouse('avatar')} />

        <section className={styles.summaryPanel} aria-labelledby="s2-main-summary-title">
          <div>
            <p className={styles.eyebrow}>창고 요약</p>
            <h3 id="s2-main-summary-title">내가 만든 에셋 {assetSummary.total}개</h3>
          </div>
          <dl className={styles.summaryGrid}>
            <div>
              <dt>사용 가능</dt>
              <dd>{assetSummary.ready}</dd>
            </div>
            <div>
              <dt>작업 중</dt>
              <dd>{assetSummary.working}</dd>
            </div>
            <div>
              <dt>실패</dt>
              <dd>{assetSummary.failed}</dd>
            </div>
          </dl>
        </section>
      </div>

      <SettingsModal
        open={modalOpen}
        state={settingsState}
        values={settingsValues}
        onClose={onCloseSettings}
        onChangeBgmVolume={onChangeBgmVolume}
        onChangeSfxVolume={onChangeSfxVolume}
        onToggleMute={onToggleMute}
        onChangeNickname={onChangeNickname}
        onSaveNickname={onSaveNickname}
        onIssueDeviceCode={onIssueDeviceCode}
        onChangeDeviceCode={onChangeDeviceCode}
        onConsumeDeviceCode={onConsumeDeviceCode}
      />
    </LauncherShell>
  )
}

interface AvatarPanelProps {
  avatar: MainAvatarViewModel
  onOpenWarehouse: () => void
}

function AvatarPanel({ avatar, onOpenWarehouse }: AvatarPanelProps) {
  const hasSourceImage = typeof avatar.sourceImageUrl === 'string' && avatar.sourceImageUrl.length > 0

  return (
    <button
      className={styles.avatarPanel}
      type="button"
      data-v2-component="avatar-panel"
      data-v2-state={avatar.state}
      data-has-source-image={hasSourceImage ? 'true' : 'false'}
      onClick={onOpenWarehouse}
    >
      <div
        className={styles.avatarPreview}
        aria-hidden="true"
        data-state={avatar.state}
        data-has-source-image={hasSourceImage ? 'true' : 'false'}
      >
        {hasSourceImage ? (
          <img className={styles.avatarImage} src={avatar.sourceImageUrl} alt="" aria-hidden="true" />
        ) : (
          <span />
        )}
      </div>
      <div className={styles.avatarCopy}>
        <Text variant="caption" tone="secondary" weight="bold">
          장착한 아바타
        </Text>
        <h3>{avatar.title}</h3>
        <p>{avatar.description}</p>
        <Badge state={getAvatarBadgeState(avatar.state)} label={avatar.statusText} />
        {avatar.estimateText ? <span className={styles.estimate}>{avatar.estimateText}</span> : null}
      </div>
    </button>
  )
}

interface SettingsModalProps {
  open: boolean
  state: SettingsModalState
  values: SettingsValues
  onClose: () => void
  onChangeBgmVolume: (value: number) => void
  onChangeSfxVolume: (value: number) => void
  onToggleMute: (muted: boolean) => void
  onChangeNickname: (nickname: string) => void
  onSaveNickname: (nickname: string) => void
  onIssueDeviceCode: () => void
  onChangeDeviceCode: (code: string) => void
  onConsumeDeviceCode: (code: string) => void
}

function SettingsModal({
  open,
  state,
  values,
  onClose,
  onChangeBgmVolume,
  onChangeSfxVolume,
  onToggleMute,
  onChangeNickname,
  onSaveNickname,
  onIssueDeviceCode,
  onChangeDeviceCode,
  onConsumeDeviceCode,
}: SettingsModalProps) {
  const isBusy = state === 'issuing' || state === 'submitting'
  const deviceError = getDeviceError(state)

  return (
    <Modal
      open={open}
      title="설정"
      description="소리, 닉네임, 기기 연동을 관리합니다."
      size="medium"
      onClose={onClose}
    >
      <div className={styles.settings} data-v2-component="settings-modal" data-v2-state={state}>
        <section className={styles.settingsSection} aria-labelledby="s2c-sound-title">
          <h3 id="s2c-sound-title">소리</h3>
          <VolumeField
            id="s2c-bgm-volume"
            label="BGM 볼륨"
            value={values.bgmVolume}
            disabled={values.muted}
            onChange={onChangeBgmVolume}
          />
          <VolumeField
            id="s2c-sfx-volume"
            label="효과음 볼륨"
            value={values.sfxVolume}
            disabled={values.muted}
            onChange={onChangeSfxVolume}
          />
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={values.muted}
              onChange={(event) => onToggleMute(event.currentTarget.checked)}
            />
            <span>음소거</span>
          </label>
        </section>

        <section className={styles.settingsSection} aria-labelledby="s2c-nickname-title">
          <h3 id="s2c-nickname-title">닉네임 변경</h3>
          <TextField
            label="닉네임"
            value={values.nickname}
            placeholder="1~12자"
            disabled={isBusy}
            loading={state === 'submitting'}
            helper="닉네임은 저장해도 같은 계정을 유지합니다."
            onChange={onChangeNickname}
            onSubmit={onSaveNickname}
          />
          <Button
            variant="secondary"
            loading={state === 'submitting'}
            disabled={isBusy}
            onClick={() => onSaveNickname(values.nickname)}
            data-v2-component="settings-nickname-save"
          >
            닉네임 저장
          </Button>
        </section>

        <section className={styles.settingsSection} aria-labelledby="s2c-device-title">
          <h3 id="s2c-device-title">기기 연동</h3>
          <div className={styles.deviceActions}>
            <Button
              loading={state === 'issuing'}
              disabled={isBusy}
              onClick={onIssueDeviceCode}
              data-v2-component="settings-issue-code"
            >
              연동 코드 발급
            </Button>
            {values.issuedCode ? (
              <div className={styles.issuedCode} data-v2-component="settings-issued-code">
                <span>연동 코드</span>
                <strong>{values.issuedCode}</strong>
                <p>{state === 'expired' ? '만료된 코드예요. 새 코드를 발급해주세요.' : '5분 안에 다른 기기에서 입력해주세요.'}</p>
              </div>
            ) : null}
          </div>
          <TextField
            label="연동 코드 입력"
            value={values.deviceCodeInput}
            placeholder="예: TIGER-3392"
            error={deviceError}
            disabled={isBusy}
            onChange={onChangeDeviceCode}
            onSubmit={onConsumeDeviceCode}
          />
          <Button
            variant="secondary"
            loading={state === 'submitting'}
            disabled={isBusy || values.deviceCodeInput.trim().length === 0}
            onClick={() => onConsumeDeviceCode(values.deviceCodeInput)}
            data-v2-component="settings-consume-code"
          >
            코드로 불러오기
          </Button>
        </section>
      </div>
    </Modal>
  )
}

interface VolumeFieldProps {
  id: string
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}

function VolumeField({ id, label, value, disabled = false, onChange }: VolumeFieldProps) {
  return (
    <label className={styles.volumeField} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <output htmlFor={id}>{value}</output>
    </label>
  )
}

function getAvatarBadgeState(state: AvatarPanelState): BadgeState {
  if (state === 'ready') {
    return 'ready'
  }

  if (state === 'generating') {
    return 'generating'
  }

  if (state === 'failed') {
    return 'failed'
  }

  return 'ready'
}

function getDeviceError(state: SettingsModalState) {
  if (state === 'invalid') {
    return '사용할 수 없는 코드예요.'
  }

  if (state === 'expired') {
    return '만료된 코드예요. 새 코드를 발급해주세요.'
  }

  if (state === 'serverError') {
    return '시작할 수 없어요. 다시 시도해주세요.'
  }

  return undefined
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path
        fill="currentColor"
        d="M11.3 2.5h-2l-.4 2a5.6 5.6 0 0 0-1.2.5L6 3.9 4.6 5.3l1.1 1.7c-.2.4-.4.8-.5 1.2l-2 .4v2l2 .4c.1.4.3.8.5 1.2l-1.1 1.7L6 15.3l1.7-1.1c.4.2.8.4 1.2.5l.4 2h2l.4-2c.4-.1.8-.3 1.2-.5l1.7 1.1 1.4-1.4-1.1-1.7c.2-.4.4-.8.5-1.2l2-.4v-2l-2-.4a5.6 5.6 0 0 0-.5-1.2L16 5.3l-1.4-1.4-1.7 1.1a5.6 5.6 0 0 0-1.2-.5l-.4-2ZM10.3 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
      />
    </svg>
  )
}

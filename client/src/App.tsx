import {
  Fragment,
  useEffect,
  useCallback,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  ReactSketchCanvas,
  type CanvasPath,
  type ReactSketchCanvasRef,
} from 'react-sketch-canvas'
import './App.css'
import { useAppStore } from './store/appStore'
import { createClientId } from './utils/id'
import type {
  AppView,
  Asset,
  AssetCategory,
  DeviceLinkTicket,
  MapPlacement,
  MapPoint,
  MapSegmentAssetSnapshot,
  MapSegmentSnapshot,
  RacePositionSnapshot,
  RoomPhase,
  RoomPlayer,
  RoomSummary,
} from './types/domain'

const TILE_PX = 64
const AVATAR_CANVAS = { width: 256, height: 512 }
const SKETCH_WORKSPACE_SCALE = 3
const EDITOR_BOARD = { cols: 24, rows: 10 }
const BUILD_PLACEMENT_BUDGET = 40
const MAP_ASSET_DRAG_TYPE = 'application/x-relay-map-asset'
const MAX_ENDPOINT_VERTICAL_DELTA = 4
const MapEditorCanvas = lazy(() => import('./game/MapEditorCanvas'))
const PlaytestCanvas = lazy(() => import('./game/PlaytestCanvas'))
const RaceCanvas = lazy(() => import('./game/RaceCanvas'))
const REGEN_COOLDOWN_MS = 5 * 60 * 1000
const ASSET_GENERATION_ESTIMATE_MS = 4 * 60 * 1000
const STUDIO_LAYOUT_KEY = 'relay.studioLayout'
const STUDIO_LEFT_PANEL_MIN = 220
const STUDIO_LEFT_PANEL_MAX = 380
const STUDIO_RIGHT_PANEL_MIN = 240
const STUDIO_RIGHT_PANEL_MAX = 420
const STUDIO_PANEL_SECTION_MIN_RATIO = 16
const DEFAULT_STUDIO_PANEL_SECTION_RATIOS = {
  tools: 34,
  palette: 38,
  side: 28,
}
const palette = [
  '#000000',
  '#111827',
  '#374151',
  '#6b7280',
  '#9ca3af',
  '#d1d5db',
  '#f3f4f6',
  '#ffffff',
  '#450a0a',
  '#7f1d1d',
  '#991b1b',
  '#b91c1c',
  '#dc2626',
  '#ef4444',
  '#f87171',
  '#fca5a5',
  '#431407',
  '#7c2d12',
  '#9a3412',
  '#c2410c',
  '#ea580c',
  '#f97316',
  '#fb923c',
  '#fed7aa',
  '#422006',
  '#713f12',
  '#854d0e',
  '#a16207',
  '#ca8a04',
  '#f6be00',
  '#facc15',
  '#fef08a',
  '#052e16',
  '#14532d',
  '#166534',
  '#15803d',
  '#16a34a',
  '#43a047',
  '#4ade80',
  '#86efac',
  '#1a2e05',
  '#365314',
  '#4d7c0f',
  '#65a30d',
  '#84cc16',
  '#a3e635',
  '#bef264',
  '#d9f99d',
  '#042f2e',
  '#134e4a',
  '#0f766e',
  '#0d9488',
  '#14b8a6',
  '#2dd4bf',
  '#5eead4',
  '#99f6e4',
  '#164e63',
  '#155e75',
  '#0e7490',
  '#0891b2',
  '#06b6d4',
  '#22d3ee',
  '#67e8f9',
  '#a5f3fc',
  '#172554',
  '#1e3a8a',
  '#1d4ed8',
  '#2563eb',
  '#3b82f6',
  '#4a9de0',
  '#93c5fd',
  '#bfdbfe',
  '#312e81',
  '#3730a3',
  '#4338ca',
  '#4f46e5',
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#c7d2fe',
  '#3b0764',
  '#581c87',
  '#6b21a8',
  '#7e22ce',
  '#9333ea',
  '#a855f7',
  '#c084fc',
  '#e9d5ff',
  '#500724',
  '#831843',
  '#9d174d',
  '#be185d',
  '#db2777',
  '#ec4899',
  '#f472b6',
  '#fbcfe8',
  '#451a03',
  '#78350f',
  '#8b5a2b',
  '#92400e',
  '#9a6a2f',
  '#b45309',
  '#d97706',
  '#f59e0b',
  '#020617',
  '#0f172a',
  '#1e293b',
  '#334155',
  '#475569',
  '#64748b',
  '#94a3b8',
  '#e2e8f0',
  '#1c1917',
  '#292524',
  '#44403c',
  '#57534e',
  '#78716c',
  '#a8a29e',
  '#d6d3d1',
  '#fafaf9',
]
const MOVE_NUDGE_PX = 8

type StudioCategory = Exclude<AssetCategory, 'avatar' | 'item'>
type WarehouseComponentCategory = Exclude<AssetCategory, 'avatar' | 'item'>
type AssetAttrValue = string | number | boolean | null
type AssetAttrRecord = Record<string, AssetAttrValue>
type SketchTool = 'pen' | 'eraser' | 'eyedropper' | 'move'
type StudioPanelSectionBoundary = 'tools-palette' | 'palette-side'

interface AttrChoice {
  label: string
  value: string
}

interface AttrGroup {
  key: string
  label: string
  choices: AttrChoice[]
}

interface StudioLayoutPreference {
  leftPanelWidth: number
  rightPanelWidth: number
  isToolPanelCollapsed: boolean
  isPropertiesPanelCollapsed: boolean
  leftSectionRatios: StudioPanelSectionRatios
}

interface StudioPanelSectionRatios {
  tools: number
  palette: number
  side: number
}

interface BuildTimeVoteState {
  deltaSeconds: number
  voterIds: string[]
  approved: boolean
  applied: boolean
}

type MapEditorTool = 'select' | 'place' | 'move' | 'erase' | 'start' | 'goal'

const viewLabels: Record<AppView, string> = {
  main: '메인',
  avatar: '아바타 제작',
  studio: '에셋 스튜디오',
  warehouse: '내 창고',
  lobby: '로비',
  room: '방',
}

const categoryLabels: Record<AssetCategory, string> = {
  avatar: '아바타',
  platform: '플랫폼',
  obstacle: '장애물',
  monster: '몬스터',
  background: '배경',
  item: '아이템',
}

const studioCategories: StudioCategory[] = ['platform', 'obstacle', 'monster', 'background']

const mapEditorToolLabels: Record<MapEditorTool, string> = {
  select: '선택',
  place: '배치',
  move: '이동',
  erase: '삭제',
  start: '시작점',
  goal: '끝점',
}

const attrGroupsByCategory: Record<StudioCategory, AttrGroup[]> = {
  platform: [
    {
      key: 'collisionMode',
      label: '충돌 방식',
      choices: [
        { label: '완전 충돌', value: 'solid' },
        { label: '윗면만 충돌', value: 'one-way-up' },
        { label: '특정 면만 충돌', value: 'one-way-directed' },
      ],
    },
    {
      key: 'materialization',
      label: '실체화 조건',
      choices: [
        { label: '항상 실체', value: 'always' },
        { label: '아래서 치면 실체화', value: 'hidden-on-hit' },
        { label: '스위치 ON 실체', value: 'switch-on' },
        { label: '스위치 OFF 실체', value: 'switch-off' },
        { label: '주기 점멸', value: 'blink-normal' },
      ],
    },
    {
      key: 'movementMode',
      label: '이동 방식',
      choices: [
        { label: '고정', value: 'fixed' },
        { label: '경로 왕복', value: 'patrol-normal' },
        { label: '밟으면 이동 시작', value: 'start-on-step' },
        { label: '밟으면 한 방향 이동', value: 'step-one-way' },
      ],
    },
    {
      key: 'shape',
      label: '모양',
      choices: [
        { label: '사각형', value: 'rectangle' },
        { label: '경사 바닥 ◢', value: 'slope-floor-asc' },
        { label: '경사 바닥 ◣', value: 'slope-floor-desc' },
      ],
    },
    {
      key: 'surfaceEffect',
      label: '표면 효과',
      choices: [
        { label: '없음', value: 'none' },
        { label: '미끄러움', value: 'slippery' },
        { label: '컨베이어 보통', value: 'conveyor-normal' },
        { label: '밟으면 튕김', value: 'bounce-high' },
        { label: '밟으면 가속', value: 'speed-boost' },
      ],
    },
    {
      key: 'contactReaction',
      label: '접촉 반응',
      choices: [
        { label: '없음', value: 'none' },
        { label: '2초 후 낙하', value: 'fall-after-touch' },
        { label: '2초 후 소멸', value: 'break-after-touch' },
      ],
    },
  ],
  obstacle: [
    {
      key: 'contactEffect',
      label: '접촉 효과',
      choices: [
        { label: '대미지', value: 'damage' },
        { label: '즉사', value: 'instant-death' },
        { label: '튕겨냄', value: 'knockback-high' },
        { label: '상승 기류', value: 'updraft' },
      ],
    },
    {
      key: 'hitSurface',
      label: '접촉 판정',
      choices: [
        { label: '전체', value: 'all' },
        { label: '상면 제외', value: 'top-safe' },
        { label: '하면만', value: 'bottom-only' },
      ],
    },
    {
      key: 'triggerMode',
      label: '발동 트리거',
      choices: [
        { label: '상시 활성', value: 'always' },
        { label: '주기 돌출/후퇴', value: 'cycle-normal' },
        { label: 'x축 접근 감지', value: 'proximity-x' },
        { label: 'y축 접근 감지', value: 'proximity-y' },
        { label: '반경 접근 감지', value: 'proximity-radius' },
      ],
    },
    {
      key: 'actionMode',
      label: '동작 방식',
      choices: [
        { label: '고정', value: 'fixed' },
        { label: '제자리 회전', value: 'rotate-normal' },
        { label: '진자 스윙', value: 'swing' },
        { label: '경로 왕복', value: 'patrol-normal' },
        { label: '감지 시 돌진', value: 'charge-down' },
      ],
    },
    {
      key: 'projectile',
      label: '발사체',
      choices: [
        { label: '없음', value: 'none' },
        { label: '직선 발사', value: 'straight-normal' },
        { label: '유도 발사', value: 'homing-normal' },
      ],
    },
  ],
  monster: [
    {
      key: 'moveType',
      label: '이동 유형',
      choices: [
        { label: '고정', value: 'static' },
        { label: '지상 보행', value: 'ground-walk-normal' },
        { label: '벽·천장 표면 타기', value: 'surface-crawl' },
        { label: '공중 부유/비행', value: 'flying' },
      ],
    },
    {
      key: 'tracking',
      label: '추적 방식',
      choices: [
        { label: '추적 안 함', value: 'none' },
        { label: '감지 거리 활성화', value: 'near' },
        { label: '상시 추적', value: 'always' },
        { label: '보면 정지', value: 'gaze-freeze' },
        { label: '점프 동기화', value: 'jump-sync' },
      ],
    },
    {
      key: 'ledgeBehavior',
      label: '절벽 반응',
      choices: [
        { label: '그대로 낙하', value: 'fall' },
        { label: '방향 전환', value: 'turn' },
      ],
    },
    {
      key: 'stompReaction',
      label: '밟기 반응',
      choices: [
        { label: '즉사', value: 'kill' },
        { label: '기절 후 부활', value: 'stun-normal' },
        { label: '밟기 불가', value: 'harmful' },
        { label: '트램펄린화', value: 'trampoline' },
      ],
    },
    {
      key: 'health',
      label: '생명력',
      choices: [
        { label: '1', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
      ],
    },
  ],
  background: [
    {
      key: 'renderMode',
      label: '표현 방식',
      choices: [{ label: '순수 장식', value: 'decorative-static' }],
    },
  ],
}

const phaseLabels: Record<RoomPhase, string> = {
  lobby: '대기 중',
  building: '제작 중',
  validating: '검증 중',
  merging: '병합 중',
  racing: '게임 중',
  finished: '종료',
}

function App() {
  const session = useAppStore((state) => state.session)
  const isLoading = useAppStore((state) => state.isLoading)
  const boot = useAppStore((state) => state.boot)
  const tickMockGeneration = useAppStore((state) => state.tickMockGeneration)
  const tickRoomElapsed = useAppStore((state) => state.tickRoomElapsed)

  useEffect(() => {
    void boot()
  }, [boot])

  useEffect(() => {
    if (session === null) {
      return undefined
    }

    tickMockGeneration()
    tickRoomElapsed()
    const intervalId = window.setInterval(() => {
      tickMockGeneration()
      tickRoomElapsed()
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [session, tickMockGeneration, tickRoomElapsed])

  if (isLoading && session === null) {
    return <div className="app-loading">불러오는 중</div>
  }

  if (session === null) {
    return <LoginScreen />
  }

  return <GameMakerApp />
}

function LoginScreen() {
  const login = useAppStore((state) => state.login)
  const isLoading = useAppStore((state) => state.isLoading)
  const [nickname, setNickname] = useState('')
  const trimmedNickname = nickname.trim()
  const canSubmit = trimmedNickname.length >= 1 && trimmedNickname.length <= 12

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    await login(trimmedNickname)
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="brand-band">Relay Map Maker</div>
        <h1>닉네임으로 시작</h1>
        <label className="field">
          <span>닉네임</span>
          <input
            value={nickname}
            maxLength={12}
            autoFocus
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <button className="primary-action" type="submit" disabled={!canSubmit || isLoading}>
          {isLoading ? '접속 중' : '시작하기'}
        </button>
      </form>
    </main>
  )
}

function GameMakerApp() {
  const view = useAppStore((state) => state.view)
  const session = useAppStore((state) => state.session)
  const navigate = useAppStore((state) => state.navigate)
  const logout = useAppStore((state) => state.logout)
  const apiSource = useAppStore((state) => state.apiSource)
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => navigate('main')}>
          Relay Map Maker
        </button>
        <nav className="topnav" aria-label="주요 화면">
          {(Object.keys(viewLabels) as AppView[]).map((targetView) => (
            <button
              key={targetView}
              type="button"
              className={view === targetView ? 'is-active' : ''}
              onClick={() => navigate(targetView)}
            >
              {viewLabels[targetView]}
            </button>
          ))}
        </nav>
        <div className="user-strip">
          <span>{session?.nickname}</span>
          <span className="source-pill">{apiSource === 'api' ? 'API' : 'Mock'}</span>
          <button type="button" className="icon-action" onClick={() => setSettingsOpen(true)}>
            설정
          </button>
          <button type="button" className="subtle-action" onClick={logout}>
            나가기
          </button>
        </div>
      </header>

      {view === 'main' ? <MainDashboard /> : null}
      {view === 'avatar' ? <AvatarStudio /> : null}
      {view === 'studio' ? <AssetStudio /> : null}
      {view === 'warehouse' ? <Warehouse /> : null}
      {view === 'lobby' ? <Lobby /> : null}
      {view === 'room' ? <RoomFlow /> : null}

      {isSettingsOpen ? <SettingsModal /> : null}
    </main>
  )
}

function MainDashboard() {
  const session = useAppStore((state) => state.session)
  const assets = useAppStore((state) => state.assets)
  const navigate = useAppStore((state) => state.navigate)
  const openWarehouse = useAppStore((state) => state.openWarehouse)
  const workingAssets = assets.filter(isAssetWorking)
  const failedAssets = assets.filter((asset) => asset.status === 'failed')
  const equippedAvatar = assets.find((asset) => asset.id === session?.avatarAssetId)
  const latestAvatar = assets.find(
    (asset) => asset.category === 'avatar' && !asset.isSystem && asset.status === 'ready',
  )
  const pendingAvatar = workingAssets.find((asset) => asset.category === 'avatar')
  const failedAvatar = failedAssets.find((asset) => asset.category === 'avatar')

  return (
    <section className="screen main-grid">
      <div className="hero-band">
        <div>
          <p className="eyebrow">AI Relay Platformer</p>
          <h1>만들고, 검증하고, 이어 달리는 맵 제작 레이스</h1>
        </div>
        <div className="main-actions">
          <button type="button" className="primary-action" onClick={() => navigate('lobby')}>
            게임하기
          </button>
          <button type="button" className="secondary-action" onClick={() => navigate('studio')}>
            에셋 만들기
          </button>
          <button type="button" className="secondary-action" onClick={() => openWarehouse('component')}>
            내 창고
          </button>
        </div>
      </div>

      <button type="button" className="avatar-panel" onClick={() => openWarehouse('avatar')}>
        <AssetPreview asset={equippedAvatar ?? latestAvatar ?? null} size="large" />
        <div>
          <span className="eyebrow">장착 아바타</span>
          <h2>{equippedAvatar?.name ?? latestAvatar?.name ?? '졸라맨'}</h2>
          <p>
            {pendingAvatar
              ? `${pendingAvatar.name} ${assetProgressLabel(pendingAvatar)}`
              : failedAvatar
                ? `${failedAvatar.name} 생성 실패 · 창고에서 다시 시도`
              : '클릭하면 아바타 창고로 이동'}
          </p>
        </div>
      </button>

      <div className="status-grid">
        <MetricCard label="내 에셋" value={String(assets.filter((asset) => !asset.isSystem).length)} />
        <MetricCard label="생성 중" value={String(workingAssets.length)} />
        <MetricCard label="실패" value={String(failedAssets.length)} />
        <MetricCard label="기본 에셋" value={String(assets.filter((asset) => asset.isSystem).length)} />
      </div>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function usePhaseTimer(
  initialSeconds: number,
  onExpire: () => void,
  externalRemainingMs?: number | null,
) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds)
  const onExpireRef = useRef(onExpire)
  const hasExpiredRef = useRef(false)
  const hasExternalTimer = externalRemainingMs !== undefined && externalRemainingMs !== null
  const externalRemainingSeconds =
    hasExternalTimer ? Math.ceil(Math.max(0, externalRemainingMs) / 1000) : null

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (hasExternalTimer) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true
            window.setTimeout(() => onExpireRef.current(), 0)
          }

          return 0
        }

        return currentSeconds - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [hasExternalTimer])

  useEffect(() => {
    if (!hasExternalTimer || externalRemainingSeconds === null || externalRemainingSeconds > 0) {
      return
    }

    if (!hasExpiredRef.current) {
      hasExpiredRef.current = true
      window.setTimeout(() => onExpireRef.current(), 0)
    }
  }, [externalRemainingSeconds, hasExternalTimer])

  const adjustSeconds = (deltaSeconds: number) => {
    setRemainingSeconds((currentSeconds) => Math.max(0, currentSeconds + deltaSeconds))
  }

  return { remainingSeconds: externalRemainingSeconds ?? remainingSeconds, adjustSeconds }
}

function AvatarStudio() {
  const submitAsset = useAppStore((state) => state.submitAsset)
  const assets = useAppStore((state) => state.assets)
  const session = useAppStore((state) => state.session)
  const equipAvatar = useAppStore((state) => state.equipAvatar)
  const studioSourceAssetId = useAppStore((state) => state.studioSourceAssetId)
  const clearStudioSourceAsset = useAppStore((state) => state.clearStudioSourceAsset)
  const navigate = useAppStore((state) => state.navigate)
  const isLoading = useAppStore((state) => state.isLoading)
  const [description, setDescription] = useState('')
  const [name, setName] = useState('새 아바타')
  const [remixSource, setRemixSource] = useState<Asset | null>(null)
  const [hasEditedLoadedAsset, setHasEditedLoadedAsset] = useState(false)
  const canSubmit = !isLoading && (remixSource === null || hasEditedLoadedAsset)
  const myAvatars = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === 'avatar' && asset.creatorId === session?.id)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [assets, session?.id],
  )

  const loadAvatarSource = useCallback((sourceAsset: Asset) => {
    setName(`${sourceAsset.name} 리믹스`)
    setDescription(sourceAsset.description)
    setRemixSource(sourceAsset)
    setHasEditedLoadedAsset(false)
  }, [])

  useEffect(() => {
    if (studioSourceAssetId === null) {
      return
    }

    const sourceAsset = assets.find(
      (asset) => asset.id === studioSourceAssetId && asset.category === 'avatar',
    )

    if (sourceAsset === undefined) {
      clearStudioSourceAsset()
      return
    }

    loadAvatarSource(sourceAsset)
    clearStudioSourceAsset()
  }, [assets, clearStudioSourceAsset, loadAvatarSource, studioSourceAssetId])

  const markLoadedAssetEdited = () => {
    if (remixSource !== null) {
      setHasEditedLoadedAsset(true)
    }
  }

  const handleSubmit = async (image: string) => {
    if (!canSubmit) {
      return
    }

    await submitAsset({
      category: 'avatar',
      name: name.trim() || '새 아바타',
      description,
      image,
      attrs: { canvas: 'avatar-1x2' },
      widthCells: null,
      heightCells: null,
      remixOfId: remixSource?.id ?? null,
    })
  }

  return (
    <section className="screen studio-screen">
      <SketchBoard
        title="아바타 생성"
        width={AVATAR_CANVAS.width}
        height={AVATAR_CANVAS.height}
        submitLabel={isLoading ? '제출 중' : '생성하기'}
        disabled={!canSubmit}
        referenceImage={remixSource?.sourceImageUrl || undefined}
        onEdited={markLoadedAssetEdited}
        onSubmit={handleSubmit}
        sidePanel={
          <div className="panel-stack">
            {remixSource !== null ? (
              <div className="remix-banner">
                <span>불러온 아바타</span>
                <strong>{remixSource.name}</strong>
                <small>{hasEditedLoadedAsset ? '수정됨' : '수정 필요'}</small>
              </div>
            ) : null}
            <label className="field">
              <span>이름</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  markLoadedAssetEdited()
                }}
              />
            </label>
            <label className="field">
              <span>설명</span>
              <textarea
                value={description}
                placeholder="선택 입력"
                onChange={(event) => {
                  setDescription(event.target.value)
                  markLoadedAssetEdited()
                }}
              />
            </label>
            <button type="button" className="subtle-action" onClick={() => navigate('main')}>
              메인으로
            </button>
            <section className="avatar-studio-section">
              <div>
                <span>내 아바타</span>
                <strong>{myAvatars.length}개</strong>
              </div>
              {myAvatars.length > 0 ? (
                <div className="avatar-studio-list">
                  {myAvatars.slice(0, 4).map((avatar) => (
                    <article key={avatar.id} className="avatar-studio-row">
                      <AssetPreview asset={avatar} size="medium" />
                      <div>
                        <strong>{avatar.name}</strong>
                        <small>{statusLabel(avatar)}</small>
                        <div className="avatar-studio-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            disabled={
                              avatar.status !== 'ready' || session?.avatarAssetId === avatar.id
                            }
                            onClick={() => equipAvatar(avatar.id)}
                          >
                            {session?.avatarAssetId === avatar.id ? '장착 중' : '장착'}
                          </button>
                          <button
                            type="button"
                            className="subtle-action"
                            onClick={() => loadAvatarSource(avatar)}
                          >
                            수정
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>생성한 아바타가 아직 없습니다.</p>
              )}
            </section>
          </div>
        }
      />
    </section>
  )
}

function AssetStudio() {
  const submitAsset = useAppStore((state) => state.submitAsset)
  const assets = useAppStore((state) => state.assets)
  const session = useAppStore((state) => state.session)
  const studioSourceAssetId = useAppStore((state) => state.studioSourceAssetId)
  const clearStudioSourceAsset = useAppStore((state) => state.clearStudioSourceAsset)
  const isLoading = useAppStore((state) => state.isLoading)
  const [category, setCategory] = useState<StudioCategory>('platform')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [widthCells, setWidthCells] = useState(2)
  const [heightCells, setHeightCells] = useState(1)
  const [attrSelections, setAttrSelections] = useState(() => getDefaultAttrSelections('platform'))
  const [isLoadModalOpen, setLoadModalOpen] = useState(false)
  const [remixSource, setRemixSource] = useState<Asset | null>(null)
  const [hasEditedLoadedAsset, setHasEditedLoadedAsset] = useState(false)
  const canvasWidth = widthCells * TILE_PX
  const canvasHeight = heightCells * TILE_PX
  const canSubmit = name.trim().length > 0 && (remixSource === null || hasEditedLoadedAsset)

  const attrGroups = useMemo(() => getAttrGroups(category), [category])

  useEffect(() => {
    setAttrSelections((currentSelections) => normalizeAttrSelections(category, currentSelections))
  }, [category])

  const markLoadedAssetEdited = () => {
    if (remixSource !== null) {
      setHasEditedLoadedAsset(true)
    }
  }

  const handleCategoryChange = (nextCategory: StudioCategory) => {
    setCategory(nextCategory)
    setAttrSelections(getDefaultAttrSelections(nextCategory))
    markLoadedAssetEdited()
  }

  const handleAttrChange = (key: string, value: string) => {
    setAttrSelections((currentSelections) => ({
      ...currentSelections,
      [key]: value,
    }))
    markLoadedAssetEdited()
  }

  const handleSubmit = async (image: string) => {
    if (!canSubmit) {
      return
    }

    await submitAsset({
      category,
      name: name.trim(),
      description,
      image,
      attrs: buildAssetAttrs(category, attrSelections),
      widthCells,
      heightCells,
      remixOfId: remixSource?.id ?? null,
    })
  }

  const handleLoadAsset = useCallback((asset: Asset) => {
    const loadedCategory =
      asset.category === 'avatar' || asset.category === 'item' ? 'platform' : asset.category

    setCategory(loadedCategory)
    setName(`${asset.name} 리믹스`)
    setDescription(asset.description)
    setWidthCells(asset.widthCells ?? 1)
    setHeightCells(asset.heightCells ?? 1)
    setAttrSelections(getAttrSelectionsFromAsset(loadedCategory, asset.attrs))
    setRemixSource(asset)
    setHasEditedLoadedAsset(false)
    setLoadModalOpen(false)
  }, [])

  useEffect(() => {
    if (studioSourceAssetId === null) {
      return
    }

    const sourceAsset = assets.find(
      (asset) => asset.id === studioSourceAssetId && asset.category !== 'avatar',
    )

    if (sourceAsset === undefined) {
      clearStudioSourceAsset()
      return
    }

    handleLoadAsset(sourceAsset)
    clearStudioSourceAsset()
  }, [assets, clearStudioSourceAsset, handleLoadAsset, studioSourceAssetId])

  return (
    <section className="screen studio-screen">
      <SketchBoard
        title="에셋 스튜디오"
        width={canvasWidth}
        height={canvasHeight}
        submitLabel={isLoading ? '제출 중' : '만들기'}
        disabled={!canSubmit || isLoading}
        referenceImage={remixSource?.sourceImageUrl || undefined}
        onEdited={markLoadedAssetEdited}
        onSubmit={handleSubmit}
        sidePanel={
          <div className="panel-stack">
            <button type="button" className="secondary-action" onClick={() => setLoadModalOpen(true)}>
              에셋 불러오기
            </button>
            {remixSource !== null ? (
              <div className="remix-banner">
                <span>불러온 에셋</span>
                <strong>{remixSource.name}</strong>
                <small>{hasEditedLoadedAsset ? '수정됨' : '수정 필요'}</small>
              </div>
            ) : null}
          </div>
        }
        propertiesPanelTitle="속성"
        propertiesPanel={
          <div className="panel-stack">
            <label className="field">
              <span>이름</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  markLoadedAssetEdited()
                }}
              />
            </label>
            <label className="field">
              <span>카테고리</span>
              <select
                value={category}
                onChange={(event) => {
                  handleCategoryChange(event.target.value as StudioCategory)
                }}
              >
                {studioCategories.map((studioCategory) => (
                  <option key={studioCategory} value={studioCategory}>
                    {categoryLabels[studioCategory]}
                  </option>
                ))}
              </select>
            </label>
            <div className="dimension-row">
              <label className="field">
                <span>가로</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={widthCells}
                  onChange={(event) => {
                    setWidthCells(clampCellValue(event.target.value))
                    markLoadedAssetEdited()
                  }}
                />
              </label>
              <label className="field">
                <span>세로</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={heightCells}
                  onChange={(event) => {
                    setHeightCells(clampCellValue(event.target.value))
                    markLoadedAssetEdited()
                  }}
                />
              </label>
            </div>
            <div className="attribute-form">
              <span className="attribute-form-title">속성</span>
              {attrGroups.map((group) => (
                <fieldset key={group.key} className="attribute-choice-group">
                  <legend>{group.label}</legend>
                  <div className="attribute-choice-grid">
                    {group.choices.map((option) => {
                      const isSelected = (attrSelections[group.key] ?? group.choices[0].value) === option.value

                      return (
                        <label key={option.value} className={isSelected ? 'is-active' : undefined}>
                          <input
                            type="radio"
                            name={`asset-attr-${category}-${group.key}`}
                            value={option.value}
                            checked={isSelected}
                            onChange={() => handleAttrChange(group.key, option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <label className="field">
              <span>설명</span>
              <textarea
                value={description}
                placeholder="선택 입력"
                onChange={(event) => {
                  setDescription(event.target.value)
                  markLoadedAssetEdited()
                }}
              />
            </label>
          </div>
        }
      />
      {isLoadModalOpen ? (
        <AssetLoadModal
          assets={assets}
          currentUserId={session?.id ?? null}
          onClose={() => setLoadModalOpen(false)}
          onSelect={handleLoadAsset}
        />
      ) : null}
    </section>
  )
}

function AssetLoadModal({
  assets,
  currentUserId,
  onClose,
  onSelect,
}: {
  assets: Asset[]
  currentUserId: string | null
  onClose: () => void
  onSelect: (asset: Asset) => void
}) {
  const [tab, setTab] = useState<'mine' | 'others'>('mine')
  const loadableAssets = assets.filter(
    (asset) => asset.category !== 'avatar' && asset.category !== 'item' && !isAssetWorking(asset),
  )
  const myAssets = loadableAssets.filter((asset) => asset.creatorId === currentUserId)
  const otherAssets = loadableAssets.filter(
    (asset) => asset.creatorId !== currentUserId && (asset.isPublic || asset.isSystem),
  )
  const visibleAssets = tab === 'mine' ? myAssets : otherAssets

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="asset-load-modal" role="dialog" aria-modal="true" aria-label="에셋 불러오기">
        <div className="section-head">
          <div>
            <p className="eyebrow">Load Asset</p>
            <h1>에셋 불러오기</h1>
          </div>
          <button type="button" className="subtle-action" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="segmented">
          <button
            type="button"
            className={tab === 'mine' ? 'is-active' : ''}
            onClick={() => setTab('mine')}
          >
            내가 만든
          </button>
          <button
            type="button"
            className={tab === 'others' ? 'is-active' : ''}
            onClick={() => setTab('others')}
          >
            남이 만든
          </button>
        </div>

        {visibleAssets.length > 0 ? (
          <div className="asset-load-grid">
            {visibleAssets.map((asset) => (
              <button key={asset.id} type="button" onClick={() => onSelect(asset)}>
                <AssetPreview asset={asset} size="medium" />
                <span>{categoryLabels[asset.category]}</span>
                <strong>{asset.name}</strong>
                <small>
                  {asset.status === 'failed'
                    ? statusLabel(asset)
                    : asset.isSystem
                      ? '기본 제공'
                      : '공개 에셋'}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>불러올 에셋이 없습니다</strong>
            <span>먼저 에셋을 만들거나 다른 탭을 확인하세요.</span>
          </div>
        )}
      </section>
    </div>
  )
}

function SketchBoard({
  title,
  width,
  height,
  sidePanel,
  propertiesPanel,
  propertiesPanelTitle = '속성',
  submitLabel,
  disabled,
  referenceImage,
  onEdited,
  onSubmit,
}: {
  title: string
  width: number
  height: number
  sidePanel: ReactNode
  propertiesPanel?: ReactNode
  propertiesPanelTitle?: string
  submitLabel: string
  disabled: boolean
  referenceImage?: string
  onEdited?: () => void
  onSubmit: (image: string) => Promise<void>
}) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null)
  const moveSessionRef = useRef<{
    origin: { x: number; y: number }
    basePaths: CanvasPath[]
    lastPaths: CanvasPath[]
    moved: boolean
  } | null>(null)
  const toolPanelSectionResizeRef = useRef<{
    boundary: StudioPanelSectionBoundary
    startY: number
    panelHeight: number
    startRatios: StudioPanelSectionRatios
  } | null>(null)
  const moveUndoStackRef = useRef<CanvasPath[][]>([])
  const moveRedoStackRef = useRef<CanvasPath[][]>([])
  const canvasStageRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<SketchTool>('pen')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [strokeColor, setStrokeColor] = useState('#111827')
  const [recentColors, setRecentColors] = useState<string[]>(palette.slice(0, 8))
  const [opacity, setOpacity] = useState(100)
  const [checkerTone, setCheckerTone] = useState<'light' | 'dark'>('light')
  const [isMoving, setIsMoving] = useState(false)
  const [isSamplingColor, setIsSamplingColor] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [studioLayoutPreference, setStudioLayoutPreference] = useState(readStudioLayoutPreference)
  const panelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const propertiesPanelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const sketchWidth = width * SKETCH_WORKSPACE_SCALE
  const sketchHeight = height * SKETCH_WORKSPACE_SCALE
  const exportFrame = { x: width, y: height, width, height }
  const canvasSizeRef = useRef({ width: sketchWidth, height: sketchHeight })

  const {
    leftPanelWidth,
    rightPanelWidth,
    leftSectionRatios,
    isToolPanelCollapsed,
    isPropertiesPanelCollapsed,
  } = studioLayoutPreference
  const hasPropertiesPanel = propertiesPanel !== undefined

  useEffect(() => {
    canvasRef.current?.eraseMode(tool === 'eraser')
  }, [tool])

  useEffect(() => {
    saveStudioLayoutPreference(studioLayoutPreference)
  }, [studioLayoutPreference])

  useEffect(() => {
    const stage = canvasStageRef.current

    if (stage === null) {
      return
    }

    const left = Math.max(0, width - (stage.clientWidth - width) / 2)
    const top = Math.max(0, height - (stage.clientHeight - height) / 2)

    stage.scrollTo({ left, top })
  }, [height, sketchHeight, sketchWidth, width])

  useEffect(() => {
    const previousSize = canvasSizeRef.current

    if (previousSize.width === sketchWidth && previousSize.height === sketchHeight) {
      return undefined
    }

    canvasSizeRef.current = { width: sketchWidth, height: sketchHeight }
    moveUndoStackRef.current = []
    moveRedoStackRef.current = []

    const canvas = canvasRef.current

    if (canvas === null || previousSize.width <= 0 || previousSize.height <= 0) {
      return undefined
    }

    let isCancelled = false

    void canvas.exportPaths().then((paths) => {
      if (isCancelled || paths.length === 0) {
        return
      }

      canvas.resetCanvas()
      canvas.loadPaths(
        scaleCanvasPaths(paths, sketchWidth / previousSize.width, sketchHeight / previousSize.height),
      )
    })

    return () => {
      isCancelled = true
    }
  }, [sketchHeight, sketchWidth])

  const loadPathSnapshot = useCallback((paths: CanvasPath[]) => {
    const canvas = canvasRef.current

    if (canvas === null) {
      return
    }

    canvas.resetCanvas()

    if (paths.length > 0) {
      canvas.loadPaths(paths)
    }
  }, [])

  const commitColor = useCallback((color: string) => {
    setStrokeColor(color)
    setRecentColors((currentColors) => [
      color,
      ...currentColors.filter((currentColor) => currentColor !== color),
    ].slice(0, 8))
  }, [])

  const moveDrawingBy = useCallback(
    async (dx: number, dy: number) => {
      const canvas = canvasRef.current

      if (canvas === null) {
        return
      }

      const currentPaths = await canvas.exportPaths()

      if (currentPaths.length === 0) {
        return
      }

      const nextPaths = translateCanvasPaths(currentPaths, dx, dy)
      moveUndoStackRef.current.push(currentPaths)
      moveRedoStackRef.current = []
      loadPathSnapshot(nextPaths)
      onEdited?.()
    },
    [loadPathSnapshot, onEdited],
  )

  const handleUndo = async () => {
    const canvas = canvasRef.current
    const previousMovePaths = moveUndoStackRef.current.pop()

    if (canvas === null) {
      return
    }

    if (previousMovePaths !== undefined) {
      moveRedoStackRef.current.push(await canvas.exportPaths())
      loadPathSnapshot(previousMovePaths)
      onEdited?.()
      return
    }

    canvas.undo()
  }

  const handleRedo = async () => {
    const canvas = canvasRef.current
    const nextMovePaths = moveRedoStackRef.current.pop()

    if (canvas === null) {
      return
    }

    if (nextMovePaths !== undefined) {
      moveUndoStackRef.current.push(await canvas.exportPaths())
      loadPathSnapshot(nextMovePaths)
      onEdited?.()
      return
    }

    canvas.redo()
  }

  const handleSubmit = async () => {
    if (canvasRef.current === null || disabled || isExporting) {
      return
    }

    setIsExporting(true)
    setSubmitError('')

    try {
      const workspaceDrawingImage = await canvasRef.current.exportImage('png', {
        width: sketchWidth,
        height: sketchHeight,
      })
      const drawingImage = await cropImageRegion(
        workspaceDrawingImage,
        exportFrame.x,
        exportFrame.y,
        exportFrame.width,
        exportFrame.height,
      )
      const image =
        referenceImage === undefined
          ? drawingImage
          : await composeSketchImage(referenceImage, drawingImage, width, height)

      await onSubmit(image)
    } catch (error) {
      console.error(error)
      setSubmitError('제출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    if (clipboardContainsFile(event)) {
      event.preventDefault()
    }
  }

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (dragEventContainsFile(event)) {
      event.preventDefault()
    }
  }

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (dragEventContainsFile(event)) {
      event.preventDefault()
    }
  }

  const handleColorSample = async (event: ReactPointerEvent<HTMLDivElement>) => {
    if (canvasRef.current === null || isSamplingColor) {
      return
    }

    event.preventDefault()
    const point = getCanvasPixelPoint(event, sketchWidth, sketchHeight)
    setIsSamplingColor(true)

    try {
      const workspaceDrawingImage = await canvasRef.current.exportImage('png', {
        width: sketchWidth,
        height: sketchHeight,
      })
      const isInsideExportFrame = isPointInsideRect(point, exportFrame)
      const sampledColor =
        referenceImage === undefined || !isInsideExportFrame
          ? await sampleImageColor(workspaceDrawingImage, point.x, point.y, sketchWidth, sketchHeight)
          : await sampleSketchExportColor(
              referenceImage,
              workspaceDrawingImage,
              point.x - exportFrame.x,
              point.y - exportFrame.y,
              exportFrame,
            )

      if (sampledColor !== null) {
        commitColor(sampledColor)
        setTool('pen')
      }
    } finally {
      setIsSamplingColor(false)
    }
  }

  const handleStroke = () => {
    moveUndoStackRef.current = []
    moveRedoStackRef.current = []
    onEdited?.()
  }

  const handleMovePointerDown = async (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool === 'eyedropper') {
      await handleColorSample(event)
      return
    }

    if (tool !== 'move' || canvasRef.current === null) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const origin = getLocalPointerPoint(event)
    const basePaths = await canvasRef.current.exportPaths()

    if (basePaths.length === 0) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      return
    }

    moveSessionRef.current = {
      origin,
      basePaths,
      lastPaths: basePaths,
      moved: false,
    }
    setIsMoving(true)
  }

  const handleMovePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const moveSession = moveSessionRef.current

    if (tool !== 'move' || moveSession === null) {
      return
    }

    event.preventDefault()
    const point = getLocalPointerPoint(event)
    const dx = point.x - moveSession.origin.x
    const dy = point.y - moveSession.origin.y
    const nextPaths = translateCanvasPaths(moveSession.basePaths, dx, dy)

    moveSession.lastPaths = nextPaths
    moveSession.moved = Math.abs(dx) > 1 || Math.abs(dy) > 1
    loadPathSnapshot(nextPaths)
  }

  const finishMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const moveSession = moveSessionRef.current

    if (moveSession === null) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (moveSession.moved) {
      moveUndoStackRef.current.push(moveSession.basePaths)
      moveRedoStackRef.current = []
      onEdited?.()
    } else {
      loadPathSnapshot(moveSession.basePaths)
    }

    moveSessionRef.current = null
    setIsMoving(false)
  }

  const handlePanelResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isToolPanelCollapsed) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panelResizeRef.current = {
      startX: event.clientX,
      startWidth: leftPanelWidth,
    }
  }

  const handlePanelResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeSession = panelResizeRef.current

    if (resizeSession === null) {
      return
    }

    event.preventDefault()
    const nextWidth = clampStudioPanelWidth(
      resizeSession.startWidth + event.clientX - resizeSession.startX,
    )

    setStudioLayoutPreference((currentPreference) => ({
      ...currentPreference,
      leftPanelWidth: nextWidth,
    }))
  }

  const handlePanelResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panelResizeRef.current === null) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    panelResizeRef.current = null
  }

  const handlePropertiesPanelResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasPropertiesPanel || isPropertiesPanelCollapsed) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    propertiesPanelResizeRef.current = {
      startX: event.clientX,
      startWidth: rightPanelWidth,
    }
  }

  const handlePropertiesPanelResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeSession = propertiesPanelResizeRef.current

    if (resizeSession === null) {
      return
    }

    event.preventDefault()
    const nextWidth = clampStudioPropertiesPanelWidth(
      resizeSession.startWidth - (event.clientX - resizeSession.startX),
    )

    setStudioLayoutPreference((currentPreference) => ({
      ...currentPreference,
      rightPanelWidth: nextWidth,
    }))
  }

  const handlePropertiesPanelResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (propertiesPanelResizeRef.current === null) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    propertiesPanelResizeRef.current = null
  }

  const handleToolPanelSectionResizeStart = (
    boundary: StudioPanelSectionBoundary,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const panelHeight = event.currentTarget.parentElement?.getBoundingClientRect().height ?? 0

    if (panelHeight <= 0) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    toolPanelSectionResizeRef.current = {
      boundary,
      startY: event.clientY,
      panelHeight,
      startRatios: leftSectionRatios,
    }
  }

  const handleToolPanelSectionResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeSession = toolPanelSectionResizeRef.current

    if (resizeSession === null) {
      return
    }

    event.preventDefault()
    const deltaRatio =
      ((event.clientY - resizeSession.startY) / resizeSession.panelHeight) * 100
    const nextRatios = resizeStudioPanelSectionRatios(
      resizeSession.startRatios,
      resizeSession.boundary,
      deltaRatio,
    )

    setStudioLayoutPreference((currentPreference) => ({
      ...currentPreference,
      leftSectionRatios: nextRatios,
    }))
  }

  const handleToolPanelSectionResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (toolPanelSectionResizeRef.current === null) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    toolPanelSectionResizeRef.current = null
  }

  const setToolPanelCollapsed = (nextCollapsed: boolean) => {
    setStudioLayoutPreference((currentPreference) => ({
      ...currentPreference,
      isToolPanelCollapsed: nextCollapsed,
    }))
  }

  const setPropertiesPanelCollapsed = (nextCollapsed: boolean) => {
    setStudioLayoutPreference((currentPreference) => ({
      ...currentPreference,
      isPropertiesPanelCollapsed: nextCollapsed,
    }))
  }

  return (
    <div
      className={[
        'studio-layout',
        hasPropertiesPanel ? 'has-properties-panel' : '',
        isToolPanelCollapsed ? 'is-tool-panel-collapsed' : '',
        hasPropertiesPanel && isPropertiesPanelCollapsed ? 'is-properties-panel-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--studio-left-width': `${leftPanelWidth}px`,
          '--studio-right-width': `${rightPanelWidth}px`,
        } as CSSProperties
      }
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPasteCapture={handlePaste}
    >
      <aside className={`tool-panel ${isToolPanelCollapsed ? 'is-collapsed' : ''}`}>
        {isToolPanelCollapsed ? (
          <button
            type="button"
            className="studio-panel-rail-button"
            aria-label={`${title} 도구 패널 펼치기`}
            onClick={() => setToolPanelCollapsed(false)}
          >
            <span aria-hidden="true">›</span>
            도구
          </button>
        ) : (
          <>
            <button
              type="button"
              className="studio-panel-collapse-button"
              aria-label={`${title} 도구 패널 접기`}
              onClick={() => setToolPanelCollapsed(true)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div
              className="studio-panel-sections"
              style={{
                gridTemplateRows: `minmax(0, ${leftSectionRatios.tools}fr) 10px minmax(0, ${leftSectionRatios.palette}fr) 10px minmax(0, ${leftSectionRatios.side}fr)`,
              }}
            >
              <section className="studio-panel-section">
                <h2>{title}</h2>
                <div className="segmented">
                  <button
                    type="button"
                    className={tool === 'pen' ? 'is-active' : ''}
                    onClick={() => setTool('pen')}
                  >
                    펜
                  </button>
                  <button
                    type="button"
                    className={tool === 'eraser' ? 'is-active' : ''}
                    onClick={() => setTool('eraser')}
                  >
                    지우개
                  </button>
                  <button
                    type="button"
                    className={tool === 'eyedropper' ? 'is-active' : ''}
                    disabled={isSamplingColor}
                    onClick={() => setTool('eyedropper')}
                  >
                    {isSamplingColor ? '추출 중' : '스포이드'}
                  </button>
                  <button
                    type="button"
                    className={tool === 'move' ? 'is-active' : ''}
                    onClick={() => setTool('move')}
                  >
                    이동
                  </button>
                </div>
                <label className="field">
                  <span>굵기</span>
                  <input
                    type="range"
                    min={2}
                    max={16}
                    step={2}
                    value={strokeWidth}
                    onChange={(event) => setStrokeWidth(Number(event.target.value))}
                  />
                </label>
                <div className="move-pad" aria-label="전체 이동">
                  <button type="button" onClick={() => void moveDrawingBy(0, -MOVE_NUDGE_PX)}>
                    상
                  </button>
                  <button type="button" onClick={() => void moveDrawingBy(-MOVE_NUDGE_PX, 0)}>
                    좌
                  </button>
                  <button type="button" onClick={() => void moveDrawingBy(MOVE_NUDGE_PX, 0)}>
                    우
                  </button>
                  <button type="button" onClick={() => void moveDrawingBy(0, MOVE_NUDGE_PX)}>
                    하
                  </button>
                </div>
                <div className="tool-actions">
                  <button type="button" onClick={() => void handleUndo()}>
                    Undo
                  </button>
                  <button type="button" onClick={() => void handleRedo()}>
                    Redo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveUndoStackRef.current = []
                      moveRedoStackRef.current = []
                      canvasRef.current?.clearCanvas()
                      onEdited?.()
                    }}
                  >
                    Clear
                  </button>
                </div>
              </section>
              <div
                className="studio-section-resize-handle"
                role="separator"
                aria-label="도구와 팔레트 영역 높이 조절"
                aria-orientation="horizontal"
                onPointerDown={(event) =>
                  handleToolPanelSectionResizeStart('tools-palette', event)
                }
                onPointerMove={handleToolPanelSectionResizeMove}
                onPointerUp={handleToolPanelSectionResizeEnd}
                onPointerCancel={handleToolPanelSectionResizeEnd}
              />
              <section className="studio-panel-section">
                <label className="field">
                  <span>불투명도</span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={10}
                    value={opacity}
                    onChange={(event) => setOpacity(Number(event.target.value))}
                  />
                </label>
                <div className="palette-grid">
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={strokeColor === color ? 'is-active' : ''}
                      aria-label={`색상 ${color}`}
                      style={{ background: color }}
                      onClick={() => commitColor(color)}
                    />
                  ))}
                </div>
                <div className="color-readout">
                  <span>RGB</span>
                  <strong>{strokeColor.toUpperCase()}</strong>
                  <i style={{ background: strokeColor }} aria-hidden="true" />
                </div>
                <div className="recent-color-row" aria-label="최근 사용 색">
                  {recentColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={strokeColor === color ? 'is-active' : ''}
                      aria-label={`최근 색상 ${color}`}
                      style={{ background: color }}
                      onClick={() => commitColor(color)}
                    />
                  ))}
                </div>
                <div className="segmented">
                  <button
                    type="button"
                    className={checkerTone === 'light' ? 'is-active' : ''}
                    onClick={() => setCheckerTone('light')}
                  >
                    밝게
                  </button>
                  <button
                    type="button"
                    className={checkerTone === 'dark' ? 'is-active' : ''}
                    onClick={() => setCheckerTone('dark')}
                  >
                    어둡게
                  </button>
                </div>
              </section>
              <div
                className="studio-section-resize-handle"
                role="separator"
                aria-label="팔레트와 보조 영역 높이 조절"
                aria-orientation="horizontal"
                onPointerDown={(event) =>
                  handleToolPanelSectionResizeStart('palette-side', event)
                }
                onPointerMove={handleToolPanelSectionResizeMove}
                onPointerUp={handleToolPanelSectionResizeEnd}
                onPointerCancel={handleToolPanelSectionResizeEnd}
              />
              <section className="studio-panel-section">{sidePanel}</section>
            </div>
            <div
              className="studio-panel-resize-handle"
              role="separator"
              aria-label={`${title} 도구 패널 폭 조절`}
              aria-orientation="vertical"
              onPointerDown={handlePanelResizeStart}
              onPointerMove={handlePanelResizeMove}
              onPointerUp={handlePanelResizeEnd}
              onPointerCancel={handlePanelResizeEnd}
            />
          </>
        )}
      </aside>

      <div className="canvas-stage" ref={canvasStageRef}>
        <div
          className={`sketch-frame checker-${checkerTone}`}
          style={{
            width: sketchWidth,
            height: sketchHeight,
            '--export-x': `${exportFrame.x}px`,
            '--export-y': `${exportFrame.y}px`,
            '--export-width': `${exportFrame.width}px`,
            '--export-height': `${exportFrame.height}px`,
            '--tile-size': `${TILE_PX}px`,
          } as CSSProperties}
          onPointerDown={handleMovePointerDown}
          onPointerMove={handleMovePointerMove}
          onPointerUp={finishMove}
          onPointerCancel={finishMove}
        >
          {referenceImage !== undefined ? (
            <img
              className="sketch-reference-image"
              src={referenceImage}
              alt=""
              style={{
                left: exportFrame.x,
                top: exportFrame.y,
                width: exportFrame.width,
                height: exportFrame.height,
              }}
            />
          ) : null}
          <div className="sketch-export-window" aria-hidden="true" />
          {tool === 'move' ? (
            <div className={`move-overlay ${isMoving ? 'is-moving' : ''}`}>
              전체 이동
            </div>
          ) : null}
          <ReactSketchCanvas
            ref={canvasRef}
            width={`${sketchWidth}px`}
            height={`${sketchHeight}px`}
            strokeWidth={strokeWidth}
            strokeColor={withAlpha(strokeColor, opacity)}
            backgroundImage=""
            canvasColor="transparent"
            exportWithBackgroundImage={false}
            readOnly={tool === 'move' || tool === 'eyedropper'}
            onStroke={handleStroke}
            style={{
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
            }}
          />
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={disabled || isExporting}
          onClick={handleSubmit}
        >
          {isExporting ? '처리 중' : submitLabel}
        </button>
        {submitError ? <p className="sketch-submit-error">{submitError}</p> : null}
      </div>

      {hasPropertiesPanel ? (
        <aside
          className={`studio-properties-panel ${
            isPropertiesPanelCollapsed ? 'is-collapsed' : ''
          }`}
        >
          {isPropertiesPanelCollapsed ? (
            <button
              type="button"
              className="studio-panel-rail-button"
              aria-label={`${propertiesPanelTitle} 패널 펼치기`}
              onClick={() => setPropertiesPanelCollapsed(false)}
            >
              <span aria-hidden="true">‹</span>
              {propertiesPanelTitle}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="studio-properties-collapse-button"
                aria-label={`${propertiesPanelTitle} 패널 접기`}
                onClick={() => setPropertiesPanelCollapsed(true)}
              >
                <span aria-hidden="true">›</span>
              </button>
              <h2>{propertiesPanelTitle}</h2>
              {propertiesPanel}
              <div
                className="studio-properties-resize-handle"
                role="separator"
                aria-label={`${propertiesPanelTitle} 패널 폭 조절`}
                aria-orientation="vertical"
                onPointerDown={handlePropertiesPanelResizeStart}
                onPointerMove={handlePropertiesPanelResizeMove}
                onPointerUp={handlePropertiesPanelResizeEnd}
                onPointerCancel={handlePropertiesPanelResizeEnd}
              />
            </>
          )}
        </aside>
      ) : null}
    </div>
  )
}

function Warehouse() {
  const assets = useAppStore((state) => state.assets)
  const equipAvatar = useAppStore((state) => state.equipAvatar)
  const requestSpriteRegeneration = useAppStore((state) => state.requestSpriteRegeneration)
  const session = useAppStore((state) => state.session)
  const openStudioWithAsset = useAppStore((state) => state.openStudioWithAsset)
  const tab = useAppStore((state) => state.warehouseTab)
  const openWarehouse = useAppStore((state) => state.openWarehouse)
  const navigate = useAppStore((state) => state.navigate)
  const [componentFilter, setComponentFilter] = useState<'all' | WarehouseComponentCategory>(
    'all',
  )
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const componentCategories: WarehouseComponentCategory[] = [
    'platform',
    'obstacle',
    'monster',
    'background',
  ]
  const filteredAssets = assets.filter((asset) => {
    if (tab === 'avatar') {
      return asset.category === 'avatar'
    }

    return (
      asset.category !== 'avatar' &&
      asset.category !== 'item' &&
      (componentFilter === 'all' || asset.category === componentFilter)
    )
  })
  const userAssets = assets.filter((asset) => !asset.isSystem)
  const tabAssets = assets.filter((asset) =>
    tab === 'avatar'
      ? asset.category === 'avatar'
      : asset.category !== 'avatar' && asset.category !== 'item',
  )
  const readyCount = filteredAssets.filter((asset) => asset.status === 'ready').length
  const workingCount = filteredAssets.filter(isAssetWorking).length
  const failedCount = filteredAssets.filter((asset) => asset.status === 'failed').length
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null

  useEffect(() => {
    if (selectedAssetId === null || filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      return
    }

    setSelectedAssetId(null)
  }, [filteredAssets, selectedAssetId])

  const handleRetryAsset = (asset: Asset) => {
    getRetryActions(asset).forEach((action) => requestSpriteRegeneration(asset.id, action))
  }

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <p className="eyebrow">Warehouse</p>
          <h1>내 창고</h1>
        </div>
        <div className="warehouse-actions">
          <div className="segmented">
            <button
              type="button"
              className={tab === 'avatar' ? 'is-active' : ''}
              onClick={() => openWarehouse('avatar')}
            >
              아바타
            </button>
            <button
              type="button"
              className={tab === 'component' ? 'is-active' : ''}
              onClick={() => openWarehouse('component')}
            >
              컴포넌트 에셋
            </button>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => navigate(tab === 'avatar' ? 'avatar' : 'studio')}
          >
            {tab === 'avatar' ? '새 아바타 만들기' : '새 에셋 만들기'}
          </button>
        </div>
      </div>

      <div className="warehouse-summary">
        <div>
          <span>내가 만든 에셋</span>
          <strong>{userAssets.length}</strong>
        </div>
        <div>
          <span>{tab === 'avatar' ? '아바타' : '컴포넌트'}</span>
          <strong>{tabAssets.length}</strong>
        </div>
        <div>
          <span>사용 가능</span>
          <strong>{readyCount}</strong>
        </div>
        <div>
          <span>작업 중</span>
          <strong>{workingCount}</strong>
        </div>
        <div>
          <span>실패</span>
          <strong>{failedCount}</strong>
        </div>
      </div>

      {tab === 'component' ? (
        <div className="category-filter-bar" aria-label="컴포넌트 에셋 분류">
          <button
            type="button"
            className={componentFilter === 'all' ? 'is-active' : ''}
            onClick={() => setComponentFilter('all')}
          >
            전체
          </button>
          {componentCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={componentFilter === category ? 'is-active' : ''}
              onClick={() => setComponentFilter(category)}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
      ) : null}

      {filteredAssets.length > 0 ? (
        <div className="asset-grid">
          {filteredAssets.map((asset) => (
            <article key={asset.id} className="asset-card">
              <button
                type="button"
                className="asset-card-main"
                onClick={() => setSelectedAssetId(asset.id)}
              >
                <AssetPreview asset={asset} size="medium" />
                <div className="asset-meta">
                  <span>{categoryLabels[asset.category]}</span>
                  <strong>{asset.name}</strong>
                  <small>{statusLabel(asset)}</small>
                  {asset.status !== 'ready' ? <AssetProgress asset={asset} /> : null}
                </div>
              </button>
              {asset.category === 'avatar' && asset.status === 'ready' ? (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={session?.avatarAssetId === asset.id}
                  onClick={() => equipAvatar(asset.id)}
                >
                  {session?.avatarAssetId === asset.id ? '장착 중' : '장착'}
                </button>
              ) : null}
              {asset.status === 'failed' ? (
                <button
                  type="button"
                  className="secondary-action asset-retry-action"
                  disabled={asset.isSystem}
                  onClick={() => handleRetryAsset(asset)}
                >
                  다시 시도
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>표시할 에셋이 없습니다</strong>
          <span>다른 탭이나 분류를 선택해보세요.</span>
        </div>
      )}

      {selectedAsset !== null ? (
        <AssetReviewModal
          asset={selectedAsset}
          isEquipped={session?.avatarAssetId === selectedAsset.id}
          onClose={() => setSelectedAssetId(null)}
          onEquip={() => equipAvatar(selectedAsset.id)}
          onRegenerate={(action) => requestSpriteRegeneration(selectedAsset.id, action)}
          onEdit={() => {
            setSelectedAssetId(null)
            openStudioWithAsset(selectedAsset.id, selectedAsset.category)
          }}
        />
      ) : null}
    </section>
  )
}

function AssetProgress({ asset }: { asset: Asset }) {
  const readySprites = asset.sprites.filter((sprite) => sprite.status === 'ready').length
  const totalSprites = Math.max(1, asset.sprites.length)
  const progress = Math.round((readySprites / totalSprites) * 100)

  return (
    <div className="asset-progress-wrap" aria-label={`${asset.name} 생성 진행률`}>
      <div className="asset-progress">
        <div style={{ width: `${progress}%` }}></div>
      </div>
      <span>{assetProgressDetailLabel(asset)}</span>
    </div>
  )
}

function AssetReviewModal({
  asset,
  isEquipped,
  onClose,
  onEquip,
  onRegenerate,
  onEdit,
}: {
  asset: Asset
  isEquipped: boolean
  onClose: () => void
  onEquip: () => void
  onRegenerate: (action: Asset['sprites'][number]['action']) => void
  onEdit: () => void
}) {
  const [now, setNow] = useState(Date.now())
  const [selectedAction, setSelectedAction] = useState<Asset['sprites'][number]['action']>(
    asset.sprites[0]?.action ?? 'static',
  )
  const attributeRows = getAssetAttributeRows(asset)
  const selectedSprite =
    asset.sprites.find((sprite) => sprite.action === selectedAction) ?? asset.sprites[0] ?? null
  const hasActionTabs =
    selectedSprite !== null &&
    (asset.sprites.length > 1 || selectedSprite.action !== 'static')
  const selectedCooldownRemaining =
    selectedSprite === null ? 0 : getCooldownRemaining(selectedSprite.lastRegenAt, now)
  const isSelectedCoolingDown = selectedCooldownRemaining > 0
  const isSelectedWorking =
    selectedSprite?.status === 'queued' || selectedSprite?.status === 'generating'
  const isEditLocked = isAssetWorking(asset)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (asset.sprites.some((sprite) => sprite.action === selectedAction)) {
      return
    }

    setSelectedAction(asset.sprites[0]?.action ?? 'static')
  }, [asset.sprites, selectedAction])

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="asset-review-modal" role="dialog" aria-modal="true" aria-label="에셋 상세">
        <div className="section-head">
          <div>
            <p className="eyebrow">{categoryLabels[asset.category]}</p>
            <h1>{asset.name}</h1>
          </div>
          <button type="button" className="subtle-action" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="asset-review-body">
          <AssetPreview asset={asset} size="large" />
          <div className="asset-review-info">
            <p>{asset.description || '설명 없음'}</p>
            <div className="asset-attribute-grid">
              <span>상태</span>
              <strong>{statusLabel(asset)}</strong>
              <span>충돌</span>
              <strong>{asset.colliderType}</strong>
              <span>크기</span>
              <strong>
                {asset.widthCells === null || asset.heightCells === null
                  ? '고정'
                  : `${asset.widthCells}x${asset.heightCells}`}
              </strong>
              {attributeRows.map((row) => (
                <Fragment key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        {selectedSprite !== null ? (
          <div className="sprite-preview-panel">
            {hasActionTabs ? (
              <div className="sprite-action-tabs" role="tablist" aria-label="액션 미리보기">
                {asset.sprites.map((sprite) => (
                  <button
                    key={sprite.action}
                    type="button"
                    role="tab"
                    aria-selected={selectedAction === sprite.action}
                    className={selectedAction === sprite.action ? 'is-active' : ''}
                    onClick={() => setSelectedAction(sprite.action)}
                  >
                    {spriteActionLabel(sprite.action)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="sprite-preview-card">
              <div>
                <strong>
                  {hasActionTabs ? spriteActionLabel(selectedSprite.action) : '정적 이미지'}
                </strong>
                <span>{spriteStatusLabel(selectedSprite.status)}</span>
              </div>
              <button
                type="button"
                className="secondary-action"
                disabled={asset.isSystem || isSelectedCoolingDown || isSelectedWorking}
                onClick={() => onRegenerate(selectedSprite.action)}
              >
                {isSelectedWorking
                  ? '처리 중'
                  : isSelectedCoolingDown
                    ? formatCooldown(selectedCooldownRemaining)
                    : '재생성'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="modal-actions">
          {asset.category === 'avatar' ? (
            <button
              type="button"
              className="primary-action"
              disabled={asset.status !== 'ready' || isEquipped}
              onClick={onEquip}
            >
              {isEquipped ? '장착 중' : '장착'}
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-action"
            disabled={isEditLocked}
            onClick={onEdit}
          >
            {isEditLocked ? '생성 완료 후 수정 가능' : '그림·속성 수정하기'}
          </button>
        </div>
      </section>
    </div>
  )
}

function Lobby() {
  const rooms = useAppStore((state) => state.rooms)
  const createRoom = useAppStore((state) => state.createRoom)
  const enterRoom = useAppStore((state) => state.enterRoom)
  const enterPublicRoom = useAppStore((state) => state.enterPublicRoom)
  const refreshRooms = useAppStore((state) => state.refreshRooms)
  const [name, setName] = useState('새 릴레이 방')
  const [isPublic, setIsPublic] = useState(true)
  const [roomPassword, setRoomPassword] = useState('')
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4)
  const [privateJoinRoom, setPrivateJoinRoom] = useState<RoomSummary | null>(null)
  const [privateJoinPassword, setPrivateJoinPassword] = useState('')
  const [lobbyMessage, setLobbyMessage] = useState('')
  const [isCreatingRoom, setCreatingRoom] = useState(false)
  const [isJoining, setJoining] = useState(false)

  const publicLobbyRooms = rooms.filter(
    (room) => room.isPublic && room.phase === 'lobby' && room.players < room.maxPlayers,
  )
  const canCreateRoom =
    !isCreatingRoom && name.trim().length > 0 && (isPublic || roomPassword.trim().length > 0)

  const handleCreateRoom = async () => {
    if (!canCreateRoom) {
      setLobbyMessage('비공개 방은 비밀번호가 필요합니다.')
      return
    }

    setCreatingRoom(true)
    setLobbyMessage('')

    try {
      await createRoom({
        name: name.trim(),
        isPublic,
        password: isPublic ? undefined : roomPassword.trim(),
        maxPlayers,
      })
    } catch (error) {
      console.error(error)
      setLobbyMessage('방을 만들 수 없습니다. 다시 시도해주세요.')
    } finally {
      setCreatingRoom(false)
    }
  }

  const handleQuickJoin = async () => {
    setJoining(true)
    setLobbyMessage('')

    try {
      const didEnter = await enterPublicRoom()

      if (!didEnter) {
        setLobbyMessage('입장 가능한 공개방이 없습니다.')
      }
    } catch (error) {
      console.error(error)
      setLobbyMessage('공개방 입장 중 문제가 발생했습니다.')
    } finally {
      setJoining(false)
    }
  }

  const handleRoomJoin = async (room: RoomSummary, password?: string) => {
    setJoining(true)
    setLobbyMessage('')

    try {
      const didEnter = await enterRoom(room, password)

      if (!didEnter) {
        setLobbyMessage(room.isPublic ? '방에 입장할 수 없습니다.' : '비밀번호를 확인해주세요.')
      } else {
        setPrivateJoinRoom(null)
        setPrivateJoinPassword('')
      }
    } catch (error) {
      console.error(error)
      setLobbyMessage('방에 입장할 수 없습니다. 다시 시도해주세요.')
    } finally {
      setJoining(false)
    }
  }

  const handlePrivateJoinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (privateJoinRoom === null) {
      return
    }

    await handleRoomJoin(privateJoinRoom, privateJoinPassword)
  }

  const handleRoomSelect = (room: RoomSummary, canSelectRoom: boolean) => {
    if (!canSelectRoom) {
      return
    }

    if (room.isPublic) {
      void handleRoomJoin(room)
      return
    }

    setPrivateJoinRoom(room)
    setPrivateJoinPassword('')
    setLobbyMessage('')
  }

  return (
    <section className="screen lobby-layout">
      <div className="section-head">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>방 목록</h1>
        </div>
        <button type="button" className="secondary-action" onClick={() => void refreshRooms()}>
          새로고침
        </button>
      </div>

      <aside className="create-room-panel">
        <label className="field">
          <span>방 이름</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
          />
          공개방
        </label>
        <div className="field">
          <span>최대 인원</span>
          <div className="segmented room-size-segmented" aria-label="방 최대 인원">
            {[2, 3, 4].map((playerCount) => (
              <button
                key={playerCount}
                type="button"
                className={maxPlayers === playerCount ? 'is-active' : ''}
                onClick={() => setMaxPlayers(playerCount as 2 | 3 | 4)}
              >
                {playerCount}명
              </button>
            ))}
          </div>
        </div>
        {!isPublic ? (
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              value={roomPassword}
              onChange={(event) => setRoomPassword(event.target.value)}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="primary-action"
          disabled={!canCreateRoom}
          onClick={handleCreateRoom}
        >
          {isCreatingRoom ? '방 만드는 중' : '방 만들기'}
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={publicLobbyRooms.length === 0 || isJoining}
          onClick={handleQuickJoin}
        >
          공개방 빠른 입장
        </button>
        {lobbyMessage ? <p className="lobby-message">{lobbyMessage}</p> : null}
      </aside>

      <div className="room-list">
        {rooms.map((room) => {
          const canJoinRoom = room.phase === 'lobby' && room.players < room.maxPlayers
          const canSelectRoom = canJoinRoom && !isJoining

          return (
            <article
              key={room.id}
              className={[
                'room-card',
                canSelectRoom ? 'is-clickable' : 'is-locked',
              ].join(' ')}
              role={canSelectRoom ? 'button' : undefined}
              tabIndex={canSelectRoom ? 0 : undefined}
              onClick={() => handleRoomSelect(room, canSelectRoom)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }

                event.preventDefault()
                handleRoomSelect(room, canSelectRoom)
              }}
            >
              <div>
                <span className="room-visibility">{room.isPublic ? 'PUBLIC' : 'PRIVATE'}</span>
                <h2>{room.name}</h2>
                <p>{room.hostNickname}</p>
              </div>
              <div className="room-stats">
                <strong>
                  {room.players}/{room.maxPlayers}
                </strong>
                <span>{phaseLabels[room.phase]}</span>
                <span>{room.phase === 'lobby' ? '대기' : `경과 ${formatElapsed(room.elapsedSeconds)}`}</span>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!canSelectRoom}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleRoomSelect(room, canSelectRoom)
                  }}
                >
                  {roomJoinButtonLabel(room)}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {privateJoinRoom !== null ? (
        <div className="modal-backdrop" role="presentation">
          <form
            className="room-password-modal"
            role="dialog"
            aria-modal="true"
            aria-label="비공개 방 입장"
            onSubmit={handlePrivateJoinSubmit}
          >
            <div className="section-head">
              <div>
                <p className="eyebrow">Private Room</p>
                <h1>{privateJoinRoom.name}</h1>
              </div>
              <button
                type="button"
                className="subtle-action"
                onClick={() => setPrivateJoinRoom(null)}
              >
                닫기
              </button>
            </div>
            <label className="field">
              <span>비밀번호</span>
              <input
                type="password"
                autoFocus
                value={privateJoinPassword}
                onChange={(event) => setPrivateJoinPassword(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="primary-action"
              disabled={isJoining || privateJoinPassword.trim().length === 0}
            >
              입장
            </button>
            {lobbyMessage ? <p className="lobby-message">{lobbyMessage}</p> : null}
          </form>
        </div>
      ) : null}
    </section>
  )
}

function RoomFlow() {
  const currentRoom = useAppStore((state) => state.currentRoom)
  const roomPlayers = useAppStore((state) => state.roomPlayers)
  const session = useAppStore((state) => state.session)
  const leaveRoom = useAppStore((state) => state.leaveRoom)
  const toggleLobbyReady = useAppStore((state) => state.toggleLobbyReady)
  const advanceRoomPhase = useAppStore((state) => state.advanceRoomPhase)
  const realtimeStatus = useAppStore((state) => state.realtimeStatus)
  const apiSource = useAppStore((state) => state.apiSource)
  const localPlayer = roomPlayers.find((player) => player.id === session?.id)
  const allLobbyPlayersReady = roomPlayers.every((player) => player.isHost || player.isReady)
  const realRoomPlayerCount = Math.max(
    currentRoom?.players ?? 0,
    countRealRoomPlayers(roomPlayers),
  )
  const hasEnoughRealPlayersToStart = realRoomPlayerCount >= 2
  const isMockDemoRoom = apiSource === 'mock'
  const hasEnoughPlayersToStart = hasEnoughRealPlayersToStart || isMockDemoRoom
  const canControlStart = localPlayer?.isHost === true || apiSource === 'mock'
  const canStartRoom = canControlStart && allLobbyPlayersReady && hasEnoughPlayersToStart

  if (currentRoom === null) {
    return (
      <section className="screen empty-room">
        <h1>입장한 방이 없습니다</h1>
        <button type="button" className="primary-action" onClick={leaveRoom}>
          로비로 이동
        </button>
      </section>
    )
  }

  return (
    <section className="screen room-screen">
      <div className="room-header">
        <div>
          <p className="eyebrow">Room</p>
          <h1>{currentRoom.name}</h1>
        </div>
        <div className="room-header-actions">
          <span className="source-pill">{phaseLabels[currentRoom.phase]}</span>
          <span className={`source-pill realtime-${realtimeStatus}`}>
            {realtimeStatusLabel(realtimeStatus)}
          </span>
          <button type="button" className="subtle-action" onClick={leaveRoom}>
            나가기
          </button>
        </div>
      </div>

      <PhaseRail activePhase={currentRoom.phase} />

      {currentRoom.phase === 'lobby' ? (
        <RoomLobbyPhase
          maxPlayers={currentRoom.maxPlayers}
          realPlayerCount={realRoomPlayerCount}
          players={roomPlayers}
          localPlayerId={session?.id ?? null}
          canStart={canStartRoom}
          canControlStart={canControlStart}
          allPlayersReady={allLobbyPlayersReady}
          hasEnoughRealPlayers={hasEnoughRealPlayersToStart}
          isMockDemoRoom={isMockDemoRoom}
          isMockStartOverride={localPlayer?.isHost !== true && isMockDemoRoom}
          onToggleReady={toggleLobbyReady}
          onStart={advanceRoomPhase}
        />
      ) : null}
      {currentRoom.phase === 'building' ? <MapBuildPhase onComplete={advanceRoomPhase} /> : null}
      {currentRoom.phase === 'validating' ? (
        <ValidationPhase onComplete={advanceRoomPhase} />
      ) : null}
      {currentRoom.phase === 'merging' ? <MergingPhase onComplete={advanceRoomPhase} /> : null}
      {currentRoom.phase === 'racing' ? <RacePhase onComplete={advanceRoomPhase} /> : null}
      {currentRoom.phase === 'finished' ? <ResultsPhase /> : null}
    </section>
  )
}

function PhaseRail({ activePhase }: { activePhase: RoomPhase }) {
  const phases: RoomPhase[] = ['lobby', 'building', 'validating', 'merging', 'racing', 'finished']
  const activeIndex = phases.indexOf(activePhase)

  return (
    <ol className="phase-rail">
      {phases.map((phase, index) => (
        <li key={phase} className={index <= activeIndex ? 'is-active' : ''}>
          <span>{index + 1}</span>
          {phaseLabels[phase]}
        </li>
      ))}
    </ol>
  )
}

function RoomLobbyPhase({
  maxPlayers,
  realPlayerCount,
  players,
  localPlayerId,
  canStart,
  canControlStart,
  allPlayersReady,
  hasEnoughRealPlayers,
  isMockDemoRoom,
  isMockStartOverride,
  onToggleReady,
  onStart,
}: {
  maxPlayers: number
  realPlayerCount: number
  players: RoomPlayer[]
  localPlayerId: string | null
  canStart: boolean
  canControlStart: boolean
  allPlayersReady: boolean
  hasEnoughRealPlayers: boolean
  isMockDemoRoom: boolean
  isMockStartOverride: boolean
  onToggleReady: () => void
  onStart: () => void
}) {
  const localPlayer = players.find((player) => player.id === localPlayerId) ?? null
  const canToggleReady = localPlayer !== null && !localPlayer.isHost
  const canAutoFillJoinedSlots = players.some((player) => player.id.startsWith('mock-host-'))
  const mockDemoHelperCount = players.filter((player) =>
    isAutoMockRoomPlayerId(player.id, canAutoFillJoinedSlots),
  ).length

  return (
    <div className="room-phase two-column-phase">
      <section className="phase-panel">
        <h2>대기실</h2>
        <p>
          실제 입장 {realPlayerCount}/{maxPlayers}명
          {isMockDemoRoom ? ' · 로컬 보조 플레이어로 즉시 시연 가능' : ' · 최소 2명이 준비되면 제작 시작'}
        </p>
        {mockDemoHelperCount > 0 ? (
          <small className="host-only-note">
            로컬 데모 보조 플레이어 {mockDemoHelperCount}명이 시연 참가자를 대신합니다.
          </small>
        ) : null}
        <div className="player-list">
          {players.map((player) => (
            <div
              key={player.id}
              className={[
                'player-row',
                player.id === localPlayerId ? 'is-me' : '',
                player.isReady || player.isHost ? 'is-ready' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <strong>{player.nickname}</strong>
              <span>{player.isHost ? '방장' : player.isReady ? '준비 완료' : '대기 중'}</span>
            </div>
          ))}
        </div>
        {canToggleReady ? (
          <button type="button" className="secondary-action" onClick={onToggleReady}>
            {localPlayer?.isReady ? '준비 취소' : '준비하기'}
          </button>
        ) : null}
      </section>
      <section className="phase-panel rules-panel">
        <h2>이번 판 흐름</h2>
        <p>3분 제작 후 2분 검증을 거쳐 성공한 맵 조각만 레이스에 병합됩니다.</p>
        <button type="button" className="primary-action" disabled={!canStart} onClick={onStart}>
          제작 시작
        </button>
        {!hasEnoughRealPlayers && !isMockDemoRoom ? (
          <small className="host-only-note">최소 2명이 입장해야 게임을 시작할 수 있습니다.</small>
        ) : null}
        {!hasEnoughRealPlayers && isMockDemoRoom ? (
          <small className="host-only-note">Mock 시연 모드에서는 보조 플레이어가 빈 슬롯을 대신합니다.</small>
        ) : null}
        {!allPlayersReady ? (
          <small className="host-only-note">아직 준비하지 않은 플레이어가 있습니다.</small>
        ) : null}
        {isMockStartOverride ? (
          <small className="host-only-note">Mock 시연 모드에서는 준비 후 바로 시작할 수 있습니다.</small>
        ) : null}
        {!canControlStart ? (
          <small className="host-only-note">방장만 제작을 시작할 수 있습니다.</small>
        ) : null}
      </section>
    </div>
  )
}

function MapBuildPhase({ onComplete }: { onComplete: () => void }) {
  const assets = useAppStore((state) => state.assets)
  const session = useAppStore((state) => state.session)
  const currentRoom = useAppStore((state) => state.currentRoom)
  const roomPlayers = useAppStore((state) => state.roomPlayers)
  const realtimeStatus = useAppStore((state) => state.realtimeStatus)
  const serverTimeVote = useAppStore((state) => state.currentTimeVote)
  const submitMapSegment = useAppStore((state) => state.submitMapSegment)
  const requestTimeVote = useAppStore((state) => state.requestTimeVote)
  const phaseRemainingMs = useAppStore((state) => state.phaseRemainingMs)
  const buildAssets = useMemo(
    () => assets.filter((asset) => asset.status === 'ready' && asset.category !== 'avatar'),
    [assets],
  )
  const [assetSource, setAssetSource] = useState<'system' | 'mine'>('system')
  const [categoryFilter, setCategoryFilter] = useState<Exclude<AssetCategory, 'avatar'>>('platform')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [editorTool, setEditorTool] = useState<MapEditorTool>('place')
  const [editorZoom, setEditorZoom] = useState(1)
  const [startPoint, setStartPoint] = useState<MapPoint>({ x: 1, y: 8 })
  const [endPoint, setEndPoint] = useState<MapPoint>({ x: 22, y: 5 })
  const [placements, setPlacements] = useState<MapPlacement[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [hiddenFrequentAssetIds, setHiddenFrequentAssetIds] = useState<string[]>([])
  const [timeVoteUsed, setTimeVoteUsed] = useState(false)
  const [timeVote, setTimeVote] = useState<BuildTimeVoteState | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')
  const [editorMessage, setEditorMessage] = useState('에셋을 선택하고 빈 그리드에 배치하세요.')
  const [selectedPlacementId, setSelectedPlacementId] = useState('')
  const [isAssetShelfCollapsed, setAssetShelfCollapsed] = useState(false)
  const [isToolDockCollapsed, setToolDockCollapsed] = useState(false)
  const [isBuildTestOpen, setBuildTestOpen] = useState(false)
  const [buildTestResetSignal, setBuildTestResetSignal] = useState(0)
  const [isBuildTestCleared, setBuildTestCleared] = useState(false)
  const hasSubmittedRef = useRef(false)
  const hasAdvancedPhaseRef = useRef(false)
  const hasInitializedTemplateRef = useRef(false)
  const visibleShelfAssets = useMemo(
    () =>
      buildAssets.filter((asset) => {
        const matchesSource =
          assetSource === 'system'
            ? asset.isSystem
            : asset.creatorId === session?.id && !asset.isSystem

        return matchesSource && asset.category === categoryFilter
      }),
    [assetSource, buildAssets, categoryFilter, session?.id],
  )
  const selectedAsset =
    buildAssets.find((asset) => asset.id === selectedAssetId) ?? visibleShelfAssets[0] ?? null
  const selectedPlacement =
    placements.find((placement) => placement.id === selectedPlacementId) ?? null
  const placementBudgetUsed = useMemo(
    () =>
      placements.reduce(
        (totalCost, placement) => totalCost + getAssetPlacementCost(placement.asset),
        0,
      ),
    [placements],
  )
  const selectedAssetPlacementCost = selectedAsset === null ? 0 : getAssetPlacementCost(selectedAsset)
  const canAffordSelectedAsset =
    selectedAsset !== null &&
    placementBudgetUsed + selectedAssetPlacementCost <= BUILD_PLACEMENT_BUDGET
  const frequentAssets = useMemo(
    () =>
      buildAssets
        .filter(
          (asset) =>
            (usageCounts[asset.id] ?? 0) > 0 && !hiddenFrequentAssetIds.includes(asset.id),
        )
        .sort((left, right) => (usageCounts[right.id] ?? 0) - (usageCounts[left.id] ?? 0))
        .slice(0, 6),
    [buildAssets, hiddenFrequentAssetIds, usageCounts],
  )
  const getEndpointLabelForEditor = useCallback(
    (x: number, y: number) => getEndpointLabelAt(x, y, startPoint, endPoint),
    [endPoint, startPoint],
  )
  const buildTestSegment = useMemo(
    () =>
      buildPreviewMapSegment({
        roomId: currentRoom?.id ?? 'preview-room',
        creatorId: session?.id ?? 'preview-user',
        startPoint,
        endPoint,
        placements,
      }),
    [currentRoom?.id, endPoint, placements, session?.id, startPoint],
  )
  const allBuildPlayersSubmitted =
    roomPlayers.length > 0 && roomPlayers.every((player) => player.isReady)
  const localBuildPlayer = roomPlayers.find((player) => player.id === session?.id)
  const hasLocalSubmitted = hasSubmittedRef.current || localBuildPlayer?.isReady === true
  const isBuildLocked = hasLocalSubmitted
  const advanceAfterBuild = useCallback(() => {
    if (hasAdvancedPhaseRef.current) {
      return
    }

    hasAdvancedPhaseRef.current = true
    onComplete()
  }, [onComplete])
  const handleSubmitSegment = useCallback(async () => {
    if (hasSubmittedRef.current) {
      return
    }

    if (!isEndpointHeightDeltaAllowed(startPoint, endPoint)) {
      setSubmitMessage(`시작점과 끝점 높이 차이는 ${MAX_ENDPOINT_VERTICAL_DELTA}칸 이하로 맞춰주세요.`)
      return
    }

    hasSubmittedRef.current = true
    setSubmitMessage('맵 스냅샷 저장 중')

    const didSubmit = await submitMapSegment({
      startPoint,
      endPoint,
      placements,
    })

    if (!didSubmit) {
      hasSubmittedRef.current = false
      setSubmitMessage('맵 스냅샷 저장에 실패했습니다.')
      return
    }

    setSubmitMessage('맵 스냅샷 저장 완료 · 다른 플레이어 대기')
  }, [endPoint, placements, startPoint, submitMapSegment])
  const { remainingSeconds, adjustSeconds } = usePhaseTimer(
    180,
    () => {
      void handleSubmitSegment()
    },
    phaseRemainingMs,
  )
  const realBuildPlayerCount = Math.max(1, countRealRoomPlayers(roomPlayers))
  const timeVoteMajority = Math.floor(realBuildPlayerCount / 2) + 1
  const isLocalTimeVoteMode = realtimeStatus !== 'connected' || phaseRemainingMs === null
  const externalBuildTimeVote = serverTimeVote?.phase === 'building' ? serverTimeVote : null
  const activeTimeVote = timeVote ?? externalBuildTimeVote
  const timeVoteCount = activeTimeVote?.voterIds.length ?? 0
  const timeVoteStatus =
    activeTimeVote === null
      ? timeVoteUsed
        ? '투표 사용 완료'
        : '한 페이즈 1회 투표 가능'
      : `${activeTimeVote.deltaSeconds > 0 ? '+15s' : '-15s'} 투표 ${timeVoteCount}/${timeVoteMajority} · ${
          activeTimeVote.applied
            ? '적용 완료'
            : activeTimeVote.approved
              ? '승인 완료'
              : '승인 대기'
        }`
  const submittedPlayerCount = roomPlayers.filter((player) => player.isReady).length
  const submissionStatusText =
    roomPlayers.length > 0
      ? `제출 ${submittedPlayerCount}/${roomPlayers.length}`
      : '제출 대기'

  useEffect(() => {
    if (selectedAssetId !== '' && buildAssets.some((asset) => asset.id === selectedAssetId)) {
      return
    }

    setSelectedAssetId(visibleShelfAssets[0]?.id ?? '')
  }, [buildAssets, selectedAssetId, visibleShelfAssets])

  useEffect(() => {
    if (hasInitializedTemplateRef.current || buildAssets.length === 0 || placements.length > 0) {
      return
    }

    const templatePlacements = buildDefaultMapTemplate(buildAssets, startPoint, endPoint)

    if (templatePlacements.length === 0) {
      return
    }

    hasInitializedTemplateRef.current = true
    setPlacements(templatePlacements)
    setEditorMessage('기본 맵 템플릿을 불러왔습니다. 발판을 옮기거나 지우며 편집하세요.')
  }, [buildAssets, endPoint, placements.length, startPoint])

  useEffect(() => {
    if (
      selectedPlacementId === '' ||
      placements.some((placement) => placement.id === selectedPlacementId)
    ) {
      return
    }

    setSelectedPlacementId('')
  }, [placements, selectedPlacementId])

  useEffect(() => {
    if (!isBuildLocked) {
      return
    }

    setSelectedPlacementId('')
    setEditorMessage('맵이 잠겼습니다. 저장된 스냅샷 기준으로 검증을 기다립니다.')
  }, [isBuildLocked])

  useEffect(() => {
    if (externalBuildTimeVote === null) {
      return
    }

    setTimeVote((currentVote) =>
      mergeBuildTimeVoteState(currentVote, {
        deltaSeconds: externalBuildTimeVote.deltaSeconds,
        voterIds: externalBuildTimeVote.voterIds,
        approved: externalBuildTimeVote.approved,
        applied: externalBuildTimeVote.applied,
      }),
    )
  }, [externalBuildTimeVote])

  useEffect(() => {
    if (!allBuildPlayersSubmitted || hasAdvancedPhaseRef.current) {
      return undefined
    }

    setSubmitMessage('모든 플레이어 제출 완료 · 검증으로 이동합니다.')
    const timeoutId = window.setTimeout(advanceAfterBuild, 500)

    return () => window.clearTimeout(timeoutId)
  }, [advanceAfterBuild, allBuildPlayersSubmitted])

  useEffect(() => {
    if (
      timeVote === null ||
      timeVote.applied ||
      !isLocalTimeVoteMode ||
      realBuildPlayerCount >= 2 ||
      timeVote.voterIds.length >= timeVoteMajority
    ) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setTimeVote((currentVote) => {
        if (currentVote === null || currentVote.applied) {
          return currentVote
        }

        const neededVotes = Math.max(0, timeVoteMajority - currentVote.voterIds.length)
        const supporterIds = roomPlayers
          .map((player) => player.id)
          .filter(
            (playerId) =>
              isAutoMockRoomPlayerId(
                playerId,
                roomPlayers.some((player) => player.id.startsWith('mock-host-')),
              ) && !currentVote.voterIds.includes(playerId),
          )
          .slice(0, neededVotes)

        if (supporterIds.length === 0) {
          return currentVote
        }

        return { ...currentVote, voterIds: [...currentVote.voterIds, ...supporterIds] }
      })
    }, 650)

    return () => window.clearTimeout(timeoutId)
  }, [isLocalTimeVoteMode, realBuildPlayerCount, roomPlayers, timeVote, timeVoteMajority])

  useEffect(() => {
    if (timeVote === null || timeVote.applied || timeVote.voterIds.length < timeVoteMajority) {
      return
    }

    if (isLocalTimeVoteMode) {
      adjustSeconds(timeVote.deltaSeconds)
    }

    setTimeVote((currentVote) =>
      currentVote === null ? currentVote : { ...currentVote, approved: true, applied: true },
    )
  }, [adjustSeconds, isLocalTimeVoteMode, timeVote, timeVoteMajority])

  const placeAssetAt = (asset: Asset, x: number, y: number) => {
    if (isBuildLocked) {
      setEditorMessage('제출 완료 후에는 맵을 수정할 수 없습니다.')
      return
    }

    const nextRect = getAssetGridRect(x, y, asset)
    const placementCost = getAssetPlacementCost(asset)

    if (!isRectInsideBoard(nextRect)) {
      setEditorMessage('보드 밖으로 나가는 에셋은 배치할 수 없습니다.')
      return
    }

    if (doesRectCoverPoint(nextRect, startPoint) || doesRectCoverPoint(nextRect, endPoint)) {
      setEditorMessage('시작점과 끝점 위에는 에셋을 배치할 수 없습니다.')
      return
    }

    const overlappingPlacement = placements.find((placement) =>
      doGridRectsOverlap(nextRect, getPlacementGridRect(placement)),
    )

    if (overlappingPlacement !== undefined) {
      setEditorMessage(`${overlappingPlacement.asset.name}와 겹칩니다.`)
      return
    }

    if (placementBudgetUsed + placementCost > BUILD_PLACEMENT_BUDGET) {
      setEditorMessage(
        `배치 비용 초과 · 현재 ${placementBudgetUsed}/${BUILD_PLACEMENT_BUDGET}, 선택 ${placementCost}`,
      )
      return
    }

    const nextPlacement = {
      id: createClientId('placement'),
      x,
      y,
      asset,
    }

    setPlacements((currentPlacements) => [...currentPlacements, nextPlacement])
    setSelectedPlacementId(nextPlacement.id)
    setEditorMessage(
      `${asset.name} 배치 · ${nextRect.width}x${nextRect.height}칸 · 비용 ${placementCost}`,
    )
    setUsageCounts((currentCounts) => ({
      ...currentCounts,
      [asset.id]: (currentCounts[asset.id] ?? 0) + 1,
    }))
  }

  const handleAssetDragStart = (asset: Asset, event: ReactDragEvent<HTMLButtonElement>) => {
    if (isBuildLocked) {
      event.preventDefault()
      setEditorMessage('제출 완료 후에는 에셋을 추가할 수 없습니다.')
      return
    }

    event.dataTransfer.setData(MAP_ASSET_DRAG_TYPE, asset.id)
    event.dataTransfer.effectAllowed = 'copy'
    setSelectedAssetId(asset.id)
    setEditorTool('place')
  }

  const handleAssetDrop = (assetId: string, x: number, y: number) => {
    if (isBuildLocked) {
      setEditorMessage('제출 완료 후에는 맵을 수정할 수 없습니다.')
      return
    }

    const asset = buildAssets.find((buildAsset) => buildAsset.id === assetId)

    if (asset === undefined) {
      setEditorMessage('드롭한 에셋을 찾을 수 없습니다.')
      return
    }

    setSelectedAssetId(asset.id)
    setEditorTool('place')
    placeAssetAt(asset, x, y)
  }

  const handleCellClick = (x: number, y: number) => {
    if (isBuildLocked) {
      setEditorMessage('제출 완료 후에는 맵을 수정할 수 없습니다.')
      return
    }

    if (editorTool === 'select') {
      const targetPlacement = [...placements]
        .reverse()
        .find((placement) => doesPlacementCoverCell(placement, x, y))

      if (targetPlacement === undefined) {
        setSelectedPlacementId('')
        setEditorMessage('선택을 해제했습니다.')
        return
      }

      setSelectedPlacementId(targetPlacement.id)
      setEditorMessage(
        `${targetPlacement.asset.name} 선택 · ${targetPlacement.x},${targetPlacement.y}`,
      )
      return
    }

    if (editorTool === 'start') {
      if (x === endPoint.x && y === endPoint.y) {
        setEditorMessage('시작점과 끝점은 같은 칸에 둘 수 없습니다.')
        return
      }

      if (placements.some((placement) => doesPlacementCoverCell(placement, x, y))) {
        setEditorMessage('에셋이 있는 칸에는 시작점을 둘 수 없습니다.')
        return
      }

      const nextStartPoint = { x, y }

      if (!isEndpointHeightDeltaAllowed(nextStartPoint, endPoint)) {
        setEditorMessage(
          `시작점과 끝점의 높이 차이는 ${MAX_ENDPOINT_VERTICAL_DELTA}칸 이하만 허용됩니다.`,
        )
        return
      }

      setStartPoint(nextStartPoint)
      setEditorMessage(`시작점을 ${x},${y}로 옮겼습니다.`)
      return
    }

    if (editorTool === 'goal') {
      if (x === startPoint.x && y === startPoint.y) {
        setEditorMessage('끝점과 시작점은 같은 칸에 둘 수 없습니다.')
        return
      }

      if (placements.some((placement) => doesPlacementCoverCell(placement, x, y))) {
        setEditorMessage('에셋이 있는 칸에는 끝점을 둘 수 없습니다.')
        return
      }

      const nextEndPoint = { x, y }

      if (!isEndpointHeightDeltaAllowed(startPoint, nextEndPoint)) {
        setEditorMessage(
          `시작점과 끝점의 높이 차이는 ${MAX_ENDPOINT_VERTICAL_DELTA}칸 이하만 허용됩니다.`,
        )
        return
      }

      setEndPoint(nextEndPoint)
      setEditorMessage(`끝점을 ${x},${y}로 옮겼습니다.`)
      return
    }

    if (editorTool === 'erase') {
      const targetPlacement = [...placements]
        .reverse()
        .find((placement) => doesPlacementCoverCell(placement, x, y))

      if (targetPlacement === undefined) {
        setEditorMessage('삭제할 에셋이 없는 칸입니다.')
        return
      }

      setPlacements((currentPlacements) =>
        currentPlacements.filter((placement) => placement.id !== targetPlacement.id),
      )
      if (selectedPlacementId === targetPlacement.id) {
        setSelectedPlacementId('')
      }
      setEditorMessage(`${targetPlacement.asset.name} 삭제`)
      return
    }

    if (editorTool === 'move') {
      const targetPlacement = [...placements]
        .reverse()
        .find((placement) => doesPlacementCoverCell(placement, x, y))

      if (selectedPlacement === null) {
        if (targetPlacement === undefined) {
          setEditorMessage('이동할 에셋을 먼저 선택하세요.')
          return
        }

        setSelectedPlacementId(targetPlacement.id)
        setEditorMessage(`${targetPlacement.asset.name} 선택 · 옮길 빈 칸을 누르세요.`)
        return
      }

      if (targetPlacement !== undefined && targetPlacement.id !== selectedPlacement.id) {
        setSelectedPlacementId(targetPlacement.id)
        setEditorMessage(`${targetPlacement.asset.name} 선택 · 옮길 빈 칸을 누르세요.`)
        return
      }

      const nextRect = getAssetGridRect(x, y, selectedPlacement.asset)

      if (x === selectedPlacement.x && y === selectedPlacement.y) {
        setEditorMessage(`${selectedPlacement.asset.name}가 이미 그 위치에 있습니다.`)
        return
      }

      if (!isRectInsideBoard(nextRect)) {
        setEditorMessage('보드 밖으로 나가는 에셋은 이동할 수 없습니다.')
        return
      }

      if (doesRectCoverPoint(nextRect, startPoint) || doesRectCoverPoint(nextRect, endPoint)) {
        setEditorMessage('시작점과 끝점 위로는 에셋을 이동할 수 없습니다.')
        return
      }

      const overlappingPlacement = placements
        .filter((placement) => placement.id !== selectedPlacement.id)
        .find((placement) => doGridRectsOverlap(nextRect, getPlacementGridRect(placement)))

      if (overlappingPlacement !== undefined) {
        setEditorMessage(`${overlappingPlacement.asset.name}와 겹칩니다.`)
        return
      }

      setPlacements((currentPlacements) =>
        currentPlacements.map((placement) =>
          placement.id === selectedPlacement.id ? { ...placement, x, y } : placement,
        ),
      )
      setEditorMessage(`${selectedPlacement.asset.name} 이동 · ${x},${y}`)
      return
    }

    if (selectedAsset === null) {
      setEditorMessage('먼저 배치할 에셋을 선택하세요.')
      return
    }

    placeAssetAt(selectedAsset, x, y)
  }

  const handleTimeVote = (deltaSeconds: number) => {
    if (timeVoteUsed) {
      return
    }

    requestTimeVote(deltaSeconds)
    setTimeVoteUsed(true)

    if (isLocalTimeVoteMode) {
      setTimeVote((currentVote) =>
        mergeBuildTimeVoteState(currentVote, {
          deltaSeconds,
          voterIds: [session?.id ?? 'me'],
          approved: false,
          applied: false,
        }),
      )
    }
  }

  const adjustEditorZoom = (delta: number) => {
    setEditorZoom((currentZoom) => Math.min(1.5, Math.max(0.75, currentZoom + delta)))
  }

  const openBuildTest = () => {
    setBuildTestCleared(false)
    setBuildTestResetSignal((currentSignal) => currentSignal + 1)
    setBuildTestOpen(true)
  }

  return (
    <div
      className={[
        'room-phase editor-phase',
        isAssetShelfCollapsed ? 'is-shelf-collapsed' : '',
        isToolDockCollapsed ? 'is-tools-collapsed' : '',
        isBuildLocked ? 'is-build-locked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside className={`asset-shelf ${isAssetShelfCollapsed ? 'is-collapsed' : ''}`}>
        {isAssetShelfCollapsed ? (
          <button
            type="button"
            className="panel-rail-button"
            aria-label="에셋 창고 펼치기"
            onClick={() => setAssetShelfCollapsed(false)}
          >
            <span aria-hidden="true">›</span>
            에셋
          </button>
        ) : (
          <>
            <div className="panel-title-row">
              <h2>에셋 창고</h2>
              <button
                type="button"
                className="panel-icon-button"
                aria-label="에셋 창고 접기"
                onClick={() => setAssetShelfCollapsed(true)}
              >
                <span aria-hidden="true">‹</span>
              </button>
            </div>
            <div className="shelf-tabs">
              <button
                type="button"
                className={assetSource === 'system' ? 'is-active' : ''}
                onClick={() => setAssetSource('system')}
              >
                제공 에셋
              </button>
              <button
                type="button"
                className={assetSource === 'mine' ? 'is-active' : ''}
                onClick={() => setAssetSource('mine')}
              >
                내 에셋
              </button>
            </div>
            <div className="shelf-category-tabs">
              {(['platform', 'obstacle', 'monster', 'item', 'background'] as Exclude<
                AssetCategory,
                'avatar'
              >[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  className={categoryFilter === category ? 'is-active' : ''}
                  onClick={() => setCategoryFilter(category)}
                >
                  {categoryLabels[category]}
                </button>
              ))}
            </div>
            <div className="shelf-list">
              {visibleShelfAssets.length > 0 ? (
                visibleShelfAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    draggable={!isBuildLocked}
                    disabled={isBuildLocked}
                    className={selectedAsset?.id === asset.id ? 'is-active' : ''}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onDragStart={(event) => handleAssetDragStart(asset, event)}
                  >
                    <AssetPreview asset={asset} size="medium" />
                    <span>{asset.name}</span>
                  </button>
                ))
              ) : (
                <div className="shelf-empty">
                  <strong>표시할 에셋 없음</strong>
                  <span>다른 분류를 선택하거나 에셋을 만들어보세요.</span>
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      <section className="map-editor-panel">
        {frequentAssets.length > 0 ? (
          <div className="frequent-asset-bar">
            {frequentAssets.map((asset) => (
              <div
                key={asset.id}
                className={selectedAsset?.id === asset.id ? 'is-active' : ''}
              >
                <button
                  type="button"
                  draggable={!isBuildLocked}
                  disabled={isBuildLocked}
                  onClick={() => setSelectedAssetId(asset.id)}
                  onDragStart={(event) => handleAssetDragStart(asset, event)}
                >
                  <span>{asset.name}</span>
                  <small>{usageCounts[asset.id]}회</small>
                </button>
                <button
                  type="button"
                  aria-label={`${asset.name} 자주 사용 목록에서 제거`}
                  onClick={() => setHiddenFrequentAssetIds((ids) => [...ids, asset.id])}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="editor-toolbar">
          <strong>32x32 그리드 스냅</strong>
          <span>남은 시간 {formatTimer(remainingSeconds)}</span>
          <small>
            S {startPoint.x},{startPoint.y} · G {endPoint.x},{endPoint.y} · 높이차{' '}
            {getEndpointVerticalDelta(startPoint, endPoint)}/{MAX_ENDPOINT_VERTICAL_DELTA}
          </small>
          <small>
            비용 {placementBudgetUsed}/{BUILD_PLACEMENT_BUDGET} · 선택 {selectedAssetPlacementCost}
          </small>
          <em className="editor-message">{editorMessage}</em>
          {isBuildLocked ? (
            <em className="build-lock-status">맵 잠김 · 저장된 스냅샷을 검증합니다</em>
          ) : null}
          <button
            type="button"
            className="secondary-action"
            disabled={timeVoteUsed}
            onClick={() => handleTimeVote(15)}
          >
            +15s
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={timeVoteUsed || remainingSeconds <= 15}
            onClick={() => handleTimeVote(-15)}
          >
            -15s
          </button>
          <em className={activeTimeVote?.applied ? 'vote-status is-applied' : 'vote-status'}>
            {timeVoteStatus}
          </em>
          {submitMessage ? <em>{submitMessage}</em> : null}
        </div>
        <Suspense fallback={<div className="phaser-map-loading">맵 에디터 불러오는 중</div>}>
          <MapEditorCanvas
            placements={placements}
            selectedAsset={selectedAsset}
            selectedPlacementId={selectedPlacementId}
            tool={editorTool}
            toolLabel={mapEditorToolLabels[editorTool]}
            canAffordSelectedAsset={canAffordSelectedAsset}
            isLocked={isBuildLocked}
            zoom={editorZoom}
            onToggleCell={handleCellClick}
            onDropAsset={handleAssetDrop}
            getEndpointLabel={getEndpointLabelForEditor}
          />
        </Suspense>
      </section>

      <aside className={`tool-dock ${isToolDockCollapsed ? 'is-collapsed' : ''}`}>
        {isToolDockCollapsed ? (
          <button
            type="button"
            className="panel-rail-button"
            aria-label="제작 도구 펼치기"
            onClick={() => setToolDockCollapsed(false)}
          >
            <span aria-hidden="true">‹</span>
            도구
          </button>
        ) : (
          <>
            <div className="panel-title-row">
              <h2>제작 도구</h2>
              <button
                type="button"
                className="panel-icon-button"
                aria-label="제작 도구 접기"
                onClick={() => setToolDockCollapsed(true)}
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>
            <button
              type="button"
              className={editorTool === 'select' ? 'is-active' : ''}
              disabled={isBuildLocked}
              onClick={() => setEditorTool('select')}
            >
              선택
            </button>
            <button
              type="button"
              className={editorTool === 'place' ? 'is-active' : ''}
              disabled={isBuildLocked}
              onClick={() => setEditorTool('place')}
            >
              배치
            </button>
            <button
              type="button"
              className={editorTool === 'move' ? 'is-active' : ''}
              disabled={isBuildLocked}
              onClick={() => setEditorTool('move')}
            >
              이동
            </button>
            <button
              type="button"
              className={editorTool === 'erase' ? 'is-active' : ''}
              disabled={isBuildLocked}
              onClick={() => setEditorTool('erase')}
            >
              삭제
            </button>
            <button
              type="button"
              className={editorTool === 'start' ? 'is-active' : ''}
              disabled={isBuildLocked}
              onClick={() => setEditorTool('start')}
            >
              시작점
            </button>
            <button
              type="button"
              className={editorTool === 'goal' ? 'is-active' : ''}
              disabled={isBuildLocked}
              onClick={() => setEditorTool('goal')}
            >
              끝점
            </button>
            {selectedPlacement !== null ? (
              <div className="selected-placement-card">
                <span>선택됨</span>
                <strong>{selectedPlacement.asset.name}</strong>
                <small>
                  {selectedPlacement.x},{selectedPlacement.y} ·{' '}
                  {selectedPlacement.asset.widthCells ?? 1}x
                  {selectedPlacement.asset.heightCells ?? 1}
                </small>
                <button type="button" onClick={() => setSelectedPlacementId('')}>
                  선택 해제
                </button>
              </div>
            ) : null}
            <div className="map-zoom-controls">
              <span>{Math.round(editorZoom * 100)}%</span>
              <button
                type="button"
                aria-label="맵 축소"
                disabled={editorZoom <= 0.75}
                onClick={() => adjustEditorZoom(-0.25)}
              >
                -
              </button>
              <button
                type="button"
                aria-label="맵 확대"
                disabled={editorZoom >= 1.5}
                onClick={() => adjustEditorZoom(0.25)}
              >
                +
              </button>
              <button type="button" onClick={() => setEditorZoom(1)}>
                100%
              </button>
            </div>
            <div className="build-submit-card">
              <span>제작 완료</span>
              <strong>{placements.length}개 배치</strong>
              <small>{submissionStatusText}</small>
              {roomPlayers.length > 0 ? (
                <div className="build-submit-list" aria-label="맵 제출 현황">
                  {roomPlayers.map((player) => (
                    <div className="build-submit-player" key={player.id}>
                      <span>{player.nickname}</span>
                      <small className={player.isReady ? 'is-submitted' : undefined}>
                        {player.isReady ? '제출 완료' : '제작 중'}
                      </small>
                    </div>
                  ))}
                </div>
              ) : null}
              <small>스냅샷 저장 후 맵이 잠기고 검증 페이즈로 이동합니다.</small>
              <button type="button" className="secondary-action" onClick={openBuildTest}>
                테스트 하기
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={hasLocalSubmitted}
                onClick={() => void handleSubmitSegment()}
              >
                {hasLocalSubmitted ? '제출 완료' : '제작 완료'}
              </button>
            </div>
          </>
        )}
      </aside>

      {isBuildTestOpen ? (
        <BuildTestModal
          segment={buildTestSegment}
          isCleared={isBuildTestCleared}
          resetSignal={buildTestResetSignal}
          onClear={() => setBuildTestCleared(true)}
          onReset={() => {
            setBuildTestCleared(false)
            setBuildTestResetSignal((currentSignal) => currentSignal + 1)
          }}
          onClose={() => setBuildTestOpen(false)}
        />
      ) : null}
    </div>
  )
}

function BuildTestModal({
  segment,
  isCleared,
  resetSignal,
  onClear,
  onReset,
  onClose,
}: {
  segment: MapSegmentSnapshot
  isCleared: boolean
  resetSignal: number
  onClear: () => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="build-test-modal" role="dialog" aria-modal="true" aria-label="맵 테스트">
        <div className="section-head">
          <div>
            <p className="eyebrow">Playtest</p>
            <h1>맵 테스트</h1>
          </div>
          <button type="button" className="subtle-action" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="build-test-status">
          <span>{isCleared ? '테스트 성공' : '테스트 중'}</span>
          <strong>
            S {segment.startPoint.x},{segment.startPoint.y} · G {segment.endPoint.x},
            {segment.endPoint.y}
          </strong>
          <small>에셋 {segment.assetRefs.length}개 · 현재 제작 스냅샷 기준</small>
        </div>
        <section className="playtest-canvas">
          <Suspense fallback={<div className="playtest-loading">테스트 캔버스 불러오는 중</div>}>
            <PlaytestCanvas
              isCleared={isCleared}
              segment={segment}
              resetSignal={resetSignal}
              onClear={onClear}
            />
          </Suspense>
        </section>
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onReset}>
            다시 시작
          </button>
          <button type="button" className="primary-action" onClick={onClose}>
            편집 계속
          </button>
        </div>
      </section>
    </div>
  )
}

function ValidationPhase({ onComplete }: { onComplete: () => void }) {
  const currentSegment = useAppStore((state) => state.currentSegment)
  const validateCurrentSegment = useAppStore((state) => state.validateCurrentSegment)
  const players = useAppStore((state) => state.roomPlayers)
  const session = useAppStore((state) => state.session)
  const phaseRemainingMs = useAppStore((state) => state.phaseRemainingMs)
  const validationStartedAtRef = useRef(Date.now())
  const hasRecordedValidationRef = useRef(false)
  const hasAdvancedPhaseRef = useRef(false)
  const [playtestResetSignal, setPlaytestResetSignal] = useState(0)
  const [validationMessage, setValidationMessage] = useState('')
  const me = players.find((player) => player.id === session?.id)
  const hasLocalValidationRecord = hasRecordedValidationRef.current || me?.isReady === true
  const localValidationStatus = getValidationStatusView(me, hasLocalValidationRecord)
  const allValidationRecordsReady =
    players.length > 0 && players.every((player) => player.isReady)
  const advanceAfterValidation = useCallback(() => {
    if (hasAdvancedPhaseRef.current) {
      return
    }

    hasAdvancedPhaseRef.current = true
    onComplete()
  }, [onComplete])
  const recordValidation = useCallback(
    async (cleared: boolean) => {
      if (hasRecordedValidationRef.current) {
        return true
      }

      hasRecordedValidationRef.current = true
      const clearTimeMs = Date.now() - validationStartedAtRef.current
      const didRecord = await validateCurrentSegment(cleared, clearTimeMs)

      if (!didRecord) {
        hasRecordedValidationRef.current = false
        setValidationMessage('검증 기록에 실패했습니다. 다시 시도해주세요.')
      } else {
        setValidationMessage(
          cleared
            ? '검증 성공 기록 완료 · 다른 플레이어 대기'
            : '검증 실패 기록 완료 · 다른 플레이어 대기',
        )
      }

      return didRecord
    },
    [validateCurrentSegment],
  )
  const handleProceed = useCallback(async () => {
    if (!hasRecordedValidationRef.current) {
      await recordValidation(false)
    }
  }, [recordValidation])
  const { remainingSeconds } = usePhaseTimer(
    120,
    () => {
      void handleProceed()
    },
    phaseRemainingMs,
  )

  const handleClear = async () => {
    await recordValidation(true)
  }

  useEffect(() => {
    if (!allValidationRecordsReady || hasAdvancedPhaseRef.current) {
      return undefined
    }

    setValidationMessage('모든 플레이어 검증 기록 완료 · 맵 병합으로 이동합니다.')
    const timeoutId = window.setTimeout(advanceAfterValidation, 500)

    return () => window.clearTimeout(timeoutId)
  }, [advanceAfterValidation, allValidationRecordsReady])

  return (
    <div className="room-phase validation-phase">
      <section className="playtest-canvas">
        <Suspense fallback={<div className="playtest-loading">검증 캔버스 불러오는 중</div>}>
          <PlaytestCanvas
            isCleared={me?.validationCleared ?? false}
            segment={currentSegment}
            resetSignal={playtestResetSignal}
            onClear={handleClear}
          />
        </Suspense>
      </section>
      <aside className="phase-panel">
        <h2>검증 페이즈</h2>
        <div className="phase-timer">{formatTimer(remainingSeconds)}</div>
        <p>자신이 만든 맵을 직접 플레이해 GOAL에 닿으면 검증 성공으로 기록됩니다.</p>
        <div className={`validation-local-card ${localValidationStatus.className}`}>
          <span>내 검증 결과</span>
          <strong>{localValidationStatus.title}</strong>
          <small>{localValidationStatus.description}</small>
        </div>
        <div className="segment-summary">
          <span>스냅샷</span>
          <strong>{currentSegment?.segmentHash ?? '저장 없음'}</strong>
          {currentSegment !== null ? (
            <small>
              에셋 {currentSegment.assetRefs.length}개 · S {currentSegment.startPoint.x},
              {currentSegment.startPoint.y} · G {currentSegment.endPoint.x},
              {currentSegment.endPoint.y}
            </small>
          ) : null}
        </div>
        <div className="validation-status-list" aria-label="플레이어별 검증 현황">
          {players.map((player) => (
            <div
              key={player.id}
              className={player.validationCleared ? 'player-row is-validated' : 'player-row'}
            >
              <strong>{player.nickname}</strong>
              <span>
                {player.validationCleared
                  ? '검증 성공'
                  : player.isReady
                    ? '실패 기록'
                    : '검증 중'}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="secondary-action"
          disabled={me?.validationCleared || currentSegment === null}
          onClick={() => setPlaytestResetSignal((currentSignal) => currentSignal + 1)}
        >
          {me?.validationCleared ? '검증 성공' : '처음부터 다시'}
        </button>
        {validationMessage ? <p className="phase-message">{validationMessage}</p> : null}
        <button
          type="button"
          className="primary-action"
          disabled={hasLocalValidationRecord}
          onClick={() => void handleProceed()}
        >
          {hasLocalValidationRecord ? '기록 완료' : me?.validationCleared ? '레이스 준비' : '실패로 진행'}
        </button>
      </aside>
    </div>
  )
}

function MergingPhase({ onComplete }: { onComplete: () => void }) {
  const currentRoom = useAppStore((state) => state.currentRoom)
  const mapSegments = useAppStore((state) => state.mapSegments)
  const mergedMap = useAppStore((state) => state.mergedMap)
  const mergeCurrentRoomMap = useAppStore((state) => state.mergeCurrentRoomMap)
  const hasStartedRef = useRef(false)
  const validatedSegments = mapSegments.filter(
    (segment) => segment.roomId === currentRoom?.id && segment.isValidated,
  )
  const mergedVerticalDelta =
    mergedMap === null ? 0 : Math.abs(mergedMap.globalEnd.y - mergedMap.globalStart.y)

  useEffect(() => {
    if (hasStartedRef.current) {
      return undefined
    }

    hasStartedRef.current = true
    let isMounted = true
    let timeoutId: number | null = null
    const startedAt = Date.now()

    void (async () => {
      await mergeCurrentRoomMap()

      if (!isMounted) {
        return
      }

      const remainingDelayMs = Math.max(0, 1400 - (Date.now() - startedAt))
      timeoutId = window.setTimeout(() => {
        if (isMounted) {
          onComplete()
        }
      }, remainingDelayMs)
    })()

    return () => {
      isMounted = false

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [mergeCurrentRoomMap, onComplete])

  return (
    <div className="room-phase merging-phase">
      <section className="phase-panel merging-panel">
        <p className="eyebrow">Merging</p>
        <h2>맵 조각 병합 중</h2>
        <p>
          검증 성공 세그먼트를 섞고 시작점과 끝점을 이어 전역 레이스 맵을 만들고 있습니다.
        </p>
        <div className="merge-progress">
          <div></div>
        </div>
        <div className="merge-stat-grid">
          <div>
            <span>검증 성공</span>
            <strong>{validatedSegments.length}</strong>
          </div>
          <div>
            <span>사용 세그먼트</span>
            <strong>{mergedMap?.segments.length ?? 0}</strong>
          </div>
          <div>
            <span>전역 에셋</span>
            <strong>{mergedMap?.placements.length ?? 0}</strong>
          </div>
          <div>
            <span>Y 연결</span>
            <strong>{mergedVerticalDelta}칸</strong>
          </div>
        </div>
        {mergedMap?.usedFallback ? (
          <p className="extension-note">검증 성공 세그먼트가 없어 기본 세그먼트를 사용합니다.</p>
        ) : null}
      </section>
    </div>
  )
}

function RacePhase({ onComplete }: { onComplete: () => void }) {
  const players = useAppStore((state) => state.roomPlayers)
  const session = useAppStore((state) => state.session)
  const mergedMap = useAppStore((state) => state.mergedMap)
  const updateRaceProgress = useAppStore((state) => state.updateRaceProgress)
  const recordRaceFinish = useAppStore((state) => state.recordRaceFinish)
  const broadcastRacePosition = useAppStore((state) => state.broadcastRacePosition)
  const racePositions = useAppStore((state) => state.racePositions)
  const phaseRemainingMs = useAppStore((state) => state.phaseRemainingMs)
  const serverIsRaceOvertime = useAppStore((state) => state.isRaceOvertime)
  const [localRemainingSeconds, setLocalRemainingSeconds] = useState(300)
  const [localIsExtended, setLocalExtended] = useState(false)
  const hasCompletedRef = useRef(false)
  const hasServerRaceTimer = phaseRemainingMs !== null
  const remainingSeconds = hasServerRaceTimer
    ? Math.ceil(Math.max(0, phaseRemainingMs) / 1000)
    : localRemainingSeconds
  const isExtended = hasServerRaceTimer ? serverIsRaceOvertime : localIsExtended
  const elapsedSeconds = isExtended ? 300 + (30 - remainingSeconds) : 300 - remainingSeconds
  const hasAnyFinisher = players.some((player) => player.raceFinishedAtMs !== null)

  const finishRace = useCallback(() => {
    if (hasCompletedRef.current) {
      return
    }

    hasCompletedRef.current = true
    onComplete()
  }, [onComplete])
  const handleRaceProgress = useCallback(
    (progressById: Record<string, number>, localPosition?: Omit<RacePositionSnapshot, 'userId'>) => {
      updateRaceProgress(progressById)

      if (
        session?.id !== undefined &&
        progressById[session.id] !== undefined &&
        localPosition !== undefined
      ) {
        broadcastRacePosition(localPosition)
      }

      Object.entries(progressById).forEach(([playerId, progress]) => {
        if (progress >= 100) {
          recordRaceFinish(playerId, Math.max(0, elapsedSeconds) * 1000)
        }
      })
    },
    [broadcastRacePosition, elapsedSeconds, recordRaceFinish, session?.id, updateRaceProgress],
  )
  const handleLocalFinish = useCallback(() => {
    if (session?.id !== undefined) {
      recordRaceFinish(session.id, Math.max(0, elapsedSeconds) * 1000)
    }
  }, [elapsedSeconds, recordRaceFinish, session?.id])

  useEffect(() => {
    if (hasServerRaceTimer) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setLocalRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          if (!localIsExtended) {
            if (hasAnyFinisher) {
              window.setTimeout(finishRace, 0)
              return 0
            }

            setLocalExtended(true)
            return 30
          }

          if (!hasCompletedRef.current) {
            window.setTimeout(finishRace, 0)
          }

          return 0
        }

        return currentSeconds - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [finishRace, hasAnyFinisher, hasServerRaceTimer, localIsExtended])

  useEffect(() => {
    if (
      players.length === 0 ||
      hasCompletedRef.current ||
      players.some((player) => player.raceFinishedAtMs === null)
    ) {
      return undefined
    }

    const timeoutId = window.setTimeout(finishRace, 900)

    return () => window.clearTimeout(timeoutId)
  }, [finishRace, players])

  const rankedPlayers = rankRacePlayers(players)

  return (
    <div className="room-phase race-phase">
      <section className="race-canvas-panel">
        <Suspense fallback={<div className="race-loading">레이스 캔버스 불러오는 중</div>}>
          <RaceCanvas
            players={players}
            currentUserId={session?.id ?? null}
            mergedMap={mergedMap}
            racePositions={racePositions}
            isExtended={isExtended}
            elapsedSeconds={Math.max(0, elapsedSeconds)}
            onProgress={handleRaceProgress}
            onFinish={handleLocalFinish}
          />
        </Suspense>
      </section>
      <aside className="phase-panel">
        <h2>레이스</h2>
        <div className="phase-timer">{formatTimer(remainingSeconds)}</div>
        <p>검증 실패자는 시작 시 15초 동안 움직일 수 없고, 완주자가 없을 때만 30초 연장됩니다.</p>
        {mergedMap !== null ? (
          <div className="segment-summary">
            <span>병합 맵</span>
            <strong>{mergedMap.usedFallback ? '기본 세그먼트' : mergedMap.id}</strong>
            <small>
              세그먼트 {mergedMap.segments.length}개 · 에셋 {mergedMap.placements.length}개 · G{' '}
              {mergedMap.globalEnd.x},{mergedMap.globalEnd.y}
            </small>
          </div>
        ) : null}
        {isExtended ? <p className="extension-note">30초 연장전 · 현재 위치 기준 순위 산정</p> : null}
        <div className="race-status-list">
          {rankedPlayers.map((player, index) => (
            <div key={player.id} className="race-lane">
              <span>{index + 1}. {player.nickname}</span>
              <div className="progress-track">
                <div style={{ width: `${player.raceProgress}%` }}></div>
              </div>
              <strong>{raceResultLabel(player)}</strong>
            </div>
          ))}
        </div>
        <button type="button" className="primary-action" onClick={finishRace}>
          결과 보기
        </button>
      </aside>
    </div>
  )
}

function ResultsPhase() {
  const players = useAppStore((state) => state.roomPlayers)
  const leaveRoom = useAppStore((state) => state.leaveRoom)
  const sortedPlayers = rankRacePlayers(players)
  const finishedCount = players.filter((player) => player.raceFinishedAtMs !== null).length
  const unfinishedCount = Math.max(0, players.length - finishedCount)
  const penaltyCount = players.filter((player) => !player.validationCleared).length
  const winner = sortedPlayers[0] ?? null

  return (
    <div className="room-phase results-phase">
      <section className="phase-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Results</p>
            <h2>최종 순위</h2>
          </div>
          <span className="source-pill">
            완주 {finishedCount}/{players.length}
          </span>
        </div>
        <div className="result-summary-grid">
          <div>
            <span>우승</span>
            <strong>{winner?.nickname ?? '-'}</strong>
            <small>{winner === null ? '기록 없음' : raceResultLabel(winner)}</small>
          </div>
          <div>
            <span>판정 기준</span>
            <strong>{unfinishedCount > 0 ? '거리순 포함' : '완주 시간'}</strong>
            <small>미완주자는 GOAL까지 남은 거리순</small>
          </div>
          <div>
            <span>패널티</span>
            <strong>{penaltyCount}명</strong>
            <small>검증 실패 시 레이스 시작 15초 freeze</small>
          </div>
        </div>
        <div className="result-list">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={[
                'result-row',
                index === 0 ? 'is-winner' : '',
                player.validationCleared ? '' : 'has-penalty',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <strong>{index + 1}</strong>
              <div>
                <span>{player.nickname}</span>
                <small>{player.validationCleared ? '검증 성공' : '15초 freeze 적용'}</small>
              </div>
              <em>{raceResultLabel(player)}</em>
            </div>
          ))}
        </div>
        <button type="button" className="primary-action" onClick={leaveRoom}>
          로비로 돌아가기
        </button>
      </section>
    </div>
  )
}

function SettingsModal() {
  const session = useAppStore((state) => state.session)
  const settings = useAppStore((state) => state.settings)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const updateNickname = useAppStore((state) => state.updateNickname)
  const issueDeviceLinkCode = useAppStore((state) => state.issueDeviceLinkCode)
  const loadSessionByDeviceCode = useAppStore((state) => state.loadSessionByDeviceCode)
  const [nickname, setNickname] = useState(session?.nickname ?? '')
  const [deviceTicket, setDeviceTicket] = useState<DeviceLinkTicket | null>(null)
  const [deviceImportCode, setDeviceImportCode] = useState('')
  const [deviceLinkMessage, setDeviceLinkMessage] = useState('')
  const [isDeviceLinkBusy, setDeviceLinkBusy] = useState(false)

  const handleIssueDeviceCode = async () => {
    setDeviceLinkBusy(true)
    setDeviceLinkMessage('')

    const ticket = await issueDeviceLinkCode()

    if (ticket === null) {
      setDeviceLinkMessage('로그인 정보를 찾지 못했습니다.')
    } else {
      setDeviceTicket(ticket)
      setDeviceLinkMessage('연동 코드가 발급되었습니다.')
    }

    setDeviceLinkBusy(false)
  }

  const handleDeviceCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (deviceImportCode.trim().length === 0 || isDeviceLinkBusy) {
      return
    }

    setDeviceLinkBusy(true)
    setDeviceLinkMessage('')

    const didLoad = await loadSessionByDeviceCode(deviceImportCode)

    if (didLoad) {
      setDeviceImportCode('')
      setDeviceTicket(null)
      setDeviceLinkMessage('계정 정보를 불러왔습니다.')
    } else {
      setDeviceLinkMessage('유효한 연동 코드를 찾지 못했습니다.')
    }

    setDeviceLinkBusy(false)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="설정">
        <div className="section-head">
          <h1>설정</h1>
          <button type="button" className="subtle-action" onClick={() => setSettingsOpen(false)}>
            닫기
          </button>
        </div>
        <label className="field">
          <span>BGM</span>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.bgmVolume}
            disabled={settings.bgmMuted}
            onChange={(event) => updateSettings({ bgmVolume: Number(event.target.value) })}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.bgmMuted}
            onChange={(event) => updateSettings({ bgmMuted: event.target.checked })}
          />
          BGM 음소거
        </label>
        <label className="field">
          <span>효과음</span>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.sfxVolume}
            disabled={settings.sfxMuted}
            onChange={(event) => updateSettings({ sfxVolume: Number(event.target.value) })}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.sfxMuted}
            onChange={(event) => updateSettings({ sfxMuted: event.target.checked })}
          />
          효과음 음소거
        </label>
        <label className="field">
          <span>닉네임</span>
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
        </label>
        <button
          type="button"
          className="secondary-action"
          onClick={() => updateNickname(nickname.trim() || session?.nickname || 'player')}
        >
          닉네임 변경
        </button>
        <section className="device-link-panel">
          <div className="device-link-head">
            <div>
              <span>기기 연동</span>
              <strong>{deviceTicket?.code ?? '코드 없음'}</strong>
              {deviceTicket !== null ? (
                <small>{formatDeviceLinkExpiry(deviceTicket.expiresAt)}까지 유효</small>
              ) : null}
            </div>
            <button
              type="button"
              className="secondary-action"
              disabled={isDeviceLinkBusy}
              onClick={handleIssueDeviceCode}
            >
              코드 발급
            </button>
          </div>
          <form className="device-link-form" onSubmit={handleDeviceCodeSubmit}>
            <input
              value={deviceImportCode}
              placeholder="TIGER-3392"
              onChange={(event) => setDeviceImportCode(event.target.value)}
            />
            <button
              type="submit"
              className="primary-action"
              disabled={isDeviceLinkBusy || deviceImportCode.trim().length === 0}
            >
              불러오기
            </button>
          </form>
          {deviceLinkMessage ? <p>{deviceLinkMessage}</p> : null}
        </section>
      </section>
    </div>
  )
}

function AssetPreview({ asset, size }: { asset: Asset | null; size: 'medium' | 'large' }) {
  const className = [
    'asset-preview',
    size,
    asset?.status !== undefined && asset.status !== 'ready' ? `is-${asset.status}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const statusOverlay =
    asset !== null && asset.status !== 'ready' ? (
      <div className="asset-preview-status">
        <strong>{assetStatusOverlayLabel(asset)}</strong>
        <span>{asset.status === 'failed' ? '재시도 필요' : assetProgressLabel(asset)}</span>
      </div>
    ) : null

  if (asset?.sourceImageUrl) {
    return (
      <div className={className}>
        <img src={asset.sourceImageUrl} alt="" />
        {statusOverlay}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className={`fallback-shape ${asset?.category ?? 'avatar'}`}></div>
      {statusOverlay}
    </div>
  )
}

function getAttrGroups(category: StudioCategory) {
  return attrGroupsByCategory[category]
}

function getDefaultAttrSelections(category: StudioCategory) {
  return Object.fromEntries(
    getAttrGroups(category).map((group) => [group.key, group.choices[0].value]),
  ) as Record<string, string>
}

function normalizeAttrSelections(category: StudioCategory, selections: Record<string, string>) {
  const defaults = getDefaultAttrSelections(category)
  const normalizedSelections = { ...defaults }

  getAttrGroups(category).forEach((group) => {
    const currentValue = selections[group.key]

    if (group.choices.some((choice) => choice.value === currentValue)) {
      normalizedSelections[group.key] = currentValue
    }
  })

  return normalizedSelections
}

function getAttrSelectionsFromAsset(category: StudioCategory, attrs: AssetAttrRecord) {
  const defaults = getDefaultAttrSelections(category)
  const legacyPreset = typeof attrs.preset === 'string' ? attrs.preset : null
  const legacySelections = legacyPreset === null ? {} : getLegacyAttrSelections(category, legacyPreset)
  const compatAttrs: Record<string, string> =
    category === 'monster' && typeof attrs.hpPreset === 'string' && typeof attrs.health !== 'string'
      ? { health: attrs.hpPreset }
      : {}

  return normalizeAttrSelections(category, {
    ...defaults,
    ...legacySelections,
    ...compatAttrs,
    ...Object.fromEntries(
      Object.entries(attrs)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, String(value)]),
    ),
  })
}

function getLegacyAttrSelections(category: StudioCategory, preset: string) {
  if (category === 'platform') {
    if (preset === 'one-way-up') {
      return { collisionMode: 'one-way-up' }
    }

    if (preset === 'slope-floor') {
      return { shape: 'slope-floor-asc' }
    }

    return { collisionMode: 'solid' }
  }

  if (category === 'obstacle') {
    if (preset === 'instant-death') {
      return { contactEffect: 'instant-death' }
    }

    if (preset === 'proximity-trigger') {
      return { triggerMode: 'proximity-radius' }
    }

    return { contactEffect: 'damage' }
  }

  if (category === 'monster') {
    if (preset === 'static') {
      return { moveType: 'static' }
    }

    if (preset === 'unstompable') {
      return { stompReaction: 'harmful' }
    }

    return { moveType: 'ground-walk-normal' }
  }

  return { renderMode: 'decorative-static' }
}

function buildAssetAttrs(category: StudioCategory, selections: Record<string, string>) {
  return {
    schemaVersion: 'asset-attributes-v1',
    category,
    ...normalizeAttrSelections(category, selections),
  }
}

function getAssetAttributeRows(asset: Asset) {
  if (asset.category === 'avatar' || asset.category === 'item') {
    return []
  }

  const category = asset.category
  const selections = getAttrSelectionsFromAsset(category, asset.attrs)

  return getAttrGroups(category).map((group) => {
    const value = selections[group.key]
    const choice = group.choices.find((option) => option.value === value)

    return {
      label: group.label,
      value: choice?.label ?? value,
    }
  })
}

function getAssetPlacementCost(asset: Asset) {
  const area = Math.max(1, (asset.widthCells ?? 1) * (asset.heightCells ?? 1))

  if (asset.category === 'platform') {
    return area
  }

  if (asset.category === 'obstacle') {
    return area * 2
  }

  if (asset.category === 'monster') {
    return area * 5
  }

  if (asset.category === 'item') {
    return 2
  }

  return 0
}

function buildDefaultMapTemplate(
  assets: Asset[],
  startPoint: MapPoint,
  endPoint: MapPoint,
): MapPlacement[] {
  const platformAsset = findTemplatePlatformAsset(assets)

  if (platformAsset === null) {
    return []
  }

  const platformWidth = Math.max(1, platformAsset.widthCells ?? 1)
  const platformHeight = Math.max(1, platformAsset.heightCells ?? 1)
  const cells = [
    {
      x: Math.max(0, startPoint.x - 1),
      y: Math.min(EDITOR_BOARD.rows - platformHeight, startPoint.y + 1),
    },
    {
      x: Math.max(0, startPoint.x + 2),
      y: Math.min(EDITOR_BOARD.rows - platformHeight, startPoint.y + 1),
    },
    { x: 8, y: 8 },
    { x: 12, y: 7 },
    { x: 16, y: 6 },
    {
      x: Math.min(EDITOR_BOARD.cols - platformWidth, Math.max(0, endPoint.x - platformWidth + 1)),
      y: Math.min(EDITOR_BOARD.rows - platformHeight, endPoint.y + 1),
    },
  ]

  return cells
    .filter(
      (cell, index, currentCells) =>
        currentCells.findIndex(
          (currentCell) => currentCell.x === cell.x && currentCell.y === cell.y,
        ) === index,
    )
    .filter((cell) =>
      isRectInsideBoard({
        x: cell.x,
        y: cell.y,
        width: platformWidth,
        height: platformHeight,
      }),
    )
    .map((cell) => ({
      id: `template-${platformAsset.id}-${cell.x}-${cell.y}`,
      x: cell.x,
      y: cell.y,
      asset: platformAsset,
    }))
}

function findTemplatePlatformAsset(assets: Asset[]) {
  const solidSystemPlatform = assets.find(
    (asset) =>
      asset.isSystem &&
      asset.category === 'platform' &&
      asset.colliderType !== 'none' &&
      asset.attrs.collisionMode === 'solid' &&
      asset.attrs.materialization === 'always' &&
      asset.attrs.movementMode === 'fixed',
  )

  return (
    solidSystemPlatform ??
    assets.find(
      (asset) =>
        asset.category === 'platform' &&
        asset.colliderType !== 'none' &&
        asset.attrs.materialization !== 'hidden-until-hit',
    ) ??
    null
  )
}

function readStudioLayoutPreference(): StudioLayoutPreference {
  const defaultPreference: StudioLayoutPreference = {
    leftPanelWidth: 280,
    rightPanelWidth: 320,
    isToolPanelCollapsed: false,
    isPropertiesPanelCollapsed: false,
    leftSectionRatios: DEFAULT_STUDIO_PANEL_SECTION_RATIOS,
  }

  if (typeof window === 'undefined') {
    return defaultPreference
  }

  let rawValue: string | null = null

  try {
    rawValue = window.localStorage.getItem(STUDIO_LAYOUT_KEY)
  } catch {
    return defaultPreference
  }

  if (rawValue === null) {
    return defaultPreference
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StudioLayoutPreference>

    return {
      leftPanelWidth: clampStudioPanelWidth(Number(parsedValue.leftPanelWidth) || 280),
      rightPanelWidth: clampStudioPropertiesPanelWidth(Number(parsedValue.rightPanelWidth) || 320),
      isToolPanelCollapsed: parsedValue.isToolPanelCollapsed === true,
      isPropertiesPanelCollapsed: parsedValue.isPropertiesPanelCollapsed === true,
      leftSectionRatios: normalizeStudioPanelSectionRatios(parsedValue.leftSectionRatios),
    }
  } catch {
    try {
      window.localStorage.removeItem(STUDIO_LAYOUT_KEY)
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    return defaultPreference
  }
}

function saveStudioLayoutPreference(preference: StudioLayoutPreference) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STUDIO_LAYOUT_KEY, JSON.stringify(preference))
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function clampStudioPanelWidth(value: number) {
  return Math.min(STUDIO_LEFT_PANEL_MAX, Math.max(STUDIO_LEFT_PANEL_MIN, value))
}

function clampStudioPropertiesPanelWidth(value: number) {
  return Math.min(STUDIO_RIGHT_PANEL_MAX, Math.max(STUDIO_RIGHT_PANEL_MIN, value))
}

function normalizeStudioPanelSectionRatios(
  ratios: Partial<StudioPanelSectionRatios> | undefined,
): StudioPanelSectionRatios {
  const tools = Number(ratios?.tools) || DEFAULT_STUDIO_PANEL_SECTION_RATIOS.tools
  const palette = Number(ratios?.palette) || DEFAULT_STUDIO_PANEL_SECTION_RATIOS.palette
  const side = Number(ratios?.side) || DEFAULT_STUDIO_PANEL_SECTION_RATIOS.side
  const total = Math.max(1, tools + palette + side)

  return {
    tools: Math.max(STUDIO_PANEL_SECTION_MIN_RATIO, (tools / total) * 100),
    palette: Math.max(STUDIO_PANEL_SECTION_MIN_RATIO, (palette / total) * 100),
    side: Math.max(STUDIO_PANEL_SECTION_MIN_RATIO, (side / total) * 100),
  }
}

function resizeStudioPanelSectionRatios(
  ratios: StudioPanelSectionRatios,
  boundary: StudioPanelSectionBoundary,
  deltaRatio: number,
): StudioPanelSectionRatios {
  if (boundary === 'tools-palette') {
    const pairTotal = ratios.tools + ratios.palette
    const nextTools = clampSectionRatio(ratios.tools + deltaRatio, pairTotal)

    return {
      ...ratios,
      tools: nextTools,
      palette: pairTotal - nextTools,
    }
  }

  const pairTotal = ratios.palette + ratios.side
  const nextPalette = clampSectionRatio(ratios.palette + deltaRatio, pairTotal)

  return {
    ...ratios,
    palette: nextPalette,
    side: pairTotal - nextPalette,
  }
}

function clampSectionRatio(value: number, pairTotal: number) {
  const minRatio = Math.min(STUDIO_PANEL_SECTION_MIN_RATIO, pairTotal / 2)

  return Math.min(pairTotal - minRatio, Math.max(minRatio, value))
}

function clampCellValue(value: string) {
  const parsedValue = Number(value)

  if (Number.isNaN(parsedValue)) {
    return 1
  }

  return Math.min(8, Math.max(1, parsedValue))
}

function clipboardContainsFile(event: ClipboardEvent<HTMLElement>) {
  const { clipboardData } = event

  return (
    clipboardData.files.length > 0 ||
    Array.from(clipboardData.items).some(
      (item) => item.kind === 'file' || item.type.startsWith('image/'),
    )
  )
}

function dragEventContainsFile(event: ReactDragEvent<HTMLElement>) {
  const { dataTransfer } = event

  return (
    dataTransfer.files.length > 0 ||
    Array.from(dataTransfer.items).some((item) => item.kind === 'file')
  )
}

async function sampleImageColor(
  source: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  try {
    const image = await loadImageElement(source)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (context === null) {
      return null
    }

    canvas.width = width
    canvas.height = height
    context.drawImage(image, 0, 0, width, height)

    const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data

    if (alpha === 0) {
      return null
    }

    return rgbToHex(red, green, blue)
  } catch {
    return null
  }
}

async function sampleSketchExportColor(
  referenceImage: string,
  workspaceDrawingImage: string,
  x: number,
  y: number,
  exportFrame: { x: number; y: number; width: number; height: number },
) {
  const drawingImage = await cropImageRegion(
    workspaceDrawingImage,
    exportFrame.x,
    exportFrame.y,
    exportFrame.width,
    exportFrame.height,
  )
  const sampleImage = await composeSketchImage(
    referenceImage,
    drawingImage,
    exportFrame.width,
    exportFrame.height,
  )

  return sampleImageColor(sampleImage, x, y, exportFrame.width, exportFrame.height)
}

async function cropImageRegion(
  source: string,
  sourceX: number,
  sourceY: number,
  width: number,
  height: number,
) {
  try {
    const image = await loadImageElement(source)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (context === null) {
      return source
    }

    canvas.width = width
    canvas.height = height
    context.drawImage(image, sourceX, sourceY, width, height, 0, 0, width, height)

    return canvas.toDataURL('image/png')
  } catch {
    return source
  }
}

async function composeSketchImage(
  referenceImage: string,
  drawingImage: string,
  width: number,
  height: number,
) {
  try {
    const [referenceElement, drawingElement] = await Promise.all([
      loadImageElement(referenceImage),
      loadImageElement(drawingImage),
    ])
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (context === null) {
      return drawingImage
    }

    canvas.width = width
    canvas.height = height

    drawImageContained(context, referenceElement, width, height)
    context.drawImage(drawingElement, 0, 0, width, height)

    return canvas.toDataURL('image/png')
  } catch {
    return drawingImage
  }
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    if (!source.startsWith('data:')) {
      image.crossOrigin = 'anonymous'
    }

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load sketch image'))
    image.src = source
  })
}

function drawImageContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const imageWidth = image.naturalWidth || width
  const imageHeight = image.naturalHeight || height
  const scale = Math.min(width / imageWidth, height / imageHeight)
  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale

  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
}

function statusLabel(asset: Asset) {
  if (asset.status === 'queued') {
    return `대기 중 · 예상 ${assetRemainingTimeLabel(asset)}`
  }

  if (asset.status === 'generating') {
    return assetProgressLabel(asset)
  }

  if (asset.status === 'failed') {
    return '실패 · 다시 시도 필요'
  }

  return asset.isSystem ? '기본 제공' : '사용 가능'
}

function assetStatusOverlayLabel(asset: Asset) {
  if (asset.status === 'queued') {
    return '대기 중'
  }

  if (asset.status === 'generating') {
    return '생성 중'
  }

  if (asset.status === 'failed') {
    return '생성 실패'
  }

  return '사용 가능'
}

function getRetryActions(asset: Asset) {
  const failedSprites = asset.sprites.filter((sprite) => sprite.status === 'failed')
  const retrySprites = failedSprites.length > 0 ? failedSprites : asset.sprites.slice(0, 1)

  return retrySprites.map((sprite) => sprite.action)
}

function assetProgressLabel(asset: Asset) {
  const readySprites = asset.sprites.filter((sprite) => sprite.status === 'ready').length
  const generatingSprites = asset.sprites.filter((sprite) => sprite.status === 'generating').length
  const remainingLabel = assetRemainingTimeLabel(asset)

  if (readySprites > 0) {
    return `생성 중 · 남은 시간 ${remainingLabel} · ${readySprites}/${asset.sprites.length} 액션 완료`
  }

  if (generatingSprites > 0) {
    return `생성 중 · 남은 시간 ${remainingLabel} · 스프라이트 처리 중`
  }

  return `대기 중 · 예상 ${remainingLabel}`
}

function assetProgressDetailLabel(asset: Asset) {
  if (asset.status === 'failed') {
    return '실패한 액션은 다시 시도할 수 있습니다'
  }

  if (asset.status === 'queued') {
    return `큐 대기 · 예상 ${assetRemainingTimeLabel(asset)}`
  }

  return `남은 시간 ${assetRemainingTimeLabel(asset)}`
}

function assetRemainingTimeLabel(asset: Asset) {
  if (asset.status === 'queued') {
    return '약 2~4분'
  }

  const startedAt = getAssetGenerationStartedAt(asset)
  const elapsedMs = Math.max(0, Date.now() - startedAt)
  const remainingMs = Math.max(0, ASSET_GENERATION_ESTIMATE_MS - elapsedMs)

  if (remainingMs < 60_000) {
    return '1분 미만'
  }

  return `약 ${Math.ceil(remainingMs / 60_000)}분`
}

function getAssetGenerationStartedAt(asset: Asset) {
  const spriteTimestamps = asset.sprites
    .map((sprite) => Date.parse(sprite.lastRegenAt ?? asset.createdAt))
    .filter((timestamp) => Number.isFinite(timestamp))

  if (spriteTimestamps.length > 0) {
    return Math.min(...spriteTimestamps)
  }

  const createdAt = Date.parse(asset.createdAt)

  return Number.isFinite(createdAt) ? createdAt : Date.now()
}

function isAssetWorking(asset: Asset) {
  return asset.status === 'queued' || asset.status === 'generating'
}

function spriteActionLabel(action: Asset['sprites'][number]['action']) {
  if (action === 'idle') {
    return 'Idle'
  }

  if (action === 'walk') {
    return 'Walk'
  }

  if (action === 'onair') {
    return 'Onair'
  }

  return 'Static'
}

function spriteStatusLabel(status: Asset['sprites'][number]['status']) {
  if (status === 'queued') {
    return '대기 중'
  }

  if (status === 'generating') {
    return '생성 중'
  }

  if (status === 'failed') {
    return '실패'
  }

  return '준비 완료'
}

function getValidationStatusView(player: RoomPlayer | undefined, hasRecord: boolean) {
  if (player?.validationCleared === true) {
    return {
      className: 'is-cleared',
      title: '검증 성공',
      description: '이 맵 조각은 병합 후보에 포함되고, 레이스 패널티가 없습니다.',
    }
  }

  if (hasRecord) {
    return {
      className: 'is-failed',
      title: '검증 실패 기록',
      description: '최종 레이스 시작 시 15초 freeze 패널티가 적용됩니다.',
    }
  }

  return {
    className: 'is-pending',
    title: '검증 중',
    description: 'GOAL에 닿으면 성공, 시간 초과나 포기 시 실패로 기록됩니다.',
  }
}

function rankRacePlayers(players: RoomPlayer[]) {
  return [...players].sort((left, right) => {
    const leftFinished = left.raceFinishedAtMs !== null
    const rightFinished = right.raceFinishedAtMs !== null

    if (leftFinished && rightFinished) {
      return (left.raceFinishedAtMs ?? 0) - (right.raceFinishedAtMs ?? 0)
    }

    if (leftFinished !== rightFinished) {
      return leftFinished ? -1 : 1
    }

    return left.raceDistanceToGoal - right.raceDistanceToGoal
  })
}

function countRealRoomPlayers(players: RoomPlayer[]) {
  return players.filter((player) => !isMockRoomPlayerId(player.id)).length
}

function isMockRoomPlayerId(playerId: string) {
  return playerId.startsWith('mock-')
}

function isAutoMockRoomPlayerId(playerId: string, shouldAutoFillJoinedSlots: boolean) {
  return (
    playerId.startsWith('mock-host-') ||
    playerId.startsWith('mock-player-') ||
    (shouldAutoFillJoinedSlots && playerId.startsWith('mock-joined-player-'))
  )
}

function mergeBuildTimeVoteState(
  currentVote: BuildTimeVoteState | null,
  nextVote: BuildTimeVoteState,
): BuildTimeVoteState {
  if (currentVote === null || currentVote.deltaSeconds !== nextVote.deltaSeconds) {
    return nextVote
  }

  return {
    ...nextVote,
    voterIds: [...new Set([...currentVote.voterIds, ...nextVote.voterIds])],
    approved: currentVote.approved || nextVote.approved,
    applied: currentVote.applied || nextVote.applied,
  }
}

function raceResultLabel(player: RoomPlayer) {
  const validationLabel = player.validationCleared ? '검증 성공' : '15초 freeze'

  if (player.raceFinishedAtMs !== null) {
    return `완주 ${formatRaceTime(player.raceFinishedAtMs)} · ${validationLabel}`
  }

  return `미완주 · ${Math.round(player.raceDistanceToGoal)}% 남음 · ${validationLabel}`
}

function formatRaceTime(milliseconds: number) {
  const totalSeconds = Math.max(0, milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const tenths = Math.floor((totalSeconds % 1) * 10)

  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function getCooldownRemaining(lastRegenAt: string | null, now: number) {
  if (lastRegenAt === null) {
    return 0
  }

  const elapsedMs = now - new Date(lastRegenAt).getTime()
  return Math.max(0, REGEN_COOLDOWN_MS - elapsedMs)
}

function formatCooldown(remainingMs: number) {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDeviceLinkExpiry(expiresAt: string) {
  return new Date(expiresAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function realtimeStatusLabel(status: 'idle' | 'connecting' | 'connected' | 'local' | 'offline') {
  if (status === 'connected') {
    return 'Colyseus Live'
  }

  if (status === 'local') {
    return 'Local Demo'
  }

  if (status === 'connecting') {
    return 'Colyseus 연결 중'
  }

  if (status === 'offline') {
    return 'Colyseus Offline'
  }

  return 'Colyseus 대기'
}

function translateCanvasPaths(paths: CanvasPath[], dx: number, dy: number): CanvasPath[] {
  return paths.map((path) => ({
    ...path,
    paths: path.paths.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    })),
  }))
}

function scaleCanvasPaths(paths: CanvasPath[], scaleX: number, scaleY: number): CanvasPath[] {
  return paths.map((path) => ({
    ...path,
    paths: path.paths.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    })),
  }))
}

function getLocalPointerPoint(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function getCanvasPixelPoint(
  event: ReactPointerEvent<HTMLDivElement>,
  width: number,
  height: number,
) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * width
  const y = ((event.clientY - rect.top) / rect.height) * height

  return {
    x: Math.min(width - 1, Math.max(0, Math.floor(x))),
    y: Math.min(height - 1, Math.max(0, Math.floor(y))),
  }
}

function isPointInsideRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  )
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

function withAlpha(hexColor: string, opacity: number) {
  if (hexColor.length !== 7) {
    return hexColor
  }

  const alpha = Math.round((opacity / 100) * 255)
    .toString(16)
    .padStart(2, '0')

  return `${hexColor}${alpha}`
}

function formatElapsed(seconds: number) {
  return formatTimer(seconds)
}

function roomJoinButtonLabel(room: RoomSummary) {
  if (room.phase !== 'lobby') {
    return '진행 중'
  }

  if (room.players >= room.maxPlayers) {
    return '정원 초과'
  }

  return room.isPublic ? '입장' : '비밀번호'
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  return `${minutes}:${String(restSeconds).padStart(2, '0')}`
}

function getEndpointLabelAt(x: number, y: number, startPoint: MapPoint, endPoint: MapPoint) {
  if (x === startPoint.x && y === startPoint.y) {
    return 'START'
  }

  if (x === endPoint.x && y === endPoint.y) {
    return 'GOAL'
  }

  return null
}

function getEndpointVerticalDelta(startPoint: MapPoint, endPoint: MapPoint) {
  return Math.abs(endPoint.y - startPoint.y)
}

function isEndpointHeightDeltaAllowed(startPoint: MapPoint, endPoint: MapPoint) {
  return getEndpointVerticalDelta(startPoint, endPoint) <= MAX_ENDPOINT_VERTICAL_DELTA
}

function buildPreviewMapSegment({
  roomId,
  creatorId,
  startPoint,
  endPoint,
  placements,
}: {
  roomId: string
  creatorId: string
  startPoint: MapPoint
  endPoint: MapPoint
  placements: MapPlacement[]
}): MapSegmentSnapshot {
  const assetRefs = makePlacementAssetRefs(placements)

  return {
    id: 'preview-segment',
    roomId,
    creatorId,
    startPoint,
    endPoint,
    placements,
    assetRefs,
    segmentHash: makePreviewSegmentHash(startPoint, endPoint, assetRefs),
    isValidated: false,
    submittedAt: new Date(0).toISOString(),
    validatedAt: null,
    clearTimeMs: null,
  }
}

function makePlacementAssetRefs(placements: MapPlacement[]): MapSegmentAssetSnapshot[] {
  return placements
    .map((placement) => ({
      assetId: placement.asset.id,
      assetCategory: placement.asset.category,
      assetAttrs: placement.asset.attrs,
      colliderType: placement.asset.colliderType,
      x: placement.x,
      y: placement.y,
      widthCells: placement.asset.widthCells ?? 1,
      heightCells: placement.asset.heightCells ?? 1,
      rotation: 0,
    }))
    .sort((left, right) => {
      if (left.y !== right.y) {
        return left.y - right.y
      }

      if (left.x !== right.x) {
        return left.x - right.x
      }

      return left.assetId.localeCompare(right.assetId)
    })
}

function makePreviewSegmentHash(
  startPoint: MapPoint,
  endPoint: MapPoint,
  assetRefs: MapSegmentAssetSnapshot[],
) {
  return `preview-${hashText(JSON.stringify({ startPoint, endPoint, assetRefs }))}`
}

function hashText(value: string) {
  let hash = 5381

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }

  return (hash >>> 0).toString(36)
}

interface GridRect {
  x: number
  y: number
  width: number
  height: number
}

function getAssetGridRect(x: number, y: number, asset: Asset): GridRect {
  return {
    x,
    y,
    width: Math.max(1, asset.widthCells ?? 1),
    height: Math.max(1, asset.heightCells ?? 1),
  }
}

function getPlacementGridRect(placement: MapPlacement): GridRect {
  return getAssetGridRect(placement.x, placement.y, placement.asset)
}

function isRectInsideBoard(rect: GridRect) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= EDITOR_BOARD.cols &&
    rect.y + rect.height <= EDITOR_BOARD.rows
  )
}

function doesRectCoverPoint(rect: GridRect, point: MapPoint) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  )
}

function doesPlacementCoverCell(placement: MapPlacement, x: number, y: number) {
  return doesRectCoverPoint(getPlacementGridRect(placement), { x, y })
}

function doGridRectsOverlap(left: GridRect, right: GridRect) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

export default App

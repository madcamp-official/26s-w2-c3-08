import { useMemo, useState, type ReactNode } from 'react'

import {
  Badge,
  ConnectionState,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Modal,
  ProgressBar,
  Tabs,
  TextArea,
  TextField,
  Toast,
  Tooltip,
  type BadgeState,
  type ConnectionStatus,
  type ToastTone,
} from '../../design-system/components'
import {
  Button,
  IconButton,
  Inline,
  Stack,
  Surface,
  Text,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonSize,
} from '../../design-system/primitives'
import { GameShell, LauncherShell, StudioShell } from '../../design-system/shells'
import {
  AssetLoadModal,
  AttributeField,
  BrushSizeControl,
  DirtyStateNotice,
  DrawingToolbar,
  DrawingViewport,
  PaletteGrid,
  PanelResizeHandle,
  StudioPanel,
  type StudioToolId,
} from '../../design-system/studio'
import {
  assetLoadFixtures,
  behaviorAttributeOptions,
  brushSizePresets,
  disabledStudioToolIds,
  paletteSwatches,
  recentPaletteSwatchIds,
  studioAttributeOptions,
  studioToolFixtures,
} from '../../fixtures/studio/studioFixtures'
import {
  getLoginScreenFixtureByState,
  loginScreenFixtures,
  toLoginScreenProps,
} from '../../fixtures/login/loginFixtures'
import { LoginScreen } from '../../pages/login/LoginScreen'

const componentCategories = [
  'Primitive Components',
  'Core Components',
  'Screen Views',
  'Product Components',
  'Shell Patterns',
  'Studio Tools',
  'Game HUD',
] as const

const componentStates = [
  'idle',
  'boot',
  'loading',
  'default',
  'error',
  'emptyNickname',
  'tooLong',
  'submitting',
  'serverError',
  'expiredSession',
  'offline',
  'reconnecting',
  'selected',
  'disabled',
  'collapsed',
  'expanded',
  'resizing',
  'activeTool',
  'disabledTool',
  'lightChecker',
  'darkChecker',
  'gridOff',
  'outsideDim',
  'unchanged',
  'changed',
] as const

const viewportPresets = ['1280x720', '1440x900', '1920x1080'] as const

type ComponentCategory = (typeof componentCategories)[number]
type ComponentState = (typeof componentStates)[number]
type ViewportPreset = (typeof viewportPresets)[number]

const buttonVariants: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost']
const buttonSizes: ButtonSize[] = ['small', 'medium', 'large']
const iconButtonSizes: IconButtonSize[] = ['small', 'medium', 'large']
const badgeStates: BadgeState[] = ['queued', 'generating', 'ready', 'failed', 'offline', 'reconnecting']
const connectionStatuses: ConnectionStatus[] = [
  'online',
  'offline',
  'reconnecting',
  'server_unavailable',
  'malformed_response',
]
const toastTones: ToastTone[] = ['info', 'success', 'error']

export default function UiLab() {
  const [category, setCategory] = useState<ComponentCategory>('Primitive Components')
  const [state, setState] = useState<ComponentState>('idle')
  const [viewport, setViewport] = useState<ViewportPreset>('1440x900')
  const [longText, setLongText] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [offline, setOffline] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [alternateBackground, setAlternateBackground] = useState(false)

  const previewState = useMemo(() => {
    if (offline) {
      return 'offline'
    }

    if (error) {
      return 'error'
    }

    if (loading) {
      return 'loading'
    }

    return state
  }, [error, loading, offline, state])

  return (
    <section className="v2-lab-grid" data-v2-component="ui-lab" data-v2-state={previewState}>
      <form className="v2-panel v2-controls" aria-label="UI Lab controls">
        <div className="v2-section-heading">
          <p className="v2-eyebrow">UI Lab</p>
          <h2>Placeholder component states</h2>
          <p>실제 제품 화면 없이 category/state/viewport 조건만 고정합니다.</p>
        </div>

        <label className="v2-field">
          <span>Component category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ComponentCategory)}
          >
            {componentCategories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="v2-field">
          <span>State</span>
          <select value={state} onChange={(event) => setState(event.target.value as ComponentState)}>
            {componentStates.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="v2-field">
          <span>Viewport preset</span>
          <select
            value={viewport}
            onChange={(event) => setViewport(event.target.value as ViewportPreset)}
          >
            {viewportPresets.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="v2-toggle-grid">
          <Toggle label="Long text" checked={longText} onChange={setLongText} />
          <Toggle label="Loading" checked={loading} onChange={setLoading} />
          <Toggle label="Error" checked={error} onChange={setError} />
          <Toggle label="Offline" checked={offline} onChange={setOffline} />
          <Toggle label="Reduced motion" checked={reducedMotion} onChange={setReducedMotion} />
          <Toggle
            label="Alternate background"
            checked={alternateBackground}
            onChange={setAlternateBackground}
          />
        </div>
      </form>

      <section className="v2-panel v2-preview-panel" aria-label="UI Lab preview">
        <div className="v2-section-heading">
          <p className="v2-eyebrow">{viewport}</p>
          <h2>{category}</h2>
          <p>
            {longText
              ? '매우 긴 한국어 문구와 긴 에셋 이름이 들어와도 placeholder surface가 깨지지 않는지 확인하기 위한 상태입니다.'
              : '선택한 조건을 placeholder로 확인합니다.'}
          </p>
        </div>

        <div
          className={[
            'v2-preview-stage',
            reducedMotion ? 'is-reduced-motion' : '',
            alternateBackground ? 'has-alternate-background' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {category === 'Primitive Components' ? (
            <PrimitiveShowcase longText={longText} previewState={previewState} />
          ) : category === 'Core Components' ? (
            <CoreComponentsShowcase longText={longText} previewState={previewState} />
          ) : category === 'Screen Views' ? (
            <LoginScreenShowcase
              longText={longText}
              previewState={previewState}
              viewport={viewport}
            />
          ) : category === 'Shell Patterns' ? (
            <ShellPatternsShowcase
              longText={longText}
              previewState={previewState}
              viewport={viewport}
            />
          ) : category === 'Studio Tools' ? (
            <StudioToolsShowcase longText={longText} previewState={previewState} />
          ) : (
            <article
              className="v2-placeholder-card"
              data-v2-component="placeholder-card"
              data-v2-state={previewState}
            >
              <span className="v2-status-pill">{previewState}</span>
              <h3>{category}</h3>
              <p>
                {longText
                  ? '긴 텍스트 토글이 켜져 있습니다. 실제 제품 화면이 아니라 UI Lab 상태 재현을 위한 placeholder component입니다.'
                  : 'Placeholder component only.'}
              </p>
            </article>
          )}
        </div>
      </section>
    </section>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="v2-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

interface LoginScreenShowcaseProps {
  longText: boolean
  previewState: string
  viewport: ViewportPreset
}

function LoginScreenShowcase({ longText, previewState, viewport }: LoginScreenShowcaseProps) {
  const fixture = resolveLoginFixture(previewState, longText)

  return (
    <div className="v2-login-showcase" data-v2-component="login-screen-showcase" data-v2-state={fixture.state}>
      <div className="v2-shell-showcase-actions">
        {loginScreenFixtures.map((item) => (
          <a
            key={item.id}
            className="v2-action-link"
            href={`#/state-gallery?case=${item.id}`}
            data-v2-state={item.state}
          >
            {item.state}
          </a>
        ))}
      </div>
      <ShellViewport label={`S1 Login · ${fixture.state}`} viewport={viewport}>
        <LoginScreen
          {...toLoginScreenProps(fixture, {
            onNicknameChange: () => undefined,
            onSubmitNickname: () => undefined,
          })}
        />
      </ShellViewport>
    </div>
  )
}

function resolveLoginFixture(previewState: string, longText: boolean) {
  if (longText && (previewState === 'idle' || previewState === 'default')) {
    return getLoginScreenFixtureByState('tooLong')
  }

  if (previewState === 'loading') {
    return getLoginScreenFixtureByState('boot')
  }

  if (previewState === 'error' || previewState === 'offline') {
    return getLoginScreenFixtureByState('serverError')
  }

  return getLoginScreenFixtureByState(previewState)
}

interface PrimitiveShowcaseProps {
  longText: boolean
  previewState: string
}

function PrimitiveShowcase({ longText, previewState }: PrimitiveShowcaseProps) {
  const label = longText
    ? '아주 긴 버튼 라벨로 줄바꿈과 고정 높이 안정성 확인'
    : '버튼'

  return (
    <Surface
      className="v2-primitive-showcase"
      variant="panel"
      padding="large"
      radius="medium"
      shadow="panel"
      data-v2-component="primitive-showcase"
      data-v2-state={previewState}
    >
      <Stack gap="large">
        <Stack gap="small">
          <Text as="h3" variant="title" weight="bold">
            Primitive components
          </Text>
          <Text tone="secondary">
            Text, Surface, Stack, Inline, Button, IconButton만 확인합니다.
          </Text>
        </Stack>

        <Surface variant="muted" padding="medium" radius="medium">
          <Stack gap="small">
            <Text variant="caption" tone="secondary" weight="bold">
              Text / Surface / Stack / Inline
            </Text>
            <Text variant="display" weight="bold">
              토큰 기반 제목
            </Text>
            <Text>
              {longText
                ? '긴 본문 텍스트가 들어와도 Surface 내부에서 읽기 가능한 줄 간격과 spacing을 유지합니다.'
                : '본문 텍스트 placeholder입니다.'}
            </Text>
            <Inline gap="small">
              <Text variant="caption" tone="danger" weight="bold">
                danger
              </Text>
              <Text variant="caption" tone="secondary">
                secondary
              </Text>
            </Inline>
          </Stack>
        </Surface>

        <Stack gap="medium">
          <Text variant="caption" tone="secondary" weight="bold">
            Button variants and sizes
          </Text>
          {buttonSizes.map((size) => (
            <Inline key={size} gap="small">
              {buttonVariants.map((variant) => (
                <Button key={`${size}-${variant}`} variant={variant} size={size} iconStart={<DemoIcon />}>
                  {label}
                </Button>
              ))}
            </Inline>
          ))}
          <Inline gap="small">
            <Button loading iconStart={<DemoIcon />}>
              Loading
            </Button>
            <Button disabled variant="secondary" iconEnd={<DemoIcon />}>
              Disabled
            </Button>
            <Button fullWidth variant="primary">
              Full width
            </Button>
          </Inline>
        </Stack>

        <Stack gap="medium">
          <Text variant="caption" tone="secondary" weight="bold">
            IconButton states
          </Text>
          <Inline gap="small">
            {iconButtonSizes.map((size) => (
              <IconButton key={size} size={size} icon={<DemoIcon />} aria-label={`${size} icon button`} />
            ))}
            <IconButton pressed icon={<DemoIcon />} aria-label="pressed icon button" />
            <IconButton loading icon={<DemoIcon />} aria-label="loading icon button" />
            <IconButton disabled icon={<DemoIcon />} aria-label="disabled icon button" />
          </Inline>
        </Stack>
      </Stack>
    </Surface>
  )
}

interface ShellPatternsShowcaseProps {
  longText: boolean
  previewState: string
  viewport: ViewportPreset
}

function ShellPatternsShowcase({ longText, previewState, viewport }: ShellPatternsShowcaseProps) {
  const [modalLayerVisible, setModalLayerVisible] = useState(previewState === 'selected')
  const shellState = previewState === 'offline' ? 'offline' : previewState === 'reconnecting' ? 'reconnecting' : 'default'
  const studioPanelState = previewState === 'collapsed' ? 'collapsed' : previewState === 'loading' ? 'resizing' : 'expanded'
  const longCopy = longText
    ? '긴 placeholder 문구가 들어온 상태입니다. 실제 화면 정보 구조를 만들지 않고 shell slot의 overflow와 여백만 확인합니다.'
    : 'Shell slot placeholder'

  return (
    <div className="v2-shell-showcase" data-v2-component="shell-patterns-showcase" data-v2-state={previewState}>
      <div className="v2-shell-showcase-actions">
        <Button size="small" variant="secondary" onClick={() => setModalLayerVisible((value) => !value)}>
          Modal layer
        </Button>
        <Badge state={shellState === 'offline' ? 'offline' : shellState === 'reconnecting' ? 'reconnecting' : 'ready'} />
      </div>

      <ShellViewport label="LauncherShell" viewport={viewport}>
        <LauncherShell
          title="Launcher Shell"
          subtitle="low density"
          state={shellState}
          status={<Badge state={shellState === 'default' ? 'ready' : shellState} />}
          primaryNav={
            <>
              <Button size="small" variant="secondary">
                Nav
              </Button>
              <Button size="small" variant="ghost">
                Sub
              </Button>
            </>
          }
          toastLayer={
            <Toast
              tone={shellState === 'offline' ? 'error' : 'info'}
              title={shellState === 'offline' ? '오프라인' : 'Launcher toast'}
              message="toast layer slot"
            />
          }
          modalLayer={modalLayerVisible ? <ShellLayerCard title="Launcher modal layer" /> : undefined}
        >
          <div className="v2-launcher-placeholder">
            <div>
              <span className="v2-shell-block is-large" />
              <p>{longCopy}</p>
            </div>
            <div className="v2-shell-action-stack">
              <Button>Primary CTA</Button>
              <Button variant="secondary">Secondary CTA</Button>
            </div>
          </div>
        </LauncherShell>
      </ShellViewport>

      <ShellViewport label="StudioShell" viewport={viewport}>
        <StudioShell
          title="Studio Shell"
          leftPanelState={studioPanelState}
          rightPanelState={previewState === 'collapsed' ? 'collapsed' : 'expanded'}
          topBar={
            <>
              <Button size="small" variant="secondary">
                Tool
              </Button>
              <Button size="small">Submit</Button>
            </>
          }
          leftPanel={<ShellPanelStack title="Left panel" longText={longText} />}
          center={<StudioWorkspacePlaceholder longText={longText} />}
          rightPanel={<ShellPanelStack title="Right panel" longText={longText} />}
          statusLayer={<Badge state={studioPanelState === 'resizing' ? 'generating' : 'ready'} label={studioPanelState} />}
          toastLayer={
            previewState === 'offline' ? (
              <Toast tone="error" title="오프라인" message="Studio toast layer slot" />
            ) : undefined
          }
        />
      </ShellViewport>

      <ShellViewport label="GameShell" viewport={viewport}>
        <GameShell
          title="Game Shell"
          state={previewState === 'collapsed' ? 'locked' : shellState}
          topHud={<GameHudPlaceholder longText={longText} />}
          leftShelf={<GameDockPlaceholder title="Shelf" collapsed={previewState === 'collapsed'} />}
          canvas={<GameCanvasPlaceholder longText={longText} />}
          rightToolDock={<GameDockPlaceholder title="Dock" collapsed={previewState === 'collapsed'} />}
          bottomOverlay={<span>{longCopy}</span>}
          statusOverlay={
            shellState !== 'default' ? <Badge state={shellState} /> : <Badge state="ready" label="Canvas priority" />
          }
          toastLayer={
            previewState === 'offline' ? (
              <Toast tone="error" title="오프라인" message="Game toast layer slot" />
            ) : undefined
          }
        />
      </ShellViewport>
    </div>
  )
}

function ShellViewport({
  label,
  viewport,
  children,
}: {
  label: string
  viewport: ViewportPreset
  children: ReactNode
}) {
  return (
    <section className="v2-shell-viewport" data-viewport={viewport} aria-label={`${label} ${viewport}`}>
      <div className="v2-shell-viewport-meta">
        <Text variant="caption" tone="secondary" weight="bold">
          {label}
        </Text>
        <Text variant="caption" tone="secondary">
          {viewport}
        </Text>
      </div>
      <div className="v2-shell-fit">{children}</div>
    </section>
  )
}

function ShellLayerCard({ title }: { title: string }) {
  return (
    <div className="v2-shell-layer-card" role="dialog" aria-label={title}>
      <Text weight="bold">{title}</Text>
      <Text variant="caption" tone="secondary">
        layer slot placeholder
      </Text>
    </div>
  )
}

function ShellPanelStack({ title, longText }: { title: string; longText: boolean }) {
  return (
    <div className="v2-shell-panel-stack">
      <Text weight="bold">{title}</Text>
      {Array.from({ length: longText ? 8 : 4 }, (_, index) => (
        <span key={index} className="v2-shell-block" />
      ))}
    </div>
  )
}

function StudioWorkspacePlaceholder({ longText }: { longText: boolean }) {
  return (
    <div className="v2-studio-workspace-placeholder">
      <div className="v2-studio-canvas-placeholder" aria-hidden="true" />
      <Text tone="secondary">
        {longText ? 'center workspace minimum width and canvas surround placeholder' : 'center workspace'}
      </Text>
    </div>
  )
}

function GameHudPlaceholder({ longText }: { longText: boolean }) {
  return (
    <>
      <Badge state="ready" label="HUD" />
      <Text tone="inverse" weight="bold">
        {longText ? '긴 HUD 상태 문구' : '00:42'}
      </Text>
      <Badge state="generating" label="Budget" />
    </>
  )
}

function GameDockPlaceholder({ title, collapsed }: { title: string; collapsed: boolean }) {
  return (
    <div className="v2-game-dock-placeholder" data-state={collapsed ? 'collapsed' : 'expanded'}>
      <Text tone="inverse" weight="bold">
        {title}
      </Text>
      {!collapsed
        ? Array.from({ length: 5 }, (_, index) => <span key={index} className="v2-game-tool-placeholder" />)
        : null}
    </div>
  )
}

function GameCanvasPlaceholder({ longText }: { longText: boolean }) {
  return (
    <div className="v2-game-canvas-placeholder">
      <span />
      <Text tone="inverse" weight="bold">
        {longText ? 'Phaser canvas slot remains the largest visible area' : 'Canvas Slot'}
      </Text>
    </div>
  )
}

interface StudioToolsShowcaseProps {
  longText: boolean
  previewState: string
}

function StudioToolsShowcase({ longText, previewState }: StudioToolsShowcaseProps) {
  const [activeTool, setActiveTool] = useState<StudioToolId>('pen')
  const [brushSize, setBrushSize] = useState(4)
  const [selectedSwatchId, setSelectedSwatchId] = useState('yellow')
  const [assetLoadOpen, setAssetLoadOpen] = useState(false)
  const [assetLoadTab, setAssetLoadTab] = useState<'mine' | 'others'>('mine')
  const [categoryValue, setCategoryValue] = useState('platform')
  const [behaviorValues, setBehaviorValues] = useState<string[]>(['solid'])
  const [nameValue, setNameValue] = useState('구름 발판')
  const panelState = previewState === 'collapsed' ? 'collapsed' : previewState === 'resizing' ? 'resizing' : 'expanded'
  const checkerMode = previewState === 'darkChecker' ? 'dark' : 'light'
  const gridVisible = previewState !== 'gridOff'
  const outsideDim = previewState === 'outsideDim' || previewState === 'activeTool'
  const viewportStatus = previewState === 'disabled' ? 'disabled' : activeTool === 'move' ? 'move' : activeTool === 'pen' ? 'drawing' : 'blank'
  const dirtyState = previewState === 'unchanged' ? 'unchanged' : previewState === 'changed' ? 'changed' : 'dirty'
  const modalOpen = assetLoadOpen || previewState === 'loading' || previewState === 'empty'

  return (
    <Surface
      className="v2-studio-tools-showcase"
      variant="panel"
      padding="large"
      radius="medium"
      shadow="panel"
      data-v2-component="studio-tools-showcase"
      data-v2-state={previewState}
    >
      <Stack gap="large">
        <Stack gap="small">
          <Text as="h3" variant="title" weight="bold">
            Studio Design System
          </Text>
          <Text tone="secondary">
            Drawing Engine acceptance가 PASS하지 않았으므로 production engine 없이 fixture layer만 렌더링합니다.
          </Text>
        </Stack>

        <div className="v2-studio-layout-preview">
          <StudioPanel
            side="left"
            title="도구"
            state={panelState}
            actions={<Badge state={panelState === 'resizing' ? 'generating' : 'ready'} label={panelState} />}
            onToggle={() => undefined}
          >
            <DrawingToolbar
              label="그리기 도구"
              tools={studioToolFixtures}
              activeTool={previewState === 'activeTool' ? 'move' : activeTool}
              disabledToolIds={previewState === 'disabledTool' ? ['eyedropper', ...disabledStudioToolIds] : disabledStudioToolIds}
              onToolChange={setActiveTool}
            />
            <BrushSizeControl
              label="굵기"
              value={brushSize}
              presets={brushSizePresets}
              disabled={previewState === 'disabled'}
              onChange={setBrushSize}
            />
            <PaletteGrid
              label="팔레트"
              swatches={paletteSwatches}
              selectedSwatchId={selectedSwatchId}
              recentSwatchIds={recentPaletteSwatchIds}
              disabled={previewState === 'disabled'}
              onSelect={setSelectedSwatchId}
            />
          </StudioPanel>

          <section className="v2-studio-center-preview" aria-label="Studio viewport preview">
            <DrawingViewport
              label="아바타 캔버스"
              workspaceSize={{ width: 768, height: 1536 }}
              visibleFrame={{ x: 256, y: 512, width: 256, height: 512 }}
              checkerMode={checkerMode}
              gridVisible={gridVisible}
              outsideDim={outsideDim}
              status={viewportStatus}
              toolLabel={studioToolFixtures.find((tool) => tool.id === activeTool)?.label ?? '펜'}
            />
            <Inline gap="small">
              <Badge state={checkerMode === 'dark' ? 'reconnecting' : 'ready'} label={`${checkerMode} checker`} />
              <Badge state={gridVisible ? 'ready' : 'queued'} label={gridVisible ? 'grid on' : 'grid off'} />
              <Badge state={outsideDim ? 'generating' : 'queued'} label={outsideDim ? 'outside dim' : 'dim off'} />
            </Inline>
            <div className="v2-studio-resize-row">
              <PanelResizeHandle axis="horizontal" label="좌측 패널 가로 크기 조절" dragging={previewState === 'resizing'} />
              <PanelResizeHandle axis="vertical" label="도구 블록 세로 크기 조절" />
              <PanelResizeHandle axis="horizontal" label="비활성 크기 조절" disabled />
            </div>
          </section>

          <StudioPanel
            side="right"
            title="속성"
            state={previewState === 'collapsed' ? 'collapsed' : 'expanded'}
            actions={
              <Button size="small" variant="secondary" onClick={() => setAssetLoadOpen(true)}>
                에셋 불러오기
              </Button>
            }
            onToggle={() => undefined}
          >
            <AttributeField
              label="이름"
              kind="text"
              value={longText ? '매우 긴 에셋 이름 줄바꿈 확인용 플랫폼' : nameValue}
              helper="이름은 필수입니다."
              onChange={(value) => setNameValue(String(value))}
            />
            <AttributeField
              label="카테고리"
              kind="radio"
              value={categoryValue}
              options={studioAttributeOptions}
              onChange={(value) => setCategoryValue(String(value))}
            />
            <AttributeField
              label="속성"
              kind="checkbox"
              value={behaviorValues}
              options={behaviorAttributeOptions}
              error={previewState === 'error' ? '속성 조합을 다시 확인해주세요.' : undefined}
              onChange={(value) => setBehaviorValues(Array.isArray(value) ? value : [String(value)])}
            />
            <AttributeField
              label="크기"
              kind="select"
              value="2x1"
              options={[
                { value: '1x1', label: '1x1' },
                { value: '2x1', label: '2x1' },
                { value: '3x2', label: '3x2' },
              ]}
              disabledReason={previewState === 'disabled' ? '제출 중에는 크기를 바꿀 수 없어요.' : undefined}
              onChange={() => undefined}
            />
            <DirtyStateNotice
              state={dirtyState}
              message={
                dirtyState === 'unchanged'
                  ? '불러온 원본을 수정한 뒤 저장할 수 있어요.'
                  : '그림 또는 속성이 변경되었습니다.'
              }
              action={{ label: dirtyState === 'unchanged' ? '수정하기' : '저장 준비', onPress: () => undefined }}
            />
            <DirtyStateNotice
              state="submitted"
              message="에셋 생성을 요청했어요. 창고에서 진행 상황을 볼 수 있습니다."
            />
          </StudioPanel>
        </div>

        <AssetLoadModal
          open={modalOpen}
          tab={assetLoadTab}
          assets={previewState === 'empty' ? [] : assetLoadFixtures}
          loading={previewState === 'loading'}
          onTabChange={setAssetLoadTab}
          onSelectAsset={() => setAssetLoadOpen(false)}
          onClose={() => setAssetLoadOpen(false)}
        />
      </Stack>
    </Surface>
  )
}

interface CoreComponentsShowcaseProps {
  longText: boolean
  previewState: string
}

function CoreComponentsShowcase({ longText, previewState }: CoreComponentsShowcaseProps) {
  const [selectedTab, setSelectedTab] = useState('fields')
  const [fieldValue, setFieldValue] = useState('릴레이러')
  const [areaValue, setAreaValue] = useState(
    longText
      ? '긴 설명 입력 상태입니다. 줄바꿈과 helper/error/counter가 같은 폭 안에서 안정적으로 유지되는지 확인합니다.'
      : '짧은 설명',
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(true)
  const errorMessage = previewState === 'error' ? '1자 이상 12자 이하로 입력해 주세요.' : undefined

  return (
    <Surface
      className="v2-core-showcase"
      variant="panel"
      padding="large"
      radius="medium"
      shadow="panel"
      data-v2-component="core-showcase"
      data-v2-state={previewState}
    >
      <Stack gap="large">
        <Stack gap="small">
          <Text as="h3" variant="title" weight="bold">
            Core components
          </Text>
          <Text tone="secondary">
            Field, navigation, feedback, overlay 상태를 제품 화면 없이 확인합니다.
          </Text>
        </Stack>

        <div className="v2-sample-grid">
          <Surface variant="muted" padding="medium" radius="medium">
            <Stack gap="medium">
              <Text variant="caption" tone="secondary" weight="bold">
                Fields
              </Text>
              <TextField
                label={longText ? '아주 긴 닉네임 입력 라벨' : '닉네임'}
                value={fieldValue}
                helper="Enter로 제출할 수 있습니다."
                error={errorMessage}
                loading={previewState === 'loading'}
                required
                placeholder="닉네임을 입력하세요"
                maxLength={12}
                onChange={setFieldValue}
                onSubmit={setFieldValue}
              />
              <TextField label="비활성 입력" value="수정할 수 없음" disabled helper="disabled 텍스트도 읽을 수 있어야 합니다." />
              <TextArea
                label="설명"
                value={areaValue}
                helper="긴 문구와 글자 수 표시를 확인합니다."
                error={previewState === 'error' ? '설명을 다시 확인해 주세요.' : undefined}
                maxLength={120}
                placeholder="설명을 입력하세요"
                onChange={setAreaValue}
              />
            </Stack>
          </Surface>

          <Surface variant="muted" padding="medium" radius="medium">
            <Stack gap="medium">
              <Text variant="caption" tone="secondary" weight="bold">
                Tabs and filters
              </Text>
              <Tabs
                ariaLabel="Core component sample tabs"
                selectedValue={selectedTab}
                onChange={setSelectedTab}
                tabs={[
                  { value: 'fields', label: '필드', badge: 2, panelId: 'core-panel-fields' },
                  { value: 'feedback', label: '피드백', panelId: 'core-panel-feedback' },
                  { value: 'locked', label: '잠김', disabled: true, panelId: 'core-panel-locked' },
                ]}
              />
              <Inline gap="small">
                <FilterChip label="전체" selected count={12} />
                <FilterChip label="생성 중" count={3} />
                <FilterChip label="비활성" count={0} disabled />
              </Inline>
              <Inline gap="small">
                {badgeStates.map((state) => (
                  <Badge key={state} state={state} />
                ))}
              </Inline>
              <ProgressBar label="결정 진행률" value={previewState === 'loading' ? 64 : 42} />
              <ProgressBar label="대기 중인 작업" indeterminate />
            </Stack>
          </Surface>

          <Surface variant="muted" padding="medium" radius="medium">
            <Stack gap="medium">
              <Text variant="caption" tone="secondary" weight="bold">
                Overlay and messaging
              </Text>
              <Inline gap="small">
                <Button onClick={() => setModalOpen(true)}>Modal 열기</Button>
                <Tooltip content="Tooltip은 보조 정보만 담습니다." placement="top">
                  <Button variant="secondary">Tooltip</Button>
                </Tooltip>
              </Inline>
              {toastVisible ? (
                <Stack gap="small">
                  {toastTones.map((tone) => (
                    <Toast
                      key={tone}
                      tone={tone}
                      title={tone === 'error' ? '오류가 발생했습니다' : tone === 'success' ? '저장되었습니다' : '상태 알림'}
                      message="키보드로 action과 닫기 버튼에 접근할 수 있습니다."
                      action={{ label: '확인', onPress: () => setToastVisible(false) }}
                      onDismiss={() => setToastVisible(false)}
                    />
                  ))}
                </Stack>
              ) : (
                <Button variant="secondary" onClick={() => setToastVisible(true)}>
                  Toast 다시 보기
                </Button>
              )}
            </Stack>
          </Surface>

          <Surface variant="muted" padding="medium" radius="medium">
            <Stack gap="medium">
              <Text variant="caption" tone="secondary" weight="bold">
                State feedback
              </Text>
              <EmptyState
                title="표시할 항목이 없습니다"
                message="empty 상태는 명확한 제목과 다음 행동을 함께 제공합니다."
                action={{ label: '새로고침', onPress: () => undefined }}
                icon={<DemoIcon />}
              />
              <LoadingState label="불러오는 중" message="작업이 진행 중임을 live region으로 알립니다." />
              <ErrorState
                title="요청을 완료하지 못했습니다"
                message="typed error message가 controller에서 전달되는 자리에 표시됩니다."
                action={{ label: '다시 시도', onPress: () => undefined }}
              />
              {connectionStatuses.map((status) => (
                <ConnectionState
                  key={status}
                  status={status}
                  message="연결 상태는 색상만이 아니라 텍스트와 badge로 함께 표시합니다."
                  action={status === 'online' ? undefined : { label: '재시도', onPress: () => undefined }}
                />
              ))}
            </Stack>
          </Surface>
        </div>

        <Modal
          open={modalOpen}
          title="Core Modal"
          description="focus trap, Escape close, backdrop policy, focus restore를 확인합니다."
          backdropPolicy="dismiss"
          footer={
            <Inline gap="small">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setModalOpen(false)}>확인</Button>
            </Inline>
          }
          onClose={() => setModalOpen(false)}
        >
          <Stack gap="medium">
            <Text>
              {longText
                ? '모달 본문에 긴 한국어 문구가 들어와도 내부 스크롤과 제목/설명 연결이 유지되는지 확인합니다.'
                : '모달 본문 placeholder입니다.'}
            </Text>
            <TextField label="모달 입력" placeholder="focus trap 확인" helper="Tab 순환 범위 안에 포함됩니다." />
          </Stack>
        </Modal>
      </Stack>
    </Surface>
  )
}

function DemoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path
        fill="currentColor"
        d="M10 2.5 12.2 7l4.9.7-3.5 3.4.8 4.8L10 13.6l-4.4 2.3.8-4.8-3.5-3.4 4.9-.7L10 2.5Z"
      />
    </svg>
  )
}

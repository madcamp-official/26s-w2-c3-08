import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  AVATAR_VISIBLE_HEIGHT,
  AVATAR_VISIBLE_WIDTH,
} from 'shared'

import { TextArea, TextField, Toast, type ToastTone } from '../../design-system/components'
import { Button, Inline, Stack } from '../../design-system/primitives'
import { StudioShell } from '../../design-system/shells'
import {
  AssetLoadModal,
  BrushSizeControl,
  DirtyStateNotice,
  DrawingToolbar,
  DrawingViewport,
  PanelResizeHandle,
  StudioPanel,
  type AssetLoadItem,
  type AssetLoadTab,
  type CheckerMode,
  type PaletteSwatchModel,
  type StudioToolId,
  type ToolButtonProps,
} from '../../design-system/studio'
import styles from './AvatarStudioScreen.module.css'

export type AvatarStudioScreenState =
  | 'default'
  | 'loadMine'
  | 'loadOthers'
  | 'loadedUnchanged'
  | 'loadedChanged'
  | 'invalidName'
  | 'submitting'
  | 'submitSuccess'
  | 'submitFailed'
  | 'offline'

export interface AvatarStudioFormValue {
  name: string
  description: string
}

export interface AvatarStudioLayoutValue {
  leftCollapsed: boolean
  rightCollapsed: boolean
  leftPanelWidth: number
  rightPanelWidth: number
  resizing?: 'left' | 'right' | 'tools' | null
}

export interface AvatarStudioToast {
  tone: ToastTone
  title: string
  message: string
}

export interface AvatarStudioCanvasPoint {
  x: number
  y: number
}

export interface AvatarStudioCanvasImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface AvatarStudioScreenCallbacks {
  onGoMain: () => void
  onOpenWarehouse: () => void
  onNewAvatar: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onResizePanel: (side: 'left' | 'right', delta: number) => void
  onResizeToolBlock: (delta: number) => void
  onToolChange: (toolId: StudioToolId) => void
  onBrushSizeChange: (brushSize: number) => void
  onOpacityChange: (opacity: number) => void
  onSelectColor: (swatchId: string) => void
  onDrawCanvasPoint: (point: AvatarStudioCanvasPoint) => void
  onEraseCanvasPoint: (point: AvatarStudioCanvasPoint) => void
  onSampleCanvasColor: (point: AvatarStudioCanvasPoint) => void
  onToggleCheckerMode: () => void
  onToggleGrid: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onOpenLoadModal: () => void
  onCloseLoadModal: () => void
  onLoadTabChange: (tab: AssetLoadTab) => void
  onSelectLoadAvatar: (assetId: string) => void
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onSubmit: () => void
  onDismissToast: () => void
}

export interface AvatarStudioScreenProps extends AvatarStudioScreenCallbacks {
  state: AvatarStudioScreenState
  form: AvatarStudioFormValue
  layout: AvatarStudioLayoutValue
  activeTool: StudioToolId
  disabledToolIds: StudioToolId[]
  tools: ToolButtonProps['tool'][]
  brushSize: number
  brushSizePresets: number[]
  opacity: number
  swatches: PaletteSwatchModel[]
  selectedSwatchId: string
  recentSwatchIds: string[]
  canvasImage: AvatarStudioCanvasImage
  checkerMode: CheckerMode
  gridVisible: boolean
  dirtyState: 'blank' | 'unchanged' | 'changed' | 'submitted'
  sourceAvatarName?: string
  submitDisabledReason?: string
  loadModalOpen: boolean
  loadModalTab: AssetLoadTab
  loadAvatars: AssetLoadItem[]
  loadAvatarsLoading?: boolean
  toast?: AvatarStudioToast
  submitError?: string
}

export function AvatarStudioScreen({
  state,
  form,
  layout,
  activeTool,
  disabledToolIds,
  tools,
  brushSize,
  brushSizePresets,
  opacity,
  swatches,
  selectedSwatchId,
  recentSwatchIds,
  canvasImage,
  dirtyState,
  sourceAvatarName,
  submitDisabledReason,
  loadModalOpen,
  loadModalTab,
  loadAvatars,
  loadAvatarsLoading = false,
  toast,
  submitError,
  onGoMain,
  onOpenWarehouse,
  onNewAvatar,
  onToggleLeftPanel,
  onToggleRightPanel,
  onResizePanel,
  onResizeToolBlock,
  onToolChange,
  onBrushSizeChange,
  onOpacityChange,
  onSelectColor,
  onDrawCanvasPoint,
  onEraseCanvasPoint,
  onSampleCanvasColor,
  onUndo,
  onRedo,
  onClear,
  onOpenLoadModal,
  onCloseLoadModal,
  onLoadTabChange,
  onSelectLoadAvatar,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onDismissToast,
}: AvatarStudioScreenProps) {
  const shellStyle = {
    '--studio-left-panel-width': `${layout.leftPanelWidth}px`,
    '--studio-right-panel-width': `${layout.rightPanelWidth}px`,
  } as CSSProperties
  const submitting = state === 'submitting'
  const selectedSwatch = getSelectedSwatch(swatches, selectedSwatchId)

  return (
    <>
      <StudioShell
        className={styles.shell}
        title="아바타 스튜디오"
        leftPanelState={layout.leftCollapsed ? 'collapsed' : layout.resizing === 'left' ? 'resizing' : 'expanded'}
        rightPanelState={layout.rightCollapsed ? 'collapsed' : layout.resizing === 'right' ? 'resizing' : 'expanded'}
        style={shellStyle}
        topBar={
          <Inline gap="small">
            <Button size="small" variant="secondary" onClick={onGoMain}>
              메인으로
            </Button>
            <Button size="small" variant="secondary" onClick={onToggleLeftPanel}>
              {layout.leftCollapsed ? '왼쪽 패널 펼치기' : '왼쪽 패널 접기'}
            </Button>
            <Button size="small" variant="secondary" onClick={onToggleRightPanel}>
              {layout.rightCollapsed ? '오른쪽 패널 펼치기' : '오른쪽 패널 접기'}
            </Button>
            <Button size="small" onClick={onNewAvatar}>
              새 아바타 만들기
            </Button>
          </Inline>
        }
        leftPanel={
          <AvatarToolsPanel
            state={state}
            activeTool={activeTool}
            disabledToolIds={disabledToolIds}
            tools={tools}
            brushSize={brushSize}
            brushSizePresets={brushSizePresets}
            opacity={opacity}
            swatches={swatches}
            selectedSwatch={selectedSwatch}
            selectedSwatchId={selectedSwatchId}
            recentSwatchIds={recentSwatchIds}
            resizingTools={layout.resizing === 'tools'}
            onToolChange={onToolChange}
            onBrushSizeChange={onBrushSizeChange}
            onOpacityChange={onOpacityChange}
            onSelectColor={onSelectColor}
            onUndo={onUndo}
            onRedo={onRedo}
            onClear={onClear}
            onOpenLoadModal={onOpenLoadModal}
            onResizeToolBlock={onResizeToolBlock}
          />
        }
        center={
          <section
            className={styles.workspace}
            aria-label="아바타 캔버스 작업 영역"
            data-v2-component="avatar-studio-workspace"
            data-v2-state={state}
            onPaste={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => event.preventDefault()}
          >
            <DrawingViewport
              label="아바타 캔버스"
              workspaceSize={{ width: AVATAR_VISIBLE_WIDTH, height: AVATAR_VISIBLE_HEIGHT }}
              visibleFrame={{
                x: 0,
                y: 0,
                width: AVATAR_VISIBLE_WIDTH,
                height: AVATAR_VISIBLE_HEIGHT,
              }}
              checkerMode="light"
              gridVisible={false}
              outsideDim={false}
              surface="paper"
              showVisibleFrame={false}
              status={submitting ? 'disabled' : activeTool === 'move' ? 'move' : dirtyState === 'blank' ? 'blank' : 'drawing'}
              toolLabel={getToolLabel(tools, activeTool)}
            >
              <AvatarDrawingCanvas
                image={canvasImage}
                activeTool={activeTool}
                brushSize={brushSize}
                disabled={submitting}
                selectedSwatch={selectedSwatch}
                toolLabel={getToolLabel(tools, activeTool)}
                onDrawPoint={onDrawCanvasPoint}
                onErasePoint={onEraseCanvasPoint}
                onSampleColor={onSampleCanvasColor}
              />
            </DrawingViewport>
          </section>
        }
        rightPanel={
          <StudioPanel side="right" title="아바타 정보" onToggle={onToggleRightPanel}>
            <section className={styles.formPanel} data-v2-component="avatar-studio-form">
              <TextField
                label="아바타 이름"
                value={form.name}
                maxLength={12}
                required
                helper="1~12자로 입력하세요."
                error={state === 'invalidName' ? submitDisabledReason : undefined}
                disabled={submitting}
                onChange={onNameChange}
                onSubmit={() => onSubmit()}
              />
              <TextArea
                label="설명"
                value={form.description}
                rows={4}
                maxLength={80}
                helper="움직임이나 분위기를 적어주세요."
                disabled={submitting}
                onChange={onDescriptionChange}
              />
              <DirtyStateNotice
                state={dirtyState === 'unchanged' ? 'unchanged' : dirtyState === 'submitted' ? 'submitted' : 'dirty'}
                message={getDirtyMessage(dirtyState, sourceAvatarName)}
              />
              {submitDisabledReason && state !== 'invalidName' ? (
                <p className={styles.submitReason}>{submitDisabledReason}</p>
              ) : null}
              {submitError ? (
                <p className={styles.submitError} role="alert">
                  {submitError}
                </p>
              ) : null}
              <div className={styles.formActions}>
                <Button variant="secondary" onClick={onOpenWarehouse}>
                  내 창고
                </Button>
                <Button loading={submitting} disabled={Boolean(submitDisabledReason) || submitting} onClick={onSubmit}>
                  아바타 저장
                </Button>
              </div>
            </section>
          </StudioPanel>
        }
        statusLayer={
          <Inline gap="small">
            <PanelResizeHandle
              axis="horizontal"
              label="왼쪽 패널 폭 조절"
              dragging={layout.resizing === 'left'}
              onResizeStep={(delta) => onResizePanel('left', delta * 16)}
            />
            <PanelResizeHandle
              axis="horizontal"
              label="오른쪽 패널 폭 조절"
              dragging={layout.resizing === 'right'}
              onResizeStep={(delta) => onResizePanel('right', delta * 16)}
            />
          </Inline>
        }
        toastLayer={
          toast ? (
            <Toast
              tone={toast.tone}
              title={toast.title}
              message={toast.message}
              onDismiss={onDismissToast}
            />
          ) : undefined
        }
        data-v2-screen="a-avatar-studio"
        data-v2-state={state}
      />
      <AssetLoadModal
        open={loadModalOpen}
        tab={loadModalTab}
        assets={loadAvatars}
        loading={loadAvatarsLoading}
        onTabChange={onLoadTabChange}
        onSelectAsset={onSelectLoadAvatar}
        onClose={onCloseLoadModal}
      />
    </>
  )
}

interface AvatarToolsPanelProps {
  state: AvatarStudioScreenState
  activeTool: StudioToolId
  disabledToolIds: StudioToolId[]
  tools: ToolButtonProps['tool'][]
  brushSize: number
  brushSizePresets: number[]
  opacity: number
  swatches: PaletteSwatchModel[]
  selectedSwatch: PaletteSwatchModel
  selectedSwatchId: string
  recentSwatchIds: string[]
  resizingTools: boolean
  onToolChange: (toolId: StudioToolId) => void
  onBrushSizeChange: (brushSize: number) => void
  onOpacityChange: (opacity: number) => void
  onSelectColor: (swatchId: string) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onOpenLoadModal: () => void
  onResizeToolBlock: (delta: number) => void
}

function AvatarToolsPanel({
  state,
  activeTool,
  disabledToolIds,
  tools,
  brushSize,
  brushSizePresets,
  opacity,
  swatches,
  selectedSwatch,
  selectedSwatchId,
  recentSwatchIds,
  resizingTools,
  onToolChange,
  onBrushSizeChange,
  onOpacityChange,
  onSelectColor,
  onUndo,
  onRedo,
  onClear,
  onOpenLoadModal,
  onResizeToolBlock,
}: AvatarToolsPanelProps) {
  return (
    <StudioPanel
      side="left"
      title="도구"
      state={resizingTools ? 'resizing' : 'expanded'}
      actions={
        <Button size="small" variant="secondary" onClick={onOpenLoadModal}>
          아바타 불러오기
        </Button>
      }
    >
      <Stack gap="medium">
        <DrawingToolbar
          label="아바타 그리기 도구"
          tools={tools}
          activeTool={activeTool}
          disabledToolIds={disabledToolIds}
          onToolChange={(toolId) => {
            if (toolId === 'undo') {
              onUndo()
              return
            }

            if (toolId === 'redo') {
              onRedo()
              return
            }

            if (toolId === 'clear') {
              onClear()
              return
            }

            onToolChange(toolId)
          }}
        />
        <BrushSizeControl
          label="굵기"
          value={brushSize}
          presets={brushSizePresets}
          min={2}
          max={8}
          disabled={state === 'submitting'}
          onChange={onBrushSizeChange}
        />
        <label className={styles.opacityControl}>
          <span>불투명도</span>
          <output>{Math.round(opacity * 100)}%</output>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={opacity}
            onChange={(event) => onOpacityChange(Number(event.currentTarget.value))}
          />
        </label>
        <CurrentColor swatch={selectedSwatch} />
        <AvatarRgbHexPalette
          label="색상"
          swatches={swatches}
          selectedSwatchId={selectedSwatchId}
          recentSwatchIds={recentSwatchIds}
          disabled={state === 'submitting'}
          onSelect={onSelectColor}
        />
        <PanelResizeHandle
          axis="vertical"
          label="도구 블록 세로 크기 조절"
          dragging={resizingTools}
          onResizeStep={(delta) => onResizeToolBlock(delta * 0.05)}
        />
      </Stack>
    </StudioPanel>
  )
}

function AvatarDrawingCanvas({
  image,
  activeTool,
  brushSize,
  disabled,
  selectedSwatch,
  toolLabel,
  onDrawPoint,
  onErasePoint,
  onSampleColor,
}: {
  image: AvatarStudioCanvasImage
  activeTool: StudioToolId
  brushSize: number
  disabled: boolean
  selectedSwatch: PaletteSwatchModel
  toolLabel: string
  onDrawPoint: (point: AvatarStudioCanvasPoint) => void
  onErasePoint: (point: AvatarStudioCanvasPoint) => void
  onSampleColor: (point: AvatarStudioCanvasPoint) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef<{
    id: number
    lastPoint: AvatarStudioCanvasPoint
  } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context || typeof ImageData === 'undefined') {
      return
    }

    canvas.width = image.width
    canvas.height = image.height
    context.clearRect(0, 0, image.width, image.height)
    context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0)
  }, [image])

  const emitPoint = useCallback(
    (point: AvatarStudioCanvasPoint) => {
      if (activeTool === 'eraser' || selectedSwatch.transparent) {
        onErasePoint(point)
        return
      }

      if (activeTool === 'pen') {
        onDrawPoint(point)
      }
    },
    [activeTool, onDrawPoint, onErasePoint, selectedSwatch.transparent],
  )

  const emitStroke = useCallback(
    (from: AvatarStudioCanvasPoint, to: AvatarStudioCanvasPoint) => {
      const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
      const steps = Math.max(1, Math.ceil(distance / Math.max(1, brushSize / 2)))

      for (let step = 1; step <= steps; step += 1) {
        emitPoint({
          x: Math.round(from.x + ((to.x - from.x) * step) / steps),
          y: Math.round(from.y + ((to.y - from.y) * step) / steps),
        })
      }
    },
    [brushSize, emitPoint],
  )

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return
    }

    const point = getCanvasPoint(event, image)

    if (!point) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    if (activeTool === 'eyedropper') {
      onSampleColor(point)
      return
    }

    if (activeTool !== 'pen' && activeTool !== 'eraser') {
      return
    }

    pointerRef.current = {
      id: event.pointerId,
      lastPoint: point,
    }
    emitPoint(point)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const activePointer = pointerRef.current

    if (disabled || !activePointer || activePointer.id !== event.pointerId) {
      return
    }

    const point = getCanvasPoint(event, image)

    if (!point) {
      return
    }

    event.preventDefault()
    emitStroke(activePointer.lastPoint, point)
    pointerRef.current = {
      ...activePointer,
      lastPoint: point,
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current?.id === event.pointerId) {
      pointerRef.current = null
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      width={image.width}
      height={image.height}
      role="img"
      aria-label={`아바타 그림판, 현재 도구 ${toolLabel}, 현재 색상 ${selectedSwatch.name}`}
      tabIndex={0}
      data-v2-component="avatar-drawing-canvas"
      data-v2-state={disabled ? 'disabled' : activeTool}
      data-tool={activeTool}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    />
  )
}

function AvatarRgbHexPalette({
  label,
  swatches,
  selectedSwatchId,
  recentSwatchIds,
  disabled,
  onSelect,
}: {
  label: string
  swatches: PaletteSwatchModel[]
  selectedSwatchId: string
  recentSwatchIds: string[]
  disabled: boolean
  onSelect: (swatchId: string) => void
}) {
  const baseSwatches = swatches.filter((swatch) => swatch.rgbHexRow === undefined)
  const rgbRows = Array.from(
    new Set(swatches.flatMap((swatch) => (swatch.rgbHexRow === undefined ? [] : [swatch.rgbHexRow]))),
  )
    .sort((first, second) => first - second)
    .map((row) => swatches.filter((swatch) => swatch.rgbHexRow === row))

  return (
    <section
      className={styles.rgbPalette}
      aria-label={label}
      data-v2-component="avatar-rgb-hex-palette"
      data-v2-state={disabled ? 'disabled' : 'enabled'}
    >
      <div className={styles.paletteHeader}>
        <strong>{label}</strong>
        <span>RGB 직접 선택</span>
      </div>
      <div className={styles.baseSwatches} role="group" aria-label="기본 색상">
        {baseSwatches.map((swatch) => (
          <AvatarColorButton
            key={swatch.id}
            swatch={swatch}
            selected={swatch.id === selectedSwatchId}
            recent={recentSwatchIds.includes(swatch.id)}
            disabled={disabled}
            compact={false}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className={styles.rgbHexRows} role="group" aria-label="RGB 육각형 색상">
        {rgbRows.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.rgbHexRow}>
            {row.map((swatch) => (
              <AvatarColorButton
                key={swatch.id}
                swatch={swatch}
                selected={swatch.id === selectedSwatchId}
                recent={recentSwatchIds.includes(swatch.id)}
                disabled={disabled}
                compact
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function AvatarColorButton({
  swatch,
  selected,
  recent,
  disabled,
  compact,
  onSelect,
}: {
  swatch: PaletteSwatchModel
  selected: boolean
  recent: boolean
  disabled: boolean
  compact: boolean
  onSelect: (swatchId: string) => void
}) {
  const style = {
    '--avatar-swatch-color': swatch.value,
  } as CSSProperties
  const state = disabled ? 'disabled' : selected ? 'selected' : recent ? 'recent' : 'idle'

  return (
    <button
      className={styles.colorButton}
      type="button"
      aria-label={`${swatch.name}${selected ? ', 선택됨' : ''}${recent ? ', 최근 사용' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      style={style}
      data-v2-state={state}
      data-compact={compact ? 'true' : 'false'}
      data-transparent={swatch.transparent ? 'true' : undefined}
      onClick={() => onSelect(swatch.id)}
    >
      <span aria-hidden="true" />
      {selected ? <strong aria-hidden="true" /> : null}
    </button>
  )
}

function CurrentColor({ swatch }: { swatch: PaletteSwatchModel }) {
  const style = {
    '--avatar-current-color': swatch.value,
  } as CSSProperties

  return (
    <section className={styles.currentColor} style={style} data-transparent={swatch.transparent ? 'true' : 'false'}>
      <span aria-hidden="true" />
      <div>
        <strong>현재 색상</strong>
        <small>{swatch.name}</small>
      </div>
    </section>
  )
}

function getSelectedSwatch(swatches: PaletteSwatchModel[], selectedSwatchId: string) {
  return swatches.find((swatch) => swatch.id === selectedSwatchId) ?? swatches[0] ?? {
    id: 'ink',
    name: '잉크',
    value: 'var(--semantic-color-text-primary)',
  }
}

function getCanvasPoint(
  event: ReactPointerEvent<HTMLCanvasElement>,
  image: AvatarStudioCanvasImage,
): AvatarStudioCanvasPoint | null {
  const rect = event.currentTarget.getBoundingClientRect()

  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  return {
    x: clampInteger(Math.floor(((event.clientX - rect.left) / rect.width) * image.width), 0, image.width - 1),
    y: clampInteger(Math.floor(((event.clientY - rect.top) / rect.height) * image.height), 0, image.height - 1),
  }
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getToolLabel(tools: ToolButtonProps['tool'][], activeTool: StudioToolId) {
  return tools.find((tool) => tool.id === activeTool)?.label ?? '펜'
}

function getDirtyMessage(
  dirtyState: AvatarStudioScreenProps['dirtyState'],
  sourceAvatarName: string | undefined,
) {
  if (dirtyState === 'unchanged') {
    return `${sourceAvatarName ?? '불러온 아바타'}를 수정한 뒤 저장할 수 있어요.`
  }

  if (dirtyState === 'submitted') {
    return '방금 저장한 내용과 같아요.'
  }

  if (dirtyState === 'blank') {
    return '새 아바타 작업을 시작했어요.'
  }

  return '저장하지 않은 변경이 있어요.'
}

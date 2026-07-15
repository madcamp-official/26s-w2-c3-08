import type { CSSProperties } from 'react'
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
  PaletteGrid,
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
              <AvatarPaintPreview selectedSwatch={selectedSwatch} />
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
        <PaletteGrid
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

function AvatarPaintPreview({ selectedSwatch }: { selectedSwatch: PaletteSwatchModel }) {
  const style = {
    '--avatar-paint-color': selectedSwatch.value,
  } as CSSProperties

  return (
    <div
      className={styles.paintPreview}
      style={style}
      data-transparent={selectedSwatch.transparent ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span data-part="head" />
      <span data-part="body" />
      <span data-part="arm-left" />
      <span data-part="arm-right" />
      <span data-part="leg-left" />
      <span data-part="leg-right" />
    </div>
  )
}

function getSelectedSwatch(swatches: PaletteSwatchModel[], selectedSwatchId: string) {
  return swatches.find((swatch) => swatch.id === selectedSwatchId) ?? swatches[0] ?? {
    id: 'ink',
    name: '잉크',
    value: 'var(--semantic-color-text-primary)',
  }
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

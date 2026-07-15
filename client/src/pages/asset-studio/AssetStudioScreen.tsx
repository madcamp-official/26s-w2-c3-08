import type { CSSProperties } from 'react'

import { Toast, type ToastTone } from '../../design-system/components'
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
import { AttributeForm } from './AttributeForm'
import styles from './AssetStudioScreen.module.css'

export type AssetStudioCategory = 'platform' | 'obstacle' | 'monster' | 'background'
export type AssetStudioScreenState =
  | 'default'
  | 'leftCollapsed'
  | 'rightCollapsed'
  | 'resizing'
  | 'sizeChanged'
  | 'loadMine'
  | 'loadOthers'
  | 'loadedUnchanged'
  | 'loadedChanged'
  | 'invalidMissingName'
  | 'submitting'
  | 'submitSuccess'
  | 'submitFailed'
  | 'offline'

export interface AssetStudioSize {
  widthCells: number
  heightCells: number
}

export interface AssetStudioAttrs {
  behaviors: string[]
  collider: 'solid' | 'hazard' | 'none'
  motion: 'static' | 'moving' | 'patrol'
}

export interface AssetStudioFormValue {
  name: string
  description: string
  category: AssetStudioCategory
  size: AssetStudioSize
  attrs: AssetStudioAttrs
}

export interface AssetStudioLayoutValue {
  leftCollapsed: boolean
  rightCollapsed: boolean
  leftPanelWidth: number
  rightPanelWidth: number
  toolBlockRatio: number
  resizing?: 'left' | 'right' | 'tools' | null
}

export interface AssetStudioToast {
  tone: ToastTone
  title: string
  message: string
  actionLabel?: string
}

export interface AssetStudioScreenCallbacks {
  onGoMain: () => void
  onOpenWarehouse: () => void
  onNewAsset: () => void
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
  onSelectLoadAsset: (assetId: string) => void
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onCategoryChange: (category: AssetStudioCategory) => void
  onSizeChange: (size: AssetStudioSize) => void
  onAttrsChange: (attrs: AssetStudioAttrs) => void
  onSubmit: () => void
  onDismissToast: () => void
}

export interface AssetStudioScreenProps extends AssetStudioScreenCallbacks {
  state: AssetStudioScreenState
  form: AssetStudioFormValue
  layout: AssetStudioLayoutValue
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
  sourceAssetName?: string
  submitDisabledReason?: string
  loadModalOpen: boolean
  loadModalTab: AssetLoadTab
  loadAssets: AssetLoadItem[]
  loadAssetsLoading?: boolean
  toast?: AssetStudioToast
  submitError?: string
}

const CELL_PX = 32
export function AssetStudioScreen({
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
  sourceAssetName,
  submitDisabledReason,
  loadModalOpen,
  loadModalTab,
  loadAssets,
  loadAssetsLoading = false,
  toast,
  submitError,
  onGoMain,
  onOpenWarehouse,
  onNewAsset,
  onToggleLeftPanel,
  onToggleRightPanel,
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
  onSelectLoadAsset,
  onNameChange,
  onDescriptionChange,
  onCategoryChange,
  onSizeChange,
  onAttrsChange,
  onSubmit,
  onDismissToast,
}: AssetStudioScreenProps) {
  const visibleSize = toVisibleSize(form.size)
  const visibleFrame = {
    x: 0,
    y: 0,
    width: visibleSize.width,
    height: visibleSize.height,
  }
  const shellStyle = {
    '--studio-left-panel-width': `${layout.leftPanelWidth}px`,
    '--studio-right-panel-width': `${layout.rightPanelWidth}px`,
  } as CSSProperties
  const submitting = state === 'submitting'
  const missingName = state === 'invalidMissingName'

  return (
    <>
      <StudioShell
        className={styles.shell}
        title="에셋 스튜디오"
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
            <Button size="small" onClick={onNewAsset}>
              새 에셋 만들기
            </Button>
          </Inline>
        }
        leftPanel={
          <LeftToolsPanel
            state={state}
            activeTool={activeTool}
            disabledToolIds={disabledToolIds}
            tools={tools}
            brushSize={brushSize}
            brushSizePresets={brushSizePresets}
            opacity={opacity}
            swatches={swatches}
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
            aria-label="에셋 캔버스 작업 영역"
            data-v2-component="asset-studio-workspace"
            data-v2-state={state}
            onPaste={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => event.preventDefault()}
          >
            <DrawingViewport
              label="에셋 캔버스"
              workspaceSize={visibleSize}
              visibleFrame={visibleFrame}
              checkerMode="light"
              gridVisible={false}
              outsideDim={false}
              surface="paper"
              showVisibleFrame={false}
              showStatus={false}
              status={submitting ? 'disabled' : activeTool === 'move' ? 'move' : dirtyState === 'blank' ? 'blank' : 'drawing'}
              toolLabel={getToolLabel(tools, activeTool)}
            >
              <div className={styles.assetCanvasSurface} aria-hidden="true" />
            </DrawingViewport>
          </section>
        }
        rightPanel={
          <StudioPanel side="right" title="속성" onToggle={onToggleRightPanel}>
            <AttributeForm
              value={form}
              missingName={missingName}
              disabled={submitting}
              submitDisabledReason={submitDisabledReason}
              submitting={submitting}
              onNameChange={onNameChange}
              onDescriptionChange={onDescriptionChange}
              onCategoryChange={onCategoryChange}
              onSizeChange={onSizeChange}
              onAttrsChange={onAttrsChange}
              onSubmit={onSubmit}
              onOpenWarehouse={onOpenWarehouse}
            />
            <DirtyStateNotice
              state={dirtyState === 'unchanged' ? 'unchanged' : dirtyState === 'submitted' ? 'submitted' : 'dirty'}
              message={getDirtyMessage(dirtyState, sourceAssetName)}
            />
            {submitError ? (
              <p className={styles.submitError} role="alert">
                {submitError}
              </p>
            ) : null}
          </StudioPanel>
        }
        toastLayer={
          toast ? (
            <Toast
              tone={toast.tone}
              title={toast.title}
              message={toast.message}
              action={toast.actionLabel ? { label: toast.actionLabel, onPress: onOpenWarehouse } : undefined}
              onDismiss={onDismissToast}
            />
          ) : undefined
        }
        data-v2-screen="b-asset-studio"
        data-v2-state={state}
      />
      <AssetLoadModal
        open={loadModalOpen}
        tab={loadModalTab}
        assets={loadAssets}
        loading={loadAssetsLoading}
        onTabChange={onLoadTabChange}
        onSelectAsset={onSelectLoadAsset}
        onClose={onCloseLoadModal}
      />
    </>
  )
}

interface LeftToolsPanelProps {
  state: AssetStudioScreenState
  activeTool: StudioToolId
  disabledToolIds: StudioToolId[]
  tools: ToolButtonProps['tool'][]
  brushSize: number
  brushSizePresets: number[]
  opacity: number
  swatches: PaletteSwatchModel[]
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

function LeftToolsPanel({
  state,
  activeTool,
  disabledToolIds,
  tools,
  brushSize,
  brushSizePresets,
  opacity,
  swatches,
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
}: LeftToolsPanelProps) {
  return (
    <StudioPanel
      side="left"
      title="도구"
      state={resizingTools ? 'resizing' : 'expanded'}
      actions={
        <Button size="small" variant="secondary" onClick={onOpenLoadModal}>
          에셋 불러오기
        </Button>
      }
    >
      <Stack gap="medium">
        <DrawingToolbar
          label="그리기 도구"
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
        <PaletteGrid
          label="팔레트"
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

function toVisibleSize(size: AssetStudioSize) {
  return {
    width: size.widthCells * CELL_PX,
    height: size.heightCells * CELL_PX,
  }
}

function getToolLabel(tools: ToolButtonProps['tool'][], activeTool: StudioToolId) {
  return tools.find((tool) => tool.id === activeTool)?.label ?? '펜'
}

function getDirtyMessage(state: AssetStudioScreenProps['dirtyState'], sourceAssetName: string | undefined) {
  if (state === 'unchanged') {
    return `${sourceAssetName ?? '불러온 에셋'}을 수정한 뒤 저장할 수 있어요.`
  }

  if (state === 'submitted') {
    return '에셋 생성을 요청했어요. 현재 캔버스와 속성은 유지됩니다.'
  }

  if (state === 'blank') {
    return '새 에셋을 그리고 속성을 입력해 주세요.'
  }

  return '그림 또는 속성이 변경되었습니다.'
}

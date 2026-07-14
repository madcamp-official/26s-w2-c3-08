import type { CSSProperties } from 'react'
import {
  AVATAR_VISIBLE_HEIGHT,
  AVATAR_VISIBLE_WIDTH,
  AVATAR_WORKSPACE_HEIGHT,
  AVATAR_WORKSPACE_WIDTH,
} from 'shared'

import { Badge, TextArea, TextField, Toast, type ToastTone } from '../../design-system/components'
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
  checkerMode,
  gridVisible,
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
  onToggleCheckerMode,
  onToggleGrid,
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
            selectedSwatchId={selectedSwatchId}
            recentSwatchIds={recentSwatchIds}
            checkerMode={checkerMode}
            gridVisible={gridVisible}
            resizingTools={layout.resizing === 'tools'}
            onToolChange={onToolChange}
            onBrushSizeChange={onBrushSizeChange}
            onOpacityChange={onOpacityChange}
            onSelectColor={onSelectColor}
            onToggleCheckerMode={onToggleCheckerMode}
            onToggleGrid={onToggleGrid}
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
              workspaceSize={{ width: AVATAR_WORKSPACE_WIDTH, height: AVATAR_WORKSPACE_HEIGHT }}
              visibleFrame={{
                x: AVATAR_VISIBLE_WIDTH,
                y: AVATAR_VISIBLE_HEIGHT,
                width: AVATAR_VISIBLE_WIDTH,
                height: AVATAR_VISIBLE_HEIGHT,
              }}
              checkerMode={checkerMode}
              gridVisible={gridVisible}
              outsideDim
              status={submitting ? 'disabled' : activeTool === 'move' ? 'move' : dirtyState === 'blank' ? 'blank' : 'drawing'}
              toolLabel={getToolLabel(tools, activeTool)}
            />
            <div className={styles.workspaceMeta}>
              <Badge state={state === 'submitFailed' || state === 'offline' ? 'failed' : submitting ? 'generating' : 'ready'} label={getStateLabel(state)} />
              <Badge state="ready" label={`${AVATAR_VISIBLE_WIDTH}x${AVATAR_VISIBLE_HEIGHT}`} />
              <Badge state={gridVisible ? 'ready' : 'queued'} label={gridVisible ? '격자 켜짐' : '격자 꺼짐'} />
            </div>
            <p className={styles.canvasNote}>
              보이는 영역은 256x512이고, 작업 영역은 768x1536입니다. 체커와 격자는 내보내기에 포함되지 않습니다.
            </p>
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
  selectedSwatchId: string
  recentSwatchIds: string[]
  checkerMode: CheckerMode
  gridVisible: boolean
  resizingTools: boolean
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
  selectedSwatchId,
  recentSwatchIds,
  checkerMode,
  gridVisible,
  resizingTools,
  onToolChange,
  onBrushSizeChange,
  onOpacityChange,
  onSelectColor,
  onToggleCheckerMode,
  onToggleGrid,
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
        <PaletteGrid
          label="팔레트"
          swatches={swatches}
          selectedSwatchId={selectedSwatchId}
          recentSwatchIds={recentSwatchIds}
          disabled={state === 'submitting'}
          onSelect={onSelectColor}
        />
        <Inline gap="small">
          <Button size="small" variant="secondary" onClick={onToggleCheckerMode}>
            {checkerMode === 'light' ? '어두운 체커' : '밝은 체커'}
          </Button>
          <Button size="small" variant="secondary" onClick={onToggleGrid}>
            {gridVisible ? '격자 끄기' : '격자 켜기'}
          </Button>
        </Inline>
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

function getToolLabel(tools: ToolButtonProps['tool'][], activeTool: StudioToolId) {
  return tools.find((tool) => tool.id === activeTool)?.label ?? '펜'
}

function getStateLabel(state: AvatarStudioScreenState) {
  const labels: Record<AvatarStudioScreenState, string> = {
    default: '편집 가능',
    loadMine: '내 아바타 불러오기',
    loadOthers: '남이 만든 아바타',
    loadedUnchanged: '수정 필요',
    loadedChanged: '수정됨',
    invalidName: '이름 확인',
    submitting: '저장 중',
    submitSuccess: '저장 완료',
    submitFailed: '저장 실패',
    offline: '오프라인',
  }

  return labels[state]
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

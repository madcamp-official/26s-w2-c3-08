import {
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import {
  Badge,
  EmptyState,
  LoadingState,
  Modal,
  Tabs,
  type ModalCloseReason,
} from '../components'
import { Button, Text } from '../primitives'
import { cx } from '../components/shared'
import styles from './StudioComponents.module.css'

export type StudioPanelSide = 'left' | 'right'
export type StudioPanelState = 'expanded' | 'collapsed' | 'resizing'
export type ResizeAxis = 'horizontal' | 'vertical'
export type StudioToolId = 'pen' | 'eraser' | 'eyedropper' | 'move' | 'undo' | 'redo' | 'clear'
export type CheckerMode = 'light' | 'dark'
export type DrawingViewportStatus = 'blank' | 'drawing' | 'move' | 'disabled'
export type AttributeFieldKind = 'radio' | 'checkbox' | 'select' | 'text'
export type AssetLoadTab = 'mine' | 'others'
export type DirtyState = 'unchanged' | 'changed' | 'dirty' | 'submitted'

export interface StudioPanelProps extends HTMLAttributes<HTMLElement> {
  side: StudioPanelSide
  title: string
  state?: StudioPanelState
  actions?: ReactNode
  children: ReactNode
  onToggle?: () => void
}

export function StudioPanel({
  side,
  title,
  state = 'expanded',
  actions,
  children,
  onToggle,
  className,
  ...props
}: StudioPanelProps) {
  const titleId = useId()
  const collapsed = state === 'collapsed'

  return (
    <section
      className={cx(styles.studioPanel, className)}
      aria-labelledby={titleId}
      data-v2-component="studio-panel"
      data-v2-state={state}
      data-side={side}
      data-state={state}
      {...props}
    >
      <header className={styles.panelHeader}>
        <div>
          <Text as="h3" id={titleId} weight="bold">
            {title}
          </Text>
          <Text variant="caption" tone="secondary" weight="bold">
            {side === 'left' ? '왼쪽 패널' : '오른쪽 패널'}
          </Text>
        </div>
        <div className={styles.panelActions}>
          {actions}
          {onToggle ? (
            <button
              className={styles.panelToggle}
              type="button"
              aria-expanded={!collapsed}
              aria-label={`${title} ${collapsed ? '펼치기' : '접기'}`}
              onClick={onToggle}
            >
              <span aria-hidden="true">{getToggleGlyph(side, collapsed)}</span>
            </button>
          ) : null}
        </div>
      </header>
      <div className={styles.panelBody} aria-hidden={collapsed}>
        {children}
      </div>
      {collapsed ? <span className={styles.collapsedRail}>{title}</span> : null}
    </section>
  )
}

export interface PanelResizeHandleProps extends HTMLAttributes<HTMLDivElement> {
  axis: ResizeAxis
  label: string
  disabled?: boolean
  dragging?: boolean
  onResizeStart?: () => void
  onResizeStep?: (delta: number) => void
}

export function PanelResizeHandle({
  axis,
  label,
  disabled = false,
  dragging = false,
  onResizeStart,
  onResizeStep,
  className,
  ...props
}: PanelResizeHandleProps) {
  const state = disabled ? 'disabled' : dragging ? 'dragging' : 'idle'

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || !onResizeStep) {
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      onResizeStep(-1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      onResizeStep(1)
    }
  }

  return (
    <div
      className={cx(styles.resizeHandle, className)}
      role="separator"
      aria-label={label}
      aria-orientation={axis === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      data-v2-component="panel-resize-handle"
      data-v2-state={state}
      data-axis={axis}
      data-state={state}
      onPointerDown={() => {
        if (!disabled) {
          onResizeStart?.()
        }
      }}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

export interface ToolButtonProps {
  tool: {
    id: StudioToolId
    label: string
    icon?: ReactNode
    shortcut?: string
  }
  active?: boolean
  disabled?: boolean
  onPress?: (toolId: StudioToolId) => void
}

export function ToolButton({ tool, active = false, disabled = false, onPress }: ToolButtonProps) {
  const state = disabled ? 'disabled' : active ? 'active' : 'idle'

  return (
    <button
      className={styles.toolButton}
      type="button"
      aria-label={tool.shortcut ? `${tool.label}, 단축키 ${tool.shortcut}` : tool.label}
      aria-pressed={active}
      disabled={disabled}
      data-v2-component="tool-button"
      data-v2-state={state}
      data-tool={tool.id}
      data-state={state}
      onClick={() => onPress?.(tool.id)}
    >
      <span className={styles.toolIcon} aria-hidden="true">
        {tool.icon ?? <DefaultToolIcon />}
      </span>
      <span>{tool.label}</span>
      {tool.shortcut ? <kbd>{tool.shortcut}</kbd> : null}
    </button>
  )
}

export interface DrawingToolbarProps {
  label: string
  tools: ToolButtonProps['tool'][]
  activeTool: StudioToolId
  disabledToolIds?: StudioToolId[]
  onToolChange?: (toolId: StudioToolId) => void
}

export function DrawingToolbar({
  label,
  tools,
  activeTool,
  disabledToolIds = [],
  onToolChange,
}: DrawingToolbarProps) {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label={label}
      data-v2-component="drawing-toolbar"
      data-v2-state={activeTool}
    >
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={tool.id === activeTool}
          disabled={disabledToolIds.includes(tool.id)}
          onPress={onToolChange}
        />
      ))}
    </div>
  )
}

export interface BrushSizeControlProps {
  label: string
  value: number
  presets: number[]
  min?: number
  max?: number
  disabled?: boolean
  onChange?: (value: number) => void
}

export function BrushSizeControl({
  label,
  value,
  presets,
  min = 1,
  max = 24,
  disabled = false,
  onChange,
}: BrushSizeControlProps) {
  const labelId = useId()
  const state = disabled ? 'disabled' : presets.includes(value) ? 'preset' : 'custom'

  return (
    <section
      className={styles.brushControl}
      aria-labelledby={labelId}
      data-v2-component="brush-size-control"
      data-v2-state={state}
      data-state={state}
    >
      <div className={styles.controlHeader}>
        <Text as="h3" id={labelId} variant="caption" tone="secondary" weight="bold">
          {label}
        </Text>
        <output aria-live="polite">{value}px</output>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        onChange={(event) => onChange?.(Number(event.currentTarget.value))}
      />
      <div className={styles.presetRow} aria-label={`${label} 프리셋`}>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={preset === value}
            disabled={disabled}
            data-v2-state={preset === value ? 'selected' : 'enabled'}
            onClick={() => onChange?.(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </section>
  )
}

export interface PaletteSwatchModel {
  id: string
  name: string
  value: string
  rgb?: {
    r: number
    g: number
    b: number
  }
  rgbHexRow?: number
  transparent?: boolean
}

export interface PaletteSwatchProps {
  swatch: PaletteSwatchModel
  selected?: boolean
  recent?: boolean
  disabled?: boolean
  onSelect?: (swatchId: string) => void
}

export function PaletteSwatch({
  swatch,
  selected = false,
  recent = false,
  disabled = false,
  onSelect,
}: PaletteSwatchProps) {
  const swatchStyle = {
    '--swatch-color': swatch.value,
  } as CSSProperties
  const state = disabled ? 'disabled' : selected ? 'selected' : recent ? 'recent' : 'idle'

  return (
    <button
      className={styles.swatch}
      type="button"
      aria-label={`${swatch.name}${selected ? ', 선택됨' : ''}${recent ? ', 최근 사용' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      style={swatchStyle}
      data-v2-component="palette-swatch"
      data-v2-state={state}
      data-transparent={swatch.transparent ? 'true' : undefined}
      data-state={state}
      onClick={() => onSelect?.(swatch.id)}
    >
      <span aria-hidden="true" />
      {selected ? <strong>선택</strong> : null}
    </button>
  )
}

export interface PaletteGridProps {
  label: string
  swatches: PaletteSwatchModel[]
  selectedSwatchId: string
  recentSwatchIds?: string[]
  disabled?: boolean
  onSelect?: (swatchId: string) => void
}

export function PaletteGrid({
  label,
  swatches,
  selectedSwatchId,
  recentSwatchIds = [],
  disabled = false,
  onSelect,
}: PaletteGridProps) {
  const labelId = useId()

  return (
    <section
      className={styles.paletteGrid}
      aria-labelledby={labelId}
      data-v2-component="palette-grid"
      data-v2-state={disabled ? 'disabled' : 'enabled'}
    >
      <Text as="h3" id={labelId} variant="caption" tone="secondary" weight="bold">
        {label}
      </Text>
      <div className={styles.swatchGrid} role="list">
        {swatches.map((swatch) => (
          <div key={swatch.id} role="listitem">
            <PaletteSwatch
              swatch={swatch}
              selected={swatch.id === selectedSwatchId}
              recent={recentSwatchIds.includes(swatch.id)}
              disabled={disabled}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export interface DrawingViewportProps {
  label: string
  workspaceSize: {
    width: number
    height: number
  }
  visibleFrame: {
    x: number
    y: number
    width: number
    height: number
  }
  checkerMode: CheckerMode
  gridVisible: boolean
  outsideDim: boolean
  status: DrawingViewportStatus
  toolLabel: string
  surface?: 'checker' | 'paper'
  showVisibleFrame?: boolean
  children?: ReactNode
}

export function DrawingViewport({
  label,
  workspaceSize,
  visibleFrame,
  checkerMode,
  gridVisible,
  outsideDim,
  status,
  toolLabel,
  surface = 'checker',
  showVisibleFrame = true,
  children,
}: DrawingViewportProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const viewportStyle = {
    '--workspace-aspect': `${workspaceSize.width} / ${workspaceSize.height}`,
    '--visible-left': `${toPercent(visibleFrame.x, workspaceSize.width)}%`,
    '--visible-top': `${toPercent(visibleFrame.y, workspaceSize.height)}%`,
    '--visible-width': `${toPercent(visibleFrame.width, workspaceSize.width)}%`,
    '--visible-height': `${toPercent(visibleFrame.height, workspaceSize.height)}%`,
    ...(frameSize
      ? {
          '--drawing-frame-width': `${frameSize.width}px`,
          '--drawing-frame-height': `${frameSize.height}px`,
        }
      : {}),
  } as CSSProperties

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (!viewport || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    let animationFrame = 0

    const updateFrameSize = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const viewportRect = viewport.getBoundingClientRect()
        const statusRect = statusRef.current?.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(viewport)
        const rowGap = Number.parseFloat(computedStyle.rowGap) || 0
        const aspectRatio = workspaceSize.width / workspaceSize.height
        const inlineLimit = Math.max(0, viewportRect.width)
        const blockLimit = Math.max(0, viewportRect.height - (statusRect?.height ?? 0) - rowGap)

        if (inlineLimit <= 0 || aspectRatio <= 0) {
          return
        }

        let width = inlineLimit
        let height = width / aspectRatio

        if (blockLimit > 0 && height > blockLimit) {
          height = blockLimit
          width = height * aspectRatio
        }

        const nextFrameSize = {
          width: Math.max(1, Math.floor(width)),
          height: Math.max(1, Math.floor(height)),
        }

        setFrameSize((previousFrameSize) => {
          if (
            previousFrameSize?.width === nextFrameSize.width &&
            previousFrameSize.height === nextFrameSize.height
          ) {
            return previousFrameSize
          }

          return nextFrameSize
        })
      })
    }

    const resizeObserver = new ResizeObserver(updateFrameSize)
    resizeObserver.observe(viewport)

    if (statusRef.current) {
      resizeObserver.observe(statusRef.current)
    }

    updateFrameSize()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [workspaceSize.height, workspaceSize.width])

  return (
    <section
      className={styles.drawingViewport}
      aria-label={label}
      ref={viewportRef}
      style={viewportStyle}
      data-v2-component="drawing-viewport"
      data-v2-state={status}
      data-checker-mode={checkerMode}
      data-grid-visible={gridVisible ? 'true' : 'false'}
      data-outside-dim={outsideDim ? 'true' : 'false'}
      data-surface={surface}
      data-state={status}
    >
      <div className={styles.viewportFrame}>
        <div className={styles.checkerLayer} aria-hidden="true" data-v2-layer="checker" />
        <div className={styles.sourceLayer} data-v2-layer="source-canvas">
          {children ?? <SampleSourcePixels />}
        </div>
        {outsideDim ? (
          <div className={styles.outsideDimLayer} aria-hidden="true" data-v2-layer="outside-dim">
            <span data-edge="top" />
            <span data-edge="right" />
            <span data-edge="bottom" />
            <span data-edge="left" />
          </div>
        ) : null}
        {gridVisible ? <div className={styles.gridLayer} aria-hidden="true" data-v2-layer="grid" /> : null}
        {showVisibleFrame ? <div className={styles.visibleFrame} aria-hidden="true" data-v2-layer="visible-frame" /> : null}
      </div>
      <div className={styles.viewportStatus} ref={statusRef} role="status" aria-live="polite">
        <Badge state={status === 'disabled' ? 'failed' : status === 'blank' ? 'queued' : 'ready'} label={getViewportStatusLabel(status)} />
        <Text variant="caption" tone="secondary">
          {toolLabel} · {workspaceSize.width}x{workspaceSize.height}
        </Text>
      </div>
    </section>
  )
}

export interface AttributeFieldOption {
  value: string
  label: string
  helper?: string
  disabled?: boolean
}

export interface AttributeFieldProps {
  label: string
  kind: AttributeFieldKind
  value: string | string[]
  options?: AttributeFieldOption[]
  placeholder?: string
  helper?: string
  error?: string
  disabledReason?: string
  onChange?: (value: string | string[]) => void
}

export function AttributeField({
  label,
  kind,
  value,
  options = [],
  placeholder,
  helper,
  error,
  disabledReason,
  onChange,
}: AttributeFieldProps) {
  const fieldId = useId()
  const helperId = useId()
  const disabled = Boolean(disabledReason)
  const state = error ? 'invalid' : disabled ? 'disabled' : 'enabled'

  return (
    <fieldset
      className={styles.attributeField}
      aria-labelledby={fieldId}
      aria-describedby={helper || error || disabledReason ? helperId : undefined}
      disabled={disabled}
      data-v2-component="attribute-field"
      data-v2-state={state}
      data-kind={kind}
      data-state={state}
    >
      <legend id={fieldId}>{label}</legend>
      {renderAttributeControl({ kind, label, value, options, placeholder, onChange })}
      {helper || error || disabledReason ? (
        <p id={helperId} className={error ? styles.fieldError : styles.fieldHelper}>
          {error ?? disabledReason ?? helper}
        </p>
      ) : null}
    </fieldset>
  )
}

export interface AssetLoadItem {
  id: string
  name: string
  category: string
  status: 'ready' | 'generating' | 'failed'
}

export interface AssetLoadModalProps {
  open: boolean
  tab: AssetLoadTab
  assets: AssetLoadItem[]
  loading?: boolean
  onTabChange?: (tab: AssetLoadTab) => void
  onSelectAsset?: (assetId: string) => void
  onClose: () => void
}

export function AssetLoadModal({
  open,
  tab,
  assets,
  loading = false,
  onTabChange,
  onSelectAsset,
  onClose,
}: AssetLoadModalProps) {
  return (
    <Modal
      open={open}
      title="에셋 불러오기"
      description="내가 만든 에셋과 남이 만든 에셋을 선택해 캔버스와 속성을 불러옵니다."
      size="medium"
      onClose={(_reason: ModalCloseReason) => onClose()}
    >
      <div
        className={styles.assetLoadModal}
        data-v2-component="asset-load-modal"
        data-v2-state={loading ? 'loading' : assets.length === 0 ? 'empty' : tab}
      >
        <Tabs
          ariaLabel="에셋 불러오기 탭"
          selectedValue={tab}
          onChange={(nextTab) => {
            if (nextTab === 'mine' || nextTab === 'others') {
              onTabChange?.(nextTab)
            }
          }}
          tabs={[
            { value: 'mine', label: '내가 만든', panelId: 'asset-load-list' },
            { value: 'others', label: '남이 만든', panelId: 'asset-load-list' },
          ]}
        />
        <div id="asset-load-list" className={styles.assetLoadList} role="tabpanel">
          {loading ? (
            <LoadingState label="에셋을 불러오는 중" message="목록 위치를 유지합니다." />
          ) : assets.length === 0 ? (
            <EmptyState title="불러올 에셋이 없어요." message="다른 탭을 확인하거나 새 에셋을 만들어주세요." />
          ) : (
            assets.map((asset) => (
              <button
                key={asset.id}
                className={styles.assetLoadItem}
                type="button"
                data-v2-state={asset.status}
                onClick={() => onSelectAsset?.(asset.id)}
              >
                <span aria-hidden="true" />
                <strong>{asset.name}</strong>
                <em>{asset.category}</em>
                <Badge state={asset.status === 'ready' ? 'ready' : asset.status === 'generating' ? 'generating' : 'failed'} label={getAssetStatusLabel(asset.status)} />
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

export interface DirtyStateNoticeProps {
  state: DirtyState
  message: string
  action?: {
    label: string
    onPress: () => void
  }
}

export function DirtyStateNotice({ state, message, action }: DirtyStateNoticeProps) {
  const normalizedState = state === 'changed' ? 'dirty' : state

  return (
    <div
      className={styles.dirtyNotice}
      role="status"
      aria-live="polite"
      data-v2-component="dirty-state-notice"
      data-v2-state={normalizedState}
      data-state={normalizedState}
    >
      <Badge state={normalizedState === 'unchanged' ? 'queued' : normalizedState === 'submitted' ? 'ready' : 'generating'} label={getDirtyStateLabel(state)} />
      <p>{message}</p>
      {action ? (
        <Button size="small" variant="secondary" onClick={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

interface RenderAttributeControlInput {
  kind: AttributeFieldKind
  label: string
  value: string | string[]
  options: AttributeFieldOption[]
  placeholder: string | undefined
  onChange: ((value: string | string[]) => void) | undefined
}

function renderAttributeControl({
  kind,
  label,
  value,
  options,
  placeholder,
  onChange,
}: RenderAttributeControlInput) {
  if (kind === 'select') {
    return (
      <select
        value={String(value)}
        aria-label={label}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (kind === 'text') {
    return (
      <input
        type="text"
        aria-label={label}
        value={String(value)}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      />
    )
  }

  return (
    <div className={styles.optionStack}>
      {options.map((option) => {
        const selected = Array.isArray(value)
          ? value.includes(option.value)
          : value === option.value
        const inputType = kind === 'checkbox' ? 'checkbox' : 'radio'

        return (
          <label key={option.value} className={styles.optionRow} data-selected={selected ? 'true' : undefined}>
            <input
              type={inputType}
              value={option.value}
              checked={selected}
              disabled={option.disabled}
              onChange={(event) => {
                if (kind === 'radio') {
                  onChange?.(event.currentTarget.value)
                  return
                }

                const currentValues = Array.isArray(value) ? value : []
                const nextValues = event.currentTarget.checked
                  ? [...currentValues, option.value]
                  : currentValues.filter((item) => item !== option.value)

                onChange?.(nextValues)
              }}
            />
            <span>
              <strong>{option.label}</strong>
              {option.helper ? <em>{option.helper}</em> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function SampleSourcePixels() {
  return (
    <div className={styles.sampleSourcePixels} aria-label="source canvas placeholder">
      <span />
      <span />
      <span />
    </div>
  )
}

function DefaultToolIcon() {
  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <path fill="currentColor" d="M4 13.8 13.8 4 16 6.2 6.2 16H4v-2.2Z" />
    </svg>
  )
}

function getToggleGlyph(side: StudioPanelSide, collapsed: boolean) {
  if (side === 'left') {
    return collapsed ? '>' : '<'
  }

  return collapsed ? '<' : '>'
}

function toPercent(value: number, total: number) {
  return total === 0 ? 0 : (value / total) * 100
}

function getViewportStatusLabel(status: DrawingViewportStatus) {
  const labels: Record<DrawingViewportStatus, string> = {
    blank: '빈 캔버스',
    drawing: '그리는 중',
    move: '전체 이동',
    disabled: '편집 잠김',
  }

  return labels[status]
}

function getAssetStatusLabel(status: AssetLoadItem['status']) {
  const labels: Record<AssetLoadItem['status'], string> = {
    ready: '사용 가능',
    generating: '생성 중',
    failed: '생성 실패',
  }

  return labels[status]
}

function getDirtyStateLabel(state: DirtyState) {
  const labels: Record<DirtyState, string> = {
    unchanged: '변경 사항 없음',
    changed: '변경됨',
    dirty: '변경됨',
    submitted: '제출 완료',
  }

  return labels[state]
}

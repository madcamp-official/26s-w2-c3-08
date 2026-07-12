import { useEffect, useRef, type CSSProperties, type DragEvent as ReactDragEvent } from 'react'
import * as Phaser from 'phaser'
import type { Asset, MapPlacement } from '../types/domain'
import { getAssetBehavior, getAssetColor, getSlopeDirection, isSlopeAsset } from './assetRules'

const BOARD_COLS = 24
const BOARD_ROWS = 10
const CELL_PX = 32
const BOARD_WIDTH = BOARD_COLS * CELL_PX
const BOARD_HEIGHT = BOARD_ROWS * CELL_PX
const MAP_ASSET_DRAG_TYPE = 'application/x-relay-map-asset'

type EditorTool = 'select' | 'place' | 'move' | 'erase' | 'start' | 'goal'

interface MapEditorCanvasProps {
  placements: MapPlacement[]
  selectedAsset: Asset | null
  selectedPlacementId: string
  tool: EditorTool
  toolLabel: string
  canAffordSelectedAsset: boolean
  isLocked: boolean
  zoom: number
  onToggleCell: (x: number, y: number) => void
  onDropAsset: (assetId: string, x: number, y: number) => void
  getEndpointLabel: (x: number, y: number) => string | null
}

interface SceneState {
  placements: MapPlacement[]
  selectedAsset: Asset | null
  selectedPlacementId: string
  tool: EditorTool
  toolLabel: string
  canAffordSelectedAsset: boolean
  isLocked: boolean
  getEndpointLabel: (x: number, y: number) => string | null
}

class EditorScene extends Phaser.Scene {
  private state: SceneState = {
    placements: [],
    selectedAsset: null,
    selectedPlacementId: '',
    tool: 'place',
    toolLabel: '배치',
    canAffordSelectedAsset: true,
    isLocked: false,
    getEndpointLabel: () => null,
  }

  private onToggleCell: (x: number, y: number) => void = () => {}
  private backgroundLayer?: Phaser.GameObjects.Graphics
  private gridLayer?: Phaser.GameObjects.Graphics
  private placementLayer?: Phaser.GameObjects.Container
  private hoverRect?: Phaser.GameObjects.Rectangle
  private selectedText?: Phaser.GameObjects.Text
  private loadingTextureKeys = new Set<string>()
  private failedTextureKeys = new Set<string>()

  constructor() {
    super('map-editor')
  }

  create() {
    this.cameras.main.setBackgroundColor('#dbeafe')
    this.backgroundLayer = this.add.graphics()
    this.placementLayer = this.add.container(0, 0)
    this.gridLayer = this.add.graphics()
    this.hoverRect = this.add
      .rectangle(0, 0, CELL_PX, CELL_PX, 0xf6be00, 0.26)
      .setOrigin(0)
      .setVisible(false)
    this.selectedText = this.add.text(10, BOARD_HEIGHT - 24, '', {
      color: '#111827',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.state.isLocked) {
        this.hoverRect?.setVisible(false)
        return
      }

      const cell = getCellFromPointer(pointer)

      if (cell === null) {
        this.hoverRect?.setVisible(false)
        return
      }

      const footprint = this.getHoverFootprint(cell.x, cell.y)
      this.hoverRect
        ?.setPosition(cell.x * CELL_PX, cell.y * CELL_PX)
        .setSize(footprint.width, footprint.height)
        .setFillStyle(footprint.isValid ? 0xf6be00 : 0xe52521, footprint.isValid ? 0.26 : 0.2)
        .setStrokeStyle(2, footprint.isValid ? 0xf6be00 : 0xe52521, 0.9)
        .setVisible(true)
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.state.isLocked) {
        return
      }

      const cell = getCellFromPointer(pointer)

      if (cell === null) {
        return
      }

      this.onToggleCell(cell.x, cell.y)
    })

    this.renderBoard()
  }

  syncState(state: SceneState, onToggleCell: (x: number, y: number) => void) {
    this.state = state
    this.onToggleCell = onToggleCell
    this.renderBoard()
  }

  private renderBoard() {
    if (!this.backgroundLayer || !this.gridLayer || !this.placementLayer) {
      return
    }

    this.backgroundLayer.clear()
    this.gridLayer.clear()
    this.placementLayer.removeAll(true)

    this.drawBackground()
    this.drawPlacements()
    this.drawEndpoints()
    this.drawGrid()

    const selectedPlacement = this.state.placements.find(
      (placement) => placement.id === this.state.selectedPlacementId,
    )
    const selectionText =
      selectedPlacement !== undefined
        ? `선택: ${selectedPlacement.asset.name}`
        : this.state.selectedAsset === null
          ? '선택된 에셋 없음'
          : `선택: ${this.state.selectedAsset.name}`

    this.selectedText?.setText(
      this.state.isLocked ? `맵 잠김 · ${selectionText}` : `도구: ${this.state.toolLabel} · ${selectionText}`,
    )
  }

  private drawBackground() {
    if (!this.backgroundLayer) {
      return
    }

    this.backgroundLayer.fillStyle(0xdbeafe, 1)
    this.backgroundLayer.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
    this.backgroundLayer.fillStyle(0x8b5a2b, 1)
    this.backgroundLayer.fillRect(0, BOARD_HEIGHT - CELL_PX * 2, BOARD_WIDTH, CELL_PX * 2)
  }

  private drawPlacements() {
    if (!this.placementLayer) {
      return
    }

    this.state.placements.forEach((placement) => {
      const ruleSource = {
        assetId: placement.asset.id,
        assetCategory: placement.asset.category,
        assetAttrs: placement.asset.attrs,
        colliderType: placement.asset.colliderType,
      }
      const color = getAssetColor(ruleSource)
      const behavior = getAssetBehavior(ruleSource)
      const x = placement.x * CELL_PX
      const y = placement.y * CELL_PX
      const width = Math.max(CELL_PX, (placement.asset.widthCells ?? 1) * CELL_PX)
      const height = Math.max(CELL_PX, (placement.asset.heightCells ?? 1) * CELL_PX)
      const isSelected = placement.id === this.state.selectedPlacementId
      const textureKey = this.getReadyAssetTextureKey(placement.asset)

      if (textureKey !== null) {
        this.drawImagePlacement(x, y, width, height, color, behavior, textureKey)
      } else if (isSlopeAsset(ruleSource)) {
        this.drawSlopePlacement(x, y, width, height, color, getSlopeDirection(ruleSource))
      } else {
        this.drawBlockPlacement(x, y, width, height, color, behavior)
      }

      this.drawPlacementFrame(x, y, width, height, behavior, isSelected)
      this.drawPlacementLabel(x, y, width, placement.asset.name, isSelected)

      if (isSelected) {
        this.drawSelectionHighlight(x, y, width, height)
      }
    })
  }

  private getHoverAsset() {
    const selectedPlacement = this.state.placements.find(
      (placement) => placement.id === this.state.selectedPlacementId,
    )

    return selectedPlacement?.asset ?? this.state.selectedAsset
  }

  private getHoverFootprint(cellX: number, cellY: number) {
    const asset =
      this.state.tool === 'move' || this.state.tool === 'place' ? this.getHoverAsset() : null
    const widthCells = Math.max(1, asset?.widthCells ?? 1)
    const heightCells = Math.max(1, asset?.heightCells ?? 1)
    const rect = { x: cellX, y: cellY, width: widthCells, height: heightCells }

    return {
      width: widthCells * CELL_PX,
      height: heightCells * CELL_PX,
      isValid: this.isHoverValid(rect),
    }
  }

  private isHoverValid(rect: { x: number; y: number; width: number; height: number }) {
    if (this.state.tool === 'select' || this.state.tool === 'erase') {
      return this.getPlacementAtCell(rect.x, rect.y) !== undefined
    }

    if (this.state.tool === 'start') {
      return (
        !this.doesAnyPlacementCoverCell(rect.x, rect.y) &&
        this.state.getEndpointLabel(rect.x, rect.y) !== 'GOAL'
      )
    }

    if (this.state.tool === 'goal') {
      return (
        !this.doesAnyPlacementCoverCell(rect.x, rect.y) &&
        this.state.getEndpointLabel(rect.x, rect.y) !== 'START'
      )
    }

    if (this.state.tool === 'move' && this.state.selectedPlacementId === '') {
      return this.getPlacementAtCell(rect.x, rect.y) !== undefined
    }

    if (this.state.tool === 'place' && !this.state.canAffordSelectedAsset) {
      return false
    }

    return (
      isRectInsideBoard(rect) &&
      !this.doesRectCoverEndpoint(rect) &&
      !this.state.placements
        .filter((placement) => placement.id !== this.state.selectedPlacementId)
        .some((placement) => doGridRectsOverlap(rect, getPlacementGridRect(placement)))
    )
  }

  private getPlacementAtCell(x: number, y: number) {
    return [...this.state.placements]
      .reverse()
      .find((placement) => doesRectCoverCell(getPlacementGridRect(placement), x, y))
  }

  private doesAnyPlacementCoverCell(x: number, y: number) {
    return this.getPlacementAtCell(x, y) !== undefined
  }

  private doesRectCoverEndpoint(rect: { x: number; y: number; width: number; height: number }) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        if (this.state.getEndpointLabel(x, y) !== null) {
          return true
        }
      }
    }

    return false
  }

  private drawSelectionHighlight(x: number, y: number, width: number, height: number) {
    if (!this.placementLayer) {
      return
    }

    const drawSize = this.getBoundedDrawSize(x, y, width, height)
    const graphics = this.add.graphics()
    graphics.lineStyle(3, 0xf6be00, 1)
    graphics.strokeRect(x + 3, y + 3, drawSize.width - 4, drawSize.height - 4)
    this.placementLayer.add(graphics)
  }

  private drawImagePlacement(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    behavior: ReturnType<typeof getAssetBehavior>,
    textureKey: string,
  ) {
    if (!this.placementLayer) {
      return
    }

    const drawSize = this.getBoundedDrawSize(x, y, width, height)
    const backing = this.add
      .rectangle(
        x + 1,
        y + 1,
        drawSize.width,
        drawSize.height,
        color,
        behavior === 'decorative' ? 0.18 : 0.12,
      )
      .setOrigin(0)
    const image = this.add.image(x + 1 + drawSize.width / 2, y + 1 + drawSize.height / 2, textureKey)
    image.setDisplaySize(drawSize.width, drawSize.height)

    this.placementLayer.add(backing)
    this.placementLayer.add(image)
  }

  private drawBlockPlacement(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    behavior: ReturnType<typeof getAssetBehavior>,
  ) {
    if (!this.placementLayer) {
      return
    }

    const drawSize = this.getBoundedDrawSize(x, y, width, height)
    this.placementLayer.add(
      this.add
        .rectangle(
          x + 1,
          y + 1,
          drawSize.width,
          drawSize.height,
          color,
          behavior === 'decorative' ? 0.78 : 0.92,
        )
        .setOrigin(0),
    )
  }

  private drawPlacementFrame(
    x: number,
    y: number,
    width: number,
    height: number,
    behavior: ReturnType<typeof getAssetBehavior>,
    isSelected: boolean,
  ) {
    if (!this.placementLayer) {
      return
    }

    const drawSize = this.getBoundedDrawSize(x, y, width, height)
    const graphics = this.add.graphics()
    const strokeColor = isSelected ? 0xf6be00 : behavior === 'decorative' ? 0x14532d : 0x111827
    graphics.lineStyle(isSelected ? 3 : 2, strokeColor, isSelected ? 1 : 0.78)
    graphics.strokeRect(x + 1, y + 1, drawSize.width, drawSize.height)
    this.placementLayer.add(graphics)
  }

  private drawPlacementLabel(
    x: number,
    y: number,
    width: number,
    assetName: string,
    isSelected: boolean,
  ) {
    if (!this.placementLayer) {
      return
    }

    const drawSize = this.getBoundedDrawSize(x, y, width, CELL_PX)
    const labelLength = drawSize.width >= 48 ? 2 : 1
    const label = assetName.trim().slice(0, labelLength) || '?'
    const chipWidth = Math.min(labelLength === 1 ? 26 : 42, Math.max(24, drawSize.width - 8))
    const chip = this.add
      .rectangle(x + 4, y + 4, chipWidth, 20, isSelected ? 0xfef3c7 : 0x111827, 0.9)
      .setOrigin(0)
    const text = this.add.text(x + 10, y + 7, label, {
      color: isSelected ? '#111827' : '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
    })

    this.placementLayer.add(chip)
    this.placementLayer.add(text)
  }

  private drawSlopePlacement(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    direction: 'floor-asc' | 'floor-desc',
  ) {
    if (!this.placementLayer) {
      return
    }

    const graphics = this.add.graphics()
    const { width: drawWidth, height: drawHeight } = this.getBoundedDrawSize(x, y, width, height)
    graphics.fillStyle(color, 0.92)

    if (direction === 'floor-desc') {
      graphics.fillTriangle(x + 1, y + 1, x + drawWidth, y + drawHeight, x + 1, y + drawHeight)
    } else {
      graphics.fillTriangle(x + drawWidth, y + 1, x + drawWidth, y + drawHeight, x + 1, y + drawHeight)
    }

    graphics.lineStyle(2, 0x111827, 0.72)
    graphics.strokeRect(x + 1, y + 1, drawWidth, drawHeight)
    this.placementLayer.add(graphics)
  }

  private getReadyAssetTextureKey(asset: Asset) {
    if (asset.sourceImageUrl.trim().length === 0) {
      return null
    }

    const textureKey = getAssetTextureKey(asset)

    if (this.textures.exists(textureKey)) {
      return textureKey
    }

    this.loadAssetTexture(asset.sourceImageUrl, textureKey)
    return null
  }

  private loadAssetTexture(sourceImageUrl: string, textureKey: string) {
    if (this.loadingTextureKeys.has(textureKey) || this.failedTextureKeys.has(textureKey)) {
      return
    }

    this.loadingTextureKeys.add(textureKey)
    const image = new Image()

    if (shouldUseAnonymousImageRequest(sourceImageUrl)) {
      image.crossOrigin = 'anonymous'
    }

    image.onload = () => {
      this.loadingTextureKeys.delete(textureKey)

      if (!this.textures.exists(textureKey)) {
        this.textures.addImage(textureKey, image)
      }

      this.renderBoard()
    }

    image.onerror = () => {
      this.loadingTextureKeys.delete(textureKey)
      this.failedTextureKeys.add(textureKey)
      this.renderBoard()
    }

    image.src = sourceImageUrl
  }

  private getBoundedDrawSize(x: number, y: number, width: number, height: number) {
    return {
      width: Math.max(2, Math.min(width, BOARD_WIDTH - x) - 2),
      height: Math.max(2, Math.min(height, BOARD_HEIGHT - y) - 2),
    }
  }

  private drawEndpoints() {
    if (!this.placementLayer) {
      return
    }

    for (let y = 0; y < BOARD_ROWS; y += 1) {
      for (let x = 0; x < BOARD_COLS; x += 1) {
        const label = this.state.getEndpointLabel(x, y)

        if (label === null) {
          continue
        }

        const px = x * CELL_PX
        const py = y * CELL_PX
        this.placementLayer.add(
          this.add.rectangle(px + 1, py + 1, CELL_PX - 2, CELL_PX - 2, 0xf6be00, 1).setOrigin(0),
        )
        this.placementLayer.add(
          this.add.text(px + 3, py + 10, label === 'START' ? 'S' : 'G', {
            color: '#111827',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
          }),
        )
      }
    }
  }

  private drawGrid() {
    if (!this.gridLayer) {
      return
    }

    this.gridLayer.lineStyle(1, 0x808080, 0.56)

    for (let x = 0; x <= BOARD_COLS; x += 1) {
      this.gridLayer.lineBetween(x * CELL_PX, 0, x * CELL_PX, BOARD_HEIGHT)
    }

    for (let y = 0; y <= BOARD_ROWS; y += 1) {
      this.gridLayer.lineBetween(0, y * CELL_PX, BOARD_WIDTH, y * CELL_PX)
    }

    this.gridLayer.lineStyle(2, 0x111827, 0.72)
    this.gridLayer.strokeRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
  }
}

function MapEditorCanvas({
  placements,
  selectedAsset,
  selectedPlacementId,
  tool,
  toolLabel,
  canAffordSelectedAsset,
  isLocked,
  zoom,
  onToggleCell,
  onDropAsset,
  getEndpointLabel,
}: MapEditorCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<EditorScene | null>(null)
  const onToggleCellRef = useRef(onToggleCell)

  useEffect(() => {
    onToggleCellRef.current = onToggleCell
  }, [onToggleCell])

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (isLocked || !hasMapAssetDragData(event)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (isLocked || !hasMapAssetDragData(event) || hostRef.current === null) {
      return
    }

    event.preventDefault()
    const assetId = event.dataTransfer.getData(MAP_ASSET_DRAG_TYPE)
    const cell = getCellFromClientPoint(event.clientX, event.clientY, hostRef.current)

    if (assetId.length === 0 || cell === null) {
      return
    }

    onDropAsset(assetId, cell.x, cell.y)
  }

  useEffect(() => {
    if (hostRef.current === null) {
      return undefined
    }

    const scene = new EditorScene()
    sceneRef.current = scene

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      backgroundColor: '#dbeafe',
      scene,
      scale: {
        mode: Phaser.Scale.NONE,
      },
    })

    return () => {
      sceneRef.current = null
      game.destroy(true)
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.syncState(
      {
        placements,
        selectedAsset,
        selectedPlacementId,
        tool,
        toolLabel,
        canAffordSelectedAsset,
        isLocked,
        getEndpointLabel,
      },
      (x, y) => onToggleCellRef.current(x, y),
    )
  }, [
    placements,
    selectedAsset,
    selectedPlacementId,
    tool,
    toolLabel,
    canAffordSelectedAsset,
    isLocked,
    getEndpointLabel,
  ])

  return (
    <div
      className={isLocked ? 'phaser-map-host is-locked' : 'phaser-map-host'}
      ref={hostRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ '--map-editor-zoom': zoom } as CSSProperties}
    />
  )
}

function hasMapAssetDragData(event: ReactDragEvent<HTMLDivElement>) {
  return Array.from(event.dataTransfer.types).includes(MAP_ASSET_DRAG_TYPE)
}

function getCellFromClientPoint(clientX: number, clientY: number, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect()
  const x = Math.floor(((clientX - rect.left) / rect.width) * BOARD_COLS)
  const y = Math.floor(((clientY - rect.top) / rect.height) * BOARD_ROWS)

  if (x < 0 || x >= BOARD_COLS || y < 0 || y >= BOARD_ROWS) {
    return null
  }

  return { x, y }
}

function getCellFromPointer(pointer: Phaser.Input.Pointer) {
  const x = Math.floor(pointer.x / CELL_PX)
  const y = Math.floor(pointer.y / CELL_PX)

  if (x < 0 || x >= BOARD_COLS || y < 0 || y >= BOARD_ROWS) {
    return null
  }

  return { x, y }
}

function getPlacementGridRect(placement: MapPlacement) {
  return {
    x: placement.x,
    y: placement.y,
    width: Math.max(1, placement.asset.widthCells ?? 1),
    height: Math.max(1, placement.asset.heightCells ?? 1),
  }
}

function isRectInsideBoard(rect: { x: number; y: number; width: number; height: number }) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= BOARD_COLS &&
    rect.y + rect.height <= BOARD_ROWS
  )
}

function doesRectCoverCell(rect: { x: number; y: number; width: number; height: number }, x: number, y: number) {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

function doGridRectsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function getAssetTextureKey(asset: Asset) {
  const safeAssetId = asset.id.replace(/[^a-zA-Z0-9_-]/g, '_')

  return `map-asset-${safeAssetId}-${hashTextureSource(asset.sourceImageUrl)}`
}

function hashTextureSource(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

function shouldUseAnonymousImageRequest(sourceImageUrl: string) {
  try {
    const parsedUrl = new URL(sourceImageUrl, window.location.href)

    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      parsedUrl.origin !== window.location.origin
    )
  } catch {
    return false
  }
}

export default MapEditorCanvas

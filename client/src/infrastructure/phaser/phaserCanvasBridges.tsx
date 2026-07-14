import { lazy, Suspense } from 'react'

import { LoadingState } from '../../design-system/components'
import {
  PhaserBridge,
  type PhaserBridgeLifecycleEvent,
} from '../../pages/game/PhaserBridge'
import type {
  Asset,
  MapPlacement,
  MapSegmentSnapshot,
  MergedMap,
  RacePositionSnapshot,
  RoomPlayer,
} from '../../types/domain'

const MapEditorCanvas = lazy(() => import('../../game/MapEditorCanvas'))
const PlaytestCanvas = lazy(() => import('../../game/PlaytestCanvas'))
const RaceCanvas = lazy(() => import('../../game/RaceCanvas'))

export type EditorTool = 'select' | 'place' | 'move' | 'erase' | 'start' | 'goal'

export interface MapEditorBridgeProps {
  bridgeId: string
  routeKey: string
  placements: MapPlacement[]
  selectedAsset: Asset | null
  selectedPlacementId: string
  tool: EditorTool
  toolLabel: string
  canAffordSelectedAsset: boolean
  isLocked: boolean
  zoom: number
  getEndpointLabel: (x: number, y: number) => string | null
  onToggleCell: (x: number, y: number) => void
  onDropAsset: (assetId: string, x: number, y: number) => void
  onLifecycleEvent?: (event: PhaserBridgeLifecycleEvent) => void
}

export interface PlaytestBridgeProps {
  bridgeId: string
  routeKey: string
  isCleared: boolean
  segment: MapSegmentSnapshot | null
  resetSignal: number
  onClear: () => void
  onLifecycleEvent?: (event: PhaserBridgeLifecycleEvent) => void
}

export interface RaceBridgeProps {
  bridgeId: string
  routeKey: string
  players: RoomPlayer[]
  currentUserId: string | null
  mergedMap: MergedMap | null
  racePositions: Record<string, RacePositionSnapshot>
  isExtended: boolean
  elapsedSeconds: number
  onProgress: (
    progressById: Record<string, number>,
    localPosition?: Omit<RacePositionSnapshot, 'userId'>,
  ) => void
  onFinish: () => void
  onLifecycleEvent?: (event: PhaserBridgeLifecycleEvent) => void
}

export function MapEditorPhaserBridge({
  bridgeId,
  routeKey,
  onLifecycleEvent,
  ...canvasProps
}: MapEditorBridgeProps) {
  return (
    <PhaserBridge
      bridgeId={bridgeId}
      routeKey={routeKey}
      kind="map-editor"
      label="MapEditorCanvas"
      summary="24x10 보드 · 32px snap · Phaser input"
      onLifecycleEvent={onLifecycleEvent}
    >
      <Suspense fallback={<LoadingState label="맵 에디터 불러오는 중" />}>
        <MapEditorCanvas {...canvasProps} />
      </Suspense>
    </PhaserBridge>
  )
}

export function PlaytestPhaserBridge({
  bridgeId,
  routeKey,
  onLifecycleEvent,
  ...canvasProps
}: PlaytestBridgeProps) {
  return (
    <PhaserBridge
      bridgeId={bridgeId}
      routeKey={routeKey}
      kind="playtest"
      label="PlaytestCanvas"
      summary="검증 플레이 · Phaser physics/collision"
      onLifecycleEvent={onLifecycleEvent}
    >
      <Suspense fallback={<LoadingState label="검증 캔버스 불러오는 중" />}>
        <PlaytestCanvas {...canvasProps} />
      </Suspense>
    </PhaserBridge>
  )
}

export function RacePhaserBridge({
  bridgeId,
  routeKey,
  onLifecycleEvent,
  ...canvasProps
}: RaceBridgeProps) {
  return (
    <PhaserBridge
      bridgeId={bridgeId}
      routeKey={routeKey}
      kind="race"
      label="RaceCanvas"
      summary="레이스 렌더/input/physics · React HUD mirrored"
      onLifecycleEvent={onLifecycleEvent}
    >
      <Suspense fallback={<LoadingState label="레이스 캔버스 불러오는 중" />}>
        <RaceCanvas {...canvasProps} />
      </Suspense>
    </PhaserBridge>
  )
}

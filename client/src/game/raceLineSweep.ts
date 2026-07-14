import type { MapPoint, MergedMap } from '../types/domain'

export const RACE_LINE_SWEEP_INTERVAL_SECONDS = 50
const CONNECTOR_CELLS_BETWEEN_SEGMENTS = 3

export interface RaceLineGroundSpan {
  segmentId: string
  start: MapPoint
  end: MapPoint
}

export function getRaceLineSweepStep(
  mergedMap: MergedMap | null,
  elapsedSeconds: number,
) {
  if (mergedMap === null || mergedMap.segments.length === 0) {
    return 0
  }

  return Math.min(
    mergedMap.segments.length,
    Math.floor(normalizeElapsedSeconds(elapsedSeconds) / RACE_LINE_SWEEP_INTERVAL_SECONDS),
  )
}

export function getDestroyedRaceSegmentIds(
  mergedMap: MergedMap | null,
  elapsedSeconds: number,
) {
  const sweepStep = getRaceLineSweepStep(mergedMap, elapsedSeconds)

  if (mergedMap === null || sweepStep <= 0) {
    return new Set<string>()
  }

  return new Set(mergedMap.segments.slice(0, sweepStep).map((segment) => segment.id))
}

export function getRaceLineGroundSpans(
  mergedMap: MergedMap | null,
  elapsedSeconds: number,
) {
  const destroyedIds = getDestroyedRaceSegmentIds(mergedMap, elapsedSeconds)

  if (mergedMap === null || destroyedIds.size === 0) {
    return []
  }

  return getMergedMapSegmentSpans(mergedMap).filter((span) => destroyedIds.has(span.segmentId))
}

export function getMergedMapSegmentSpans(mergedMap: MergedMap): RaceLineGroundSpan[] {
  const spans: RaceLineGroundSpan[] = []
  let currentGlobalEnd: MapPoint | null = null

  mergedMap.segments.forEach((segment, segmentIndex) => {
    const connectorCells = segmentIndex === 0 ? 0 : CONNECTOR_CELLS_BETWEEN_SEGMENTS
    const offsetX =
      currentGlobalEnd === null
        ? mergedMap.globalStart.x - segment.startPoint.x
        : currentGlobalEnd.x + connectorCells - segment.startPoint.x
    const offsetY =
      currentGlobalEnd === null
        ? mergedMap.globalStart.y - segment.startPoint.y
        : currentGlobalEnd.y - segment.startPoint.y
    const start = {
      x: segment.startPoint.x + offsetX,
      y: segment.startPoint.y + offsetY,
    }
    const end = {
      x: segment.endPoint.x + offsetX,
      y: segment.endPoint.y + offsetY,
    }

    spans.push({
      segmentId: segment.id,
      start,
      end,
    })
    currentGlobalEnd = end
  })

  return spans
}

function normalizeElapsedSeconds(elapsedSeconds: number) {
  return Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0
}

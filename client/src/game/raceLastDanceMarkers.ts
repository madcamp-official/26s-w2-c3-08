export type LastDanceMedal = 'gold' | 'silver' | 'bronze'

export interface LastDanceMarkerCandidate {
  playerId: string
  nickname: string
  progress: number
  x: number
  order: number
}

export interface LastDanceMarker {
  playerId: string
  nickname: string
  progress: number
  x: number
  rank: 1 | 2 | 3
  medal: LastDanceMedal
  label: string
  color: number
  textColor: string
}

const medalStyles: Array<{
  rank: 1 | 2 | 3
  medal: LastDanceMedal
  label: string
  color: number
  textColor: string
}> = [
  { rank: 1, medal: 'gold', label: '금', color: 0xf6be00, textColor: '#7c4a00' },
  { rank: 2, medal: 'silver', label: '은', color: 0xcbd5e1, textColor: '#334155' },
  { rank: 3, medal: 'bronze', label: '동', color: 0xb98200, textColor: '#5f3a1a' },
]

export function getLastDanceTopMarkers(
  candidates: LastDanceMarkerCandidate[],
): LastDanceMarker[] {
  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      progress: normalizeProgress(candidate.progress),
    }))
    .sort((left, right) => {
      if (right.progress !== left.progress) {
        return right.progress - left.progress
      }

      return left.order - right.order
    })
    .slice(0, medalStyles.length)
    .map((candidate, index) => {
      const medal = medalStyles[index]

      return {
        playerId: candidate.playerId,
        nickname: candidate.nickname,
        progress: candidate.progress,
        x: candidate.x,
        ...medal,
      }
    })
}

function normalizeProgress(progress: number) {
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0
}

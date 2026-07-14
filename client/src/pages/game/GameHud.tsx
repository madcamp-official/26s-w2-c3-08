import { Badge, ProgressBar } from '../../design-system/components'
import { Inline, Stack } from '../../design-system/primitives'
import styles from './GameHud.module.css'

export type GamePhaseId = 'building' | 'validating' | 'merging' | 'racing' | 'finished'

export interface HUDTimerProps {
  phase: GamePhaseId
  remainingMs: number | null
  label?: string
  warningMs?: number
}

export interface BudgetMeterProps {
  used: number
  limit: number
  label?: string
}

export interface RaceRankingPlayer {
  id: string
  nickname: string
  progress: number
  finishedAtMs: number | null
  validationCleared: boolean
  isLocal?: boolean
  rank?: number
}

export interface ResultsRowPlayer extends RaceRankingPlayer {
  rank: number
  distanceToGoal: number
}

export function HUDTimer({
  phase,
  remainingMs,
  label = '남은 시간',
  warningMs = 15_000,
}: HUDTimerProps) {
  const isWarning = remainingMs !== null && remainingMs <= warningMs

  return (
    <div
      className={styles.timer}
      data-v2-component="hud-timer"
      data-v2-state={isWarning ? 'warning' : 'default'}
      data-v2-phase={phase}
      role="timer"
      aria-live={isWarning ? 'assertive' : 'polite'}
    >
      <span>{label}</span>
      <strong>{remainingMs === null ? '--:--' : formatTimer(remainingMs)}</strong>
      {isWarning ? <em>마감 임박</em> : null}
    </div>
  )
}

export function BudgetMeter({ used, limit, label = '배치 예산' }: BudgetMeterProps) {
  const percent = limit > 0 ? Math.round((Math.min(used, limit) / limit) * 100) : 0
  const state = used > limit ? 'exceeded' : percent >= 85 ? 'warning' : 'default'

  return (
    <div className={styles.budget} data-v2-component="budget-meter" data-v2-state={state}>
      <ProgressBar value={Math.min(used, limit)} max={limit} label={`${label} ${used}/${limit}`} />
      <span>{state === 'exceeded' ? '예산 초과' : state === 'warning' ? '예산 주의' : '사용 가능'}</span>
    </div>
  )
}

export function RaceRanking({ players }: { players: RaceRankingPlayer[] }) {
  const sortedPlayers = [...players].sort(compareRacePlayers)

  return (
    <ol className={styles.ranking} data-v2-component="race-ranking" aria-label="레이스 순위">
      {sortedPlayers.map((player, index) => (
        <li key={player.id} data-v2-state={player.isLocal ? 'local' : 'remote'}>
          <Inline justify="between" gap="small">
            <strong>{index + 1}. {player.nickname}</strong>
            <Badge
              state={player.finishedAtMs === null ? 'generating' : 'ready'}
              label={player.finishedAtMs === null ? `${Math.round(player.progress)}%` : formatRaceTime(player.finishedAtMs)}
            />
          </Inline>
          <ProgressBar value={player.progress} max={100} label={`${player.nickname} 진행률`} />
          {!player.validationCleared ? <small>15초 freeze 적용</small> : null}
        </li>
      ))}
    </ol>
  )
}

export function ResultsRow({ player }: { player: ResultsRowPlayer }) {
  return (
    <article
      className={styles.resultRow}
      data-v2-component="results-row"
      data-v2-state={player.isLocal ? 'local' : player.rank === 1 ? 'winner' : 'default'}
    >
      <strong>{player.rank}</strong>
      <Stack gap="small">
        <span>{player.nickname}</span>
        <small>{player.validationCleared ? '검증 성공' : '15초 freeze 적용'}</small>
      </Stack>
      <em>
        {player.finishedAtMs === null
          ? `미완주 · GOAL까지 ${Math.round(player.distanceToGoal)}`
          : `완주 ${formatRaceTime(player.finishedAtMs)}`}
      </em>
    </article>
  )
}

export function compareRacePlayers(left: RaceRankingPlayer, right: RaceRankingPlayer) {
  if (left.finishedAtMs !== null && right.finishedAtMs !== null) {
    return left.finishedAtMs - right.finishedAtMs
  }

  if (left.finishedAtMs !== null) {
    return -1
  }

  if (right.finishedAtMs !== null) {
    return 1
  }

  return right.progress - left.progress
}

export function formatTimer(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatRaceTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((milliseconds % 1000) / 10)

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

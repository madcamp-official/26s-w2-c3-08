import type { ReactNode } from 'react'

import {
  Badge,
  EmptyState,
  ErrorState,
  Modal,
  ProgressBar,
} from '../../design-system/components'
import { Button, Inline } from '../../design-system/primitives'
import { GameShell } from '../../design-system/shells'
import type { Asset, RoomPlayer } from '../../types/domain'
import {
  BudgetMeter,
  compareRacePlayers,
  HUDTimer,
  RaceRanking,
  ResultsRow,
  type GamePhaseId,
  type RaceRankingPlayer,
} from './GameHud'
import styles from './GameScreens.module.css'

export interface GameScreenCallbacks {
  onGoRoom: () => void
  onLeaveRoom: () => void
}

export interface MapBuildScreenProps extends GameScreenCallbacks {
  state:
    | 'editing'
    | 'selectedAsset'
    | 'placementDenied'
    | 'locked'
    | 'timeVotePending'
    | 'buildTest'
    | 'submitPending'
    | 'submitComplete'
  roomId: string
  remainingMs: number | null
  budgetUsed: number
  budgetLimit: number
  assets: Asset[]
  selectedAssetId: string
  tool: string
  message: string
  timeVoteText: string
  players: RoomPlayer[]
  canvas: ReactNode
  buildTestCanvas?: ReactNode
  onSelectAsset: (assetId: string) => void
  onSelectTool: (tool: string) => void
  onTimeVote: (deltaSeconds: number) => void
  onOpenBuildTest: () => void
  onCloseBuildTest: () => void
  onSubmit: () => void
}

export interface ValidationScreenProps extends GameScreenCallbacks {
  state: 'playing' | 'cleared' | 'failedRecorded' | 'allWaiting' | 'timeout' | 'noSegment'
  roomId: string
  remainingMs: number | null
  players: RoomPlayer[]
  message: string
  canvas: ReactNode
  onReset: () => void
  onRecordFailure: () => void
}

export interface MergingScreenProps extends GameScreenCallbacks {
  state: 'merging' | 'validatedSegments' | 'fallback' | 'error'
  roomId: string
  progress: number
  validatedSegments: number
  globalPlacements: number
  usedFallback: boolean
  message: string
  onRetryMerge: () => void
}

export interface RaceScreenProps extends GameScreenCallbacks {
  state: 'normal' | 'freezePenalty' | 'overtime' | 'playerFinished' | 'missingMap' | 'finish'
  roomId: string
  remainingMs: number | null
  players: RoomPlayer[]
  currentUserId: string
  message: string
  canvas: ReactNode
  onFinishRace: () => void
  onShowResults: () => void
}

export interface ResultsScreenProps extends GameScreenCallbacks {
  state: 'winner' | 'unfinished' | 'localHighlight' | 'offline' | 'empty'
  roomId: string
  players: RoomPlayer[]
  currentUserId: string
  stale: boolean
}

export function MapBuildScreen({
  state,
  roomId,
  remainingMs,
  budgetUsed,
  budgetLimit,
  assets,
  selectedAssetId,
  tool,
  message,
  timeVoteText,
  players,
  canvas,
  buildTestCanvas,
  onGoRoom,
  onLeaveRoom,
  onSelectAsset,
  onSelectTool,
  onTimeVote,
  onOpenBuildTest,
  onCloseBuildTest,
  onSubmit,
}: MapBuildScreenProps) {
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId)
  const locked = state === 'locked' || state === 'submitComplete'

  return (
    <>
      <GameShell
        title="맵 제작"
        state={locked ? 'locked' : 'default'}
        topHud={
          <GameTopHud
            phase="building"
            screenLabel="S4 Map Build"
            roomId={roomId}
            remainingMs={remainingMs}
            onGoRoom={onGoRoom}
            onLeaveRoom={onLeaveRoom}
          >
            <BudgetMeter used={budgetUsed} limit={budgetLimit} />
          </GameTopHud>
        }
        leftShelf={
          <section className={styles.panelStack} data-v2-component="asset-shelf">
            <PanelHeader eyebrow="에셋 선반" title="시스템/내 에셋" />
            <div className={styles.assetList}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={asset.id === selectedAssetId}
                  data-v2-state={asset.id === selectedAssetId ? 'selected' : 'idle'}
                  onClick={() => onSelectAsset(asset.id)}
                >
                  <span>{asset.name}</span>
                  <small>{getAssetSizeText(asset)}</small>
                </button>
              ))}
            </div>
          </section>
        }
        canvas={canvas}
        rightToolDock={
          <section className={styles.panelStack} data-v2-component="tool-dock">
            <PanelHeader eyebrow="제작 도구" title="배치 컨트롤" />
            <div className={styles.toolGrid}>
              {['select', 'place', 'move', 'erase', 'start', 'goal'].map((toolId) => (
                <Button
                  key={toolId}
                  size="small"
                  variant={tool === toolId ? 'primary' : 'secondary'}
                  disabled={locked}
                  onClick={() => onSelectTool(toolId)}
                >
                  {getToolLabel(toolId)}
                </Button>
              ))}
            </div>
            <div className={styles.summaryCard}>
              <span>선택</span>
              <strong>{selectedAsset?.name ?? '없음'}</strong>
              <small>{message}</small>
            </div>
            <Inline gap="small">
              <Button size="small" variant="secondary" disabled={state === 'timeVotePending'} onClick={() => onTimeVote(15)}>
                +15s
              </Button>
              <Button size="small" variant="secondary" disabled={state === 'timeVotePending'} onClick={() => onTimeVote(-15)}>
                -15s
              </Button>
            </Inline>
            <p className={styles.statusText}>{timeVoteText}</p>
            <Button variant="secondary" disabled={locked} onClick={onOpenBuildTest}>
              테스트 하기
            </Button>
            <Button loading={state === 'submitPending'} disabled={locked} onClick={onSubmit}>
              {locked ? '제출 완료' : '제작 완료'}
            </Button>
          </section>
        }
        bottomOverlay={<PlayerReadyStrip players={players} />}
        statusOverlay={<GameStatusMessage state={state} message={message} />}
        data-v2-screen="s4-map-build"
      />
      {state === 'buildTest' && buildTestCanvas ? (
        <Modal
          open
          title="맵 테스트"
          description="현재 제작 스냅샷을 PlaytestCanvas로 확인합니다."
          size="large"
          onClose={onCloseBuildTest}
          footer={
            <Inline gap="small">
              <Button variant="secondary" onClick={onCloseBuildTest}>
                편집 계속
              </Button>
            </Inline>
          }
        >
          <div className={styles.modalCanvas}>{buildTestCanvas}</div>
        </Modal>
      ) : null}
    </>
  )
}

export function ValidationScreen({
  state,
  roomId,
  remainingMs,
  players,
  message,
  canvas,
  onGoRoom,
  onLeaveRoom,
  onReset,
  onRecordFailure,
}: ValidationScreenProps) {
  return (
    <GameShell
      title="검증"
      topHud={
        <GameTopHud
          phase="validating"
          screenLabel="D Validation"
          roomId={roomId}
          remainingMs={remainingMs}
          onGoRoom={onGoRoom}
          onLeaveRoom={onLeaveRoom}
        />
      }
      canvas={
        state === 'noSegment' ? (
          <ErrorState title="검증할 맵이 없어요." message={message} />
        ) : (
          canvas
        )
      }
      rightToolDock={
        <section className={styles.panelStack}>
          <PanelHeader eyebrow="검증" title="플레이 기록" />
          <p className={styles.statusText}>{message}</p>
          <PlayerReadyList players={players} readyLabel="검증 기록" pendingLabel="검증 중" />
          <Button variant="secondary" disabled={state === 'cleared'} onClick={onReset}>
            처음부터 다시
          </Button>
          <Button disabled={state === 'failedRecorded' || state === 'noSegment'} onClick={onRecordFailure}>
            실패로 진행
          </Button>
        </section>
      }
      statusOverlay={<GameStatusMessage state={state} message={message} />}
      data-v2-screen="d-validation"
    />
  )
}

export function MergingScreen({
  state,
  roomId,
  progress,
  validatedSegments,
  globalPlacements,
  usedFallback,
  message,
  onGoRoom,
  onLeaveRoom,
  onRetryMerge,
}: MergingScreenProps) {
  return (
    <GameShell
      title="맵 병합"
      topHud={
        <GameTopHud
          phase="merging"
          screenLabel="M Merging"
          roomId={roomId}
          remainingMs={null}
          onGoRoom={onGoRoom}
          onLeaveRoom={onLeaveRoom}
        />
      }
      canvas={
        <section className={styles.mergeStage} data-v2-component="merge-stage" data-v2-state={state}>
          <PanelHeader eyebrow="Merging" title="맵 조각 병합 중" />
          <p>{message}</p>
          <ProgressBar value={progress} max={100} label="병합 진행률" indeterminate={state === 'merging'} />
          <div className={styles.metricGrid}>
            <Metric label="검증 성공" value={String(validatedSegments)} />
            <Metric label="전역 에셋" value={String(globalPlacements)} />
            <Metric label="fallback" value={usedFallback ? '사용' : '미사용'} />
          </div>
          {state === 'error' ? (
            <Button variant="danger" onClick={onRetryMerge}>
              다시 병합
            </Button>
          ) : null}
        </section>
      }
      statusOverlay={<GameStatusMessage state={state} message={message} />}
      data-v2-screen="m-merging"
    />
  )
}

export function RaceScreen({
  state,
  roomId,
  remainingMs,
  players,
  currentUserId,
  message,
  canvas,
  onFinishRace,
  onGoRoom,
  onLeaveRoom,
  onShowResults,
}: RaceScreenProps) {
  const rankingPlayers = players.map((player) => toRankingPlayer(player, currentUserId))

  return (
    <GameShell
      title="레이스"
      state={state === 'missingMap' ? 'locked' : 'default'}
      topHud={
        <GameTopHud
          phase="racing"
          screenLabel="E Race"
          roomId={roomId}
          remainingMs={remainingMs}
          onGoRoom={onGoRoom}
          onLeaveRoom={onLeaveRoom}
        >
          {state === 'overtime' ? <Badge state="reconnecting" label="연장전" /> : null}
        </GameTopHud>
      }
      canvas={
        state === 'missingMap' ? (
          <ErrorState title="레이스 맵을 찾을 수 없어요." message={message} />
        ) : (
          canvas
        )
      }
      rightToolDock={
        <section className={styles.panelStack}>
          <PanelHeader eyebrow="레이스" title="순위와 패널티" />
          <p className={styles.statusText}>{message}</p>
          <RaceRanking players={rankingPlayers} />
          <Button disabled={state === 'finish' || state === 'missingMap'} onClick={onFinishRace}>
            완주 기록
          </Button>
          <Button onClick={onShowResults}>결과 보기</Button>
        </section>
      }
      statusOverlay={<GameStatusMessage state={state} message={message} />}
      data-v2-screen="e-race"
    />
  )
}

export function ResultsScreen({
  state,
  roomId,
  players,
  currentUserId,
  stale,
  onGoRoom,
  onLeaveRoom,
}: ResultsScreenProps) {
  const rows = players
    .map((player) => ({
      ...toRankingPlayer(player, currentUserId),
      distanceToGoal: player.raceDistanceToGoal,
    }))
    .sort(compareResultRows)
    .map((player, index) => ({
      ...player,
      rank: player.rank ?? index + 1,
    }))

  return (
    <GameShell
      title="결과"
      topHud={
        <GameTopHud
          phase="finished"
          screenLabel="F Results"
          roomId={roomId}
          remainingMs={null}
          onGoRoom={onGoRoom}
          onLeaveRoom={onLeaveRoom}
        >
          {stale ? <Badge state="offline" label="마지막 로컬 순위" /> : <Badge state="ready" label="최종 결과" />}
        </GameTopHud>
      }
      canvas={
        <section className={styles.resultsStage} data-v2-component="results-screen" data-v2-state={state}>
          <PanelHeader eyebrow="Results" title="최종 순위" />
          {rows.length === 0 ? (
            <EmptyState title="결과가 없어요." message="기록된 플레이어가 없습니다." />
          ) : (
            <div className={styles.resultList}>
              {rows.map((player) => (
                <ResultsRow key={player.id} player={player} />
              ))}
            </div>
          )}
          <Button onClick={onLeaveRoom}>로비로 돌아가기</Button>
        </section>
      }
      bottomOverlay={<span>{stale ? '오프라인 · 원격 결과를 새로 만들지 않습니다.' : '정렬된 최종 순위가 표시됩니다.'}</span>}
      data-v2-screen="f-results"
    />
  )
}

function GameTopHud({
  phase,
  screenLabel,
  roomId,
  remainingMs,
  children,
  onGoRoom,
  onLeaveRoom,
}: {
  phase: GamePhaseId
  screenLabel: string
  roomId: string
  remainingMs: number | null
  children?: ReactNode
  onGoRoom: () => void
  onLeaveRoom: () => void
}) {
  return (
    <Inline justify="between" gap="medium" className={styles.topHud}>
      <Inline gap="small">
        <Badge state="ready" label={screenLabel} />
        <span className={styles.roomId}>방 {roomId}</span>
      </Inline>
      <Inline gap="small">
        <HUDTimer phase={phase} remainingMs={remainingMs} />
        {children}
      </Inline>
      <Inline gap="small">
        <Button size="small" variant="secondary" onClick={onGoRoom}>
          방 대기실
        </Button>
        <Button size="small" variant="ghost" onClick={onLeaveRoom}>
          로비로 나가기
        </Button>
      </Inline>
    </Inline>
  )
}

function PanelHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className={styles.panelHeader}>
      <p>{eyebrow}</p>
      <h2>{title}</h2>
    </header>
  )
}

function PlayerReadyStrip({ players }: { players: RoomPlayer[] }) {
  return (
    <Inline gap="small" justify="center" className={styles.readyStrip} role="status" aria-live="polite">
      {players.map((player) => (
        <Badge
          key={player.id}
          state={player.isReady ? 'ready' : 'queued'}
          label={`${player.nickname} · ${player.isReady ? '제출 완료' : '제작 중'}`}
        />
      ))}
    </Inline>
  )
}

function PlayerReadyList({
  players,
  readyLabel,
  pendingLabel,
}: {
  players: RoomPlayer[]
  readyLabel: string
  pendingLabel: string
}) {
  return (
    <div className={styles.playerList} aria-label="플레이어 상태">
      {players.map((player) => (
        <div key={player.id}>
          <span>{player.nickname}</span>
          <Badge state={player.isReady ? 'ready' : 'queued'} label={player.isReady ? readyLabel : pendingLabel} />
        </div>
      ))}
    </div>
  )
}

function GameStatusMessage({ state, message }: { state: string; message: string }) {
  return (
    <div className={styles.statusOverlay} role="status" aria-live="polite" data-v2-state={state}>
      {message}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getAssetSizeText(asset: Asset) {
  return `${asset.category} · ${asset.widthCells ?? 1}x${asset.heightCells ?? 1}`
}

function getToolLabel(tool: string) {
  const labels: Record<string, string> = {
    select: '선택',
    place: '배치',
    move: '이동',
    erase: '삭제',
    start: '시작점',
    goal: '끝점',
  }

  return labels[tool] ?? tool
}

function toRankingPlayer(player: RoomPlayer, currentUserId: string): RaceRankingPlayer {
  return {
    id: player.id,
    nickname: player.nickname,
    progress: player.raceProgress,
    finishedAtMs: player.raceFinishedAtMs,
    validationCleared: player.validationCleared,
    isLocal: player.id === currentUserId,
    rank: player.raceRank,
  }
}

function compareResultRows(left: RaceRankingPlayer, right: RaceRankingPlayer) {
  if (left.rank !== undefined && right.rank !== undefined && left.rank !== right.rank) {
    return left.rank - right.rank
  }

  if (left.rank !== undefined && right.rank === undefined) {
    return -1
  }

  if (left.rank === undefined && right.rank !== undefined) {
    return 1
  }

  return compareRacePlayers(left, right)
}

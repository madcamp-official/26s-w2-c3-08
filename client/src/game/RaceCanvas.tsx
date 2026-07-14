import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'
import type { MapPoint, MergedMap, MergedMapPlacement, RacePositionSnapshot, RoomPlayer } from '../types/domain'
import {
  getAssetBehavior,
  getAssetColor,
  getItemEffect,
  getMonsterHealth,
  getMonsterMotionOffset,
  getMonsterStompReaction,
  getMonsterTrackingMode,
  getObstacleContactEffect,
  getObstacleHitSurface,
  getObstacleMotionOffset,
  getObstacleProjectileMode,
  getObstacleTriggerMode,
  getPlatformContactReaction,
  getPlatformCollisionMode,
  getPlatformMaterialization,
  getPlatformMotionOffset,
  getPlatformMovementMode,
  getPlatformSurfaceEffect,
  getSlopeDirection,
  isDynamicPlatform,
  isDynamicMonster,
  isDynamicObstacle,
  isObstacleActive,
  isPlatformMaterialized,
  isSlopeAsset,
  type CollisionBehavior,
  type ItemEffect,
  type MonsterStompReaction,
  type ObstacleHitSurface,
  type ObstacleContactEffect,
  type ObstacleProjectileMode,
  type PlatformCollisionMode,
  type PlatformContactReaction,
  type PlatformSurfaceEffect,
  type SlopeDirection,
} from './assetRules'
import { getLastDanceTopMarkers } from './raceLastDanceMarkers'
import {
  getDestroyedRaceSegmentIds,
  getRaceLineGroundSpans,
  getRaceLineSweepStep,
} from './raceLineSweep'

const WIDTH = 768
const HEIGHT = 420
const DEFAULT_WORLD_WIDTH = 2400
const FLOOR_Y = 328
const START_X = 72
const DEFAULT_GOAL_X = 2200
const MAP_CELL_X = 96
const MAP_CELL_Y = 28
const FREEZE_SECONDS = 15
const PLAYER = { width: 34, height: 70 }
const GIANT_SCALE = 1.22
const MOVE_SPEED = 300
const JUMP_SPEED = -540
const GRAVITY = 1550
const GROUND_POUND_SPEED = 780
const CROUCH_SPEED_FACTOR = 0.48
const CROUCH_HEIGHT = 60
const SLIDE_HEIGHT = 34
const SLIDE_SPEED = 360
const CONVEYOR_SPEED = 104
const SPEED_BOOST_MULTIPLIER = 1.28
const SLIPPERY_DECELERATION = 0.94
const BOUNCE_JUMP_SPEED = -620
const MONSTER_STOMP_JUMP_SPEED = -510
const MONSTER_TRAMPOLINE_SPEED = -700
const KNOCKBACK_SPEED = 410
const KNOCKBACK_UP_SPEED = -330
const UPDRAFT_SPEED = -480
const ITEM_SPEED_BOOST_MS = 5_000
const RECT_STEP_UP_PX = 4
const SLOPE_STEP_UP_PX = 18
const SLOPE_SNAP_DOWN_PX = 20
const PLATFORM_REACTION_DELAY_MS = 2_000
const PLATFORM_REACTION_RESPAWN_MS = 5_000
const PLATFORM_REACTION_TOTAL_MS = PLATFORM_REACTION_DELAY_MS + PLATFORM_REACTION_RESPAWN_MS
const PLATFORM_FALL_SPEED = 420
const MONSTER_STUN_MS = 3_000
const SWITCH_TOGGLE_COOLDOWN_MS = 650
const RACER_PUSH_SPEED = 170
const RACER_STOMP_BOUNCE_SPEED = -470
const RACER_STOMP_FEEDBACK_MS = 420
const RACER_INTERACTION_COOLDOWN_MS = 280

interface RaceCanvasProps {
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
}

interface PlayerState {
  x: number
  y: number
  vx: number
  vy: number
  isGrounded: boolean
  isCrouching: boolean
  isGroundPounding: boolean
  isSliding: boolean
  slideDirection: -1 | 0 | 1
  surfaceEffect: PlatformSurfaceEffect
  speedBoostUntilMs: number
  isGiant: boolean
}

interface RacerView {
  body: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  status: Phaser.GameObjects.Text
}

interface RemoteRacerRect {
  player: RoomPlayer
  x: number
  y: number
  width: number
  height: number
}

interface CollisionRect {
  x: number
  y: number
  width: number
  height: number
  behavior: Exclude<CollisionBehavior, 'decorative'>
  slopeDirection?: SlopeDirection
  surfaceEffect: PlatformSurfaceEffect
  platformKey: string | null
  platformCollisionMode: PlatformCollisionMode
  platformReaction: PlatformContactReaction
  platformMovementMode: ReturnType<typeof getPlatformMovementMode>
  itemKey: string | null
  itemEffect: ItemEffect
  monsterKey: string | null
  obstacleEffect: ObstacleContactEffect
  obstacleHitSurface: ObstacleHitSurface
  monsterHealth: number
  monsterStompReaction: MonsterStompReaction
}

interface PlatformReactionState {
  triggeredAtMs: number
  reaction: PlatformContactReaction
}

interface PlatformMovementState {
  triggeredAtMs: number
}

interface MonsterDefeatState {
  triggeredAtMs: number
  reaction: Extract<MonsterStompReaction, 'kill' | 'stun-normal'>
}

interface ProjectileRect {
  x: number
  y: number
  width: number
  height: number
  mode: ObstacleProjectileMode
  obstacleEffect: ObstacleContactEffect
}

interface RaceLineSweepGroundRect {
  segmentId: string
  x: number
  y: number
  width: number
  height: number
}

class RaceScene extends Phaser.Scene {
  private players: RoomPlayer[] = []
  private currentUserId: string | null = null
  private mergedMap: MergedMap | null = null
  private racePositions: Record<string, RacePositionSnapshot> = {}
  private mergedMapId = ''
  private isExtended = false
  private elapsedSeconds = 0
  private onProgress: (
    progressById: Record<string, number>,
    localPosition?: Omit<RacePositionSnapshot, 'userId'>,
  ) => void = () => {}
  private onFinish: () => void = () => {}
  private keyState = new Set<string>()
  private localState: PlayerState = {
    x: START_X,
    y: FLOOR_Y - PLAYER.height,
    vx: 0,
    vy: 0,
    isGrounded: true,
    isCrouching: false,
    isGroundPounding: false,
    isSliding: false,
    slideDirection: 0,
    surfaceEffect: 'none',
    speedBoostUntilMs: 0,
    isGiant: false,
  }
  private racerViews = new Map<string, RacerView>()
  private remoteProgress = new Map<string, number>()
  private lastProgressEmit = 0
  private hasFinished = false
  private statusText?: Phaser.GameObjects.Text
  private worldLayer?: Phaser.GameObjects.Graphics
  private overtimeLayer?: Phaser.GameObjects.Graphics
  private labelLayer?: Phaser.GameObjects.Container
  private overtimeLabels = new Map<string, Phaser.GameObjects.Text>()
  private lastAnimatedWorldRedrawAt = 0
  private sceneTimeMs = 0
  private platformReactionStates = new Map<string, PlatformReactionState>()
  private platformMovementStates = new Map<string, PlatformMovementState>()
  private materializedHiddenPlatformKeys = new Set<string>()
  private collectedItemKeys = new Set<string>()
  private switchToggleCooldowns = new Map<string, number>()
  private isSwitchOn = false
  private monsterHitCounts = new Map<string, number>()
  private monsterDefeatStates = new Map<string, MonsterDefeatState>()
  private racerStompFeedbackUntilMs = new Map<string, number>()
  private racerInteractionCooldowns = new Map<string, number>()
  private facingDirection: -1 | 1 = 1
  private lastRaceLineSweepStep = 0

  constructor() {
    super('race')
  }

  create() {
    this.cameras.main.setBackgroundColor('#bfdbfe')
    this.cameras.main.setBounds(0, 0, this.getWorldWidth(), HEIGHT)
    this.worldLayer = this.add.graphics()
    this.labelLayer = this.add.container(0, 0)
    this.overtimeLayer = this.add.graphics()
    this.drawWorld()
    this.statusText = this.add
      .text(16, 16, '', {
        color: '#111827',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.keyState.add(event.code)
      if (event.code === 'Space') {
        event.preventDefault()
      }
    })
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => this.keyState.delete(event.code))
  }

  update(time: number, delta: number) {
    const dt = delta / 1000

    this.sceneTimeMs = time
    this.elapsedSeconds += dt
    this.redrawRaceLineSweepWorldIfNeeded()
    this.ensureRacers()
    this.cleanupPlatformReactions(time)
    this.cleanupMonsterDefeats(time)
    this.redrawDynamicWorld(time)
    this.updateLocalPlayer(dt)
    this.updateRemotePlayers(dt)
    this.renderRacers()
    this.renderOvertimeMarkers()
    this.syncCamera()
    this.emitProgress(time)
    this.checkFinish()
  }

  syncState({
    players,
    currentUserId,
    mergedMap,
    racePositions,
    isExtended,
    elapsedSeconds,
    onProgress,
    onFinish,
  }: RaceCanvasProps) {
    this.players = players
    this.currentUserId = currentUserId
    this.racePositions = racePositions
    const nextMergedMapId = mergedMap?.id ?? ''
    const previousSweepStep = this.getRaceLineSweepStep()
    if (nextMergedMapId !== this.mergedMapId) {
      this.mergedMapId = nextMergedMapId
      this.mergedMap = mergedMap
      this.elapsedSeconds = elapsedSeconds
      this.sceneTimeMs = 0
      this.platformReactionStates.clear()
      this.platformMovementStates.clear()
      this.materializedHiddenPlatformKeys.clear()
      this.collectedItemKeys.clear()
      this.switchToggleCooldowns.clear()
      this.isSwitchOn = false
      this.monsterHitCounts.clear()
      this.monsterDefeatStates.clear()
      this.racerStompFeedbackUntilMs.clear()
      this.racerInteractionCooldowns.clear()
      this.resetLocalPlayer()
      this.lastRaceLineSweepStep = this.getRaceLineSweepStep()
      this.drawWorld()
    } else {
      this.mergedMap = mergedMap
      this.elapsedSeconds = Math.max(this.elapsedSeconds, elapsedSeconds)
      this.redrawRaceLineSweepWorldIfNeeded(previousSweepStep)
    }
    this.isExtended = isExtended
    this.onProgress = onProgress
    this.onFinish = onFinish

    players.forEach((player) => {
      if (player.id !== currentUserId) {
        this.remoteProgress.set(
          player.id,
          Math.max(this.remoteProgress.get(player.id) ?? 0, player.raceProgress),
        )
      }
    })
  }

  private drawWorld() {
    const graphics = this.worldLayer
    const worldWidth = this.getWorldWidth()

    if (!graphics || !this.labelLayer) {
      return
    }

    graphics.clear()
    this.labelLayer.removeAll(true)
    this.cameras.main.setBounds(0, 0, worldWidth, HEIGHT)
    graphics.fillStyle(0xbfdbfe, 1)
    graphics.fillRect(0, 0, worldWidth, HEIGHT)
    graphics.lineStyle(1, 0xffffff, 0.16)

    for (let x = 0; x <= worldWidth; x += 64) {
      graphics.lineBetween(x, 0, x, HEIGHT)
    }

    for (let y = 0; y <= HEIGHT; y += 64) {
      graphics.lineBetween(0, y, worldWidth, y)
    }

    graphics.fillStyle(0x8b5a2b, 1)
    graphics.fillRect(0, FLOOR_Y, worldWidth, HEIGHT - FLOOR_Y)
    graphics.fillStyle(0x43a047, 1)
    graphics.fillRect(0, FLOOR_Y, worldWidth, 12)

    this.drawMergedMap(graphics)
    this.drawRaceLineSweepGround(graphics)
    this.drawProjectiles(graphics)

    const goalX = this.getGoalX()
    for (let x = 420; x < goalX - 180; x += 360) {
      graphics.fillStyle(0xf6be00, 0.9)
      graphics.fillRect(x, FLOOR_Y - 78, 120, 12)
    }

    graphics.fillStyle(0xf6be00, 1)
    graphics.fillRect(START_X - 28, FLOOR_Y - 94, 16, 94)
    graphics.fillStyle(0x111827, 1)
    graphics.fillRect(START_X - 12, FLOOR_Y - 94, 72, 24)
    graphics.fillStyle(0xf6be00, 1)
    graphics.fillRect(goalX, FLOOR_Y - 110, 18, 110)
    graphics.fillStyle(0xe52521, 1)
    graphics.fillTriangle(goalX + 18, FLOOR_Y - 110, goalX + 94, FLOOR_Y - 84, goalX + 18, FLOOR_Y - 58)

    this.labelLayer.add(this.add.text(START_X - 6, FLOOR_Y - 88, 'START', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    }))
    this.labelLayer.add(this.add.text(goalX - 18, FLOOR_Y - 136, 'GOAL', {
      color: '#111827',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    }))
  }

  private drawMergedMap(graphics: Phaser.GameObjects.Graphics) {
    if (this.mergedMap === null) {
      return
    }

    this.getActiveMergedPlacements().forEach((placement) => {
      const platformKey = getMergedPlacementKey(placement)

      if (placement.assetCategory === 'item' && this.collectedItemKeys.has(platformKey)) {
        return
      }

      const monsterVisual = this.getMonsterVisualState(
        platformKey,
        getMonsterStompReaction(placement),
        getMonsterHealth(placement),
      )

      if (monsterVisual.isHidden) {
        return
      }

      const platformReaction = getPlatformContactReaction(placement)
      const platformVisual = this.getPlatformVisualState(platformKey, platformReaction)
      const platformState = this.getPlatformStateForPlacement(placement, platformKey, 32)

      if (platformVisual.isHidden) {
        return
      }

      const color = getAssetColor(placement)
      const width = Math.max(28, placement.widthCells * 32)
      const height = Math.max(22, placement.heightCells * 24)
      const monsterOffset = getMonsterMotionOffset(placement, this.elapsedSeconds, 32)
      const baseX = this.mapXToPixel(placement.x) + monsterOffset.x
      const baseY = this.mapYToPixel(placement.y, height) + monsterOffset.y
      const isObstacleTriggered = this.isObstacleTriggered(placement, baseX, baseY, width, height, 32)
      const obstacleOffset = isObstacleTriggered
        ? getObstacleMotionOffset(placement, this.elapsedSeconds, 32)
        : { x: 0, y: 0 }
      const trackingOffset = this.getMonsterTrackingOffset(
        placement,
        this.mapXToPixel(placement.x) + monsterOffset.x + obstacleOffset.x,
        this.mapYToPixel(placement.y, height) + monsterOffset.y + obstacleOffset.y,
        width,
        height,
        32,
      )
      const motionOffset = {
        x: monsterOffset.x + obstacleOffset.x + trackingOffset.x + platformState.motionOffset.x,
        y: monsterOffset.y + obstacleOffset.y + trackingOffset.y + platformState.motionOffset.y,
      }
      const x = this.mapXToPixel(placement.x) + motionOffset.x
      const y =
        this.mapYToPixel(placement.y, height) +
        motionOffset.y +
        platformVisual.offsetY +
        monsterVisual.offsetY
      const isInactiveObstacle = placement.assetCategory === 'obstacle' && !isObstacleTriggered
      const isInactivePlatform =
        placement.assetCategory === 'platform' && !platformState.isMaterialized
      const baseAlpha =
        getAssetBehavior(placement) === 'decorative'
          ? 0.36
          : placement.sourceSegmentId === 'connector'
            ? 0.72
            : 0.88

      if (y > HEIGHT) {
        return
      }

      graphics.fillStyle(
        color,
        baseAlpha *
          platformVisual.alpha *
          monsterVisual.alpha *
          (isInactiveObstacle || isInactivePlatform ? 0.28 : 1),
      )

      if (isSlopeAsset(placement)) {
        drawSlope(graphics, x, y, width, height, color, getSlopeDirection(placement))
        return
      }

      graphics.fillRect(x, y, width, height)
    })
  }

  private drawRaceLineSweepGround(graphics: Phaser.GameObjects.Graphics) {
    this.getRaceLineSweepGroundRects().forEach((rect) => {
      graphics.fillStyle(0x5f3a1a, 0.94)
      graphics.fillRect(rect.x, rect.y, rect.width, rect.height)
      graphics.fillStyle(0x43a047, 1)
      graphics.fillRect(rect.x, rect.y, rect.width, 8)
      graphics.lineStyle(2, 0x111827, 0.24)
      graphics.strokeRect(rect.x, rect.y, rect.width, rect.height)
    })
  }

  private getCollisionRects() {
    if (this.mergedMap === null) {
      return []
    }

    const placementRects = this.getActiveMergedPlacements()
      .map((placement) => this.createCollisionRect(placement))
      .filter((rect): rect is CollisionRect => rect !== null)

    return [
      ...placementRects,
      ...this.getRaceLineSweepGroundCollisionRects(),
      ...this.getProjectileCollisionRects(),
    ]
  }

  private createCollisionRect(placement: MergedMapPlacement): CollisionRect | null {
    const behavior = getAssetBehavior(placement)

    if (behavior === 'decorative') {
      return null
    }

    const platformKey = placement.assetCategory === 'platform' ? getMergedPlacementKey(placement) : null
    const platformReaction = getPlatformContactReaction(placement)
    const platformState = this.getPlatformStateForPlacement(placement, platformKey, 32)
    const itemKey = placement.assetCategory === 'item' ? getMergedPlacementKey(placement) : null
    const monsterKey = placement.assetCategory === 'monster' ? getMergedPlacementKey(placement) : null

    if (itemKey !== null && this.collectedItemKeys.has(itemKey)) {
      return null
    }

    if (monsterKey !== null && this.monsterDefeatStates.has(monsterKey)) {
      return null
    }

    if (!this.isPlatformCollisionActive(platformKey, platformReaction)) {
      return null
    }

    if (placement.assetCategory === 'platform' && !platformState.isMaterialized) {
      return null
    }

    const width = Math.max(28, placement.widthCells * 32)
    const height = Math.max(22, placement.heightCells * 24)
    const monsterOffset = getMonsterMotionOffset(placement, this.elapsedSeconds, 32)
    const baseX = this.mapXToPixel(placement.x) + monsterOffset.x
    const baseY = this.mapYToPixel(placement.y, height) + monsterOffset.y
    const isObstacleTriggered = this.isObstacleTriggered(placement, baseX, baseY, width, height, 32)

    if (placement.assetCategory === 'obstacle' && !isObstacleTriggered) {
      return null
    }

    const obstacleOffset = isObstacleTriggered
      ? getObstacleMotionOffset(placement, this.elapsedSeconds, 32)
      : { x: 0, y: 0 }
    const trackingOffset = this.getMonsterTrackingOffset(
      placement,
      this.mapXToPixel(placement.x) + monsterOffset.x + obstacleOffset.x,
      this.mapYToPixel(placement.y, height) + monsterOffset.y + obstacleOffset.y,
      width,
      height,
      32,
    )
    const motionOffset = {
      x: monsterOffset.x + obstacleOffset.x + trackingOffset.x + platformState.motionOffset.x,
      y: monsterOffset.y + obstacleOffset.y + trackingOffset.y + platformState.motionOffset.y,
    }

    return {
      x: this.mapXToPixel(placement.x) + motionOffset.x,
      y: this.mapYToPixel(placement.y, height) + motionOffset.y,
      width,
      height,
      behavior,
      slopeDirection: isSlopeAsset(placement) ? getSlopeDirection(placement) : undefined,
      surfaceEffect: getPlatformSurfaceEffect(placement),
      platformKey,
      platformCollisionMode: getPlatformCollisionMode(placement),
      platformReaction,
      platformMovementMode: getPlatformMovementMode(placement),
      itemKey,
      itemEffect: getItemEffect(placement),
      monsterKey,
      obstacleEffect: getObstacleContactEffect(placement),
      obstacleHitSurface: getObstacleHitSurface(placement),
      monsterHealth: getMonsterHealth(placement),
      monsterStompReaction: getMonsterStompReaction(placement),
    }
  }

  private getRaceLineSweepGroundCollisionRects(): CollisionRect[] {
    return this.getRaceLineSweepGroundRects().map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      behavior: 'solid',
      slopeDirection: undefined,
      surfaceEffect: 'none',
      platformKey: `sweep-ground:${rect.segmentId}`,
      platformCollisionMode: 'solid',
      platformReaction: 'none',
      platformMovementMode: 'fixed',
      itemKey: null,
      itemEffect: 'none',
      monsterKey: null,
      obstacleEffect: 'none',
      obstacleHitSurface: 'all',
      monsterHealth: 1,
      monsterStompReaction: 'harmful',
    }))
  }

  private getRaceLineSweepGroundRects(): RaceLineSweepGroundRect[] {
    if (this.mergedMap === null) {
      return []
    }

    return getRaceLineGroundSpans(this.mergedMap, this.elapsedSeconds).map((span) => {
      const startX = this.mapXToPixel(Math.min(span.start.x, span.end.x))
      const endX = this.mapXToPixel(Math.max(span.start.x, span.end.x)) + MAP_CELL_X
      const height = 24
      const groundCellY = Math.max(span.start.y, span.end.y)

      return {
        segmentId: span.segmentId,
        x: startX,
        y: this.mapYToPixel(groundCellY, height),
        width: Math.max(MAP_CELL_X, endX - startX),
        height,
      }
    })
  }

  private getActiveMergedPlacements() {
    if (this.mergedMap === null) {
      return []
    }

    const destroyedSegmentIds = getDestroyedRaceSegmentIds(this.mergedMap, this.elapsedSeconds)

    if (destroyedSegmentIds.size === 0) {
      return this.mergedMap.placements
    }

    return this.mergedMap.placements.filter(
      (placement) =>
        placement.sourceSegmentId === 'connector' ||
        !destroyedSegmentIds.has(placement.sourceSegmentId),
    )
  }

  private getRaceLineSweepStep() {
    return getRaceLineSweepStep(this.mergedMap, this.elapsedSeconds)
  }

  private redrawRaceLineSweepWorldIfNeeded(previousStep = this.lastRaceLineSweepStep) {
    const nextStep = this.getRaceLineSweepStep()

    if (nextStep === previousStep && nextStep === this.lastRaceLineSweepStep) {
      return
    }

    this.lastRaceLineSweepStep = nextStep
    this.drawWorld()
  }

  private redrawDynamicWorld(time: number) {
    if (!this.hasDynamicWorld() || time - this.lastAnimatedWorldRedrawAt < 90) {
      return
    }

    this.lastAnimatedWorldRedrawAt = time
    this.drawWorld()
  }

  private hasDynamicWorld() {
    return (
      this.hasMovingMonsters() ||
      this.hasDynamicPlatforms() ||
      this.hasDynamicObstacles() ||
      this.monsterDefeatStates.size > 0 ||
      this.platformReactionStates.size > 0
    )
  }

  private hasMovingMonsters() {
    return this.getActiveMergedPlacements().some((placement) => isDynamicMonster(placement))
  }

  private hasDynamicObstacles() {
    return this.getActiveMergedPlacements().some((placement) => isDynamicObstacle(placement))
  }

  private drawProjectiles(graphics: Phaser.GameObjects.Graphics) {
    this.getProjectileRects().forEach((rect) => {
      graphics.fillStyle(rect.mode === 'homing-normal' ? 0xe52521 : 0xf6be00, 0.92)
      graphics.fillRect(rect.x, rect.y, rect.width, rect.height)
      graphics.lineStyle(2, 0x111827, 0.22)
      graphics.strokeRect(rect.x, rect.y, rect.width, rect.height)
    })
  }

  private getProjectileCollisionRects(): CollisionRect[] {
    return this.getProjectileRects().map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      behavior: 'hazard',
      slopeDirection: undefined,
      surfaceEffect: 'none',
      platformKey: null,
      platformCollisionMode: 'solid',
      platformReaction: 'none',
      platformMovementMode: 'fixed',
      itemKey: null,
      itemEffect: 'none',
      monsterKey: null,
      obstacleEffect: rect.obstacleEffect,
      obstacleHitSurface: 'all',
      monsterHealth: 1,
      monsterStompReaction: 'harmful',
    }))
  }

  private getProjectileRects(): ProjectileRect[] {
    if (this.mergedMap === null) {
      return []
    }

    const playerCenterX = this.localState.x + this.getPlayerWidth() / 2
    const playerCenterY = this.localState.y + this.getPlayerHeight() / 2

    return this.getActiveMergedPlacements().flatMap((placement) => {
      const mode = getObstacleProjectileMode(placement)

      if (mode === 'none') {
        return []
      }

      const width = Math.max(28, placement.widthCells * 32)
      const height = Math.max(22, placement.heightCells * 24)
      const baseX = this.mapXToPixel(placement.x)
      const baseY = this.mapYToPixel(placement.y, height)
      const isTriggered = this.isObstacleTriggered(placement, baseX, baseY, width, height, 32)

      if (!isTriggered) {
        return []
      }

      const obstacleOffset = getObstacleMotionOffset(placement, this.elapsedSeconds, 32)
      const originX = baseX + obstacleOffset.x + width / 2
      const originY = baseY + obstacleOffset.y + height / 2
      const key = getMergedPlacementKey(placement)
      const cycleSeconds = 2.4
      const progress = ((this.elapsedSeconds + getStablePhase(key)) % cycleSeconds) / cycleSeconds
      const direction = playerCenterX < originX ? -1 : 1
      const size = 14
      const travel = 32 * 7
      const homingY =
        mode === 'homing-normal'
          ? Phaser.Math.Clamp(playerCenterY - originY, -32 * 3, 32 * 3) * progress * 0.72
          : 0

      return [
        {
          x: originX + direction * progress * travel - size / 2,
          y: originY + homingY - size / 2,
          width: size,
          height: size,
          mode,
          obstacleEffect: getObstacleContactEffect(placement),
        },
      ]
    })
  }

  private hasDynamicPlatforms() {
    return this.getActiveMergedPlacements().some((placement) => isDynamicPlatform(placement))
  }

  private getPlatformStateForPlacement(
    placement: MergedMapPlacement,
    key: string | null,
    cellPx: number,
  ) {
    const movementMode = getPlatformMovementMode(placement)
    const movementState = key === null ? undefined : this.platformMovementStates.get(key)
    const stepElapsedSeconds =
      movementState === undefined ? 0 : Math.max(0, (this.sceneTimeMs - movementState.triggeredAtMs) / 1000)
    const shouldUseStepElapsed = movementMode === 'start-on-step' || movementMode === 'step-one-way'
    const isHiddenMaterialized =
      key !== null &&
      getPlatformMaterialization(placement) === 'hidden-on-hit' &&
      this.materializedHiddenPlatformKeys.has(key)
    const materialization = getPlatformMaterialization(placement)
    const isSwitchMaterialized =
      materialization === 'switch-on'
        ? this.isSwitchOn
        : materialization === 'switch-off'
          ? !this.isSwitchOn
          : false

    return {
      isMaterialized:
        isPlatformMaterialized(placement, this.elapsedSeconds) ||
        isHiddenMaterialized ||
        isSwitchMaterialized,
      motionOffset: getPlatformMotionOffset(
        placement,
        shouldUseStepElapsed ? stepElapsedSeconds : this.elapsedSeconds,
        cellPx,
        movementState !== undefined,
      ),
    }
  }

  private isObstacleTriggered(
    placement: MergedMapPlacement,
    baseX: number,
    baseY: number,
    width: number,
    height: number,
    cellPx: number,
  ) {
    if (placement.assetCategory !== 'obstacle') {
      return true
    }

    if (!isObstacleActive(placement, this.elapsedSeconds)) {
      return false
    }

    const triggerMode = getObstacleTriggerMode(placement)

    if (triggerMode === 'always' || triggerMode === 'cycle-normal') {
      return true
    }

    const playerCenterX = this.localState.x + this.getPlayerWidth() / 2
    const playerCenterY = this.localState.y + this.getPlayerHeight() / 2
    const obstacleCenterX = baseX + width / 2
    const obstacleCenterY = baseY + height / 2
    const axisMargin = cellPx * 1.5

    if (triggerMode === 'proximity-x') {
      return playerCenterX >= baseX - axisMargin && playerCenterX <= baseX + width + axisMargin
    }

    if (triggerMode === 'proximity-y') {
      return playerCenterY >= baseY - axisMargin && playerCenterY <= baseY + height + axisMargin
    }

    return Math.hypot(playerCenterX - obstacleCenterX, playerCenterY - obstacleCenterY) <= cellPx * 5
  }

  private getMonsterTrackingOffset(
    placement: MergedMapPlacement,
    baseX: number,
    baseY: number,
    width: number,
    height: number,
    cellPx: number,
  ) {
    const trackingMode = getMonsterTrackingMode(placement)

    if (trackingMode === 'none') {
      return { x: 0, y: 0 }
    }

    const playerCenterX = this.localState.x + this.getPlayerWidth() / 2
    const playerCenterY = this.localState.y + this.getPlayerHeight() / 2
    const monsterCenterX = baseX + width / 2
    const monsterCenterY = baseY + height / 2
    const dx = playerCenterX - monsterCenterX
    const dy = playerCenterY - monsterCenterY
    const distance = Math.hypot(dx, dy)

    if (trackingMode === 'near' && distance > cellPx * 6) {
      return { x: 0, y: 0 }
    }

    if (trackingMode === 'gaze-freeze' && this.isPlayerLookingAt(monsterCenterX)) {
      return { x: 0, y: 0 }
    }

    if (trackingMode === 'jump-sync') {
      return { x: 0, y: this.localState.isGrounded ? 0 : -cellPx * 0.9 }
    }

    const strength =
      trackingMode === 'always' ? 1.4 : trackingMode === 'gaze-freeze' ? 1.05 : 0.9
    const verticalStrength = trackingMode === 'always' ? 0.85 : 0.5

    return {
      x: Phaser.Math.Clamp(dx * 0.22, -cellPx * strength, cellPx * strength),
      y: Phaser.Math.Clamp(dy * 0.14, -cellPx * verticalStrength, cellPx * verticalStrength),
    }
  }

  private isPlayerLookingAt(targetX: number) {
    const playerCenterX = this.localState.x + this.getPlayerWidth() / 2

    return (
      (targetX >= playerCenterX && this.facingDirection === 1) ||
      (targetX < playerCenterX && this.facingDirection === -1)
    )
  }

  private cleanupPlatformReactions(time: number) {
    let didRestorePlatform = false

    this.platformReactionStates.forEach((state, key) => {
      if (time - state.triggeredAtMs >= PLATFORM_REACTION_TOTAL_MS) {
        this.platformReactionStates.delete(key)
        didRestorePlatform = true
      }
    })

    if (didRestorePlatform) {
      this.drawWorld()
    }
  }

  private getPlatformVisualState(
    key: string | null,
    reaction: PlatformContactReaction,
  ): { isHidden: boolean; offsetY: number; alpha: number } {
    if (key === null || reaction === 'none') {
      return { isHidden: false, offsetY: 0, alpha: 1 }
    }

    const state = this.platformReactionStates.get(key)

    if (state === undefined) {
      return { isHidden: false, offsetY: 0, alpha: 1 }
    }

    const elapsedMs = this.sceneTimeMs - state.triggeredAtMs

    if (elapsedMs < PLATFORM_REACTION_DELAY_MS) {
      const isDimmedPulse = Math.floor(elapsedMs / 180) % 2 === 0

      return { isHidden: false, offsetY: 0, alpha: isDimmedPulse ? 0.55 : 1 }
    }

    if (state.reaction === 'break-after-touch') {
      return { isHidden: true, offsetY: 0, alpha: 0 }
    }

    const fallElapsedSeconds = (elapsedMs - PLATFORM_REACTION_DELAY_MS) / 1000
    const offsetY = fallElapsedSeconds * PLATFORM_FALL_SPEED

    return {
      isHidden: offsetY > HEIGHT,
      offsetY,
      alpha: Math.max(0, 1 - fallElapsedSeconds / 1.2),
    }
  }

  private isPlatformCollisionActive(
    key: string | null,
    reaction: PlatformContactReaction,
  ) {
    if (key === null || reaction === 'none') {
      return true
    }

    const state = this.platformReactionStates.get(key)

    if (state === undefined) {
      return true
    }

    return this.sceneTimeMs - state.triggeredAtMs < PLATFORM_REACTION_DELAY_MS
  }

  private triggerPlatformReaction(rect: CollisionRect) {
    if (rect.platformKey === null || rect.platformReaction === 'none') {
      return
    }

    if (this.platformReactionStates.has(rect.platformKey)) {
      return
    }

    this.platformReactionStates.set(rect.platformKey, {
      triggeredAtMs: this.sceneTimeMs,
      reaction: rect.platformReaction,
    })
    this.statusText?.setText(
      rect.platformReaction === 'fall-after-touch'
        ? '도넛 발판 · 2초 후 낙하'
        : '부서지는 발판 · 2초 후 소멸',
    )
    this.drawWorld()
  }

  private triggerPlatformMovement(rect: CollisionRect) {
    if (rect.platformKey === null || rect.platformMovementMode === 'fixed') {
      return
    }

    if (this.platformMovementStates.has(rect.platformKey)) {
      return
    }

    this.platformMovementStates.set(rect.platformKey, { triggeredAtMs: this.sceneTimeMs })
    this.drawWorld()
  }

  private cleanupMonsterDefeats(time: number) {
    let didReviveMonster = false

    this.monsterDefeatStates.forEach((state, key) => {
      if (state.reaction === 'stun-normal' && time - state.triggeredAtMs >= MONSTER_STUN_MS) {
        this.monsterDefeatStates.delete(key)
        didReviveMonster = true
      }
    })

    if (didReviveMonster) {
      this.drawWorld()
    }
  }

  private getMonsterVisualState(
    key: string,
    reaction: MonsterStompReaction,
    health: number,
  ): { isHidden: boolean; offsetY: number; alpha: number } {
    if (reaction === 'harmful' || reaction === 'trampoline') {
      return { isHidden: false, offsetY: 0, alpha: 1 }
    }

    const state = this.monsterDefeatStates.get(key)

    if (state === undefined) {
      const hitCount = this.monsterHitCounts.get(key) ?? 0

      if (hitCount === 0) {
        return { isHidden: false, offsetY: 0, alpha: 1 }
      }

      return {
        isHidden: false,
        offsetY: Math.min(6, hitCount * 2),
        alpha: Math.max(0.55, 1 - hitCount / Math.max(health, 1) * 0.36),
      }
    }

    if (state.reaction === 'kill') {
      return { isHidden: true, offsetY: 0, alpha: 0 }
    }

    return { isHidden: false, offsetY: 8, alpha: 0.3 }
  }

  private handleMonsterStomp(rect: CollisionRect) {
    if (rect.monsterKey === null) {
      return
    }

    if (rect.monsterStompReaction !== 'kill' && rect.monsterStompReaction !== 'stun-normal') {
      return
    }

    if (this.monsterDefeatStates.has(rect.monsterKey)) {
      return
    }

    const nextHitCount = (this.monsterHitCounts.get(rect.monsterKey) ?? 0) + 1

    if (nextHitCount < rect.monsterHealth) {
      this.monsterHitCounts.set(rect.monsterKey, nextHitCount)
      this.statusText?.setText(`몬스터 타격 · ${rect.monsterHealth - nextHitCount}회 남음`)
      this.drawWorld()
      return
    }

    this.monsterHitCounts.delete(rect.monsterKey)
    this.monsterDefeatStates.set(rect.monsterKey, {
      triggeredAtMs: this.sceneTimeMs,
      reaction: rect.monsterStompReaction,
    })
    this.drawWorld()
  }

  private collectItem(rect: CollisionRect) {
    if (rect.itemKey === null || rect.itemEffect === 'none') {
      return
    }

    if (rect.itemEffect === 'toggle-switch') {
      this.toggleSwitch(rect.itemKey)
      return
    }

    if (this.collectedItemKeys.has(rect.itemKey)) {
      return
    }

    this.collectedItemKeys.add(rect.itemKey)

    if (rect.itemEffect === 'speed-boost') {
      this.localState.speedBoostUntilMs = this.sceneTimeMs + ITEM_SPEED_BOOST_MS
      this.statusText?.setText('가속 아이템 · 5초 부스트')
    } else {
      this.growPlayer()
      this.statusText?.setText('거대버섯 · 생명 +1')
    }

    this.drawWorld()
  }

  private toggleSwitch(itemKey: string) {
    const cooldownUntilMs = this.switchToggleCooldowns.get(itemKey) ?? 0

    if (this.sceneTimeMs < cooldownUntilMs) {
      return
    }

    this.isSwitchOn = !this.isSwitchOn
    this.switchToggleCooldowns.set(itemKey, this.sceneTimeMs + SWITCH_TOGGLE_COOLDOWN_MS)
    this.statusText?.setText(this.isSwitchOn ? '스위치 ON' : '스위치 OFF')
    this.drawWorld()
  }

  private growPlayer() {
    if (this.localState.isGiant) {
      return
    }

    const previousHeight = this.getPlayerHeight()
    this.localState.isGiant = true
    this.localState.y -= this.getPlayerHeight() - previousHeight
  }

  private absorbDamage() {
    if (!this.localState.isGiant) {
      return false
    }

    const previousHeight = this.getPlayerHeight()
    this.localState.isGiant = false
    this.localState.y += previousHeight - this.getPlayerHeight()
    this.localState.vx = 0
    this.localState.vy = Math.min(this.localState.vy, KNOCKBACK_UP_SPEED)
    this.localState.isGrounded = false
    this.localState.isGroundPounding = false
    this.localState.isSliding = false
    this.localState.slideDirection = 0
    this.localState.surfaceEffect = 'none'
    this.statusText?.setText('거대버섯 보호 · 기본 크기로 복귀')

    return true
  }

  private ensureRacers() {
    this.players.forEach((player, index) => {
      if (this.racerViews.has(player.id)) {
        return
      }

      const color = player.id === this.currentUserId ? 0x2563eb : getRacerColor(index)
      const view: RacerView = {
        body: this.add.rectangle(this.getStartX(), FLOOR_Y - PLAYER.height, PLAYER.width, PLAYER.height, color, 1).setOrigin(0),
        name: this.add.text(this.getStartX(), FLOOR_Y - PLAYER.height - 22, player.nickname, {
          color: '#111827',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
        }),
        status: this.add.text(START_X, FLOOR_Y + 16 + index * 18, '', {
          color: '#111827',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
        }),
      }

      this.racerViews.set(player.id, view)
    })
  }

  private updateLocalPlayer(dt: number) {
    const localPlayer = this.getLocalPlayer()

    if (localPlayer === undefined) {
      return
    }

    const isFrozen = this.isPlayerFrozen(localPlayer)
    this.statusText?.setText(
      isFrozen
        ? `검증 실패 패널티 · ${Math.ceil(FREEZE_SECONDS - this.elapsedSeconds)}초 후 출발`
        : this.localState.isSliding
          ? '슬라이딩 · Space로 점프 캔슬'
        : this.isExtended
          ? '연장전 · 현재 위치가 순위에 반영됩니다'
          : 'A/D 또는 ←/→ 이동 · Space 점프 · S/↓ 내려찍기',
    )

    if (isFrozen) {
      this.localState.vx = 0
    } else {
      this.applyInput()
    }

    this.applyPhysics(dt)
  }

  private updateRemotePlayers(dt: number) {
    this.players.forEach((player, index) => {
      if (player.id === this.currentUserId) {
        return
      }

      if (this.racePositions[player.id] !== undefined) {
        return
      }

      const currentProgress = this.remoteProgress.get(player.id) ?? player.raceProgress
      const canMove = !this.isPlayerFrozen(player)
      const boost = this.isExtended ? 0.8 : 0
      const speed = canMove ? 2.7 + index * 0.28 + boost : 0
      this.remoteProgress.set(player.id, Math.min(100, currentProgress + speed * dt))
    })
  }

  private renderRacers() {
    this.players.forEach((player, index) => {
      const view = this.racerViews.get(player.id)

      if (view === undefined) {
        return
      }

      const progress =
        player.id === this.currentUserId
          ? this.getLocalProgress()
          : this.racePositions[player.id]?.progress ??
            this.remoteProgress.get(player.id) ??
            player.raceProgress
      const remotePosition = player.id === this.currentUserId ? undefined : this.racePositions[player.id]
      const x =
        player.id === this.currentUserId
          ? this.localState.x
          : remotePosition !== undefined
            ? remotePosition.x
          : START_X + (this.getGoalX() - START_X) * (progress / 100)
      const yOffset = player.id === this.currentUserId ? 0 : 8 + index * 10
      const racerHeight =
        player.id === this.currentUserId
          ? this.getLocalRacerHeight()
          : this.getRemoteRacerHeight(player.id, remotePosition)
      const racerWidth = player.id === this.currentUserId ? this.getPlayerWidth() : PLAYER.width
      const y =
        player.id === this.currentUserId
          ? this.localState.y + this.getPlayerHeight() - racerHeight
          : remotePosition !== undefined
            ? remotePosition.y + PLAYER.height - racerHeight
          : FLOOR_Y - racerHeight - yOffset

      view.body.setPosition(x, y).setSize(racerWidth, racerHeight)
      view.name.setPosition(x - 8, y - 22).setText(player.nickname)
      view.status
        .setPosition(Math.max(16, this.cameras.main.scrollX + 16), FLOOR_Y + 18 + index * 18)
        .setText(
          `${player.nickname}: ${Math.round(progress)}% · ${
            this.isRacerStompFeedbackActive(player.id)
              ? 'stomped'
              : this.isPlayerFrozen(player)
                ? 'freeze'
                : player.validationCleared
                  ? 'clear'
              : 'penalty'
          }`,
        )
    })
  }

  private renderOvertimeMarkers() {
    const graphics = this.overtimeLayer

    if (graphics === undefined) {
      return
    }

    graphics.clear()

    if (!this.isExtended) {
      this.overtimeLabels.forEach((label) => label.setVisible(false))
      return
    }

    const markers = getLastDanceTopMarkers(
      this.players.map((player, index) => ({
        playerId: player.id,
        nickname: player.nickname,
        progress: this.getProgressForPlayer(player),
        x: this.getPlayerWorldX(player),
        order: index,
      })),
    )

    markers.forEach((marker, index) => {
      const x = marker.x
      const label = this.getOvertimeLabel(marker.playerId)

      graphics.lineStyle(4, marker.color, 0.86)
      graphics.lineBetween(x, 42, x, FLOOR_Y + 56)
      graphics.fillStyle(marker.color, 0.96)
      graphics.fillCircle(x, 48, 6)
      graphics.fillStyle(0xffffff, 0.76)
      graphics.fillCircle(x, 48, 2)

      label
        .setVisible(true)
        .setText(`${marker.label} ${marker.nickname} ${Math.round(marker.progress)}%`)
        .setPosition(x + 8, 52 + index * 18)
        .setColor(marker.textColor)
    })

    this.overtimeLabels.forEach((label, playerId) => {
      if (!markers.some((marker) => marker.playerId === playerId)) {
        label.setVisible(false)
      }
    })
  }

  private getOvertimeLabel(playerId: string) {
    const existingLabel = this.overtimeLabels.get(playerId)

    if (existingLabel !== undefined) {
      return existingLabel
    }

    const label = this.add.text(0, 0, '', {
      backgroundColor: 'rgba(255,255,255,0.82)',
      color: '#111827',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      padding: { x: 5, y: 3 },
    })

    this.overtimeLabels.set(playerId, label)
    return label
  }

  private getPlayerWorldX(player: RoomPlayer) {
    if (player.id === this.currentUserId) {
      return this.localState.x
    }

    if (this.racePositions[player.id] !== undefined) {
      return this.racePositions[player.id].x
    }

    return START_X + (this.getGoalX() - START_X) * (this.getProgressForPlayer(player) / 100)
  }

  private getProgressForPlayer(player: RoomPlayer) {
    if (player.id === this.currentUserId) {
      return this.getLocalProgress()
    }

    if (this.racePositions[player.id] !== undefined) {
      return this.racePositions[player.id].progress
    }

    return this.remoteProgress.get(player.id) ?? player.raceProgress
  }

  private syncCamera() {
    const targetX = Phaser.Math.Clamp(this.localState.x - 240, 0, this.getWorldWidth() - WIDTH)
    this.cameras.main.scrollX += (targetX - this.cameras.main.scrollX) * 0.12
  }

  private applyInput() {
    const left = this.keyState.has('KeyA') || this.keyState.has('ArrowLeft')
    const right = this.keyState.has('KeyD') || this.keyState.has('ArrowRight')
    const down = this.keyState.has('KeyS') || this.keyState.has('ArrowDown')
    const jump = this.keyState.has('Space')

    if (this.localState.isSliding) {
      this.localState.isCrouching = false
      this.localState.vx = (this.localState.slideDirection || 1) * SLIDE_SPEED

      if (jump && this.localState.isGrounded) {
        this.localState.vy = JUMP_SPEED
        this.localState.isGrounded = false
        this.localState.isGroundPounding = false
        this.localState.isSliding = false
        this.localState.slideDirection = 0
        this.localState.surfaceEffect = 'none'
      }

      return
    }

    const surfaceEffect = this.localState.isGrounded ? this.localState.surfaceEffect : 'none'
    const hasItemSpeedBoost = this.sceneTimeMs < this.localState.speedBoostUntilMs
    const moveSpeed =
      surfaceEffect === 'speed-boost' || hasItemSpeedBoost
        ? MOVE_SPEED * SPEED_BOOST_MULTIPLIER
        : MOVE_SPEED

    if (left === right) {
      this.localState.vx =
        surfaceEffect === 'slippery' && Math.abs(this.localState.vx) > 2
          ? this.localState.vx * SLIPPERY_DECELERATION
          : 0
    } else {
      this.facingDirection = left ? -1 : 1
      this.localState.vx = left ? -moveSpeed : moveSpeed
    }

    this.localState.isCrouching = down && this.localState.isGrounded

    if (this.localState.isCrouching) {
      this.localState.vx *= CROUCH_SPEED_FACTOR
    }

    if (surfaceEffect === 'conveyor-normal') {
      this.localState.vx += CONVEYOR_SPEED
    }

    if (jump && this.localState.isGrounded) {
      this.localState.vy = JUMP_SPEED
      this.localState.isGrounded = false
      this.localState.isCrouching = false
      this.localState.isGroundPounding = false
      this.localState.surfaceEffect = 'none'
    }

    if (down && !this.localState.isGrounded) {
      this.localState.vx = 0
      this.localState.vy = GROUND_POUND_SPEED
      this.localState.isCrouching = false
      this.localState.isGroundPounding = true
      this.localState.isSliding = false
      this.localState.slideDirection = 0
      this.localState.surfaceEffect = 'none'
    }
  }

  private applyPhysics(dt: number) {
    const previousX = this.localState.x
    const previousY = this.localState.y
    const playerHeight = this.getPlayerHeight()

    this.localState.vy += GRAVITY * dt
    this.localState.x += this.localState.vx * dt
    this.localState.x = Phaser.Math.Clamp(this.localState.x, this.getStartX(), this.getGoalX())
    this.resolveSolidWallCollisions(previousX)
    this.localState.y += this.localState.vy * dt
    if (!this.resolveHiddenPlatformBump(previousY)) {
      this.resolveSolidCeilingCollisions(previousY)
    }

    if (this.isTouchingHazard(previousY)) {
      if (this.absorbDamage()) {
        return
      }

      this.respawnLocalPlayer()
      return
    }

    this.applyObstacleEffects()
    this.applyItemEffects()
    this.resolveRacerInteractions(previousX, previousY)

    if (this.resolveSolidLanding(previousY)) {
      return
    }

    if (this.localState.y >= FLOOR_Y - playerHeight) {
      this.localState.y = FLOOR_Y - playerHeight
      this.localState.vy = 0
      this.localState.isGrounded = true
      this.localState.isSliding = false
      this.localState.slideDirection = 0
      this.localState.isGroundPounding = false
      this.localState.surfaceEffect = 'none'
    } else {
      this.localState.isGrounded = false
      this.localState.isSliding = false
      this.localState.slideDirection = 0
      this.localState.surfaceEffect = 'none'
    }
  }

  private resolveSolidWallCollisions(previousX: number) {
    if (this.localState.vx === 0) {
      return
    }

    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerTop = this.localState.y
    const previousLeft = previousX
    const previousRight = previousX + playerWidth
    const nextLeft = this.localState.x
    const nextRight = this.localState.x + playerWidth
    const movingRight = this.localState.vx > 0
    const wallCandidate = this.getCollisionRects()
      .filter(isFullSolidRect)
      .filter((rect) => rect.slopeDirection === undefined)
      .filter((rect) => hasVerticalOverlap(playerTop, playerHeight, rect.y, rect.height))
      .filter((rect) =>
        movingRight
          ? previousRight <= rect.x && nextRight > rect.x
          : previousLeft >= rect.x + rect.width && nextLeft < rect.x + rect.width,
      )
      .sort((left, right) =>
        movingRight ? left.x - right.x : right.x + right.width - (left.x + left.width),
      )[0]

    if (wallCandidate === undefined) {
      return
    }

    this.localState.x = movingRight
      ? wallCandidate.x - playerWidth
      : wallCandidate.x + wallCandidate.width
    this.localState.vx = 0
    this.localState.isSliding = false
    this.localState.slideDirection = 0
  }

  private resolveSolidCeilingCollisions(previousY: number) {
    if (this.localState.vy >= 0) {
      return
    }

    const playerWidth = this.getPlayerWidth()
    const previousTop = previousY
    const nextTop = this.localState.y
    const ceilingCandidate = this.getCollisionRects()
      .filter(isFullSolidRect)
      .filter((rect) => rect.slopeDirection === undefined)
      .filter((rect) => hasHorizontalOverlap(this.localState.x, playerWidth, rect.x, rect.width))
      .filter((rect) => previousTop >= rect.y + rect.height && nextTop < rect.y + rect.height)
      .sort((left, right) => right.y + right.height - (left.y + left.height))[0]

    if (ceilingCandidate === undefined) {
      return
    }

    this.localState.y = ceilingCandidate.y + ceilingCandidate.height
    this.localState.vy = 0
    this.localState.isGroundPounding = false
  }

  private resolveHiddenPlatformBump(previousY: number) {
    if (this.localState.vy >= 0 || this.mergedMap === null) {
      return false
    }

    const playerWidth = this.getPlayerWidth()
    const previousTop = previousY
    const nextTop = this.localState.y
    const bumpedPlatform = this.getActiveMergedPlacements()
      .map((placement) => {
        const key = getMergedPlacementKey(placement)

        return { key, placement }
      })
      .filter(
        ({ key, placement }) =>
          placement.assetCategory === 'platform' &&
          getPlatformMaterialization(placement) === 'hidden-on-hit' &&
          !this.materializedHiddenPlatformKeys.has(key),
      )
      .map(({ key, placement }) => {
        const width = Math.max(28, placement.widthCells * 32)
        const height = Math.max(22, placement.heightCells * 24)

        return {
          key,
          x: this.mapXToPixel(placement.x),
          y: this.mapYToPixel(placement.y, height),
          width,
          height,
        }
      })
      .filter((rect) => hasHorizontalOverlap(this.localState.x, playerWidth, rect.x, rect.width))
      .filter((rect) => previousTop >= rect.y + rect.height && nextTop < rect.y + rect.height)
      .sort((left, right) => right.y + right.height - (left.y + left.height))[0]

    if (bumpedPlatform === undefined) {
      return false
    }

    this.materializedHiddenPlatformKeys.add(bumpedPlatform.key)
    this.localState.y = bumpedPlatform.y + bumpedPlatform.height
    this.localState.vy = 0
    this.localState.isGroundPounding = false
    this.statusText?.setText('숨겨진 블록 발견')
    this.drawWorld()

    return true
  }

  private resolveSolidLanding(previousY: number) {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()

    if (this.localState.vy < 0) {
      this.localState.isGrounded = false
      this.localState.surfaceEffect = 'none'
      return false
    }

    const previousBottom = previousY + playerHeight
    const nextBottom = this.localState.y + playerHeight
    const wasGroundPounding = this.localState.isGroundPounding
    const wasSliding = this.localState.isSliding
    const landingCandidate = this.getCollisionRects()
      .filter(
        (rect) =>
          isLandableSolidRect(rect) ||
          (rect.behavior === 'hazard' &&
            (rect.obstacleHitSurface === 'top-safe' || isStompableMonster(rect))),
      )
      .map((rect) => ({ rect, surfaceY: getSurfaceY(rect, this.localState.x + playerWidth / 2) }))
      .filter(({ rect, surfaceY }) => {
        const isSlope = rect.slopeDirection !== undefined
        const stepUpPx = isSlope ? SLOPE_STEP_UP_PX : RECT_STEP_UP_PX
        const crossedSurface = previousBottom <= surfaceY + stepUpPx && nextBottom >= surfaceY
        const snappedToSlope =
          isSlope &&
          this.localState.isGrounded &&
          previousBottom <= surfaceY + stepUpPx &&
          nextBottom + SLOPE_SNAP_DOWN_PX >= surfaceY

        return (
          (crossedSurface || snappedToSlope) &&
          hasHorizontalOverlap(this.localState.x, playerWidth, rect.x, rect.width)
        )
      })
      .sort((left, right) => left.surfaceY - right.surfaceY)[0]

    if (landingCandidate === undefined) {
      this.localState.isGrounded = false
      this.localState.surfaceEffect = 'none'
      return false
    }

    this.localState.y = landingCandidate.surfaceY - playerHeight
    this.localState.vy = 0
    this.localState.isGrounded = true
    this.localState.isGroundPounding = false
    this.localState.surfaceEffect = landingCandidate.rect.surfaceEffect
    this.triggerPlatformReaction(landingCandidate.rect)
    this.triggerPlatformMovement(landingCandidate.rect)

    if (isStompableMonster(landingCandidate.rect)) {
      this.handleMonsterStomp(landingCandidate.rect)
      this.localState.vy =
        landingCandidate.rect.monsterStompReaction === 'trampoline'
          ? MONSTER_TRAMPOLINE_SPEED
          : MONSTER_STOMP_JUMP_SPEED
      this.localState.isGrounded = false
      this.localState.isSliding = false
      this.localState.slideDirection = 0
      this.localState.surfaceEffect = 'none'
      this.statusText?.setText(
        landingCandidate.rect.monsterStompReaction === 'trampoline'
          ? '트램펄린 몬스터 · 높게 튀어오름'
          : landingCandidate.rect.monsterStompReaction === 'stun-normal'
            ? '몬스터 기절 · 잠시 후 부활'
          : '몬스터 밟기 · 튕겨오름',
      )
      return true
    }

    if (landingCandidate.rect.surfaceEffect === 'bounce-high') {
      this.localState.vy = BOUNCE_JUMP_SPEED
      this.localState.isGrounded = false
      this.localState.isSliding = false
      this.localState.slideDirection = 0
      this.localState.surfaceEffect = 'none'
      this.statusText?.setText('탄성 플랫폼 · 자동 점프')
      return true
    }

    this.localState.isSliding =
      landingCandidate.rect.slopeDirection !== undefined && (wasGroundPounding || wasSliding)
    this.localState.slideDirection = this.localState.isSliding
      ? getDownhillDirection(landingCandidate.rect.slopeDirection)
      : 0

    if (this.localState.isSliding) {
      this.localState.vx = this.localState.slideDirection * SLIDE_SPEED
    }

    return true
  }

  private isTouchingHazard(previousY: number) {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.localState.x,
      y: this.localState.y,
      width: playerWidth,
      height: playerHeight,
    }
    const previousBottom = previousY + playerHeight
    const nextBottom = this.localState.y + playerHeight

    return this.getCollisionRects()
      .filter((rect) => rect.behavior === 'hazard')
      .some((rect) => {
        if (!doRectsOverlap(playerRect, rect)) {
          return false
        }

        if (rect.obstacleHitSurface === 'top-safe') {
          return !(
            this.localState.vy >= 0 &&
            previousBottom <= rect.y + RECT_STEP_UP_PX &&
            nextBottom >= rect.y &&
            hasHorizontalOverlap(this.localState.x, playerWidth, rect.x, rect.width)
          )
        }

        if (isStompableMonster(rect)) {
          return !(
            this.localState.vy >= 0 &&
            previousBottom <= rect.y + RECT_STEP_UP_PX &&
            nextBottom >= rect.y &&
            hasHorizontalOverlap(this.localState.x, playerWidth, rect.x, rect.width)
          )
        }

        if (rect.obstacleHitSurface === 'bottom-only') {
          return (
            this.localState.vy < 0 &&
            previousY >= rect.y + rect.height - RECT_STEP_UP_PX &&
            this.localState.y <= rect.y + rect.height &&
            hasHorizontalOverlap(this.localState.x, playerWidth, rect.x, rect.width)
          )
        }

        return true
      })
  }

  private applyObstacleEffects() {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.localState.x,
      y: this.localState.y,
      width: playerWidth,
      height: playerHeight,
    }
    const effectRect = this.getCollisionRects()
      .filter((rect) => rect.behavior === 'effect' && rect.itemEffect === 'none')
      .find((rect) => doRectsOverlap(playerRect, rect))

    if (effectRect === undefined) {
      return
    }

    this.localState.isGrounded = false
    this.localState.isGroundPounding = false
    this.localState.isSliding = false
    this.localState.slideDirection = 0
    this.localState.surfaceEffect = 'none'

    if (effectRect.obstacleEffect === 'updraft') {
      this.localState.vy = Math.min(this.localState.vy, UPDRAFT_SPEED)
      this.statusText?.setText('상승 기류 · 위로 밀려납니다')
      return
    }

    if (effectRect.obstacleEffect === 'knockback-high') {
      const playerCenterX = this.localState.x + playerWidth / 2
      const effectCenterX = effectRect.x + effectRect.width / 2
      const direction = playerCenterX < effectCenterX ? -1 : 1

      this.localState.vx = direction * KNOCKBACK_SPEED
      this.localState.vy = Math.min(this.localState.vy, KNOCKBACK_UP_SPEED)
      this.statusText?.setText('튕겨냄 · 밀려났습니다')
    }
  }

  private applyItemEffects() {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.localState.x,
      y: this.localState.y,
      width: playerWidth,
      height: playerHeight,
    }
    const itemRect = this.getCollisionRects()
      .filter((rect) => rect.itemEffect !== 'none')
      .find((rect) => doRectsOverlap(playerRect, rect))

    if (itemRect === undefined) {
      return
    }

    this.collectItem(itemRect)
  }

  private resolveRacerInteractions(previousX: number, previousY: number) {
    if (this.currentUserId === null) {
      return
    }

    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.localState.x,
      y: this.localState.y,
      width: playerWidth,
      height: playerHeight,
    }
    const previousBottom = previousY + playerHeight
    const nextBottom = this.localState.y + playerHeight
    const stompTarget = this.getRemoteRacerRects().find((rect) => {
      const narrowedX = rect.x + 5
      const narrowedWidth = Math.max(8, rect.width - 10)

      return (
        this.localState.vy >= 0 &&
        previousBottom <= rect.y + RECT_STEP_UP_PX &&
        nextBottom >= rect.y &&
        hasHorizontalOverlap(this.localState.x, playerWidth, narrowedX, narrowedWidth) &&
        this.canTriggerRacerInteraction(rect.player.id)
      )
    })

    if (stompTarget !== undefined) {
      this.racerInteractionCooldowns.set(stompTarget.player.id, this.sceneTimeMs)
      this.racerStompFeedbackUntilMs.set(
        stompTarget.player.id,
        this.sceneTimeMs + RACER_STOMP_FEEDBACK_MS,
      )
      this.localState.y = stompTarget.y - playerHeight - 1
      this.localState.vy = RACER_STOMP_BOUNCE_SPEED
      this.localState.isGrounded = false
      this.localState.isCrouching = false
      this.localState.isGroundPounding = false
      this.localState.isSliding = false
      this.localState.slideDirection = 0
      this.localState.surfaceEffect = 'none'
      this.statusText?.setText(`${stompTarget.player.nickname} 밟기 · 튕겨오름`)
      return
    }

    const pushTarget = this.getRemoteRacerRects().find((rect) => doRectsOverlap(playerRect, rect))

    if (pushTarget === undefined || this.localState.isGroundPounding) {
      return
    }

    const previousCenterX = previousX + playerWidth / 2
    const targetCenterX = pushTarget.x + pushTarget.width / 2
    const direction = previousCenterX <= targetCenterX ? -1 : 1
    const overlapFromLeft = this.localState.x + playerWidth - pushTarget.x
    const overlapFromRight = pushTarget.x + pushTarget.width - this.localState.x
    const separation = Math.max(0, Math.min(overlapFromLeft, overlapFromRight))

    this.localState.x = Phaser.Math.Clamp(
      this.localState.x + direction * Math.min(separation + 2, 14),
      this.getStartX(),
      this.getGoalX(),
    )
    this.localState.vx = direction * Math.max(Math.abs(this.localState.vx), RACER_PUSH_SPEED)
    this.statusText?.setText(`${pushTarget.player.nickname}와 충돌 · 밀림`)
  }

  private getRemoteRacerRects(): RemoteRacerRect[] {
    return this.players.flatMap((player, index) => {
      if (player.id === this.currentUserId) {
        return []
      }

      const position = this.racePositions[player.id]
      const progress =
        position?.progress ?? this.remoteProgress.get(player.id) ?? player.raceProgress
      const height = this.getRemoteRacerHeight(player.id, position)
      const x =
        position !== undefined
          ? position.x
          : START_X + (this.getGoalX() - START_X) * (progress / 100)
      const y =
        position !== undefined
          ? position.y + PLAYER.height - height
          : FLOOR_Y - height - (8 + index * 10)

      return [
        {
          player,
          x,
          y,
          width: PLAYER.width,
          height,
        },
      ]
    })
  }

  private canTriggerRacerInteraction(playerId: string) {
    const lastTriggeredAt = this.racerInteractionCooldowns.get(playerId) ?? -Infinity

    return this.sceneTimeMs - lastTriggeredAt >= RACER_INTERACTION_COOLDOWN_MS
  }

  private respawnLocalPlayer() {
    const spawnPoint = this.getRespawnPoint()

    this.localState = {
      x: spawnPoint.x,
      y: spawnPoint.y,
      vx: 0,
      vy: 0,
      isGrounded: true,
      isCrouching: false,
      isGroundPounding: false,
      isSliding: false,
      slideDirection: 0,
      surfaceEffect: 'none',
      speedBoostUntilMs: 0,
      isGiant: false,
    }
    this.statusText?.setText('체크포인트 복귀')
  }

  private emitProgress(time: number) {
    if (time - this.lastProgressEmit < 250) {
      return
    }

    this.lastProgressEmit = time
    const progressById: Record<string, number> = {}
    const localProgress = this.getLocalProgress()
    const localPosition =
      this.currentUserId === null
        ? undefined
        : {
            x: this.localState.x,
            y: this.localState.y,
            vx: this.localState.vx,
            vy: this.localState.vy,
            state: this.getLocalRaceState(),
            progress: localProgress,
            clientTime: time,
          }

    this.players.forEach((player) => {
      progressById[player.id] =
        player.id === this.currentUserId
          ? localProgress
          : (this.racePositions[player.id]?.progress ??
            this.remoteProgress.get(player.id) ??
            player.raceProgress)
    })

    this.onProgress(progressById, localPosition)
  }

  private checkFinish() {
    if (this.hasFinished || this.getLocalProgress() < 100) {
      return
    }

    this.hasFinished = true
    this.emitProgress(Number.MAX_SAFE_INTEGER)
    this.onFinish()
  }

  private getLocalPlayer() {
    return this.players.find((player) => player.id === this.currentUserId)
  }

  private isPlayerFrozen(player: RoomPlayer) {
    return !player.validationCleared && this.elapsedSeconds < FREEZE_SECONDS
  }

  private getLocalProgress() {
    return Math.min(100, Math.max(0, ((this.localState.x - this.getStartX()) / (this.getGoalX() - this.getStartX())) * 100))
  }

  private resetLocalPlayer() {
    const spawnPoint = this.getInitialSpawnPoint()

    this.localState = {
      x: spawnPoint.x,
      y: spawnPoint.y,
      vx: 0,
      vy: 0,
      isGrounded: true,
      isCrouching: false,
      isGroundPounding: false,
      isSliding: false,
      slideDirection: 0,
      surfaceEffect: 'none',
      speedBoostUntilMs: 0,
      isGiant: false,
    }
    this.remoteProgress.clear()
    this.racerStompFeedbackUntilMs.clear()
    this.racerInteractionCooldowns.clear()
    this.hasFinished = false
  }

  private getInitialSpawnPoint() {
    return this.getSpawnPointForMapPoint(this.mergedMap?.globalStart ?? null)
  }

  private getRespawnPoint() {
    const checkpoints = this.getSegmentCheckpoints()

    if (checkpoints.length === 0) {
      return this.getInitialSpawnPoint()
    }

    const localCenterX = this.localState.x + this.getPlayerWidth() / 2
    const checkpoint =
      [...checkpoints]
        .reverse()
        .find((candidate) => this.mapXToPixel(candidate.x) <= localCenterX) ?? checkpoints[0]

    return this.getSpawnPointForMapPoint(checkpoint)
  }

  private getSegmentCheckpoints(): MapPoint[] {
    if (this.mergedMap === null || this.mergedMap.segments.length === 0) {
      return []
    }

    const checkpoints: MapPoint[] = []
    let currentGlobalEnd: MapPoint | null = null

    this.mergedMap.segments.forEach((segment, segmentIndex) => {
      const connectorCells = segmentIndex === 0 ? 0 : 3
      const offsetX =
        currentGlobalEnd === null
          ? this.mergedMap!.globalStart.x - segment.startPoint.x
          : currentGlobalEnd.x + connectorCells - segment.startPoint.x
      const offsetY =
        currentGlobalEnd === null
          ? this.mergedMap!.globalStart.y - segment.startPoint.y
          : currentGlobalEnd.y - segment.startPoint.y
      const segmentStart = {
        x: segment.startPoint.x + offsetX,
        y: segment.startPoint.y + offsetY,
      }

      checkpoints.push(segmentStart)
      currentGlobalEnd = {
        x: segment.endPoint.x + offsetX,
        y: segment.endPoint.y + offsetY,
      }
    })

    return checkpoints
  }

  private getSpawnPointForMapPoint(point: MapPoint | null) {
    if (point === null) {
      return { x: this.getStartX(), y: FLOOR_Y - PLAYER.height }
    }

    return {
      x: Phaser.Math.Clamp(this.mapXToPixel(point.x), this.getStartX(), this.getGoalX() - PLAYER.width),
      y: Phaser.Math.Clamp(this.mapYToPixel(point.y + 1, PLAYER.height), 64, FLOOR_Y - PLAYER.height),
    }
  }

  private getPlayerWidth() {
    return this.localState.isGiant ? PLAYER.width * GIANT_SCALE : PLAYER.width
  }

  private getPlayerHeight() {
    return this.localState.isGiant ? PLAYER.height * GIANT_SCALE : PLAYER.height
  }

  private getLocalRacerHeight() {
    const scale = this.localState.isGiant ? GIANT_SCALE : 1

    if (this.localState.isGroundPounding) {
      return 30 * scale
    }

    if (this.localState.isSliding) {
      return SLIDE_HEIGHT * scale
    }

    if (this.localState.isCrouching) {
      return CROUCH_HEIGHT * scale
    }

    return this.getPlayerHeight()
  }

  private getRemoteRacerHeight(playerId: string, position?: RacePositionSnapshot) {
    if (this.isRacerStompFeedbackActive(playerId)) {
      return Math.max(32, PLAYER.height * 0.64)
    }

    if (position?.state === 'ground-pound') {
      return 30
    }

    if (position?.state === 'sliding') {
      return SLIDE_HEIGHT
    }

    if (position?.state === 'crouching') {
      return CROUCH_HEIGHT
    }

    return PLAYER.height
  }

  private isRacerStompFeedbackActive(playerId: string) {
    return (this.racerStompFeedbackUntilMs.get(playerId) ?? 0) > this.sceneTimeMs
  }

  private getLocalRaceState() {
    if (this.hasFinished) {
      return 'finished'
    }

    if (this.localState.isGroundPounding) {
      return 'ground-pound'
    }

    if (this.localState.isSliding) {
      return 'sliding'
    }

    if (this.localState.isCrouching) {
      return 'crouching'
    }

    if (!this.localState.isGrounded) {
      return 'airborne'
    }

    return Math.abs(this.localState.vx) > 1 ? 'running' : 'idle'
  }

  private getStartX() {
    return START_X
  }

  private getGoalX() {
    if (this.mergedMap === null) {
      return DEFAULT_GOAL_X
    }

    const rawGoalX = this.mapXToPixel(this.mergedMap.globalEnd.x)
    return Phaser.Math.Clamp(rawGoalX, START_X + 720, 5200)
  }

  private getWorldWidth() {
    return Math.max(DEFAULT_WORLD_WIDTH, this.getGoalX() + 320)
  }

  private mapXToPixel(cellX: number) {
    const startCellX = this.mergedMap?.globalStart.x ?? 0
    return START_X + (cellX - startCellX) * MAP_CELL_X
  }

  private mapYToPixel(cellY: number, heightPx: number) {
    const baseCellY = (this.mergedMap?.globalStart.y ?? 8) + 1
    return Phaser.Math.Clamp(FLOOR_Y - (baseCellY - cellY) * MAP_CELL_Y - heightPx, 64, FLOOR_Y - heightPx)
  }
}

function RaceCanvas({
  players,
  currentUserId,
  mergedMap,
  racePositions,
  isExtended,
  elapsedSeconds,
  onProgress,
  onFinish,
}: RaceCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RaceScene | null>(null)
  const onProgressRef = useRef(onProgress)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    if (hostRef.current === null) {
      return undefined
    }

    const scene = new RaceScene()
    sceneRef.current = scene

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#bfdbfe',
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
    sceneRef.current?.syncState({
      players,
      currentUserId,
      mergedMap,
      racePositions,
      isExtended,
      elapsedSeconds,
      onProgress: (progressById, localPosition) =>
        onProgressRef.current(progressById, localPosition),
      onFinish: () => onFinishRef.current(),
    })
  }, [currentUserId, elapsedSeconds, isExtended, mergedMap, players, racePositions])

  return <div className="race-phaser-host" ref={hostRef} />
}

function getRacerColor(index: number) {
  const colors = [0xe52521, 0x43a047, 0xf97316, 0x8b5a2b]

  return colors[index % colors.length]
}

function isStompableMonster(rect: CollisionRect) {
  return rect.monsterStompReaction !== 'harmful'
}

function isFullSolidRect(rect: CollisionRect) {
  return rect.behavior === 'solid' && rect.platformCollisionMode === 'solid'
}

function isLandableSolidRect(rect: CollisionRect) {
  return (
    rect.behavior === 'solid' &&
    (rect.platformCollisionMode === 'solid' ||
      rect.platformCollisionMode === 'one-way-up' ||
      rect.platformCollisionMode === 'one-way-directed')
  )
}

function getStablePhase(key: string) {
  let hash = 0

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 997
  }

  return (hash / 997) * 2.4
}

function hasHorizontalOverlap(leftX: number, leftWidth: number, rightX: number, rightWidth: number) {
  return leftX < rightX + rightWidth && leftX + leftWidth > rightX
}

function hasVerticalOverlap(topY: number, height: number, bottomY: number, bottomHeight: number) {
  return topY < bottomY + bottomHeight && topY + height > bottomY
}

function doRectsOverlap(
  left: Pick<CollisionRect, 'x' | 'y' | 'width' | 'height'>,
  right: Pick<CollisionRect, 'x' | 'y' | 'width' | 'height'>,
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function getSurfaceY(rect: CollisionRect, playerCenterX: number) {
  if (rect.slopeDirection === undefined) {
    return rect.y
  }

  const localX = Phaser.Math.Clamp(playerCenterX - rect.x, 0, rect.width)
  const progress = rect.width === 0 ? 0 : localX / rect.width

  if (rect.slopeDirection === 'floor-desc') {
    return rect.y + rect.height * progress
  }

  return rect.y + rect.height * (1 - progress)
}

function getDownhillDirection(direction: SlopeDirection | undefined): -1 | 1 {
  return direction === 'floor-desc' ? 1 : -1
}

function getMergedPlacementKey(placement: MergedMapPlacement) {
  return [
    placement.sourceSegmentId,
    placement.assetId,
    placement.x,
    placement.y,
    placement.widthCells,
    placement.heightCells,
  ].join(':')
}

function drawSlope(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  direction: 'floor-asc' | 'floor-desc',
) {
  if (direction === 'floor-desc') {
    graphics.fillTriangle(x, y, x + width, y + height, x, y + height)
  } else {
    graphics.fillTriangle(x + width, y, x + width, y + height, x, y + height)
  }

  graphics.lineStyle(1, color, 0.95)
  graphics.strokeRect(x, y, width, height)
}

export default RaceCanvas

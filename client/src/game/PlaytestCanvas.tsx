import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'
import type { AssetCategory, MapSegmentSnapshot } from '../types/domain'
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

const WIDTH = 768
const HEIGHT = 420
const FLOOR_Y = 328
const CELL_PX = 32
const PLAYER = { width: 34, height: 74 }
const GIANT_SCALE = 1.22
const GOAL_X = 690
const MOVE_SPEED = 260
const JUMP_SPEED = -520
const GRAVITY = 1550
const GROUND_POUND_SPEED = 760
const CROUCH_SPEED_FACTOR = 0.48
const CROUCH_HEIGHT = 60
const SLIDE_HEIGHT = 34
const SLIDE_SPEED = 340
const CONVEYOR_SPEED = 92
const SPEED_BOOST_MULTIPLIER = 1.32
const SLIPPERY_DECELERATION = 0.94
const BOUNCE_JUMP_SPEED = -610
const MONSTER_STOMP_JUMP_SPEED = -500
const MONSTER_TRAMPOLINE_SPEED = -680
const KNOCKBACK_SPEED = 380
const KNOCKBACK_UP_SPEED = -320
const UPDRAFT_SPEED = -470
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

interface PlaytestCanvasProps {
  isCleared: boolean
  segment: MapSegmentSnapshot | null
  resetSignal: number
  onClear: () => void
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

interface DrawableAssetSource {
  key: string
  assetId: string
  assetCategory?: AssetCategory
  assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
  colliderType?: MapSegmentSnapshot['assetRefs'][number]['colliderType']
  x: number
  y: number
  widthCells: number
  heightCells: number
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

class PlaytestScene extends Phaser.Scene {
  private segment: MapSegmentSnapshot | null = null
  private segmentHash = ''
  private resetSignal = 0
  private playerState: PlayerState = {
    x: 72,
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

  private onClear: () => void = () => {}
  private isCleared = false
  private playerRect?: Phaser.GameObjects.Rectangle
  private squashRect?: Phaser.GameObjects.Rectangle
  private statusText?: Phaser.GameObjects.Text
  private worldLayer?: Phaser.GameObjects.Graphics
  private labelLayer?: Phaser.GameObjects.Container
  private keyState = new Set<string>()
  private elapsedSeconds = 0
  private sceneTimeMs = 0
  private lastAnimatedWorldRedrawAt = 0
  private platformReactionStates = new Map<string, PlatformReactionState>()
  private platformMovementStates = new Map<string, PlatformMovementState>()
  private materializedHiddenPlatformKeys = new Set<string>()
  private collectedItemKeys = new Set<string>()
  private switchToggleCooldowns = new Map<string, number>()
  private isSwitchOn = false
  private monsterHitCounts = new Map<string, number>()
  private monsterDefeatStates = new Map<string, MonsterDefeatState>()
  private facingDirection: -1 | 1 = 1

  constructor() {
    super('playtest')
  }

  create() {
    this.cameras.main.setBackgroundColor('#bfdbfe')
    this.worldLayer = this.add.graphics()
    this.labelLayer = this.add.container(0, 0)
    this.drawWorld()
    this.playerRect = this.add
      .rectangle(
        this.playerState.x,
        this.playerState.y,
        PLAYER.width,
        PLAYER.height,
        0x2563eb,
        1,
      )
      .setOrigin(0)
    this.squashRect = this.add
      .rectangle(this.playerState.x, this.playerState.y, PLAYER.width, 18, 0x4a9de0, 0.95)
      .setOrigin(0)
    this.statusText = this.add.text(16, 16, 'A/D 또는 ←/→ 이동 · Space 점프 · S/↓ 내려찍기', {
      color: '#111827',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    })

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.keyState.add(event.code))
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => this.keyState.delete(event.code))
  }

  update(time: number, delta: number) {
    const dt = delta / 1000

    this.sceneTimeMs = time
    this.elapsedSeconds += dt
    this.cleanupPlatformReactions(time)
    this.cleanupMonsterDefeats(time)
    this.redrawDynamicWorld(time)
    this.applyInput()
    this.applyPhysics(dt)
    this.renderPlayer()
    this.checkGoal()
  }

  syncState(
    isCleared: boolean,
    segment: MapSegmentSnapshot | null,
    resetSignal: number,
    onClear: () => void,
  ) {
    const nextSegmentHash = segment?.segmentHash ?? ''

    if (nextSegmentHash !== this.segmentHash) {
      this.segmentHash = nextSegmentHash
      this.segment = segment
      this.elapsedSeconds = 0
      this.sceneTimeMs = 0
      this.platformReactionStates.clear()
      this.platformMovementStates.clear()
      this.materializedHiddenPlatformKeys.clear()
      this.collectedItemKeys.clear()
      this.switchToggleCooldowns.clear()
      this.isSwitchOn = false
      this.monsterHitCounts.clear()
      this.monsterDefeatStates.clear()
      this.resetPlayer()
      this.drawWorld()
    }

    if (resetSignal !== this.resetSignal) {
      this.resetSignal = resetSignal
      this.platformReactionStates.clear()
      this.platformMovementStates.clear()
      this.materializedHiddenPlatformKeys.clear()
      this.collectedItemKeys.clear()
      this.switchToggleCooldowns.clear()
      this.isSwitchOn = false
      this.monsterHitCounts.clear()
      this.monsterDefeatStates.clear()
      this.resetPlayer()
      this.drawWorld()
      this.statusText?.setText('시작 위치로 복귀')
    }

    this.isCleared = isCleared
    this.onClear = onClear

    if (isCleared) {
      this.statusText?.setText('검증 성공 · 레이스 준비 완료')
    }
  }

  private drawWorld() {
    const graphics = this.worldLayer

    if (!graphics || !this.labelLayer) {
      return
    }

    graphics.clear()
    this.labelLayer.removeAll(true)
    graphics.fillStyle(0x4a9de0, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.lineStyle(1, 0xffffff, 0.14)

    for (let x = 0; x <= WIDTH; x += 32) {
      graphics.lineBetween(x, 0, x, HEIGHT)
    }

    for (let y = 0; y <= HEIGHT; y += 32) {
      graphics.lineBetween(0, y, WIDTH, y)
    }

    graphics.fillStyle(0x8b5a2b, 1)
    graphics.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y)
    graphics.fillStyle(0x43a047, 1)
    graphics.fillRect(0, FLOOR_Y, WIDTH, 12)

    this.drawSegmentPlacements(graphics)
    this.drawProjectiles(graphics)

    const startX = this.getStartX()
    const goalX = this.getGoalX()
    graphics.fillStyle(0xf6be00, 1)
    graphics.fillRect(goalX, FLOOR_Y - 96, 18, 96)
    graphics.fillStyle(0xe52521, 1)
    graphics.fillTriangle(goalX + 18, FLOOR_Y - 96, goalX + 84, FLOOR_Y - 72, goalX + 18, FLOOR_Y - 48)

    this.labelLayer.add(this.add.text(startX, FLOOR_Y - 34, 'START', {
      color: '#111827',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    }))
    this.labelLayer.add(this.add.text(goalX - 18, FLOOR_Y - 122, 'GOAL', {
      color: '#111827',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
    }))
  }

  private drawSegmentPlacements(graphics: Phaser.GameObjects.Graphics) {
    if (this.segment === null) {
      return
    }

    this.getDrawableAssets().forEach((asset) => {
      if (asset.assetCategory === 'item' && this.collectedItemKeys.has(asset.key)) {
        return
      }

      const monsterVisual = this.getMonsterVisualState(
        asset.key,
        getMonsterStompReaction(asset),
        getMonsterHealth(asset),
      )

      if (monsterVisual.isHidden) {
        return
      }

      const platformReaction = getPlatformContactReaction(asset)
      const platformVisual = this.getPlatformVisualState(asset.key, platformReaction)
      const platformState = this.getPlatformStateForSource(asset, asset.key, CELL_PX)

      if (platformVisual.isHidden) {
        return
      }

      const color = getAssetColor(asset)
      const monsterOffset = getMonsterMotionOffset(asset, this.elapsedSeconds, CELL_PX)
      const width = Math.max(CELL_PX, asset.widthCells * CELL_PX)
      const height = Math.max(CELL_PX, asset.heightCells * CELL_PX)
      const isObstacleTriggered = this.isObstacleTriggered(
        asset,
        asset.x * CELL_PX + monsterOffset.x,
        asset.y * CELL_PX + monsterOffset.y,
        width,
        height,
        CELL_PX,
      )
      const obstacleOffset = isObstacleTriggered
        ? getObstacleMotionOffset(asset, this.elapsedSeconds, CELL_PX)
        : { x: 0, y: 0 }
      const trackingOffset = this.getMonsterTrackingOffset(
        asset,
        asset.x * CELL_PX + monsterOffset.x + obstacleOffset.x,
        asset.y * CELL_PX + monsterOffset.y + obstacleOffset.y,
        width,
        height,
        CELL_PX,
      )
      const motionOffset = {
        x: monsterOffset.x + obstacleOffset.x + trackingOffset.x + platformState.motionOffset.x,
        y: monsterOffset.y + obstacleOffset.y + trackingOffset.y + platformState.motionOffset.y,
      }
      const isInactiveObstacle = asset.assetCategory === 'obstacle' && !isObstacleTriggered
      const isInactivePlatform = asset.assetCategory === 'platform' && !platformState.isMaterialized
      const rawY = asset.y * CELL_PX + motionOffset.y + platformVisual.offsetY + monsterVisual.offsetY
      const x = Phaser.Math.Clamp(asset.x * CELL_PX + motionOffset.x, 0, WIDTH - CELL_PX)
      const y =
        platformVisual.offsetY > 0 ? rawY : Phaser.Math.Clamp(rawY, 0, FLOOR_Y - CELL_PX)
      const alpha =
        (getAssetBehavior(asset) === 'decorative' ? 0.42 : 0.88) *
        platformVisual.alpha *
        monsterVisual.alpha *
        (isInactiveObstacle || isInactivePlatform ? 0.28 : 1)

      if (y > HEIGHT) {
        return
      }

      graphics.fillStyle(color, alpha)

      if (isSlopeAsset(asset)) {
        drawSlope(graphics, x, y, width, height, color, getSlopeDirection(asset))
        return
      }

      graphics.fillRect(x + 1, y + 1, width - 2, height - 2)
    })
  }

  private getDrawableAssets(): DrawableAssetSource[] {
    if (this.segment === null) {
      return []
    }

    if (this.segment.placements.length > 0) {
      return this.segment.placements.map((placement) => ({
        key: placement.id,
        assetId: placement.asset.id,
        assetCategory: placement.asset.category,
        assetAttrs: placement.asset.attrs,
        colliderType: placement.asset.colliderType,
        x: placement.x,
        y: placement.y,
        widthCells: placement.asset.widthCells ?? 1,
        heightCells: placement.asset.heightCells ?? 1,
      }))
    }

    return this.segment.assetRefs.map((asset) => ({
      key: getSegmentAssetKey(asset),
      assetId: asset.assetId,
      assetCategory: asset.assetCategory,
      assetAttrs: asset.assetAttrs,
      colliderType: asset.colliderType,
      x: asset.x,
      y: asset.y,
      widthCells: asset.widthCells,
      heightCells: asset.heightCells,
    }))
  }

  private getCollisionRects() {
    if (this.segment === null) {
      return []
    }

    if (this.segment.placements.length > 0) {
      const placementRects = this.segment.placements
        .map((placement) => {
          const source = {
            assetId: placement.asset.id,
            assetCategory: placement.asset.category,
            assetAttrs: placement.asset.attrs,
            colliderType: placement.asset.colliderType,
            platformKey: placement.id,
            x: placement.x,
            y: placement.y,
            widthCells: placement.asset.widthCells ?? 1,
            heightCells: placement.asset.heightCells ?? 1,
            elapsedSeconds: this.elapsedSeconds,
          }
          const obstacleState = this.getObstacleStateForSource(source, CELL_PX)
          const platformState = this.getPlatformStateForSource(source, placement.id, CELL_PX)

          return createCollisionRect({
            ...source,
            isObstacleEnabled: obstacleState.isTriggered,
            obstacleMotionOffset: obstacleState.motionOffset,
            isPlatformEnabled: platformState.isMaterialized,
            platformMotionOffset: platformState.motionOffset,
            monsterTrackingOffset: this.getMonsterTrackingOffsetForSource(source, CELL_PX),
          })
        })
        .filter((rect): rect is CollisionRect => rect !== null)
        .filter((rect) => this.isItemRectActive(rect))
        .filter((rect) => this.isMonsterRectActive(rect))
        .filter((rect) => this.isPlatformRectActive(rect))

      return [...placementRects, ...this.getProjectileCollisionRects()]
    }

    const assetRefRects = this.segment.assetRefs
      .map((asset) => {
        const source = {
          assetId: asset.assetId,
          assetCategory: asset.assetCategory,
          assetAttrs: asset.assetAttrs,
          colliderType: asset.colliderType,
          platformKey: getSegmentAssetKey(asset),
          x: asset.x,
          y: asset.y,
          widthCells: asset.widthCells,
          heightCells: asset.heightCells,
          elapsedSeconds: this.elapsedSeconds,
        }
        const obstacleState = this.getObstacleStateForSource(source, CELL_PX)
        const platformState = this.getPlatformStateForSource(source, getSegmentAssetKey(asset), CELL_PX)

        return createCollisionRect({
          ...source,
          isObstacleEnabled: obstacleState.isTriggered,
          obstacleMotionOffset: obstacleState.motionOffset,
          isPlatformEnabled: platformState.isMaterialized,
          platformMotionOffset: platformState.motionOffset,
          monsterTrackingOffset: this.getMonsterTrackingOffsetForSource(source, CELL_PX),
        })
      })
      .filter((rect): rect is CollisionRect => rect !== null)
      .filter((rect) => this.isItemRectActive(rect))
      .filter((rect) => this.isMonsterRectActive(rect))
      .filter((rect) => this.isPlatformRectActive(rect))

    return [...assetRefRects, ...this.getProjectileCollisionRects()]
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
    if (this.segment === null) {
      return false
    }

    return (
      this.segment.assetRefs.some((asset) => isDynamicMonster(asset)) ||
      this.segment.placements.some((placement) =>
        isDynamicMonster({
          assetId: placement.asset.id,
          assetCategory: placement.asset.category,
          assetAttrs: placement.asset.attrs,
          colliderType: placement.asset.colliderType,
          x: placement.x,
          y: placement.y,
        }),
      )
    )
  }

  private getMonsterTrackingOffsetForSource(
    source: {
      assetId: string
      assetCategory?: AssetCategory
      assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
      colliderType?: MapSegmentSnapshot['assetRefs'][number]['colliderType']
      x: number
      y: number
      widthCells: number
      heightCells: number
      elapsedSeconds: number
    },
    cellPx: number,
  ) {
    const monsterOffset = getMonsterMotionOffset(source, source.elapsedSeconds, cellPx)
    const obstacleOffset = getObstacleMotionOffset(source, source.elapsedSeconds, cellPx)
    const width = Math.max(cellPx, source.widthCells * cellPx)
    const height = Math.max(cellPx, source.heightCells * cellPx)

    return this.getMonsterTrackingOffset(
      source,
      source.x * cellPx + monsterOffset.x + obstacleOffset.x,
      source.y * cellPx + monsterOffset.y + obstacleOffset.y,
      width,
      height,
      cellPx,
    )
  }

  private getMonsterTrackingOffset(
    source: {
      assetId: string
      assetCategory?: AssetCategory
      assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
    },
    baseX: number,
    baseY: number,
    width: number,
    height: number,
    cellPx: number,
  ) {
    const trackingMode = getMonsterTrackingMode(source)

    if (trackingMode === 'none') {
      return { x: 0, y: 0 }
    }

    const playerCenterX = this.playerState.x + this.getPlayerWidth() / 2
    const playerCenterY = this.playerState.y + this.getPlayerHeight() / 2
    const monsterCenterX = baseX + width / 2
    const monsterCenterY = baseY + height / 2
    const dx = playerCenterX - monsterCenterX
    const dy = playerCenterY - monsterCenterY
    const distance = Math.hypot(dx, dy)

    if (trackingMode === 'near' && distance > cellPx * 5) {
      return { x: 0, y: 0 }
    }

    if (trackingMode === 'gaze-freeze' && this.isPlayerLookingAt(monsterCenterX)) {
      return { x: 0, y: 0 }
    }

    if (trackingMode === 'jump-sync') {
      return { x: 0, y: this.playerState.isGrounded ? 0 : -cellPx * 0.9 }
    }

    const strength =
      trackingMode === 'always' ? 1.25 : trackingMode === 'gaze-freeze' ? 0.95 : 0.8
    const verticalStrength = trackingMode === 'always' ? 0.75 : 0.45

    return {
      x: Phaser.Math.Clamp(dx * 0.24, -cellPx * strength, cellPx * strength),
      y: Phaser.Math.Clamp(dy * 0.16, -cellPx * verticalStrength, cellPx * verticalStrength),
    }
  }

  private isPlayerLookingAt(targetX: number) {
    const playerCenterX = this.playerState.x + this.getPlayerWidth() / 2

    return (
      (targetX >= playerCenterX && this.facingDirection === 1) ||
      (targetX < playerCenterX && this.facingDirection === -1)
    )
  }

  private hasDynamicObstacles() {
    if (this.segment === null) {
      return false
    }

    return this.getDrawableAssets().some((asset) => isDynamicObstacle(asset))
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
    const playerCenterX = this.playerState.x + this.getPlayerWidth() / 2
    const playerCenterY = this.playerState.y + this.getPlayerHeight() / 2

    return this.getDrawableAssets().flatMap((asset) => {
      const mode = getObstacleProjectileMode(asset)

      if (mode === 'none') {
        return []
      }

      const obstacleState = this.getObstacleStateForSource(asset, CELL_PX)

      if (!obstacleState.isTriggered) {
        return []
      }

      const width = Math.max(CELL_PX, asset.widthCells * CELL_PX)
      const height = Math.max(CELL_PX, asset.heightCells * CELL_PX)
      const originX = asset.x * CELL_PX + obstacleState.motionOffset.x + width / 2
      const originY = asset.y * CELL_PX + obstacleState.motionOffset.y + height / 2
      const cycleSeconds = 2.4
      const progress = ((this.elapsedSeconds + getStablePhase(asset.key)) % cycleSeconds) / cycleSeconds
      const direction = playerCenterX < originX ? -1 : 1
      const size = 14
      const travel = CELL_PX * 7
      const homingY =
        mode === 'homing-normal'
          ? Phaser.Math.Clamp(playerCenterY - originY, -CELL_PX * 3, CELL_PX * 3) * progress * 0.72
          : 0

      return [
        {
          x: originX + direction * progress * travel - size / 2,
          y: originY + homingY - size / 2,
          width: size,
          height: size,
          mode,
          obstacleEffect: getObstacleContactEffect(asset),
        },
      ]
    })
  }

  private hasDynamicPlatforms() {
    if (this.segment === null) {
      return false
    }

    return this.getDrawableAssets().some((asset) => isDynamicPlatform(asset))
  }

  private getPlatformStateForSource(
    source: {
      assetId: string
      assetCategory?: AssetCategory
      assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
    },
    key: string | null,
    cellPx: number,
  ) {
    const movementMode = getPlatformMovementMode(source)
    const movementState = key === null ? undefined : this.platformMovementStates.get(key)
    const stepElapsedSeconds =
      movementState === undefined ? 0 : Math.max(0, (this.sceneTimeMs - movementState.triggeredAtMs) / 1000)
    const shouldUseStepElapsed = movementMode === 'start-on-step' || movementMode === 'step-one-way'
    const isHiddenMaterialized =
      key !== null &&
      getPlatformMaterialization(source) === 'hidden-on-hit' &&
      this.materializedHiddenPlatformKeys.has(key)
    const materialization = getPlatformMaterialization(source)
    const isSwitchMaterialized =
      materialization === 'switch-on'
        ? this.isSwitchOn
        : materialization === 'switch-off'
          ? !this.isSwitchOn
          : false

    return {
      isMaterialized:
        isPlatformMaterialized(source, this.elapsedSeconds) ||
        isHiddenMaterialized ||
        isSwitchMaterialized,
      motionOffset: getPlatformMotionOffset(
        source,
        shouldUseStepElapsed ? stepElapsedSeconds : this.elapsedSeconds,
        cellPx,
        movementState !== undefined,
      ),
    }
  }

  private getObstacleStateForSource(
    source: {
      assetId: string
      assetCategory?: AssetCategory
      assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
      colliderType?: MapSegmentSnapshot['assetRefs'][number]['colliderType']
      x: number
      y: number
      widthCells: number
      heightCells: number
    },
    cellPx: number,
  ) {
    const width = Math.max(cellPx, source.widthCells * cellPx)
    const height = Math.max(cellPx, source.heightCells * cellPx)
    const isTriggered = this.isObstacleTriggered(
      source,
      source.x * cellPx,
      source.y * cellPx,
      width,
      height,
      cellPx,
    )

    return {
      isTriggered,
      motionOffset: isTriggered
        ? getObstacleMotionOffset(source, this.elapsedSeconds, cellPx)
        : { x: 0, y: 0 },
    }
  }

  private isObstacleTriggered(
    source: {
      assetId: string
      assetCategory?: AssetCategory
      assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
    },
    baseX: number,
    baseY: number,
    width: number,
    height: number,
    cellPx: number,
  ) {
    if (source.assetCategory !== 'obstacle') {
      return true
    }

    if (!isObstacleActive(source, this.elapsedSeconds)) {
      return false
    }

    const triggerMode = getObstacleTriggerMode(source)

    if (triggerMode === 'always' || triggerMode === 'cycle-normal') {
      return true
    }

    const playerCenterX = this.playerState.x + this.getPlayerWidth() / 2
    const playerCenterY = this.playerState.y + this.getPlayerHeight() / 2
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

  private isPlatformRectActive(rect: CollisionRect) {
    if (rect.platformKey === null || rect.platformReaction === 'none') {
      return true
    }

    const state = this.platformReactionStates.get(rect.platformKey)

    if (state === undefined) {
      return true
    }

    return this.sceneTimeMs - state.triggeredAtMs < PLATFORM_REACTION_DELAY_MS
  }

  private isItemRectActive(rect: CollisionRect) {
    return rect.itemKey === null || !this.collectedItemKeys.has(rect.itemKey)
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

  private isMonsterRectActive(rect: CollisionRect) {
    return rect.monsterKey === null || !this.monsterDefeatStates.has(rect.monsterKey)
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
      this.playerState.speedBoostUntilMs = this.sceneTimeMs + ITEM_SPEED_BOOST_MS
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
    if (this.playerState.isGiant) {
      return
    }

    const previousHeight = this.getPlayerHeight()
    this.playerState.isGiant = true
    this.playerState.y -= this.getPlayerHeight() - previousHeight
  }

  private absorbDamage() {
    if (!this.playerState.isGiant) {
      return false
    }

    const previousHeight = this.getPlayerHeight()
    this.playerState.isGiant = false
    this.playerState.y += previousHeight - this.getPlayerHeight()
    this.playerState.vx = 0
    this.playerState.vy = Math.min(this.playerState.vy, KNOCKBACK_UP_SPEED)
    this.playerState.isGrounded = false
    this.playerState.isGroundPounding = false
    this.playerState.isSliding = false
    this.playerState.slideDirection = 0
    this.playerState.surfaceEffect = 'none'
    this.statusText?.setText('거대버섯 보호 · 기본 크기로 복귀')

    return true
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

  private applyInput() {
    const left = this.keyState.has('KeyA') || this.keyState.has('ArrowLeft')
    const right = this.keyState.has('KeyD') || this.keyState.has('ArrowRight')
    const down = this.keyState.has('KeyS') || this.keyState.has('ArrowDown')
    const jump = this.keyState.has('Space')

    if (this.playerState.isSliding) {
      this.playerState.isCrouching = false
      this.playerState.vx = (this.playerState.slideDirection || 1) * SLIDE_SPEED

      if (jump && this.playerState.isGrounded) {
        this.playerState.vy = JUMP_SPEED
        this.playerState.isGrounded = false
        this.playerState.isGroundPounding = false
        this.playerState.isSliding = false
        this.playerState.slideDirection = 0
        this.playerState.surfaceEffect = 'none'
      }

      return
    }

    const surfaceEffect = this.playerState.isGrounded ? this.playerState.surfaceEffect : 'none'
    const hasItemSpeedBoost = this.sceneTimeMs < this.playerState.speedBoostUntilMs
    const moveSpeed =
      surfaceEffect === 'speed-boost' || hasItemSpeedBoost
        ? MOVE_SPEED * SPEED_BOOST_MULTIPLIER
        : MOVE_SPEED

    if (left === right) {
      this.playerState.vx =
        surfaceEffect === 'slippery' && Math.abs(this.playerState.vx) > 2
          ? this.playerState.vx * SLIPPERY_DECELERATION
          : 0
    } else {
      this.facingDirection = left ? -1 : 1
      this.playerState.vx = left ? -moveSpeed : moveSpeed
    }

    this.playerState.isCrouching = down && this.playerState.isGrounded

    if (this.playerState.isCrouching) {
      this.playerState.vx *= CROUCH_SPEED_FACTOR
    }

    if (surfaceEffect === 'conveyor-normal') {
      this.playerState.vx += CONVEYOR_SPEED
    }

    if (jump && this.playerState.isGrounded) {
      this.playerState.vy = JUMP_SPEED
      this.playerState.isGrounded = false
      this.playerState.isCrouching = false
      this.playerState.isGroundPounding = false
      this.playerState.surfaceEffect = 'none'
    }

    if (down && !this.playerState.isGrounded) {
      this.playerState.vx = 0
      this.playerState.vy = GROUND_POUND_SPEED
      this.playerState.isCrouching = false
      this.playerState.isGroundPounding = true
      this.playerState.isSliding = false
      this.playerState.slideDirection = 0
      this.playerState.surfaceEffect = 'none'
    }
  }

  private applyPhysics(dt: number) {
    const previousX = this.playerState.x
    const previousY = this.playerState.y
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()

    this.playerState.vy += GRAVITY * dt
    this.playerState.x += this.playerState.vx * dt
    this.playerState.x = Phaser.Math.Clamp(this.playerState.x, 0, WIDTH - playerWidth)
    this.resolveSolidWallCollisions(previousX)
    this.playerState.y += this.playerState.vy * dt
    if (!this.resolveHiddenPlatformBump(previousY)) {
      this.resolveSolidCeilingCollisions(previousY)
    }

    if (this.isTouchingHazard(previousY)) {
      if (this.absorbDamage()) {
        return
      }

      this.resetPlayer()
      this.statusText?.setText('위험물 충돌 · 시작 위치로 복귀')
      return
    }

    this.applyObstacleEffects()
    this.applyItemEffects()

    if (this.resolveSolidLanding(previousY)) {
      return
    }

    if (this.playerState.y >= FLOOR_Y - playerHeight) {
      this.playerState.y = FLOOR_Y - playerHeight
      this.playerState.vy = 0
      this.playerState.isGrounded = true
      this.playerState.isSliding = false
      this.playerState.slideDirection = 0
      this.playerState.isGroundPounding = false
      this.playerState.surfaceEffect = 'none'
    } else {
      this.playerState.isGrounded = false
      this.playerState.isSliding = false
      this.playerState.slideDirection = 0
      this.playerState.surfaceEffect = 'none'
    }
  }

  private resolveSolidWallCollisions(previousX: number) {
    if (this.playerState.vx === 0) {
      return
    }

    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerTop = this.playerState.y
    const previousLeft = previousX
    const previousRight = previousX + playerWidth
    const nextLeft = this.playerState.x
    const nextRight = this.playerState.x + playerWidth
    const movingRight = this.playerState.vx > 0
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

    this.playerState.x = movingRight
      ? wallCandidate.x - playerWidth
      : wallCandidate.x + wallCandidate.width
    this.playerState.vx = 0
    this.playerState.isSliding = false
    this.playerState.slideDirection = 0
  }

  private resolveSolidCeilingCollisions(previousY: number) {
    if (this.playerState.vy >= 0) {
      return
    }

    const playerWidth = this.getPlayerWidth()
    const previousTop = previousY
    const nextTop = this.playerState.y
    const ceilingCandidate = this.getCollisionRects()
      .filter(isFullSolidRect)
      .filter((rect) => rect.slopeDirection === undefined)
      .filter((rect) => hasHorizontalOverlap(this.playerState.x, playerWidth, rect.x, rect.width))
      .filter((rect) => previousTop >= rect.y + rect.height && nextTop < rect.y + rect.height)
      .sort((left, right) => right.y + right.height - (left.y + left.height))[0]

    if (ceilingCandidate === undefined) {
      return
    }

    this.playerState.y = ceilingCandidate.y + ceilingCandidate.height
    this.playerState.vy = 0
    this.playerState.isGroundPounding = false
  }

  private resolveHiddenPlatformBump(previousY: number) {
    if (this.playerState.vy >= 0 || this.segment === null) {
      return false
    }

    const playerWidth = this.getPlayerWidth()
    const previousTop = previousY
    const nextTop = this.playerState.y
    const bumpedPlatform = this.getDrawableAssets()
      .filter(
        (asset) =>
          asset.assetCategory === 'platform' &&
          getPlatformMaterialization(asset) === 'hidden-on-hit' &&
          !this.materializedHiddenPlatformKeys.has(asset.key),
      )
      .map((asset) => {
        const width = Math.max(CELL_PX, asset.widthCells * CELL_PX)
        const height = Math.max(CELL_PX, asset.heightCells * CELL_PX)

        return {
          key: asset.key,
          x: Phaser.Math.Clamp(asset.x * CELL_PX, 0, WIDTH - CELL_PX),
          y: Phaser.Math.Clamp(asset.y * CELL_PX, 0, FLOOR_Y - CELL_PX),
          width,
          height,
        }
      })
      .filter((rect) => hasHorizontalOverlap(this.playerState.x, playerWidth, rect.x, rect.width))
      .filter((rect) => previousTop >= rect.y + rect.height && nextTop < rect.y + rect.height)
      .sort((left, right) => right.y + right.height - (left.y + left.height))[0]

    if (bumpedPlatform === undefined) {
      return false
    }

    this.materializedHiddenPlatformKeys.add(bumpedPlatform.key)
    this.playerState.y = bumpedPlatform.y + bumpedPlatform.height
    this.playerState.vy = 0
    this.playerState.isGroundPounding = false
    this.statusText?.setText('숨겨진 블록 발견')
    this.drawWorld()

    return true
  }

  private resolveSolidLanding(previousY: number) {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()

    if (this.playerState.vy < 0) {
      this.playerState.isGrounded = false
      this.playerState.surfaceEffect = 'none'
      return false
    }

    const previousBottom = previousY + playerHeight
    const nextBottom = this.playerState.y + playerHeight
    const wasGroundPounding = this.playerState.isGroundPounding
    const wasSliding = this.playerState.isSliding
    const landingCandidate = this.getCollisionRects()
      .filter(
        (rect) =>
          isLandableSolidRect(rect) ||
          (rect.behavior === 'hazard' &&
            (rect.obstacleHitSurface === 'top-safe' || isStompableMonster(rect))),
      )
      .map((rect) => ({ rect, surfaceY: getSurfaceY(rect, this.playerState.x + playerWidth / 2) }))
      .filter(({ rect, surfaceY }) => {
        const isSlope = rect.slopeDirection !== undefined
        const stepUpPx = isSlope ? SLOPE_STEP_UP_PX : RECT_STEP_UP_PX
        const crossedSurface = previousBottom <= surfaceY + stepUpPx && nextBottom >= surfaceY
        const snappedToSlope =
          isSlope &&
          this.playerState.isGrounded &&
          previousBottom <= surfaceY + stepUpPx &&
          nextBottom + SLOPE_SNAP_DOWN_PX >= surfaceY

        return (
          (crossedSurface || snappedToSlope) &&
          hasHorizontalOverlap(this.playerState.x, playerWidth, rect.x, rect.width)
        )
      })
      .sort((left, right) => left.surfaceY - right.surfaceY)[0]

    if (landingCandidate === undefined) {
      this.playerState.isGrounded = false
      this.playerState.surfaceEffect = 'none'
      return false
    }

    this.playerState.y = landingCandidate.surfaceY - playerHeight
    this.playerState.vy = 0
    this.playerState.isGrounded = true
    this.playerState.isGroundPounding = false
    this.playerState.surfaceEffect = landingCandidate.rect.surfaceEffect
    this.triggerPlatformReaction(landingCandidate.rect)
    this.triggerPlatformMovement(landingCandidate.rect)

    if (isStompableMonster(landingCandidate.rect)) {
      this.handleMonsterStomp(landingCandidate.rect)
      this.playerState.vy =
        landingCandidate.rect.monsterStompReaction === 'trampoline'
          ? MONSTER_TRAMPOLINE_SPEED
          : MONSTER_STOMP_JUMP_SPEED
      this.playerState.isGrounded = false
      this.playerState.isSliding = false
      this.playerState.slideDirection = 0
      this.playerState.surfaceEffect = 'none'
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
      this.playerState.vy = BOUNCE_JUMP_SPEED
      this.playerState.isGrounded = false
      this.playerState.isSliding = false
      this.playerState.slideDirection = 0
      this.playerState.surfaceEffect = 'none'
      this.statusText?.setText('탄성 플랫폼 · 자동 점프')
      return true
    }

    this.playerState.isSliding =
      landingCandidate.rect.slopeDirection !== undefined && (wasGroundPounding || wasSliding)
    this.playerState.slideDirection = this.playerState.isSliding
      ? getDownhillDirection(landingCandidate.rect.slopeDirection)
      : 0

    if (this.playerState.isSliding) {
      this.playerState.vx = this.playerState.slideDirection * SLIDE_SPEED
    }

    return true
  }

  private isTouchingHazard(previousY: number) {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.playerState.x,
      y: this.playerState.y,
      width: playerWidth,
      height: playerHeight,
    }
    const previousBottom = previousY + playerHeight
    const nextBottom = this.playerState.y + playerHeight

    return this.getCollisionRects()
      .filter((rect) => rect.behavior === 'hazard')
      .some((rect) => {
        if (!doRectsOverlap(playerRect, rect)) {
          return false
        }

        if (rect.obstacleHitSurface === 'top-safe') {
          return !(
            this.playerState.vy >= 0 &&
            previousBottom <= rect.y + RECT_STEP_UP_PX &&
            nextBottom >= rect.y &&
            hasHorizontalOverlap(this.playerState.x, playerWidth, rect.x, rect.width)
          )
        }

        if (isStompableMonster(rect)) {
          return !(
            this.playerState.vy >= 0 &&
            previousBottom <= rect.y + RECT_STEP_UP_PX &&
            nextBottom >= rect.y &&
            hasHorizontalOverlap(this.playerState.x, playerWidth, rect.x, rect.width)
          )
        }

        if (rect.obstacleHitSurface === 'bottom-only') {
          return (
            this.playerState.vy < 0 &&
            previousY >= rect.y + rect.height - RECT_STEP_UP_PX &&
            this.playerState.y <= rect.y + rect.height &&
            hasHorizontalOverlap(this.playerState.x, playerWidth, rect.x, rect.width)
          )
        }

        return true
      })
  }

  private applyObstacleEffects() {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.playerState.x,
      y: this.playerState.y,
      width: playerWidth,
      height: playerHeight,
    }
    const effectRect = this.getCollisionRects()
      .filter((rect) => rect.behavior === 'effect' && rect.itemEffect === 'none')
      .find((rect) => doRectsOverlap(playerRect, rect))

    if (effectRect === undefined) {
      return
    }

    this.playerState.isGrounded = false
    this.playerState.isGroundPounding = false
    this.playerState.isSliding = false
    this.playerState.slideDirection = 0
    this.playerState.surfaceEffect = 'none'

    if (effectRect.obstacleEffect === 'updraft') {
      this.playerState.vy = Math.min(this.playerState.vy, UPDRAFT_SPEED)
      this.statusText?.setText('상승 기류 · 위로 밀려납니다')
      return
    }

    if (effectRect.obstacleEffect === 'knockback-high') {
      const playerCenterX = this.playerState.x + playerWidth / 2
      const effectCenterX = effectRect.x + effectRect.width / 2
      const direction = playerCenterX < effectCenterX ? -1 : 1

      this.playerState.vx = direction * KNOCKBACK_SPEED
      this.playerState.vy = Math.min(this.playerState.vy, KNOCKBACK_UP_SPEED)
      this.statusText?.setText('튕겨냄 · 밀려났습니다')
    }
  }

  private applyItemEffects() {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const playerRect = {
      x: this.playerState.x,
      y: this.playerState.y,
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

  private renderPlayer() {
    const playerWidth = this.getPlayerWidth()
    const playerHeight = this.getPlayerHeight()
    const crouchHeight = this.playerState.isGiant ? CROUCH_HEIGHT * GIANT_SCALE : CROUCH_HEIGHT
    const slideHeight = this.playerState.isGiant ? SLIDE_HEIGHT * GIANT_SCALE : SLIDE_HEIGHT
    const groundPoundHeight = this.playerState.isGiant ? 28 * GIANT_SCALE : 28
    const squashHeight = this.playerState.isGroundPounding
      ? groundPoundHeight
      : this.playerState.isSliding
        ? slideHeight
        : this.playerState.isCrouching
          ? crouchHeight
          : playerHeight
    const squashOffset = playerHeight - squashHeight

    this.playerRect
      ?.setPosition(this.playerState.x, this.playerState.y + squashOffset)
      .setSize(playerWidth, squashHeight)
    this.squashRect?.setPosition(this.playerState.x, this.playerState.y + squashOffset)
  }

  private checkGoal() {
    if (this.isCleared) {
      return
    }

    if (this.playerState.x + this.getPlayerWidth() >= this.getGoalX()) {
      this.isCleared = true
      this.statusText?.setText('검증 성공 · 레이스 준비 완료')
      this.onClear()
    }
  }

  private resetPlayer() {
    this.playerState = {
      x: this.getStartX(),
      y: this.getStartY(),
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
  }

  private getPlayerWidth() {
    return this.playerState.isGiant ? PLAYER.width * GIANT_SCALE : PLAYER.width
  }

  private getPlayerHeight() {
    return this.playerState.isGiant ? PLAYER.height * GIANT_SCALE : PLAYER.height
  }

  private getStartX() {
    return Phaser.Math.Clamp((this.segment?.startPoint.x ?? 2) * CELL_PX, 0, WIDTH - this.getPlayerWidth())
  }

  private getStartY() {
    return Phaser.Math.Clamp((this.segment?.startPoint.y ?? 8) * CELL_PX, 0, FLOOR_Y - this.getPlayerHeight())
  }

  private getGoalX() {
    return Phaser.Math.Clamp((this.segment?.endPoint.x ?? GOAL_X / CELL_PX) * CELL_PX, 96, WIDTH - 80)
  }
}

function PlaytestCanvas({ isCleared, segment, resetSignal, onClear }: PlaytestCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PlaytestScene | null>(null)
  const onClearRef = useRef(onClear)

  useEffect(() => {
    onClearRef.current = onClear
  }, [onClear])

  useEffect(() => {
    if (hostRef.current === null) {
      return undefined
    }

    const scene = new PlaytestScene()
    sceneRef.current = scene

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#4a9de0',
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
    sceneRef.current?.syncState(isCleared, segment, resetSignal, () => onClearRef.current())
  }, [isCleared, resetSignal, segment])

  return <div className="playtest-phaser-host" ref={hostRef} />
}

function createCollisionRect(source: {
  assetId: string
  assetCategory?: AssetCategory
  assetAttrs?: MapSegmentSnapshot['assetRefs'][number]['assetAttrs']
  colliderType?: MapSegmentSnapshot['assetRefs'][number]['colliderType']
  platformKey: string | null
  x: number
  y: number
  widthCells: number
  heightCells: number
  elapsedSeconds: number
  isObstacleEnabled?: boolean
  obstacleMotionOffset?: { x: number; y: number }
  isPlatformEnabled?: boolean
  platformMotionOffset?: { x: number; y: number }
  monsterTrackingOffset?: { x: number; y: number }
}): CollisionRect | null {
  const behavior = getAssetBehavior(source)

  if (behavior === 'decorative') {
    return null
  }

  if (source.assetCategory === 'platform' && source.isPlatformEnabled === false) {
    return null
  }

  if (
    source.assetCategory === 'obstacle' &&
    (source.isObstacleEnabled === false || !isObstacleActive(source, source.elapsedSeconds))
  ) {
    return null
  }

  const monsterOffset = getMonsterMotionOffset(source, source.elapsedSeconds, CELL_PX)
  const obstacleOffset =
    source.obstacleMotionOffset ?? getObstacleMotionOffset(source, source.elapsedSeconds, CELL_PX)
  const platformOffset =
    source.platformMotionOffset ?? getPlatformMotionOffset(source, source.elapsedSeconds, CELL_PX)
  const motionOffset = {
    x:
      monsterOffset.x +
      obstacleOffset.x +
      platformOffset.x +
      (source.monsterTrackingOffset?.x ?? 0),
    y:
      monsterOffset.y +
      obstacleOffset.y +
      platformOffset.y +
      (source.monsterTrackingOffset?.y ?? 0),
  }

  return {
    x: Phaser.Math.Clamp(source.x * CELL_PX + motionOffset.x, 0, WIDTH - CELL_PX),
    y: Phaser.Math.Clamp(source.y * CELL_PX + motionOffset.y, 0, FLOOR_Y - CELL_PX),
    width: Math.max(CELL_PX, source.widthCells * CELL_PX),
    height: Math.max(CELL_PX, source.heightCells * CELL_PX),
    behavior,
    slopeDirection: isSlopeAsset(source) ? getSlopeDirection(source) : undefined,
    surfaceEffect: getPlatformSurfaceEffect(source),
    platformKey: source.assetCategory === 'platform' ? source.platformKey : null,
    platformCollisionMode: getPlatformCollisionMode(source),
    platformReaction: getPlatformContactReaction(source),
    platformMovementMode: getPlatformMovementMode(source),
    itemKey: source.assetCategory === 'item' ? source.platformKey : null,
    itemEffect: getItemEffect(source),
    monsterKey: source.assetCategory === 'monster' ? source.platformKey : null,
    obstacleEffect: getObstacleContactEffect(source),
    obstacleHitSurface: getObstacleHitSurface(source),
    monsterHealth: getMonsterHealth(source),
    monsterStompReaction: getMonsterStompReaction(source),
  }
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

function getSegmentAssetKey(asset: MapSegmentSnapshot['assetRefs'][number]) {
  return `${asset.assetId}:${asset.x}:${asset.y}:${asset.widthCells}:${asset.heightCells}`
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
    graphics.fillTriangle(x + 1, y + 1, x + width - 1, y + height - 1, x + 1, y + height - 1)
  } else {
    graphics.fillTriangle(x + width - 1, y + 1, x + width - 1, y + height - 1, x + 1, y + height - 1)
  }

  graphics.lineStyle(1, color, 0.95)
  graphics.strokeRect(x + 1, y + 1, width - 2, height - 2)
}

export default PlaytestCanvas

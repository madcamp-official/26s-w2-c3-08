import type { Asset, AssetCategory } from '../types/domain'

export type CollisionBehavior = 'solid' | 'hazard' | 'effect' | 'decorative'
export type SlopeDirection = 'floor-asc' | 'floor-desc'
export type PlatformSurfaceEffect =
  | 'none'
  | 'slippery'
  | 'conveyor-normal'
  | 'bounce-high'
  | 'speed-boost'
export type PlatformCollisionMode = 'solid' | 'one-way-up' | 'one-way-directed'
export type PlatformContactReaction = 'none' | 'fall-after-touch' | 'break-after-touch'
export type PlatformMaterialization =
  | 'always'
  | 'hidden-on-hit'
  | 'switch-on'
  | 'switch-off'
  | 'blink-normal'
export type PlatformMovementMode = 'fixed' | 'patrol-normal' | 'start-on-step' | 'step-one-way'
export type ObstacleContactEffect =
  | 'none'
  | 'damage'
  | 'instant-death'
  | 'knockback-high'
  | 'updraft'
export type ObstacleHitSurface = 'all' | 'top-safe' | 'bottom-only'
export type ObstacleTriggerMode =
  | 'always'
  | 'cycle-normal'
  | 'proximity-x'
  | 'proximity-y'
  | 'proximity-radius'
export type ObstacleActionMode =
  | 'fixed'
  | 'rotate-normal'
  | 'swing'
  | 'patrol-normal'
  | 'charge-down'
export type ObstacleProjectileMode = 'none' | 'straight-normal' | 'homing-normal'
export type ItemEffect = 'none' | 'speed-boost' | 'giant-mushroom' | 'toggle-switch'
export type MonsterMoveType = 'static' | 'ground-walk-normal' | 'surface-crawl' | 'flying'
export type MonsterTrackingMode = 'none' | 'near' | 'always' | 'gaze-freeze' | 'jump-sync'
export type MonsterLedgeBehavior = 'fall' | 'turn'
export type MonsterStompReaction = 'kill' | 'stun-normal' | 'harmful' | 'trampoline'

export interface AssetRuleSource {
  assetId: string
  assetCategory?: AssetCategory
  assetAttrs?: Asset['attrs']
  colliderType?: Asset['colliderType']
  sourceSegmentId?: string
  x?: number
  y?: number
}

export function getAssetBehavior(source: AssetRuleSource): CollisionBehavior {
  if (source.sourceSegmentId === 'connector') {
    return 'solid'
  }

  if (source.assetCategory === 'item') {
    return getItemEffect(source) === 'none' ? 'decorative' : 'effect'
  }

  if (source.colliderType === 'none') {
    return 'decorative'
  }

  if (source.assetCategory === 'background') {
    return 'decorative'
  }

  if (source.assetCategory === 'platform') {
    return 'solid'
  }

  if (source.assetCategory === 'obstacle') {
    const contactEffect = getObstacleContactEffect(source)
    return contactEffect === 'knockback-high' || contactEffect === 'updraft' ? 'effect' : 'hazard'
  }

  if (source.assetCategory === 'monster') {
    return 'hazard'
  }

  if (
    source.assetId.includes('obstacle') ||
    source.assetId.includes('spike') ||
    source.assetId.includes('monster')
  ) {
    return 'hazard'
  }

  if (source.assetId.includes('background') || source.assetId.includes('item')) {
    return 'decorative'
  }

  return 'solid'
}

export function getAssetColor(source: AssetRuleSource) {
  if (source.sourceSegmentId === 'connector') {
    return 0x43a047
  }

  if (getAssetBehavior(source) === 'hazard') {
    if (source.assetCategory === 'monster') {
      return getMonsterStompReaction(source) === 'harmful' ? 0xe52521 : 0x43a047
    }

    const hitSurface = getObstacleHitSurface(source)

    if (hitSurface === 'top-safe') {
      return 0xf97316
    }

    if (hitSurface === 'bottom-only') {
      return 0x9333ea
    }

    return 0xe52521
  }

  if (getAssetBehavior(source) === 'effect') {
    return getObstacleContactEffect(source) === 'updraft' ? 0x22d3ee : 0xf6be00
  }

  if (source.assetCategory === 'monster' || source.assetId.includes('monster')) {
    return 0x43a047
  }

  if (source.assetCategory === 'background' || source.assetId.includes('background')) {
    return 0x4a9de0
  }

  if (source.assetCategory === 'item' || source.assetId.includes('item')) {
    return 0xf6be00
  }

  return 0x8b5a2b
}

export function isSlopeAsset(source: AssetRuleSource) {
  const shape = stringAttr(source.assetAttrs, 'shape')

  return source.colliderType === 'slope' || shape.startsWith('slope-')
}

export function getSlopeDirection(source: AssetRuleSource): SlopeDirection {
  const shape = stringAttr(source.assetAttrs, 'shape')

  if (shape === 'slope-floor-desc') {
    return 'floor-desc'
  }

  return 'floor-asc'
}

export function getPlatformSurfaceEffect(source: AssetRuleSource): PlatformSurfaceEffect {
  if (source.assetCategory !== 'platform') {
    return 'none'
  }

  const surfaceEffect = stringAttr(source.assetAttrs, 'surfaceEffect')

  if (
    surfaceEffect === 'slippery' ||
    surfaceEffect === 'conveyor-normal' ||
    surfaceEffect === 'bounce-high' ||
    surfaceEffect === 'speed-boost'
  ) {
    return surfaceEffect
  }

  return 'none'
}

export function getPlatformCollisionMode(source: AssetRuleSource): PlatformCollisionMode {
  if (source.assetCategory !== 'platform') {
    return 'solid'
  }

  const collisionMode = stringAttr(source.assetAttrs, 'collisionMode')

  if (collisionMode === 'one-way-up' || collisionMode === 'one-way-directed') {
    return collisionMode
  }

  return 'solid'
}

export function getPlatformContactReaction(source: AssetRuleSource): PlatformContactReaction {
  if (source.assetCategory !== 'platform') {
    return 'none'
  }

  const contactReaction = stringAttr(source.assetAttrs, 'contactReaction')

  if (contactReaction === 'fall-after-touch' || contactReaction === 'break-after-touch') {
    return contactReaction
  }

  return 'none'
}

export function getPlatformMaterialization(source: AssetRuleSource): PlatformMaterialization {
  if (source.assetCategory !== 'platform') {
    return 'always'
  }

  const materialization = stringAttr(source.assetAttrs, 'materialization')

  if (
    materialization === 'hidden-on-hit' ||
    materialization === 'switch-on' ||
    materialization === 'switch-off' ||
    materialization === 'blink-normal'
  ) {
    return materialization
  }

  return 'always'
}

export function isPlatformMaterialized(source: AssetRuleSource, elapsedSeconds: number) {
  const materialization = getPlatformMaterialization(source)

  if (
    materialization === 'hidden-on-hit' ||
    materialization === 'switch-on' ||
    materialization === 'switch-off'
  ) {
    return false
  }

  if (materialization !== 'blink-normal') {
    return true
  }

  const phase = (elapsedSeconds + getMotionPhase(source) * 0.08) % 2.8

  return phase < 1.9
}

export function getPlatformMovementMode(source: AssetRuleSource): PlatformMovementMode {
  if (source.assetCategory !== 'platform') {
    return 'fixed'
  }

  const movementMode = stringAttr(source.assetAttrs, 'movementMode')

  if (
    movementMode === 'patrol-normal' ||
    movementMode === 'start-on-step' ||
    movementMode === 'step-one-way'
  ) {
    return movementMode
  }

  return 'fixed'
}

export function isDynamicPlatform(source: AssetRuleSource) {
  return (
    getPlatformMaterialization(source) === 'hidden-on-hit' ||
    getPlatformMaterialization(source) === 'blink-normal' ||
    getPlatformMovementMode(source) !== 'fixed' ||
    getPlatformContactReaction(source) !== 'none'
  )
}

export function getPlatformMotionOffset(
  source: AssetRuleSource,
  elapsedSeconds: number,
  cellPx: number,
  isStepTriggered = false,
) {
  const movementMode = getPlatformMovementMode(source)

  if (movementMode === 'fixed') {
    return { x: 0, y: 0 }
  }

  if ((movementMode === 'start-on-step' || movementMode === 'step-one-way') && !isStepTriggered) {
    return { x: 0, y: 0 }
  }

  const phase = getMotionPhase(source)

  if (movementMode === 'step-one-way') {
    return {
      x: Math.min(elapsedSeconds * cellPx * 1.15, cellPx * 4),
      y: 0,
    }
  }

  return {
    x: Math.sin(elapsedSeconds * 1.05 + phase) * cellPx * 1.45,
    y: Math.sin(elapsedSeconds * 0.82 + phase) * cellPx * 0.28,
  }
}

export function getItemEffect(source: AssetRuleSource): ItemEffect {
  if (source.assetCategory !== 'item') {
    return 'none'
  }

  const effect = stringAttr(source.assetAttrs, 'effect')

  if (effect === 'speed-boost' || effect === 'giant-mushroom' || effect === 'toggle-switch') {
    return effect
  }

  return 'none'
}

export function getObstacleContactEffect(source: AssetRuleSource): ObstacleContactEffect {
  if (source.assetCategory !== 'obstacle') {
    return 'none'
  }

  const contactEffect = stringAttr(source.assetAttrs, 'contactEffect')

  if (
    contactEffect === 'instant-death' ||
    contactEffect === 'knockback-high' ||
    contactEffect === 'updraft'
  ) {
    return contactEffect
  }

  return 'damage'
}

export function getObstacleHitSurface(source: AssetRuleSource): ObstacleHitSurface {
  if (source.assetCategory !== 'obstacle') {
    return 'all'
  }

  const hitSurface = stringAttr(source.assetAttrs, 'hitSurface')

  if (hitSurface === 'top-safe' || hitSurface === 'bottom-only') {
    return hitSurface
  }

  return 'all'
}

export function getObstacleTriggerMode(source: AssetRuleSource): ObstacleTriggerMode {
  if (source.assetCategory !== 'obstacle') {
    return 'always'
  }

  const triggerMode = stringAttr(source.assetAttrs, 'triggerMode')

  if (
    triggerMode === 'cycle-normal' ||
    triggerMode === 'proximity-x' ||
    triggerMode === 'proximity-y' ||
    triggerMode === 'proximity-radius'
  ) {
    return triggerMode
  }

  return 'always'
}

export function getObstacleActionMode(source: AssetRuleSource): ObstacleActionMode {
  if (source.assetCategory !== 'obstacle') {
    return 'fixed'
  }

  const actionMode = stringAttr(source.assetAttrs, 'actionMode')

  if (
    actionMode === 'rotate-normal' ||
    actionMode === 'swing' ||
    actionMode === 'patrol-normal' ||
    actionMode === 'charge-down'
  ) {
    return actionMode
  }

  return 'fixed'
}

export function getObstacleProjectileMode(source: AssetRuleSource): ObstacleProjectileMode {
  if (source.assetCategory !== 'obstacle') {
    return 'none'
  }

  const projectile = stringAttr(source.assetAttrs, 'projectile')

  if (projectile === 'straight-normal' || projectile === 'homing-normal') {
    return projectile
  }

  return 'none'
}

export function isObstacleActive(source: AssetRuleSource, elapsedSeconds: number) {
  if (getObstacleTriggerMode(source) !== 'cycle-normal') {
    return true
  }

  const phase = (elapsedSeconds + getMotionPhase(source) * 0.1) % 3.2

  return phase < 2
}

export function isProximityObstacle(source: AssetRuleSource) {
  const triggerMode = getObstacleTriggerMode(source)

  return (
    triggerMode === 'proximity-x' ||
    triggerMode === 'proximity-y' ||
    triggerMode === 'proximity-radius'
  )
}

export function isDynamicObstacle(source: AssetRuleSource) {
  return (
    getObstacleTriggerMode(source) === 'cycle-normal' ||
    isProximityObstacle(source) ||
    getObstacleActionMode(source) !== 'fixed' ||
    getObstacleProjectileMode(source) !== 'none'
  )
}

export function getObstacleMotionOffset(
  source: AssetRuleSource,
  elapsedSeconds: number,
  cellPx: number,
) {
  const actionMode = getObstacleActionMode(source)

  if (actionMode === 'fixed') {
    return { x: 0, y: 0 }
  }

  const phase = getMotionPhase(source)

  if (actionMode === 'rotate-normal') {
    return {
      x: Math.cos(elapsedSeconds * 1.8 + phase) * cellPx * 0.7,
      y: Math.sin(elapsedSeconds * 1.8 + phase) * cellPx * 0.7,
    }
  }

  if (actionMode === 'swing') {
    const swing = Math.sin(elapsedSeconds * 1.45 + phase)

    return {
      x: swing * cellPx * 1.15,
      y: Math.abs(swing) * cellPx * 0.32,
    }
  }

  if (actionMode === 'patrol-normal') {
    return {
      x: Math.sin(elapsedSeconds * 1.15 + phase) * cellPx * 1.35,
      y: 0,
    }
  }

  const chargePhase = (elapsedSeconds + phase * 0.08) % 3.4

  if (chargePhase < 0.35) {
    return { x: 0, y: (chargePhase / 0.35) * cellPx * 1.7 }
  }

  if (chargePhase < 1.25) {
    return { x: 0, y: cellPx * 1.7 }
  }

  if (chargePhase < 2) {
    return { x: 0, y: (1 - (chargePhase - 1.25) / 0.75) * cellPx * 1.7 }
  }

  return { x: 0, y: 0 }
}

export function getMonsterStompReaction(source: AssetRuleSource): MonsterStompReaction {
  if (source.assetCategory !== 'monster') {
    return 'harmful'
  }

  const stompReaction = stringAttr(source.assetAttrs, 'stompReaction')

  if (
    stompReaction === 'stun-normal' ||
    stompReaction === 'harmful' ||
    stompReaction === 'trampoline'
  ) {
    return stompReaction
  }

  return 'kill'
}

export function getMonsterHealth(source: AssetRuleSource) {
  if (source.assetCategory !== 'monster') {
    return 1
  }

  const health =
    stringAttr(source.assetAttrs, 'health') || stringAttr(source.assetAttrs, 'hpPreset')

  if (health === '2') {
    return 2
  }

  if (health === '3') {
    return 3
  }

  return 1
}

export function getMonsterMoveType(source: AssetRuleSource): MonsterMoveType {
  if (source.assetCategory !== 'monster') {
    return 'static'
  }

  const moveType = stringAttr(source.assetAttrs, 'moveType')

  if (
    moveType === 'ground-walk-normal' ||
    moveType === 'surface-crawl' ||
    moveType === 'flying'
  ) {
    return moveType
  }

  return 'static'
}

export function getMonsterTrackingMode(source: AssetRuleSource): MonsterTrackingMode {
  if (source.assetCategory !== 'monster') {
    return 'none'
  }

  const tracking = stringAttr(source.assetAttrs, 'tracking')

  if (
    tracking === 'near' ||
    tracking === 'always' ||
    tracking === 'gaze-freeze' ||
    tracking === 'jump-sync'
  ) {
    return tracking
  }

  return 'none'
}

export function getMonsterLedgeBehavior(source: AssetRuleSource): MonsterLedgeBehavior {
  if (source.assetCategory !== 'monster') {
    return 'fall'
  }

  const ledgeBehavior =
    stringAttr(source.assetAttrs, 'ledgeBehavior') || stringAttr(source.assetAttrs, 'cliffReaction')

  if (ledgeBehavior === 'turn') {
    return 'turn'
  }

  return 'fall'
}

export function isMovingMonster(source: AssetRuleSource) {
  return getMonsterMoveType(source) !== 'static'
}

export function isDynamicMonster(source: AssetRuleSource) {
  return isMovingMonster(source) || getMonsterTrackingMode(source) !== 'none'
}

export function getMonsterMotionOffset(
  source: AssetRuleSource,
  elapsedSeconds: number,
  cellPx: number,
) {
  const moveType = getMonsterMoveType(source)

  if (moveType === 'static') {
    return { x: 0, y: 0 }
  }

  const phase = getMotionPhase(source)

  if (moveType === 'flying') {
    return {
      x: Math.sin(elapsedSeconds * 1.25 + phase) * cellPx * 0.55,
      y: Math.cos(elapsedSeconds * 1.7 + phase) * cellPx * 0.65,
    }
  }

  if (moveType === 'surface-crawl') {
    return {
      x: Math.sin(elapsedSeconds * 1.05 + phase) * cellPx * 0.75,
      y: Math.cos(elapsedSeconds * 1.05 + phase) * cellPx * 0.22,
    }
  }

  if (getMonsterLedgeBehavior(source) === 'fall') {
    const fallCycle = (elapsedSeconds + phase * 0.18) % 3.4

    if (fallCycle < 1.65) {
      return {
        x: (fallCycle / 1.65) * cellPx * 1.6 - cellPx * 0.35,
        y: 0,
      }
    }

    if (fallCycle < 2.85) {
      const fallProgress = (fallCycle - 1.65) / 1.2

      return {
        x: cellPx * 1.25,
        y: fallProgress * fallProgress * cellPx * 3.4,
      }
    }

    return {
      x: -cellPx * 0.35,
      y: 0,
    }
  }

  return {
    x: Math.sin(elapsedSeconds * 1.35 + phase) * cellPx,
    y: 0,
  }
}

function getMotionPhase(source: AssetRuleSource) {
  const key = `${source.assetId}:${source.sourceSegmentId ?? ''}:${source.x ?? 0}:${source.y ?? 0}`
  let hash = 0

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 997
  }

  return (hash / 997) * Math.PI * 2
}

function stringAttr(attrs: Asset['attrs'] | undefined, key: string) {
  const value = attrs?.[key]

  return typeof value === 'string' ? value : ''
}

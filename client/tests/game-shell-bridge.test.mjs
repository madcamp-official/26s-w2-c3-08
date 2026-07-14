import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const appSource = read('client/src/app/AppV2.tsx')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const bridgeSource = read('client/src/pages/game/PhaserBridge.tsx')
const bridgeCssSource = read('client/src/pages/game/PhaserBridge.module.css')
const gameHudSource = read('client/src/pages/game/GameHud.tsx')
const screensSource = read('client/src/pages/game/GameScreens.tsx')
const controllerSource = read('client/src/pages/game/GamePhaseController.tsx')
const coreSource = read('client/src/pages/game/gameControllerCore.ts')
const hookSource = read('client/src/pages/game/useGamePhaseController.ts')
const infrastructureBridgeSource = read('client/src/infrastructure/phaser/phaserCanvasBridges.tsx')
const mockGameRoomPortSource = read('client/src/infrastructure/game/mockGameRoomPort.ts')
const remoteGameRoomPortSource = read('client/src/infrastructure/game/remoteGameRoomPort.ts')
const fixturesSource = read('client/src/fixtures/game/gameFixtures.ts')
const stateGallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const stateGalleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const packageSource = read('client/package.json')

for (const filePath of [
  'client/src/game/MapEditorCanvas.tsx',
  'client/src/game/PlaytestCanvas.tsx',
  'client/src/game/RaceCanvas.tsx',
  'client/src/pages/game/PhaserBridge.tsx',
  'client/src/pages/game/GameScreens.tsx',
  'client/src/pages/game/GamePhaseController.tsx',
  'client/src/pages/game/gameControllerCore.ts',
  'client/src/pages/game/useGamePhaseController.ts',
  'client/src/infrastructure/game/mockGameRoomPort.ts',
  'client/src/infrastructure/game/remoteGameRoomPort.ts',
  'client/src/infrastructure/phaser/phaserCanvasBridges.tsx',
]) {
  assert.equal(statSync(join(repoRoot, filePath)).isFile(), true)
}

assert.match(bridgeSource, /const activeBridgeIds = new Set<string>\(\)/)
assert.match(bridgeSource, /duplicate-prevented/)
assert.match(bridgeSource, /ResizeObserver/)
assert.match(bridgeSource, /window\.addEventListener\('resize'/)
assert.match(bridgeSource, /window\.removeEventListener\('resize'/)
assert.match(bridgeSource, /activeBridgeIds\.delete\(bridgeId\)/)
assert.match(bridgeSource, /data-v2-component="phaser-bridge"/)
assert.match(bridgeSource, /data-v2-phaser-kind=\{kind\}/)
assert.match(bridgeSource, /data-v2-route-key=\{routeKey\}/)
assert.match(bridgeCssSource, /\.canvasFrame/)
assert.match(bridgeCssSource, /:global\(canvas\)/)

assert.match(infrastructureBridgeSource, /lazy\(\(\) => import\('\.\.\/\.\.\/game\/MapEditorCanvas'\)\)/)
assert.match(infrastructureBridgeSource, /lazy\(\(\) => import\('\.\.\/\.\.\/game\/PlaytestCanvas'\)\)/)
assert.match(infrastructureBridgeSource, /lazy\(\(\) => import\('\.\.\/\.\.\/game\/RaceCanvas'\)\)/)
assert.match(infrastructureBridgeSource, /export interface MapEditorBridgeProps/)
assert.match(infrastructureBridgeSource, /export interface PlaytestBridgeProps/)
assert.match(infrastructureBridgeSource, /export interface RaceBridgeProps/)
assert.doesNotMatch(screensSource, /\.\.\/\.\.\/game\/(?:MapEditorCanvas|PlaytestCanvas|RaceCanvas)/)

for (const screenId of ['S4_MAP_BUILD', 'D_VALIDATION', 'M_MERGING', 'E_RACE', 'F_RESULTS']) {
  assert.match(fixturesSource, new RegExp(screenId))
  assert.match(screensSource, new RegExp(`data-v2-screen="${screenId.toLowerCase().replaceAll('_', '-')}"`))
}

for (const routeKind of ['mapBuild', 'validation', 'merging', 'race', 'results']) {
  assert.match(routerSource, new RegExp(`kind: '${routeKind}'`))
}

for (const routePath of ['map-build', 'validation', 'merging', 'race', 'results']) {
  assert.match(routerSource, new RegExp(`path: '${routePath}'`))
}

assert.match(appSource, /<GamePhaseController routeState=\{route\.contractRoute\} \/>/)
assert.doesNotMatch(appSource, /fixtureId=\{route\.query\.case\}/)
assert.match(controllerSource, /useGamePhaseController/)
assert.match(controllerSource, /createGamePhaseControllerDependencies/)
assert.match(controllerSource, /createMockGameRoomPort/)
assert.match(controllerSource, /createRemoteGameRoomPort/)
assert.match(controllerSource, /createV2RealtimeAdapters/)
assert.doesNotMatch(controllerSource, /return <GameFixturePreview fixture=\{fixture\}/)
assert.match(controllerSource, /MapEditorPhaserBridge/)
assert.match(controllerSource, /PlaytestPhaserBridge/)
assert.match(controllerSource, /RacePhaserBridge/)
assert.match(controllerSource, /setPrototypeRoute\('results'/)
assert.match(controllerSource, /setPrototypeRoute\('room'/)
assert.match(controllerSource, /setPrototypeRoute\('lobby'/)

assert.match(coreSource, /export interface GameRoomPort/)
assert.match(coreSource, /export interface GameRoomSnapshot/)
assert.match(coreSource, /getRoomSnapshot/)
assert.match(coreSource, /saveMapSegment/)
assert.match(coreSource, /SaveGameMapSegmentValue/)
assert.match(coreSource, /result\.value\.roomPhase === 'validating'/)
assert.match(coreSource, /다른 플레이어의 제출을 기다립니다/)
assert.match(coreSource, /getMapSegment/)
assert.match(coreSource, /validateMapSegment/)
assert.match(coreSource, /ValidateGameMapSegmentValue/)
assert.match(coreSource, /roomPhase\?: RoomPhase/)
assert.match(coreSource, /result\.value\.roomPhase === 'merging'/)
assert.match(coreSource, /mergeRoomMap/)
assert.match(coreSource, /getMergedMap/)
assert.match(coreSource, /saveRaceProgress/)
assert.match(coreSource, /finishRace/)
assert.match(coreSource, /GameRaceResultValue/)
assert.match(coreSource, /result\.value\.roomPhase === 'finished'/)
assert.match(coreSource, /다른 플레이어를 기다립니다/)
assert.match(coreSource, /getRaceResults/)
assert.match(coreSource, /loadGameRaceResults/)
assert.match(coreSource, /loadGameRoomSnapshot/)
assert.match(coreSource, /loadGameMergedMap/)
assert.match(coreSource, /loadGameMapSegment/)
assert.match(coreSource, /bootGamePhaseController/)
assert.match(coreSource, /handleGameMapCell/)
assert.match(coreSource, /dropGameMapAsset/)
assert.match(coreSource, /canPlaceMapAsset/)
assert.match(coreSource, /submitGameMapBuild/)
assert.match(coreSource, /recordGameValidation/)
assert.match(coreSource, /finishGameRace/)
assert.match(coreSource, /applyGameRoomSnapshot/)
assert.match(coreSource, /routeToPhase/)
assert.match(coreSource, /roomPort\.saveRaceProgress/)
assert.match(hookSource, /bootGamePhaseController/)
assert.match(hookSource, /handleGameMapCell/)
assert.match(hookSource, /dropGameMapAsset/)
assert.match(hookSource, /submitGameMapBuild/)
assert.match(hookSource, /recordGameValidation/)
assert.match(hookSource, /mergeGameRoomMap/)
assert.match(hookSource, /finishGameRace/)
assert.match(hookSource, /createRouteSyncedGameState/)
assert.match(hookSource, /preservedSegment/)
assert.match(hookSource, /preservedMergedMap/)
assert.match(hookSource, /nextState\.segmentId = preservedSegment\.id/)
assert.match(hookSource, /routeState\.mergedMapId/)
assert.match(hookSource, /nextState\.mergedMap = preservedMergedMap/)
assert.match(hookSource, /nextState\.mergedMapId = preservedMergedMap\.id/)
assert.match(controllerSource, /onToggleCell=\{actions\.handleMapCell\}/)
assert.match(controllerSource, /onDropAsset=\{actions\.dropMapAsset\}/)
assert.doesNotMatch(controllerSource, /onToggleCell=\{\(\) => undefined\}/)
assert.doesNotMatch(controllerSource, /onDropAsset=\{\(\) => undefined\}/)
assert.match(mockGameRoomPortSource, /relay\.mock\.game-room/)
assert.match(mockGameRoomPortSource, /schemaVersion: 'mock-game-room-v1'/)
assert.match(mockGameRoomPortSource, /getRoomSnapshot/)
assert.match(mockGameRoomPortSource, /createRoomSnapshot/)
assert.match(mockGameRoomPortSource, /inferMockRoomPhase/)
assert.match(mockGameRoomPortSource, /roomPhase: isRaceComplete\(result\) \? 'finished' : 'racing'/)
assert.match(controllerSource, /navigateMapBuild: \(roomId\) => setPrototypeRoute\('map-build'/)
assert.match(remoteGameRoomPortSource, /\/api\/rooms\/\$\{encodeURIComponent\(roomId\)\}/)
assert.match(remoteGameRoomPortSource, /normalizeRoomSnapshot/)
assert.match(remoteGameRoomPortSource, /\/api\/rooms\/\$\{encodeURIComponent\(payload\.roomId\)\}\/segments/)
assert.match(remoteGameRoomPortSource, /\/segments\/\$\{encodeURIComponent\(segmentId\)\}/)
assert.match(remoteGameRoomPortSource, /roomPhase: normalizeRoomPhase\(response\.value\)/)
assert.match(remoteGameRoomPortSource, /\/segments\/validate/)
assert.match(remoteGameRoomPortSource, /normalizeRoomPhase/)
assert.match(remoteGameRoomPortSource, /roomPhase: normalizeRoomPhase\(response\.value\)/)
assert.match(remoteGameRoomPortSource, /\/segments\/validate[\s\S]*roomPhase: normalizeRoomPhase\(response\.value\)/)
assert.match(remoteGameRoomPortSource, /\/merge/)
assert.match(remoteGameRoomPortSource, /\/merged-map/)
assert.match(remoteGameRoomPortSource, /\/race\/progress/)
assert.match(remoteGameRoomPortSource, /\/race\/finish/)
assert.match(remoteGameRoomPortSource, /\/results/)
assert.match(remoteGameRoomPortSource, /roomPhase: normalizeRoomPhase\(body\)/)
assert.doesNotMatch(remoteGameRoomPortSource, /createMock|Mock fallback|relay\.mock/i)

assert.match(gameHudSource, /export function HUDTimer/)
assert.match(gameHudSource, /export function BudgetMeter/)
assert.match(gameHudSource, /export function RaceRanking/)
assert.match(gameHudSource, /export function ResultsRow/)
assert.match(gameHudSource, /role="timer"/)
assert.match(screensSource, /role="status"/)
assert.match(screensSource, /aria-live="polite"/)

assert.match(stateGalleryFixturesSource, /gameScreenFixtures/)
assert.match(stateGallerySource, /GameFixturePreview/)
assert.match(packageSource, /game:check/)

for (const source of [screensSource, controllerSource]) {
  assert.doesNotMatch(source, /\/api\/|socket|BroadcastChannel|localStorage|zustand/i)
}

assert.match(fixturesSource, /s4-map-build-editing/)
assert.match(fixturesSource, /d-validation-playing/)
assert.match(fixturesSource, /m-merging-progress/)
assert.match(fixturesSource, /e-race-normal/)
assert.match(fixturesSource, /f-results-winner/)

console.log('game shell bridge contract self-test passed')

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

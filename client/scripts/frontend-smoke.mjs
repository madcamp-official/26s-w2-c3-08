import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const clientRoot = join(scriptDir, '..')
const checks = []

function read(relativePath) {
  return readFileSync(join(clientRoot, relativePath), 'utf8')
}

function addCheck(label, predicate) {
  checks.push({ label, predicate })
}

function fileExists(relativePath) {
  return existsSync(join(clientRoot, relativePath))
}

function fileHasContent(relativePath) {
  const filePath = join(clientRoot, relativePath)
  return existsSync(filePath) && statSync(filePath).size > 0
}

function includesAll(source, snippets) {
  return snippets.every((snippet) => source.includes(snippet))
}

const packageJson = JSON.parse(read('package.json'))
const indexHtml = read('index.html')
const app = read('src/App.tsx')
const main = read('src/main.tsx')
const api = read('src/net/api.ts')
const realtime = read('src/net/realtime.ts')
const store = read('src/store/appStore.ts')
const avatarCreator = read('src/components/AvatarCreator.tsx')
const viteConfig = read('vite.config.ts')
const mapEditor = read('src/game/MapEditorCanvas.tsx')
const playtest = read('src/game/PlaytestCanvas.tsx')
const race = read('src/game/RaceCanvas.tsx')

addCheck('required runtime dependencies are installed', () =>
  ['@colyseus/sdk', 'phaser', 'react', 'react-dom', 'react-sketch-canvas', 'zustand'].every(
    (dependencyName) => dependencyName in packageJson.dependencies,
  ),
)

addCheck('boot HTML has branded fallback and app entry', () =>
  includesAll(indexHtml, ['Mad Mario Relay Map Maker', 'boot-screen', '앱을 불러오는 중', '/src/main.tsx']),
)

addCheck('root app entry renders V2 product frontend', () =>
  includesAll(main, ['AppV2', 'chrome="product"', './styles/globals.css']) &&
  !main.includes("from './App.tsx'"),
)

addCheck('domain and LAN Vite server settings are present', () =>
  includesAll(viteConfig, ['0.0.0.0', '5174', 'mad-mario.madcamp-kaist.org', '192.168.0.200']),
)

addCheck('AvatarCreator preserves silhouette export contract', () =>
  includesAll(avatarCreator, [
    "url('/guide-silhouette.png')",
    "const EXPORT_RENDER_DELAY_MS = 100",
    "const EXPORT_CANVAS_COLOR = '#FFFFFF'",
    "setCanvasBackgroundColor(EXPORT_CANVAS_COLOR)",
    "exportImage('png'",
    'exportWithBackgroundImage={false}',
    "fetch('/api/assets/generate'",
  ]),
)

addCheck('guide silhouette asset exists', () => fileHasContent('public/guide-silhouette.png'))

addCheck('core React screens exist', () =>
  includesAll(app, [
    'function LoginScreen()',
    'function AvatarStudio()',
    'function AssetStudio()',
    'function Warehouse()',
    'function Lobby()',
    'function RoomFlow()',
    'function MapBuildPhase',
    'function ValidationPhase',
    'function RacePhase',
    'function ResultsPhase',
    'function SettingsModal()',
  ]),
)

addCheck('studio tools match screen-design essentials', () =>
  includesAll(app, [
    "type SketchTool = 'pen' | 'eraser' | 'eyedropper' | 'move'",
    'recentColors',
    'checkerTone',
    'onPasteCapture={handlePaste}',
    'exportWithBackgroundImage={false}',
    'composeSketchImage',
    'scaleCanvasPaths',
  ]),
)

addCheck('warehouse and generation states are represented', () =>
  includesAll(app, [
    'function Warehouse()',
    'function AssetReviewModal',
    'function AssetProgress',
    'requestSpriteRegeneration',
    'getCooldownRemaining',
    'statusLabel',
  ]),
)

addCheck('lobby and room MVP flow is represented', () =>
  includesAll(app, [
    'enterPublicRoom',
    'privateJoinPassword',
    'RoomLobbyPhase',
    'toggleLobbyReady',
    'advanceRoomPhase',
  ]),
)

addCheck('map editor includes grid, time vote, locking, testing', () =>
  includesAll(app, [
    '32x32 그리드 스냅',
    'BUILD_PLACEMENT_BUDGET',
    'MAX_ENDPOINT_VERTICAL_DELTA',
    'requestTimeVote',
    '+15s',
    '-15s',
    'isBuildLocked',
    'BuildTestModal',
  ]),
)

addCheck('validation, merge, race and results rules are present', () =>
  includesAll(app, [
    'validateCurrentSegment',
    'mergeCurrentRoomMap',
    '15초 freeze',
    '30초 연장',
    'rankRacePlayers',
    'raceDistanceToGoal',
  ]),
)

addCheck('Phaser canvases are present', () =>
  [mapEditor, playtest, race].every((source) => source.includes("import * as Phaser from 'phaser'")),
)

addCheck('API defaults to mock unless explicitly enabled', () =>
  includesAll(api, [
    "const REMOTE_API_ENABLED = viteEnv.VITE_REMOTE_API === 'true'",
    'getMockAssets()',
    'getMockRooms()',
    'writeStorage',
    'readStorage',
  ]),
)

addCheck('local realtime fallback is available by default', () =>
  includesAll(realtime, [
    "VITE_LOCAL_REALTIME !== 'false'",
    'BroadcastChannel',
    'setupLocalRealtime',
    'joinLocalRealtimeRoom',
    'emitLocalRealtime',
  ]),
)

addCheck('store contains fallback map, merge, validation and race state', () =>
  includesAll(store, [
    'buildFallbackSegment',
    'buildMergedMap',
    'validateCurrentSegment',
    'requestTimeVote',
    'recordRaceFinish',
    'broadcastRacePosition',
  ]),
)

addCheck('required frontend files exist', () =>
  [
    'src/types/domain.ts',
    'src/utils/id.ts',
    'src/components/AppErrorBoundary.tsx',
    'src/game/assetRules.ts',
    'FRONTEND_IMPLEMENTATION.md',
  ].every(fileExists),
)

const failedChecks = checks.filter((check) => !check.predicate())

if (failedChecks.length > 0) {
  console.error('Frontend smoke checks failed:')
  failedChecks.forEach((check) => console.error(`- ${check.label}`))
  process.exit(1)
}

console.log(`Frontend smoke checks passed (${checks.length}/${checks.length})`)

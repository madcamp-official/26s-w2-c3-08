import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const router = await importTypeScriptModule(routerSource)

testRoomScopedRoutesRequireRoomId(router)
testRouteContractsWithRoomId(router)
testNavigationDoesNotOpenRoomScopedProductionRoutes(router)

assert.doesNotMatch(routerSource, /roomId: query\.roomId \?\? ['"]mock-room-public-open['"]/)
assert.match(routerSource, /readRequiredQueryParam/)

console.log('prototype router contract self-test passed')

function testRoomScopedRoutesRequireRoomId({ parsePrototypeHash }) {
  for (const path of ['room', 'map-build', 'validation', 'merging', 'race', 'results']) {
    const route = parsePrototypeHash(`#/${path}`)

    assert.equal(route.kind, 'notFound', `${path} without roomId must be NotFound`)
    assert.equal(route.requestedPath, path)
  }
}

function testRouteContractsWithRoomId({ parsePrototypeHash, getPrototypeHref }) {
  const room = parsePrototypeHash('#/room?roomId=room-flow')
  assert.equal(room.kind, 'room')
  assert.equal(room.contractRoute.roomId, 'room-flow')

  const mapBuild = parsePrototypeHash('#/map-build?roomId=room-flow')
  assert.equal(mapBuild.kind, 'mapBuild')
  assert.equal(mapBuild.contractRoute.roomId, 'room-flow')

  const validation = parsePrototypeHash('#/validation?roomId=room-flow&segmentId=segment-flow')
  assert.equal(validation.kind, 'validation')
  assert.equal(validation.contractRoute.roomId, 'room-flow')
  assert.equal(validation.contractRoute.segmentId, 'segment-flow')

  const race = parsePrototypeHash('#/race?roomId=room-flow&mergedMapId=merged-flow')
  assert.equal(race.kind, 'race')
  assert.equal(race.contractRoute.roomId, 'room-flow')
  assert.equal(race.contractRoute.mergedMapId, 'merged-flow')

  assert.equal(getPrototypeHref('room', { roomId: 'room-flow' }), '#/room?roomId=room-flow')
}

function testNavigationDoesNotOpenRoomScopedProductionRoutes({ prototypeNavItems }) {
  const navPaths = prototypeNavItems.map((item) => item.path)

  for (const path of ['room', 'map-build', 'validation', 'merging', 'race', 'results']) {
    assert.equal(navPaths.includes(path), false, `${path} must be reached by flow callback, not top nav`)
  }
}

async function importTypeScriptModule(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText
  const encoded = Buffer.from(output, 'utf8').toString('base64')

  return import(`data:text/javascript;base64,${encoded}`)
}

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

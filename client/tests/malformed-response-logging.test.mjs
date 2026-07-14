import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const helperSource = read('client/src/infrastructure/diagnostics/malformedResponseLogger.ts')
const remoteSessionSource = read('client/src/infrastructure/session/remoteSessionPort.ts')

const { sanitizeEndpoint, sanitizeLogValue } = await importTypeScriptModule(helperSource)
const { createRemoteSessionPort } = await importTypeScriptModule(remoteSessionSource)

await testEndpointSanitization()
await testBodyRedaction()
await testRemoteSessionMalformedResponseLogging()
await testRemoteMalformedBranchesUseDiagnostics()

console.log('malformed response diagnostics self-test passed')

async function testEndpointSanitization() {
  assert.equal(
    sanitizeEndpoint('https://api.test/api/session/validate?token=secret&room_id=room-a#debug'),
    'https://api.test/api/session/validate',
  )
  assert.equal(
    sanitizeEndpoint('/api/asset-jobs?user_id=user-a&authorization=Bearer%20secret'),
    '/api/asset-jobs',
  )
}

async function testBodyRedaction() {
  const sanitized = sanitizeLogValue({
    token: 'secret-token',
    authorization: 'Bearer secret',
    visible: 'safe value',
    nested: {
      password: 'secret-password',
      keep: 'visible nested value',
    },
    list: [
      {
        api_key: 'secret-api-key',
        name: 'visible item',
      },
    ],
  })

  assert.equal(sanitized.token, '[redacted]')
  assert.equal(sanitized.authorization, '[redacted]')
  assert.equal(sanitized.visible, 'safe value')
  assert.equal(sanitized.nested.password, '[redacted]')
  assert.equal(sanitized.nested.keep, 'visible nested value')
  assert.equal(sanitized.list[0].api_key, '[redacted]')
  assert.equal(sanitized.list[0].name, 'visible item')
}

async function testRemoteSessionMalformedResponseLogging() {
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message, details) => {
    warnings.push({ message, details })
  }

  try {
    const port = createRemoteSessionPort({
      baseUrl: 'https://api.test',
      async fetcher() {
        return new Response(JSON.stringify({
          token: 'secret-token',
          user: {
            password: 'secret-password',
            nickname: '릴레이러',
          },
        }))
      },
    })

    const result = await port.createSession('릴레이러')

    assert.equal(result.ok, false)
    assert.equal(result.error.kind, 'malformed_response')
    assert.equal(warnings.length, 1)
    assert.equal(warnings[0].message, '[frontend-v2] malformed response')
    assert.equal(warnings[0].details.adapter, 'remoteSessionPort')
    assert.equal(warnings[0].details.operation, 'session.create')
    assert.equal(warnings[0].details.reason, 'unexpected_shape')
    assert.equal(warnings[0].details.endpoint, 'https://api.test/api/session')
    assert.doesNotMatch(JSON.stringify(warnings[0]), /secret-token|secret-password/)
    assert.equal(warnings[0].details.body.token, '[redacted]')
    assert.equal(warnings[0].details.body.user.password, '[redacted]')
  } finally {
    console.warn = originalWarn
  }
}

async function testRemoteMalformedBranchesUseDiagnostics() {
  const remoteFiles = [
    'client/src/infrastructure/session/remoteSessionPort.ts',
    'client/src/infrastructure/main/remoteAssetPort.ts',
    'client/src/infrastructure/settings/remoteMainSessionPort.ts',
    'client/src/infrastructure/settings/remoteDeviceLinkPort.ts',
    'client/src/infrastructure/warehouse/remoteWarehouseAssetPort.ts',
    'client/src/infrastructure/warehouse/remoteAssetJobUpdates.ts',
    'client/src/infrastructure/avatar-studio/remoteAvatarStudioAssetPort.ts',
    'client/src/infrastructure/asset-studio/remoteAssetStudioAssetPort.ts',
    'client/src/infrastructure/rooms/remoteRoomPort.ts',
    'client/src/infrastructure/game/remoteGameRoomPort.ts',
  ]

  for (const file of remoteFiles) {
    const source = read(file)

    assert.match(source, /malformed_response/, `${file} should surface malformed_response`)
    assert.match(source, /logMalformedResponse/, `${file} should log malformed responses`)
  }
}

async function importTypeScriptModule(source) {
  const output = transpileTypeScript(inlineDiagnosticsImport(source))
  const encoded = Buffer.from(output, 'utf8').toString('base64')

  return import(`data:text/javascript;base64,${encoded}`)
}

function inlineDiagnosticsImport(source) {
  if (!source.includes('malformedResponseLogger')) {
    return source
  }

  const helperUrl = toTypeScriptModuleUrl(helperSource)

  return source.replace(
    /import\s*\{\s*logMalformedResponse,\s*type\s+MalformedResponseReason,\s*\}\s*from\s*['"][^'"]*malformedResponseLogger['"]/g,
    `import { logMalformedResponse } from '${helperUrl}'\ntype MalformedResponseReason = 'invalid_json' | 'unexpected_shape'`,
  )
}

function toTypeScriptModuleUrl(source) {
  const output = transpileTypeScript(source)
  const encoded = Buffer.from(output, 'utf8').toString('base64')

  return `data:text/javascript;base64,${encoded}`
}

function transpileTypeScript(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText
}

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const SERVICE_NAMES = new Set(['client', 'backend', 'gpu-worker'])
const PLACEHOLDER_FRAGMENTS = [
  '<real',
  '<replace',
  'replace-with',
  'changeme',
  'change-me',
  'placeholder',
  'dummy',
  'example',
  'todo',
  'your-',
]
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

const options = parseArgs(process.argv.slice(2))

if (options.help) {
  printHelp()
} else if (options.selfTest) {
  runSelfTest()
} else {
  const result = checkProductionEnv(options)
  printResult(result)
  process.exitCode = result.failures.length > 0 ? 1 : 0
}

function parseArgs(args) {
  const parsed = {
    services: new Set(),
    envFile: null,
    serviceEnvFiles: new Map(),
    selfTest: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
      continue
    }

    if (arg === '--self-test') {
      parsed.selfTest = true
      continue
    }

    if (arg === '--service') {
      const service = readOptionValue(args, index, arg)
      index += 1
      addService(parsed.services, service)
      continue
    }

    if (arg.startsWith('--service=')) {
      addService(parsed.services, arg.slice('--service='.length))
      continue
    }

    if (arg === '--env-file') {
      parsed.envFile = readOptionValue(args, index, arg)
      index += 1
      continue
    }

    if (arg.startsWith('--env-file=')) {
      parsed.envFile = arg.slice('--env-file='.length)
      continue
    }

    const serviceEnvMatch = arg.match(/^--(client|backend|gpu-worker)-env-file(?:=(.*))?$/)
    if (serviceEnvMatch) {
      const service = serviceEnvMatch[1]
      const value = serviceEnvMatch[2] ?? readOptionValue(args, index, arg)
      if (serviceEnvMatch[2] === undefined) {
        index += 1
      }
      parsed.serviceEnvFiles.set(service, value)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  if (parsed.services.size === 0) {
    parsed.services = new Set(SERVICE_NAMES)
  }

  return parsed
}

function readOptionValue(args, index, name) {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`)
  }
  return value
}

function addService(services, value) {
  const normalized = value.trim()

  if (normalized === 'all') {
    for (const service of SERVICE_NAMES) {
      services.add(service)
    }
    return
  }

  if (!SERVICE_NAMES.has(normalized)) {
    throw new Error(`Unknown service: ${value}`)
  }

  services.add(normalized)
}

function checkProductionEnv(checkOptions = {}) {
  const selectedServices = checkOptions.services ?? new Set(SERVICE_NAMES)
  const sharedEnv = loadEnv(process.env, checkOptions.envFile)
  const serviceEnvs = new Map()
  const checks = []
  const failures = []
  const warnings = []

  for (const service of selectedServices) {
    const serviceEnvFile = checkOptions.serviceEnvFiles?.get(service) ?? null
    serviceEnvs.set(service, loadEnv(sharedEnv, serviceEnvFile))
  }

  if (selectedServices.has('client')) {
    validateClient(serviceEnvs.get('client'), checks, failures, warnings)
  }

  if (selectedServices.has('backend')) {
    validateBackend(serviceEnvs.get('backend'), checks, failures, warnings)
  }

  if (selectedServices.has('gpu-worker')) {
    validateGpuWorker(serviceEnvs.get('gpu-worker'), checks, failures, warnings)
  }

  validateCrossService(selectedServices, serviceEnvs, checks, failures, warnings)

  return {
    services: [...selectedServices],
    checks,
    failures,
    warnings,
  }
}

function loadEnv(baseEnv, envFilePath) {
  const env = { ...baseEnv }

  if (!envFilePath) {
    return env
  }

  if (!existsSync(envFilePath)) {
    throw new Error(`Env file not found: ${envFilePath}`)
  }

  return {
    ...env,
    ...parseEnvFile(readFileSync(envFilePath, 'utf8')),
  }
}

function parseEnvFile(source) {
  const env = {}

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const normalizedLine = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const equalsIndex = normalizedLine.indexOf('=')

    if (equalsIndex === -1) {
      continue
    }

    const key = normalizedLine.slice(0, equalsIndex).trim()
    const value = stripEnvValue(normalizedLine.slice(equalsIndex + 1).trim())

    if (key) {
      env[key] = value
    }
  }

  return env
}

function stripEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function validateClient(env, checks, failures, warnings) {
  const service = 'client'
  requireExactValue(env, service, 'VITE_DATA_MODE', 'remote', checks, failures)
  requireExactValue(env, service, 'VITE_REALTIME_MODE', 'remote', checks, failures)

  if (readEnv(env, 'VITE_SOCKET_IO_URL')) {
    requireHttpUrl(env, service, 'VITE_SOCKET_IO_URL', { publicUrl: true }, checks, failures)
  } else {
    addWarning(warnings, service, 'CLIENT-SOCKET-001', 'VITE_SOCKET_IO_URL', 'not set; Socket.IO will use the deployed page origin')
  }

  if (readEnv(env, 'VITE_API_PROXY_TARGET')) {
    addWarning(warnings, service, 'CLIENT-PROXY-001', 'VITE_API_PROXY_TARGET', 'is a Vite dev/preview proxy value; production REST calls use the deployed origin')
  }
}

function validateBackend(env, checks, failures, warnings) {
  const service = 'backend'
  const imageStorageMode = readImageStorageMode(env)

  requireExactValue(env, service, 'NODE_ENV', 'production', checks, failures)
  requireOptionalPositiveInteger(env, service, 'PORT', checks, failures)
  requireCorsOrigins(env, service, 'CORS_ORIGIN', checks, failures)
  requireSecret(env, service, 'WORKER_TOKEN', { minLength: 16 }, checks, failures)
  requireSecret(env, service, 'INTERNAL_API_TOKEN', { minLength: 16 }, checks, failures)
  requireHttpUrl(env, service, 'QWEN_BASE_URL', { allowPrivate: true }, checks, failures)
  requireSecret(env, service, 'QWEN_API_TOKEN', { minLength: 16 }, checks, failures)
  requireOptionalPositiveInteger(env, service, 'QWEN_TIMEOUT_MS', checks, failures)

  if (imageStorageMode === 'invalid') {
    addFailure(failures, service, 'BACKEND-STORAGE-MODE-001', 'IMAGE_STORAGE_MODE', 'must be inline, local, or http-put')
  } else if (imageStorageMode === 'local') {
    requireNonPlaceholder(env, service, 'IMAGE_STORAGE_DIR', checks, failures)
    requirePublicPath(env, service, 'IMAGE_PUBLIC_PATH', checks, failures)

    if (readEnv(env, 'IMAGE_STORAGE_DIR') && readEnv(env, 'IMAGE_PUBLIC_PATH')) {
      addCheck(checks, service, 'BACKEND-STORAGE-001', 'generated asset static storage configured')
    }
  } else if (imageStorageMode === 'http-put') {
    addCheck(checks, service, 'BACKEND-STORAGE-HTTP-001', 'object storage upload is handled by gpu-worker')
  } else {
    addWarning(warnings, service, 'BACKEND-STORAGE-002', 'IMAGE_STORAGE_MODE', 'backend static storage is not configured; gpu-worker must use http-put storage')
  }

}

function validateGpuWorker(env, checks, failures, warnings) {
  const service = 'gpu-worker'
  const imageStorageMode = readImageStorageMode(env)

  requireHttpUrl(env, service, 'SERVER_URL', { publicUrl: false }, checks, failures)
  requireSecret(env, service, 'WORKER_TOKEN', { minLength: 16 }, checks, failures)
  requireOptionalPositiveInteger(env, service, 'JOB_POLL_INTERVAL_MS', checks, failures)

  if (readEnv(env, 'GPU_WORKER_SIMULATE') === 'true') {
    addFailure(failures, service, 'GPU-SIMULATE-001', 'GPU_WORKER_SIMULATE', 'must not be true for production asset generation')
  } else {
    addCheck(checks, service, 'GPU-SIMULATE-001', 'simulation mode disabled')
  }

  const generationMode = readEnv(env, 'GPU_WORKER_GENERATION_MODE') || 'wan'

  if (generationMode !== 'wan' && generationMode !== 'gateway') {
    addFailure(failures, service, 'GPU-MODE-001', 'GPU_WORKER_GENERATION_MODE', 'must be wan or gateway')
  } else {
    addCheck(checks, service, 'GPU-MODE-001', `generation mode ${generationMode}`)
  }

  if (generationMode === 'wan') {
    requireHttpUrl(env, service, 'QWEN_BASE_URL', { allowPrivate: true }, checks, failures)
    requireSecret(env, service, 'QWEN_API_TOKEN', { minLength: 16 }, checks, failures)
    requireOptionalPositiveInteger(env, service, 'QWEN_TIMEOUT_MS', checks, failures)
    requireHttpUrl(env, service, 'WAN_API_BASE_URL', { allowPrivate: true }, checks, failures)
    requireSecret(env, service, 'WAN_API_TOKEN', { minLength: 16 }, checks, failures)
    requireNonPlaceholder(env, service, 'WAN_GENERATE_PATH', checks, failures)
    requireOptionalPositiveInteger(env, service, 'WAN_TIMEOUT_MS', checks, failures)
  } else {
    requireHttpUrl(env, service, 'GENERATION_GATEWAY_URL', { allowPrivate: true }, checks, failures)
    requireNonPlaceholder(env, service, 'GENERATION_GATEWAY_PATH', checks, failures)
    requireOptionalPositiveInteger(env, service, 'GENERATION_GATEWAY_TIMEOUT_MS', checks, failures)
    addWarning(warnings, service, 'GPU-GATEWAY-001', 'GPU_WORKER_GENERATION_MODE', 'gateway mode is compatibility-only; Qwen/WAN is the current production direction')
  }

  if (imageStorageMode === 'invalid') {
    addFailure(failures, service, 'GPU-STORAGE-MODE-001', 'IMAGE_STORAGE_MODE', 'must be inline, local, or http-put')
  } else if (imageStorageMode === 'inline') {
    addFailure(failures, service, 'GPU-STORAGE-MODE-001', 'IMAGE_STORAGE_MODE', 'must be local or http-put for production')
  } else if (imageStorageMode === 'local') {
    addCheck(checks, service, 'GPU-STORAGE-MODE-001', 'image storage mode local')
    requireNonPlaceholder(env, service, 'IMAGE_STORAGE_DIR', checks, failures)
    requireHttpUrl(env, service, 'IMAGE_PUBLIC_BASE_URL', { publicUrl: true }, checks, failures)
  } else {
    addCheck(checks, service, 'GPU-STORAGE-MODE-001', 'image storage mode http-put')
    requireHttpUrl(env, service, 'IMAGE_STORAGE_UPLOAD_URL', { allowPrivate: true }, checks, failures)
    requireSecret(env, service, 'IMAGE_STORAGE_UPLOAD_TOKEN', { minLength: 16 }, checks, failures)
    requireHttpUrl(env, service, 'IMAGE_PUBLIC_BASE_URL', { publicUrl: true }, checks, failures)
  }
}

function validateCrossService(selectedServices, serviceEnvs, checks, failures, warnings) {
  if (selectedServices.has('backend') && selectedServices.has('gpu-worker')) {
    const backendToken = readEnv(serviceEnvs.get('backend'), 'WORKER_TOKEN')
    const workerToken = readEnv(serviceEnvs.get('gpu-worker'), 'WORKER_TOKEN')

    if (backendToken && workerToken && backendToken !== workerToken) {
      addFailure(failures, 'cross-service', 'CROSS-WORKER-TOKEN-001', 'WORKER_TOKEN', 'backend and gpu-worker values must match')
    } else if (backendToken && workerToken) {
      addCheck(checks, 'cross-service', 'CROSS-WORKER-TOKEN-001', 'worker token matches backend and gpu-worker')
    }

    const backendStorageMode = readImageStorageMode(serviceEnvs.get('backend'))
    const workerStorageMode = readImageStorageMode(serviceEnvs.get('gpu-worker'))
    const backendPublicPath = readEnv(serviceEnvs.get('backend'), 'IMAGE_PUBLIC_PATH')
    const workerPublicBaseUrl = readEnv(serviceEnvs.get('gpu-worker'), 'IMAGE_PUBLIC_BASE_URL')

    if ((workerStorageMode === 'local' || workerStorageMode === 'http-put') && backendStorageMode !== workerStorageMode) {
      addFailure(
        failures,
        'cross-service',
        'CROSS-STORAGE-MODE-001',
        'IMAGE_STORAGE_MODE',
        `backend and gpu-worker image storage modes must match (${backendStorageMode} != ${workerStorageMode})`,
      )
    } else if (workerStorageMode === 'local' || workerStorageMode === 'http-put') {
      addCheck(checks, 'cross-service', 'CROSS-STORAGE-MODE-001', `image storage mode ${workerStorageMode} matches backend and gpu-worker`)
    }

    if (workerStorageMode === 'local' && backendPublicPath && workerPublicBaseUrl) {
      const publicBaseUrl = parseUrl(workerPublicBaseUrl)

      if (publicBaseUrl && !pathMatchesPublicPath(publicBaseUrl.pathname, backendPublicPath)) {
        addWarning(warnings, 'cross-service', 'CROSS-STORAGE-001', 'IMAGE_PUBLIC_BASE_URL', `URL path does not start with backend IMAGE_PUBLIC_PATH ${backendPublicPath}; confirm CDN/proxy routing`)
      } else if (publicBaseUrl) {
        addCheck(checks, 'cross-service', 'CROSS-STORAGE-001', 'worker public image URL aligns with backend public path')
      }
    }
  }
}

function readImageStorageMode(env) {
  const explicitMode = readEnv(env, 'IMAGE_STORAGE_MODE')?.toLowerCase()

  if (explicitMode === 'inline' || explicitMode === 'local' || explicitMode === 'http-put') {
    return explicitMode
  }

  if (explicitMode) {
    return 'invalid'
  }

  if (readEnv(env, 'IMAGE_STORAGE_UPLOAD_URL')) {
    return 'http-put'
  }

  if (readEnv(env, 'IMAGE_STORAGE_DIR') || readEnv(env, 'IMAGE_PUBLIC_PATH')) {
    return 'local'
  }

  return 'inline'
}

function requireExactValue(env, service, variableName, expected, checks, failures) {
  const value = readEnv(env, variableName)

  if (value !== expected) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}`, variableName, `must be ${expected}`)
    return
  }

  addCheck(checks, service, `${service.toUpperCase()}-${variableName}`, `${variableName}=${expected}`)
}

function requireNonPlaceholder(env, service, variableName, checks, failures) {
  const value = readEnv(env, variableName)

  if (!value) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}`, variableName, 'is required')
    return false
  }

  if (isPlaceholder(value)) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}`, variableName, 'must be replaced with a real production value')
    return false
  }

  addCheck(checks, service, `${service.toUpperCase()}-${variableName}`, `${variableName} configured`)
  return true
}

function requireSecret(env, service, variableName, optionsForSecret, checks, failures) {
  const value = readEnv(env, variableName)

  if (!requireNonPlaceholder(env, service, variableName, checks, failures)) {
    return
  }

  if (value.length < optionsForSecret.minLength) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}-LENGTH`, variableName, `must be at least ${optionsForSecret.minLength} characters`)
  }
}

function requireHttpUrl(env, service, variableName, urlOptions, checks, failures) {
  const value = readEnv(env, variableName)

  if (!requireNonPlaceholder(env, service, variableName, checks, failures)) {
    return
  }

  const url = parseUrl(value)

  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}-URL`, variableName, 'must be an http(s) URL')
    return
  }

  if (urlOptions.publicUrl && LOCAL_HOSTNAMES.has(url.hostname)) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}-PUBLIC`, variableName, 'must not point to localhost for production')
    return
  }

  addCheck(checks, service, `${service.toUpperCase()}-${variableName}-URL`, `${variableName} URL is valid`)
}

function requireCorsOrigins(env, service, variableName, checks, failures) {
  const value = readEnv(env, variableName)

  if (!requireNonPlaceholder(env, service, variableName, checks, failures)) {
    return
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (origins.length === 0) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}`, variableName, 'requires at least one origin')
    return
  }

  let hasInvalidOrigin = false

  for (const origin of origins) {
    const url = parseUrl(origin)

    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      addFailure(failures, service, `${service.toUpperCase()}-${variableName}-URL`, variableName, `invalid origin ${origin}`)
      hasInvalidOrigin = true
      continue
    }

    if (LOCAL_HOSTNAMES.has(url.hostname)) {
      addFailure(failures, service, `${service.toUpperCase()}-${variableName}-PUBLIC`, variableName, `production origin must not point to localhost: ${origin}`)
      hasInvalidOrigin = true
    }
  }

  if (!hasInvalidOrigin) {
    addCheck(checks, service, `${service.toUpperCase()}-${variableName}-URL`, `${origins.length} CORS origin${origins.length === 1 ? '' : 's'} configured`)
  }
}

function requirePublicPath(env, service, variableName, checks, failures) {
  const value = readEnv(env, variableName)

  if (!requireNonPlaceholder(env, service, variableName, checks, failures)) {
    return
  }

  if (!value.startsWith('/') || value.includes('://')) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}-PATH`, variableName, 'must be a URL path beginning with /')
  }
}

function requireOptionalPositiveInteger(env, service, variableName, checks, failures) {
  const value = readEnv(env, variableName)

  if (!value) {
    addCheck(checks, service, `${service.toUpperCase()}-${variableName}`, `${variableName} uses runtime default`)
    return
  }

  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    addFailure(failures, service, `${service.toUpperCase()}-${variableName}`, variableName, 'must be a positive integer')
    return
  }

  addCheck(checks, service, `${service.toUpperCase()}-${variableName}`, `${variableName} is a positive integer`)
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase()

  if (!normalized || normalized === 'dev-worker-token') {
    return true
  }

  return PLACEHOLDER_FRAGMENTS.some((fragment) => normalized.includes(fragment))
}

function readEnv(env, variableName) {
  const value = env?.[variableName]

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function parseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function pathMatchesPublicPath(urlPathname, publicPath) {
  const normalizedPublicPath = publicPath.endsWith('/') && publicPath.length > 1
    ? publicPath.slice(0, -1)
    : publicPath

  return urlPathname === normalizedPublicPath || urlPathname.startsWith(`${normalizedPublicPath}/`)
}

function addCheck(checks, service, id, message) {
  checks.push({ service, id, message })
}

function addFailure(failures, service, id, variableName, message) {
  failures.push({ service, id, variableName, message })
}

function addWarning(warnings, service, id, variableName, message) {
  warnings.push({ service, id, variableName, message })
}

function printResult(result) {
  console.log(`Production environment readiness: ${result.failures.length === 0 ? 'PASS' : 'FAIL'}`)
  console.log(`Services: ${result.services.join(', ')}`)
  console.log(`Checks passed: ${result.checks.length}`)

  if (result.warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of result.warnings) {
      console.log(`- [${warning.id}] ${warning.service} ${warning.variableName}: ${warning.message}`)
    }
  }

  if (result.failures.length > 0) {
    console.log('\nFailures:')
    for (const failure of result.failures) {
      console.log(`- [${failure.id}] ${failure.service} ${failure.variableName}: ${failure.message}`)
    }
  }
}

function printHelp() {
  console.log(`Usage: node scripts/check-production-env.mjs [options]

Options:
  --service client|backend|gpu-worker|all
  --env-file <path>                 Load one env file for every selected service
  --client-env-file <path>          Load env file only for the client checks
  --backend-env-file <path>         Load env file only for backend checks
  --gpu-worker-env-file <path>      Load env file only for gpu-worker checks
  --self-test                       Run deterministic script self-test

Examples:
  npm run check:production-env -- --service backend --backend-env-file backend/.env.production
  npm run check:production-env -- --backend-env-file backend/.env.production --gpu-worker-env-file gpu-worker/.env.production --client-env-file client/.env.production
`)
}

function runSelfTest() {
  const passingEnv = {
    VITE_DATA_MODE: 'remote',
    VITE_REALTIME_MODE: 'remote',
    VITE_SOCKET_IO_URL: 'https://relay.madcamp-kaist.org',
    NODE_ENV: 'production',
    PORT: '3000',
    CORS_ORIGIN: 'https://relay.madcamp-kaist.org,https://admin.madcamp-kaist.org',
    WORKER_TOKEN: 'worker-token-1234567890',
    INTERNAL_API_TOKEN: 'internal-token-1234567890',
    QWEN_BASE_URL: 'http://qwen.internal:8001',
    QWEN_API_TOKEN: 'qwen-token-1234567890',
    QWEN_TIMEOUT_MS: '45000',
    SERVER_URL: 'http://backend:3000',
    JOB_POLL_INTERVAL_MS: '2000',
    GPU_WORKER_SIMULATE: 'false',
    GPU_WORKER_GENERATION_MODE: 'wan',
    WAN_API_BASE_URL: 'http://wan.internal:8002',
    WAN_API_TOKEN: 'wan-token-1234567890',
    WAN_GENERATE_PATH: '/v1/sprites/generate',
    WAN_TIMEOUT_MS: '90000',
    IMAGE_STORAGE_MODE: 'local',
    IMAGE_STORAGE_DIR: '/srv/relay/generated-assets',
    IMAGE_PUBLIC_PATH: '/generated-assets',
    IMAGE_PUBLIC_BASE_URL: 'https://relay.madcamp-kaist.org/generated-assets',
  }

  const pass = checkProductionEnvForEnv(passingEnv)

  assert.equal(pass.failures.length, 0)

  const placeholderToken = checkProductionEnvForEnv({
    ...passingEnv,
    WORKER_TOKEN: 'dev-worker-token',
  })
  assert.ok(placeholderToken.failures.some((failure) => failure.variableName === 'WORKER_TOKEN'))

  const simulatedWorker = checkProductionEnvForEnv({
    ...passingEnv,
    GPU_WORKER_SIMULATE: 'true',
  })
  assert.ok(simulatedWorker.failures.some((failure) => failure.id === 'GPU-SIMULATE-001'))

  const gatewayMode = checkProductionEnvForEnv({
    ...passingEnv,
    GPU_WORKER_GENERATION_MODE: 'gateway',
    GENERATION_GATEWAY_URL: 'http://gateway.internal:8188',
    GENERATION_GATEWAY_PATH: '/v2/sprite-jobs/generate',
    GENERATION_GATEWAY_TIMEOUT_MS: '600000',
    WAN_API_BASE_URL: '',
    WAN_API_TOKEN: '',
  })
  assert.equal(gatewayMode.failures.length, 0)

  const httpPutStorageMode = checkProductionEnvForEnv({
    ...passingEnv,
    IMAGE_STORAGE_MODE: 'http-put',
    IMAGE_STORAGE_DIR: '',
    IMAGE_PUBLIC_PATH: '',
    IMAGE_STORAGE_UPLOAD_URL: 'http://storage-gateway.internal/generated-assets',
    IMAGE_STORAGE_UPLOAD_TOKEN: 'upload-token-1234567890',
    IMAGE_PUBLIC_BASE_URL: 'https://cdn.madcamp-kaist.org/generated-assets',
  })
  assert.equal(httpPutStorageMode.failures.length, 0)

  const crossServiceStorageMismatch = runCrossServiceValidationForEnv({
    backend: {
      WORKER_TOKEN: 'worker-token-1234567890',
      IMAGE_STORAGE_MODE: 'local',
      IMAGE_PUBLIC_PATH: '/generated-assets',
    },
    worker: {
      WORKER_TOKEN: 'worker-token-1234567890',
      IMAGE_STORAGE_MODE: 'http-put',
      IMAGE_PUBLIC_BASE_URL: 'https://cdn.madcamp-kaist.org/generated-assets',
    },
  })
  assert.ok(crossServiceStorageMismatch.failures.some((failure) => failure.id === 'CROSS-STORAGE-MODE-001'))

  const crossServiceLocalPathBoundary = runCrossServiceValidationForEnv({
    backend: {
      WORKER_TOKEN: 'worker-token-1234567890',
      IMAGE_STORAGE_MODE: 'local',
      IMAGE_PUBLIC_PATH: '/generated-assets',
    },
    worker: {
      WORKER_TOKEN: 'worker-token-1234567890',
      IMAGE_STORAGE_MODE: 'local',
      IMAGE_PUBLIC_BASE_URL: 'https://relay.madcamp-kaist.org/generated-assets-v2',
    },
  })
  assert.ok(crossServiceLocalPathBoundary.warnings.some((warning) => warning.id === 'CROSS-STORAGE-001'))

  const inlineStorageMode = checkProductionEnvForEnv({
    ...passingEnv,
    IMAGE_STORAGE_MODE: 'inline',
    IMAGE_STORAGE_DIR: '',
    IMAGE_PUBLIC_PATH: '',
    IMAGE_PUBLIC_BASE_URL: '',
  })
  assert.ok(inlineStorageMode.failures.some((failure) => failure.id === 'GPU-STORAGE-MODE-001'))

  const mockClient = checkProductionEnvForEnv({
    ...passingEnv,
    VITE_DATA_MODE: 'mock',
  })
  assert.ok(mockClient.failures.some((failure) => failure.variableName === 'VITE_DATA_MODE'))

  console.log('Production environment readiness self-test: PASS')
}

function checkProductionEnvForEnv(env) {
  return withTemporaryProcessEnv(env, () => checkProductionEnv({
    services: new Set(SERVICE_NAMES),
    envFile: null,
    serviceEnvFiles: new Map(),
  }))
}

function runCrossServiceValidationForEnv({ backend, worker }) {
  const checks = []
  const failures = []
  const warnings = []

  validateCrossService(
    new Set(['backend', 'gpu-worker']),
    new Map([
      ['backend', backend],
      ['gpu-worker', worker],
    ]),
    checks,
    failures,
    warnings,
  )

  return { checks, failures, warnings }
}

function withTemporaryProcessEnv(env, callback) {
  const previousEnv = process.env
  process.env = { ...env }

  try {
    return callback()
  } finally {
    process.env = previousEnv
  }
}

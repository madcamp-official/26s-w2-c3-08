import assert from 'node:assert/strict'

interface WorkerJob {
  id: string
  assetId: string | null
  category: string | null
  name: string
  description: string
  image: string
  attrs: Record<string, unknown>
  widthCells: number | null
  heightCells: number | null
  action: string | null
  requestedActions: string[]
}

interface WorkerConfig {
  serverUrl: string
  workerToken: string
  workerId: string
  pollIntervalMs: number
  simulate: boolean
  comfyUrl: string | null
  comfyGeneratePath: string
  comfyTimeoutMs: number
}

type Fetcher = typeof fetch

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    serverUrl: env.SERVER_URL ?? 'http://localhost:3000',
    workerToken: env.WORKER_TOKEN ?? 'dev-worker-token',
    workerId: env.WORKER_ID ?? `gpu-worker-${process.pid}`,
    pollIntervalMs: readPositiveInteger(env.JOB_POLL_INTERVAL_MS, 2_000),
    simulate: env.GPU_WORKER_SIMULATE === 'true',
    comfyUrl: env.COMFYUI_URL ?? null,
    comfyGeneratePath: env.COMFYUI_GENERATE_PATH ?? '/v2/sprite-jobs/generate',
    comfyTimeoutMs: readPositiveInteger(env.COMFYUI_TIMEOUT_MS, 10 * 60 * 1_000),
  }
}

export async function pollOnce(config: WorkerConfig, fetcher: Fetcher = fetch) {
  const nextResponse = await fetcher(`${config.serverUrl}/api/ai/jobs/next`, {
    headers: createHeaders(config),
  })

  if (nextResponse.status === 204) {
    return { status: 'idle' as const }
  }

  if (!nextResponse.ok) {
    return {
      status: 'error' as const,
      message: `job claim failed: ${nextResponse.status} ${await nextResponse.text()}`,
    }
  }

  const nextBody = await nextResponse.json()
  const job = normalizeWorkerJob(nextBody?.job)

  if (!job) {
    return {
      status: 'error' as const,
      message: 'job claim response was malformed',
    }
  }

  const result = await runJob(job, config, fetcher)
  const resultResponse = await fetcher(`${config.serverUrl}/api/ai/jobs/${encodeURIComponent(job.id)}/result`, {
    method: 'POST',
    headers: createHeaders(config),
    body: JSON.stringify(result),
  })

  if (!resultResponse.ok) {
    return {
      status: 'error' as const,
      message: `job result failed: ${resultResponse.status} ${await resultResponse.text()}`,
    }
  }

  return {
    status: result.status,
    jobId: job.id,
  }
}

export async function runWorkerLoop(config: WorkerConfig, fetcher: Fetcher = fetch) {
  for (;;) {
    const result = await pollOnce(config, fetcher)

    if (result.status === 'error') {
      console.error(result.message)
    }

    await delay(config.pollIntervalMs)
  }
}

async function runJob(job: WorkerJob, config: WorkerConfig, fetcher: Fetcher = fetch) {
  if (config.simulate) {
    return {
      status: 'ready',
      sheetUrl: createSimulatedSheetUrl(job),
    }
  }

  if (!config.comfyUrl) {
    return {
      status: 'failed',
      errorCode: 'COMFYUI_URL_MISSING',
      errorMessage: 'COMFYUI_URL is required unless GPU_WORKER_SIMULATE=true.',
    }
  }

  return executeComfyGatewayJob(job, config, fetcher)
}

async function executeComfyGatewayJob(job: WorkerJob, config: WorkerConfig, fetcher: Fetcher) {
  const responseResult = await postWithTimeout(fetcher, `${trimTrailingSlash(config.comfyUrl ?? '')}${ensureLeadingSlash(config.comfyGeneratePath)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-id': config.workerId,
    },
    body: JSON.stringify({
      jobId: job.id,
      job_id: job.id,
      assetId: job.assetId,
      asset_id: job.assetId,
      category: job.category,
      name: job.name,
      description: job.description,
      image: job.image,
      attrs: job.attrs,
      widthCells: job.widthCells,
      width_cells: job.widthCells,
      heightCells: job.heightCells,
      height_cells: job.heightCells,
      action: job.action,
      requestedActions: job.requestedActions,
      requested_actions: job.requestedActions,
    }),
  }, config.comfyTimeoutMs)

  if (!responseResult.ok) {
    return responseResult.failure
  }

  const { response } = responseResult

  if (!response.ok) {
    const body = await readJsonSafely(response)

    return createFailedJobResult(
      `COMFYUI_HTTP_${response.status}`,
      readErrorMessage(body) ?? `ComfyUI gateway request failed with ${response.status}.`,
    )
  }

  return normalizeComfyGatewayResponse(response)
}

function normalizeWorkerJob(value: unknown): WorkerJob | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readString(value.id)
  const assetId = readString(value.assetId) ?? readString(value.asset_id) ?? null

  if (!id) {
    return null
  }

  return {
    id,
    assetId,
    category: readString(value.category) ?? null,
    name: readString(value.name) ?? '',
    description: readString(value.description) ?? '',
    image: readString(value.image) ?? '',
    attrs: isRecord(value.attrs) ? value.attrs : {},
    widthCells: readNumber(value.widthCells) ?? readNumber(value.width_cells),
    heightCells: readNumber(value.heightCells) ?? readNumber(value.height_cells),
    action: readString(value.action) ?? null,
    requestedActions: Array.isArray(value.requestedActions)
      ? value.requestedActions.filter((action): action is string => typeof action === 'string')
      : [],
  }
}

async function normalizeComfyGatewayResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      status: 'ready' as const,
      sheetUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
    }
  }

  const body = await readJsonSafely(response)

  if (!isRecord(body)) {
    return createFailedJobResult('COMFYUI_MALFORMED_RESPONSE', 'ComfyUI gateway response was not valid JSON.')
  }

  if (body.status === 'failed') {
    return createFailedJobResult(
      readString(body.errorCode) ?? readString(body.error_code) ?? 'COMFYUI_JOB_FAILED',
      readString(body.errorMessage) ?? readString(body.error_message) ?? 'ComfyUI gateway reported a failed job.',
    )
  }

  const sheetUrl =
    readString(body.sheetUrl) ??
    readString(body.sheet_url) ??
    readString(body.image) ??
    readString(body.image_url)

  if (!sheetUrl) {
    return createFailedJobResult('COMFYUI_MISSING_SHEET', 'ComfyUI gateway did not return a sprite sheet.')
  }

  return {
    status: 'ready' as const,
    sheetUrl,
    sourceImageUrl: readString(body.sourceImageUrl) ?? readString(body.source_image_url) ?? undefined,
  }
}

async function postWithTimeout(
  fetcher: Fetcher,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: true; response: Response } | { ok: false; failure: ReturnType<typeof createFailedJobResult> }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(input, {
      ...init,
      signal: controller.signal,
    })

    return { ok: true, response }
  } catch (error) {
    return {
      ok: false,
      failure: createFailedJobResult(
        isAbortError(error) ? 'COMFYUI_TIMEOUT' : 'COMFYUI_NETWORK_ERROR',
        isAbortError(error) ? 'ComfyUI gateway request timed out.' : 'ComfyUI gateway could not be reached.',
      ),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function createFailedJobResult(errorCode: string, errorMessage: string) {
  return {
    status: 'failed' as const,
    errorCode,
    errorMessage,
  }
}

function createSimulatedSheetUrl(job: WorkerJob) {
  const text = JSON.stringify({
    id: job.id,
    assetId: job.assetId,
    action: job.action,
    requestedActions: job.requestedActions,
  })

  return `data:application/json;base64,${Buffer.from(text, 'utf8').toString('base64')}`
}

function createHeaders(config: WorkerConfig) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.workerToken}`,
    'x-worker-id': config.workerId,
  }
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readErrorMessage(value: unknown) {
  if (!isRecord(value)) {
    return undefined
  }

  if (typeof value.message === 'string') {
    return value.message
  }

  if (isRecord(value.error) && typeof value.error.message === 'string') {
    return value.error.message
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '')
}

function ensureLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

async function selfTest() {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url: String(url), init })

    if (String(url).endsWith('/api/ai/jobs/next')) {
      return new Response(JSON.stringify({
        job: {
          id: 'job-self-test',
          assetId: 'asset-self-test',
          category: 'platform',
          name: 'Self Test',
          description: 'Worker contract test',
          image: 'data:image/png;base64,AA==',
          requestedActions: ['static'],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const result = await pollOnce({
    serverUrl: 'http://server.test',
    workerToken: 'worker-token',
    workerId: 'self-test-worker',
    pollIntervalMs: 1,
    simulate: true,
    comfyUrl: null,
    comfyGeneratePath: '/v2/sprite-jobs/generate',
    comfyTimeoutMs: 1_000,
  }, fetcher)

  assert.equal(result.status, 'ready')
  assert.equal(calls.length, 2)
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer worker-token')
  assert.match(String(calls[1].init?.body), /sheetUrl/)

  const gatewayCalls: Array<{ url: string; init?: RequestInit }> = []
  const gatewayResult = await runJob({
    id: 'job-gateway-test',
    assetId: 'asset-gateway-test',
    category: 'monster',
    name: 'Gateway Test',
    description: 'Comfy gateway contract test',
    image: 'data:image/png;base64,AA==',
    attrs: { movement: 'patrol' },
    widthCells: 1,
    heightCells: 2,
    action: 'walk',
    requestedActions: ['walk'],
  }, {
    serverUrl: 'http://server.test',
    workerToken: 'worker-token',
    workerId: 'self-test-worker',
    pollIntervalMs: 1,
    simulate: false,
    comfyUrl: 'http://comfy.test',
    comfyGeneratePath: '/v2/sprite-sheets',
    comfyTimeoutMs: 1_000,
  }, async (url, init) => {
    gatewayCalls.push({ url: String(url), init })

    return new Response(JSON.stringify({
      sheetUrl: 'data:image/png;base64,generated',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  assert.equal(gatewayResult.status, 'ready')
  assert.equal(gatewayCalls[0].url, 'http://comfy.test/v2/sprite-sheets')
  assert.match(String(gatewayCalls[0].init?.body), /requestedActions/)
  console.log('gpu-worker self-test passed')
}

const args = new Set(process.argv.slice(2))

if (args.has('--self-test')) {
  await selfTest()
} else if (args.has('--once')) {
  const result = await pollOnce(loadWorkerConfig())
  console.log(JSON.stringify(result))
} else {
  await runWorkerLoop(loadWorkerConfig())
}

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

type ImageStorageMode = 'inline' | 'local' | 'http-put'

type AiTraceStage = 'qwen' | 'wan' | 'gateway' | 'storage'

interface AiTraceStep {
  stage: AiTraceStage
  status: 'success' | 'failed'
  code?: string
  message?: string
  responseSummary?: string
  response?: unknown
}

interface FailedJobResult {
  status: 'failed'
  errorCode: string
  errorMessage: string
  aiTrace: AiTraceStep[]
}

interface ReadyJobResult {
  status: 'ready'
  sheetUrl: string
  sourceImageUrl?: string
  aiTrace?: AiTraceStep[]
}

interface WorkerJob {
  id: string
  userId: string | null
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
  generationMode: 'wan' | 'gateway'
  qwenBaseUrl: string | null
  qwenApiToken: string | null
  qwenTimeoutMs: number
  wanBaseUrl: string | null
  wanApiToken: string | null
  wanGeneratePath: string
  wanTimeoutMs: number
  gatewayUrl: string | null
  gatewayGeneratePath: string
  gatewayTimeoutMs: number
  imageStorageMode: ImageStorageMode
  imageStorageDir: string | null
  imageStorageUploadUrl: string | null
  imageStorageUploadToken: string | null
  imagePublicBaseUrl: string | null
}

type Fetcher = typeof fetch

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const generationMode = readGenerationMode(env.GPU_WORKER_GENERATION_MODE)
  const config: WorkerConfig = {
    serverUrl: env.SERVER_URL ?? 'http://localhost:3000',
    workerToken: env.WORKER_TOKEN ?? 'dev-worker-token',
    workerId: env.WORKER_ID ?? `gpu-worker-${process.pid}`,
    pollIntervalMs: readPositiveInteger(env.JOB_POLL_INTERVAL_MS, 2_000),
    simulate: env.GPU_WORKER_SIMULATE === 'true',
    generationMode: generationMode ?? 'wan',
    qwenBaseUrl: env.QWEN_BASE_URL ?? null,
    qwenApiToken: env.QWEN_API_TOKEN ?? null,
    qwenTimeoutMs: readPositiveInteger(env.QWEN_TIMEOUT_MS, 45_000),
    wanBaseUrl: env.WAN_API_BASE_URL ?? null,
    wanApiToken: env.WAN_API_TOKEN ?? null,
    wanGeneratePath: env.WAN_GENERATE_PATH ?? '/v1/sprites/generate',
    wanTimeoutMs: readPositiveInteger(env.WAN_TIMEOUT_MS, 90_000),
    gatewayUrl: env.GENERATION_GATEWAY_URL ?? env.COMFYUI_URL ?? null,
    gatewayGeneratePath: env.GENERATION_GATEWAY_PATH ?? env.COMFYUI_GENERATE_PATH ?? '/v2/sprite-jobs/generate',
    gatewayTimeoutMs: readPositiveInteger(env.GENERATION_GATEWAY_TIMEOUT_MS ?? env.COMFYUI_TIMEOUT_MS, 10 * 60 * 1_000),
    imageStorageMode: readImageStorageMode(env),
    imageStorageDir: env.IMAGE_STORAGE_DIR ?? null,
    imageStorageUploadUrl: env.IMAGE_STORAGE_UPLOAD_URL ?? null,
    imageStorageUploadToken: env.IMAGE_STORAGE_UPLOAD_TOKEN ?? null,
    imagePublicBaseUrl: env.IMAGE_PUBLIC_BASE_URL ?? null,
  }

  validateProductionWorkerConfig(env, config)

  return config
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
      aiTrace: [
        createAiTraceStep('gateway', 'success', {
          message: 'GPU_WORKER_SIMULATE=true; generated a deterministic local sheet URL.',
        }),
      ],
    }
  }

  const result = config.generationMode === 'gateway'
    ? await executeGatewayJob(job, config, fetcher)
    : await executeWanPipelineJob(job, config, fetcher)

  return persistGeneratedImages(job, result, config, fetcher)
}

async function executeWanPipelineJob(job: WorkerJob, config: WorkerConfig, fetcher: Fetcher) {
  if (!config.qwenBaseUrl || !config.qwenApiToken) {
    return createStageFailure(
      'qwen',
      'QWEN_NOT_CONFIGURED',
      'QWEN_BASE_URL and QWEN_API_TOKEN are required unless GPU_WORKER_SIMULATE=true.',
    )
  }

  if (!config.wanBaseUrl || !config.wanApiToken) {
    return createStageFailure(
      'wan',
      'WAN_NOT_CONFIGURED',
      'WAN_API_BASE_URL and WAN_API_TOKEN are required unless GPU_WORKER_SIMULATE=true.',
    )
  }

  const qwenResult = await requestQwenPromptRefinement(job, config, fetcher)

  if (qwenResult.status === 'failed') {
    return qwenResult
  }

  const wanResult = await requestWanSpriteGeneration(job, qwenResult, config, fetcher)

  return {
    ...wanResult,
    aiTrace: [...qwenResult.aiTrace, ...(wanResult.aiTrace ?? [])],
  }
}

async function executeGatewayJob(job: WorkerJob, config: WorkerConfig, fetcher: Fetcher) {
  if (!config.gatewayUrl) {
    return createStageFailure(
      'gateway',
      'GENERATION_GATEWAY_URL_MISSING',
      'GENERATION_GATEWAY_URL is required when GPU_WORKER_GENERATION_MODE=gateway.',
    )
  }

  const responseResult = await postWithTimeout(fetcher, `${trimTrailingSlash(config.gatewayUrl)}${ensureLeadingSlash(config.gatewayGeneratePath)}`, {
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
  }, config.gatewayTimeoutMs, 'GENERATION_GATEWAY', 'generation gateway')

  if (!responseResult.ok) {
    return withTrace(responseResult.failure, 'gateway')
  }

  const { response } = responseResult

  if (!response.ok) {
    const body = await readJsonSafely(response)

    return createFailedJobResult(
      `GENERATION_GATEWAY_HTTP_${response.status}`,
      readErrorMessage(body) ?? `Generation gateway request failed with ${response.status}.`,
      [createAiTraceStep('gateway', 'failed', {
        code: `GENERATION_GATEWAY_HTTP_${response.status}`,
        message: readErrorMessage(body) ?? `Generation gateway request failed with ${response.status}.`,
        response: body,
      })],
    )
  }

  return normalizeGenerationResponse(response, 'GENERATION_GATEWAY', 'Generation gateway', 'gateway')
}

interface QwenPipelineResult {
  status: 'ready'
  wanPrompt: string
  wanNegativePrompt: string
  background: string
  aiTrace: AiTraceStep[]
}

async function requestQwenPromptRefinement(job: WorkerJob, config: WorkerConfig, fetcher: Fetcher) {
  const imageBlobResult = dataUrlToBlob(job.image)

  if (imageBlobResult.status === 'failed') {
    return imageBlobResult
  }

  const form = new FormData()
  const targetType = job.category === 'avatar' ? 'avatar' : 'asset'

  form.append('request_id', job.id)
  form.append('user_id', job.userId ?? job.assetId ?? 'gpu-worker')
  form.append('target_type', targetType)
  form.append('user_prompt', createUserPrompt(job))
  form.append('locale', 'ko-KR')
  form.append('style_preset', 'platformer_sprite')
  form.append('output_language', 'en')

  const assetType = mapQwenAssetType(job.category)

  if (assetType) {
    form.append('asset_type', assetType)
  }

  form.append('image', imageBlobResult.blob, `${job.id}.${mimeToExtension(imageBlobResult.blob.type)}`)

  const responseResult = await postWithTimeout(fetcher, `${trimTrailingSlash(config.qwenBaseUrl ?? '')}/v1/prompts/refine`, {
    method: 'POST',
    headers: {
      'X-Internal-Token': config.qwenApiToken ?? '',
    },
    body: form,
  }, config.qwenTimeoutMs, 'QWEN', 'Qwen prompt refinement')

  if (!responseResult.ok) {
    return withTrace(responseResult.failure, 'qwen')
  }

  const { response } = responseResult
  const body = await readJsonSafely(response)

  if (!response.ok) {
    const code = readNestedErrorCode(body) ?? `QWEN_HTTP_${response.status}`
    const message = readErrorMessage(body) ?? `Qwen prompt refinement failed with ${response.status}.`

    return createFailedJobResult(
      code,
      message,
      [createAiTraceStep('qwen', 'failed', { code, message, response: body })],
    )
  }

  return normalizeQwenResponse(body, job.id)
}

async function requestWanSpriteGeneration(
  job: WorkerJob,
  qwen: QwenPipelineResult,
  config: WorkerConfig,
  fetcher: Fetcher,
) {
  const targetType = job.category === 'avatar' ? 'avatar' : 'asset'
  const responseResult = await postWithTimeout(fetcher, `${trimTrailingSlash(config.wanBaseUrl ?? '')}${ensureLeadingSlash(config.wanGeneratePath)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.wanApiToken ?? ''}`,
      'Content-Type': 'application/json',
      'x-worker-id': config.workerId,
    },
    body: JSON.stringify({
      request_id: job.id,
      mode: 'image_to_sprite',
      target_type: targetType,
      prompt: qwen.wanPrompt,
      negative_prompt: qwen.wanNegativePrompt,
      reference_image_url: job.image,
      width: getOutputWidth(job),
      height: getOutputHeight(job),
      background: qwen.background,
      num_outputs: 1,
      asset_id: job.assetId,
      category: job.category,
      action: job.action,
      requested_actions: job.requestedActions,
    }),
  }, config.wanTimeoutMs, 'WAN', 'WAN sprite generation')

  if (!responseResult.ok) {
    return withTrace(responseResult.failure, 'wan')
  }

  const { response } = responseResult

  if (!response.ok) {
    const body = await readJsonSafely(response)
    const code = readNestedErrorCode(body) ?? `WAN_HTTP_${response.status}`
    const message = readErrorMessage(body) ?? `WAN sprite generation failed with ${response.status}.`

    return createFailedJobResult(
      code,
      message,
      [createAiTraceStep('wan', 'failed', { code, message, response: body })],
    )
  }

  return normalizeGenerationResponse(response, 'WAN', 'WAN sprite generation', 'wan')
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
    userId: readString(value.userId) ?? readString(value.user_id) ?? null,
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

function normalizeQwenResponse(body: unknown, expectedRequestId: string): QwenPipelineResult | FailedJobResult {
  if (!isRecord(body)) {
    return createStageFailure('qwen', 'QWEN_MALFORMED_RESPONSE', 'Qwen response was not valid JSON.', body)
  }

  if (body.ok !== true) {
    return createStageFailure('qwen', 'QWEN_NOT_OK', 'Qwen response did not report ok=true.', body)
  }

  const requestId = readString(body.request_id) ?? readString(body.requestId)

  if (requestId !== expectedRequestId) {
    return createStageFailure(
      'qwen',
      'QWEN_REQUEST_ID_MISMATCH',
      'Qwen response request_id did not match the worker job id.',
      body,
    )
  }

  const wanPrompt = readString(body.wan_prompt) ?? readString(body.wanPrompt)

  if (!wanPrompt) {
    return createStageFailure('qwen', 'QWEN_MISSING_WAN_PROMPT', 'Qwen response did not include wan_prompt.', body)
  }

  return {
    status: 'ready',
    wanPrompt,
    wanNegativePrompt: readString(body.wan_negative_prompt) ?? readString(body.wanNegativePrompt) ?? '',
    background: readSpriteBackground(body) ?? 'transparent',
    aiTrace: [
      createAiTraceStep('qwen', 'success', {
        message: 'Qwen prompt refinement completed.',
        response: body,
      }),
    ],
  }
}

async function normalizeGenerationResponse(
  response: Response,
  errorPrefix: string,
  label: string,
  stage: AiTraceStage,
): Promise<ReadyJobResult | FailedJobResult> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      status: 'ready' as const,
      sheetUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
      aiTrace: [
        createAiTraceStep(stage, 'success', {
          message: `${label} returned an image response.`,
          response: { contentType, bytes: buffer.byteLength },
        }),
      ],
    }
  }

  const body = await readJsonSafely(response)

  if (!isRecord(body)) {
    return createStageFailure(stage, `${errorPrefix}_MALFORMED_RESPONSE`, `${label} response was not valid JSON.`, body)
  }

  if (body.status === 'failed') {
    const code = readString(body.errorCode) ?? readString(body.error_code) ?? `${errorPrefix}_JOB_FAILED`
    const message = readString(body.errorMessage) ?? readString(body.error_message) ?? `${label} reported a failed job.`

    return createFailedJobResult(
      code,
      message,
      [createAiTraceStep(stage, 'failed', { code, message, response: body })],
    )
  }

  const sheetUrl =
    readString(body.sheetUrl) ??
    readString(body.sheet_url) ??
    readString(body.image) ??
    readString(body.image_url)

  if (!sheetUrl) {
    return createStageFailure(stage, `${errorPrefix}_MISSING_SHEET`, `${label} did not return a sprite sheet.`, body)
  }

  return {
    status: 'ready' as const,
    sheetUrl,
    sourceImageUrl: readString(body.sourceImageUrl) ?? readString(body.source_image_url) ?? undefined,
    aiTrace: [
      createAiTraceStep(stage, 'success', {
        message: `${label} returned a sprite sheet.`,
        response: body,
      }),
    ],
  }
}

async function postWithTimeout(
  fetcher: Fetcher,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  errorPrefix: string,
  label: string,
): Promise<{ ok: true; response: Response } | { ok: false; failure: FailedJobResult }> {
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
        isAbortError(error) ? `${errorPrefix}_TIMEOUT` : `${errorPrefix}_NETWORK_ERROR`,
        isAbortError(error) ? `${label} request timed out.` : `${label} could not be reached.`,
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

function createFailedJobResult(
  errorCode: string,
  errorMessage: string,
  aiTrace: AiTraceStep[] = [],
): FailedJobResult {
  return {
    status: 'failed' as const,
    errorCode,
    errorMessage,
    aiTrace,
  }
}

function createStageFailure(
  stage: AiTraceStage,
  errorCode: string,
  errorMessage: string,
  response?: unknown,
): FailedJobResult {
  return createFailedJobResult(
    errorCode,
    errorMessage,
    [createAiTraceStep(stage, 'failed', { code: errorCode, message: errorMessage, response })],
  )
}

function withTrace(result: FailedJobResult, stage: AiTraceStage): FailedJobResult {
  if (result.aiTrace.length > 0) {
    return result
  }

  return {
    ...result,
    aiTrace: [
      createAiTraceStep(stage, 'failed', {
        code: result.errorCode,
        message: result.errorMessage,
      }),
    ],
  }
}

function appendTrace(result: FailedJobResult, previousTrace: AiTraceStep[] | undefined): FailedJobResult {
  return {
    ...result,
    aiTrace: [...(previousTrace ?? []), ...result.aiTrace],
  }
}

function createAiTraceStep(
  stage: AiTraceStage,
  status: AiTraceStep['status'],
  details: {
    code?: string
    message?: string
    response?: unknown
  } = {},
): AiTraceStep {
  return {
    stage,
    status,
    code: details.code,
    message: details.message,
    responseSummary: summarizeAiTraceResponse(details.response),
    response: sanitizeAiTraceResponse(details.response),
  }
}

function summarizeAiTraceResponse(response: unknown) {
  if (response === undefined) {
    return undefined
  }

  try {
    return JSON.stringify(sanitizeAiTraceResponse(response)).slice(0, 800)
  } catch {
    return undefined
  }
}

function sanitizeAiTraceResponse(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (/^data:image\//u.test(value)) {
      return `${value.slice(0, 32)}...[image-data:${value.length}]`
    }

    return value.length > 500 ? `${value.slice(0, 500)}...[truncated:${value.length}]` : value
  }

  if (depth >= 3) {
    return '[max-depth]'
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeAiTraceResponse(item, depth + 1))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item]) => [key, sanitizeAiTraceResponse(item, depth + 1)]),
    )
  }

  return String(value)
}

async function persistGeneratedImages(
  job: WorkerJob,
  result: FailedJobResult | ReadyJobResult,
  config: WorkerConfig,
  fetcher: Fetcher,
) {
  if (result.status === 'failed' || config.imageStorageMode === 'inline') {
    return result
  }

  if (!isBase64DataUrl(result.sheetUrl)) {
    return result
  }

  if (!config.imagePublicBaseUrl) {
    return appendTrace(
      createStageFailure('storage', 'IMAGE_STORAGE_NOT_CONFIGURED', 'IMAGE_PUBLIC_BASE_URL is required when image storage is enabled.'),
      result.aiTrace,
    )
  }

  const storedSheetUrl = await persistDataUrl({
    dataUrl: result.sheetUrl,
    mode: config.imageStorageMode,
    storageDir: config.imageStorageDir,
    uploadUrl: config.imageStorageUploadUrl,
    uploadToken: config.imageStorageUploadToken,
    publicBaseUrl: config.imagePublicBaseUrl,
    fileStem: createStoredImageStem(job, 'sheet'),
    workerId: config.workerId,
    fetcher,
  })

  if (!storedSheetUrl) {
    return appendTrace(
      createStageFailure('storage', 'IMAGE_STORAGE_FAILED', 'Generated image could not be stored.'),
      result.aiTrace,
    )
  }

  return {
    ...result,
    sheetUrl: storedSheetUrl,
  }
}

async function persistDataUrl({
  dataUrl,
  mode,
  storageDir,
  uploadUrl,
  uploadToken,
  publicBaseUrl,
  fileStem,
  workerId,
  fetcher,
}: {
  dataUrl: string
  mode: ImageStorageMode
  storageDir: string | null
  uploadUrl: string | null
  uploadToken: string | null
  publicBaseUrl: string
  fileStem: string
  workerId: string
  fetcher: Fetcher
}) {
  const parsed = parseDataUrl(dataUrl)

  if (!parsed) {
    return null
  }

  const filename = `${fileStem}.${mimeToExtension(parsed.mime)}`

  if (mode === 'local') {
    if (!storageDir) {
      return null
    }

    await mkdir(storageDir, { recursive: true })

    const filePath = join(storageDir, filename)

    await writeFile(filePath, parsed.buffer)

    return createPublicImageUrl(publicBaseUrl, filename)
  }

  if (mode === 'http-put') {
    if (!uploadUrl) {
      return null
    }

    return uploadImageObject({
      uploadUrl,
      uploadToken,
      publicBaseUrl,
      filename,
      mime: parsed.mime,
      buffer: parsed.buffer,
      workerId,
      fetcher,
    })
  }

  return null
}

async function uploadImageObject({
  uploadUrl,
  uploadToken,
  publicBaseUrl,
  filename,
  mime,
  buffer,
  workerId,
  fetcher,
}: {
  uploadUrl: string
  uploadToken: string | null
  publicBaseUrl: string
  filename: string
  mime: string
  buffer: Buffer
  workerId: string
  fetcher: Fetcher
}) {
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'x-worker-id': workerId,
  }

  if (uploadToken) {
    headers.Authorization = `Bearer ${uploadToken}`
  }

  const response = await fetcher(`${trimTrailingSlash(uploadUrl)}/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    headers,
    body: buffer,
  })

  if (!response.ok) {
    return null
  }

  const body = await readJsonSafely(response)
  const explicitUrl = readStringFromRecord(body, 'publicUrl') ?? readStringFromRecord(body, 'url')

  return explicitUrl ?? createPublicImageUrl(publicBaseUrl, filename)
}

function createPublicImageUrl(publicBaseUrl: string, filename: string) {
  return `${trimTrailingSlash(publicBaseUrl)}/${encodeURIComponent(basename(filename))}`
}

function parseDataUrl(value: string) {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(value)

  if (!match) {
    return null
  }

  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function isBase64DataUrl(value: string) {
  return /^data:([^;,]+);base64,/u.test(value)
}

function createStoredImageStem(job: WorkerJob, suffix: string) {
  return [job.id, job.action, suffix]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .slice(0, 120)
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

function readGenerationMode(value: string | undefined): WorkerConfig['generationMode'] | null {
  return value === 'wan' || value === 'gateway' ? value : null
}

function validateProductionWorkerConfig(env: NodeJS.ProcessEnv, config: WorkerConfig) {
  if (env.NODE_ENV !== 'production') {
    return
  }

  const failures: string[] = []

  requireHttpUrlValue(failures, config.serverUrl, 'SERVER_URL')
  requireProductionSecretValue(failures, config.workerToken, 'WORKER_TOKEN')

  if (config.simulate) {
    failures.push('GPU_WORKER_SIMULATE must be false for production asset generation')
  }

  if (env.GPU_WORKER_GENERATION_MODE && !readGenerationMode(env.GPU_WORKER_GENERATION_MODE)) {
    failures.push('GPU_WORKER_GENERATION_MODE must be wan or gateway')
  }

  if (config.generationMode === 'wan') {
    requireHttpUrlValue(failures, config.qwenBaseUrl, 'QWEN_BASE_URL')
    requireProductionSecretValue(failures, config.qwenApiToken, 'QWEN_API_TOKEN')
    requireHttpUrlValue(failures, config.wanBaseUrl, 'WAN_API_BASE_URL')
    requireProductionSecretValue(failures, config.wanApiToken, 'WAN_API_TOKEN')
    requireNonPlaceholderValue(failures, config.wanGeneratePath, 'WAN_GENERATE_PATH')
  } else {
    requireHttpUrlValue(failures, config.gatewayUrl, 'GENERATION_GATEWAY_URL')
    requireNonPlaceholderValue(failures, config.gatewayGeneratePath, 'GENERATION_GATEWAY_PATH')
  }

  if (config.imageStorageMode === 'inline') {
    failures.push('IMAGE_STORAGE_MODE must be local or http-put for production')
  } else if (config.imageStorageMode === 'local') {
    requireNonPlaceholderValue(failures, config.imageStorageDir, 'IMAGE_STORAGE_DIR')
    requireHttpUrlValue(failures, config.imagePublicBaseUrl, 'IMAGE_PUBLIC_BASE_URL', { publicUrl: true })
  } else {
    requireHttpUrlValue(failures, config.imageStorageUploadUrl, 'IMAGE_STORAGE_UPLOAD_URL')
    requireProductionSecretValue(failures, config.imageStorageUploadToken, 'IMAGE_STORAGE_UPLOAD_TOKEN')
    requireHttpUrlValue(failures, config.imagePublicBaseUrl, 'IMAGE_PUBLIC_BASE_URL', { publicUrl: true })
  }

  if (failures.length > 0) {
    throw new Error(`GPU worker production config invalid: ${failures.join('; ')}`)
  }
}

function requireProductionSecretValue(failures: string[], value: string | null | undefined, variableName: string) {
  if (!isProductionSecretConfigured(value)) {
    failures.push(`${variableName} must be a real production secret with at least 16 characters`)
  }
}

function requireHttpUrlValue(
  failures: string[],
  value: string | null | undefined,
  variableName: string,
  options: { publicUrl?: boolean } = {},
) {
  if (!requireNonPlaceholderValue(failures, value, variableName)) {
    return
  }

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    failures.push(`${variableName} must be an http(s) URL`)
    return
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    failures.push(`${variableName} must be an http(s) URL`)
  }

  if (options.publicUrl && LOCAL_HOSTNAMES.has(parsed.hostname)) {
    failures.push(`${variableName} must not point to localhost for production`)
  }
}

function requireNonPlaceholderValue(
  failures: string[],
  value: string | null | undefined,
  variableName: string,
) {
  if (!value || isPlaceholderValue(value)) {
    failures.push(`${variableName} must be replaced with a real production value`)
    return false
  }

  return true
}

function isProductionSecretConfigured(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()

  return normalized.length >= 16 && normalized !== 'dev-worker-token' && !isPlaceholderValue(normalized)
}

function isPlaceholderValue(value: string) {
  const normalized = value.trim().toLowerCase()
  const placeholderFragments = [
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

  return !normalized || placeholderFragments.some((fragment) => normalized.includes(fragment))
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function readImageStorageMode(env: NodeJS.ProcessEnv): ImageStorageMode {
  const explicitMode = env.IMAGE_STORAGE_MODE?.trim().toLowerCase()

  if (explicitMode === 'inline' || explicitMode === 'local' || explicitMode === 'http-put') {
    return explicitMode
  }

  if (env.IMAGE_STORAGE_UPLOAD_URL) {
    return 'http-put'
  }

  if (env.IMAGE_STORAGE_DIR && env.IMAGE_PUBLIC_BASE_URL) {
    return 'local'
  }

  return 'inline'
}

function dataUrlToBlob(value: string) {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(value)

  if (!match) {
    return createStageFailure('qwen', 'INVALID_IMAGE_DATA_URL', 'AI worker jobs require a base64 data URL source image.')
  }

  return {
    status: 'ready' as const,
    blob: new Blob([Buffer.from(match[2], 'base64')], {
      type: match[1],
    }),
  }
}

function createUserPrompt(job: WorkerJob) {
  const pieces = [
    job.name,
    job.description,
    job.category ? `category: ${job.category}` : '',
    job.action ? `action: ${job.action}` : '',
  ].filter(Boolean)

  return pieces.join('\n') || 'platformer sprite asset'
}

function mapQwenAssetType(category: string | null) {
  if (category === 'platform') {
    return 'TERRAIN'
  }

  if (category === 'obstacle') {
    return 'DEVICE'
  }

  if (category === 'monster') {
    return 'ENEMY'
  }

  if (category === 'item') {
    return 'ITEM'
  }

  if (category === 'background') {
    return 'BACKGROUND'
  }

  return undefined
}

function getOutputWidth(job: WorkerJob) {
  if (job.category === 'avatar') {
    return 256
  }

  return job.widthCells && job.widthCells > 0 ? job.widthCells * 32 : 512
}

function getOutputHeight(job: WorkerJob) {
  if (job.category === 'avatar') {
    return 512
  }

  return job.heightCells && job.heightCells > 0 ? job.heightCells * 32 : 512
}

function mimeToExtension(mime: string) {
  if (mime === 'image/jpeg') {
    return 'jpg'
  }

  if (mime === 'image/webp') {
    return 'webp'
  }

  return 'png'
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

function readStringFromRecord(value: unknown, key: string) {
  return isRecord(value) ? readString(value[key]) : undefined
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

function readNestedErrorCode(value: unknown) {
  if (!isRecord(value)) {
    return undefined
  }

  if (typeof value.code === 'string') {
    return value.code
  }

  if (isRecord(value.error) && typeof value.error.code === 'string') {
    return value.error.code
  }

  return undefined
}

function readSpriteBackground(value: Record<string, unknown>) {
  const directBackground = readString(value.background)

  if (directBackground) {
    return directBackground
  }

  if (isRecord(value.sprite_requirements)) {
    return readString(value.sprite_requirements.background)
  }

  if (isRecord(value.spriteRequirements)) {
    return readString(value.spriteRequirements.background)
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
  const validProductionEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    SERVER_URL: 'http://backend.internal:3000',
    WORKER_TOKEN: 'worker-token-1234567890',
    GPU_WORKER_SIMULATE: 'false',
    GPU_WORKER_GENERATION_MODE: 'wan',
    QWEN_BASE_URL: 'http://qwen.internal:8001',
    QWEN_API_TOKEN: 'qwen-token-1234567890',
    WAN_API_BASE_URL: 'http://wan.internal:8002',
    WAN_API_TOKEN: 'wan-token-1234567890',
    WAN_GENERATE_PATH: '/v1/sprites/generate',
    IMAGE_STORAGE_MODE: 'http-put',
    IMAGE_STORAGE_UPLOAD_URL: 'http://storage.internal/generated-assets',
    IMAGE_STORAGE_UPLOAD_TOKEN: 'upload-token-1234567890',
    IMAGE_PUBLIC_BASE_URL: 'https://cdn.test/generated-assets',
  }

  assert.equal(loadWorkerConfig(validProductionEnv).workerToken, 'worker-token-1234567890')
  assert.throws(() => loadWorkerConfig({
    ...validProductionEnv,
    WORKER_TOKEN: 'dev-worker-token',
  }), /WORKER_TOKEN/)
  assert.throws(() => loadWorkerConfig({
    ...validProductionEnv,
    GPU_WORKER_SIMULATE: 'true',
  }), /GPU_WORKER_SIMULATE/)
  assert.throws(() => loadWorkerConfig({
    ...validProductionEnv,
    IMAGE_STORAGE_MODE: 'inline',
  }), /IMAGE_STORAGE_MODE/)

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
    generationMode: 'wan',
    qwenBaseUrl: null,
    qwenApiToken: null,
    qwenTimeoutMs: 1_000,
    wanBaseUrl: null,
    wanApiToken: null,
    wanGeneratePath: '/v1/sprites/generate',
    wanTimeoutMs: 1_000,
    gatewayUrl: null,
    gatewayGeneratePath: '/v2/sprite-jobs/generate',
    gatewayTimeoutMs: 1_000,
    imageStorageMode: 'inline',
    imageStorageDir: null,
    imageStorageUploadUrl: null,
    imageStorageUploadToken: null,
    imagePublicBaseUrl: null,
  }, fetcher)

  assert.equal(result.status, 'ready')
  assert.equal(calls.length, 2)
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer worker-token')
  assert.match(String(calls[1].init?.body), /sheetUrl/)

  const storageDir = await mkdtemp(join(tmpdir(), 'gpu-worker-self-test-'))
  const wanCalls: Array<{ url: string; init?: RequestInit }> = []
  const wanResult = await runJob({
    id: 'job-wan-test',
    userId: 'user-wan-test',
    assetId: 'asset-wan-test',
    category: 'platform',
    name: 'WAN Test',
    description: 'green platform',
    image: 'data:image/png;base64,AA==',
    attrs: { shape: 'flat' },
    widthCells: 2,
    heightCells: 1,
    action: 'static',
    requestedActions: ['static'],
  }, {
    serverUrl: 'http://server.test',
    workerToken: 'worker-token',
    workerId: 'self-test-worker',
    pollIntervalMs: 1,
    simulate: false,
    generationMode: 'wan',
    qwenBaseUrl: 'http://qwen.test',
    qwenApiToken: 'qwen-token',
    qwenTimeoutMs: 1_000,
    wanBaseUrl: 'http://wan.test',
    wanApiToken: 'wan-token',
    wanGeneratePath: '/v1/sprites/generate',
    wanTimeoutMs: 1_000,
    gatewayUrl: null,
    gatewayGeneratePath: '/v2/sprite-jobs/generate',
    gatewayTimeoutMs: 1_000,
    imageStorageMode: 'local',
    imageStorageDir: storageDir,
    imageStorageUploadUrl: null,
    imageStorageUploadToken: null,
    imagePublicBaseUrl: 'http://assets.test/generated',
  }, async (url, init) => {
    wanCalls.push({ url: String(url), init })

    if (String(url) === 'http://qwen.test/v1/prompts/refine') {
      return new Response(JSON.stringify({
        ok: true,
        request_id: 'job-wan-test',
        wan_prompt: 'green platform sprite',
        wan_negative_prompt: 'photorealistic',
        sprite_requirements: {
          background: 'transparent',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      sheet_url: 'data:image/png;base64,cG5n',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  assert.equal(wanResult.status, 'ready')
  assert.equal(wanResult.sheetUrl, 'http://assets.test/generated/job-wan-test-static-sheet.png')
  assert.deepEqual(wanResult.aiTrace?.map((step) => [step.stage, step.status]), [
    ['qwen', 'success'],
    ['wan', 'success'],
  ])
  assert.match(wanResult.aiTrace?.[0]?.responseSummary ?? '', /green platform sprite/)
  assert.match(wanResult.aiTrace?.[1]?.responseSummary ?? '', /sheet_url/)
  assert.equal(await readFile(join(storageDir, 'job-wan-test-static-sheet.png'), 'utf8'), 'png')
  assert.equal(wanCalls[0].url, 'http://qwen.test/v1/prompts/refine')
  assert.equal((wanCalls[0].init?.headers as Record<string, string>)['X-Internal-Token'], 'qwen-token')
  assert.equal(wanCalls[1].url, 'http://wan.test/v1/sprites/generate')
  assert.equal((wanCalls[1].init?.headers as Record<string, string>).Authorization, 'Bearer wan-token')
  assert.match(String(wanCalls[1].init?.body), /green platform sprite/)

  const uploadCalls: Array<{ url: string; init?: RequestInit }> = []
  const uploadResult = await runJob({
    id: 'job-upload-test',
    userId: 'user-upload-test',
    assetId: 'asset-upload-test',
    category: 'background',
    name: 'Upload Test',
    description: 'http upload storage',
    image: 'data:image/png;base64,AA==',
    attrs: {},
    widthCells: 4,
    heightCells: 3,
    action: 'static',
    requestedActions: ['static'],
  }, {
    serverUrl: 'http://server.test',
    workerToken: 'worker-token',
    workerId: 'self-test-worker',
    pollIntervalMs: 1,
    simulate: false,
    generationMode: 'gateway',
    qwenBaseUrl: null,
    qwenApiToken: null,
    qwenTimeoutMs: 1_000,
    wanBaseUrl: null,
    wanApiToken: null,
    wanGeneratePath: '/v1/sprites/generate',
    wanTimeoutMs: 1_000,
    gatewayUrl: 'http://gateway.test',
    gatewayGeneratePath: '/v2/sprite-sheets',
    gatewayTimeoutMs: 1_000,
    imageStorageMode: 'http-put',
    imageStorageDir: null,
    imageStorageUploadUrl: 'http://upload.test/objects',
    imageStorageUploadToken: 'upload-token',
    imagePublicBaseUrl: 'https://cdn.test/generated',
  }, async (url, init) => {
    uploadCalls.push({ url: String(url), init })

    if (String(url) === 'http://gateway.test/v2/sprite-sheets') {
      return new Response(JSON.stringify({
        sheetUrl: 'data:image/png;base64,cG5n',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      publicUrl: 'https://cdn.test/generated/job-upload-test-static-sheet.png',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  assert.equal(uploadResult.status, 'ready')
  assert.equal(uploadResult.sheetUrl, 'https://cdn.test/generated/job-upload-test-static-sheet.png')
  assert.equal(uploadCalls[1].url, 'http://upload.test/objects/job-upload-test-static-sheet.png')
  assert.equal((uploadCalls[1].init?.headers as Record<string, string>).Authorization, 'Bearer upload-token')
  assert.equal((uploadCalls[1].init?.headers as Record<string, string>)['Content-Type'], 'image/png')

  const uploadFailureResult = await runJob({
    id: 'job-upload-failure-test',
    userId: 'user-upload-test',
    assetId: 'asset-upload-test',
    category: 'background',
    name: 'Upload Failure Test',
    description: 'http upload storage failure',
    image: 'data:image/png;base64,AA==',
    attrs: {},
    widthCells: 4,
    heightCells: 3,
    action: 'static',
    requestedActions: ['static'],
  }, {
    serverUrl: 'http://server.test',
    workerToken: 'worker-token',
    workerId: 'self-test-worker',
    pollIntervalMs: 1,
    simulate: false,
    generationMode: 'gateway',
    qwenBaseUrl: null,
    qwenApiToken: null,
    qwenTimeoutMs: 1_000,
    wanBaseUrl: null,
    wanApiToken: null,
    wanGeneratePath: '/v1/sprites/generate',
    wanTimeoutMs: 1_000,
    gatewayUrl: 'http://gateway.test',
    gatewayGeneratePath: '/v2/sprite-sheets',
    gatewayTimeoutMs: 1_000,
    imageStorageMode: 'http-put',
    imageStorageDir: null,
    imageStorageUploadUrl: 'http://upload.test/objects',
    imageStorageUploadToken: 'upload-token',
    imagePublicBaseUrl: 'https://cdn.test/generated',
  }, async (url) => {
    if (String(url) === 'http://gateway.test/v2/sprite-sheets') {
      return new Response(JSON.stringify({
        sheetUrl: 'data:image/png;base64,cG5n',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      error: { code: 'UPLOAD_FAILED' },
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  assert.equal(uploadFailureResult.status, 'failed')
  assert.equal(uploadFailureResult.errorCode, 'IMAGE_STORAGE_FAILED')

  const gatewayCalls: Array<{ url: string; init?: RequestInit }> = []
  const gatewayResult = await runJob({
    id: 'job-gateway-test',
    userId: 'user-gateway-test',
    assetId: 'asset-gateway-test',
    category: 'monster',
    name: 'Gateway Test',
    description: 'Generation gateway contract test',
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
    generationMode: 'gateway',
    qwenBaseUrl: null,
    qwenApiToken: null,
    qwenTimeoutMs: 1_000,
    wanBaseUrl: null,
    wanApiToken: null,
    wanGeneratePath: '/v1/sprites/generate',
    wanTimeoutMs: 1_000,
    gatewayUrl: 'http://gateway.test',
    gatewayGeneratePath: '/v2/sprite-sheets',
    gatewayTimeoutMs: 1_000,
    imageStorageMode: 'inline',
    imageStorageDir: null,
    imageStorageUploadUrl: null,
    imageStorageUploadToken: null,
    imagePublicBaseUrl: null,
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
  assert.equal(gatewayCalls[0].url, 'http://gateway.test/v2/sprite-sheets')
  assert.match(String(gatewayCalls[0].init?.body), /requestedActions/)
  await rm(storageDir, { recursive: true, force: true })
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

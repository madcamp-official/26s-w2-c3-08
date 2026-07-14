export interface AiClientError {
  code: string
  message: string
  retryable: boolean
  status?: number
}

export type AiClientResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AiClientError }

export interface QwenRefineRequest {
  requestId: string
  userId: string
  targetType: 'avatar' | 'asset'
  userPrompt: string
  image: string
  assetType?: string | null
}

export interface QwenRefineResult {
  requestId: string
  model: string
  engine: string
  targetType: 'avatar' | 'asset'
  visualSummaryKo: string
  userIntentKo: string
  wanPrompt: string
  wanNegativePrompt: string
  background: string
  raw: unknown
}

export interface WanGenerateRequest {
  requestId: string
  targetType: 'avatar' | 'asset'
  prompt: string
  negativePrompt: string
  referenceImage: string
  width: number
  height: number
  background: string
}

export interface WanGenerateResult {
  sheetUrl: string
  mimeType: string
  raw: unknown
}

export interface QwenPromptClientOptions {
  baseUrl?: string
  apiToken?: string
  timeoutMs?: number
  fetcher?: typeof fetch
}

export interface WanSpriteClientOptions {
  baseUrl?: string
  apiToken?: string
  generatePath?: string
  timeoutMs?: number
  fetcher?: typeof fetch
}

export function createQwenPromptClient({
  baseUrl = process.env.QWEN_BASE_URL,
  apiToken = process.env.QWEN_API_TOKEN,
  timeoutMs = readPositiveInteger(process.env.QWEN_TIMEOUT_MS, 45_000),
  fetcher = fetch,
}: QwenPromptClientOptions = {}) {
  return {
    async refinePrompt(request: QwenRefineRequest): Promise<AiClientResult<QwenRefineResult>> {
      if (!baseUrl || !apiToken) {
        return createFailure(
          'QWEN_NOT_CONFIGURED',
          'QWEN_BASE_URL and QWEN_API_TOKEN are required before prompt refinement.',
          false,
        )
      }

      const imageBlobResult = dataUrlToBlob(request.image)

      if (imageBlobResult.ok === false) {
        return forwardFailure(imageBlobResult.error)
      }

      const formData = new FormData()

      formData.append('request_id', request.requestId)
      formData.append('user_id', request.userId)
      formData.append('target_type', request.targetType)
      formData.append('user_prompt', request.userPrompt)
      formData.append('locale', 'ko-KR')
      formData.append('style_preset', 'platformer_sprite')
      formData.append('output_language', 'en')

      if (request.assetType) {
        formData.append('asset_type', request.assetType)
      }

      formData.append('image', imageBlobResult.value, `${request.requestId}.${mimeToExtension(imageBlobResult.value.type)}`)

      const responseResult = await postWithTimeout(fetcher, `${trimTrailingSlash(baseUrl)}/v1/prompts/refine`, {
        method: 'POST',
        headers: {
          'X-Internal-Token': apiToken,
        },
        body: formData,
      }, timeoutMs)

      if (responseResult.ok === false) {
        return forwardFailure(responseResult.error)
      }

      const { response } = responseResult.value
      const bodyResult = await readJson(response)

      if (!response.ok) {
        return mapQwenHttpError(response.status, bodyResult.ok ? bodyResult.value : null)
      }

      if (bodyResult.ok === false) {
        return forwardFailure(bodyResult.error)
      }

      return normalizeQwenResponse(bodyResult.value, request.requestId)
    },
  }
}

export function createWanSpriteClient({
  baseUrl = process.env.WAN_API_BASE_URL,
  apiToken = process.env.WAN_API_TOKEN,
  generatePath = process.env.WAN_GENERATE_PATH ?? '/v1/sprites/generate',
  timeoutMs = readPositiveInteger(process.env.WAN_TIMEOUT_MS, 90_000),
  fetcher = fetch,
}: WanSpriteClientOptions = {}) {
  return {
    async generateSprite(request: WanGenerateRequest): Promise<AiClientResult<WanGenerateResult>> {
      if (!baseUrl || !apiToken) {
        return createFailure(
          'WAN_NOT_CONFIGURED',
          'WAN_API_BASE_URL and WAN_API_TOKEN are required before sprite generation.',
          false,
        )
      }

      const responseResult = await postWithTimeout(fetcher, `${trimTrailingSlash(baseUrl)}${ensureLeadingSlash(generatePath)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: request.requestId,
          mode: 'image_to_sprite',
          target_type: request.targetType,
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          reference_image_url: request.referenceImage,
          width: request.width,
          height: request.height,
          background: request.background,
          num_outputs: 1,
        }),
      }, timeoutMs)

      if (responseResult.ok === false) {
        return forwardFailure(responseResult.error)
      }

      const { response } = responseResult.value

      if (!response.ok) {
        const errorBody = await readJson(response)

        return createFailure(
          `WAN_HTTP_${response.status}`,
          readErrorMessage(errorBody.ok ? errorBody.value : null) ?? 'WAN sprite generation failed.',
          response.status === 429 || response.status >= 500,
          response.status,
        )
      }

      return normalizeWanResponse(response)
    },
  }
}

export function createWanRequestFromQwen(
  request: QwenRefineRequest,
  qwenResult: QwenRefineResult,
): WanGenerateRequest {
  return {
    requestId: request.requestId,
    targetType: request.targetType,
    prompt: qwenResult.wanPrompt,
    negativePrompt: qwenResult.wanNegativePrompt,
    referenceImage: request.image,
    width: request.targetType === 'avatar' ? 512 : 512,
    height: request.targetType === 'avatar' ? 512 : 512,
    background: qwenResult.background || 'transparent',
  }
}

async function normalizeWanResponse(response: Response): Promise<AiClientResult<WanGenerateResult>> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      ok: true,
      value: {
        sheetUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
        mimeType: contentType,
        raw: null,
      },
    }
  }

  const bodyResult = await readJson(response)

  if (bodyResult.ok === false) {
    return forwardFailure(bodyResult.error)
  }

  if (!isRecord(bodyResult.value)) {
    return createFailure('WAN_MALFORMED_RESPONSE', 'WAN response is not an object.', false)
  }

  const sheetUrl =
    readString(bodyResult.value.sheetUrl) ??
    readString(bodyResult.value.sheet_url) ??
    readString(bodyResult.value.image) ??
    readString(bodyResult.value.image_url)

  if (!sheetUrl) {
    return createFailure('WAN_MISSING_IMAGE', 'WAN response did not include a generated image.', false)
  }

  return {
    ok: true,
    value: {
      sheetUrl,
      mimeType: readString(bodyResult.value.mimeType) ?? readString(bodyResult.value.mime_type) ?? 'image/png',
      raw: bodyResult.value,
    },
  }
}

function normalizeQwenResponse(value: unknown, expectedRequestId: string): AiClientResult<QwenRefineResult> {
  if (!isRecord(value)) {
    return createFailure('QWEN_MALFORMED_RESPONSE', 'Qwen response is not an object.', false)
  }

  if (value.ok !== true) {
    return createFailure('QWEN_NOT_OK', 'Qwen response did not report ok=true.', false)
  }

  const requestId = readString(value.request_id) ?? readString(value.requestId)
  const wanPrompt = readString(value.wan_prompt) ?? readString(value.wanPrompt)
  const background = isRecord(value.sprite_requirements)
    ? readString(value.sprite_requirements.background)
    : readString(value.background)

  if (requestId !== expectedRequestId) {
    return createFailure('QWEN_REQUEST_ID_MISMATCH', 'Qwen response request_id did not match the job.', false)
  }

  if (!wanPrompt) {
    return createFailure('QWEN_MISSING_WAN_PROMPT', 'Qwen response did not include wan_prompt.', false)
  }

  if (!background) {
    return createFailure('QWEN_MISSING_BACKGROUND', 'Qwen response did not include sprite background requirements.', false)
  }

  return {
    ok: true,
    value: {
      requestId,
      model: readString(value.model) ?? '',
      engine: readString(value.engine) ?? '',
      targetType: value.target_type === 'avatar' ? 'avatar' : 'asset',
      visualSummaryKo: readString(value.visual_summary_ko) ?? '',
      userIntentKo: readString(value.user_intent_ko) ?? '',
      wanPrompt,
      wanNegativePrompt: readString(value.wan_negative_prompt) ?? '',
      background,
      raw: value,
    },
  }
}

async function postWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<AiClientResult<{ response: Response }>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(input, {
      ...init,
      signal: controller.signal,
    })

    return { ok: true, value: { response } }
  } catch (error) {
    return createFailure(
      isAbortError(error) ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR',
      isAbortError(error) ? 'AI request timed out.' : 'AI service could not be reached.',
      true,
    )
  } finally {
    clearTimeout(timeout)
  }
}

function mapQwenHttpError(status: number, body: unknown): AiClientResult<never> {
  const message = readErrorMessage(body) ?? 'Qwen prompt refinement failed.'
  const retryable = status === 422 || status === 429 || status === 500 || status === 503 || status >= 500

  return createFailure(`QWEN_HTTP_${status}`, message, retryable, status)
}

async function readJson(response: Response): Promise<AiClientResult<unknown>> {
  try {
    return { ok: true, value: await response.json() }
  } catch {
    return createFailure('AI_MALFORMED_JSON', 'AI service response was not valid JSON.', false)
  }
}

function dataUrlToBlob(value: string): AiClientResult<Blob> {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(value)

  if (!match) {
    return createFailure('INVALID_IMAGE_DATA_URL', 'AI input image must be a base64 data URL.', false)
  }

  return {
    ok: true,
    value: new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }),
  }
}

function createFailure(code: string, message: string, retryable: boolean, status?: number): AiClientResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable,
      status,
    },
  }
}

function forwardFailure(error: AiClientError): AiClientResult<never> {
  return createFailure(error.code, error.message, error.retryable, error.status)
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

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '')
}

function ensureLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`
}

function mimeToExtension(value: string) {
  if (value === 'image/jpeg') {
    return 'jpg'
  }

  if (value === 'image/webp') {
    return 'webp'
  }

  return 'png'
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

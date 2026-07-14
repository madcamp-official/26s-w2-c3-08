import {
  createWanRequestFromQwen,
  type AiClientError,
  type QwenRefineRequest,
  type QwenRefineResult,
  type WanGenerateResult,
} from './v2AiClients.js'

export interface AssetGenerationAiClients {
  qwen: {
    refinePrompt(request: QwenRefineRequest): Promise<
      | { ok: true; value: QwenRefineResult }
      | { ok: false; error: AiClientError }
    >
  }
  wan: {
    generateSprite(request: ReturnType<typeof createWanRequestFromQwen>): Promise<
      | { ok: true; value: WanGenerateResult }
      | { ok: false; error: AiClientError }
    >
  }
}

export type AssetGenerationPipelineResult =
  | {
      ok: true
      value: {
        status: 'ready'
        sheetUrl: string
        qwen: QwenRefineResult
        wan: WanGenerateResult
      }
    }
  | {
      ok: false
      error: AiClientError
      jobResult: {
        status: 'failed'
        errorCode: string
        errorMessage: string
      }
    }

export async function runAssetGenerationPipeline(
  request: QwenRefineRequest,
  clients: AssetGenerationAiClients,
): Promise<AssetGenerationPipelineResult> {
  const qwenResult = await clients.qwen.refinePrompt(request)

  if (qwenResult.ok === false) {
    return createPipelineFailure(qwenResult.error)
  }

  const wanResult = await clients.wan.generateSprite(createWanRequestFromQwen(request, qwenResult.value))

  if (wanResult.ok === false) {
    return createPipelineFailure(wanResult.error)
  }

  return {
    ok: true,
    value: {
      status: 'ready',
      sheetUrl: wanResult.value.sheetUrl,
      qwen: qwenResult.value,
      wan: wanResult.value,
    },
  }
}

function createPipelineFailure(error: AiClientError): AssetGenerationPipelineResult {
  return {
    ok: false,
    error,
    jobResult: {
      status: 'failed',
      errorCode: error.code,
      errorMessage: error.message,
    },
  }
}

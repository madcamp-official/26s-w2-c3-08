import type {
  AssetJobConnectionEvent,
  AssetJobUpdateEvent,
  AssetJobUpdates,
} from '../../pages/warehouse/warehouseControllerCore'
import type { WarehouseAiTraceStep } from '../../pages/warehouse/WarehouseScreen'
import type { LoginSession } from '../../pages/login/loginControllerCore'
import { createSocketIoRemoteRealtimeAdapters } from '../realtime/socketIoRemoteAdapters'
import type { V2RealtimeConnectionStatus } from '../realtime/socketIoTransport'
import { logMalformedResponse } from '../diagnostics/malformedResponseLogger'

interface RemoteAssetJobUpdatesOptions {
  adapters?: ReturnType<typeof createSocketIoRemoteRealtimeAdapters>
  baseUrl?: string
  fetcher?: typeof fetch
  getSession?: () => LoginSession | null
  pollIntervalMs?: number
  maxPollMs?: number
}

export function createRemoteAssetJobUpdates({
  adapters = createSocketIoRemoteRealtimeAdapters(),
  baseUrl = '',
  fetcher = fetch,
  getSession = loadBrowserSession,
  pollIntervalMs = 5_000,
  maxPollMs = 2 * 60 * 1_000,
}: RemoteAssetJobUpdatesOptions = {}): AssetJobUpdates {
  let pollingStatus: AssetJobConnectionEvent | null = null

  return {
    getConnectionStatus() {
      return pollingStatus ?? mapRemoteStatus(adapters.transport.getStatus())
    },
    subscribe(listener) {
      const unsubscribeStatus = adapters.transport.onStatusChange((status) => {
        const mappedStatus = mapRemoteStatus(status)
        pollingStatus = mappedStatus
        listener(mappedStatus)
      })
      const unsubscribeJob = adapters.assetJobUpdates.subscribe((job) => {
        listener({
          assetId: job.outputAssetId ?? job.id,
          status: job.status,
          action: job.action ?? undefined,
          errorCode: job.errorCode ?? undefined,
          errorMessage: job.errorMessage ?? undefined,
          aiTrace: normalizeAiTrace(job.aiTrace),
        } satisfies AssetJobUpdateEvent)
      })
      const stopPolling = startAssetJobPolling({
        baseUrl,
        fetcher,
        getSession,
        pollIntervalMs,
        maxPollMs,
        onStatus(status) {
          pollingStatus = status
          listener(status)
        },
        onJob(job) {
          listener(job)
        },
      })

      return () => {
        unsubscribeStatus()
        unsubscribeJob()
        stopPolling()
      }
    },
  }
}

interface AssetJobPollingOptions {
  baseUrl: string
  fetcher: typeof fetch
  getSession: () => LoginSession | null
  pollIntervalMs: number
  maxPollMs: number
  onStatus: (event: AssetJobConnectionEvent) => void
  onJob: (event: AssetJobUpdateEvent) => void
}

function startAssetJobPolling({
  baseUrl,
  fetcher,
  getSession,
  pollIntervalMs,
  maxPollMs,
  onStatus,
  onJob,
}: AssetJobPollingOptions) {
  let active = true
  const seenStatuses = new Map<string, string>()
  const startedAtMs = Date.now()

  async function poll() {
    if (!active) {
      return
    }

    const session = getSession()

    if (!session) {
      onStatus({
        status: 'offline',
        message: '에셋 작업 상태를 확인할 세션이 없어요.',
      })
      return
    }

    if (Date.now() - startedAtMs > maxPollMs) {
      onStatus({
        status: 'server_unavailable',
        message: '에셋 작업 상태 확인 시간이 초과되었어요.',
      })
      active = false
      return
    }

    try {
      const input = `${baseUrl}/api/asset-jobs?user_id=${encodeURIComponent(session.id)}`
      const response = await fetcher(
        input,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        },
      )

      if (!response.ok) {
        onStatus(mapPollingHttpStatus(response.status))
        return
      }

      let body: unknown

      try {
        body = await response.json()
      } catch {
        logMalformedResponse({
          source: 'api',
          adapter: 'remoteAssetJobUpdates',
          operation: 'assetJobs.poll',
          reason: 'invalid_json',
          endpoint: input,
          status: response.status,
        })
        onStatus({
          status: 'malformed_response',
          message: '에셋 작업 상태 응답 형식이 올바르지 않아요.',
        })
        return
      }

      const jobs = unwrapJobs(body)

      if (!jobs) {
        logMalformedResponse({
          source: 'api',
          adapter: 'remoteAssetJobUpdates',
          operation: 'assetJobs.poll',
          reason: 'unexpected_shape',
          endpoint: input,
          status: response.status,
          body,
        })
        onStatus({
          status: 'malformed_response',
          message: '에셋 작업 상태 응답 형식이 올바르지 않아요.',
        })
        return
      }

      onStatus({ status: 'online' })

      for (const job of jobs) {
        const event = normalizePolledJob(job)

        if (!event) {
          continue
        }

        const previousStatus = seenStatuses.get(jobKey(event))

        if (previousStatus === event.status) {
          continue
        }

        seenStatuses.set(jobKey(event), event.status)
        onJob(event)
      }
    } catch {
      onStatus({
        status: 'server_unavailable',
        message: '에셋 작업 상태를 확인할 수 없어요.',
      })
    }
  }

  void poll()
  const intervalId = globalThis.setInterval(() => {
    void poll()
  }, pollIntervalMs)

  return () => {
    active = false
    globalThis.clearInterval(intervalId)
  }
}

function mapPollingHttpStatus(status: number): AssetJobConnectionEvent {
  if (status === 401 || status === 403) {
    return {
      status: 'offline',
      message: '에셋 작업 상태를 확인하려면 다시 로그인해주세요.',
    }
  }

  return {
    status: 'server_unavailable',
    message: '에셋 작업 상태 서버에 연결할 수 없어요.',
  }
}

function unwrapJobs(body: unknown): Array<Record<string, unknown>> | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = Array.isArray(body.jobs) ? body.jobs : Array.isArray(body.data) ? body.data : null

  return candidate ? candidate.filter(isRecord) : null
}

function normalizePolledJob(job: Record<string, unknown>): AssetJobUpdateEvent | null {
  const assetId = readString(job.outputAssetId) ?? readString(job.output_asset_id) ?? readString(job.id)
  const status = normalizeStatus(readString(job.status))

  if (!assetId || !status) {
    return null
  }

  return {
    assetId,
    status,
    action: normalizeAction(readString(job.action)) ?? undefined,
    errorCode: readString(job.errorCode) ?? readString(job.error_code) ?? undefined,
    errorMessage: readString(job.errorMessage) ?? readString(job.error_message) ?? undefined,
    aiTrace: normalizeAiTrace(job.aiTrace) ?? normalizeAiTrace(job.ai_trace),
    updatedAtMs: readNumber(job.updatedAtMs) ?? readNumber(job.updated_at_ms) ?? undefined,
  }
}

function jobKey(event: AssetJobUpdateEvent) {
  return `${event.assetId}:${event.action ?? 'asset'}`
}

function mapRemoteStatus(status: V2RealtimeConnectionStatus): AssetJobConnectionEvent {
  if (status === 'connected') {
    return { status: 'online' }
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return {
      status: 'reconnecting',
      message: '에셋 작업 상태를 다시 연결하고 있어요.',
    }
  }

  if (status === 'offline') {
    return {
      status: 'offline',
      message: '에셋 작업 상태 연결이 끊어졌어요.',
    }
  }

  return {
    status: 'server_unavailable',
    message: '에셋 작업 실시간 연결을 사용할 수 없어요.',
  }
}

function loadBrowserSession(): LoginSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawSession = window.localStorage.getItem('relay.session')

  if (!rawSession) {
    return null
  }

  try {
    const parsedSession = JSON.parse(rawSession) as Partial<LoginSession>

    if (
      typeof parsedSession.id === 'string' &&
      typeof parsedSession.nickname === 'string' &&
      typeof parsedSession.token === 'string'
    ) {
      return {
        id: parsedSession.id,
        nickname: parsedSession.nickname,
        token: parsedSession.token,
        avatarAssetId: typeof parsedSession.avatarAssetId === 'string' ? parsedSession.avatarAssetId : undefined,
      }
    }
  } catch {
    return null
  }

  return null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeStatus(value: string | undefined): AssetJobUpdateEvent['status'] | null {
  if (value === 'queued' || value === 'generating' || value === 'ready' || value === 'failed') {
    return value
  }

  return null
}

function normalizeAction(value: string | undefined): AssetJobUpdateEvent['action'] | null {
  if (value === 'idle' || value === 'walk' || value === 'onair' || value === 'static') {
    return value
  }

  return null
}

function normalizeAiTrace(value: unknown): WarehouseAiTraceStep[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter(isRecord).flatMap((step) => {
    const stage = normalizeAiStage(readString(step.stage))
    const status = normalizeAiStatus(readString(step.status))

    if (!stage || !status) {
      return []
    }

    return [
      {
        stage,
        status,
        code: readString(step.code),
        message: readString(step.message),
        responseSummary:
          readString(step.responseSummary) ??
          readString(step.response_summary) ??
          summarizeTraceResponse(step.response),
      },
    ]
  })
}

function normalizeAiStage(value: string | undefined): WarehouseAiTraceStep['stage'] | null {
  if (value === 'qwen' || value === 'wan' || value === 'gateway' || value === 'storage') {
    return value
  }

  return value ? 'unknown' : null
}

function normalizeAiStatus(value: string | undefined): WarehouseAiTraceStep['status'] | null {
  if (value === 'success' || value === 'failed') {
    return value
  }

  return null
}

function summarizeTraceResponse(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  try {
    return JSON.stringify(value).slice(0, 800)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

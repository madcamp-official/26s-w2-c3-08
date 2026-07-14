export type MalformedResponseSource = 'api' | 'realtime' | 'storage' | 'drawing' | 'phaser'
export type MalformedResponseReason = 'invalid_json' | 'unexpected_shape'

export interface MalformedResponseLogEntry {
  source: MalformedResponseSource
  adapter: string
  operation: string
  reason: MalformedResponseReason
  endpoint?: RequestInfo | URL | string
  status?: number
  body?: unknown
}

export type MalformedResponseLogger = (
  message: string,
  details: Record<string, unknown>,
) => void

const REDACTED = '[redacted]'
const MAX_STRING_LENGTH = 160
const MAX_ARRAY_ITEMS = 5
const MAX_OBJECT_KEYS = 12
const MAX_DEPTH = 3
const SENSITIVE_KEY_PATTERN =
  /(authorization|bearer|token|password|secret|api[_-]?key|credential|cookie|session)/i

export function logMalformedResponse(
  entry: MalformedResponseLogEntry,
  logger: MalformedResponseLogger = defaultMalformedResponseLogger,
) {
  logger('[frontend-v2] malformed response', removeUndefinedValues({
    source: entry.source,
    adapter: entry.adapter,
    operation: entry.operation,
    reason: entry.reason,
    endpoint: sanitizeEndpoint(entry.endpoint),
    status: entry.status,
    body: sanitizeLogValue(entry.body),
  }))
}

export function sanitizeEndpoint(endpoint: MalformedResponseLogEntry['endpoint']) {
  if (!endpoint) {
    return undefined
  }

  const rawEndpoint =
    typeof endpoint === 'string'
      ? endpoint
      : endpoint instanceof URL
        ? endpoint.toString()
        : 'url' in endpoint
          ? endpoint.url
          : String(endpoint)

  try {
    const url = new URL(rawEndpoint, 'http://frontend-v2.local')
    const sanitized = `${url.origin}${url.pathname}`

    return url.origin === 'http://frontend-v2.local' ? url.pathname : sanitized
  } catch {
    const [withoutHash] = rawEndpoint.split('#')
    const [withoutQuery] = withoutHash.split('?')

    return withoutQuery
  }
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (value === undefined) {
    return undefined
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return truncateString(value)
  }

  if (depth >= MAX_DEPTH) {
    return '[truncated]'
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeLogValue(item, depth + 1))
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS)
    const sanitized: Record<string, unknown> = {}

    for (const [key, nestedValue] of entries) {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : sanitizeLogValue(nestedValue, depth + 1)
    }

    return sanitized
  }

  return String(value)
}

function defaultMalformedResponseLogger(
  message: string,
  details: Record<string, unknown>,
) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(message, details)
  }
}

function removeUndefinedValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  )
}

function truncateString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`
}

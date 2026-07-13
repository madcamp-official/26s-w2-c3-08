export type DataMode = 'mock' | 'remote'
export type RealtimeMode = 'local' | 'remote'
export type ApiAdapterKind = 'mockApi' | 'remoteApi'
export type RealtimeAdapterKind = 'localRealtime' | 'remoteRealtime'

export interface ModeEnv {
  VITE_DATA_MODE?: string
  VITE_REALTIME_MODE?: string
}

export interface ModeParserOptions {
  isProduction?: boolean
}

export interface V2ModeConfig {
  dataMode: DataMode
  realtimeMode: RealtimeMode
  apiAdapterKind: ApiAdapterKind
  realtimeAdapterKind: RealtimeAdapterKind
  allowMockApiFallback: false
  allowLocalRealtimeFallback: false
}

export class ConfigurationError extends Error {
  readonly variableName: string
  readonly receivedValue: string | undefined

  constructor(variableName: string, receivedValue: string | undefined, expectedValues: string[]) {
    super(
      `${variableName} must be one of ${expectedValues.join(', ')}${
        receivedValue === undefined ? '' : `; received ${receivedValue}`
      }`,
    )
    this.name = 'ConfigurationError'
    this.variableName = variableName
    this.receivedValue = receivedValue
  }
}

export function parseDataMode(value: string | undefined, options: ModeParserOptions = {}): DataMode {
  const normalizedValue = normalizeModeValue(value)

  if (normalizedValue === undefined) {
    if (options.isProduction === true) {
      throw new ConfigurationError('VITE_DATA_MODE', value, ['mock', 'remote'])
    }

    return 'mock'
  }

  if (normalizedValue === 'mock' || normalizedValue === 'remote') {
    return normalizedValue
  }

  throw new ConfigurationError('VITE_DATA_MODE', value, ['mock', 'remote'])
}

export function parseRealtimeMode(
  value: string | undefined,
  options: ModeParserOptions = {},
): RealtimeMode {
  const normalizedValue = normalizeModeValue(value)

  if (normalizedValue === undefined) {
    if (options.isProduction === true) {
      throw new ConfigurationError('VITE_REALTIME_MODE', value, ['local', 'remote'])
    }

    return 'local'
  }

  if (normalizedValue === 'local' || normalizedValue === 'remote') {
    return normalizedValue
  }

  throw new ConfigurationError('VITE_REALTIME_MODE', value, ['local', 'remote'])
}

export function resolveV2ModeConfig(
  env: ModeEnv = readImportMetaEnv(),
  options: ModeParserOptions = {},
): V2ModeConfig {
  const dataMode = parseDataMode(env.VITE_DATA_MODE, options)
  const realtimeMode = parseRealtimeMode(env.VITE_REALTIME_MODE, options)

  return {
    dataMode,
    realtimeMode,
    apiAdapterKind: dataMode === 'mock' ? 'mockApi' : 'remoteApi',
    realtimeAdapterKind: realtimeMode === 'local' ? 'localRealtime' : 'remoteRealtime',
    allowMockApiFallback: false,
    allowLocalRealtimeFallback: false,
  }
}

function normalizeModeValue(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase()

  return normalizedValue === '' ? undefined : normalizedValue
}

function readImportMetaEnv(): ModeEnv {
  const meta = import.meta as ImportMeta & { env?: ModeEnv }

  return meta.env ?? {}
}

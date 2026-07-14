export type ContractRouteModel =
  | { kind: 'login'; screenId: 'S1_LOGIN' }
  | { kind: 'main'; screenId: 'S2_MAIN' }
  | { kind: 'lobby'; screenId: 'S3_LOBBY' }
  | { kind: 'room'; screenId: 'C_ROOM_LOBBY'; roomId: string }
  | { kind: 'mapBuild'; screenId: 'S4_MAP_BUILD'; roomId: string }
  | { kind: 'validation'; screenId: 'D_VALIDATION'; roomId: string; segmentId?: string }
  | { kind: 'merging'; screenId: 'M_MERGING'; roomId: string }
  | { kind: 'race'; screenId: 'E_RACE'; roomId: string; mergedMapId?: string }
  | { kind: 'results'; screenId: 'F_RESULTS'; roomId: string }
  | {
      kind: 'avatarStudio'
      screenId: 'A_AVATAR_STUDIO'
      mode: 'new' | 'edit' | 'remix'
      sourceAssetId?: string
    }
  | {
      kind: 'assetStudio'
      screenId: 'B_ASSET_STUDIO'
      mode: 'new' | 'edit' | 'remix'
      sourceAssetId?: string
    }
  | {
      kind: 'warehouse'
      screenId: 'S2B_WAREHOUSE'
      tab: 'avatar' | 'component'
      filter?: 'all' | 'platform' | 'obstacle' | 'monster' | 'background'
    }

export type PrototypeRoute =
  | {
      kind: 'uiLab'
      path: 'ui-lab'
      label: 'UI Lab'
      query: PrototypeRouteQuery
    }
  | {
      kind: 'stateGallery'
      path: 'state-gallery'
      label: 'State Gallery'
      query: PrototypeRouteQuery
    }
  | {
      kind: 'shells'
      path: 'shells'
      label: 'Shells'
      query: PrototypeRouteQuery
    }
  | {
      kind: 'login'
      path: 'login'
      label: 'Login'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'login' }>
    }
  | {
      kind: 'main'
      path: 'main'
      label: 'Main'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'main' }>
    }
  | {
      kind: 'lobby'
      path: 'lobby'
      label: 'Lobby'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'lobby' }>
    }
  | {
      kind: 'room'
      path: 'room'
      label: 'Room'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'room' }>
    }
  | {
      kind: 'mapBuild'
      path: 'map-build'
      label: 'Map Build Preview'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'mapBuild' }>
    }
  | {
      kind: 'validation'
      path: 'validation'
      label: 'Validation'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'validation' }>
    }
  | {
      kind: 'merging'
      path: 'merging'
      label: 'Merging'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'merging' }>
    }
  | {
      kind: 'race'
      path: 'race'
      label: 'Race'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'race' }>
    }
  | {
      kind: 'results'
      path: 'results'
      label: 'Results'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'results' }>
    }
  | {
      kind: 'avatarStudio'
      path: 'avatar-studio'
      label: 'Avatar Studio'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'avatarStudio' }>
    }
  | {
      kind: 'assetStudio'
      path: 'asset-studio'
      label: 'Asset Studio'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'assetStudio' }>
    }
  | {
      kind: 'warehouse'
      path: 'warehouse'
      label: 'Warehouse'
      query: PrototypeRouteQuery
      contractRoute: Extract<ContractRouteModel, { kind: 'warehouse' }>
    }
  | {
      kind: 'notFound'
      path: 'not-found'
      label: 'V2 NotFound'
      requestedPath: string
      query: PrototypeRouteQuery
    }

export type PrototypeRoutePath = Exclude<PrototypeRoute['path'], 'not-found'>
export type PrototypeRouteQuery = Record<string, string>

export interface PrototypeNavItem {
  path: PrototypeRoutePath
  label: string
  query?: PrototypeRouteQuery
}

export const prototypeNavItems: PrototypeNavItem[] = [
  { path: 'ui-lab', label: 'UI Lab' },
  { path: 'state-gallery', label: 'State Gallery' },
  { path: 'shells', label: 'Shells' },
  { path: 'login', label: 'Login' },
  { path: 'main', label: 'Main' },
  { path: 'lobby', label: 'Lobby' },
  { path: 'avatar-studio', label: 'Avatar Studio' },
  { path: 'asset-studio', label: 'Asset Studio' },
  { path: 'warehouse', label: 'Warehouse' },
]

export function parsePrototypeHash(hash: string): PrototypeRoute {
  const { path, query } = parseHashParts(hash)

  switch (path) {
    case 'ui-lab':
      return { kind: 'uiLab', path, label: 'UI Lab', query }
    case 'state-gallery':
      return { kind: 'stateGallery', path, label: 'State Gallery', query }
    case 'shells':
      return { kind: 'shells', path, label: 'Shells', query }
    case 'login':
      return {
        kind: 'login',
        path,
        label: 'Login',
        query,
        contractRoute: { kind: 'login', screenId: 'S1_LOGIN' },
      }
    case 'main':
      return {
        kind: 'main',
        path,
        label: 'Main',
        query,
        contractRoute: { kind: 'main', screenId: 'S2_MAIN' },
      }
    case 'lobby':
      return {
        kind: 'lobby',
        path,
        label: 'Lobby',
        query,
        contractRoute: { kind: 'lobby', screenId: 'S3_LOBBY' },
      }
    case 'room': {
      const roomId = readRequiredQueryParam(query, 'roomId')

      if (!roomId) {
        return createNotFoundRoute(path, query)
      }

      return {
        kind: 'room',
        path,
        label: 'Room',
        query,
        contractRoute: {
          kind: 'room',
          screenId: 'C_ROOM_LOBBY',
          roomId,
        },
      }
    }
    case 'map-build': {
      const roomId = readRequiredQueryParam(query, 'roomId')

      if (!roomId) {
        return createNotFoundRoute(path, query)
      }

      return {
        kind: 'mapBuild',
        path,
        label: 'Map Build Preview',
        query,
        contractRoute: {
          kind: 'mapBuild',
          screenId: 'S4_MAP_BUILD',
          roomId,
        },
      }
    }
    case 'validation': {
      const roomId = readRequiredQueryParam(query, 'roomId')

      if (!roomId) {
        return createNotFoundRoute(path, query)
      }

      return {
        kind: 'validation',
        path,
        label: 'Validation',
        query,
        contractRoute: {
          kind: 'validation',
          screenId: 'D_VALIDATION',
          roomId,
          segmentId: query.segmentId,
        },
      }
    }
    case 'merging': {
      const roomId = readRequiredQueryParam(query, 'roomId')

      if (!roomId) {
        return createNotFoundRoute(path, query)
      }

      return {
        kind: 'merging',
        path,
        label: 'Merging',
        query,
        contractRoute: {
          kind: 'merging',
          screenId: 'M_MERGING',
          roomId,
        },
      }
    }
    case 'race': {
      const roomId = readRequiredQueryParam(query, 'roomId')

      if (!roomId) {
        return createNotFoundRoute(path, query)
      }

      return {
        kind: 'race',
        path,
        label: 'Race',
        query,
        contractRoute: {
          kind: 'race',
          screenId: 'E_RACE',
          roomId,
          mergedMapId: query.mergedMapId,
        },
      }
    }
    case 'results': {
      const roomId = readRequiredQueryParam(query, 'roomId')

      if (!roomId) {
        return createNotFoundRoute(path, query)
      }

      return {
        kind: 'results',
        path,
        label: 'Results',
        query,
        contractRoute: {
          kind: 'results',
          screenId: 'F_RESULTS',
          roomId,
        },
      }
    }
    case 'avatar-studio':
      return {
        kind: 'avatarStudio',
        path,
        label: 'Avatar Studio',
        query,
        contractRoute: {
          kind: 'avatarStudio',
          screenId: 'A_AVATAR_STUDIO',
          mode: normalizeStudioMode(query.mode),
          sourceAssetId: query.sourceAssetId,
        },
      }
    case 'asset-studio':
      return {
        kind: 'assetStudio',
        path,
        label: 'Asset Studio',
        query,
        contractRoute: {
          kind: 'assetStudio',
          screenId: 'B_ASSET_STUDIO',
          mode: normalizeStudioMode(query.mode),
          sourceAssetId: query.sourceAssetId,
        },
      }
    case 'warehouse':
      return {
        kind: 'warehouse',
        path,
        label: 'Warehouse',
        query,
        contractRoute: createWarehouseContractRoute(query),
      }
    default:
      return createNotFoundRoute(path, query)
  }
}

function createWarehouseContractRoute(
  query: PrototypeRouteQuery,
): Extract<ContractRouteModel, { kind: 'warehouse' }> {
  const tab = query.tab === 'avatar' ? 'avatar' : 'component'
  const filter = normalizeWarehouseFilter(query.filter)

  return {
    kind: 'warehouse',
    screenId: 'S2B_WAREHOUSE',
    tab,
    filter: tab === 'component' ? filter : undefined,
  }
}

function normalizeStudioMode(mode: string | undefined) {
  if (mode === 'edit' || mode === 'remix') {
    return mode
  }

  return 'new'
}

function normalizeWarehouseFilter(
  filter: string | undefined,
): Extract<ContractRouteModel, { kind: 'warehouse' }>['filter'] {
  if (
    filter === 'platform' ||
    filter === 'obstacle' ||
    filter === 'monster' ||
    filter === 'background'
  ) {
    return filter
  }

  return 'all'
}

export function getPrototypeHref(path: PrototypeRoutePath, query: PrototypeRouteQuery = {}) {
  const queryString = new URLSearchParams(query).toString()

  return `#/${path}${queryString.length > 0 ? `?${queryString}` : ''}`
}

function readRequiredQueryParam(query: PrototypeRouteQuery, key: string) {
  const value = query[key]?.trim()

  return value && value.length > 0 ? value : null
}

function createNotFoundRoute(
  requestedPath: string,
  query: PrototypeRouteQuery,
): Extract<PrototypeRoute, { kind: 'notFound' }> {
  return {
    kind: 'notFound',
    path: 'not-found',
    label: 'V2 NotFound',
    requestedPath,
    query,
  }
}

export function replaceEmptyHashWithDefault() {
  if (window.location.hash.length > 0) {
    return
  }

  window.history.replaceState(null, '', getPrototypeHref('ui-lab'))
}

export function setPrototypeRoute(path: PrototypeRoutePath, query: PrototypeRouteQuery = {}) {
  window.location.hash = getPrototypeHref(path, query)
}

function parseHashParts(hash: string) {
  const normalizedHash = hash.trim().replace(/^#\/?/, '')
  const fallbackHash = normalizedHash.length === 0 ? 'ui-lab' : normalizedHash
  const [rawPath, rawQuery = ''] = fallbackHash.split('?')
  const path = rawPath.replace(/^\/+|\/+$/g, '')
  const params = new URLSearchParams(rawQuery)
  const query: PrototypeRouteQuery = {}

  for (const [key, value] of params.entries()) {
    query[key] = value
  }

  return {
    path,
    query,
  }
}

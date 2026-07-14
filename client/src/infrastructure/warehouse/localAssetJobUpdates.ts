import type {
  AssetJobConnectionEvent,
  AssetJobUpdates,
} from '../../pages/warehouse/warehouseControllerCore'

const onlineStatus: AssetJobConnectionEvent = {
  status: 'online',
}

export function createLocalAssetJobUpdates(): AssetJobUpdates {
  return {
    getConnectionStatus() {
      return onlineStatus
    },
    subscribe(_listener) {
      return () => undefined
    },
  }
}

# Frontend V2 Storage Contract

작성일: 2026-07-13  
목적: V2에서 보존/마이그레이션할 browser storage key와 mode policy를 잠근다.

## 1. Principles

- Storage key는 adapter/store만 직접 접근한다.
- 화면 컴포넌트는 storage key를 import하지 않는다.
- remote mode 실패 시 mock storage를 자동 fallback source로 읽지 않는다.
- mock storage는 `VITE_DATA_MODE=mock`에서만 authoritative하다.
- 모든 V2 persisted JSON에는 schema version을 추가하는 것을 목표로 한다.

## 2. Storage Matrix

| Key | Current owner | Current data | V2 owner | V2 schema | Mode | Migration policy | Source evidence |
|---|---|---|---|---|---|---|---|
| `relay.session` | `client/src/net/api.ts` | `UserSession` | `sessionStore`/API adapter | `{ schemaVersion?: 'session-v1', id, nickname, token, avatarAssetId }` | mock + remote | read current key; invalid JSON clears key | `SESSION_KEY`, `getStoredSession` |
| `relay.session.<profileId>` | `client/src/net/api.ts` | profile-scoped `UserSession` | `sessionStore`/API adapter | same as session | mock + remote | preserve profile behavior; sanitize profile id | `getSessionStorageKey` |
| `relay.session.profileId` | `sessionStorage` via API adapter | active profile id | `sessionStore`/API adapter | string id | mock + remote | keep sessionStorage only | `SESSION_PROFILE_KEY` |
| `relay.settings` | `client/src/store/appStore.ts` | `UserSettings` | `settingsStore` | `{ schemaVersion:'settings-v1', bgmVolume, sfxVolume, bgmMuted, sfxMuted }` | mock + remote | read legacy object; clamp volume 0-100; write versioned object in V2 | `SETTINGS_KEY`, `readSettings` |
| `relay.studioLayout` | `client/src/App.tsx` | panel widths/collapsed/section ratios | `studioLayoutStore` | `{ schemaVersion:'studio-layout-v1', leftPanelWidth, rightPanelWidth, toolPanelCollapsed, propertiesPanelCollapsed, leftSectionRatios }` | mock + remote | read legacy object; invalid JSON clears key; write versioned object | `STUDIO_LAYOUT_KEY`, `readStudioLayoutPreference` |
| `relay.mock.assets` | `client/src/net/api.ts` | `Asset[]` | mock API adapter | `{ schemaVersion:'mock-assets-v1', assets: Asset[] }` target; legacy array read allowed | mock only | legacy array migration on read; remote mode must not read as fallback | `MOCK_ASSETS_KEY` |
| `relay.mock.deviceLinks` | `client/src/net/api.ts` | `StoredDeviceLink[]` | mock API adapter | `{ schemaVersion:'mock-device-links-v1', links }` target | mock only | drop expired links; remote mode not fallback | `MOCK_DEVICE_LINKS_KEY` |
| `relay.mock.mapSegments` | `client/src/net/api.ts` | `MapSegmentSnapshot[]` | mock API adapter | `{ schemaVersion:'mock-map-segments-v1', segments }` target | mock only | remove invalid segment entries; preserve latest by `(roomId,creatorId)` | `MOCK_MAP_SEGMENTS_KEY` |
| `relay.mock.roomPasswords` | `client/src/net/api.ts` | roomId -> password | mock API adapter | `{ schemaVersion:'mock-room-passwords-v1', passwords }` target | mock only | legacy object read allowed | `MOCK_ROOM_PASSWORDS_KEY` |
| `relay.mock.rooms` | `client/src/net/api.ts` | `RoomSummary[]` | mock API adapter | `{ schemaVersion:'mock-rooms-v1', rooms }` target | mock only | run capacity migration once; legacy array read allowed | `MOCK_ROOMS_KEY` |
| `relay.mock.rooms.capacityMigration.v1` | `client/src/net/api.ts` | text `done` | mock API adapter | text marker | mock only | keep until mock rooms v1 is written | `MOCK_ROOM_CAPACITY_MIGRATION_KEY` |

## 3. Data Ownership

| Data | Source of truth in `mock` | Source of truth in `remote` | Notes |
|---|---|---|---|
| session | localStorage mock session | backend session response plus local persisted token/session validated by `/api/session/validate` | invalid remote token clears V2 session; no remote-to-mock fallback |
| settings | localStorage | localStorage | settings are device-local |
| studio layout | localStorage | localStorage | device-local; no DB sync |
| assets | `relay.mock.assets` + starter assets | backend `/api/assets` | no remote->mock fallback |
| asset job status | mock tick + mock assets | push first, limited polling fallback | polling allowed only for asset job |
| rooms | `relay.mock.rooms` | backend `/api/rooms` + Socket.IO | no remote->mock fallback |
| map segments | `relay.mock.mapSegments` | backend segment API | no remote->mock fallback |

## 4. Storage Error Handling

| Failure | Contract |
|---|---|
| localStorage unavailable | keep in-memory state for current session where possible; show non-blocking warning only if persistence matters |
| invalid JSON | clear only the affected key and use default state |
| schema mismatch | run targeted migration; do not silently reinterpret unknown shape |
| quota exceeded | keep in-memory state; show storage error for studio/mock save |
| remote mode and mock data exists | ignore mock data except explicit developer/debug import |

## 5. Migration Gaps

| ID | Gap |
|---|---|
| STORAGE-GAP-001 | Current mock keys store raw arrays/objects without schemaVersion. |
| STORAGE-GAP-002 | Current remote failure can cause mock storage read through API fallback. V2 remote mode must not. |
| STORAGE-GAP-003 | `relay.studioLayout` is owned by legacy `App.tsx`; V2 must move ownership into studio feature. |
| STORAGE-GAP-004 | No persisted draft contract exists for Map Build. Keep none for MVP unless explicitly added. |

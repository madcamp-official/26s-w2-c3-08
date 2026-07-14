# Phase 2A Shared Contract and Port Foundation Report

Status: IMPLEMENTED
Scope: shared constants, shared schema contracts, explicit mode config, frontend port interfaces, contract self-test
Runtime UI/transport migration: not started

## Source Decisions Applied

- `DECISION-V2-002`: avatar visible canvas is `256x512`.
- `DECISION-V2-003`: avatar 3x3 workspace buffer is `768x1536`.
- `DECISION-V2-004`: checker/grid are display-only overlays and are excluded from export/eyedropper source.
- `DECISION-V2-007`: user-created component categories are `platform`, `obstacle`, `monster`, `background`; `item` remains system-provided for V2 MVP.
- `DECISION-V2-008`: MVP map editor is `24x10` cells with `32px` snap.
- `DECISION-V2-009`: asset job updates are push-first, with bounded polling fallback only for asset jobs.
- `DECISION-V2-010`: remote room/game realtime targets the current Socket.IO backend contract first; transports stay behind ports.
- `DECISION-V2-011`: `VITE_DATA_MODE=mock|remote`; remote failure does not auto-fallback to mock.
- `DECISION-V2-012`: `VITE_REALTIME_MODE=local|remote`; remote failure does not auto-fallback to BroadcastChannel.

## Added Shared Constants

File: `shared/constants.ts`

| Constant | Value | Contract Source |
|---|---:|---|
| `AVATAR_VISIBLE_WIDTH` | `256` | `product-decisions.md`, `screen-design.md` |
| `AVATAR_VISIBLE_HEIGHT` | `512` | `product-decisions.md`, `screen-design.md` |
| `AVATAR_WORKSPACE_SCALE` | `3` | `product-decisions.md`, `screen-design.md` |
| `AVATAR_WORKSPACE_WIDTH` | `768` | `256 * 3` |
| `AVATAR_WORKSPACE_HEIGHT` | `1536` | `512 * 3` |
| `EDITOR_BOARD_COLS` | `24` | `screen-state-matrix.md`, `phaser-bridge.md` |
| `EDITOR_BOARD_ROWS` | `10` | `screen-state-matrix.md`, `phaser-bridge.md` |
| `EDITOR_CELL_PX` | `32` | `screen-state-matrix.md`, `phaser-bridge.md` |
| `SPRITE_REGEN_COOLDOWN_MS` | `300000` | `api-contract.md` cooldown policy |
| `AVATAR_GAME_SPRITE_WIDTH` | `64` | existing `TILE_PX` game sprite behavior |
| `AVATAR_GAME_SPRITE_HEIGHT` | `128` | existing `TILE_PX * 2` game sprite behavior |

Legacy aliases remain to avoid runtime behavior changes:

- `AVATAR_CANVAS` now explicitly means game sprite dimensions and is deprecated in favor of `AVATAR_GAME_SPRITE_WIDTH/HEIGHT`.
- `REGEN_COOLDOWN_MS` remains as a deprecated alias for `SPRITE_REGEN_COOLDOWN_MS`.

## Constants Not Centralized Yet

The following are confirmed in legacy code but not added as new shared contract constants in Phase 2A because the contract documents do not yet lock their numeric values:

| Value | Current Runtime Evidence | Phase 2A Decision |
|---|---|---|
| placement budget `40` | `client/src/App.tsx` `BUILD_PLACEMENT_BUDGET = 40` | `TODO-CONTRACT`: document and approve before centralizing |
| endpoint vertical delta `4` | `client/src/App.tsx` `MAX_ENDPOINT_VERTICAL_DELTA = 4` | `TODO-CONTRACT`: document and approve before centralizing |
| asset job poll interval `5000` | `data-mode-policy.md` says minimum 5 seconds; `client/src/store/appStore.ts` has `API_ASSET_POLL_INTERVAL_MS = 5000` | keep as migration/provisional adapter detail until job polling adapter is implemented |
| playtest/race grid dimensions | `client/src/game/PlaytestCanvas.tsx` local `CELL_PX = 32` and Phaser layout constants | leave under Phaser migration review |

## Added Schemas

File: `shared/schemas/index.ts`

The schema module is dependency-free in Phase 2A. It exposes a small `parse`/`safeParse` contract surface and can later be wrapped or replaced by a formal schema library if the shared package dependency policy approves it.

### Category Contracts

- `assetCategorySchema`: accepts global asset categories `avatar`, `platform`, `obstacle`, `monster`, `background`, `item`.
- `userCreatableComponentCategorySchema`: accepts only `platform`, `obstacle`, `monster`, `background`.
- `createAvatarAssetRequestSchema`: accepts `category: "avatar"` with avatar-only null dimensions.
- `createComponentAssetRequestSchema`: rejects `avatar` and `item`; accepts only user-created component categories.
- `createUserAssetRequestSchema`: discriminated union of avatar creation and component creation.

This enforces V2 item system-only behavior at the user request contract boundary without removing `item` from the global asset domain.

### DTO Contracts

Implemented from confirmed product/contracts/runtime evidence:

- `Asset`
- `AssetJob`
- `AssetStatus`
- `Session`
- `RoomSummary`
- `RoomPlayer`
- `MapSegmentMetadata`
- `RaceResult`
- `TypedApiError`
- `RealtimeConnectionStatus`

### Realtime Payload Contracts

Implemented only where contract/runtime evidence exists. These schemas describe normalized domain/adapter-boundary payloads, not raw backend transport payloads.

- `assetJobUpdatedPayloadSchema`
- `roomStateSnapshotSchema`
- `roomPhaseChangedPayloadSchema`
- `roomTimerTickPayloadSchema`
- `racePositionPayloadSchema`
- `raceFinishedPayloadSchema`
- `resultsFinalPayloadSchema`

## Added Explicit Mode Config

File: `client/src/infrastructure/config/modeConfig.ts`

Strict parser behavior:

- `VITE_DATA_MODE` accepts only `mock` or `remote`.
- `VITE_REALTIME_MODE` accepts only `local` or `remote`.
- invalid values throw `ConfigurationError`.
- undefined development defaults are `mock` and `local`.
- undefined production values throw `ConfigurationError`; production must choose modes explicitly.

Resolved config behavior:

- `dataMode: "remote"` selects `apiAdapterKind: "remoteApi"`.
- `realtimeMode: "remote"` selects `realtimeAdapterKind: "remoteRealtime"`.
- `allowMockApiFallback` is always `false`.
- `allowLocalRealtimeFallback` is always `false`.

This creates a config surface that cannot represent silent mock or BroadcastChannel fallback in remote mode, and cannot silently enter remote production mode without explicit env values.

## Added Port Interfaces

File: `client/src/domain/ports/index.ts`

The dependency direction is:

`Page Controller / Feature Use Case -> Port -> Adapter`

No adapter implementation was added in Phase 2A.

Ports added:

- `SessionPort`
- `AssetPort`
- `AssetJobUpdates`
- `RoomPort`
- `RoomRealtime`
- `GameRealtime`
- `StoragePort`

Shared result/error types:

- `PortResult<T>`
- `PortError`
- `Unsubscribe`

Compatibility notes:

- legacy Zustand store is not made mandatory for future screens.
- legacy API/realtime clients can be wrapped later, but are not modified in Phase 2A.
- Socket.IO, Colyseus, and BroadcastChannel implementations remain outside this step.
- `StoragePort` uses an opaque `StorageSlot` rather than raw localStorage key strings at the port boundary.

## Migration Targets

These duplicates remain intentionally untouched to preserve legacy runtime behavior:

| Runtime Location | Duplicate / Legacy Contract | Target Direction |
|---|---|---|
| `client/src/App.tsx` | `AVATAR_CANVAS`, `SKETCH_WORKSPACE_SCALE`, `EDITOR_BOARD`, `REGEN_COOLDOWN_MS` | migrate V2 use cases to shared constants |
| `client/src/App.tsx` | `BUILD_PLACEMENT_BUDGET = 40`, `MAX_ENDPOINT_VERTICAL_DELTA = 4` | first approve contract values, then centralize |
| `client/src/game/MapEditorCanvas.tsx` | `BOARD_COLS`, `BOARD_ROWS`, `CELL_PX` | preserve Phaser behavior until bridge migration |
| `client/src/store/appStore.ts` | `API_ASSET_POLL_INTERVAL_MS = 5000` | later move into an asset-job adapter/use case policy if polling is implemented |
| `client/src/net/api.ts` | legacy DTO/request shapes and remote fallback behavior | later wrap behind ports and explicit config |
| `client/src/net/realtime.ts` | legacy realtime status and BroadcastChannel fallback | later replace/wrap behind realtime ports and explicit config |
| `backend/src/http/routes/apiRoutes.ts` | `/api/assets/generate` rejects user-generated `item` with `ASSET_CATEGORY_NOT_ALLOWED` and preserves system item seeds | keep global `item` domain support for system assets/gameplay only |
| `backend/src/socket/index.ts` | Socket.IO runtime payloads are untyped at shared boundary | later bind to shared schemas after transport adapter work |

## Remaining Contract Gaps

- `TODO-CONTRACT`: placement budget numeric value.
- `TODO-CONTRACT`: endpoint vertical delta numeric value.
- `TODO-CONTRACT`: final backend asset job push event and job status endpoint response once backend contract is updated.
- `TODO-CONTRACT`: mapping from LSJ/backend job statuses to V2 `queued | generating | ready | failed` if backend exposes different status names.
- `TODO-CONTRACT`: complete persisted map segment payload and replay snapshot fields.
- `TODO-CONTRACT`: CI/package integration for contract tests once Node version policy is fixed at the root/client workspace.

## Validation

Phase 2A adds `client/tests/v2-contracts.test.ts` as a lightweight contract self-test using Node's built-in assertions.

Covered:

- avatar visible/workspace constants
- editor board/snap constants
- user-creatable categories and global item parsing
- avatar/component/user asset request schemas
- explicit data/realtime mode parser
- production undefined mode rejection
- remote config cannot select mock/local adapters
- valid/invalid `AssetJob`
- typed API error parsing
- confirmed realtime payload schemas
- parse/safeParse consistency
- nested error paths
- unknown field stripping policy
- input non-mutation
- `PortError` discriminant behavior

## Runtime Modification Statement

No legacy UI, store behavior, realtime transport, Socket.IO client dependency, Drawing Engine, Phaser scene, or package file migration is part of this Phase 2A implementation.

# 05 Socket.IO Client Dependency Request

Date: 2026-07-14

Scope: dependency approval and installation evidence.

## Decision

Approved and applied: `socket.io-client@4.8.3` is added to the `client` workspace so `VITE_REALTIME_MODE=remote` can connect to the backend Socket.IO server without local or mock fallback.

## Exact Need

Frontend V2 realtime ports already separate UI from transport:

- `client/src/infrastructure/realtime/realtimeAdapters.ts`
- `client/src/infrastructure/realtime/socketIoRemoteAdapters.ts`
- `client/src/infrastructure/realtime/socketIoTransport.ts`
- `client/src/infrastructure/rooms/remoteRoomRealtime.ts`
- `client/src/infrastructure/warehouse/remoteAssetJobUpdates.ts`

The backend already exposes Socket.IO:

- `backend/src/socket/index.ts`
- `backend/package.json` currently uses `socket.io`.

The client transport intentionally reports `SOCKET_IO_CLIENT_MISSING` when no socket factory exists. This preserves the no-fallback policy, but it means remote realtime cannot be production-ready until a runtime Socket.IO client is available.

Needed behaviors:

- connect with `auth: { userId, token }`;
- use `websocket` with `polling` fallback inside Socket.IO transport;
- receive `room:state`, `phase:changed`, `timer:tick`, `race:position`, `race:finished`, `results:final`, and `asset_job:updated`;
- map connection status to `connecting`, `connected`, `reconnecting`, `offline`, `error`;
- never downgrade remote mode to BroadcastChannel or mock data.

## Existing Alternatives Considered

| Alternative | Result |
| --- | --- |
| Keep `SocketIoClientFactory` injection only | Useful for tests, but production has no factory provider. Remote mode remains blocked. |
| Use native `WebSocket` | Not wire-compatible with Socket.IO protocol, rooms, reconnect semantics, or event framing. |
| Use BroadcastChannel in remote mode | Forbidden by product rules. It would silently become local realtime. |
| Reuse Colyseus client | Current V2 realtime contract is Socket.IO-based; this would reintroduce a different transport and expose legacy/event mismatch risk. |
| Server-sent events | Does not satisfy bidirectional room/game actions such as ready, phase ready, race position, and finish events. |

## Bundle And Runtime Impact

Package metadata checked on 2026-07-14:

- `socket.io-client` latest version from npm: `4.8.3`
- npm `dist.unpackedSize`: `1,417,815` bytes
- backend runtime already uses Socket.IO server `^4.8.1`

Expected impact:

- Adds one production client dependency and lockfile changes.
- Adds realtime client code to the V2 bundle path that uses remote realtime.
- Enables direct connection to the same-origin `/socket.io` endpoint, which `client/vite.config.ts` now proxies in both dev and preview.
- Does not require exposing socket event names inside presentational components.

Required post-install evidence:

- `npm ls socket.io-client --workspace client`
- `npm run realtime:check --workspace client`
- `npm run lobby-room:check --workspace client`
- `npm run game:check --workspace client`
- `npm run flow:check --workspace client`
- `npm run build --workspace client`
- `git diff --check`

Browser proof is still separately gated by the Playwright Chromium system libraries.

## Applied Implementation

1. Added `socket.io-client@4.8.3` to `client` dependencies.
2. Added a small production socket factory module under `client/src/infrastructure/realtime/`.
3. Wired the Socket.IO remote realtime adapter to use that factory by default.
4. Keep test injection support for deterministic unit checks.
5. Updated realtime tests so missing dependency behavior is covered by explicit factory absence tests, while production default imports the dependency.

## Forbidden Paths

- Do not install without approval.
- Do not replace remote realtime with BroadcastChannel.
- Do not expose socket event names in Views.
- Do not change Phaser gameplay behavior.
- Do not modify legacy UI for this dependency.

## Approval Status

`APPROVED_AND_APPLIED`

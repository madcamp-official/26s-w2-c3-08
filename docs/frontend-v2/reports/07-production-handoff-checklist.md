# 07 Production Handoff Checklist

Date: 2026-07-14

Scope: final external inputs and verification steps before switching the default entry to Frontend V2. This document does not contain credentials. It records what must be supplied after implementation is ready.

## Current Decision

- Production-facing backend authority: `backend/`.
- `server/` / Colyseus status: legacy or experiment workspace only.
- Frontend realtime transport in production: backend Socket.IO via `socket.io-client@4.8.3`.
- Remote failures must surface typed errors, offline, or reconnecting states. They must not silently fall back to mock data or BroadcastChannel.

## Files To Prepare Outside Git

| Service | File | Required purpose |
| --- | --- | --- |
| client | `client/.env.production` | V2 remote data/realtime mode and optional public Socket.IO URL |
| backend | `backend/.env.production` | Express production config, CORS origins, worker auth, internal Qwen proxy token, optional static image serving |
| gpu-worker | `gpu-worker/.env.production` | backend polling URL, matching worker token, Qwen/WAN credentials, image storage |

The repository tracks only examples:

- `client/.env.example`
- `backend/.env.example`
- `gpu-worker/.env.example`

Real env files are ignored by `.gitignore`.

## Required Values From Deployment Owner

| Variable | Owner input | Notes |
| --- | --- | --- |
| `client.VITE_DATA_MODE` | `remote` | Required for production V2 |
| `client.VITE_REALTIME_MODE` | `remote` | Required for production V2 |
| `client.VITE_SOCKET_IO_URL` | public backend origin, optional | Leave unset only when frontend and backend share the same origin |
| `backend.NODE_ENV` | `production` | Required |
| `backend.CORS_ORIGIN` | public frontend origin list | Comma-separated values are supported |
| `backend.WORKER_TOKEN` | real shared worker secret | Must match `gpu-worker.WORKER_TOKEN` |
| `backend.INTERNAL_API_TOKEN` | real backend-internal token | Required for `/internal/qwen/*` in production |
| `backend.QWEN_BASE_URL` | Qwen internal base URL | May be private network URL |
| `backend.QWEN_API_TOKEN` | real Qwen token | Placeholder values fail readiness |
| `gpu-worker.SERVER_URL` | backend URL reachable by worker | May be internal service URL |
| `gpu-worker.WORKER_TOKEN` | same value as backend | Cross-service mismatch fails readiness |
| `gpu-worker.GPU_WORKER_SIMULATE` | `false` | `true` fails readiness |
| `gpu-worker.GPU_WORKER_GENERATION_MODE` | `wan` | `gateway` remains compatibility-only |
| `gpu-worker.QWEN_BASE_URL` | Qwen internal base URL | Required for `wan` mode |
| `gpu-worker.QWEN_API_TOKEN` | real Qwen token | Required for `wan` mode |
| `gpu-worker.WAN_API_BASE_URL` | WAN internal base URL | Required for `wan` mode |
| `gpu-worker.WAN_API_TOKEN` | real WAN token | Required for `wan` mode |
| `gpu-worker.WAN_GENERATE_PATH` | WAN generation path | Defaults are documented in the example file |
| `IMAGE_STORAGE_MODE` | `local` or `http-put` | Production worker rejects `inline` |

## Image Storage Choice

Use one of these production paths.

| Mode | Required values | Deployment shape |
| --- | --- | --- |
| `local` | `backend.IMAGE_STORAGE_MODE=local`, `backend.IMAGE_STORAGE_DIR`, `backend.IMAGE_PUBLIC_PATH`, `gpu-worker.IMAGE_STORAGE_MODE=local`, `gpu-worker.IMAGE_STORAGE_DIR`, `gpu-worker.IMAGE_PUBLIC_BASE_URL` | Backend and worker share a writable volume; backend serves generated files |
| `http-put` | `gpu-worker.IMAGE_STORAGE_MODE=http-put`, `gpu-worker.IMAGE_STORAGE_UPLOAD_URL`, `gpu-worker.IMAGE_STORAGE_UPLOAD_TOKEN`, `gpu-worker.IMAGE_PUBLIC_BASE_URL` | Worker uploads PNGs to an internal object-storage gateway; public URLs point at CDN/storage |

## Verification Commands

Run this after real env files are present:

```bash
npm run check:production-env -- \
  --client-env-file client/.env.production \
  --backend-env-file backend/.env.production \
  --gpu-worker-env-file gpu-worker/.env.production
```

Expected result before default switch:

- `Production environment readiness: PASS`
- no placeholder credential failures
- no localhost public URL failures
- no backend/gpu-worker worker token mismatch
- no `GPU_WORKER_SIMULATE=true`

Then run the full V2 gate:

```bash
npm run check:v2
```

For hosted/browser confidence, require the latest GitHub Actions runs to pass:

- `Drawing Engine Browser Acceptance`
- `Frontend V2 Browser Gates`

## Visual Approval Gate

Evidence screenshots already cover Launcher, Studio, and Game State Gallery matrices at:

- 1280x720
- 1440x900
- 1920x1080

Before default entry switch, product/design review must approve the evidence set or select golden baselines. This is a product approval step, not an automatic code gate.

## Switch Readiness Criteria

The default V2 entry switch can proceed only when all items are true:

- production env readiness passes with real deployment values;
- staging confirms Login to Results in `remote/remote` mode;
- Qwen/WAN generation produces stored image URLs through the selected storage mode;
- visual evidence or golden baselines are approved;
- accessibility browser gates remain green;
- legacy root remains runnable until the explicit removal phase.

## Do Not Commit

- `client/.env.production`
- `backend/.env.production`
- `gpu-worker/.env.production`
- real Qwen/WAN tokens
- worker/internal API tokens
- generated images or storage volumes
- `madcamp2.pdf`

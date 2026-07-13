# Frontend V2 Phase 0 Baseline Validation

작성일: 2026-07-13  
범위: 이미 설치된 dependencies가 있을 때만 기존 검증 명령을 실행한다. 설치는 수행하지 않는다.

## 1. Dependency 상태

확인 결과:

| 항목 | 상태 |
|---|---|
| root `node_modules` | 있음 |
| `client/node_modules` | 있음 |
| root `package-lock.json` | 있음 |
| `backend/package-lock.json` | 있음 |

따라서 요청된 client 검증 명령은 실행 대상이다.

## 2. 실제 npm scripts

### 2.1 Root

근거: `package.json`

- 루트에는 scripts가 없다.
- workspaces: `client`, `server`, `shared`, `gpu-worker`
- `backend`는 root workspace가 아니다.

### 2.2 Client

근거: `client/package.json`

| script | command |
|---|---|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `lint` | `oxlint` |
| `smoke` | `node scripts/frontend-smoke.mjs` |
| `preview` | `vite preview` |

### 2.3 Server

근거: `server/package.json`

| script | command |
|---|---|
| `start` | `tsx watch src/index.ts` |
| `loadtest` | `tsx loadtest/example.ts --room my_room --numClients 2` |
| `build` | `npm run clean && tsc -p tsconfig.build.json` |
| `clean` | `rimraf build` |
| `test` | `mocha -r tsx test/**/*.test.ts --exit --timeout 15000` |

### 2.4 Backend

근거: `backend/package.json`

| script | command |
|---|---|
| `dev` | `tsx watch src/index.ts` |
| `start` | `node dist/index.js` |
| `build` | `tsc -p tsconfig.json` |
| `typecheck` | `tsc -p tsconfig.json --noEmit` |
| `test` | `vitest run` |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:studio` | `prisma studio` |

주의: Phase 0 요청 검증은 client workspace 명령과 `git diff --check`만이다. Backend scripts는 존재하지만 실행 대상에 포함하지 않았다.

## 3. 실행 명령 결과

| command | exit | 결과 |
|---|---:|---|
| `npm run lint --workspace client -- --quiet` | 0 | `oxlint --quiet` 통과 |
| `npm run smoke --workspace client` | 0 | `Frontend smoke checks passed (16/16)` |
| `npm run build --workspace client` | 0 | `tsc -b && vite build` 통과. Vite가 `assetRules` 등 500kB 초과 chunk warning을 출력 |
| `git diff --check` | 0 | whitespace error 없음 |

## 4. 테스트 커버리지 관찰

### 4.1 존재하는 테스트/검증

- client smoke script가 존재한다: `client/package.json` `smoke`.
- client lint는 `oxlint`.
- client build는 TypeScript build + Vite build.
- server Colyseus scaffold test가 존재한다: `server/test/MyRoom.test.ts`.
- backend Vitest script가 존재하지만 root workspace에 포함되지 않는다.

### 4.2 테스트되지 않는 핵심 기능

현재 확인한 코드 기준으로 다음은 직접적인 테스트 근거가 약하거나 없다.

- `App.tsx` view 전환 전체: login -> main -> lobby -> room -> phase flow
- `SketchBoard` drawing export/crop/compose/eyedropper/move history
- `relay.studioLayout` migration and invalid JSON recovery
- `client/src/net/api.ts` remote unwrap/fallback matrix
- `client/src/net/realtime.ts` Colyseus/BroadcastChannel event translation
- API path mismatch: `/api/assets/avatar/generate` fallback behavior
- Store action side effects: `submitAsset` view 이동, room join/create realtime join, phase advance emits
- Phaser wrapper cleanup under remount
- Phaser game rules in `PlaytestCanvas.tsx` and `RaceCanvas.tsx`
- `shared/physics` and `shared/schemas` are stubs, so shared contract tests cannot exist yet

## 5. Baseline risk

Client validation can prove current client still lint/builds/smokes after documentation changes, but it does not prove:

- remote backend compatibility
- Socket.IO/Colyseus transport compatibility
- AI/Qwen/WAN pipeline correctness
- multiplayer correctness
- drawing export correctness
- Phaser gameplay correctness

Phase 1 should add targeted tests around adapter contracts before replacing the UI surface.

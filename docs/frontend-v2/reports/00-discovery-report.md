# Frontend V2 Phase 0 Discovery Report

작성일: 2026-07-13  
범위: 분석 및 문서화만 수행. 런타임 코드, `package.json`, lockfile, 기존 UI/CSS/API/Store/Realtime/Phaser 파일은 수정하지 않는다.

## 1. 사전 상태

| 항목 | 현재 기준 |
|---|---|
| 저장소 루트 | `/home/26s-w2-c3-08` |
| Git branch | `feature/frontend-v2` |
| Working tree | `A docs/frontend-v2/FINAL_PLAN.md`, `?? client/src/game/AGENTS.md`가 이미 존재 |
| 루트 AGENTS | `AGENTS.md`는 없음 |
| 하위 AGENTS | `client/src/game/AGENTS.md` 존재. Phaser gameplay code 보호 규칙을 선언 |

`client/src/game/AGENTS.md`의 핵심 규칙:

- Phaser 렌더링, 물리, 충돌, 게임 타이밍, 레이스 규칙, 맵 규칙은 보호 대상이다.
- UI 작업은 React wrapper contract, lifecycle cleanup, resize integration, typed bridge events, 접근성 주변 UI만 바꿀 수 있다.
- 명시적 gameplay task 없이 freeze penalty, overtime, ranking, placement validation, map locking을 바꾸면 안 된다.

## 2. 실제 package/workspace 구조

| 경로 | workspace 포함 | 성격 | 주요 scripts |
|---|---:|---|---|
| `package.json` | root | npm workspaces 루트 | workspaces: `client`, `server`, `shared`, `gpu-worker` |
| `client/package.json` | 예 | Vite React frontend | `dev`, `build`, `lint`, `smoke`, `preview` |
| `server/package.json` | 예 | Colyseus scaffold server | `start`, `loadtest`, `build`, `test` |
| `shared/package.json` | 예 | shared constants/physics/schemas export | scripts 없음 |
| `gpu-worker/package.json` | 예 | GPU worker placeholder | `start` |
| `backend/package.json` | 아니오 | 별도 Express + Socket.IO backend | `dev`, `start`, `build`, `typecheck`, `test`, Prisma scripts |

주의: `backend/`는 실제 코드와 lockfile, `node_modules`가 있지만 루트 workspace에는 포함되지 않는다. 루트 workspace 검증은 `backend`를 자동으로 포함하지 않는다.

## 3. 조사한 핵심 파일

요청된 필수 파일을 현재 워크트리 기준으로 확인했다.

| 구분 | 경로 |
|---|---|
| V2 계획 | `docs/frontend-v2/FINAL_PLAN.md` |
| 제품/기획 문서 | `docs/KJH/screen-design.md`, `docs/KJH/asset-attributes.md`, `docs/KJH/player-spec.md`, `docs/KJH/ai-pipeline.md`, `docs/KJH/architecture.md`, `docs/KJH/tech-stack.md`, `docs/LSJ/plan.md`, `docs/LSJ/backend.md`, `docs/LSJ/colaboration.md` |
| package 파일 | `package.json`, `client/package.json`, `backend/package.json`, `server/package.json`, `shared/package.json`, `gpu-worker/package.json` |
| client UI | `client/src/App.tsx`, `client/src/App.css`, `client/src/components/AvatarCreator.tsx` |
| client runtime | `client/src/store/appStore.ts`, `client/src/net/api.ts`, `client/src/net/realtime.ts`, `client/src/types/domain.ts` |
| Phaser | `client/src/game/MapEditorCanvas.tsx`, `client/src/game/PlaytestCanvas.tsx`, `client/src/game/RaceCanvas.tsx`, `client/src/game/assetRules.ts`, `client/src/game/AGENTS.md` |
| service dirs | `shared/`, `backend/`, `server/` |

## 4. 이 단계에서 작성한 문서

| 문서 | 목적 |
|---|---|
| `docs/frontend-v2/reports/00-discovery-report.md` | Phase 0 범위, 근거 파일, 핵심 발견 요약 |
| `docs/frontend-v2/reports/00-current-architecture.md` | 현재 런타임 구조, Store/API/Realtime/Phaser/Storage 기준점 |
| `docs/frontend-v2/reports/00-legacy-behavior.md` | 기존 UI 동작, 화면 전환, 모달, 드로잉, 게임 페이즈 |
| `docs/frontend-v2/reports/00-baseline-validation.md` | 설치 상태, scripts, 검증 명령 결과, 테스트 공백 |
| `docs/frontend-v2/decisions/conflict-register.md` | 문서 기준과 코드 기준의 충돌 등록 |

## 5. A-H 발견 요약

### A. 현재 화면 및 전환

- 화면 모델은 `client/src/types/domain.ts`의 `AppView = 'main' | 'avatar' | 'studio' | 'warehouse' | 'lobby' | 'room'`이다.
- 게임 페이즈 모델은 `RoomPhase = 'lobby' | 'building' | 'validating' | 'merging' | 'racing' | 'finished'`이다.
- `client/src/App.tsx`의 `GameMakerApp`가 topbar nav와 조건부 render로 전체 화면을 전환한다.
- `RoomFlow`는 `currentRoom.phase`를 기준으로 `RoomLobbyPhase`, `MapBuildPhase`, `ValidationPhase`, `MergingPhase`, `RacePhase`, `ResultsPhase`를 렌더링한다.
- `App.tsx`는 5,445줄이며 화면, hooks, drawing editor, modal, map editor HUD, game phase logic, utility가 모두 포함되어 있다.

### B. Store

- 전역 store는 `client/src/store/appStore.ts`의 `useAppStore` 하나다.
- 상태는 session, assets, rooms, currentRoom, roomPlayers, mapSegments, mergedMap, racePositions, settings, modal/view 상태, realtime 상태를 모두 포함한다.
- API 호출 action과 realtime emit action이 같은 store에 섞여 있다.
- slice 후보는 session/settings, assets/warehouse, studio/drawing source, rooms/lobby, room phase, map segment, race/realtime이다.

### C. API

- client API 어댑터는 `client/src/net/api.ts`다.
- remote는 `VITE_REMOTE_API === 'true'`일 때만 시도한다.
- 모든 `getJson`, `postJson`, `postFormData`는 실패 시 `null`을 반환하고 mock으로 내려간다.
- 현재 client remote path는 `/api/session`, `/api/assets`, `/api/assets/generate`, `/api/assets/avatar/generate`, `/api/rooms`, `/api/rooms/:id/...` 계열이다.
- `backend/src/http/app.ts`는 `/api` prefix 아래에 `apiRoutes`를 붙인다.
- `backend/src/http/routes/apiRoutes.ts`에는 `/assets/avatar/generate` route가 없고 `/assets/generate`만 있다.

### D. Realtime

- frontend realtime은 `client/src/net/realtime.ts`의 Colyseus SDK + BroadcastChannel fallback이다.
- `backend/src/socket/index.ts`는 Socket.IO 서버다.
- `server/`는 Colyseus scaffold이지만 `MyRoom`은 기본 예제 수준이다.
- frontend는 Socket.IO client를 사용하지 않는다.
- local fallback channel key는 `relay.localRealtime.v1`이고 `VITE_LOCAL_REALTIME !== 'false'`일 때 사용된다.

### E. Storage

확인된 key:

- `relay.session`
- `relay.session.profileId`
- `relay.session.<profileId>`
- `relay.mock.assets`
- `relay.mock.deviceLinks`
- `relay.mock.mapSegments`
- `relay.mock.roomPasswords`
- `relay.mock.rooms`
- `relay.mock.rooms.capacityMigration.v1`
- `relay.settings`
- `relay.studioLayout`

V2 migration 대상은 session/settings/studio layout/mock data 전체다. mock data는 schema drift에 민감하다.

### F. Phaser

- `MapEditorCanvas`, `PlaytestCanvas`, `RaceCanvas`가 React wrapper + Phaser scene 구조다.
- 세 wrapper 모두 mount 시 `new Phaser.Game(...)`, unmount 시 `game.destroy(true)` cleanup을 수행한다.
- `scale.mode`는 모두 `Phaser.Scale.NONE`이며 explicit resize integration은 없다.
- 게임 규칙은 `client/src/game/assetRules.ts`, `PlaytestCanvas.tsx`, `RaceCanvas.tsx`에 강하게 들어 있다.

### G. Drawing

- 현재 메인 drawing 구현은 `App.tsx`의 `SketchBoard`이며 `react-sketch-canvas`에 직접 의존한다.
- 아바타 스튜디오는 256x512를 사용한다.
- `SketchBoard`는 내부 workspace를 `SKETCH_WORKSPACE_SCALE = 3`으로 키우고 보이는 export frame만 crop한다.
- `client/src/components/AvatarCreator.tsx`는 400x400, guide silhouette, `/api/assets/generate` JSON POST를 사용하는 별도 컴포넌트이며 현재 import되지 않는다.

### H. 테스트

- client scripts: `lint`, `smoke`, `build`가 존재한다.
- server scripts: `build`, `test`가 존재한다.
- backend scripts: `build`, `typecheck`, `test`가 존재하지만 루트 workspace에는 포함되지 않는다.
- Phase 0 검증은 요청대로 client `lint`, `smoke`, `build`, `git diff --check`만 실행 대상으로 둔다.

## 6. 가장 중요한 Phase 1 전제

현재 UI를 제거하고 새 UI를 붙이는 Phase 1에서는 다음 경계를 보존해야 한다.

- 화면은 `client/src/net/api.ts`의 API adapter와 `client/src/store/appStore.ts` action을 통해서만 service contract에 닿게 한다.
- Phaser 파일은 Protected boundary로 보고 wrapper props/callback 수준에서만 연결한다.
- `App.tsx`에 있는 현재 화면 모양은 재사용 기준이 아니라 legacy behavior 근거다.
- `App.css`는 전체 스타일이 섞인 legacy monolith로 보고, V2 tokens/components로 대체할 때 behavior 근거만 참조한다.

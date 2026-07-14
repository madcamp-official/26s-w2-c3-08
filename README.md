# 26s-w2-c3-08

## Multiplayer AI Relay Map Maker

AI로 만든 아바타와 에셋을 재료로 각자 짧은 2D 플랫폼 맵 조각을 만들고, 직접 클리어 가능성을 검증한 뒤, 성공한 조각들을 하나의 레이스 맵으로 이어 달리는 웹 MVP입니다.

현재 저장소는 레거시 프론트엔드를 보존하면서 Frontend V2, Express backend, Socket.IO realtime 계약, GPU worker scaffold를 함께 발전시키는 중입니다. V2는 독립 진입점 `client/ui-v2.html`에서 확인하며, 기본 개발 실행은 backend REST와 Socket.IO remote realtime을 사용합니다. `socket.io-client@4.8.3`는 client workspace production dependency로 승인되어 추가되었습니다.

### 빠른 실행

```bash
npm install
npm run dev:v2
```

기본 V2 개발 서버는 다음 주소로 열립니다.

- V2 로컬: `http://localhost:5174/ui-v2.html#/login`
- 레거시 로컬: `http://localhost:5174/`
- 같은 네트워크: `http://192.168.0.200:5174/`
- Cloudflare Tunnel: `https://mad-mario.madcamp-kaist.org/`

`npm run dev:v2`는 `backend`를 `http://localhost:3000`에, `client`를 `http://localhost:5174`에 띄웁니다. 기본값은 `VITE_DATA_MODE=remote`, `VITE_REALTIME_MODE=remote`입니다. `client/vite.config.ts`는 dev/preview 모두 `/api`와 `/socket.io`를 `VITE_API_PROXY_TARGET`으로 proxy합니다. 다른 호스트가 필요하면 쉼표 구분으로 추가합니다.

```bash
VITE_ALLOWED_HOSTS=example.com,10.0.0.12 npm run dev --workspace client
```

### 프론트 시연 흐름

1. 닉네임을 입력해 로그인합니다.
2. 메인에서 `아바타 제작` 또는 `에셋 스튜디오`로 들어가 그림과 설명을 제출합니다.
3. `내 창고`에서 생성 중/완료/실패 상태, 재시도, 장착, 상세 검수를 확인합니다.
4. `로비`에서 공개방 또는 비공개방을 만들거나 공개방 빠른 입장으로 들어갑니다.
5. Mock 모드에서는 보조 플레이어가 빈 슬롯을 대신하므로 혼자서도 `제작 시작`이 가능합니다.
6. 맵 제작 화면에서 제공/내 에셋을 드래그하거나 클릭해 32x32 그리드에 배치하고, 시작점/끝점과 높이차를 조정합니다.
7. `테스트 하기`로 현재 스냅샷을 점검한 뒤 `제작 완료`를 누르면 맵이 잠깁니다.
8. 검증 페이즈에서 직접 GOAL까지 도달하면 검증 성공, 실패하면 레이스 시작 15초 freeze 패널티가 표시됩니다.
9. 병합 페이즈에서 검증 성공 조각이 Y축 오프셋까지 반영되어 연결되고, 성공 조각이 없으면 기본 세그먼트를 사용합니다.
10. 레이스와 결과 화면에서 완주 시간, 30초 연장전, 미완주 거리순, 검증 실패 패널티를 확인합니다.

### 주요 검증 명령

```bash
npm run lint --workspace client -- --quiet
npm run smoke --workspace client
npm run build --workspace client
npm run check:v2
git diff --check
```

빌드 시 `assetRules` 청크가 500 kB를 넘는 Vite 경고가 날 수 있습니다. 현재는 번들 실패가 아니라 경고이며, Phaser 룰 로직 분리/코드 스플리팅은 후속 최적화 범위입니다.

`npm run check:v2`는 브라우저 system dependency가 필요한 Playwright suite를 제외한 V2 token, design system, 화면, controller, remote adapter, backend, server, gpu-worker 검증을 묶어 실행합니다.

Backend 운영 확인 endpoint:

- `GET /health`: public liveness check. 내부 Qwen URL이나 secret 상태를 노출하지 않습니다.
- `GET /ready`: sanitized readiness check. production에서 backend 필수 secret/config가 빠지거나 placeholder/too-short secret이면 `503`을 반환하고, 값 자체 대신 boolean/count만 제공합니다.

Production 배포 직전에는 실제 env 파일 또는 배포 환경을 주입한 뒤 다음 검사를 실행합니다. 이 검사는 secret 값 자체를 출력하지 않고 missing/placeholder/localhost/simulate mode를 실패로 처리합니다.

```bash
npm run check:production-env -- \
  --client-env-file client/.env.production \
  --backend-env-file backend/.env.production \
  --gpu-worker-env-file gpu-worker/.env.production
```

배포 담당자가 채워야 할 값과 검증 순서는 [production handoff checklist](docs/frontend-v2/reports/07-production-handoff-checklist.md)에 정리되어 있습니다.

### 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VITE_DATA_MODE` | dev/test: `mock`, `dev:v2`: `remote` | V2 API/data source 선택입니다. remote에서는 mock fallback을 하지 않습니다. |
| `VITE_REALTIME_MODE` | dev/test: `local`, `dev:v2`: `remote` | V2 realtime transport 선택입니다. `remote`는 backend Socket.IO를 사용하며 실패 시 BroadcastChannel로 자동 fallback하지 않습니다. `local`은 명시적 로컬 다중 탭 시연 전용입니다. |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Vite 개발/프리뷰 서버의 `/api`, `/socket.io` 프록시 대상입니다. |
| `VITE_SOCKET_IO_URL` | 현재 접속 origin 기반 | Socket.IO remote realtime 서버 주소입니다. 기본 개발 실행은 Vite `/socket.io` proxy를 통해 backend에 연결합니다. |
| `VITE_ALLOWED_HOSTS` | unset | 추가 Vite allowed host 목록입니다. 쉼표로 구분합니다. |
| `PORT` | `3000` | production-facing Express backend 포트입니다. |
| `CORS_ORIGIN` | `http://localhost:5173` | backend HTTP와 Socket.IO에서 허용할 client origin입니다. 여러 origin은 쉼표로 구분합니다. |
| `WORKER_TOKEN` | dev/test: `dev-worker-token`, production: required | GPU worker가 `/api/ai/jobs/*`를 claim/complete할 때 사용하는 bearer token입니다. production에서는 명시 값이 필요합니다. |
| `INTERNAL_API_TOKEN` | production: required | `/internal/qwen/*` backend-internal proxy route 접근 token입니다. `X-Backend-Internal-Token` 또는 bearer token으로 전달합니다. |
| `SERVER_URL` | gpu-worker: `http://localhost:3000` | GPU worker가 polling할 backend base URL입니다. |
| `GPU_WORKER_SIMULATE` | `false` | `true`일 때 GPU worker가 외부 이미지 생성기 없이 deterministic simulated result를 반환합니다. |
| `GPU_WORKER_GENERATION_MODE` | `wan` | `wan`은 Qwen prompt refinement 후 WAN sprite generation을 호출합니다. `gateway`는 단일 내부 generation gateway 호환 모드입니다. |
| `QWEN_BASE_URL` | `http://172.10.5.138:8001` | backend internal Qwen prompt refinement endpoint base URL입니다. |
| `QWEN_API_TOKEN` | unset | Qwen prompt refinement token입니다. backend internal route와 gpu-worker WAN mode에서 사용합니다. 실제 값은 배포 직전에 주입합니다. |
| `QWEN_TIMEOUT_MS` | `45000` | Qwen 요청 timeout입니다. |
| `WAN_API_BASE_URL` | unset | gpu-worker WAN mode의 sprite generation base URL입니다. |
| `WAN_API_TOKEN` | unset | gpu-worker WAN mode의 sprite generation bearer token입니다. |
| `WAN_GENERATE_PATH` | `/v1/sprites/generate` | gpu-worker WAN mode의 generation path입니다. |
| `WAN_TIMEOUT_MS` | `90000` | WAN generation 요청 timeout입니다. |
| `GENERATION_GATEWAY_URL` | unset | `GPU_WORKER_GENERATION_MODE=gateway`일 때 사용하는 단일 generation gateway URL입니다. |
| `GENERATION_GATEWAY_PATH` | `/v2/sprite-jobs/generate` | gateway mode generation path입니다. |
| `IMAGE_STORAGE_MODE` | inferred | `local`, `http-put`, `inline` 중 하나입니다. production worker는 `local` 또는 `http-put`만 통과합니다. |
| `IMAGE_STORAGE_DIR` | unset | backend가 serve하고 gpu-worker가 쓸 shared generated image directory입니다. 설정하지 않으면 data URL을 그대로 반환합니다. |
| `IMAGE_PUBLIC_PATH` | `/generated-assets` | backend static serving path입니다. |
| `IMAGE_STORAGE_UPLOAD_URL` | unset | `IMAGE_STORAGE_MODE=http-put`일 때 worker가 PNG를 PUT 업로드할 internal object-storage gateway base URL입니다. |
| `IMAGE_STORAGE_UPLOAD_TOKEN` | unset | `http-put` 업로드 gateway bearer token입니다. |
| `IMAGE_PUBLIC_BASE_URL` | unset | gpu-worker가 저장된 파일을 public URL로 반환할 때 사용하는 base URL입니다. |

실제 Qwen/WAN credentials, 이미지 저장소, 배포 환경 값은 production 배포 단계에서 주입한다. 현재 V2 production authority는 `backend/`이며, `server/`/Colyseus는 대체 transport와 AI/API 실험 검증용 workspace로 유지한다.

`npm run check:production-env`는 다음 production readiness를 확인한다.

- client: `VITE_DATA_MODE=remote`, `VITE_REALTIME_MODE=remote`, 선택적 `VITE_SOCKET_IO_URL`.
- backend: `NODE_ENV=production`, public `CORS_ORIGIN` list, real `WORKER_TOKEN`, real `INTERNAL_API_TOKEN`, Qwen token, local storage mode일 때 generated image static path.
- gpu-worker: backend `SERVER_URL`, backend와 동일한 `WORKER_TOKEN`, `GPU_WORKER_SIMULATE=false`, Qwen/WAN 또는 explicit gateway credentials, `local` 또는 `http-put` generated image storage.
- cross-service: backend/gpu-worker `WORKER_TOKEN` 일치와 generated image URL/path 정합성.

Generated image storage는 두 production 경로를 지원한다.

- `IMAGE_STORAGE_MODE=local`: backend와 gpu-worker가 같은 volume을 공유하고 backend가 `IMAGE_PUBLIC_PATH`로 serve한다.
- `IMAGE_STORAGE_MODE=http-put`: gpu-worker가 `IMAGE_STORAGE_UPLOAD_URL/{filename}`으로 PNG binary를 PUT 업로드하고 `IMAGE_PUBLIC_BASE_URL/{filename}` 또는 upload 응답의 `publicUrl`을 asset URL로 기록한다.

### 참고 문서

- [전체 MVP 계획](docs/LSJ/plan.md)
- [화면 설계](docs/KJH/screen-design.md)
- [기술 스택](docs/KJH/tech-stack.md)
- [에셋 속성](docs/KJH/asset-attributes.md)
- [플레이어 사양](docs/KJH/player-spec.md)

## 공통과제 II : 협업형 실전 산출물 제작 (2인 1팀)

**목적:** 실시간 인터랙션, LLM Wrapper, Cross-Platform 중 하나의 옵션을 선택해 구현하며, 선택한 기술을 실제로 동작하는 형태의 산출물로 완성한다.

**선택 옵션:**

| 옵션 | 설명 |
|---|---|
| 실시간 인터랙션 | 사용자 간 상태 변화, 실시간 데이터 흐름, 스트리밍 응답 등 실시간성이 드러나는 기능을 구현 |
| LLM Wrapper | LLM API를 활용하여 AI 기능이 포함된 산출물을 구현 |
| Cross-Platform | 하나의 산출물을 여러 실행 환경에서 사용할 수 있도록 구현* |

> *데스크톱 앱 ↔ 모바일 앱; 혹은 다른 폼팩터에서의 앱; 웹만/웹 기반 프레임워크(Electron, Tauri 등) 대신 다른 프레임워크를 시도해보는 것을 적극 권장

**결과물:** 선택한 옵션이 적용된 작동 가능한 산출물, 실행 가능한 코드, 시연 자료 및 관련 문서

---

## 팀원

| 이름 | 학교 | GitHub | 역할 |
|---|---|---|---|
| 김재훈 |  |  |  |
| 이서진B |  |  |  |

---

## 선택 옵션

- [x] 실시간 인터랙션
- [ ] LLM Wrapper
- [ ] Cross-Platform

---

## 기획안

- **산출물 주제:** AI 에셋 기반 협업형 2D 플랫폼 릴레이 맵 메이커
- **제작 목적:** 사용자가 직접 만든 맵 조각을 검증하고 병합해 하나의 멀티플레이 레이스로 이어지는 경험을 웹에서 시연한다.
- **선택 옵션:** 실시간 인터랙션
- **핵심 구현 요소:**
  - 로비/방/페이즈/레이스 상태를 동기화하는 실시간 게임 흐름
  - 스케치 기반 아바타·에셋 제작과 생성 상태를 보여주는 창고 UI
  - Phaser 기반 맵 제작, 검증 플레이, 병합 맵 레이스 캔버스
- **사용 / 시연 시나리오:** 닉네임 로그인 → 로비 입장 → 방 생성/입장 → 맵 제작 → 검증 → 병합 → 레이스 → 결과 확인
- **팀원별 역할:** 프론트엔드는 Vite/React/Phaser/Zustand 기반 MVP 구현, 백엔드는 별도 담당 범위

### 개발 일정

| 날짜 | 목표 |
|---|---|
| Day 1 | 문서 정리, 프론트 구조 설계, Vite/React/Zustand 기반 라우팅 |
| Day 2 | 아바타/에셋 스튜디오와 `react-sketch-canvas` 기반 그림장 |
| Day 3 | 창고, 생성 상태, 상세 검수, 재시도/장착 흐름 |
| Day 4 | 로비, 공개/비공개 방, Mock/로컬 실시간 동기화 |
| Day 5 | Phaser 맵 에디터, 그리드 배치, 시작점/끝점, 제작 잠금 |
| Day 6 | 검증 플레이, 맵 병합, 레이스, 결과 화면 |
| Day 7 | 도메인 접속, 문서화, lint/build 검증, 시연 안정화 |

---

## 구현 명세서

| 구현 요소 | 설명 | 우선순위 |
|---|---|---|
| 로그인/세션 | 닉네임 기반 Mock 세션, localStorage 저장, 설정에서 닉네임 변경 | 필수 |
| 아바타 제작 | 1x2 투명 스케치 캔버스, 펜/지우개/스포이드/이동/팔레트, 생성 요청 | 필수 |
| 에셋 스튜디오 | 플랫폼·장애물·몬스터·배경 제작, attrs 선택, 크기/충돌 정보 지정 | 필수 |
| 내 창고 | 아바타/컴포넌트 탭, 생성 상태 오버레이, 실패 재시도, 상세 검수 | 필수 |
| 로비/방 | 공개/비공개 방 생성, 비밀번호 입장, 공개방 빠른 입장, 준비/시작 | 필수 |
| 맵 에디터 | 32x32 그리드, 에셋 배치/이동/삭제, 시작점/끝점, 비용 제한, 테스트 | 필수 |
| 검증/병합/레이스 | 2분 검증, 실패 패널티, Y축 오프셋 병합, 5분 레이스/30초 연장/결과 | 필수 |
| 명시적 로컬 실시간 | `VITE_REALTIME_MODE=local`에서 BroadcastChannel 기반 다중 탭 시연. remote 실패 시 자동 local fallback은 금지 | 필수 |

---

## 아키텍처

프론트엔드는 `client/` 워크스페이스에 있으며, React는 화면 상태와 일반 UI를 담당하고 Phaser는 맵 에디터·검증·레이스 캔버스를 담당한다. Zustand store가 세션, 에셋, 방, 페이즈, 맵 세그먼트, 병합 맵, 레이스 위치를 관리한다.

V2 실시간 계층은 `backend/` Socket.IO 계약을 remote mode의 기본 transport로 사용한다. BroadcastChannel은 `VITE_REALTIME_MODE=local`에서만 로컬 다중 탭 시연용으로 사용하며, remote 실패를 숨기는 자동 fallback으로 쓰지 않는다. V2 데이터 계층은 `VITE_DATA_MODE=mock|remote`로 명시적으로 분리하고, remote 실패 시 Mock 데이터로 자동 전환하지 않는다.

기존 Colyseus scaffold인 `server/`는 대체 transport와 AI/API 실험 경로를 검증하는 보조 workspace로 유지한다. V2 production remote room/game realtime의 우선 계약은 `backend/` Socket.IO다.

---

## 설계 문서

### 화면 / 인터페이스 설계

- [화면 설계](docs/KJH/screen-design.md)
- [플레이어 사양](docs/KJH/player-spec.md)
- [에셋 속성](docs/KJH/asset-attributes.md)

### 데이터 구조

- [DB 스키마 참고](docs/KJH/schema.prisma)
- [아키텍처](docs/KJH/architecture.md)
- 프론트 타입 정의: `client/src/types/domain.ts`

### API / 외부 서비스 연동

| Method / 방식 | Endpoint / 서비스 | 설명 | 요청 | 응답 | 비고 |
|---|---|---|---|---|---|
| REST | `POST /api/session` | 원격 세션 생성 | nickname | session | 기본 Mock |
| REST | `GET /api/assets` | 기본/내 에셋 조회 | user id | assets | 기본 Mock |
| REST | `POST /api/assets/generate` | 에셋 생성 요청 | image, prompt/attrs | asset/job | 기본 Mock |
| REST | `GET /api/rooms` | 방 목록 조회 | - | rooms | 기본 Mock |
| REST | `POST /api/rooms` | 방 생성 | name, visibility, max players | room | 기본 Mock |
| REST | `POST /api/rooms/:id/join` | 방 입장 | user id, password | room | 기본 Mock |
| Realtime | Socket.IO/BroadcastChannel | 방 상태, 페이즈, 검증, 레이스 좌표 동기화 | event payload | room snapshot/event | remote는 Socket.IO, local은 명시적 BroadcastChannel |

---

## 산출물 및 실행 방법

- **산출물 설명:** 브라우저에서 실행되는 Frontend V2 + backend REST/realtime 계약 기반 웹 앱
- **실행 환경:** Node.js, npm, Chromium 계열 브라우저 권장
- **실행 방법:** `npm install` 후 `npm run dev:v2`
- **접속 주소:** `http://localhost:5174/ui-v2.html#/login`, `http://localhost:5174/`, `http://192.168.0.200:5174/`, `https://mad-mario.madcamp-kaist.org/`

### 실행 방법

```bash
# 의존성 설치
npm install

# V2 backend + frontend 개발 서버
npm run dev:v2

# 프론트 개발 서버만 실행
npm run dev:client

# 백엔드 개발 서버만 실행
npm run dev:backend

# 빌드 산출물 프리뷰
npm run preview --workspace client

# 검증
npm run check:v2
```

### 기술 구성

| 분류 | 사용 기술 |
|---|---|
| 핵심 기술 | Vite, React, TypeScript, Phaser, Zustand |
| 실행 환경 | Node.js, npm, Cloudflare Tunnel |
| 데이터 저장 | V2 mock/localStorage, backend in-memory REST, GPU worker job claim/result contract |
| 외부 API / 서비스 | backend Socket.IO 계약, BroadcastChannel local realtime, Qwen prompt refinement, WAN sprite generation, explicit gateway compatibility mode |
| 기타 | `react-sketch-canvas`, Oxlint |

---

## 회고 문서

> [KPT 방법론 참고](https://velog.io/@habwa/%EB%8B%A8%EA%B8%B0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%ED%9A%8C%EA%B3%A0-KPT-%EB%B0%A9%EB%B2%95%EB%A1%A0)

### Keep — 잘 된 점, 다음에도 유지할 것

-
-
-

### Problem — 아쉬웠던 점, 개선이 필요한 것

-
-
-

### Try — 다음번에 시도해볼 것

-
-
-

### 팀원별 소감

**김재훈:**

> 

**이서진B:**

> 

---

## 참고 자료

### 실시간 인터랙션

**WebSocket**
- https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
- https://techblog.woowahan.com/5268/
- https://tech.kakao.com/posts/391
- https://daleseo.com/websocket/
- https://kakaoentertainment-tech.tistory.com/110

**Socket.IO**
- https://socket.io/docs/v4/
- https://inpa.tistory.com/entry/SOCKET-%F0%9F%93%9A-Namespace-Room-%EA%B8%B0%EB%8A%A5
- https://adjh54.tistory.com/549
- https://fred16157.github.io/node.js/nodejs-socketio-communication-room-and-namespace/

**SSE (Server-Sent Events)**
- https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- https://developer.mozilla.org/ko/docs/Web/API/Server-sent_events/Using_server-sent_events
- https://api7.ai/ko/blog/what-is-sse

**TCP / UDP Socket**
- https://docs.python.org/3/library/socket.html
- https://inpa.tistory.com/entry/NW-%F0%9F%8C%90-%EC%95%84%EC%A7%81%EB%8F%84-%EB%AA%A8%ED%98%B8%ED%95%9C-TCP-UDP-%EA%B0%9C%EB%85%90-%E2%9D%93-%EC%89%BD%EA%B2%8C-%EC%9D%B4%ED%95%B4%ED%95%98%EC%9E%90

**gRPC Streaming**
- https://grpc.io/docs/what-is-grpc/core-concepts/
- https://tech.ktcloud.com/entry/gRPC%EC%9D%98-%EB%82%B4%EB%B6%80-%EA%B5%AC%EC%A1%B0-%ED%8C%8C%ED%97%A4%EC%B9%98%EA%B8%B0-HTTP2-Protobuf-%EA%B7%B8%EB%A6%AC%EA%B3%A0-%EC%8A%A4%ED%8A%B8%EB%A6%AC%EB%B0%8D
- https://tech.ktcloud.com/entry/gRPC%EC%9D%98-%EB%82%B4%EB%B6%80-%EA%B5%AC%EC%A1%B0-%ED%8C%8C%ED%97%A4%EC%B9%98%EA%B8%B02-Channel-Stub
- https://inspirit941.tistory.com/371
- https://devocean.sk.com/blog/techBoardDetail.do?ID=167433

**WebRTC**
- https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- https://webrtc.org/getting-started/overview
- https://web.dev/articles/webrtc-basics?hl=ko
- https://devocean.sk.com/blog/techBoardDetail.do?ID=164885
- https://beomkey-nkb.github.io/%EA%B0%9C%EB%85%90%EC%A0%95%EB%A6%AC/webRTC%EC%A0%95%EB%A6%AC/
- https://gh402.tistory.com/45
- https://on.com2us.com/tech/webrtc-coturn-turn-stun-server-setup-guide/

**QUIC / WebTransport**
- https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API
- https://datatracker.ietf.org/doc/html/rfc9000
- https://news.hada.io/topic?id=13888

#### KCLOUD VM / Cloudflare Tunnel 환경별 주의사항

| 환경 | 사용 가능(권장) 기술 | 포트/조건 | 주의할 기술 |
|---|---|---|---|
| **로컬 / 일반 VM** | HTTP/REST, WebSocket, Socket.IO, SSE, TCP Socket, gRPC Streaming, WebRTC, QUIC/WebTransport 등 대부분 가능 | 직접 포트 개방 가능. 예: 3000, 5000, 8000, 8080, 9000 등. 외부 공개 시 방화벽/보안그룹/공인 IP 설정 필요 | WebRTC는 STUN/TURN 필요 가능. QUIC/WebTransport는 HTTP/3 · UDP 지원 필요 |
| **KCLOUD VM (VPN 내부)** | HTTP/REST, WebSocket, Socket.IO, SSE, WebRTC 시그널링 | 접속 기기 VPN 필요. 기본 허용 포트: **22, 80, 443**. 개발 포트(3000, 8000, 8080 등)는 직접 접근 제한 가능 | TCP Socket은 포트 제한 있음. gRPC는 HTTP/2 설정 필요. WebRTC 미디어·UDP·QUIC/WebTransport 비권장 |
| **KCLOUD VM + Tunnel** | HTTP/REST, WebSocket, Socket.IO, SSE, WebRTC 시그널링 | VM의 `localhost:<port>`를 도메인에 연결. `localPort`는 **1024~65535**. 예: 3000, 8000, 8080 가능 | 순수 TCP Socket, UDP, WebRTC 미디어/DataChannel, QUIC/WebTransport 불가. gRPC 보장 어려움 |
| **외부 서비스 + 우리 도메인** | HTTP/REST, WebSocket, Socket.IO, SSE, WebRTC 시그널링 | Vercel/Netlify/Railway/Render/AWS/GCP 등에 배포 후 CNAME/A 레코드 연결. 보통 외부는 **443** 사용 | WebSocket/gRPC/TCP/UDP는 플랫폼 지원 여부 확인 필요. 서버리스 플랫폼은 장시간 연결 제한 가능 |
| **서버 없이 외부 SaaS 사용** | Supabase Realtime, Firebase, Pusher/Ably, LLM API Streaming | 직접 포트 관리 불필요. 각 서비스 SDK/API 사용 | 커스텀 TCP/UDP 서버 구현 불가. WebRTC는 STUN/TURN 필요할 수 있음 |

### LLM Wrapper

- https://github.com/teddylee777/openai-api-kr
- https://github.com/teddylee777/langchain-kr
- https://devocean.sk.com/blog/techBoardDetail.do?ID=167407
- https://mastra.ai/docs

### Cross-Platform

- https://flutter.dev/
- https://reactnative.dev/
- https://docs.expo.dev/
- https://kotlinlang.org/multiplatform/

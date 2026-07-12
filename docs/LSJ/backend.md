# Backend 서버 구현 최종 계획서

이 문서는 현재 저장소의 백엔드 서버를 구현하기 위한 최종 실행 문서이다. `colaboration.md`, `communication.md`, `communication_rule.md`, `qwen.md`, `plan.md`를 읽고 백엔드 구현에 필요한 결정만 모아 정리했다. 백엔드 Codex 또는 사람이 이 파일을 기준으로 바로 코드 구현을 시작할 수 있어야 한다.

문서 기준일: 2026-07-11

## 0. 현재 저장소 기준

현재 `/home/26s-w2-c3-08`에는 실제 백엔드 코드가 아직 없다. 존재하는 파일은 문서 중심이다.

```text
README.md
plan.md
colaboration.md
communication.md
communication_rule.md
qwen.md
backend.md
```

현재 Git 상태에서는 `README.md`가 수정되어 있고, 문서 파일들이 아직 untracked 상태다. Codex는 이 변경사항을 사용자 또는 다른 작업자의 작업으로 보고 보존해야 한다.

백엔드 구현자는 먼저 다음 문서를 읽는다.

| 문서 | 역할 |
|---|---|
| `colaboration.md` | 같은 서버에서 두 계정과 Codex가 안전하게 작업하기 위한 권한/Git 규칙 |
| `communication_rule.md` | 여러 Codex가 Git 브랜치로 task, claim, result를 주고받는 규칙 |
| `communication.md` | Backend 서버와 Qwen/WAN 서버 사이의 통신 계약 |
| `qwen.md` | Qwen 서버 Codex가 구현해야 할 Gateway/vLLM 서버 계획 |
| `plan.md` | 전체 MVP 게임 기획, 기능 범위, 기술 스택 |
| `backend.md` | Backend 서버 구현자가 따라야 할 최종 구현 계획 |

주의할 점: `plan.md`에는 초기 기획 표현으로 OpenAI API가 언급되어 있지만, 현재 최종 통신 결정은 `communication.md`와 `qwen.md`를 따른다. 즉, 백엔드는 사용자 이미지와 prompt를 OpenAI API가 아니라 내부 Qwen Gateway `http://172.10.5.138:8001/v1/prompts/refine`로 보내고, Qwen 결과를 WAN 서버 payload로 변환한다.

## 1. 백엔드의 책임

백엔드는 게임 전체 흐름의 오케스트레이터다. Qwen 서버와 WAN 서버는 백엔드 뒤의 내부 서비스일 뿐이고, 브라우저는 이 둘을 직접 알면 안 된다.

백엔드가 담당하는 일:

1. 임시 사용자 세션 발급
2. public/private 방 생성과 입장
3. Socket.IO 기반 방 상태, 페이즈, 타이머, 레이스 좌표 동기화
4. 기본 에셋과 사용자 생성 에셋 조회
5. 아바타/에셋 생성 Job 생성
6. 업로드 이미지 임시 저장
7. Qwen 서버 호출
8. Qwen 결과를 WAN 서버 payload로 변환
9. WAN 서버 호출
10. 생성된 sprite 저장
11. DB에 Asset과 Job 결과 기록
12. 맵 세그먼트 저장, 검증, 병합
13. 레이스 결과 산출

백엔드가 하지 않는 일:

- 브라우저에 Qwen 서버 URL 또는 내부 토큰 노출
- 브라우저에 WAN 서버 URL 또는 내부 토큰 노출
- Qwen 서버가 준비되지 않았는데 성공처럼 꾸민 prompt 생성
- WAN 서버가 준비되지 않았는데 성공처럼 꾸민 sprite 생성
- Qwen 서버 대신 이미지 이해 결과를 임의로 작성
- 원본 이미지나 사용자 prompt 전체를 장기 로그에 남기기

## 2. 최종 기술 스택

MVP 백엔드는 다음 조합으로 고정한다.

| 영역 | 기술 |
|---|---|
| 런타임 | Node.js 20 이상 |
| 언어 | TypeScript |
| HTTP 서버 | Express |
| 실시간 통신 | Socket.IO |
| DB | PostgreSQL |
| ORM | Prisma |
| 입력 검증 | Zod |
| 파일 업로드 | multer |
| 이미지 저장 | 로컬 업로드 디렉터리 |
| 비밀번호 해시 | bcryptjs 또는 argon2 |
| Job 실행 | 서버 내부 polling worker |
| 테스트 | Vitest 또는 Jest, Supertest |

MVP에서는 Redis, BullMQ, S3, Kafka 같은 외부 큐/스토리지는 필수로 도입하지 않는다. 단, 코드 구조는 나중에 큐와 객체 저장소로 교체 가능하게 adapter 경계를 둔다.

## 3. 최종 아키텍처

```text
Browser
  -> Express REST API
  -> Socket.IO namespace
  -> PostgreSQL via Prisma
  -> Local upload storage
  -> AssetGenerationWorker
  -> Qwen Prompt Gateway at http://172.10.5.138:8001
  -> WAN Sprite Server
  -> Local generated asset storage
  -> Browser notification via Socket.IO or polling
```

Qwen 서버와 WAN 서버는 백엔드 worker에서만 호출한다. 사용자 요청 handler에서 45초 이상 Qwen/WAN 응답을 기다리지 않는다. 사용자가 AI 생성 요청을 보내면 백엔드는 먼저 Job ID를 반환하고, worker가 비동기로 진행한다.

## 4. 환경 변수

백엔드는 `.env.example`을 반드시 제공한다. 실제 `.env`는 Git에 올리지 않는다.

```bash
NODE_ENV=development
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/relay_map_maker

UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=8

QWEN_BASE_URL=http://172.10.5.138:8001
QWEN_API_TOKEN=<REAL_SHARED_QWEN_INTERNAL_TOKEN>
QWEN_TIMEOUT_MS=45000
QWEN_MAX_RETRIES=2
QWEN_WORKER_CONCURRENCY=1

WAN_API_BASE_URL=<REAL_WAN_API_BASE_URL>
WAN_API_TOKEN=<REAL_WAN_API_TOKEN>
WAN_TIMEOUT_MS=90000
WAN_MAX_RETRIES=1

JOB_POLL_INTERVAL_MS=2000
JOB_STALE_RETRY_AFTER_MS=120000

BUILDING_DURATION_SEC=180
VALIDATING_DURATION_SEC=120
RACING_DURATION_SEC=300
RACE_OVERTIME_SEC=30
VALIDATION_FAIL_FREEZE_MS=15000

ROOM_MAX_PLAYERS=4
GRID_SIZE=32
SEGMENT_MAX_WIDTH_CELLS=120
SEGMENT_MAX_HEIGHT_CELLS=36
SEGMENT_MAX_Y_DELTA_CELLS=10
```

필수 원칙:

- `QWEN_API_TOKEN`, `WAN_API_TOKEN`, `DATABASE_URL`의 실제 값은 문서나 Git에 기록하지 않는다.
- `WAN_API_BASE_URL`이 없으면 WAN 호출 성공을 fake로 만들지 않는다. Job은 실제 원인과 함께 실패 또는 대기 상태가 되어야 한다.
- 개발 중 Qwen 서버가 timeout이면 그 사실을 그대로 Job 상태에 기록한다.

## 5. 권장 디렉터리 구조

백엔드 코드는 `backend/` 아래에 둔다.

```text
backend/
  package.json
  tsconfig.json
  .env.example
  prisma/
    schema.prisma
    seed.ts
  src/
    index.ts
    config/
      env.ts
    db/
      prisma.ts
    http/
      app.ts
      middleware/
        errorHandler.ts
        upload.ts
      routes/
        sessionRoutes.ts
        assetRoutes.ts
        roomRoutes.ts
        segmentRoutes.ts
    socket/
      index.ts
      roomSocket.ts
      raceSocket.ts
    services/
      sessionService.ts
      assetService.ts
      roomService.ts
      phaseService.ts
      mapMergeService.ts
      raceResultService.ts
    workers/
      assetGenerationWorker.ts
    clients/
      qwenClient.ts
      wanClient.ts
    storage/
      localStorage.ts
    schemas/
      common.ts
      sessionSchemas.ts
      assetSchemas.ts
      roomSchemas.ts
      segmentSchemas.ts
      socketSchemas.ts
    types/
      domain.ts
    utils/
      asyncHandler.ts
      logger.ts
      ids.ts
  tests/
    qwenClient.test.ts
    roomService.test.ts
    mapMergeService.test.ts
```

구현 초반에는 `backend/` 아래만 수정한다. 기존 문서 파일은 계약 변경이 필요할 때만 수정한다.

## 6. Prisma 데이터 모델

아래 schema를 첫 구현 기준으로 사용한다. 필요한 경우 필드를 추가할 수 있지만, 핵심 상태와 관계는 유지한다.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AssetType {
  AVATAR
  DEVICE
  TERRAIN
  ENEMY
  ITEM
  BACKGROUND
}

enum AssetStatus {
  READY
  GENERATING
  FAILED
}

enum GenerationTargetType {
  avatar
  asset
}

enum GenerationJobStatus {
  PENDING
  REFINING_PROMPT
  GENERATING_SPRITE
  DONE
  FAILED
  PENDING_RETRY
}

enum RoomPhase {
  LOBBY
  BUILDING
  VALIDATING
  MERGING
  RACING
  RESULTS
}

enum ColliderType {
  NONE
  SOLID
  HAZARD
  TRIGGER
  COLLECTIBLE
}

model User {
  id            String   @id @default(uuid())
  nickname      String
  avatarAssetId String?
  racePenaltyMs Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  assets         Asset[]
  jobs           AssetGenerationJob[]
  roomPlayers    RoomPlayer[]
  mapSegments    MapSegment[]
  raceResults    RaceResult[]
}

model Asset {
  id             String      @id @default(uuid())
  ownerId        String?
  type           AssetType
  name           String
  spriteUrl      String
  sourceImageUrl String?
  status         AssetStatus @default(READY)
  placementCost  Int         @default(1)
  colliderType   ColliderType @default(NONE)
  widthCells     Int         @default(1)
  heightCells    Int         @default(1)
  metadata       Json?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  owner          User?       @relation(fields: [ownerId], references: [id])
}

model AssetGenerationJob {
  id                  String              @id @default(uuid())
  userId              String
  targetType          GenerationTargetType
  assetType           AssetType?
  status              GenerationJobStatus @default(PENDING)
  userPrompt          String
  originalImagePath   String
  originalImageMime   String
  refinedPrompt       String?
  negativePrompt      String?
  visualSummaryKo     String?
  qwenResponse        Json?
  wanResponse         Json?
  outputAssetId       String?
  errorCode           String?
  errorMessage        String?
  retryCount          Int                 @default(0)
  nextRetryAt         DateTime?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  user                User                @relation(fields: [userId], references: [id])
}

model Room {
  id               String    @id @default(uuid())
  name             String
  isPublic         Boolean   @default(true)
  passwordHash     String?
  phase            RoomPhase @default(LOBBY)
  maxPlayers       Int       @default(4)
  phaseEndsAt      DateTime?
  mergedMap        Json?
  createdByUserId  String
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  players          RoomPlayer[]
  mapSegments      MapSegment[]
  raceResults      RaceResult[]
}

model RoomPlayer {
  id        String   @id @default(uuid())
  roomId    String
  userId    String
  nickname  String
  isHost    Boolean  @default(false)
  joinedAt  DateTime @default(now())
  leftAt    DateTime?

  room      Room     @relation(fields: [roomId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@unique([roomId, userId])
}

model MapSegment {
  id             String   @id @default(uuid())
  roomId         String
  creatorId      String
  startPoint     Json
  endPoint       Json
  assets         Json
  segmentHash    String
  isSubmitted    Boolean  @default(false)
  isValidated    Boolean  @default(false)
  validatedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  room           Room     @relation(fields: [roomId], references: [id])
  creator        User     @relation(fields: [creatorId], references: [id])

  @@unique([roomId, creatorId])
}

model RaceResult {
  id              String   @id @default(uuid())
  roomId          String
  userId          String
  finished        Boolean
  finishTimeMs    Int?
  distanceToGoal  Float?
  rank            Int?
  penaltyMs       Int      @default(0)
  createdAt       DateTime @default(now())

  room            Room     @relation(fields: [roomId], references: [id])
  user            User     @relation(fields: [userId], references: [id])

  @@unique([roomId, userId])
}
```

## 7. REST API

모든 응답은 기본적으로 JSON이다. 에러 형식은 아래로 통일한다.

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "nickname is required"
  }
}
```

### 7.1 Session

#### `POST /session`

닉네임 기반 임시 사용자를 만든다.

Request:

```json
{
  "nickname": "player1"
}
```

Response:

```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "nickname": "player1",
    "avatarAssetId": null
  }
}
```

MVP에서는 쿠키 세션 대신 `user_id`를 클라이언트 상태에 보관해 이후 요청 body 또는 header로 전달해도 된다. 다만 route schema는 명확히 둔다.

### 7.2 Assets

#### `GET /assets?user_id=<id>`

기본 제공 에셋과 사용자의 생성 에셋을 함께 반환한다.

Response:

```json
{
  "ok": true,
  "assets": [
    {
      "id": "asset-id",
      "ownerId": null,
      "type": "TERRAIN",
      "name": "Basic Ground",
      "spriteUrl": "/static/assets/basic-ground.png",
      "placementCost": 1,
      "colliderType": "SOLID",
      "widthCells": 1,
      "heightCells": 1,
      "status": "READY"
    }
  ]
}
```

#### `POST /assets/avatar/generate`

아바타 생성 Job을 만든다. 즉시 Qwen/WAN을 기다리지 않는다.

Content-Type: `multipart/form-data`

Fields:

| Field | Required | 설명 |
|---|---:|---|
| `user_id` | yes | 요청 사용자 |
| `user_prompt` | yes | 1자 이상 500자 이하 |
| `image` | yes | PNG/JPEG/WEBP, 8MB 이하 |

Response:

```json
{
  "ok": true,
  "job": {
    "id": "job-id",
    "status": "PENDING"
  }
}
```

#### `POST /assets/generate`

일반 에셋 생성 Job을 만든다.

Fields:

| Field | Required | 설명 |
|---|---:|---|
| `user_id` | yes | 요청 사용자 |
| `asset_type` | yes | `DEVICE`, `TERRAIN`, `ENEMY`, `ITEM`, `BACKGROUND` |
| `user_prompt` | yes | 1자 이상 500자 이하 |
| `image` | yes | PNG/JPEG/WEBP, 8MB 이하 |

Response는 아바타 생성과 동일하다.

#### `GET /assets/generation-jobs/:jobId`

AI 생성 상태를 조회한다.

Response:

```json
{
  "ok": true,
  "job": {
    "id": "job-id",
    "status": "GENERATING_SPRITE",
    "targetType": "avatar",
    "outputAssetId": null,
    "errorCode": null,
    "errorMessage": null
  }
}
```

### 7.3 Rooms

#### `GET /rooms`

로비 방 목록을 반환한다. public/private 모두 목록에는 보이되, private은 비밀번호 입력이 필요하다.

Response:

```json
{
  "ok": true,
  "rooms": [
    {
      "id": "room-id",
      "name": "Room 1",
      "isPublic": true,
      "hostNickname": "player1",
      "currentPlayers": 2,
      "maxPlayers": 4,
      "phase": "LOBBY",
      "phaseEndsAt": null
    }
  ]
}
```

#### `POST /rooms`

방을 만든다.

Request:

```json
{
  "user_id": "user-id",
  "name": "Room 1",
  "is_public": true,
  "password": null,
  "max_players": 4
}
```

private 방이면 `password`를 bcrypt/argon2로 해시해서 저장한다.

#### `POST /rooms/public/join`

대기 중이고 정원이 차지 않은 public 방 중 하나에 무작위로 입장한다.

Request:

```json
{
  "user_id": "user-id"
}
```

#### `POST /rooms/:roomId/join`

특정 방에 입장한다.

Request:

```json
{
  "user_id": "user-id",
  "password": "optional-private-room-password"
}
```

### 7.4 Map Segments

#### `POST /rooms/:roomId/segments`

제작 단계가 끝났거나 사용자가 제출을 눌렀을 때 맵 스냅샷을 저장한다.

Request:

```json
{
  "user_id": "user-id",
  "start_point": { "x": 0, "y": 20 },
  "end_point": { "x": 80, "y": 18 },
  "assets": [
    {
      "asset_id": "asset-id",
      "x": 4,
      "y": 22,
      "width_cells": 1,
      "height_cells": 1,
      "rotation": 0
    }
  ]
}
```

서버는 다음을 검증한다.

- 시작점과 끝점이 각각 1개다.
- 충돌 에셋은 32x32 그리드 좌표에 있다.
- 맵 폭/높이 제한을 넘지 않는다.
- `end.y - start.y` 절댓값이 `SEGMENT_MAX_Y_DELTA_CELLS` 이하이다.
- `segment_hash`를 서버에서 계산한다.

#### `POST /rooms/:roomId/segments/validate`

검증 플레이 성공 여부를 저장한다. MVP에서는 클라이언트가 클리어 결과를 보내고, 서버는 검증 페이즈와 segment hash 일치 여부를 확인한다.

Request:

```json
{
  "user_id": "user-id",
  "segment_hash": "sha256",
  "cleared": true,
  "clear_time_ms": 48320
}
```

검증 실패자는 레이스 시작 시 `VALIDATION_FAIL_FREEZE_MS`만큼 freeze 패널티를 받는다.

## 8. Socket.IO 이벤트

Socket 연결 시 클라이언트는 `user_id`를 auth에 넣는다.

```ts
io("http://localhost:3000", {
  auth: { userId }
});
```

### 8.1 Client -> Server

| Event | Payload | 설명 |
|---|---|---|
| `room:join` | `{ roomId, userId }` | Socket room 입장 |
| `room:start` | `{ roomId, userId }` | host가 게임 시작 |
| `phase:ready` | `{ roomId, userId, phase }` | 클라이언트 준비 상태 |
| `time_vote:request` | `{ roomId, userId, phase, deltaSec }` | `+15` 또는 `-15` 투표 |
| `segment:submitted` | `{ roomId, userId, segmentId }` | REST 제출 후 실시간 알림 |
| `validation:completed` | `{ roomId, userId, cleared, segmentHash, clearTimeMs }` | 검증 결과 |
| `race:position` | `{ roomId, userId, x, y, vx, vy, state, clientTime }` | 레이스 좌표 브로드캐스트 |
| `race:finish` | `{ roomId, userId, finishTimeMs }` | 완주 |

### 8.2 Server -> Client

| Event | Payload | 설명 |
|---|---|---|
| `room:joined` | room snapshot | 입장 결과 |
| `room:state` | room snapshot | 방 전체 상태 |
| `phase:changed` | `{ roomId, phase, phaseEndsAt }` | 페이즈 전환 |
| `timer:tick` | `{ roomId, phase, remainingMs }` | 타이머 |
| `time_vote:updated` | vote state | 시간 조정 투표 상태 |
| `segment:submitted` | `{ userId, segmentId }` | 제출 현황 |
| `validation:result` | `{ userId, cleared, penaltyMs }` | 검증 결과 |
| `map:merged` | merged map payload | 최종 레이스 맵 |
| `race:position` | player position | 다른 플레이어 좌표 |
| `race:finished` | `{ userId, finishTimeMs }` | 완주 알림 |
| `results:final` | ranking payload | 최종 순위 |
| `asset_job:updated` | job snapshot | AI 생성 Job 상태 |
| `error` | error body | 이벤트 처리 오류 |

## 9. Room Phase 상태 머신

페이즈는 서버가 권위 있게 관리한다.

```text
LOBBY
  -> BUILDING
  -> VALIDATING
  -> MERGING
  -> RACING
  -> RESULTS
```

기본 duration:

| Phase | Duration |
|---|---:|
| `BUILDING` | 180초 |
| `VALIDATING` | 120초 |
| `MERGING` | 서버 처리 완료 시까지 |
| `RACING` | 300초 |
| overtime | 30초 |

페이즈 전환 규칙:

- host가 `room:start`를 보내면 `LOBBY -> BUILDING`.
- `BUILDING` 종료 시 제출하지 않은 플레이어는 현재 클라이언트 상태가 없으므로 빈/기본 세그먼트가 아니라 `not submitted`로 처리한다.
- `VALIDATING` 종료 시 `cleared = true`인 세그먼트만 병합 대상이다.
- 검증 성공 세그먼트가 0개면 기본 제공 세그먼트를 사용한다.
- `MERGING`에서 병합 결과를 DB에 저장한 뒤 `RACING`으로 넘어간다.
- `RACING` 종료 시 완주자가 없으면 30초 overtime으로 전환한다.
- overtime 종료 후 완주자와 미완주자를 섞어 최종 순위를 계산하고 `RESULTS`로 전환한다.

## 10. Map 병합 규칙

검증 성공 세그먼트를 무작위 순서로 섞은 뒤 하나의 전역 맵으로 병합한다.

병합 알고리즘:

1. 검증 성공 세그먼트를 조회한다.
2. 없다면 seed 데이터의 기본 세그먼트를 사용한다.
3. 순서를 랜덤 shuffle한다.
4. 첫 세그먼트의 `start_point`가 전역 시작점이 되도록 offset을 계산한다.
5. 다음 세그먼트는 `currentGlobalEnd`와 `next.start_point`가 이어지도록 X/Y offset을 적용한다.
6. 세그먼트 사이에는 안전 연결용 기본 지형 타일을 최소 3칸 삽입한다.
7. 전체 asset 좌표를 전역 좌표로 변환한다.
8. 최종 `global_start`, `global_end`, `assets`, `segments`를 `Room.mergedMap`에 저장한다.

Y축 연결은 반드시 반영한다. 단, 한 세그먼트의 시작점과 끝점 Y 차이가 너무 크면 제출 단계에서 거부하거나 보정한다.

## 11. AI 생성 Job 흐름

Job 상태는 `communication.md`와 `qwen.md`의 규약을 그대로 따른다.

```text
PENDING
  -> REFINING_PROMPT
  -> GENERATING_SPRITE
  -> DONE
  -> FAILED
  -> PENDING_RETRY
```

worker 루프:

1. `PENDING` 또는 `PENDING_RETRY` 중 `nextRetryAt <= now`인 Job을 가져온다.
2. row lock 또는 transaction으로 한 worker만 잡도록 한다.
3. 상태를 `REFINING_PROMPT`로 바꾼다.
4. `QwenClient.refinePrompt(job)`을 호출한다.
5. 성공하면 `refinedPrompt`, `negativePrompt`, `visualSummaryKo`, `qwenResponse`를 저장한다.
6. 상태를 `GENERATING_SPRITE`로 바꾼다.
7. `WanClient.generateSprite(job, qwenResult)`를 호출한다.
8. 성공하면 생성 이미지를 저장하고 Asset을 만든다.
9. Job을 `DONE`으로 바꾸고 `asset_job:updated`를 보낸다.
10. 실패하면 status code와 error code에 따라 retry 또는 `FAILED`로 처리한다.

Qwen retry 정책:

| Qwen status | 처리 |
|---:|---|
| 200 | WAN 단계 진행 |
| 400 | `FAILED`, 사용자 입력 오류 |
| 401 | `FAILED`, 운영 설정 오류, 재시도 금지 |
| 413 | `FAILED`, 이미지 용량 초과 |
| 422 | 최대 1회 재시도 후 `FAILED` |
| 429 | 5초 뒤 재시도, 최대 2회 |
| 500 | 1회 재시도 |
| 503 | `PENDING_RETRY`, 나중에 재시도 |
| timeout | 1회 재시도 후 `FAILED` 또는 `PENDING_RETRY` |

WAN 서버 스펙이 아직 확정되지 않았더라도 fake sprite를 만들면 안 된다. WAN endpoint가 없으면 `WAN_NOT_CONFIGURED`로 실패시키고, 기본 아바타/기본 에셋으로 게임을 계속하게 한다.

## 12. QwenClient 계약

백엔드가 Qwen 서버로 보내는 요청은 반드시 multipart/form-data다.

```ts
export interface QwenRefineResult {
  ok: true;
  request_id: string;
  schema_version: "1.0";
  model: string;
  engine: string;
  target_type: "avatar" | "asset";
  visual_summary_ko: string;
  user_intent_ko: string;
  wan_prompt: string;
  wan_negative_prompt: string;
  sprite_requirements: {
    background: string;
    view: string;
    framing: string;
    style: string;
    recommended_size: string;
  };
  safety_flags: string[];
  warnings: string[];
  confidence: number;
  latency_ms: number;
}
```

호출 pseudo-code:

```ts
const form = new FormData();
form.append("request_id", job.id);
form.append("user_id", job.userId);
form.append("target_type", job.targetType);
form.append("user_prompt", job.userPrompt);
form.append("locale", "ko-KR");
form.append("style_preset", "platformer_sprite");
form.append("output_language", "en");

if (job.assetType) {
  form.append("asset_type", job.assetType);
}

const imageBlob = new Blob([imageBuffer], { type: job.originalImageMime });
form.append("image", imageBlob, path.basename(job.originalImagePath));

const res = await fetch(`${env.QWEN_BASE_URL}/v1/prompts/refine`, {
  method: "POST",
  headers: {
    "X-Internal-Token": env.QWEN_API_TOKEN
  },
  body: form,
  signal: AbortSignal.timeout(env.QWEN_TIMEOUT_MS)
});
```

응답 검증:

- HTTP 200이어도 JSON schema를 Zod로 검증한다.
- `ok !== true`이면 실패로 처리한다.
- `request_id !== job.id`이면 실패로 처리한다.
- `wan_prompt`가 비어 있으면 실패로 처리한다.
- `sprite_requirements.background`가 없으면 실패로 처리한다.

## 13. WAN adapter 계약

Qwen 결과를 WAN 서버 payload로 변환하는 것은 백엔드 책임이다. Qwen 응답 JSON을 WAN에 그대로 전달하지 않는다.

기본 payload:

```json
{
  "request_id": "job-id",
  "mode": "image_to_sprite",
  "target_type": "avatar",
  "prompt": "A cute full-body 2D platformer game avatar sprite...",
  "negative_prompt": "photorealistic, 3D render, blurry...",
  "reference_image_url": "http://backend/internal-assets/originals/job-id.png",
  "width": 512,
  "height": 512,
  "background": "transparent",
  "num_outputs": 1
}
```

WAN이 multipart file을 요구하면 `reference_image_url` 대신 원본 image file을 보낸다. 이 차이는 `WanClient` 내부에만 숨긴다.

WAN 응답은 아직 확정되지 않았으므로 `WanClient`는 adapter interface를 둔다.

```ts
export interface WanGenerateResult {
  imageBuffer: Buffer;
  mimeType: "image/png" | "image/webp" | "image/jpeg";
  raw: unknown;
}
```

WAN 구현 전 임시 처리는 다음 중 하나만 허용한다.

- `WAN_NOT_CONFIGURED`로 Job 실패 처리
- WAN 통합 task를 blocked로 보고
- 기본 아바타를 사용자에게 유지

허용하지 않는 것:

- 빈 PNG를 성공 결과로 저장
- 기존 기본 에셋을 AI 생성 결과처럼 저장
- 임의 prompt로 성공 처리

## 14. 파일 저장 규칙

MVP는 로컬 저장소를 사용한다.

```text
backend/uploads/
  originals/
    <job-id>.<ext>
  generated/
    <asset-id>.png
  static/
    base-assets/
```

규칙:

- 원본 업로드는 Job 처리와 디버깅을 위해 보관하되, 장기 운영에서는 retention 정책을 둔다.
- 파일명에는 사용자 입력 문자열을 직접 쓰지 않는다.
- MIME type과 확장자는 서버 검증 결과를 기준으로 정한다.
- 정적 제공 URL은 `/static/uploads/...` 또는 `/assets/files/...` 중 하나로 통일한다.

## 15. Zod schema

모든 REST body, query, params, Socket payload는 Zod로 검증한다.

예시:

```ts
export const createSessionSchema = z.object({
  nickname: z.string().trim().min(1).max(20)
});

export const createRoomSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  is_public: z.boolean(),
  password: z.string().min(1).max(80).nullable().optional(),
  max_players: z.number().int().min(2).max(4).default(4)
});

export const submitSegmentSchema = z.object({
  user_id: z.string().uuid(),
  start_point: z.object({ x: z.number().int(), y: z.number().int() }),
  end_point: z.object({ x: z.number().int(), y: z.number().int() }),
  assets: z.array(z.object({
    asset_id: z.string().uuid(),
    x: z.number().int(),
    y: z.number().int(),
    width_cells: z.number().int().min(1),
    height_cells: z.number().int().min(1),
    rotation: z.number().default(0)
  })).max(500)
});
```

## 16. 구현 순서

아래 순서로 구현하면 충돌과 범위 폭발을 줄일 수 있다.

### Step 1. 프로젝트 스캐폴딩

- `backend/package.json`
- `tsconfig.json`
- Express app
- Socket.IO server
- health route
- env loader

검증:

```bash
cd backend
npm install
npm run dev
curl http://localhost:3000/health
```

### Step 2. DB와 Prisma

- Prisma schema 작성
- migration 생성
- seed로 기본 에셋과 기본 맵 세그먼트 생성

검증:

```bash
npx prisma validate
npx prisma migrate dev
npx prisma db seed
```

### Step 3. Session과 Room REST

- `POST /session`
- `GET /rooms`
- `POST /rooms`
- `POST /rooms/public/join`
- `POST /rooms/:roomId/join`

검증:

```bash
npm test -- room
```

### Step 4. Socket.IO 방/페이즈

- socket auth
- room join
- phase state machine
- timer tick
- time vote

검증:

- 브라우저 2개 또는 socket client 2개로 같은 방 입장
- `LOBBY -> BUILDING` 전환 확인
- timer tick 수신 확인

### Step 5. Asset 조회와 업로드 Job

- `GET /assets`
- `POST /assets/avatar/generate`
- `POST /assets/generate`
- `GET /assets/generation-jobs/:jobId`
- local upload 저장

검증:

- 실제 PNG/JPEG/WEBP 업로드
- 8MB 초과 파일 거부
- 이미지가 아닌 파일 거부

### Step 6. QwenClient

- `/health` 확인 client
- `/v1/prompts/refine` multipart 호출
- status code별 error mapping
- Zod response 검증

검증:

```bash
curl -i http://172.10.5.138:8001/health
```

현재 문서 기준으로 `172.10.5.138:8001`은 timeout이 발생할 수 있다. 이 경우 QwenClient 테스트는 unit test와 timeout/error handling 중심으로 먼저 작성하고, 실제 통합 테스트는 Qwen 서버가 준비된 뒤 실행한다.

### Step 7. AssetGenerationWorker

- Job polling
- Qwen 호출
- WAN adapter 호출
- Asset 저장
- Socket 알림

검증:

- Qwen timeout 시 Job이 성공으로 바뀌지 않는다.
- WAN 미설정 시 `WAN_NOT_CONFIGURED`로 실패한다.
- 기본 아바타로 게임 진행이 가능하다.

### Step 8. Map Segment와 병합

- segment 제출
- segment hash 계산
- validation 결과 저장
- 병합 알고리즘

검증:

- 서로 다른 Y축의 segment가 자연스럽게 이어진다.
- 검증 성공 segment가 0개면 기본 segment가 사용된다.

### Step 9. Racing과 결과

- race position broadcast
- finish 기록
- 5분 종료와 30초 overtime
- 최종 ranking 계산

검증:

- 완주자는 finish time 오름차순
- 미완주자는 goal distance 오름차순
- 검증 실패자는 15초 freeze penalty 반영

## 17. 테스트 계획

최소 테스트:

| 영역 | 테스트 |
|---|---|
| env | 필수 환경 변수 누락 시 서버 시작 실패 |
| upload | MIME, 용량, 확장자 검증 |
| QwenClient | 200, 400, 401, 413, 422, 429, 500, 503, timeout |
| worker | 성공, Qwen 실패, WAN 실패, retry |
| room | public/private 생성과 입장 |
| phase | LOBBY부터 RESULTS까지 전환 |
| map merge | X/Y offset 병합 |
| race result | 완주/미완주 ranking |

테스트를 실행하지 못하면 결과 보고에 이유를 남긴다. 실패한 테스트를 성공처럼 쓰지 않는다.

## 18. 로깅과 보안

로그에 남길 수 있는 값:

- `request_id`
- `job_id`
- `room_id`
- `user_id`
- status
- error code
- latency
- file size
- MIME type

로그에 남기면 안 되는 값:

- `QWEN_API_TOKEN`
- `WAN_API_TOKEN`
- `.env` 내용
- 원본 이미지 바이너리
- 사용자 prompt 전체
- private room password

사용자 prompt는 필요하면 길이와 앞부분 일부만 남긴다.

```ts
const promptPreview = userPrompt.slice(0, 40);
```

## 19. Backend Codex 작업 프롬프트

백엔드 서버 구현을 다른 Codex에게 맡길 때 아래 프롬프트를 전달한다.

```text
너는 `/home/26s-w2-c3-08` 저장소의 Backend 구현 담당 Codex다.

반드시 먼저 `colaboration.md`, `communication_rule.md`, `communication.md`, `qwen.md`, `plan.md`, `backend.md`를 읽어라.

현재 저장소에는 문서만 있고 실제 백엔드 코드는 아직 없다고 가정한다. 기존 문서 변경사항은 사용자 또는 다른 Codex 작업으로 보고 절대 되돌리지 마라.

목표는 `backend/` 디렉터리에 Node.js + Express + Socket.IO + TypeScript + Prisma 기반 MVP 백엔드를 구현하는 것이다.

구현 원칙:
1. 브라우저는 Qwen/WAN 서버에 직접 접근하지 않는다.
2. Qwen/WAN 토큰은 환경 변수로만 관리한다.
3. Qwen 서버가 준비되지 않았으면 성공 응답을 fake로 만들지 않는다.
4. WAN 서버가 준비되지 않았으면 fake sprite를 만들지 않는다.
5. AI 생성은 Job worker에서 비동기로 처리한다.
6. 기본 아바타와 기본 에셋으로 게임 루프는 계속 진행 가능해야 한다.
7. 모든 REST/Socket payload는 Zod로 검증한다.
8. DB schema는 `backend.md`의 Prisma 모델을 기준으로 시작한다.
9. Socket.IO는 방 페이즈, 타이머, 검증 결과, 레이스 좌표, 최종 결과를 담당한다.
10. 구현 후 가능한 테스트와 `git diff --check`를 실행한다.

먼저 `backend/` 스캐폴딩, env loader, Express health route, Socket.IO 초기화, Prisma schema를 만든 뒤 작은 단위로 검증하라.
```

## 20. 완료 기준

백엔드 구현 1차 완료 기준:

- `backend/` 프로젝트가 생성되어 있다.
- `npm install`이 성공한다.
- `npm run dev`로 서버가 뜬다.
- `GET /health`가 성공한다.
- Prisma schema가 validate된다.
- `POST /session`이 임시 유저를 만든다.
- 방 생성/입장 API가 동작한다.
- Socket.IO로 같은 방에 두 클라이언트가 들어갈 수 있다.
- `POST /assets/avatar/generate`가 실제 Job을 만든다.
- worker가 Qwen 호출을 시도하고 실패/timeout을 실제 상태로 기록한다.
- fake Qwen 성공, fake WAN 성공, fake sprite가 없다.
- Qwen/WAN 실패 시에도 기본 에셋으로 방 진행이 막히지 않는다.
- 최소 unit test 또는 integration test가 하나 이상 존재한다.

최종 MVP 완료 기준은 `plan.md`의 “최종 성공 기준”과 `communication.md`의 “구현 완료 기준”을 함께 만족해야 한다.

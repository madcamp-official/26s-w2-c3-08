# DB 스키마 초안

> 전제: 첫 페이지에서 닉네임만 입력하고 시작 (회원가입/비밀번호 없음).
> 에셋에는 제작자가 기록된다. 속성 정의는 `asset-attributes.md` 참조.

## 설계 원칙

1. **닉네임 ≠ 식별자.** 유저 식별은 서버가 발급하는 `id`로 하고, 닉네임은
   표시용 문자열로만 취급한다. 닉네임을 PK로 쓰면 중복·사칭·개명 문제가
   전부 스키마 문제가 된다. 재접속 연결은 발급 토큰(localStorage)으로 처리.
2. **속성은 JSONB 하나로.** 카테고리마다 속성 구성이 다르고 앞으로도 늘어나므로,
   속성마다 컬럼을 파지 않고 `attrs JSONB` 한 컬럼에 담는다.
   유효성 검증은 DB가 아니라 서버 코드의 카테고리별 스키마(zod 등)로 수행한다.
   - 트레이드오프: DB 레벨 제약이 약해짐. 대신 옵션 추가 시 마이그레이션 불필요.
3. **수치는 저장하지 않는다.** 프리셋 enum 문자열(`"fast"`)만 저장하고,
   실제 물리값 매핑은 게임 코드의 상수 테이블이 가진다. 밸런스 조정 시 DB 불변.
4. **생성 산출물(스프라이트)은 에셋과 분리.** 액션(idle/walk/onair)별로
   생성 상태가 다르고 재생성이 일어나므로 1:N 테이블로 둔다.

## 테이블

```sql
-- 유저: 닉네임 입력 시 생성
users (
  id          BIGSERIAL PRIMARY KEY,
  nickname    VARCHAR(20) NOT NULL,     -- 중복 허용 (표시용). 설정 모달에서 변경 가능 (UPDATE 자유, 2026-07-10 확정)
  token       UUID NOT NULL UNIQUE,     -- 재접속 식별 (클라 localStorage)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- 에셋: 유저가 만든 오브젝트 1개
assets (
  id          BIGSERIAL PRIMARY KEY,
  creator_id  BIGINT REFERENCES users(id),  -- NULL 허용: is_system 기본 제공 에셋은 제작자 없음 (2026-07-10 확정)
  is_system   BOOLEAN NOT NULL DEFAULT false, -- 기본 제공(졸라맨·스타터 에셋) 구분 (2026-07-10 확정)
              -- 기본 제공 에셋 = is_system=true, creator_id=NULL.
              -- 창고의 '기본 제공/내가 만든' 구분에 사용. 별도 운영자 계정/상수 불필요
  category    VARCHAR(10) NOT NULL,     -- 'platform' | 'obstacle' | 'monster' | 'item'
  name        VARCHAR(30) NOT NULL,
  description TEXT,                     -- 유저가 쓴 설명 → LLM 프롬프트 원료
  attrs       JSONB NOT NULL,           -- 카테고리별 속성 (asset-attributes.md)
  -- 충돌 정보는 이미지가 아니라 스키마의 1급 데이터 (2026-07-10 확정)
  collider_type VARCHAR(8) NOT NULL DEFAULT 'rect',
              -- 'rect' | 'slope' | 'none'(배경)
  slope_dir   VARCHAR(12),              -- collider_type='slope'일 때:
              -- 'floor-asc'(◢) | 'floor-desc'(◣) | 'ceil-desc'(◥) | 'ceil-asc'(◤)
              -- 구현 1차=바닥 2종, 천장 2종은 2차 (스키마는 선점)
  hitbox_h_px SMALLINT,                 -- 아바타 전용: 키(px). AI 생성 완료 시
              -- 알파 바운딩박스 높이를 105~125px(1.65~1.95타일)로 클램프해 기록
  source_image_url TEXT NOT NULL,       -- 그림판 원본 (배경 제거 후)
  status      VARCHAR(12) NOT NULL DEFAULT 'draft',
              -- 'draft' → 'generating' → 'ready' | 'failed'
  is_public   BOOLEAN NOT NULL DEFAULT true,  -- 방 내 공유 여부 (확장용)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- 생성된 스프라이트: 에셋 1 : 액션 N
asset_sprites (
  id           BIGSERIAL PRIMARY KEY,
  asset_id     BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action       VARCHAR(8) NOT NULL,     -- 'idle' | 'walk' | 'onair'
  sheet_url    TEXT,                    -- 스프라이트 시트 이미지
  frame_count  SMALLINT,
  frame_w      SMALLINT,
  frame_h      SMALLINT,
  status       VARCHAR(12) NOT NULL DEFAULT 'queued',
               -- 'queued' → 'generating' → 'ready' | 'failed'
  last_regen_at TIMESTAMPTZ,            -- 재생성 쿨다운(5분, 액션별) 계산용 (2026-07-10 확정)
  priority     SMALLINT NOT NULL DEFAULT 0, -- 잡 우선순위: 첫 생성=높음, 재생성=낮음 (2026-07-10 확정)
               -- GPU 유휴 시 재생성 잡 처리
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, action)             -- 재생성은 행 갱신으로
)
-- 플랫폼/장애물은 idle 1행만 생성 (혹은 static이면 source_image 그대로 사용)

-- 방
rooms (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(8) NOT NULL UNIQUE,   -- 초대 코드
  status      VARCHAR(10) NOT NULL DEFAULT 'lobby',
              -- 'lobby' → 'building' → 'playing' → 'finished'
  build_deadline TIMESTAMPTZ,               -- 빌드 제한시간
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- 방 참가자 (= 라인 배정)
room_members (
  room_id     BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  final_order SMALLINT,                 -- 랜덤 배치 후 라인 순서 (playing 전엔 NULL)
  PRIMARY KEY (room_id, user_id)
)

-- 라인: 유저 1명이 만드는 맵 구간
lines (
  id          BIGSERIAL PRIMARY KEY,
  room_id     BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  owner_id    BIGINT NOT NULL REFERENCES users(id),
  start_y     SMALLINT,                 -- 시작점 높이 (왼쪽 끝 고정)
  goal_y      SMALLINT,                 -- 골 높이 (오른쪽 끝 고정)
  cleared     BOOLEAN NOT NULL DEFAULT false,  -- 제작자 본인 클리어 여부 (저장 조건)
  UNIQUE (room_id, owner_id)
)

-- 배치: 라인 위에 놓인 에셋 인스턴스
placements (
  id          BIGSERIAL PRIMARY KEY,
  line_id     BIGINT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  asset_id    BIGINT NOT NULL REFERENCES assets(id),
  x           SMALLINT NOT NULL,        -- 라인 내 타일 좌표
  y           SMALLINT NOT NULL,
  overrides   JSONB                     -- 인스턴스별 속성 오버라이드 (확장용, 당장 미사용)
)
```

## attrs JSONB 예시 (쿵쿵 레시피)

```json
{
  "category": "obstacle",
  "contact": "damage",           // 택1: damage | kill | bounce | updraft
  "contactSurface": "exceptTop", // contact=damage|kill일 때만: all | exceptTop | bottomOnly
  "trigger": "proximity",        // 택1: always | periodic | proximity | switch
  "proximityAxis": "x",          // trigger=proximity일 때만: x | y | radius
  "motion": "charge",            // 택1: none | rotate | pendulum | patrol | charge
  "chargeDir": "down",           // motion=charge일 때만: down | left | right
  "chargeAfter": "return",       // 택1: return | respawn | once
  "shootsProjectile": false,
  "breaksBlocks": false
}
```

- 키 존재 규칙(조건부 필드)은 서버의 카테고리별 검증 스키마가 강제
- enum 값은 `asset-attributes.md`의 프리셋 정의와 1:1

## 확장 예약 — 커스텀 스킬 (2026-07-10, 시간 여유 시 도입)

유저가 프롬프트+이미지로 자기만의 스킬 1개를 제작 (발동키 F 고정).

- 구현 원칙: 자유 효과 생성이 아니라 **효과 템플릿 enum(dash/projectile/jumpBoost/…) +
  프리셋 파라미터로의 LLM 매핑** → Zod 검증. 에셋 attrs와 동일 패턴.
- 스키마 영향 (기존 결정이 대부분 흡수):
  - 스킬 = `assets`의 `category='skill'` 행 (VARCHAR라 마이그레이션 불필요)
  - 효과 정의 = `attrs` JSONB (skill용 검증 스키마만 추가)
  - 이미지 = `source_image_url` 재사용 (발사체 방침과 동일: 정지 이미지+코드 연출)
  - **유일한 실제 추가**: `users.equipped_skill_id BIGINT NULL REFERENCES assets(id)`
    — 스키마 확정 시 미리 포함 권장
- 쿨다운 강제: MVP=클라이언트 (클라 권위 모델의 기존 트레이드오프), 서버 검증은 고도화

## 확장 예약 — 기기 연동 단축 코드 (2026-07-10 확정)

설정 모달의 "기기 연동"용. raw token을 노출하지 않고 짧은 코드로 계정을 다른 기기에 복제.

- 발급 시 코드 + 만료시각 저장(5분 유효), 검증 시 소비(1회성)
- **복제 모델**: 코드 검증에 성공한 기기에 token을 내려줌 → 두 기기 다 접속 가능,
  원기기 무효화 안 함
- 스키마 영향: `users`에 컬럼 추가 or 별도 테이블
  - `users.device_link_code VARCHAR NULL` + `users.device_link_expires_at TIMESTAMPTZ NULL`
    (단일 활성 코드 전제, 가장 단순)
  - 다중 코드/감사 로그가 필요하면 `device_links(user_id, code, expires_at, consumed_at)` 별도 테이블로 확장

## 열어둔 결정

- [ ] DB 종류: PostgreSQL 전제로 작성 (JSONB). SQLite로 시작한다면 JSON1 확장으로 동일 구조 가능
- [ ] 에셋의 방 종속 여부: 현재는 전역(유저 소유, 어느 방에서든 사용). 방 안에서만 공유라면 `assets.room_id` 추가
- [ ] 라인 지형(땅) 저장 방식: placements에 타일도 넣을지, `lines.terrain JSONB`로 분리할지
- [ ] 플레이 기록(클리어 타임, 사망 수) 테이블 — 2차

## 성능·확장 메모 (2026-07-10 확정)

- **규모 전제**: 동시 20~100명
- **DB는 병목 아님**: PostgreSQL/MySQL 무관, 이 규모에서 DB는 병목이 아니다.
  인덱스만 확보: `rooms(status)`, `assets(creator_id)`, `assets(is_system)`
- **진짜 병목 = 레이스 중 좌표 브로드캐스트**: DB를 거치지 않고 **서버 메모리 상태 +
  Socket 중계**로 처리. 최종 기록만 DB 저장
- **좌표 최적화**: 10~15fps 스로틀, 관심 영역(같은 라인 근처)만 전송,
  Socket.IO 바이너리
- **AI 잡**: GPU 물리적 동시성 제한 → 큐 필수(이미 설계됨)

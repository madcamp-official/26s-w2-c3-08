# 아키텍처 확정안 (2026-07-11)

팀 합의용 문서입니다. 프레임워크 전략·디렉토리 구조·통신 토폴로지·스캐폴딩 순서를 확정합니다.

## 1. 프레임워크/템플릿 전략 (전략 ③ 확정)

| 항목 | 내용 |
|---|---|
| 베이스 | 공식 스캐폴더 조합 — `npm create vite@latest client -- --template react-ts` + `npm create colyseus-app@latest server` + 루트 npm workspaces(수동 3줄) + `shared/`·`gpu-worker/` 수동 구성 |
| 네트워킹 구현 참고 | Colyseus 공식 Phaser 학습 코스(learn.colyseus.io/phaser — Part 3 클라이언트 예측 입력) 패턴을 따라 직접 작성 |
| 보조 참고 | ts-online-game-template(ASteinheiser, MIT)을 레포 밖(`archive/reference`)에 클론 — 예측/보정 구현·모노레포 설정만 참고, 레포에 코드 직접 포함 안 함 |

**채택 근거**: 이해한 코드의 비율 최대화(디버깅 대비), 군더더기 개조 비용 0, 공식 자료의 최신성.

**기각한 대안**:
| 대안 | 기각 사유 |
|---|---|
| ① 템플릿 통째 개조 | Electron·Supabase·GraphQL 제거 비용 + 미이해 코드 잔존 |
| ② 교재만으로 무참고 구현 | 예측/보정 시행착오 위험 |

## 2. 디렉토리 구조 (전체 기능 구현 가능 형태)

```
레포/                        (npm workspaces 모노레포)
├─ docs/                     설계 문서 (현행 유지)
├─ client/                   프론트 (Vite + React + TS + Phaser)
│  └─ src/
│     ├─ ui/                 React 화면
│     │   ├─ login/            로그인 (닉네임 → 토큰)
│     │   ├─ main/             메인 (아바타 패널·게임하기·설정 모달)
│     │   ├─ studio/           아바타/에셋 스튜디오 (그림판·팔레트·속성 폼·에셋 불러오기)
│     │   ├─ warehouse/        내 창고 (상태 뱃지·상세/검수 팝업)
│     │   └─ lobby/            로비·방 목록
│     ├─ game/               Phaser 씬 (맵 에디터 / 레이스 렌더)
│     ├─ net/                Colyseus 클라이언트 + REST 클라이언트
│     └─ store/              Zustand 전역 상태
├─ server/                   백엔드 (Express + Colyseus, colyseus-app 스캐폴드 기반)
│  ├─ src/
│  │  ├─ api/                REST 라우터 (세션·에셋 CRUD·방 목록·기기연동 코드)
│  │  ├─ rooms/              Colyseus Room (대기실·레이스) — 서버 권위 물리 틱
│  │  ├─ ai/                 AI 파이프라인
│  │  │   ├─ queue.ts          잡 큐 (우선순위: 첫 생성>재생성, 쿨타임 5분, 임대 타임아웃)
│  │  │   ├─ llm.ts            프롬프트 생성 — 3090 VM 로컬 LLM 호출 (내부망 직접 HTTP)
│  │  │   ├─ worker-gateway.ts GPU 워커용 API (GET jobs/next, POST jobs/:id/result)
│  │  │   └─ postprocess/      (워커 측 처리 실패 시 폴백용 후처리)
│  │  └─ storage/            원본 그림·스프라이트 시트 정적 파일
│  └─ prisma/schema.prisma   (docs/KJH의 스키마를 실배치)
├─ gpu-worker/               GPU 머신 상주 워커 (기숙사 5080 + 3090 VM 공용)
│  └─ src/                   폴링 루프 → ComfyUI 실행 → 후처리(크로마키·bbox·시트 패킹) → 결과 업로드
└─ shared/                   클라·서버 공유 (생성기 없음, 수동)
   ├─ physics/               경사 램프·슬라이딩·내려찍기 순수 함수 (스파이크 이식 + game feel 보강 예정)
   ├─ schemas/               attrs Zod 스키마 (asset-attributes.md 기준 — 클라 폼/서버 저장 동일 소스)
   └─ constants.ts           타일 64px, 프리셋→물리값, 쿨타임 등
```

## 3. 통신 토폴로지 (방향성 제약이 설계의 핵심)

```
                      (공개 인터넷)
브라우저 ──443──▶ Cloudflare ──터널──▶ ┌────────────────────────┐
                                      │ 메인 VM (KCLOUD 내부망)  │
기숙사 PC(5080) ──HTTPS 아웃바운드──▶   │  Express + Colyseus     │
  gpu-worker: 폴링→생성→업로드          │  MySQL, storage         │
                                      └───────┬────────────────┘
                                              │ 내부망 직접 HTTP
                                      ┌───────▼────────────────┐
                                      │ 3090 VM (같은 내부망)    │
                                      │  로컬 LLM 서빙           │
                                      │  (+ComfyUI 워커 병행 가능)│
                                      └─────────────────────────┘
```

| 경로 | 가능 여부 | 방식 |
|---|---|---|
| 브라우저 → 메인 VM | ✅ | cloudflared 터널 (443, WebSocket 포함) |
| 메인 VM → 기숙사 PC | ❌ NAT | — (그래서 pull 모델) |
| 기숙사 PC → 메인 VM | ✅ | 터널 공개 주소로 아웃바운드 HTTPS 폴링 |
| 메인 VM ↔ 3090 VM | ✅ | KCLOUD 내부망 직접 HTTP (LLM 호출) |

- LLM: OpenAI 대신 **3090 VM의 로컬 LLM** 사용 예정 (비용 0, 키 관리 불필요). 프롬프트 생성 1회 호출 구조는 동일 (ai-pipeline.md 참조)
- GPU 생성 워커: 기숙사 5080이 주력, 3090에도 같은 워커 설치 시 자동 분산(각자 `jobs/next`를 당김). 임대 타임아웃으로 워커 사망 시 잡 회수
- 워커 인증: 전용 워커 토큰

## 4. 스캐폴딩 실행 계획 (문서 합의 후 진행)

1. `npm create vite@latest client -- --template react-ts` → phaser·zustand 설치
2. `npm create colyseus-app@latest server` → express 통합 확인, `prisma init`(mysql) 후 docs/KJH 스키마 반입
3. 루트 package.json workspaces + `shared/`·`gpu-worker/` 뼈대
4. `archive/reference`에 ts-online-game-template 클론 (레포 외부, gitignore 영역)
5. 순서: **이 문서 팀 합의 → 스캐폴딩 → 커밋**

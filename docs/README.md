# 문서 인덱스

> 각자 자기 섹션의 표만 수정합니다 (병합 충돌 방지).
> 상태: ✅ 확정 / 🔧 진행 중 / 📎 참고용

## KJH

| 문서 | 설명 | 상태 |
|---|---|---|
| [schema.prisma](KJH/schema.prisma) | DB 스키마 v1 (MySQL) — 확정 3모델 활성, 미확정 5모델 주석 | ✅ |
| [tech-stack.md](KJH/tech-stack.md) | 기술 스택 + 동기화 모델(서버 권위·Colyseus) + 배포 환경 | ✅ |
| [architecture.md](KJH/architecture.md) | 아키텍처 확정안 — 템플릿 전략·디렉토리 구조·통신 토폴로지(3090 LLM/기숙사 워커)·스캐폴딩 계획 | ✅ |
| [player-spec.md](KJH/player-spec.md) | 플레이어 물리 사양 — 조작·내려찍기·슬라이딩·밟기·히트박스. 공유 물리 함수(core-game)의 사양서 | ✅ |
| [ai-pipeline.md](KJH/ai-pipeline.md) | AI 생성 파이프라인 — LLM 프롬프트, 크로마키, bbox 정규화, 잡 큐(우선순위·쿨타임 5분) | ✅ |
| [asset-attributes.md](KJH/asset-attributes.md) | 에셋 속성 시스템 — attrs Zod 검증의 원본 명세. **⚠️ 미완성: 세부 조정 진행 중** | 🔧 |
| [screen-design.md](KJH/screen-design.md) | 화면 설계 — 로그인~에셋 스튜디오까지 확정, 로비 이후 미설계. **⚠️ 미완성** | 🔧 |

## LSJ

| 문서 | 설명 | 상태 |
|---|---|---|
| [plan.md](LSJ/plan.md) | 전체 MVP 기획 — 로그인, AI 에셋, 방, 제작, 검증, 병합, 레이스, 성공 기준 | ✅ |
| [backend.md](LSJ/backend.md) | 백엔드 구현 계획 — REST, Socket.IO, Job worker, DB 모델, 테스트 계획 | 📎 |
| [colaboration.md](LSJ/colaboration.md) | 협업 규칙 — Git 권한, 브랜치/커밋, 충돌 방지, 검증 보고 방식 | ✅ |

## 프론트엔드 MVP 구현 기록

이 섹션은 `docs/LSJ/plan.md`, `docs/LSJ/colaboration.md`, `docs/KJH/screen-design.md`를 기준으로 현재 프론트엔드에서 구현한 내용을 이어받기 쉽게 정리한 기록이다. 현재 구현은 백엔드 완성 전에도 시연이 가능하도록 Mock API, localStorage, BroadcastChannel 기반 로컬 실시간 폴백을 기본값으로 둔다.

### 구현 기준

- 앱은 `client` 워크스페이스의 Vite + React + TypeScript 프로젝트로 구현했다.
- 화면 톤은 `docs/KJH/screen-design.md`의 밝은 하늘색, 흰 패널, 노란 강조색, 픽셀/그리드 감성을 따랐다.
- 게임 캔버스와 맵 제작/검증/레이스는 Phaser 기반으로 구현했다.
- AI 생성 기능은 게임 진행의 필수 조건이 아니며, 실패하거나 지연되어도 기본 아바타와 기본 에셋으로 한 판을 끝낼 수 있게 했다.
- 기본 실행은 원격 백엔드가 아니라 Mock 모드다. `VITE_REMOTE_API=true`가 설정된 경우에만 원격 REST 호출을 시도한다.

### 주요 파일

| 파일 | 역할 |
|---|---|
| `client/src/App.tsx` | 로그인, 메인, 아바타/에셋 스튜디오, 창고, 로비, 방 페이즈 전체 UI |
| `client/src/App.css` | 전체 화면 레이아웃, 패널, 제작 도구, 창고, 게임 HUD 스타일 |
| `client/src/components/AvatarCreator.tsx` | `react-sketch-canvas` 기반 아바타 스케치 입력 컴포넌트 |
| `client/src/game/MapEditorCanvas.tsx` | Phaser 기반 32x32 그리드 맵 에디터 |
| `client/src/game/PlaytestCanvas.tsx` | 제작한 세그먼트 검증용 플레이 테스트 캔버스 |
| `client/src/game/RaceCanvas.tsx` | 병합 맵 레이스 캔버스 |
| `client/src/game/assetRules.ts` | 에셋 속성, 충돌 성격, 색상, 이동/위험 규칙 |
| `client/src/net/api.ts` | Mock API와 원격 API 전환 레이어 |
| `client/src/net/realtime.ts` | BroadcastChannel 기반 로컬 실시간 폴백 |
| `client/src/store/appStore.ts` | 세션, 방, 에셋, 맵 세그먼트, 레이스 상태 관리 |
| `client/vite.config.ts` | LAN/도메인 접속을 위한 Vite 서버 설정 |

### 아바타 생성 컴포넌트

`AvatarCreator`는 유저가 직접 기초 형태를 스케치하고 프롬프트를 입력해 AI 생성 요청을 보낼 수 있는 독립 컴포넌트다.

- `react-sketch-canvas@^8.0.0`을 사용한다.
- 캔버스 크기는 400px x 400px 고정이다.
- CSS `backgroundImage: "url('/guide-silhouette.png')"`로 가이드 실루엣을 보여준다.
- 평소 캔버스 배경은 `transparent`로 유지해 가이드가 보이게 한다.
- 생성 버튼을 누르면 캔버스 배경 state를 `#FFFFFF`로 바꾸고, `100ms` 대기 후 `exportImage('png')`를 호출한다.
- export 직후 `finally`에서 배경을 다시 `transparent`로 복구한다.
- `exportWithBackgroundImage={false}`를 명시해 가이드 이미지는 결과 PNG에 포함하지 않는다.
- 요청 payload는 `{ image: base64String, prompt: inputText }` 형식으로 `POST /api/assets/generate`에 전송한다.
- 요청 중에는 버튼 문구를 `생성 중...`으로 바꾸고 disabled 처리한다.
- 브러시 굵기 `2px`, `4px`, `8px`, 색상 검정/빨강/파랑/초록, Undo/Redo/Clear를 제공한다.

### 앱 화면 흐름

현재 프론트엔드는 다음 흐름을 한 앱 안에서 이동할 수 있게 구성했다.

1. 닉네임 로그인과 세션 복원
2. 메인 화면에서 아바타, 에셋 스튜디오, 창고, 로비 진입
3. 아바타 제작 및 기본 아바타 장착
4. 에셋 스튜디오에서 스케치/프롬프트/속성 기반 에셋 생성 요청
5. 창고에서 내 아바타와 에셋 확인, 상세 검수, 재생성 요청, 장착
6. 공개/비공개 방 생성, 빠른 입장, 방 목록 입장
7. 방 로비에서 준비 상태 공유 후 제작 페이즈 진입
8. 제작, 검증, 병합, 레이스, 결과까지 MVP 게임 루프 진행

### 맵 제작

맵 제작 화면은 `plan.md`의 32x32 그리드 제작 요구사항을 기준으로 구현했다.

- 좌측에는 에셋 창고를 두고 `제공 에셋`과 `내 에셋`을 전환한다.
- 카테고리는 플랫폼, 장애물, 몬스터, 아이템, 배경을 제공한다.
- 자주 사용한 에셋은 상단 바에 표시하고, 사용 횟수와 제거 버튼을 제공한다.
- 중앙은 Phaser 기반 24 x 10 셀, 32px 스냅 그리드다.
- 우측 제작 도구는 선택, 배치, 이동, 삭제, 시작점, 끝점 도구를 제공한다.
- 시작점과 끝점은 서로 겹칠 수 없고, 에셋이 있는 칸에도 둘 수 없다.
- 시작점과 끝점의 높이 차이는 제한값 안에서만 허용한다.
- 배치 비용 예산을 두어 과도한 에셋 배치를 막는다.
- +15s, -15s 시간 투표를 제공하고 한 페이즈당 1회만 사용할 수 있게 했다.
- 제작 완료 후에는 맵이 잠기고 더 이상 수정할 수 없다.

### 맵 에디터 렌더링 수정

테스트 중 배치 카운트와 메시지는 갱신되지만 캔버스에 에셋이 보이지 않는 문제가 있었다. 원인은 Phaser 레이어 순서였다.

- 기존에는 `gridLayer`가 배경 fill과 격자선을 모두 그리고 있었고, 이 레이어가 `placementLayer` 위에 있어 배치물이 배경에 덮였다.
- `backgroundLayer`, `placementLayer`, `gridLayer`를 분리해 배경 -> 배치물 -> 격자 순서로 그리도록 수정했다.
- 생성 에셋의 `sourceImageUrl`이 있으면 Phaser texture로 로드해 실제 이미지를 맵에 표시한다.
- 이미지 로딩 전이나 실패 시에도 fallback 박스, 테두리, 이름 라벨을 표시해 배치 여부가 명확히 보이게 했다.
- 선택된 배치는 노란 테두리로 강조한다.

### 검증, 병합, 레이스

게임 진행은 `LOBBY -> BUILDING -> VALIDATING -> MERGING -> RACING -> FINISHED` 페이즈를 따른다.

- 제작 완료 또는 시간 종료 시 현재 맵 스냅샷을 제출한다.
- 검증 페이즈에서는 자신이 만든 세그먼트를 직접 플레이해 GOAL 도달 여부를 확인한다.
- 검증 실패자는 레이스 시작 시 15초 freeze 패널티를 받는다.
- 병합 페이즈에서는 검증된 세그먼트를 이어 붙여 전역 맵을 만든다.
- 검증된 맵이 없으면 fallback 세그먼트로 레이스가 중단되지 않게 한다.
- 레이스는 병합된 맵에서 진행하며, 완주자는 도착 시간 기준, 미완주자는 GOAL까지의 거리 기준으로 정렬한다.
- 기본 레이스 시간 종료 후 아무도 완주하지 못하면 30초 연장 흐름을 제공한다.

### 로컬 실시간과 Mock API

백엔드 없이도 2인 MVP 흐름을 확인할 수 있도록 프론트에 로컬 폴백을 넣었다.

- Mock API는 기본 에셋, 세션, 방, 생성 작업, 세그먼트, 병합 맵을 localStorage에 저장한다.
- BroadcastChannel을 통해 같은 브라우저/기기 안의 여러 탭이 방 상태를 공유한다.
- 원격 API는 `VITE_REMOTE_API=true`일 때만 사용한다.
- 로컬 실시간 폴백은 `VITE_LOCAL_REALTIME=false`로 끌 수 있다.

### 접속과 실행

개발 서버는 LAN과 Cloudflare forwarding에서 접근할 수 있게 설정했다.

```bash
npm install
npm run dev --workspace client -- --host 0.0.0.0 --port 5174
```

접속 주소:

- `http://localhost:5174/`
- `http://192.168.0.200:5174/`
- `https://mad-mario.madcamp-kaist.org/`

`client/vite.config.ts`에는 `0.0.0.0`, `5174`, `192.168.0.200`, `mad-mario.madcamp-kaist.org` 관련 개발 서버 설정이 포함되어 있다.

### 검증한 명령

현재 프론트 구현 상태에서 아래 명령을 통과했다.

```bash
npm run lint --workspace client -- --quiet
npm run smoke --workspace client
npm run build --workspace client
```

추가로 `https://mad-mario.madcamp-kaist.org/`가 `HTTP/2 200`으로 HTML을 반환하는 것을 확인했다.

### 남은 작업

- 실제 백엔드 REST/Socket 서버와 연결한다.
- AI 생성 Job polling과 생성 완료 후 도감 자동 반영을 백엔드 계약에 맞춰 연결한다.
- 실제 멀티 디바이스 실시간 동기화는 서버 권위 이벤트로 교체한다.
- Phaser 플레이 물리와 에셋별 행동 규칙은 시연 플레이 결과에 맞춰 난이도를 조정한다.
- 배포 환경에서는 Vite dev server 대신 정적 빌드 산출물과 API 서버를 분리해 운영한다.

# 손그림 UI 구현 인수인계 (2026-07-16)

다른 세션/계정의 Claude가 **이 문서만 읽고 이어서 작업**하도록 쓴 자기완결 문서.
브랜치 **`kjh/integrate`**. 설계 원천 문서: [screen-design.md](screen-design.md) (이게 최종 사양 기준).
개발 환경 = `D:\Dev\madcamp\26s-w2-c3-08` (Windows, PowerShell + Bash).

---

## 0. 한 줄 현황

손그림(rough.js) UI **토대(0단계) + 기존 화면 재도장(1단계) 완료·push.**
**2단계(맵 에디터 전면)·3단계(게임/HUD)는 착수 전.** 유저 피드백 2건이 최우선 선행 과제.

---

## 1. 최우선 — 유저 피드백 2건 (제일 먼저 처리)

### (A) 모든 글씨를 Galmuri로 통일
- 지금 본문/버튼/입력창은 Pretendard(`--font-body`)를 쓰고 있음. **유저 요구: 화면의 모든 텍스트(유저가 입력하는 입력창 글자 포함)를 Galmuri11로.**
- 손봐야 할 곳:
  - `client/src/design/tokens/typography.ts` — `FONT_BODY`를 Galmuri로.
  - `client/src/design/global.css` — `--font-body`를 `"Galmuri11", monospace`로. `.dsScreen`/`.dsPointFont`도 확인.
  - 인라인 `fontFamily: "var(--font-body)"`를 쓰는 곳 전부 자동으로 따라오게(변수만 바꾸면 됨). input에 별도 폰트 지정 있으면 제거.
- Galmuri11은 이미 CDN `@font-face`로 로드됨(global.css). 추가 로드 불필요.

### (B) 테두리 강도(roughness) 중간값으로
- 처음 1.5/1.6은 "여러 겹 선이 심하게 엇나가 지저분", 지금 0.8/0.7은 "너무 밋밋해서 재미없음"이라는 피드백.
- `client/src/design/sketch/rough.ts`의 `SKETCH` 프리셋에서 **중간값**으로. 시작점 제안: `frame roughness 1.15 · bowing 1.0`, `chip 1.0 · 0.9`, `panel 1.3 · 1.2`.
- **유저가 눈으로 보고 조정하는 항목** — 한 번에 못 맞춤. 값 바꿔 제시 → 피드백 루프. **너(Claude)는 브라우저 자가 검증 금지(아래 규칙), 유저가 확인함.**

---

## 2. 지금까지 된 것 (커밋·push 완료)

### 0단계 — 손그림 SVG 토대 (`client/src/design/sketch/`)
- `rough.ts` — rough.js `RoughGenerator` 래퍼. `buildRectPaths({w,h,seed,preset,radius,stroke,fill})` → `<path>`용 PathInfo[]. `SKETCH` 프리셋(frame/chip/panel), `newSeed()`.
- `SketchBox.tsx` — **가변 크기** 손그림 상자. 자기 크기를 ResizeObserver로 재서(`useMeasure`) 그 크기의 꼬불 테두리+채움 SVG를 뒤에 깖. props: `fill/stroke/preset/radius/jiggle/as/center/contentStyle/onClick…`. **통짜 렌더 아님 — path만 뽑아 선언적 렌더.**
- `SketchTile.tsx` — 고정 크기(w,h) 부속품용 얇은 래퍼.
- `SketchButton.tsx` — 공통 인터랙션 규칙 버튼(기본 각짐 → 호버 시 scale 축소+radius 둥긂+흰 낙서 지글 → whileTap 세로늘음). **SketchBox를 직접 자식으로 둠**(절대배치 래퍼가 크기측정 깨뜨렸던 버그 회피). `data-morph-color`로 커튼에 채움색 전달.
- `SketchPanel.tsx` — 팝업(딤+띠용+**항상 지글** 낙서 테두리).
- `useJiggle.ts` — `active`인 동안 120ms마다 seed 교체. **비활성 시 안정 seed 고정.** 규칙: **호버/선택 중에만 지글**(단, 로그인 닉네임 입력창은 유저 요청으로 상시 지글).
- `useMeasure.ts` — ResizeObserver 크기 추적.

### 팔레트 (`client/src/design/tokens/colors.ts`)
- 노랑 단일 hue 램프: `YELLOW.{card #FFFDF5, list #FFF6DB, barLight #FFD54A, base #F6BE00, pressed #D9A400}`.
- `INK #3B2F14`(텍스트·테두리, 검정 대체), `INK_SOFT #8A6D1F`.
- `SIGNAL.{danger #E52521, ok #1D9E75}` — 소량만. `WORLD.{device/enemy/item/terrain/dirt}` — 인게임·카테고리 틴트 전용(UI 크롬 금지).
- 기존 `COLORS.*`는 호환용 매핑(점진 교체).

### 1단계 — 기존 화면 재도장 (전부 실제 API/Colyseus 연결 유지)
- **로그인**(`ui/login/LoginScreen.tsx`): 닉네임 SketchBox(상시 지글) + SketchButton.
- **메인**(`ui/main/MainScreen.tsx`): 확정 45/55 레이아웃. 좌 아바타 패널 + idle/walk/onAir **하단 테두리 스위치 탭**(상호배타, 눌림 애니메이션, `playSound("switch")`). 우 액션 스택(게임하기/에셋만들기/내창고/설정 얇은 띠).
- **설정**(`ui/main/SettingsPanel.tsx`): SketchPanel + 노랑 인풋.
- **로비**(`ui/lobby/LobbyScreen.tsx`): 메인으로 얇은 바(스크롤 시 height 0 찌부) → 방생성/공개방입장 풀블리드 2단 바(스크롤 시 압축) → 손그림 방 카드. CreateRoom/JoinPrivate = SketchPanel.
- **대기실**(`ui/waiting/WaitingRoomScreen.tsx`): 참가자 목록 + 시작/나가기. 상태 로딩 중 "불러오는 중" 폴백.
- **결과**(`ui/result/ResultScreen.tsx`): 좌 순위표(금/은/동 뱃지) + 우 [메인으로] 큰 버튼 하나(다시하기/로비로 제거).
- **AppShell**: `onMain` 콜백을 로비·결과에 전달.
- **커튼**(`design/transition/`): `useMorphTransition`이 `data-morph-color` 우선 읽음. `MorphCurtain`은 그대로.

### 부수 수정
- `net/rest.ts`: fetch **8초 타임아웃**(백엔드 무응답 시 무한 로딩 방지).
- `global.css`: body 배경을 **크림(#FFF6DB)** 으로(전환 사이 빈 순간 검정 노출 제거).

### 검증된 사실
- 방 생성은 **프로토콜 레벨 정상**(헤드리스로 memberCount 1 유지 확인). "검은 화면"은 서버 버그 아니라 위 body 배경 문제였음.

---

## 3. 남은 작업 (승인받은 범위 — screen-design.md가 상세 사양)

### 2단계 — 맵 에디터 전면 구현 (제일 큰 덩어리, `client/src/mapeditor/`)
screen-design.md **S4 + D절**의 확정 사항 (a)~(k) 전부. 요약:
- (a) 레이아웃: 창고(검색 삭제, 오너토글+카테고리만) / 창고카드 [+즐겨찾기] **카드 중앙** / 우측 툴바를 **조작안내 패널**로 교체(+장전 에셋명) / 즐겨찾기 **단일선택 지글유지** / [+]로만 즐겨찾기 추가, 드래그는 내부 재정렬만(dnd-kit).
- (b) 하단바: `[시간단축][시간추가]`(붙여서) → 남은시간 → (여백) → **[테스트하기] 우측 22% 세로 꽉** + 검증 뱃지.
- (c) 캔버스 입력: 좌클릭 배치/선택/경로드래그, 우클릭 삭제, **좌우동시 팬**(짧게 대기), **스크롤 줌 보간**, 격자 **25×12**.
- (d) 배치/삭제: 연속배치·연속삭제(드래그), 판정정밀도 차등, 다중타일 겹침검사, 고스트(좌하단기준·점유 빨강/가능 파랑·격자밖 없음), 경사 대각선 고스트+bbox판정, 스프링 팝인/아웃, 더블클릭 반전.
- (e) 깃발: 이미지 마커(물리없음), 꾹눌러 들림+이동, 규칙위반 위치 막힘, 금지구역(3×1기단+위5칸), **시작~골 최소 5타일**.
- (f) 이동경로 오버레이(참고용, 배치 안막음): ride 직선/spin 원/patrol·charge 레이캐스트/**pendulum은 `BlockAttrs.motion.pendulum.radius: Range3` 스키마 추가 필요**.
- (g) 배경: 라인전체 단위 설치·삭제불가·덮어쓰기, 타일링 기준=시작깃발, 범위밖 격자 흐림.
- (h) 에셋 상세: 카드 아래 팝업(지글) — 이름/카테고리/크기/소유/공용라벨.
- (i) 공용 에셋 안내판: 에디터 위 오버레이 띠용, 아무곳 클릭 팝아웃, 공용만·카테고리별 색틴트.
- (j) 시간조정: 클릭당 30초, 평생1회(누르면 양쪽 비활성), ≤45초 단축비활성, 누구나, <20초 빨강+흔들림, 방전체 토스트. **서버: `MemberState.usedTimeAdjust` + `RACE_MSG.adjustTime({direction})`, building 한정, broadcast.**
- (k) 테스트 모드(방식 B, **구현만·검증 안 해도 됨**): 캔버스만 게임전환·시작깃발 스폰·편집잠금·격자숨김·중단시원복, shared 물리 로컬 시뮬레이션 → 골 도달 시 `POST /api/lines`(testPassedAt), testline 서버룸 미사용.
- **코드 반영 필요(기존 "기록만"이었으나 이제 구현 범위)**: `GAME_RULES.lineMaxWidthTiles 25`/`lineMaxHeightTiles 12`(기존 test.gap 폭 28→25 이하 조정 동반), 깃발 최소 5타일 판정, `pendulum.radius` 스키마.
- **주의**: 현 `client/src/mapeditor/`는 더미데이터·팬줌 셸만 있고 룸 연결·배치로직 없음. 렌더 방식은 미정(prototype은 DOM/CSS 격자). 실제 배치·물리엔 `<canvas>` 2D 렌더 권장. 스프라이트 실물은 아직 없음 → 카테고리색 타일로 자리표시.

### 3단계 — 통합·연결
- building 페이즈 진입 시 맵 에디터를 **실제 룸에 마운트**(현 `WaitingRoomScreen`은 building 이후를 텍스트로만 표시).
- 테스트 통과 → `POST /api/lines`.
- HUD 레이스 연출(screen-design.md E절): 좌상단 순위 top5(스프링 슬라이드·페이드), 우상단 시간, **1등 카운트다운=시간텍스트 빨강**, **라스트댄스 금은동 세로선(월드 오브젝트)**, **스윕=전원 화면흔들림+폭발음+파괴 에셋자리 폭발이펙트**. `GAME_RULES.sweepSec`는 이미 30으로 반영됨.

---

## 4. 아키텍처·연동점 (알아야 할 것)

- **사운드**: `client/src/audio/sfx.ts` `playSound(name)` — UI용 `uiHover/uiClick/uiBack/switch/modalOpen/toast…`, 에디터용 `place/erase/pick/flip/denied/favAdd/timeWarn…` 이미 정의됨. 활용할 것.
- **REST**: `net/rest.ts` `api.get/post/patch`(x-user-token 자동, 8s 타임아웃). `HTTP_BASE`=`http://localhost:2567`(또는 `VITE_SERVER_URL`).
- **룸**: `net/raceRoom.ts`(create/join/joinByCode/waitForPhaseChange), `store/room.ts`(`attachRoom(room)` → onStateChange bump). `@colyseus/sdk 0.17`엔 네이티브 룸목록 없음 → `/api/rooms` REST.
- **shared**: 물리·행동·스키마·조립기(`shared/build/buildRuntimePart.ts`)가 클라·서버 공용. 라인 병합=`shared/build/mergeLines.ts`+`loadLine.ts`. 레이스 상수=`shared/constants.ts GAME_RULES`.
- **sprites**(`client/src/sprites/`): **다른 세션 WIP, 현재 TS 오류 있음 → 건드리지 말 것.** 이 오류 때문에 `npm run build`(프로덕션)는 실패하나 **vite dev는 타입체크 안 해 정상 실행**됨. 아바타 스프라이트 렌더는 아직 미연결.

---

## 5. 로컬 서버 실행 방법 (로그인·룸 동작에 필수)

서버는 MySQL DB가 필요. DB 접속문자열(`DATABASE_URL`)은 gitignore된 실제 `.env`에만 있고 **VM(`/root/game/server/.env`)** 에 있음. 로컬은 VM MySQL을 SSH 터널로 붙임.

1. **VPN 연결**(SSH 22 도달에 필요). 확인: `timeout 5 bash -c "</dev/tcp/172.10.7.247/22"`.
2. **터널**: `ssh -i ~/.ssh/madcamp_vm -fN -L 13306:127.0.0.1:3306 root@172.10.7.247` (로컬 13306 → VM 3306).
3. **`server/.env` 생성**(없으면): VM에서 `grep ^DATABASE_URL /root/game/server/.env` 가져와 `@localhost:3306`을 `@127.0.0.1:13306`으로 바꿔 저장. (`.env`는 gitignore됨 — 비밀번호 커밋 주의.)
4. **서버 실행**: `cd server && npm start` (env 로드: `set -a && . ./.env && set +a` 후 실행, 또는 그냥 npm start면 Prisma가 .env 자동로드하나 앱 코드가 `process.env.DATABASE_URL` 직접 읽으므로 export 권장).
5. 헬스체크: `curl -s http://localhost:2567/api/rooms` → HTTP 200.
- 클라: `cd client && npm run dev` → `localhost:5173`.
- **검증 끝나면 터널 ssh 프로세스 종료(방치 금지).** 상세: 메모리 `reference-vm-access-and-sync`.

---

## 6. 작업 방식 규칙 (유저 규칙 — 반드시 지킬 것)

- **코드/배포/git 실행은 literal "승인" 두 글자 받은 뒤에만.** "해줘/그래/진행해"는 승인 아님. 구현 전 **구조(디렉토리/스키마) 먼저 제시 → 평가 → 승인**. 주제 완결 전 다음으로 안 넘어감.
- **배포 금지.** 로컬 커밋·push는 됨. **VM 배포는 유저가 그 변경에 대해 명시적으로 요청할 때만.**
- **브라우저 자가 검증 금지.** 화면 확인은 유저가 함(토큰 절약). 손그림 강도·색 같은 시각 조정은 값 바꿔 제시 → 유저 피드백 루프.
- **여러 Claude 세션이 같은 디렉토리 공유 중.** 자기 파일만 `git add`(다른 세션 WIP 커밋 금지). push 전 `git stash -u` → `git pull --rebase` → `push` → `git stash pop`. `git add -A` 금지.
- 격식체(합쇼체), 유머 금지. 모르면 모른다고, 임시방편은 임시방편이라 명시.
- 메모리: `~/.claude/projects/D--Dev-madcamp-26s-w2-c3-08/memory/`.

---

## 7. 그 계정에게 할 말 (첫 메시지용)

> `kjh/integrate` 브랜치에서 손그림(rough.js) UI를 이어받는다. **먼저 [docs/KJH/handoff-sketch-ui-2026-07-16.md](handoff-sketch-ui-2026-07-16.md)와 [docs/KJH/screen-design.md](screen-design.md)를 정독**해라.
>
> 순서:
> 1. **피드백 2건 먼저**(문서 §1): ① 모든 글씨 Galmuri 통일, ② 테두리 roughness 중간값으로(유저와 눈맞춤).
> 2. 그다음 **2단계 맵 에디터**(문서 §3, screen-design S4/D의 a~k 전부). 구조 먼저 제시하고 "승인" 받고 착수.
> 3. **3단계 통합·HUD**.
>
> 규칙(문서 §6) 엄수: 승인 없이 코드 착수 금지, 배포 금지, 브라우저 자가검증 금지, 자기 파일만 커밋. 로컬 서버는 문서 §5대로(VPN+터널+server/.env). `client/src/sprites/`는 다른 세션 WIP라 건드리지 말 것(TS 오류 있어도 vite dev는 돎).

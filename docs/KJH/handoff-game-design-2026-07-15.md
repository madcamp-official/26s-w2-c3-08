# 게임 설계·스키마 인수인계 (2026-07-15)

다른 세션/계정의 Claude가 이 문서만 읽고 이어서 작업하도록 쓴 자기완결 문서.
브랜치 **`kjh/integrate`**. 짝 문서: [handoff-sprite-pipeline-2026-07-15.md](handoff-sprite-pipeline-2026-07-15.md)(파이프라인·5080 쪽).
개발 PC = `D:\Dev\madcamp\26s-w2-c3-08` (이쪽이 이 문서의 작업 환경. 5080과 다른 머신).

## 0. 한 줄 현황

게임 규칙·스키마·조립기·시각언어까지 **설계 확정 + 코드 반영 + push 완료.**
단 **DB 마이그레이션 미실행**(VPN 필요)이고, 게임 로직(풀 선택·라인 병합·레이스 진행)은 **미구현.**

## 1. 확정된 설계 (재논의 불필요)

- **게임 규칙**: `docs/KJH/screen-design.md`의 "게임 규칙(레이스)" 절 + `shared/constants.ts GAME_RULES`
  (라인 가로40·세로20 상한, 제작180s·프리뷰15s·라인당40s·카운트10s·라스트댄스30s·스윕50s·난입컷60s).
  병합맵 세로는 깃발 y 누적으로 무제한(오르내림 맵).
- **카테고리 통합**: `platform`+`obstacle` → **`block`** (`shared/schemas/block.ts`). CATEGORIES=avatar/block/monster/background/item.
- **몬스터 옵션 확장**: shell(등껍질)·explode·flee·shooter 트리거(주기/근접/시야)·emerge·teleport·anchor (`shared/schemas/monster.ts`).
- **즉사 없음**: HP 1(아이템으로 2). instakill 옵션·물성 제거됨.
- **스위치**: 옵션(`block.togglesSwitch`) — 시스템 블록 아님. 라인당 boolean 1개·OFF 시작·서버권위·전역(짝짓기 없음).
- **공용 풀**: `shared/pool/` — 방 시작 1회 랜덤·방 전체 동일·중복 없음·소스=전 유저 에셋+시스템(비공개 미지원, isPublic 기본 true 유지). 개수 block30/monster10/item5·배경 무제한. 보장규칙(스위치 에셋 최소1) = `GUARANTEED_POOL_RULES`.
- **내 에셋 3종**(배치 무제한, 종류 3). ~~공용 지정 시 내 창고 반투명·카운트 제외~~ **(2026-07-16 취소)** — 공용 지정돼도 "내가 만든" 탭에서 비활성화하지 않음. 대신 **라벨로 표시**(예: "공용 지정됨" 뱃지). 카운트 제외 여부는 별도 확인 필요.
- **시각 언어**: `docs/KJH/visual-language.md` + `shared/visual/deriveVisualTags.ts` (면별 테두리·오라·오버레이 파생. 렌더 적용은 미구현).
- **조립기**: `shared/build/buildRuntimePart.ts` — attrs→BlockSpec/MonsterSpec (testmap 수작업의 다리). `TODO(builder)` 주석 = 밑단 행동 미구현 지점.
- **배치**: 1타일 스냅 · `flipX`만(상하/회전 없음) · patrol/ride 끝점 핸들(endX/Y).
- **DB 신규 모델**(schema.prisma에 정의됨, 마이그레이션 전): MapLine/MapLinePlacement(asset 삭제 Restrict·테스트 성공시에만 저장) · Room(+lineCount) / RoomMember(+canBuild·lineId) / RaceResult(finishMs/finalX/rank).

## 2. 해야 할 일 (우선순위)

### 인프라 필요 (VPN — 개발 PC에서)
1. **마이그레이션**: VM(172.10.7.247, `/root/game`)에 `git pull` 후 `npx prisma migrate dev` — MapLine·Room·RaceResult 등 반영. VM 접속: `ssh -i ~/.ssh/madcamp_vm root@172.10.7.247`(키 등록됨). VM은 push 불가 → 마이그레이션 파일은 로컬로 복사해 커밋.
2. WORKER_TOKEN 설정(백엔드+워커) · SSH 비번/Qwen 토큰 로테이션(평문 노출됨 — 유저가 직접).

### 지금 가능 (격리)
3. **MapLine 서버 API** — 라인 저장/조회/테스트통과 엔드포인트(server/src에, worker-api/routes.ts 패턴).
4. **문서 정합** — `asset-attributes.md`(block 통합·몬스터 확장 반영), screen-design 에디터 탭.
5. 커스텀 스킬 관계(User.equippedSkillId→Asset).

### 게임 로직 (큰 덩어리, 미구현)
6. **공용 풀 선택 구현**(방 시작 시, `shared/pool` 소비) · **라인 병합**(깃발 y 이어붙임) · **레이스 진행**(타이머·순위·스윕) · **방/페이즈 관리**(Colyseus lobby→building→racing→finished).
7. **빌더를 맵 로드에 연결** — 배치(MapLinePlacement)→buildBlock/buildMonster→월드 인스턴스화.

### 다른 세션·병합 후
- 맵 에디터(`client/src/mapeditor`, KJH 별도 세션) · 사운드/이펙트(별도 세션, `docs/KJH/sfx-coverage-todo.md`).
- 병합 후: 시각언어 클라 렌더 적용 · 빌더 공백(신규 행동 explode/anchor/jump_sync/split/shove·knockback 물성·patrol 끝점·ride·trigger 게이팅) · collectSlots 폐기(b 명령적) · 디바운스 일괄(클라즉시+서버쿨다운).

## 3. 주의 (작업 방식 — 유저 규칙)

- **코드/배포/git 실행은 literal "승인" 두 글자를 받은 뒤에만.** "해줘/그래/진행해"는 승인 아님.
- 구현 전 구조(디렉토리/스키마) 먼저 제시 → 평가받고 진행. 주제 완결 전 다음으로 안 넘어감.
- 검증은 유저가 함(토큰 절약). 격식체(합쇼체), 유머 금지.
- 여러 Claude 세션이 같은 디렉토리 공유 중 — **자기 파일만 git add**(다른 세션 WIP 커밋 금지), 푸시 전 `git pull --rebase`(WIP 있으면 stash).
- 메모리 파일: `~/.claude/projects/D--Dev-madcamp-26s-w2-c3-08/memory/` (VM 접속·파이프라인 상태·미룬 결정 등 — 새 계정도 같은 경로면 자동 로드).

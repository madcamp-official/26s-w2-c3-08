# 사운드/이펙트 세션 핸드오프 — 다음 세션이 이어받을 때

> 목적: 다른 계정/세션이 처음부터 재추론하지 않도록. 2026-07-15 기준.
> 이 세션의 마지막 커밋: `8a40137` (`feat(audio): 사운드/이펙트 배선 + 위치 오디오(거리감쇠·팬) + 다른 플레이어 재현`).
> 상세 매핑 커버리지는 `docs/KJH/sfx-coverage-todo.md`(git 추적됨) 참조 — 이 문서와 역할 분담:
> **이 문서 = "무엇을 어떻게 만들었나 + 다음 세션이 뭘 해야 하나"**, **sfx-coverage-todo.md = "옵션별 매핑 표"**.

---

## 0. 이 세션의 역할 (원래 스코프)

**"사운드/이펙트 배선 + 기본 사운드·이펙트를 만드는 세션"** 으로 시작. 다른 세션(맵 에디터/시각언어/MapLine/몬스터 스키마 개편 담당)과 병행 작업 — 파일 소유권을 나눠 충돌 회피(§6 참조).

---

## 1. 만든 것 (전부 커밋됨, `8a40137`)

### 오디오 코어 — `client/src/audio/`
- **`zzfx.ts`**: 초소형 절차적 SFX 신스(Web Audio, zzfx 방식). 파형(사인/삼각/톱니/사각/노이즈) + ADSR + 슬라이드/비브라토 파라미터로 샘플 단위 합성. 오디오 파일 0개, 전부 원본 창작(저작권 프리) — **닌텐도 원본 사운드를 그대로 쓰는 건 저작권 침해라 안 씀** (사용자 확인 완료).
  - `unlockAudio()` — 브라우저 자동재생 정책 해제(첫 사용자 제스처에서 호출, devconsole 키다운/포인터다운에 연결됨).
  - `playBuffer(buf, {volumeMult, pan})` — 재생. `pan`은 StereoPannerNode.
- **`sfx.ts`**: `SoundName → Sfx 파라미터` 프리셋 테이블(29종, 전부 튜닝 가능한 시작값). `playSound(name, {x,y}?)` — 좌표 주면 `listener.ts`로 거리감쇠+팬 자동 적용, 생략하면 풀볼륨(콘솔 오디션용).
- **`listener.ts`**: 오디오 리스너(귀) = 로컬 플레이어 위치. `setListenerPosition(x,y)`(매 프레임), `computeSpatial(sourceX,sourceY)` — **3타일 이내 풀볼륨, 16타일에서 무음(선형 감쇠)** + 좌우 팬. 이 상수(`FULL_VOLUME_TILES`/`SILENT_TILES`)는 실측 전 잠정값 — 플레이 느낌 보고 조정 필요할 수 있음.
- **`settings.ts`**: 볼륨/뮤트 설정. `getAudioSettings()`/`setSfxVolume(0~1)`/`setMuted(bool)`/`onAudioSettingsChange(cb)`. localStorage 저장(기기별). **BGM 필드는 아직 없음 — `bgmVolume` 추가만 하면 확장됨**(아래 §4 참조).

### 이펙트 코어 — `client/src/fx/`
- **`textures.ts`**: 파티클용 소형 텍스처(glow/spark/debris)를 코드로 생성(에셋 무의존).
- **`juice.ts`**: 재사용 저크 프리미티브 — `flash`(발광 플래시), `shockwaveRing`(충격파 링), `particleBurst`(파티클 폭발), `screenShake`, `floatText`, `squashPulse`. 이걸 조합해서 이펙트를 "겹쳐서" 고퀄로 만듦(단일 파티클 이미터 하나로 때우지 않음).
- **`effects.ts`**: `EffectName → 저크 조합`. 7종(dust/explosion/hitFlash/stunStars/poofDeath/spawnSparkle/pickupGlow). `explosion`은 아직 트리거하는 게임플레이가 없어서 미사용 상태(코드는 완성).
- **`dispatch.ts`**: **배선 중앙 매핑**. `feedback.*`(플레이어/물성 이벤트 직접 호출용) + `monsterPatternChanged`(몬스터 패턴 전환용). 전부 소스 좌표(x,y)를 받아 `playSound`에 넘김 → 위치 오디오 자동 적용.

### 배선 지점 — `client/src/rooms/baseworld/BaseworldScene.ts`
로컬 플레이어(자기 이벤트) + 고스트(다른 플레이어) + 몬스터 상태-전이를 전부 여기서 감지해 `feedback.*` 호출. 상세는 §2 표 참조.

### 스키마/서버 변경 (사운드 재현을 위해 불가피하게 건드림)
- **`shared/parts/avatar.ts`**: `Avatar.wallJumpSeq`(누적 카운터) 신설. 벽점프 시 증가.
- **`server/src/rooms/schema/GameState.ts`**:
  - `PlayerState`: `grounded`, `touchingWall`, `dead`, `wallJumpSeq` 신설(relay).
  - `MonsterState`: `currentAction`(string) 신설.
- **`client/src/netphysics/reconcile.ts`**: `sendAvatarState`에 `dead` 인자 추가, 위 필드들 전송.
- **`shared/behavior/evaluate.ts`**: `stepRules`에 "선택된 행동이 바뀐 순간" 감지 → `ctx.emit("actionChanged", {type, ruleId})`. (서버 emit이 클라에 직접 안 닿아서, 이 결과를 `MonsterState.currentAction`으로 우회 전달 — `PhysicsRoom.ts`의 몬스터 emit 콜백이 라우팅.)
- **`server/src/rooms/base/PhysicsRoom.ts`**: 위 라우팅 + `spawnMonster` 메시지 핸들러(devconsole 테스트용, 진단 로그 포함).

### devconsole 명령 (`client/src/devconsole/commands.ts`)
- `playsound <이름|list>` — 사운드 단독 재생(오디션, 게임 미실행 상태에서도 가능)
- `playeffect <이름|list> [x] [y]` — 이펙트 단독 재생(join 필요)
- `volume [0-100]` / `mute [on|off]` — 설정 화면 붙기 전 임시 조작 창구
- `spawnmonster <프리셋|list> [x] [y]` — 몬스터 옵션 축별 테스트 스폰 25종(⚠️ 이 프리셋들은 **몬스터 스키마 개편되면 다시 깨질 수 있음** — 다른 세션이 스키마 바꾸면 `shared/schemas/monster.ts`와 대조해서 갱신 필요)

---

## 2. 무엇이 소리 나는지 (요약표 — 상세는 sfx-coverage-todo.md)

| 트리거 | 로컬 플레이어 | 다른 플레이어(고스트) | 몬스터 |
|---|---|---|---|
| 점프/착지 | ✅ | ✅ | — |
| 내려찍기(예비/착지) | ✅ | ✅ | — |
| 벽잡기/벽점프 | ✅ | ✅(카운터 기반) | — |
| 경사 슬라이딩 | ✅ | ✅ | — |
| 천장 박기 | ✅ | — (필드 없음, 사소해서 스킵) | — |
| 피격/사망 | ✅ | ✅ | — |
| 아이템 획득 | ✅ (kind별 구분: powerUp/revive/pickup) | — | — |
| PvP 헤드스톰프 | ✅ (공격자/피해자 양쪽) | | |
| 사망/기절/은신해제/부활 | | | ✅ |
| 패턴 전환(추적/비행/등반/도약/돌진/낙하돌진/발사/순간이동) | | | ✅ |
| 스위치 토글 | ✅ (소리만 스로틀, 로직 버그는 미룸) | | |
| 트램펄린/블록파괴 | ✅ | | |

---

## 3. 죽은 코드/버그를 잡은 것 (재발 방지용 기록)

- **아이템 획득이 세션 중반까지 완전 무음이었음** — `feedback.pickup` 함수는 있었는데 호출부 자체가 없었음(`itemClaim` 메시지 핸들러 누락). 고쳤음. **교훈: `feedback.*`에 함수를 추가할 때 실제 호출부까지 항상 같이 확인할 것.**
- **`EMIT_MAP`/`dispatchEmit`는 삭제함** — 서버 emit이 그 kind들을 클라로 안 보내는 구조라 애초에 도달 불가능한 죽은 경로였음.
- **client tsc 검증 함정**: `cd client && npx tsc --noEmit`는 `tsconfig.json`이 `files: []` + project references 구조라 **사실상 아무것도 검사 안 함(항상 exit 0)**. 반드시 `npx tsc -b tsconfig.app.json --noEmit` 로 검증할 것. 이 세션 초반에 이 실수로 몬스터 프리셋의 스키마 불일치(shooter 필드명 변경)를 못 잡고 넘어갔던 적 있음.
- **`grounded`(30hz relay)로 순간 이벤트(벽점프)를 못 잡는 문제**: send-rate(30Hz)가 물리 틱(60Hz)보다 낮아서 단일 틱짜리 불리언 플래그는 relay에서 누락될 수 있음. **일회성 이벤트는 불리언이 아니라 누적 카운터로 보낼 것**(`wallJumpSeq` 패턴 참고).
- **`this.dead` 상태 중엔 relay가 완전히 스킵됨**(`fixedTick`의 조기 return) — `dead:true` 상태를 알리려면 `die()`에서 즉시 1회 명시 전송이 필요했음(주기 전송을 기다리면 영영 안 감).

---

## 4. 다음 세션이 할 일 — BGM/엔딩 음악 (사용자가 이 세션에서 안 하기로 결정)

사용자 요청 원문: "게임 배경브금 게임 엔딩 브금 등 여러가지 사운드 생성해야함."

### 기술 접근 (제안, 다음 세션에서 사용자와 확정)
기존 SFX는 원샷 합성이라 시퀀싱이 없음. BGM은 **음표 시퀀스를 정확한 박자로 스케줄링하는 작은 트래커식 시퀀서**가 필요:
- 기존 `zzfx.ts`의 오실레이터/ADSR 재사용 (새 합성 엔진 필요 없음, 시퀀싱 레이어만 추가).
- **Web Audio의 정밀 스케줄링**(`AudioContext.currentTime` 기반 lookahead 스케줄러) 사용 — `setTimeout`은 드리프트 발생하므로 금지.
- 파일 없이 코드로 작곡 = 저작권 프리·용량 0 원칙 유지(SFX와 동일 철학).
- 신규 파일 위치 제안: `client/src/audio/music.ts`(시퀀서 엔진) + `client/src/audio/tracks/*.ts`(트랙별 음표 데이터).

### 필요한 트랙 (사용자가 이 세션 끝에 제시한 것 — 확정 아님, 다음 세션에서 재확인)
- 게임플레이 BGM(루프, 경쾌한 템포) — 라스트댄스 30초 구간 변주 여부는 미정
- 결과/엔딩 BGM(승리 팡파르, 비루프 또는 짧은 루프)
- 후보(우선순위 미정): 로비/메인 화면 BGM, 맵 제작 페이즈 BGM(3분 타이머), 1등 도달 후 카운트다운 긴장감 BGM

### 확인이 필요했던 것 (다음 세션에서 사용자에게 다시 물을 것)
1. 위 후보 중 **지금 몇 개**를 만들지 (전부? 게임플레이+엔딩만 우선?)
2. **`settings.ts`에 `bgmVolume` 필드 추가** — SFX와 분리(이미 구조상 필드 분리해둠, 추가만 하면 됨)
3. **트랙 전환 관리** — 화면 전환 로직 자체가 아직 없음(팀원 프론트 작업 대기 중). 지금은 devconsole `playbgm <이름>` 정도로 오디션만 하고, 실제 화면별 자동 전환은 화면이 붙을 때 연결하는 방향 제안했었음(확정 아님).

---

## 5. 남은 TODO (스키마 개편 대기 — `docs/KJH/sfx-coverage-todo.md` 참조)

요약만: **몬스터/장애물/플랫폼 스키마가 대대적으로 개편될 예정**이라 아래는 지금 배선 안 하고 미룸.
- 블록(장애물·플랫폼) 서버 emit 통로가 `PhysicsRoom.ts`에서 완전 no-op — 회전/진자/돌진/팝업형 장애물 모션 신호가 클라에 전혀 안 옴. 몬스터 때 했던 것과 같은 패턴(`BlockState.currentAction` 신설)으로 선행 작업 필요.
- 연속(루프) 사운드 인프라 없음(컨베이어 벨트 등) — `zzfx.ts`는 원샷만 가능, 루프 재생/정지 관리 별도 필요.
- 플랫폼 옵션(presence/movement/slippery/dash/contactReaction), 장애물 옵션(motion/contactEffect/trigger/shooter) 대부분 위 emit 통로 선행 작업 대기.
- 몬스터 확장분(explode/anchor/splitOnDeath/shove) — 빌더(`buildRuntimePart.ts`) 자체가 미구현이라 사운드 붙일 지점 없음.

---

## 6. 다른 세션과의 파일 소유권 (계속 유효)

이 세션(사운드/이펙트) 소유:
- `client/src/audio/*`, `client/src/fx/*` (전부)
- `BaseworldScene.ts`의 사운드/이펙트 훅 부분(다른 세션이 같은 파일의 다른 부분—시각언어 렌더 등—건드릴 수 있음, 병합 시 확인 필요)

다른 세션 소유(건드리지 않음):
- `shared/schemas/*`(몬스터 등 옵션 스키마), `shared/build/*`(buildRuntimePart.ts), `shared/visual/*`(deriveVisualTags)
- `server/prisma/*`(MapLine), `client/src/mapeditor/*`(맵 에디터 UI)
- `docs/KJH/visual-language.md`, `docs/KJH/screen-design.md` 등

⚠️ 예외적으로 이 세션이 건드린 다른 세션 인접 영역(양해 후 진행, 위 §1 참조):
- `shared/parts/avatar.ts`, `shared/behavior/evaluate.ts`, `server/src/rooms/schema/GameState.ts`, `server/src/rooms/base/PhysicsRoom.ts` — 사운드 재현에 꼭 필요한 최소 필드 추가였음. 다른 세션이 이 파일들도 동시에 건드리고 있었다면 병합 시 diff 확인 필요.

---

## 7. 커밋 상태

`8a40137`에 전부 커밋됨(제 파일만 스코프해서 커밋 — `.claude/launch.json`/`client/package.json`/`package-lock.json`(dnd-kit/framer-motion 추가, 다른 세션 소유)/`client/src/mapeditor/`(다른 세션, 타입에러 있었음)/정체불명 빈 파일 `cd`·`npm`은 제외).

**Push는 아직 안 함** — 필요하면 다음 세션에서 `git push origin kjh/integrate`.

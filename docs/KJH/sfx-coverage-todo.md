# 사운드·이펙트 커버리지 TODO

> 2026-07-14 작성. 현재까지 배선된 것과, **에셋 옵션 스키마가 안정화된 뒤** 마저 채울 것을 구분해 기록.
> 몬스터(및 예정된 장애물/플랫폼) 스키마가 대대적으로 개편될 예정이라, 지금 당장 전부 배선하지 않고
> 여기 목록화만 해둔다 — 개편 후 재작업 낭비 방지.

## 구조 참고
- 사운드 이름 풀: `shared/effects/index.ts` (`SOUNDS`)
- 이펙트 이름 풀: `shared/effects/index.ts` (`EFFECTS`)
- 실제 합성: `client/src/audio/sfx.ts` (zzfx 기반)
- 실제 이펙트: `client/src/fx/effects.ts` + `client/src/fx/juice.ts`
- 배선 지점: `client/src/fx/dispatch.ts`(`feedback`, `monsterPatternChanged`) + `client/src/rooms/baseworld/BaseworldScene.ts`
- 오디션(수동 재생): 콘솔 `playsound <이름>` / `playeffect <이름> [x] [y]`
- **볼륨/뮤트 설정**: `client/src/audio/settings.ts` — `getAudioSettings()`/`setSfxVolume(0~1)`/`setMuted(bool)`/`onAudioSettingsChange(cb)`.
  localStorage 저장(기기별), `zzfx.ts`의 `playBuffer`가 재생마다 `effectiveVolume()`을 읽어 반영(뮤트면 재생 자체 생략).
  **설정 화면(S2c) 붙일 때 이 setter만 호출하면 끝** — 콘솔 `volume [0-100]` / `mute [on|off]`로 미리 확인 가능.
  BGM은 아직 없지만 필드 분리해둬서 나중에 `bgmVolume` 추가만 하면 됨.

- **위치 오디오(거리감쇠·좌우팬)**: `client/src/audio/listener.ts` — `setListenerPosition(x,y)`(매 프레임 로컬 플레이어 위치, `BaseworldScene.render`)
  + `computeSpatial(x,y)`(거리 3타일까지 풀볼륨, 16타일에서 무음, 선형 감쇠 + 좌우 팬). `playSound(name, {x,y})`가 자동 적용.
  **모든 사운드 호출(플레이어·몬스터·블록)이 이미 좌표를 넘기게 소급 적용됨** — 별도 작업 불필요.

## ✅ 매핑 완료
- 플레이어(로컬): 점프·착지·내려찍기착지(무거운 임팩트로 구분)·벽점프·벽잡기·경사슬라이딩·천장박기·피격·사망·아이템줍기
- **플레이어(다른 유저, 고스트)**: 점프·착지·내려찍기착지·내려찍기 예비동작·경사슬라이딩·**벽잡기·벽점프·피격·사망**까지 전부 재현.
  `PlayerState`에 `grounded`/`touchingWall`/`dead`/`wallJumpSeq` 필드 신설(relay) + 상태-전이 감지(`playerFx` Map).
  - `wallJumpSeq`는 **누적 카운터**(불리언 아님) — relay send-rate(30Hz)가 물리 틱(60Hz)의 순간 플래그를 놓칠 수 있어, `Avatar.wallJumpSeq`를 매 벽점프마다 증가시켜 카운터 변화로 감지(`shared/parts/avatar.ts`).
  - `dead`는 `die()`에서 즉시 1회 명시 전송(주기 relay가 사망 중엔 완전히 스킵되므로, `BaseworldScene.die()`).
  - 피격(`invincible` 전이)과 사망(`dead` 전이)이 같은 프레임에 겹칠 수 있어 사망 우선 분기 처리(중복 사운드 방지).
- PvP: 헤드스톰프(공격자/피해자 양쪽), 스위치 토글(소리만 스로틀 — 로직 버그는 별도 미룸)
- 몬스터: 사망·기절·은신해제·부활 + 패턴전환(`chase`/`fly`/`crawlSurface`/`hop`/`chargeSide`/`slamDown`/`shoot`/`teleportTo`) — `MonsterState.currentAction` 상태-전이 감지 방식
- 공용: 트램펄린 밟기, 블록 파괴

## ⚠️ 구조적 선행 작업 필요

### 블록(장애물·플랫폼) emit 통로가 없음
`server/src/rooms/base/PhysicsRoom.ts`의 블록 스텝 루프(§293 부근)가 `emit: () => {}`로 **완전 no-op**이다.
몬스터는 `MonsterState.currentAction`을 신설해 우회했지만(§evaluate.ts `actionChanged`), 블록은 대응 필드가
`BlockState`에 없다. 따라서 **회전(파이어바)·진자·돌진·팝업형 장애물의 모션/발동 신호가 클라에 전혀 안 옴.**

선행 작업(스키마 안정화 후):
1. `BlockState`에 `currentAction: string`(및 필요시 `windupAnim`/`windupEndsAt`, 몬스터와 동형) 추가
2. `PhysicsRoom.ts` 블록 루프의 `emit` 콜백을 몬스터처럼 실제 구현(`actionChanged` 라우팅)
3. 클라 `BaseworldScene.ts`에 블록용 상태-전이 감지 루프 추가(몬스터 때와 동일 패턴)

### 연속(루프) 사운드 인프라가 없음
현재 전부 원샷(one-shot) 합성만 가능. 컨베이어 벨트 이동음, 등반 지속음 등은 **루프 재생 + 정지 관리**가
필요한데 `client/src/audio/zzfx.ts`가 아직 그 기능이 없음. 별도 작업(Web Audio 루프 노드 관리) 필요.

## 🕳️ TODO — 플랫폼 옵션 (`shared/schemas/platform.ts`)
- `presence`: `hidden`→실체화 순간, `blink` 점멸 — 시각만 있고 소리 없음
- `movement`: `ride_start`(탑승 시작 신호) 없음. `patrol` 자체는 무음이 맞음(연속 이동)
- `slippery`(얼음) — 진입/이탈 시 스킷(skid) 사운드 없음
- `conveyor`(벨트) — 루프 사운드 인프라 필요(위 참조)
- `dash`(가속판) — 밟는 순간 사운드 미배선
- `contactReaction: fall/break`(발밑 붕괴) — "곧 무너짐" 사운드 신호 없음(오버레이 시각은 visual-language.md에 정의됨)

## 🕳️ TODO — 장애물 옵션 (`shared/schemas/obstacle.ts`)
전부 위 "블록 emit 통로" 선행 작업 완료 후 가능:
- `motion: spin/pendulum/patrol/charge` — 모션 시작/텔레그래프 신호 불가
- `contactEffect: knockback/updraft` — 대응 물성 자체가 런타임 미구현(`buildRuntimePart.ts` TODO(builder))
- `trigger: periodic/proximity` 팝업형 — 등장/후퇴 신호 없음
- `shooter`(장애물 발사) — 몬스터 shoot 사운드는 되지만 장애물 쪽 발사 이벤트 경로 별도 확인 필요

## ✅ 추가 발견·수정 (2026-07-15)
- **아이템 획득이 아예 무음이었음**: `feedback.pickup`이 코드엔 있었지만 어디서도 호출 안 됨(`itemClaim` 메시지 핸들러에 누락) — `BaseworldScene.ts`에 호출 추가 + `kind`별 사운드 구분(`sizeUp`/`hpUp`→`powerUp` 신규, `invincible`→`revive`, 나머지→`pickup`).
- **`EMIT_MAP`/`dispatchEmit` 죽은 코드 삭제**: `bounce`/`knockback`/`shellify`/`teleported`/`revived`/`respawn`/`hide` 매핑이 어떤 몬스터 스펙에서도 안 쓰이는 행동(`bouncePlayer`/`knockbackPlayer`/`shellify`/`teleportTo`/`ambush`)용이었고, 실제 서버 emit도 이 kind들을 라우팅하지 않아 도달 자체가 불가능했음. 겹치는 기능(`stunned`/`emerge`/`respawn`)은 이미 상태-전이 감지(`monsterStunned`/`monsterEmerge`/`monsterRespawn`)로 대체 커버 중이라 삭제해도 손실 없음.

## 🕳️ TODO — 아이템
- `speed_boost`/`giant_mushroom` 외 나머지 `ItemKind`(`sizeDown`/`score`)는 기본 `pickup` 사운드만 — 필요시 추가 구분

## 🕳️ TODO — 몬스터 (스키마 확장분, 2026-07-14 이후 추가된 옵션)
- `stompReaction: explode` — 현재 `buildRuntimePart.ts`가 `die`로 대체 처리 중이라 폭발 이펙트 자체가 아직 안 씀(스키마 안정화 후 `EFFECTS.explosion` 연결)
- `anchor`(돌진 후 복귀), `splitOnDeath`, `shove` — 빌더 자체 미구현이라 사운드 붙일 지점 없음

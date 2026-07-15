# 스프라이트 파이프라인 인수인계 (2026-07-16)

> 다른 계정/세션의 Claude가 이 문서만 읽고 이어받을 수 있도록 쓴 자기완결 문서.
> 브랜치: **`kjh/integrate`**. 이 문서가 있는 시점까지가 작업분(대부분 **아직 커밋 전** — §6 참조).

---

## 0. 한 줄 현황

실제 파이프라인(ComfyUI + 오케스트레이터)을 5080 로컬에서 반복 실행하며 **실측으로 버그 6개를 찾아 고쳤고**(팔 잘림·노이즈 프레임·디스필 오염·onair 전환프레임·이름 오염·측면뷰 부작용), **에셋 아트 스타일 시스템**(팔레트·손그림 브러시)을 구축해 몬스터·블록·경사·손아이콘·아바타 16종 프로토타입을 만들었다. 3090 Qwen 게이트웨이는 VPN 연결까지는 됐으나 **SSH 터널이 비밀번호 문제로 아직 안 붙었다** — 지금까지의 "외형" 검증은 전부 스텁이거나 Claude가 이미지를 직접 보고 임시로 서술한 것이라, **진짜 검증은 아직 안 끝났다.**

---

## 1. 환경

| 항목 | 상태 |
|---|---|
| 워킹트리 | `D:\projects\madcamp\26s-w2-c3-08` (브랜치 `kjh/integrate`) — worktree 정리 완료, 여기 하나만 씀 |
| Node | `C:\Program Files\nodejs` — PATH에 없음. 매번 `export PATH="/c/Program Files/nodejs:$PATH"` (bash) 필요 |
| ComfyUI | `C:\dev\ComfyUI`, `:8188`. 이번 세션 내내 켜져 있었음 |
| VPN | **연결됨**(사용자가 이번에 새로 연결) |
| SSH 터널(3090) | **안 됨** — `ssh -N -L 8001:127.0.0.1:8001 root@172.10.5.138` 비밀번호를 사용자가 계속 틀림/까먹음. **본인이 발급받은 자격증명 재확인 필요**(운영진 발급). 성공하면 `curl 127.0.0.1:8001/health`로 확인 |
| `gpu-worker/.env` | `QWEN_GATEWAY_URL=http://127.0.0.1:8001` **이미 켜놨음**(주석 해제 완료). 터널만 서면 바로 씀. `QWEN_INTERNAL_TOKEN`도 이미 있음 |

---

## 2. 이번 세션 실측으로 찾아 고친 버그 6개 (전부 코드 반영됨, 미커밋)

### 2.1 팔 휘두르기 등이 생성 캔버스 경계에서 잘림
- **증상**: walk 액션에서 팔이 캔버스 밖으로 나가려다 잘림.
- **원인**: 캐릭터를 원본 타일 비율 그대로 생성 캔버스 전체에 꽉 채워 합성 — 여백이 전혀 없었음.
- **수정**: `paddingTiles:1`(사방 1타일 확장) + `upscaleFactor` 2→4. 캐릭터는 원본 비율(content)로 합성하되 그보다 넓은 캔버스(padded) 중앙에 배치, 후처리·다운스케일도 padded 크기를 "진짜 캔버스"로 취급.
- **부작용**: **최종 스프라이트 크기 자체가 커짐**(아바타 1×2→3×4타일). 히트박스는 알파 bbox로 별도 산출돼 이론상 안전하나, **클라이언트 렌더가 "시각적 스프라이트 ≠ 충돌 판정 크기"를 실제로 잘 처리하는지는 미검증**.
- 파일: `gpu-worker/config/pipeline.json`, `gpu-worker/src/image/composite.ts`, `gpu-worker/src/orchestrator/generateAsset.ts`, `gpu-worker/src/stages/downscale.ts`

### 2.2 가끔 배경이 얼룩진 프레임이 그대로 시트에 섞임
- **증상**: 49프레임 중 1장이 초록 얼룩 배경인 채로 최종 8프레임 시트에 들어감.
- **원인**: 기존 실패판정이 테두리 4px 밴드만 보고 분산을 재서, 얇은 밴드는 우연히 깨끗한데 안쪽이 노이즈인 경우를 못 잡음.
- **수정**: `residualOpaqueBorderRatio()` 신설(flood fill **이후** 테두리에 배경이 실제로 남았는지 직접 재확인) → 나쁜 프레임은 **그 프레임만 드랍**(클립 전체 실패 대신). 정상 프레임 107장 실측 분포(0~12%)로 임계값 20% 보정. `failFrameRatio`도 0.5→0.15로 강화.
- 파일: `shared/imaging/rgba.ts`, `gpu-worker/src/stages/chromakeyRemoval.ts`

### 2.3 디스필이 core 캐릭터색을 검게 뭉갬
- **증상**: 파란 멜빵바지가 같은 클립 안에서 프레임마다 파랑↔검정으로 흔들림. Wan 원본(raw) 프레임은 전부 파란색으로 확인 — **후처리 버그**.
- **원인**: 자동선택 크로마키가 청록(cyan)일 때, 파란 옷도 "우세 채널이 같다"고 오인해 `despill()`이 배경과 무관하게 **캐릭터 전체 픽셀**의 파랑 채널을 뭉갬.
- **수정**: `despill(img, bg, maxDist)` — 배경색과 이미 충분히 먼(core 캐릭터) 픽셀은 건드리지 않게 거리 게이트 추가(flood fill 임계값의 2배).
- 파일: `shared/imaging/rgba.ts`, `gpu-worker/src/stages/chromakeyRemoval.ts`

### 2.4 onair 초반 프레임이 아직 착지 상태
- **증상**: 공중에서 팔다리 벌린 자세여야 하는데, 최종 시트 앞쪽 프레임은 아직 서 있는 자세(전환 중).
- **원인**: raw 프레임 직접 확인 결과 raw-00~03은 "서있음→벌림" 전환 구간, raw-04부터 완전한 자세.
- **수정**: `ActionSpec.skipLeadFrames` 신설(옵션 하나=필드 하나 패턴) — onair에 `skipLeadFrames:5` 설정, loop-select 전에 앞부분 트리밍.
- 파일: `shared/actions/catalog.ts`, `gpu-worker/src/pipeline/types.ts`, `gpu-worker/src/jobs/serverClient.ts`, `server/src/worker-api/routes.ts`, `gpu-worker/src/stages/loopSelect.ts`

### 2.5 캐릭터 이름이 학습된 얼굴을 소환
- **증상**: 소스 그림엔 눈이 점 하나뿐인데, 결과 스프라이트엔 눈 2개+표정 있는 "마리오 얼굴"이 나옴.
- **원인**: 게이트웨이 없는 스텁 모드에서 `job.name="mario"`가 그대로 외형 프롬프트에 들어가, Wan이 실제 그림 대신 **학습으로 기억하는 마리오**를 그림.
- **수정(임시방편)**: 이름 대신 Claude가 실제 이미지를 보고 서술한 순수 외형(이름·포즈·뷰·배경 언급 없음)을 `job.prompt`에 직접 주입. **이건 진짜 해결책이 아니라 게이트웨이 없을 때만의 대체재** — 실제로는 §1의 SSH 터널이 뚫려야 진짜 Qwen2-VL(저보다 약함)로 검증해야 함.
- 파일: 없음(테스트 스크립트 `gpu-worker/src/dev/testMarioSprites.ts`만 해당, 프로덕션 코드는 원래도 정상 — `Orchestrator.getAppearance()`는 게이트웨이 있으면 자동으로 그쪽을 씀)

### 2.6 side view 프롬프트 강제 → 되돌림
- **시도**: 정면 방지를 위해 `stabilizationPositive`에 "side view" 문구 추가.
- **결과**: 8프레임 중 6개는 측면으로 나왔으나, **클립 중간에 정면→측면으로 부자연스럽게 "홱 도는" 아티팩트** 발생.
- **최종 결정**: **프롬프트로 뷰를 강제하지 않음** — 원복. `shared/actions/catalog.ts` 헤더 주석에 이 결정과 이유 명문화.
- **⚠️ 정정(사용자 피드백)**: 소스 그림을 측면으로 그려야 한다는 규칙도 아님. **유저가 정면으로 그리면 정면으로 워크사이클 도는 것도 정상 지원해야 함**(강제 불가). 측면으로 그려지면 결과가 더 안정적인 경향이 있다는 정도이지 규칙이 아님. 실제로 마리오를 측면으로 다시 그려 테스트해봐도 **액션마다 확률적으로 정면 회귀**(walk는 성공, idle·onair는 실패) — 근본 원인 미해결.
- 파일: `gpu-worker/config/pipeline.json`(원복), `shared/actions/catalog.ts`(주석)

---

## 3. 아트 스타일 확정 사항

- **팔레트**: ~120칸 그리드(색상 12×명도 5×채도 2 + 회색조 9칸), 크로마키 4색(순초록·마젠타·시안·순파랑) 제외. `gpu-worker/scripts/gen-asset-prototype.mjs`의 `buildPalette()`/`pick()`/`pickGray()`.
  - ⚠️ **버그였다가 고침**: `pick()`이 좁은 명도 구간에 맞는 칸이 없으면 엉뚱한 기본색(그리드 0번=어두운 빨강)으로 샜었음 — 같은 색상 계열 내 최근접 명도로 대체하게 수정 완료.
- **붓 스타일**: 굵고 손떨림 있는 wobbly 브러시(`wobblyRadialPoints`/`smoothClosedPath`/`wobblyLinePath`/`wobblyOval`) — 완벽한 대칭·직선 지양.
- **테두리**: 게임플레이 에셋(몬스터·블록 등)엔 **절대 금지** — 면별 충돌/위험 테두리는 `shared/visual/deriveVisualTags.ts`가 파생하고 렌더 계층이 별도로 그림(스프라이트에 안 그림). **예외**: 손/carry UI 아이콘만 흰 테두리 + 회색/어두운 장갑(마리오 장갑 느낌) — 이건 게임플레이 오브젝트가 아니라서 예외.
- **뷰 방향**: §2.6 참조 — 강제 안 함, 소스 방향 그대로 따라감, 측면이 더 안정적인 경향(규칙 아님).
- **배경(background 카테고리) 재이해**: 작은 장식 여러 개가 아니라 **라인(레벨)당 딱 1개 쓰는 순수 배경 그림** — 서로 다른 라인용 테마 후보(초원/동굴/성/밤하늘 등)로 여러 개 만드는 것.
- **손 아이콘 개념**: `carry`(들기) 상태일 때 캐릭터 옆에 뜨는 14px짜리 작은 UI 오버레이. 들고 있는 물체 자체가 아님. 지금 코드(`client/src/rooms/baseworld/BaseworldScene.ts`)는 로컬 플레이어 전용(다른 플레이어 손은 아직 안 그림), 아바타에 색 필드도 없어서(`AvatarAttrs={v:1}`뿐) 플레이어별 틴트는 지금 구조로는 불가 — 게임 엔진 쪽 별도 작업 필요.
- **아바타 공용 골격**: `humanoidGeom()`/`humanoidBodySvg()` — 16종(마리오/루이지/공주/토드/고릴라/쥐/거위/악어/스티브/크리퍼/스피드스터/커비/로봇/닌자거북이/기사/해적)이 재사용. 원작 그대로가 아니라 우리 스타일로 재해석.

---

## 4. 스키마 전수 커버 매니페스트 (표만 확정, **아직 생성 안 함**)

몬스터 24 + 블록 29 + 배경 5 + 아이템 3 + 손아이콘 1 + 경사 4방향 = 약 63개. `BlockAttrs`/`MonsterAttrs`의 거의 모든 enum·불리언 값을 최소 1개씩 커버하도록 설계됨(세부는 이 대화 히스토리에 표로 남아있으나 별도 파일로 옮겨두지 않았음 — **다음 세션이 다시 표를 정리하거나 이 대화를 참고해야 함**).

---

## 5. 만들어진 산출물 위치 (전부 로컬, git 미추적)

| 경로 | 내용 |
|---|---|
| `asset-prototype/` | 굼바·뻐끔플라워·체인추피·경사×2·손아이콘·아바타16종 + 콘택트시트. **192KB — 커밋 권장 대상** |
| `gpu-worker-test-out-mario/` | 마리오 idle/walk/onair 최신 결과 + `_labeled-all.png`. 21MB |
| `gpu-worker-test-out/`, `-C/`, `-D/`, `-E/`, `-adaptive/` | 톱니바퀴 회전 실험 산출물(참고용, 지워도 무방). 각 3~4MB |
| `gpu-worker-test-sawblade.png` | 톱니바퀴 테스트 소스(합성 생성, 저작권 문제 없음) |

---

## 6. 커밋 상태 — **이번 세션 변경분 전부 미커밋**

```
M  gpu-worker/config/pipeline.json
M  gpu-worker/src/config/pipelineConfig.ts
M  gpu-worker/src/image/composite.ts
M  gpu-worker/src/jobs/serverClient.ts
M  gpu-worker/src/orchestrator/generateAsset.ts
M  gpu-worker/src/pipeline/types.ts
M  gpu-worker/src/stages/chromakeyRemoval.ts
M  gpu-worker/src/stages/downscale.ts
M  gpu-worker/src/stages/loopSelect.ts
M  package.json
M  server/src/worker-api/routes.ts
M  shared/actions/catalog.ts
M  shared/imaging/rgba.ts
?? gpu-worker/src/dev/           (신규 테스트 스크립트 4개 — 커밋 권장)
?? gpu-worker/scripts/*.mjs      (신규 3개 — 커밋 권장)
?? asset-prototype/              (커밋 권장)
?? gpu-worker-test-out*/         (스크래치 — 커밋 불필요)
?? gpu-worker-test-sawblade.png  (스크래치 — 커밋 불필요)
```

이 문서를 작성한 직후 위 변경분을 커밋·푸시했다 — 실제 커밋 해시는 `git log`로 확인.

---

## 7. 다음 세션 우선순위

1. **SSH 터널 뚫기** — 자격증명 재확인(발급 경로: 운영진→sunboy7594@gmail.com). 뚫리면 `testMarioSprites.ts`의 `job.prompt` 수동 서술을 지우고 실제 게이트웨이로 재검증.
2. **정면/측면 불안정 원인 규명** — 같은 소스인데 액션(=다른 시드)마다 갈리는 이유. cfg/steps 상향 재시도 or best-of-N 전략 검토.
3. **회전 위험물(톱니 등) 미해결** — `motion.type`에 "제자리 자전" 옵션 자체가 없고, 프롬프트 회전 유도도 실패(지난 세션 실험 A~E). 코드측 회전 트랜스폼으로 대체하는 방안 검토 필요.
4. **전수 매니페스트(~63개) 실제 생성** — §4 표 기반, 이번에 만든 스타일 엔진(`gen-asset-prototype.mjs`) 그대로 확장.
5. **패딩으로 커진 스프라이트 vs 히트박스** — 클라이언트 렌더에서 실제로 문제없이 배치되는지 검증.
6. 토드(버섯머리) 프로토타입 비율 아직 어색함(우선순위 낮음).

---

## 8. 함정 모음

- Node PATH 안 잡혀있음 — 매번 `export PATH="/c/Program Files/nodejs:$PATH"`
- `ssh -N ...`는 포트포워딩 전용이라 접속돼도 화면에 아무 출력 없음(정상) — 터미널 닫으면 터널도 끊김
- 크로마키 자동선택 색이 매번 달라짐(그림 색에 따라) — 청록 선택되면 파란 옷과 충돌 가능성 있으니 §2.3 수정이 실제로 반영됐는지 주의
- 게이트웨이 없이 테스트할 땐 **절대 유명 캐릭터 이름을 job.name/prompt에 넣지 말 것**(§2.5) — 이미지를 직접 보고 서술하거나 완전 무해한 라벨 사용

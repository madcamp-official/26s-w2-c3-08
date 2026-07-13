# 스프라이트 생성 파이프라인 — 세션 작업 기록 (2026-07-12~13)

> `kjh/sprite-pipeline` 브랜치(physics-generic 기준) 작업 중 나눈 논의·결정·검증 결과를 빠짐없이 기록.
> 목적: 이 브랜치를 이어서 작업할 때(다음 세션·팀원 인계) 왜 이렇게 됐는지 처음부터 재추론하지 않도록.
> ⚠️ 비밀번호·API 토큰·SSH 자격증명은 이 문서에 절대 기록하지 않음 — 전부 `.env`(gitignore) 또는 각자 메모에만 존재.

---

## 0. 세션의 큰 흐름

1. 배포 인프라 검증 (KCLOUD VM + cloudflared 터널)
2. `kjh/physics-generic` 브랜치 전체 코드 리뷰 (물리·behavior·네트워크 엔진)
3. AI 에셋 생성 파이프라인 설계 확정 (여러 차례 정정)
4. `kjh/asset-pipeline` 브랜치에 gpu-worker 구현 (후처리 stage까지 실동작 검증)
5. LLM 게이트웨이(Qwen) 구조 파악 + 실제 3090 서버 연결·호출 성공
6. 세 브랜치(physics-generic + asset-pipeline + qwen-prompt-server)를 `kjh/sprite-pipeline`으로 병합
7. **다음 단계**: ComfyUI 통신 클라이언트 → 오케스트레이터 → 게임 진입점 (미완료)

---

## 1. 배포 인프라 (별도 memory에도 기록됨)

- 개인 KCLOUD VM(사설 IP)에 Node/cloudflared/pm2로 배포, 공개 도메인:
  - 클라이언트: `https://sunboy7594.madcamp-kaist.org`
  - 게임 서버: `https://sunboy7594-game.madcamp-kaist.org` (Colyseus, wss)
- **핵심 제약**: Cloudflare 무료 인증서는 `*.madcamp-kaist.org` 한 단계만 커버 → 2단계 서브도메인(`game.sunboy7594...`)은 HTTPS 실패 → 형제 서브도메인(`sunboy7594-game`)으로 우회
- **VPN 필요 범위**: VM/서버 SSH 관리 시에만 필요. 런타임(유저 접속, 워커 폴링)은 공개 도메인으로 아웃바운드라 VPN 불필요
- **KCLOUD VM 계열 공통 특징 (2번째 VM에서 재확인)**: VPN이 열어주는 포트는 **22(SSH)뿐**. 로컬 방화벽(iptables/ufw)이 완전히 열려있어도 다른 포트(예: 8001)는 VPN 라우팅 자체가 막음 → 그 포트에 접근하려면 SSH 터널(포트포워딩)로 22번을 타고 우회해야 함
- 지연시간 실측(대구 5080 → 게임서버, 터널 경유): 엣지 TCP RTT 평균 60ms, 앱 왕복 평균 155ms(지터 큼, 98~248ms). 실제 튜닝은 이 세션 범위 아님(다른 세션에서 진행)

---

## 2. `kjh/physics-generic` 브랜치 리뷰 요약

main 대비 102파일, 3643줄 추가. 물리·behavior·PvP·몬스터/블록/아이템/발사체 시스템의 실제 구현.

### 2.1 핵심 원칙
- **권위 분리**: 내 아바타=내 클라(relay만, 서버 보정 없음) / 다른 플레이어=dead-reckoning 외삽 / 몬스터·이동블록·발사체·스위치·아이템 경합=서버 권위 / PvP(밟기·밀기)=자기 화면 기준 로컬 판정(밟는 쪽 항상 유리, favor-the-attacker)
- **`Body`**(`shared/physics/body.ts`): 모든 움직이는 것의 공통 기반. 좌표계=바닥-중앙(발 위치). 충돌 해소=MTV(겹친 만큼만). 경사(바닥·천장)·코너보정·압사판정 전부 `moveAndCollide()` 하나에 통합
- **조건→행동 규칙엔진**(`shared/behavior`): "옵션 하나=파일 하나+등록 한 줄". 액션 26개+조건 15개가 각각 독립 파일로 자기등록. `RuleSpec[]`(JSON 직렬화 가능)으로 몬스터/이동블록 조립. `shared/maps/testmap.ts`에 굼바형·쿵쿵형·추적형 실제 예시
- **`properties`**: 블록 표면이 "닿은 상대에게 뭘 하나"만 (ice/conveyor/trampoline/dash/updraft/damage/instakill/switchToggle)
- **네트워크**: 내 몸=즉시 반응, 남=dead reckoning(속도 외삽)+LERP 수렴. 스쿼시(찌부) 연출은 판정과 분리되어 항상 재생
- **튜닝**: `shared/physics/tuning.json` 단일 원천. `tileSize` 바꾸면 길이 계열만 비례 스케일. 개발자 콘솔(`` ` `` 키)에서 `tune`/`tunediff`로 실시간 조정+기본값 대비 diff 추적

### 2.2 발견한 버그 (이미 해결됨)
- `client/src/rooms/baseworld/BaseworldScene.ts`의 `PlayerNet` 인터페이스 미러에 `tick`·`pound` 필드 누락 → 컴파일 에러. **이후 `git pull`로 이미 수정된 상태 확인됨** (남이 고침, 우리 담당 아니었음)

### 2.3 이 세션에서 중요했던 발견 — 팀 역할
- `docs/KJH/ai-pipeline.md`(이 브랜치 버전)에 "스프라이트 가공은 KJH, 영상생성·ComfyUI·LLM은 LSJ" 라고 적혀 있었으나, **실제로는 팀원(LSJ)이 프론트엔드만 맡기로 재조정되어 AI 백엔드 전부(LLM 게이트웨이 포함) 이 세션 담당자(KJH) 소관**으로 확정됨. 문서는 아직 갱신 안 됨 — 나중에 반영 필요.

---

## 3. AI 파이프라인 설계 — 확정 사항 (여러 차례 정정 거침)

### 3.1 Stage 구성 (최종)
```
Stage 0 그림 입력 (투명 PNG)
Stage 1 입력 정규화 (원본에 bbox → 가로중앙+바닥스냅)
Stage 2 LLM 프롬프트 생성 — 아래 3.3 참조 (미완료: 게이트웨이 확장 필요)
Stage 2.5 크로마키 키색 자동 선택 (그림 색과 HSV거리 최대인 후보)
Stage 3 입력 합성 (투명→키색 배경)
Stage 4 영상 생성 (ComfyUI, GPU 전용 단계) — 미완료: 실통신 클라이언트
Stage 5 CPU 후처리 (5a~5h, 아래 3.2) — 완료+실동작 검증
Stage 6 산출물 (시트PNG + 메타)
Stage 7 워커↔서버 운반 (미착수, DB 큐 포함)
```

### 3.2 Stage 5 후처리 세부 (구현 완료, `gpu-worker/src/stages/`)
- **5a 크로마키 제거**: 프레임마다 테두리 밴드 중앙값=배경색 재측정(드리프트·색급변 대응) → 테두리發 flood fill(캐릭터 내부 유사색 보존) → 디스필
- **5b 실패 판정**: 테두리 색 분산 기준 → 신뢰 불가 프레임 비율 높으면 `StageFailure` (GPU 세그멘테이션으로 안 살림, 재생성 큐로)
- **5c bbox**: 알파 스캔(`alpha > threshold`) + 연결요소 라벨링, 노이즈(1% 미만) 컷오프
- **5d 앵커링**: 바닥-중앙 스냅. ⚠️ **최신 ai-pipeline.md는 완전스냅이 아니라 lerp 부분보간(α, 잠정 0.75)을 요구하는데, 지금 구현(`stages/anchor.ts`)은 하드 스냅 — 아직 미반영, 다음에 고쳐야 함**
- **5e 스케일 정규화**: idle 중앙값 bbox 높이=기준 키, ±10% 클램프(완전스냅 아님, 벗어난 만큼만 경계까지 당김). ⚠️ 이것도 최신 doc은 lerp α 방식 — 미반영
- **5f 루프 선택**: pHash 해밍거리로 시작~끝 가장 닮은 구간 탐색 → `output.frameCount`(8)로 균등 리샘플
- **5g 다운스케일**: nearest, 최종 타일 픽셀 크기로
- **5h 시트 패킹**: sharp로 가로 나열 PNG 1장

**합성 이미지(녹색배경+드리프트+크기변동 시뮬레이션)로 전체 체인 실동작 검증 완료** — 배경투명화·중앙정렬·8프레임·64×128 셀 전부 확인됨(눈으로 이미지 확인함).

### 3.3 Stage 2 프롬프트 생성 — 미해결 핵심 이슈
- **폐기된 안**: LLM은 "외형 묘사"만 뽑고 우리 코드가 템플릿으로 조립 → **사용자가 거부**. 이유: 조각 이어붙이면 프롬프트 품질 낮음.
- **확정 방향**: LLM에게 액션+모션+배경색까지 전부 알려주고, **완성된 wan_prompt를 한 번에 받아서 그대로 사용**. 이를 위한 시스템 프롬프트 초안을 이 세션에서 작성함(요구사항: 배경색 불변·크기 불변·정지 카메라·측면·루프·제자리걸음).
- **막힌 지점**: 기존 게이트웨이(`qwen-prompt-server`)의 `target_type`이 `"avatar"|"asset"`으로 하드코딩, 시스템 프롬프트가 "정면·단일포즈·투명배경" 무조건 강제라 우리 요구(측면·모션·불변 단색배경)를 낼 수 없음. **`sprite_animation` 같은 새 모드 + `action`/`motion_hint`/`background_color` 필드 추가 확장이 필요하나 아직 코드 작성 안 함.**
- 실제 호출 테스트 결과 `wan_prompt`가 한국어로 나옴(시스템 프롬프트는 영어 요구) — 이것도 고쳐야 할 버그로 발견됨.

### 3.4 해상도 — 타일 비율 기반 유도 (고정값 아님)
```
finalW = tilesW * 64, finalH = tilesH * 64
targetLong = clamp(max(finalW,finalH) * upscaleFactor, minGenLongPx, maxGenLongPx)
→ 종횡비 유지하며 16의 배수로 반올림
```
- `upscaleFactor=2`(품질 위해 최종 크기의 최소 2배로 생성 — 그대로 생성하면 품질 급락, 실측 확인됨)
- 에셋 최대 크기 **4×4 타일**로 확정(이전 8×8에서 축소) → 이 상한에선 상한(`maxGenLongPx=768`) 안 걸려서 **모든 크기가 예외 없이 정확히 2배 여유** 받음(검증됨: 1×2, 1×1, 3×2, 4×4, 4×1 케이스 실측)

### 3.5 액션별 생성 길이 — loop 여부 기반 (액션명 나열 아님)
- `shared/actions/derive.ts`의 `DerivedAction.loop` 불리언 하나로 분기: 반복 재생(walk/fly/climb 등)=`loop` 버킷(3초), 1회성(onair/attack)=`oneShot` 버킷(1.5초). 예외만 `overrides`(idle=2초).
- **확장성**: 액션이 아무리 늘어나도 `loop:true/false`만 정해주면 자동으로 알맞은 길이 선택, config 수정 불필요.

### 3.6 config.json 분리 원칙
모든 조정값(알파임계값·노이즈컷오프·크로마키거리임계값·스케일클램프·해상도규칙·GGUF체크포인트파일명·루프알고리즘·프레임수·LLM동시성)을 `gpu-worker/config/pipeline.json` 한 곳에, zod로 검증해 로드(`gpu-worker/src/config/pipelineConfig.ts`). **⚠️ 필드명·앵커링 방식이 최신 ai-pipeline.md(lerp α 방식, `bbox.alphaThreshold=18` 등)와 어긋나 있음 — 다음에 맞춰야 함.**

### 3.7 ComfyUI 워크플로우 — 외부 JSON + 제목 기반 주입
- `gpu-worker/config/comfyui/workflow.i2v.json` — ComfyUI **API 포맷**(UI 그래프 아님). ComfyUI UI에서 "Save (API Format)"으로 언제든 재수출해 덮어쓰기 가능.
- 코드는 노드 **id를 모름** — `_meta.title`(제목)로만 주입 지점 찾음(`INPUT_IMAGE`/`POSITIVE_PROMPT`/`NEGATIVE_PROMPT`/`VIDEO_SIZE`/`SAMPLER_HIGH`/`SAMPLER_LOW`/`UNET_HIGH`/`UNET_LOW`/`LORA_HIGH`/`LORA_LOW`/`OUTPUT`). 제목만 유지되면 재export해도 코드 안 깨짐.
- `gpu-worker/src/backends/comfyui/workflowTemplate.ts`의 `applyOverridesByTitle()` — 없는 제목 넘기면 즉시 에러(오타 방지). **실제 값 주입까지 테스트 완료.**
- 모델: Wan2.2 I2V (GGUF Q5, 16GB VRAM 대응) + 4-step Lightning LoRA. 실제 파일명은 ComfyUI `/object_info`에서 조회해 확정함.

---

## 4. LLM(Qwen) 인프라 — 실제 연결 성공

### 4.1 구조
```
gpu-worker → [게이트웨이 :8001, FastAPI, app.py] → [vLLM :8000] → Qwen2-VL-7B-Instruct
```
- 게이트웨이 = `qwen-prompt-server/`(이 세션에서 레포에 편입). 이미지검증·시스템프롬프트 고정·JSON검증+1회 복구재시도·인증(`X-Internal-Token`) 담당.
- 모델: Qwen2-VL-7B-Instruct, 비전-언어 멀티모달(실제 이미지 인식 가능). 이미지 1장/요청, 최대 1024px/8MB, **게이트웨이 동시성=1**(세마포어), context 4096, temp 0.2.

### 4.2 3090 서버 (camp-11) 실측
- 실제 IP는 사설 `192.168.0.170`, VPN이 매핑해주는 주소로 접속(SSH 22만 직접 통과 가능, 8001은 VPN 라우팅에서 막힘 — 로컬 방화벽은 완전 개방 확인함)
- `qwen-vllm.service`·`qwen-gateway.service` 둘 다 systemd로 상시 실행 중 확인
- GPU: RTX 3090 24GB, 19.2GB 사용 중(모델 상주)
- **SSH 터널로 8001 우회 성공** — `127.0.0.1:8001`(5080 로컬)로 3090의 게이트웨이를 그대로 씀. 터널은 파이썬 스크립트(paramiko 기반 포트포워드)로 백그라운드 실행 중 — **세션 재시작 시 다시 띄워야 함, 영구 서비스 아님**.
- 실제 `/v1/prompts/refine` 호출 성공 확인(졸라맨 테스트 이미지, 5.2초, `confidence:0.82`). 단 **`wan_prompt`가 한국어로 나옴 — 버그, 고쳐야 함**(3.3 참조).

### 4.3 gpu-worker LLM 클라이언트
- `gpu-worker/src/llm/`: `gatewayClient.ts`(요청조립+429/503만 재시도+타임아웃), `concurrencyLimiter.ts`(세마포어), `types.ts`(응답 스키마, snake_case 그대로).
- **현재는 기존 게이트웨이의 `target_type=avatar|asset` 그대로 호출하는 "받는 과정"만 구현** — 3.3의 확장(액션별 모션+배경색 전달, 영어 강제)은 미완료.

---

## 5. 브랜치 병합 (`kjh/sprite-pipeline`) — 이 세션 마지막 작업

### 5.1 절차
```
git checkout kjh/physics-generic (pull로 최신화, PlayerNet 버그 이미 해결된 버전 받음)
git checkout -b kjh/sprite-pipeline
git checkout kjh/asset-pipeline -- shared/schemas shared/actions gpu-worker
git checkout origin/work/camp-11-root/qwen-prompt-server-gateway-vllm -- qwen-prompt-server
```

### 5.2 수동 병합·수정한 충돌
1. **`Faces` 이름 충돌**: `physics/terrain.ts`의 `Faces`(top/bottom/left/right, 실제 엔진 타입)와 `schemas/presets.ts`의 `Faces`(up/down/left/right, attrs Zod 스키마)가 같은 이름으로 barrel export 충돌. → `schemas/presets.ts` 쪽을 `FacesAttr`로 개명 + **필드명도 top/bottom으로 통일**(엔진과 구조가 같아져서 나중에 `collisionFaces()` 결과를 엔진의 `Rect.faces`에 직접 대입 가능해짐). `platform.ts`의 `collisionFaces()` 반환 타입·구현도 갱신.
2. **`shared` 루트 export 불일치**: asset-pipeline은 `"."→"./constants.ts"`, physics-generic은 `"."→"./index.ts"`(배럴). 병합 후 배럴이 이겨서 `gpu-worker`의 `import { TILE_PX } from "shared"`가 깨짐 → `shared/index.ts` 배럴에 `export * from "./constants.js"` 추가로 해결.
3. **`shared/constants.ts`의 `PRESET`/`CONTACT_REACTION`**(asset-pipeline에서 임시로 얹었던 물리값 매핑)은 **가져오지 않음** — physics-generic의 `tuning.json`/`TUNING` 체계가 이미 이 역할을 제대로 하고 있고 실제로 behavior 시스템에서 쓰이고 있어서 중복 제거.
4. `shared/package.json`에 `zod` 의존성 + `./schemas`·`./actions` export 경로 추가(수동 병합).

### 5.3 검증
- `npm install` + `npm approve-scripts`(sharp/prisma/esbuild/msgpackr-extract 재승인) + `npm rebuild`
- **4개 워크스페이스(`shared`/`server`/`client`/`gpu-worker`) 전부 `tsc --noEmit` 통과 확인.**
- 아직 **커밋 안 함** (다음 액션 대기 중이었음).

---

## 6. 다음 세션에서 할 일 (우선순위 순)

1. **Stage 5d/5e를 lerp 부분보간(α) 방식으로 재작성** — 최신 ai-pipeline.md 사양 반영 (`stages/anchor.ts`, `stages/scaleNormalize.ts`, `config/pipeline.json` 필드명도 doc과 맞추기: `anchor.lerp`, `scale.lerp`+`clampPerFrame`, `bbox.alphaThreshold=18`, `bbox.minBlobRatio`, `loop.frames`+`similarity`, `chroma.candidates`+`despill`)
2. **qwen-prompt-server 확장**: 새 모드(`sprite_animation` 등) + `action`/`motion_hint`/`background_color` 필드 + 전용 시스템 프롬프트(측면·모션·불변배경·영어강제) 작성 → systemd 서비스 재시작까지
3. **ComfyUI 실제 HTTP 클라이언트** (`backends/comfyui/client.ts` 미작성): `/upload/image` → `/prompt`(워크플로우+주입값) → `/history/{id}` 폴링 → `/view`로 프레임 다운로드
4. **오케스트레이터**: LLM 호출 → 크로마키 합성 → ComfyUI 생성 → Stage 5 전체 → 시트 저장, 액션 여러 개 묶어 idle 기준 정규화
5. **잡 출처(local folder)** + **게임쪽 진입점**(개발자 콘솔에 명령 추가, 예: `gencharacter <이미지경로>`) — 지금 있는 `client/src/devconsole/commands.ts` 패턴 그대로 확장
6. 이번 병합 커밋
7. SSH 터널(3090:8001)은 세션마다 재실행 필요 — 영구화하려면 systemd 서비스화나 다른 방식 고려

---

## 7. 이 세션에서 나온 원칙·교훈 (재사용할 것)

- **확장성**: "옵션 하나=파일 하나+등록 한 줄" 패턴(behavior 시스템), "액션 이름 나열 대신 boolean 플래그로 분기"(duration), "config는 JSON, 코드는 로직만" — 전부 일관되게 적용 중
- **크기 상한 바뀌면 파이프라인 공식 자체가 자동으로 안전해지는지 항상 재계산할 것** (4×4로 줄이니 해상도 상한 문제가 저절로 사라진 사례)
- **팀원 코드라도 실제로 우리 책임이면 주저없이 고친다** — 다만 SSH로 직접 서버까지 들어가 상태 확인 후에 정확히 뭘 고칠지 판단
- **KCLOUD VM은 전부 VPN에서 22번만 열어줌** — 다른 포트 필요하면 SSH 터널이 기본 해법

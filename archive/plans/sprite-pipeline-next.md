# 스프라이트 파이프라인 통합 — 다음 작업 가이드 (핸드오프)

> 목적: 다른 세션이 이어받을 때 처음부터 재추론하지 않도록. 2026-07-13 기준.
> 깊은 배경은 아래 두 문서 참조:
> - `docs/KJH/sprite-pipeline-session-log.md` — 파이프라인 상세(스테이지·ComfyUI·Qwen 실측)
> - `archive/plans/physics-generic-spec.md` — 물리/게임 설계 §0~66 (gitignore, 로컬)

---

## 0. 현재 상태
- **작업 브랜치 = `kjh/integrate`** (origin에 push됨). 이 하나에 **게임 + gpu-worker(ComfyUI) + qwen-prompt-server** 전부.
- 병합: `physics-generic`(최신 물리) → `sprite-pipeline`(파이프라인+qwen). 커밋 `576f0c6`.
  - 텍스트 충돌 0(공통조상 20a8a10에서 안 겹침). 의미 충돌 1개(slot↔action) 해소.
  - 검증: server·client `tsc` 통과. gpu-worker는 병합 무영향, shared는 소비처로 검증.
- **main 병합은 아직** — 검증 더 하고 별도 결정.

## 1. 확정된 구조 결정 (재논의 불필요)
- **생성 애니 = `shared/actions` deriveActions의 6액션**: `idle / walk / onair / fly / climb / attack`.
  - 나머지(윈드업·피격·죽음·회전·돌진·웅크리기·슬라이드·내려찍기)는 **코드가 스프라이트를 움직여/변형해 표현** — 영상 생성 대상 아님.
  - physics-generic의 `collectSlots`(behavior 슬롯별 생성)안은 **폐기**. deriveActions가 정답.
- **DB**: `AssetSprite.action`(String) + 잡 큐 필드(`prompt/status/claimedAt/attempts/errorMsg`), `@@unique([assetId, action])`. `slot` 아님.
- **토폴로지**: LLM=3090(Qwen), ComfyUI=5080(대구 집), 게임=KCLOUD VM. **pull**(워커가 백엔드 큐 폴링·claim·업로드).
- **팀 역할**: LSJ = 프론트엔드만. AI 백엔드 전부 KJH. (docs/KJH/ai-pipeline.md §7 본문은 아직 옛 담당 — 갱신 필요.)

## 2. 남은 작업 (우선순위·의존순)

> **진행 상태 (2026-07-13):** A·B·C·D·E·F **코드 전부 작성 완료 + tsc 통과.**
> 백엔드 큐(B)는 VM MySQL 상대 스모크 테스트 통과(submit·claim(SKIP LOCKED)·result(raw png)·fail).
> **미검증(인프라 대기):** C(3090 실측 — Qwen 응답), D(5080 실측 — ComfyUI /history·/view 응답 형태, Wan length 제약).
> D는 5080 붙이면 `// TODO: 5080 실측` 주석 지점부터 확인.
> 방식 A 확정: Qwen=외형 1회/에셋, 워커가 액션별 조립.

### A. ActionSpec 리치화 (GPU 불필요) — ✅ 완료 (939a2de)
- `shared/actions/catalog.ts`: `MOTION_HINT: Record<name,string>` → **`ActionSpec` 객체 Record**로.
  - 필드: `loop, motionHint, view("side"|"front"), framing, returnsToStart, durationSec?(예외), poseHint?, negativeExtra?`.
- **버그 수정**: `derive.ts`의 `act()`가 `loop: true` 하드코딩 → onair·attack이 loop 버킷(3s) 타는 버그. loop를 ActionSpec 액션별 선언값으로.
- 하류(gpu-worker payload·DB action String) **무변경**.

### B. 백엔드 큐 골격 (GPU 불필요)
- `server/src/asset/`: 에셋 제출 → `deriveActions(category, attrs)` → `AssetSprite(queued, prompt)` 적재. prompt는 3090 LLM 호출로 채움.
- `server/src/worker-api/`: 5080 워커용 **pull 엔드포인트**(잡 claim + 시트 업로드). 원자적 claim(중복 방지), 스테일 재큐잉.

### C. Qwen 게이트웨이 확장 (3090 SSH 터널 필요)
- `qwen-prompt-server/`: 현재 `target_type=avatar|asset` + "정면·단일포즈" 강제라 우리 요구 못 냄.
  - 새 모드(`sprite_animation`) + `action`/`motion_hint`/`background_color` 필드 + **전용 시스템 프롬프트**(측면·모션·불변 단색배경·seamless loop·영어 강제).
  - **버그**: `wan_prompt`가 한국어로 나옴 → 영어 강제.
  - systemd 서비스 재시작까지.

### D. ComfyUI 클라이언트 + 오케스트레이터 (5080 집 필요)
- `gpu-worker/src/backends/comfyui/client.ts`(미작성): `/upload/image` → `/prompt`(워크플로우+주입) → `/history/{id}` 폴링 → `/view` 프레임 다운로드.
- 오케스트레이터: LLM → 크로마키 합성 → ComfyUI → Stage 5 전체 → 시트 저장. idle 기준으로 액션들 정규화.
- `gpu-worker/src/index.ts`: 서버 큐 **폴링 루프**.

### E. Stage 5 lerp α (GPU 불필요, doc 정합)
- `stages/anchor.ts`·`scaleNormalize.ts`: 현재 하드스냅 → **lerp 부분보간(α, 잠정 0.75)**.
- `config/pipeline.json` 필드명을 최신 ai-pipeline.md와 맞추기(`anchor.lerp`, `scale.lerp`+`clampPerFrame`, `bbox.alphaThreshold=18`, `bbox.minBlobRatio`, `loop.frames`+`similarity`, `chroma.candidates`+`despill`).

### F. 게임 진입점
- 개발자 콘솔 명령(예: `gencharacter <이미지경로>`) — `client/src/devconsole/commands.ts` 패턴 확장.

## 3. 인프라 게이트웨이 (매번 걸리는 것)
- **3090 Qwen**: VPN이 여는 포트는 **22(SSH)뿐** → `:8001` 게이트웨이는 **SSH 터널(포트포워드)로 우회**. 터널은 **세션마다 재실행**(paramiko 스크립트, 영구 서비스 아님). 게이트웨이 :8001, vLLM :8000, 둘 다 systemd 상주.
- **5080(집)**: ComfyUI(`C:\dev\ComfyUI`). VPN으로 백엔드 pull. 모델 = Wan2.2 I2V GGUF Q5 + 4-step Lightning LoRA.
- **런타임엔 VPN 불필요**(공개 도메인 아웃바운드). **SSH 관리에만 VPN**.
- 자격증명(SSH·토큰·DB URL)은 `.env`(gitignore)/개인 메모만. **문서에 절대 안 씀.**

## 4. 검증·주의
- `gpu-worker`·`shared`는 standalone `tsconfig.json`이 없음(tsx 실행). 타입검증은 server·client 소비처로 확인. gpu-worker 단독 검증 필요 시 프로젝트 tsconfig부터 추가.
- Prisma는 아직 **초안(마이그레이션 전)** — 스키마 편집은 파일 수정만. 첫 `migrate dev` 전에 계약 확정.
- ComfyUI 워크플로우는 `_meta.title` 계약으로 주입 — 제목만 유지하면 재export해도 코드 안 깨짐(`applyOverridesByTitle`).

## 5. 브랜치 지도
- `kjh/integrate` = 통합 트렁크(현재 작업).
- `kjh/physics-generic` = 물리/게임(병합 원본, 계속 물리 튜닝하면 여기서 → integrate로 재병합 필요).
- `kjh/sprite-pipeline` = 파이프라인 원본(integrate에 흡수됨).
- `kjh/asset-pipeline`, `work/camp-11·camp-53` = qwen/gpu 원본(참고용).

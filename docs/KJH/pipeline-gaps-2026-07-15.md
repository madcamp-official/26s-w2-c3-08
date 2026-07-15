# 스프라이트 파이프라인 — 부족한 설계부분 진단 (2026-07-15)

> `kjh/integrate` 실제 코드를 읽고 정리한 설계 공백 목록. 우선순위순.
> 배경 문서: `docs/KJH/handoff-sprite-pipeline-2026-07-15.md`(현황), `archive/plans/sprite-pipeline-next.md`(A~F 계획).
> **이번 범위: 이미지 업로드(uploaded 소스 + ONNX 매팅)는 배제** — drawn 코어 경로만.

## 0. 코드로 확인된 현재 상태 (오해 방지)
- 워커 병렬 루프·오케스트레이터·ComfyUI client·serverClient **전부 작성됨**(`gpu-worker/src/`). 타입만 통과, **실기동 미검증**.
- 서버 worker-api **배선 완료**: `server/src/app.config.ts`가 `aiWorkerRouter` 마운트 → `/api/asset/submit`, `/api/ai/jobs/next|:id/result|fail`, `/api/asset/upload-source`, `/api/ai/assets/:id/norm-source|norm-fail`.
- 큐: `server/src/asset/queue.ts` submitAsset → deriveActions → AssetSprite(queued), idle priority=10.
- LLM: **방식 A 확정** — Qwen은 외형(appearance) 1회만, 워커가 액션별 motion+안정화+크로마 조립(`orchestrator/assemblePrompt.ts`). wan_prompt 영어강제 이미 반영(`qwen-prompt-server/prompts.py` L61-66).

---

## 1. [최우선] 종단 미검증 — 코드는 있으나 5080에서 안 돌려봄
파이프라인 "완성"의 실질 = 아래 실기동 확인. 설계가 아니라 검증 공백이지만 여기서 막히면 설계 결함이 드러남.

1. **병렬 워커 루프**(`gpu-worker/src/index.ts`): prepare(다음)∥generate(현재)∥finish(직렬체인) 프리페치 깊이1. drawn 에셋 1건 투입 → idle/walk/onair 3시트 정상 + 프리페치 로그 + finish 순서(idle 키높이 캐시 선행) 확인.
2. **ComfyUI 응답 형태**(`backends/comfyui/client.ts`): `/history/{id}` outputs·`/view` 형태가 실제 v0.21.x와 맞는지 미확인(`// TODO: 5080 실측`).
3. **⚠️ Wan frameCount 제약**: orchestrator가 `genFrameCount = round(durationSec*fps)`로 임의 프레임 요청. Wan2.2 I2V는 보통 **length = 4n+1(예: 81)** 제약이 있어 임의값이 거부/왜곡될 수 있음. 생성 길이를 Wan 허용값으로 스냅하는 로직이 설계에 없음 → **실측 후 duration.ts/resolution 계약에 반영 필요.**

## 2. LLM(방식 A) 시스템프롬프트 충돌 위험 — 미봉합
- **⚠️ 안정화 문구에 "측면(side view)"가 실제로 빠져 있음.** `shared/actions/catalog.ts` 주석은 공통 안정화 = "side view, full body, static camera..."라고 명시하지만, **실제 `config/pipeline.json`의 `stabilizationPositive`엔 측면 지시가 없음** (`"single character centered, full body visible, static locked camera, subject stays in place, plain solid {bg} chroma background, seamless looping animation, clean 2D platformer game sprite"`). 사이드스크롤 플랫포머인데 **정면 캐릭터가 나올 위험** — 설계 의도(side view)와 실제 프롬프트 불일치. 조치: `stabilizationPositive`에 `side view / side profile` 추가(또는 액션별 `view` 필드가 프롬프트에 실제로 반영되게 배선). 실측 첫 이미지에서 바로 드러날 결함.
- 게이트웨이는 여전히 `target_type=avatar|asset`. 방식 A(외형만)라 새 모드는 불필요해졌지만, **Qwen 시스템프롬프트가 wan_prompt에 구도·포즈·배경 문구("front view / single pose / isolated / transparent background")를 섞어 내보내면**, 워커가 뒤에 붙이는 `[side view · walking · {green} background]`(assemblePrompt stabilization)와 **정면충돌**.
- 조치: `qwen-prompt-server/prompts.py`에서 avatar/asset 외형 규칙에 **"구도·카메라·배경·포즈는 절대 언급하지 말 것, 순수 외형(형태·색·재질·스타일)만"** 명시. (한국어 버그는 이미 해결됨.)
- `job.prompt`(백엔드 선채움) 경로는 negative를 `""`로 두고 baseNegative에만 의존 — 현재 queue.ts는 prompt=NULL이라 미사용. 백엔드 선채움 안을 살릴 거면 negative 계약도 정의 필요.

## 3. Stage 5 정규화 방식이 doc과 불일치 (계획 E, 미반영) — 시각 품질 직결
- `stages/anchor.ts`·`scaleNormalize.ts` 현재 **하드스냅**. 최신 `ai-pipeline.md`는 **lerp 부분보간(α≈0.75)** 요구 — 프레임 간 바닥/키높이가 톡톡 튀는 대신 부드럽게 수렴.
- `config/pipeline.json` 필드명도 doc과 어긋남: `anchor.lerp`, `scale.lerp`+`clampPerFrame`, `bbox.alphaThreshold=18`, `bbox.minBlobRatio`, `loop.frames`+`similarity`, `chroma.candidates`+`despill`.

## 4. 크로마키 "갇힘회수" 미봉합
- `enclosedReclaim*` 게이트가 얇은 선 캐릭터를 갉아먹어 **0.9로 사실상 OFF**. 선 두께 추정 게이트 등 안전판 후 원안(0.3) 복원 필요. 굵은 선에선 효과 확인됨.

## 5. 운영·견고성 공백
- **VRAM**: `comfyui/client.ts`가 생성 전 `POST /free`(`{unload_models,free_memory}`) 안 함. 16GB에서 다른 점유 있으면 Wan OOM 위험. run-worker.ps1은 **워커 시작 시 1회만** free.
- **gpu-worker 단독 tsconfig 없음** → 워커 단독 타입검증 불가(server/client 소비처로만). 검증·CI 취약.
- **재시도/실패 종결**: STALE_MS 15분 재큐만 있고, attempts 상한·`Asset.status=failed` 확정·유저 노출(errorMsg 조회) 경로 없음.

## 6. 미구축 진입점 (계획 F)
- **게임 devconsole 진입점**: `gencharacter <path>` 류 미작성(`client/src/devconsole/commands.ts`는 확장돼 있으나 생성 트리거 확인 필요).
- 잡 소스 서빙이 수동(`python -m http.server`). 로컬 폴더 잡 편의 도구 부재.
- (배제) 클라 업로드 UI(upload-source→미리보기→submit) 미작성.

## 7. 배포·DB
- **마이그레이션 배포 VM 미적용**: `20260715123000_asset_source_type`, `20260715080352_game_models`. VM에서 `npx prisma migrate deploy` 안 하면 서버 큐 컬럼 없음. (ADD COLUMN이라 무중단 안전.)
- 테스트 에셋(id 2~10) 배포 DB 잔류, 삭제 API 없음.

---

## 권장 착수 순서 (이미지업로드 배제 기준)
1. **§1 종단 실기동** — drawn 1건으로 3액션 뽑기. 여기서 §1-3(Wan frameCount) 실측 확정.
2. **§2 게이트웨이 시스템프롬프트 정리** — 외형만 나오게 (충돌 제거). 3090 터널 필요.
3. **§3 Stage5 lerp α** — 실기동으로 품질 나오면 바로 체감되는 개선.
4. **§5 VRAM free** — 생성 전 /free 배선(간단, 안정성 큼).
5. **§6 devconsole 진입점** — 게임에서 바로 생성 걸기.
6. §4 갇힘회수·§7 배포는 위 안정화 후.

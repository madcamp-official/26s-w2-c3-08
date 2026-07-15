# 스프라이트 파이프라인 인수인계 (2026-07-15)

다른 세션/계정의 Claude가 이 문서만 읽고 이어서 작업할 수 있도록 쓴 자기완결 문서.
브랜치: **`kjh/integrate`** (원격 최신 push 완료). 이 문서가 있는 커밋까지가 작업분.

---

## 0. 한 줄 현황

에셋 생성 파이프라인(유저 그림 → Wan2.2 I2V → 스프라이트 시트)이 **5080 로컬에서 종단 실증
완료**(스텁 LLM·실제 Qwen 게이트웨이 둘 다). 이후 사지 판단, 네트워크 견고성, **업로드 이미지
지원(하이브리드 배경분리) + 워커 3단 병렬화**까지 구현·커밋됨. 단 **마지막 병렬화 루프와 ONNX
매팅은 아직 실기동 검증 전**(§4 참고).

## 1. 환경 (5080 PC = ForDev-KJH, 이 저장소가 있는 머신)

| 항목 | 값 |
|---|---|
| 메인 워킹트리 | `D:\projects\madcamp\26s-w2-c3-08` (브랜치 `kjh/sprite-pipeline` — 건드리지 말 것) |
| **작업 worktree** | `D:\projects\madcamp\26s-integrate` (브랜치 `kjh/integrate` — 여기서 작업) |
| Node | v24, `C:\Program Files\nodejs` — **기본 PATH에 없음**. 실행 전 `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` 필수 (안 하면 prisma preinstall 등에서 `node not found`) |
| ComfyUI | `C:\dev\ComfyUI`, 포트 8188, v0.21.x. Wan2.2 I2V GGUF Q5 모델은 `models\diffusion_models\`에 있음(unet 폴더 아님 — 통합 취급되어 정상 로드) |
| VRAM | 16GB. Wan 돌리기 전 여유 필요 — `POST http://127.0.0.1:8188/free` body `{"unload_models":true,"free_memory":true}` 로 언로드(자주 함) |
| 배포 백엔드 | `https://sunboy7594-game.madcamp-kaist.org` (KCLOUD VM + cloudflared). 워커→백엔드는 공개 도메인이라 VPN 불필요 |
| 워커 .env | `gpu-worker/.env` (gitignore). `.env.example` 복사가 기본. QWEN 토큰은 메인 워킹트리 `D:\projects\madcamp\26s-w2-c3-08\gpu-worker\.env`의 `QWEN_API_TOKEN` 값을 재사용 |
| 3090 Qwen 게이트웨이 | VPN + SSH 터널 필요(둘 다 수동, 비밀번호는 사용자만 앎): `ssh -N -L 8001:127.0.0.1:8001 root@172.10.5.138` → `curl 127.0.0.1:8001/health`. `.env`에 `QWEN_GATEWAY_URL=http://127.0.0.1:8001` 활성화하면 `llm=gateway`, 없으면 자동 스텁(ComfyUI만으로 검증 가능) |
| 워커 실행 | `gpu-worker/scripts/run-worker.ps1` — env/설치 확인 + 매 시작 전 VRAM free + 크래시 자동 재시작. 또는 수동 `npm start` |
| 테스트 잡 투입 | `POST {서버}/api/asset/submit` `{"category":"avatar","name":"...","attrs":{"v":1},"sourceImageUrl":"<URL>"}` → idle/walk/onair 3잡 큐잉. 소스 이미지는 로컬 `python -m http.server 8899`로 서빙하면 워커가 자기 localhost에서 가져감 |
| 결과 확인 | `{서버}/storage/sprites/<spriteId>.png` (512×64 = 8프레임×64×64 투명 RGBA) |

## 2. 완료된 작업 (이번 세션 시리즈, 시간순)

1. **종단 실증** — 스텁 모드(asset 2)·게이트웨이 모드(asset 3) 모두 3액션 시트 생성 성공.
2. **게이트웨이 MIME 버그 수정**(`0d3343a`) — 이미지 Blob에 `type` 미지정으로 `INVALID_IMAGE_TYPE` 반려되던 것.
3. **사지 판단**(`1f08d4d`) — `gpu-worker/src/anatomy/detectLimbs.ts`: Zhang-Suen 세선화 → 골격 끝점 경로 분석으로 팔/다리 유무 판단. 프롬프트의 사지 문구(`arms swinging` 등)를 조건부 제거(카탈로그를 core/arms/legs로 분해, `stripAbsentLimbClauses`). 막대인간으로 실기동 검증 완료(`limb detection { hasArms: true, hasLegs: true }`).
4. **크로마키 갇힘회수** — margin 게이트 방식(`enclosedReclaim*` config). 굵은 선에선 효과 확인했으나 **얇은 선 캐릭터를 갉아먹어 현재 게이트 0.9로 사실상 OFF**. 재조정 필요(§5-4).
5. **네트워크 타임아웃**(`1f08d4d`) — `src/net/fetchWithTimeout.ts`를 백엔드·ComfyUI 전 호출에 배선. 타임아웃 없는 fetch가 half-open 연결에 걸려 워커가 무기한 멈추던 실측 문제 해결.
6. **상시구동 스크립트** — `gpu-worker/scripts/run-worker.ps1`.
7. **업로드 소스 지원 + 병렬화**(`f33fc39`, 최신) — §3 상세.

## 3. 최신 커밋(`f33fc39`)의 구조 — 업로드 지원 + 병렬화

**설계 원칙**: ① 배경분리는 "싼 결정적 방법 우선, AI는 폴백"(flood-fill → ONNX), ② AI는 CPU로
(VRAM 0 — Wan과 충돌 회피), ③ 정규화는 에셋당 1회 후 서버에 persist(재사용), ④ 분리 불가
이미지는 에셋 단위 즉시 실패(3액션×3재시도 GPU 낭비 방지), ⑤ GPU 직렬 병목 동안 CPU/네트워크
작업을 겹쳐 처리량을 GPU 시간에 수렴.

- **DB**: `Asset.sourceType`("drawn"|"uploaded"), `rawSourceUrl`, `normSourceUrl`.
  마이그레이션 `server/prisma/migrations/20260715123000_asset_source_type/` — **배포 VM에 아직 미적용!**
- **shared/imaging**: flood-fill·테두리추정·디스필·알파통계 순수함수 (서버·워커 공유).
- **서버**:
  - `POST /api/asset/upload-source` (multipart `image`) → 재인코딩+flood-fill 즉시 시도 →
    `{rawUrl, normUrl|null, needsAiNorm}`. 이 URL들을 submit에 넘기는 계약.
  - `jobs/next`가 `normSourceUrl ?? sourceImageUrl` 배달 + `sourceType`/`normPending` 플래그.
  - 워커용 `POST /api/ai/assets/:id/norm-source`(매팅 결과 persist) / `norm-fail`(에셋 단위 실패).
  - `STALE_MS` 15분(프리페치 + 생성 타임아웃 10분 정합).
- **워커**:
  - Stage1 `src/normalize/`: drawn=투명 검증(불투명 즉시 거부), uploaded=flood-fill→ONNX 매팅
    (`isnet-general-use.onnx`, **첫 사용 시 rembg GitHub 릴리스에서 ~170MB 자동 다운로드** →
    `gpu-worker/models/`).
  - 오케스트레이터 `prepare/generate/finish` 3단 + `index.ts` 프리페치 루프(깊이 1) +
    finish 직렬 체인(idle 키높이 캐시 순서 보존).
  - `wan prompt` 로그 추가(프롬프트 가시성).

## 4. ⚠️ 미검증 — 다음 세션이 제일 먼저 할 일

1. **병렬화된 워커 루프 실기동** — `f33fc39`의 새 index.ts는 타입체크만 통과, 실제로 안 돌려봄.
   drawn 에셋 1건 투입해 기존처럼 3액션이 정상 생성되는지 + 프리페치 로그 확인.
2. **ONNX 매팅 종단** — 복잡한 배경 실사 사진 업로드 → `needsAiNorm` → 워커 매팅 → 생성까지.
   모델 다운로드(170MB)가 사용자 승인 필요할 수 있음. flood-fill 경로는 오프라인 검증 완료
   (흰배경 낙서 분리 성공 확인).
3. **upload-source 엔드포인트 실호출** — 코드만 있음. 배포 서버에 마이그레이션+배포 후에나 가능
   (§5-1). 로컬 서버를 띄워 테스트하는 방법도 있음(DB 필요).

## 5. 남은 작업 (우선순위 제안)

1. **배포**: VM에서 `git pull` + `npx prisma migrate deploy` + 서버 재시작. (배포 절차는
   memory/deployment.md 또는 팀 문서 참고. 마이그레이션은 ADD COLUMN 3개라 무중단 안전.)
2. §4의 실기동 검증 3건.
3. **클라 업로드 UI** — upload-source 호출 → 미리보기(normUrl) → submit(sourceType:"uploaded",
   rawSourceUrl, normSourceUrl). `feature/frontend-v2` 팀과 조율.
4. **갇힘회수 재조정** — 얇은 선 안전 판정(선 두께 추정 게이트 등) 후 `enclosedReclaimMarginGate`
   복원(원래 제안값 0.3). 실패 사례: 얇은 낙서 캐릭터가 회수 임계 0.28에 갉아먹힘.
5. **워커 서비스화** — run-worker.ps1을 작업 스케줄러 등록(부팅 자동 시작).
6. **에셋 삭제/관리 API** — 삭제 엔드포인트 없음. 테스트 에셋(id 2~10)이 배포 DB에 잔류 중.
7. **실패 사유 유저 노출** — `AssetSprite.errorMsg`/`Asset.status=failed` 조회 경로.
8. **보안**: 지난 세션 대화에 3090 SSH 비밀번호·QWEN 토큰이 평문 노출된 적 있음 — **비밀번호
   교체 권장**(사용자에게 상기).

## 6. 함정 모음 (겪은 것들)

- PowerShell 5.1은 BOM 없는 UTF-8 스크립트의 한글을 깨뜨려 파싱 에러를 냄 — .ps1은 BOM 포함 저장.
- 이 환경의 백그라운드 프로세스 중지가 실제 node 프로세스를 안 죽이는 경우 있음 — 워커가 여러 개
  떠서 큐 경합했었음. 죽일 땐 `Get-CimInstance Win32_Process`로 커맨드라인 확인 후 PID kill.
- 워커 시작 로그: `[worker] 시작 — ... llm=STUB|gateway`. gateway 기대인데 STUB이면 .env의
  `QWEN_GATEWAY_URL` 주석/터널 확인.
- drawn(캔버스) 테스트 이미지를 손으로 만들 때 흰배경 그대로 넣으면 이제 Stage1에서 즉시 거부됨
  (의도된 동작). 투명 변환 후 넣거나 sourceType=uploaded로.
- 팀원이 같은 브랜치에 자주 푸시함 — push 전 `git fetch` + merge 습관.

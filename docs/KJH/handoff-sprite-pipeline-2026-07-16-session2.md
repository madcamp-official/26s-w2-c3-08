# 스프라이트 파이프라인 인수인계 (2026-07-16 세션2)

> `docs/KJH/handoff-sprite-pipeline-2026-07-16.md`(세션1)를 이어받은 세션의 작업분.
> **전부 미커밋** — `git status`/`git diff`로 실제 변경분 확인할 것. 브랜치: `kjh/integrate`.

---

## 0. 한 줄 현황

세션1이 "SSH 터널 안 됨"으로 남겨둔 블로커가 **이번 세션 시작 시점엔 이미 뚫려있었음**(누가 뚫었는지 불명 — 인수인계 문서엔 없던 상태 변화). 그래서 1순위였던 "실제 게이트웨이로 재검증"을 바로 진행했고, **실제 3090 Qwen2-VL-7B가 이름 유출+환각을 낸다는 걸 실측으로 확인**했다. Claude API로 교체를 시도했으나 **Anthropic Console 결제 버튼이 막혀서 API 키를 못 받음** — 대신 Qwen 프롬프트 자체를 최소화하는 방향으로 선회, `qwen-prompt-server/prompts.py`를 수정했으나 **3090에 배포는 안 됨**(SSH 비밀번호 없어서 이 세션에서 못 함).

---

## 1. 환경 상태 (세션 시작 시점 확인)

| 항목 | 상태 |
|---|---|
| ComfyUI(:8188) | 정상 (`curl 127.0.0.1:8188/system_stats` → 200) |
| SSH 터널(3090) | **이미 연결돼 있었음** — `ps`로 확인한 ssh 프로세스 PID 49376, 세션 시작 이전부터 떠있던 것으로 보임 |
| Qwen 게이트웨이(:8001) | 정상 — `curl 127.0.0.1:8001/health` → `{"ok":true,"gateway_ok":true,"vllm_ok":true,"model_loaded":true}` |
| `gpu-worker/.env` | `QWEN_GATEWAY_URL`/`QWEN_INTERNAL_TOKEN` 이미 켜져있음(세션1 그대로). `ANTHROPIC_API_KEY`는 **추가 안 함**(결제 안 돼서) |

**다음 세션 시작하면 제일 먼저 할 일**: `curl 127.0.0.1:8001/health`로 터널이 여전히 살아있는지부터 확인. 터미널이 닫히면 터널도 끊긴다(세션1 문서 §8 함정 그대로 유효).

---

## 2. 실제 게이트웨이 재검증 결과 — 새 버그 발견

`gpu-worker/src/dev/testMarioSprites.ts`를 실제 게이트웨이 경로로 수정(§4 참조)해서 idle/walk/onair 2회 반복 실행. **파이프라인 자체(세션1의 6개 버그 수정분)는 정상 동작** — 프레임 드랍 0, 크래시 없음, 2회 실행 결과 동일(재현성 있음).

### 새로 확인된 문제: 게이트웨이가 시스템 프롬프트의 IP 규칙을 스스로 어김

`job.name`을 무해하게("test avatar") 둬도, **Qwen2-VL이 이미지를 보고 스스로 "Mario"라고 인식해서 wan_prompt에 이름을 박아넣음**:

```
"A Mario character, white helmet, red outfit, blue scarf, simple shape, 2D platformer sprite style., ..."
```

- `qwen-prompt-server/prompts.py`에 "저작권 캐릭터명 금지" 규칙이 이미 명시돼 있었는데도 무시됨 — **시스템 프롬프트 설계 문제가 아니라 7B 모델의 instruction-following 한계**.
- 게다가 **원본엔 없는 흰 헬멧·파란 스카프까지 만들어냄**(실제 소스는 빨간 야구모자+빨간 상의+파란 멜빵바지, 헬멧·스카프 없음 — `asset-prototype/avatar-01-mario.png` 참조). "인식하는 순간 실제 픽셀 대신 학습된 연상으로 대체"하는 이중 실패로 판단.
- walk 시트에서 뷰 불안정도 재현(앞 2프레임 정면 → 나머지 6프레임 측면 전환) — 세션1 §2.6/§7-2 미해결 항목 그대로.

산출물: `gpu-worker-test-out-mario/{idle,walk,onair}/{sheet.png, anim.gif, raw-*.png}` (로컬 스크래치, git 미추적).

---

## 3. Claude API 교체 시도 — 코드는 완성, 배선은 대기 중

### 3.1 판단 근거
- 3090 Qwen2-VL-7B의 instruction-following/시각 인식 한계가 실측으로 재확인됨(§2).
- 비용 계산: Haiku 4.5 기준 호출당 ~$0.004, 몇백 콜/월이어도 ~$1~2/월 — 동아리 프로젝트엔 무시할 수준.
- **사용자 피드백(중요, 메모리에 기록됨)**: 이 프로젝트는 동아리용이지 실제 출시 대상이 아님 — 저작권/IP 리스크 완화 작업을 선제적으로 제안하지 말 것. (`C:\Users\loser\.claude\projects\...\memory\project-scope-non-commercial.md`)

### 3.2 구현된 것 (코드는 완성, `tsc --noEmit` 통과 확인)
- **신규**: `gpu-worker/src/llm/claudeVisionClient.ts` — `AppearanceRefiner` 인터페이스 구현체. `qwen-prompt-server/prompts.py`의 시스템 프롬프트를 이식(+"이미지에 실제로 보이는 것만 서술, 인식된 캐릭터의 연상 디테일 추가 금지" 규칙 강화). Claude structured outputs(`output_config.format`)로 JSON 강제 — 파싱 실패 경로 자체가 없음. 기본 모델 `claude-haiku-4-5`(env `CLAUDE_VISION_MODEL`로 교체 가능).
- **신규 타입**: `gpu-worker/src/llm/types.ts`에 `AppearanceRefiner` 인터페이스 추가(게이트웨이/Claude 공통 계약). `RefinePromptResult.engine`에 `"claude"` 추가.
- **배선**: `gpu-worker/src/orchestrator/generateAsset.ts`의 `OrchestratorDeps.gateway` 타입을 `PromptGatewayClient` → `AppearanceRefiner`로 일반화(오케스트레이터 로직은 무수정).
- `gpu-worker/src/index.ts`, `gpu-worker/src/dev/testMarioSprites.ts`: 외형 공급자 우선순위 `ANTHROPIC_API_KEY` > `QWEN_GATEWAY_URL` > 스텁으로 분기.
- `gpu-worker/.env.example`: `ANTHROPIC_API_KEY`/`CLAUDE_VISION_MODEL` 항목 문서화.
- `gpu-worker/package.json`: `@anthropic-ai/sdk` 의존성 추가(`npm install`로 이미 설치됨).

### 3.3 막힌 지점 — 결제
Anthropic Console에서 크레딧 구매 버튼이 비활성 상태로 안 눌림. 웹서치 결과 **Anthropic 쪽 알려진 버그**(GitHub issue #62644, #45361, #36881 등 다수 — 계정 상태 불일치, 3DS 통과해도 Stripe 거절 등). 청구지 주소 입력/시크릿모드/다른 브라우저 등 시도했으나 미해결로 세션 종료. **API 키 자체를 아직 못 받음 — `ANTHROPIC_API_KEY`는 `.env`에 없음, Claude 경로는 활성화 안 된 상태.**

**사용자 최종 결정**: API 키 발급을 당장 더 밀어붙이지 않고, 대신 Qwen 프롬프트를 최소화하는 방향으로 전환(§4).

---

## 4. Qwen 프롬프트 최소화 — 로컬 수정 완료, 3090 미배포

`qwen-prompt-server/prompts.py`(SYSTEM_PROMPT)에 **"Minimal description mode"** 섹션 추가:

- `wan_prompt`를 **색상 최대 3개 + 기본 실루엣 카테고리 1개**로 제한(예: `"red, blue, tan skin tone, round humanoid, clean silhouette, 2D platformer game sprite."`).
- 옷·액세서리·얼굴 특징 등 "특징적 디테일"은 아예 요구하지 않음.
- 길이 제한 900자 → **150자**로 축소(단, `schemas.py`의 Pydantic `max_length=900`은 하드 상한으로 그대로 둠 — 프롬프트 레벨 제약이라 코드 검증은 안 건드림).
- 근거를 프롬프트에 직접 명시: "서술이 길수록 모델이 실제 이미지 대신 인식한 캐릭터의 기억된 외형으로 대체하는 경향이 있다."
- "Good/Bad wan_prompt style" 예시 문구도 최소화 스타일로 교체.

**⚠️ 배포 안 됨**: `qwen-prompt-server/`는 이 레포에 소스만 추적되고, 실제 실행은 3090의 `/opt/qwen-prompt-server`에 별도로 배포된 사본(`qwen-prompt-server/README.md` 참조). 반영하려면:

```bash
scp qwen-prompt-server/prompts.py root@172.10.5.138:/opt/qwen-prompt-server/prompts.py
ssh root@172.10.5.138 "systemctl restart qwen-prompt-server"   # 정확한 서비스명은 3090에서 확인
```

**이 세션의 SSH 키로는 3090에 접속 불가**(비밀번호 필요, 세션1과 동일한 문제 — 자격증명 미해결). **다음 세션이 직접 배포하고 나서 `testMarioSprites.ts` 재실행해서 wan_prompt가 실제로 짧아졌는지 확인해야 함.**

---

## 5. 세션1 우선순위 진행 상황

| # | 항목 | 상태 |
|---|---|---|
| 1 | SSH 터널 뚫고 실제 게이트웨이 재검증 | **완료** — 뚫려있었고, 재검증 결과 새 버그(§2) 발견 |
| 2 | 정면/측면 뷰 불안정 원인 규명 | 미착수 (walk에서 재현만 재확인) |
| 3 | 회전 위험물(톱니) 처리 | 미착수 |
| 4 | 전수 커버 매니페스트(~63개) 생성 | 미착수 |
| 5 | 패딩 확장 스프라이트 vs 히트박스 검증 | 미착수 |
| — | (신규) 게이트웨이 이름/환각 유출 대응 | **완료** — Qwen 프롬프트 최소화로 대응(§4), 3090 배포만 남음 |

---

## 6. 커밋 상태 — 전부 미커밋

```
 M gpu-worker/.env.example
 M gpu-worker/package.json
 M gpu-worker/src/dev/testMarioSprites.ts
 M gpu-worker/src/index.ts
 M gpu-worker/src/llm/types.ts
 M gpu-worker/src/orchestrator/generateAsset.ts
 M package-lock.json
 M qwen-prompt-server/prompts.py
?? gpu-worker/src/llm/claudeVisionClient.ts   (신규, 커밋 권장)
?? gpu-worker-test-out*/                      (스크래치, 커밋 불필요 — 세션1과 동일)
?? gpu-worker-test-sawblade.png               (스크래치, 커밋 불필요)
```

---

## 7. 다음 세션 우선순위

1. **3090에 `prompts.py` 배포 + 서비스 재시작**(§4) — 이게 안 되면 이번 세션 작업이 반영 안 됨. SSH 비밀번호부터 확인.
2. 배포 후 `npx tsx gpu-worker/src/dev/testMarioSprites.ts` 재실행 — wan_prompt가 실제로 "색상+형태"만 나오는지, 이름 유출이 줄어드는지 확인.
3. (선택) Anthropic 결제 문제 해결되면 `ANTHROPIC_API_KEY`를 `.env`에 넣고 Claude 경로로 A/B 비교 — 코드는 이미 완성돼 있어서 키만 넣으면 바로 됨.
4. 세션1 §7의 2~5번(뷰 불안정/회전/매니페스트/히트박스)은 그대로 유효.

---

## 8. 함정 모음 (세션1 §8에 추가)

- **SSH 터널이 세션 시작 전부터 이미 떠있을 수 있음** — 매번 새로 뚫으려 하지 말고 `curl 127.0.0.1:8001/health`로 먼저 확인.
- **`qwen-prompt-server/prompts.py`를 레포에서 고쳐도 3090에 반영 안 됨** — `/opt/qwen-prompt-server`에 별도 배포된 사본을 직접 갱신해야 함(scp + 서비스 재시작). 이 레포의 파일은 "소스"일 뿐 "실행 중인 것"이 아님.
- **Anthropic Console 크레딧 구매 버튼 비활성화는 알려진 버그**(2026년 다수 GitHub 이슈) — 안 눌리면 사용자 잘못이 아니라 인프라 문제일 가능성 높음, 무한정 붙잡지 말고 지원팀 문의 또는 대안 경로.
- 이 프로젝트는 **동아리용, 비상업**임을 전제로 판단할 것 — IP/저작권 방어책은 요청 없이 선제 제안하지 말 것(메모리 `project-scope-non-commercial.md` 참조).

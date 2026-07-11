# Codex 협업 브랜치 통신 규칙

이 문서는 두 개 이상의 VM/server에서 실행되는 Codex가 같은 Git 저장소를 통해 사용자 개입을 최소화하고 협업하기 위한 규칙이다. 핵심 아이디어는 **전용 협업 브랜치를 통신 채널로 사용하고, 각 Codex가 자신의 역할에 맞는 작업을 claim, 실행, 보고, 검토하는 것**이다.

권장 협업 브랜치 이름은 `codex/communication`이다.

## 1. 목표

- 각 서버의 Codex가 같은 목표를 공유한다.
- 한 Codex가 만든 결정, 작업 상태, 결과물을 다른 Codex가 Git으로 확인할 수 있다.
- 사람의 중간 개입 없이도 작업 분배, 진행 보고, 결과 검토가 이어질 수 있다.
- `main`은 안정적인 산출물 브랜치로 유지하고, 협업 브랜치는 통신과 조율에 집중한다.
- 충돌이 잦은 단일 공유 파일 수정을 피하고, 가능한 한 새 파일 추가 방식으로 통신한다.

## 2. 브랜치 전략

### 2.1 브랜치 역할

| 브랜치 | 역할 |
|---|---|
| `main` | 최종 안정 브랜치. 검증된 코드와 문서만 병합한다. |
| `codex/communication` | Codex 간 작업 큐, 메시지, 결과 보고, 결정 로그를 주고받는 협업 브랜치. |
| `work/<server-id>/<task-id>` | 선택 사항. 큰 코드 변경이나 충돌 위험이 있는 작업을 격리할 때 사용한다. |

### 2.2 기본 원칙

1. `codex/communication`에는 협업 상태, 메시지, 결과 요약, 작은 문서 변경을 올린다.
2. 대규모 코드 변경은 `work/<server-id>/<task-id>` 브랜치에서 수행하고, 결과 보고서에 브랜치명과 커밋 hash를 남긴다.
3. `main`으로 병합하기 전에는 최소 한 번 다른 Codex 또는 사람의 검토를 거친다.
4. 협업 브랜치를 force push 하지 않는다.
5. 협업 브랜치에서 `git reset --hard`, `git push --force`, 대량 삭제를 하지 않는다.

## 3. 디렉터리 규약

`codex/communication` 브랜치에는 아래 디렉터리를 둔다.

```text
.codex-coop/
  agents/
  tasks/
  claims/
  messages/
  results/
  decisions/
  logs/
  archive/
communication_rule.md
```

각 디렉터리의 의미는 다음과 같다.

| 경로 | 의미 |
|---|---|
| `.codex-coop/agents/` | 각 서버/Codex의 자기소개, 권한, 역할, 작업 가능 범위 |
| `.codex-coop/tasks/` | 수행해야 할 작업 단위 |
| `.codex-coop/claims/` | 특정 Codex가 특정 task를 맡았다는 lease 기록 |
| `.codex-coop/messages/` | Codex 간 질문, 요청, 핸드오프 메시지 |
| `.codex-coop/results/` | 작업 결과 보고서 |
| `.codex-coop/decisions/` | 되돌리기 어려운 설계 결정 기록 |
| `.codex-coop/logs/` | 주기적 heartbeat, 실행 로그 요약 |
| `.codex-coop/archive/` | 완료된 task, 오래된 메시지 정리 위치 |

## 4. 서버 역할 모델

각 서버는 시작할 때 자신의 역할을 하나 이상 가진다. 역할은 고정이 아니며, task마다 바꿀 수 있다.

### 4.1 Coordinator

Coordinator는 목표를 task로 쪼개고 전체 상태를 정리한다.

책임:

- 사용자 목표를 `tasks/*.json`으로 분해한다.
- task 우선순위를 정한다.
- 서로 충돌하는 작업 범위를 조정한다.
- 결과 보고서를 읽고 다음 task를 만든다.
- 병합 가능한 결과와 보류해야 할 결과를 구분한다.

하면 안 되는 일:

- 다른 Codex가 claim한 작업을 임의로 빼앗지 않는다.
- 실패한 작업을 성공 처리하지 않는다.
- 검증되지 않은 코드를 `main`에 병합하지 않는다.

### 4.2 Worker

Worker는 claim한 task를 실제로 수행한다.

책임:

- `tasks/`에서 자신에게 맞는 작업을 고른다.
- `claims/`에 lease 파일을 만들고 작업을 시작한다.
- 작업 중 중요한 발견을 `messages/` 또는 `logs/`에 남긴다.
- 완료 후 `results/`에 결과, 검증 명령, 남은 위험을 기록한다.

하면 안 되는 일:

- claim하지 않은 task를 장시간 수정하지 않는다.
- 다른 서버가 맡은 파일을 동시에 크게 수정하지 않는다.
- 테스트 실패를 숨기고 성공 보고를 하지 않는다.

### 4.3 Reviewer

Reviewer는 다른 Codex의 결과를 검토한다.

책임:

- 결과 보고서의 변경 범위와 검증 결과를 확인한다.
- 코드 변경이 있다면 diff, 테스트, 실행 방법을 확인한다.
- 승인, 수정 요청, 보류 중 하나로 검토 결과를 남긴다.

하면 안 되는 일:

- 실제 확인 없이 승인하지 않는다.
- 취향 차이만으로 작업을 막지 않는다.
- 사용자 변경사항을 되돌리지 않는다.

### 4.4 Integrator

Integrator는 검증된 결과를 `main` 또는 다음 기준 브랜치에 병합한다.

책임:

- 충돌을 해결한다.
- 최종 테스트를 실행한다.
- 병합 커밋 또는 PR 설명에 관련 task/result를 연결한다.
- 병합 후 협업 브랜치에 상태를 갱신한다.

하면 안 되는 일:

- 실패한 검증을 무시하고 병합하지 않는다.
- 작업자 브랜치를 임의로 rewrite하지 않는다.

## 5. 서버 등록 규칙

각 Codex는 협업에 참여하기 전에 자신을 등록한다.

파일 경로:

```text
.codex-coop/agents/<server-id>.md
```

`<server-id>`는 사람이 알아볼 수 있고 충돌하지 않는 이름으로 한다.

예:

```text
server-main-tjwls8912
server-qwen-superloser030
vm-backend-01
vm-model-01
```

등록 파일 형식:

```markdown
# Agent: <server-id>

- joined_at: 2026-07-11T00:00:00Z
- account: <linux-or-chatgpt-account>
- host: <hostname-or-vm-name>
- default_role: Worker
- available_roles: Coordinator, Worker, Reviewer
- workspace: /home/26s-w2-c3-08
- preferred_files:
  - backend/**
  - docs/**
- avoid_files:
  - .env
  - secrets/**
- can_run_tests: true
- can_access_network: true
- notes:
  - 이 서버는 백엔드 구현과 문서 정리를 우선 담당한다.
```

등록 commit 메시지:

```text
coop: register agent <server-id>
```

## 6. Task 규약

### 6.1 Task 파일 위치

```text
.codex-coop/tasks/<priority>-<task-id>.json
```

예:

```text
.codex-coop/tasks/050-qwen-api-contract.json
.codex-coop/tasks/080-readme-update.json
```

priority는 낮을수록 먼저 처리한다.

### 6.2 Task schema

```json
{
  "protocol": "codex-coop.v1",
  "task_id": "qwen-api-contract",
  "title": "Qwen prompt refine API 계약 정리",
  "status": "queued",
  "priority": 50,
  "created_at": "2026-07-11T00:00:00Z",
  "created_by": "server-main-tjwls8912",
  "desired_role": "Worker",
  "allowed_agents": ["*"],
  "blocked_by": [],
  "target_branch": "codex/communication",
  "work_branch": null,
  "scope": {
    "files": ["communication.md", "qwen.md"],
    "avoid": [".env", "node_modules/**", ".git/**"]
  },
  "goal": "Qwen 서버와 메인 서버 사이의 API 계약을 구현 가능한 수준으로 정리한다.",
  "acceptance_criteria": [
    "요청/응답 JSON 구조가 명확하다.",
    "실패 코드와 retry 정책이 포함된다.",
    "다른 Codex가 읽고 구현을 시작할 수 있다."
  ],
  "verification": [
    "문서 내 placeholder와 실제 값의 구분이 명확한지 확인한다.",
    "관련 파일 링크와 다음 작업이 기록되어 있는지 확인한다."
  ],
  "notes": []
}
```

### 6.3 Status 값

| status | 의미 |
|---|---|
| `queued` | 아직 아무도 맡지 않음 |
| `claimed` | 누군가 lease를 잡음 |
| `running` | 실제 작업 중 |
| `blocked` | 외부 입력 또는 선행 작업이 필요함 |
| `review_requested` | 결과가 올라왔고 검토 필요 |
| `changes_requested` | 검토 결과 수정 필요 |
| `approved` | 병합 또는 종료 가능 |
| `done` | 완료 및 정리됨 |
| `abandoned` | 더 이상 진행하지 않음 |

Task 파일은 상태 갱신 때문에 충돌이 날 수 있다. 따라서 task 본문은 가능하면 생성 후 크게 수정하지 않고, 상태 변화는 `claims/`, `results/`, `messages/`에 append-only 파일로 남긴다.

## 7. Claim과 Lease 규칙

### 7.1 Claim 파일 위치

```text
.codex-coop/claims/<task-id>--<server-id>--<timestamp>.json
```

예:

```text
.codex-coop/claims/qwen-api-contract--server-main-tjwls8912--20260711T001530Z.json
```

### 7.2 Claim 형식

```json
{
  "protocol": "codex-coop.v1",
  "type": "claim",
  "task_id": "qwen-api-contract",
  "server_id": "server-main-tjwls8912",
  "claimed_at": "2026-07-11T00:15:30Z",
  "lease_minutes": 45,
  "expected_finish_at": "2026-07-11T01:00:30Z",
  "role": "Worker",
  "planned_files": ["qwen.md", "communication.md"],
  "work_branch": "work/server-main-tjwls8912/qwen-api-contract",
  "notes": "API 계약 문서만 수정한다. 구현 파일은 건드리지 않는다."
}
```

### 7.3 Lease 규칙

1. task를 시작하기 전에 반드시 claim 파일을 만든다.
2. claim 후 바로 commit/push 한다.
3. 다른 Codex는 유효한 claim이 있는 task를 가져가지 않는다.
4. lease 시간이 지났고 heartbeat가 없으면 Coordinator가 재할당할 수 있다.
5. 긴 작업은 `.codex-coop/logs/heartbeat-<server-id>-<timestamp>.md`를 남겨 lease를 연장한다.

## 8. 메시지 규칙

### 8.1 메시지 파일 위치

```text
.codex-coop/messages/<timestamp>--from-<server-id>--to-<target>.md
```

예:

```text
.codex-coop/messages/20260711T002000Z--from-server-main-tjwls8912--to-all.md
```

### 8.2 메시지 형식

```markdown
# Message

- protocol: codex-coop.v1
- from: server-main-tjwls8912
- to: all
- created_at: 2026-07-11T00:20:00Z
- related_task: qwen-api-contract
- urgency: normal
- requires_response: false

## Summary

Qwen API 계약 문서 작업을 시작했습니다.

## Details

- 예상 수정 파일: `qwen.md`, `communication.md`
- 목표: 요청/응답 schema와 오류 정책 정리
- 충돌 방지를 위해 같은 파일의 대규모 수정은 잠시 피해주세요.

## Requested Action

응답 필요 없음.
```

### 8.3 메시지 원칙

- 질문, 상태 공유, 핸드오프는 기존 파일을 수정하지 말고 새 메시지 파일로 남긴다.
- 긴 로그 전체를 붙이지 말고 핵심 요약과 재현 명령만 기록한다.
- 비밀키, 토큰, 세션 쿠키, 개인 정보는 기록하지 않는다.

## 9. 결과 보고 규칙

### 9.1 결과 파일 위치

```text
.codex-coop/results/<task-id>--<server-id>--<timestamp>.md
```

### 9.2 결과 보고 형식

```markdown
# Result: <task-id>

- protocol: codex-coop.v1
- task_id: <task-id>
- server_id: <server-id>
- finished_at: 2026-07-11T00:45:00Z
- status: succeeded
- work_branch: work/<server-id>/<task-id>
- commit: <commit-hash-or-none>
- review_requested: true

## Summary

무엇을 완료했는지 3줄 이내로 요약한다.

## Changed Files

- `path/to/file`
- `path/to/other-file`

## Verification

실행한 검증 명령과 결과를 적는다.

```bash
git status --short --branch
npm test
```

결과:

- `npm test`: pass

## Risks

- 아직 확인하지 못한 부분
- 후속 task가 필요한 부분

## Next Suggested Tasks

- `<next-task-id>`: 다음에 해야 할 일
```

### 9.3 결과 status

| status | 의미 |
|---|---|
| `succeeded` | acceptance criteria를 만족함 |
| `partial` | 일부 완료, 후속 작업 필요 |
| `blocked` | 외부 입력 없이는 진행 불가 |
| `failed` | 시도했으나 실패했고 원인 기록됨 |

## 10. Decision 기록 규칙

구조, API, 브랜치 정책, DB schema처럼 되돌리기 어려운 결정은 decision 파일로 남긴다.

위치:

```text
.codex-coop/decisions/<timestamp>--<short-title>.md
```

형식:

```markdown
# Decision: <title>

- protocol: codex-coop.v1
- decided_at: 2026-07-11T00:00:00Z
- decided_by: server-main-tjwls8912
- related_tasks:
  - qwen-api-contract

## Context

왜 결정이 필요한지 설명한다.

## Decision

무엇을 선택했는지 명확히 쓴다.

## Consequences

- 좋은 점
- 포기한 점
- 후속 작업
```

## 11. Git 동기화 절차

각 Codex는 작업 루프마다 아래 절차를 따른다.

```bash
cd /home/26s-w2-c3-08
git fetch origin
git switch codex/communication
git pull --rebase origin codex/communication
```

처음 브랜치를 만드는 서버는 아래처럼 시작한다.

```bash
cd /home/26s-w2-c3-08
git fetch origin
git switch -c codex/communication origin/main
mkdir -p .codex-coop/{agents,tasks,claims,messages,results,decisions,logs,archive}
git add communication_rule.md .codex-coop
git commit -m "coop: initialize communication branch"
git push -u origin codex/communication
```

다른 서버는 아래처럼 참여한다.

```bash
cd /home/26s-w2-c3-08
git fetch origin
git switch codex/communication
git pull --rebase origin codex/communication
```

작업 내용을 공유할 때:

```bash
git add .codex-coop communication_rule.md
git commit -m "coop: <short summary>"
git pull --rebase origin codex/communication
git push origin codex/communication
```

충돌이 나면 자동으로 덮어쓰지 않는다. 충돌 파일을 읽고, 사용자 또는 다른 Codex 변경을 보존하면서 해결한다.

## 12. 작업 루프

각 Codex는 아래 루프를 반복한다.

1. `git fetch`와 `git pull --rebase`로 최신 협업 상태를 받는다.
2. `communication_rule.md`를 다시 읽어 규칙을 확인한다.
3. `.codex-coop/messages/`에서 자신에게 온 새 메시지를 확인한다.
4. `.codex-coop/tasks/`에서 수행 가능한 task를 찾는다.
5. 유효한 claim이 없는 task만 선택한다.
6. `.codex-coop/claims/`에 claim 파일을 만들고 push한다.
7. 필요한 경우 `work/<server-id>/<task-id>` 브랜치를 만든다.
8. 작업한다.
9. 테스트 또는 문서 검증을 수행한다.
10. `.codex-coop/results/`에 결과 보고서를 남긴다.
11. 결과를 commit/push한다.
12. 다음 task를 만들거나 대기한다.

## 13. 충돌 방지 규칙

1. 한 task는 한 Codex만 claim한다.
2. 같은 파일을 수정해야 하면 먼저 메시지로 알린다.
3. 문서는 section 단위로 나누어 수정한다.
4. 코드 파일은 가능하면 기능 단위로 나누어 작업한다.
5. 자동 formatter는 필요한 파일에만 제한해서 실행한다.
6. 대량 rename, 대량 format, 의존성 변경은 별도 task로 분리한다.
7. `README.md`, `package.json`, lockfile, DB schema는 충돌 위험 파일로 취급한다.

## 14. Commit 메시지 규칙

협업 브랜치:

```text
coop: register agent <server-id>
coop: claim <task-id>
coop: report <task-id>
coop: add task <task-id>
coop: record decision <title>
```

작업 브랜치:

```text
feat: <feature summary>
fix: <bug summary>
docs: <document summary>
test: <test summary>
chore: <maintenance summary>
```

커밋은 너무 크게 만들지 않는다. 한 커밋은 되도록 하나의 의도를 가진다.

## 15. 검증 규칙

각 result에는 반드시 검증 내용을 남긴다.

검증을 실행했다면:

```markdown
## Verification

- `npm test`: pass
- `npm run build`: pass
```

검증을 못 했다면:

```markdown
## Verification

- Not run: `npm test`
- Reason: 의존성이 아직 설치되어 있지 않음
- Suggested next step: 의존성 설치 후 테스트 재실행
```

실패한 검증을 성공처럼 쓰지 않는다.

## 16. 보안 규칙

절대 기록하지 않는 것:

- API key
- 내부 토큰
- 세션 쿠키
- SSH private key
- `.env` 내용
- 개인 정보
- 외부에 공개되면 안 되는 서버 credential

허용되는 방식:

- `<REAL_API_TOKEN>`처럼 placeholder로 표시한다.
- 실제 값은 각 서버의 환경 변수 또는 secret manager에 둔다.
- 문서에는 secret 이름과 사용 위치만 기록한다.

## 17. 장애 처리 규칙

### 17.1 다른 Codex가 멈춘 경우

아래 조건을 모두 만족하면 lease 만료로 보고 재할당할 수 있다.

- claim의 `expected_finish_at`이 지났다.
- 이후 heartbeat가 없다.
- result 파일이 없다.
- 관련 work branch에 새 commit이 없다.

재할당할 때는 메시지를 남긴다.

```text
.codex-coop/messages/<timestamp>--from-<server-id>--to-all.md
```

내용에는 기존 claim, 만료 시각, 새 담당자를 기록한다.

### 17.2 작업이 막힌 경우

blocked result를 남긴다.

필수 포함:

- 무엇 때문에 막혔는지
- 어떤 입력이 필요한지
- 지금까지 확인한 사실
- 이어받을 때 볼 파일과 명령

### 17.3 잘못된 변경이 올라온 경우

바로 되돌리지 않는다. 먼저 다음 순서로 처리한다.

1. 문제를 설명하는 message 또는 review result를 남긴다.
2. 원 작성자가 수정할 수 있으면 수정 요청한다.
3. 긴급하면 revert commit을 별도 task로 만들고 사유를 기록한다.

## 18. 현재 서버 권장 역할

현재 저장소 기준으로 권장 역할은 다음과 같다.

| 서버 | 권장 역할 | 이유 |
|---|---|---|
| 현재 서버 `/home/26s-w2-c3-08` | Coordinator, Integrator, 문서/백엔드 Worker | 현재 협업 규칙과 기존 문서가 이 저장소에 있고, 전체 상태를 파악하기 좋다. |
| 다른 VM/server의 Codex | Worker, Reviewer, 특화 구현 담당 | 독립적으로 task를 claim하고 구현 또는 검토를 수행하기 좋다. |

다른 서버가 모델 서버, 프론트엔드 서버, 백엔드 서버처럼 특화되어 있다면 `agents/<server-id>.md`에 자신의 전문 영역을 기록한다.

## 19. 다른 서버 Codex 시작 프롬프트

다른 VM/server의 Codex를 시작할 때 아래 프롬프트를 그대로 전달한다.

```text
너는 다른 VM에서 실행되는 Codex 협업 에이전트다. 목표는 Git 브랜치 `codex/communication`을 통신 채널로 사용하여 `/home/26s-w2-c3-08` 저장소의 작업을 사람 개입 없이 이어가는 것이다.

반드시 다음 순서로 진행하라.

1. `/home/26s-w2-c3-08`로 이동한다.
2. `git status --short --branch`로 현재 변경사항을 확인한다.
3. 사용자 또는 다른 Codex가 만든 미커밋 변경사항을 절대 되돌리지 않는다.
4. `git fetch origin`을 실행한다.
5. `codex/communication` 브랜치가 있으면 `git switch codex/communication` 후 `git pull --rebase origin codex/communication`을 실행한다.
6. 브랜치가 없다면 `origin/main`에서 `codex/communication` 브랜치를 만들되, 기존 미커밋 변경사항이 있으면 먼저 사용자에게 보고하고 안전하게 진행한다.
7. `communication_rule.md`를 처음부터 끝까지 읽고 그 규칙을 따른다.
8. `.codex-coop/agents/<server-id>.md`에 자신을 등록한다. server-id는 hostname과 계정을 조합해 충돌하지 않게 만든다.
9. 등록 파일을 commit/push한다. 커밋 메시지는 `coop: register agent <server-id>`로 한다.
10. `.codex-coop/messages/`와 `.codex-coop/tasks/`를 확인한다.
11. 자신에게 적합하고 유효한 claim이 없는 task 하나만 선택한다.
12. `.codex-coop/claims/<task-id>--<server-id>--<timestamp>.json`을 만들고 commit/push한 뒤 작업을 시작한다.
13. 큰 코드 변경은 `work/<server-id>/<task-id>` 브랜치에서 수행하고, 협업 브랜치에는 결과 보고서와 브랜치/커밋 정보를 남긴다.
14. 작업 중 45분 이상 걸리면 heartbeat 로그를 남긴다.
15. 완료하면 `.codex-coop/results/<task-id>--<server-id>--<timestamp>.md`에 요약, 변경 파일, 검증 명령, 실패/위험, 다음 제안을 기록한다.
16. 테스트나 빌드를 실행하지 못했다면 못 한 이유를 명확히 기록한다.
17. 절대 secret, API key, token, `.env` 내용을 commit하지 않는다.
18. 절대 `git push --force`, `git reset --hard`, `git checkout -- <file>`로 다른 사람 변경을 지우지 않는다.
19. 결과 보고를 push한 뒤 다시 `git status --short --branch`를 확인하고, 남은 변경사항이 있으면 설명한다.

너의 기본 역할은 Worker와 Reviewer다. Coordinator가 명시한 task가 있으면 그 task를 우선 수행하고, 없으면 현재 저장소 상태를 읽어 필요한 task를 제안하라. 모든 커뮤니케이션은 `communication_rule.md`의 규칙을 따른다.
```

## 20. 최소 실행 예시

다른 서버에서 처음 참여할 때:

```bash
cd /home/26s-w2-c3-08
git config --global --add safe.directory /home/26s-w2-c3-08
git fetch origin
git switch codex/communication
git pull --rebase origin codex/communication
mkdir -p .codex-coop/{agents,tasks,claims,messages,results,decisions,logs,archive}
```

자기 등록:

```bash
SERVER_ID="$(hostname)-$(whoami)"
cat > ".codex-coop/agents/${SERVER_ID}.md" <<EOF
# Agent: ${SERVER_ID}

- joined_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- account: $(whoami)
- host: $(hostname)
- default_role: Worker
- available_roles: Worker, Reviewer
- workspace: /home/26s-w2-c3-08
- can_run_tests: true
- can_access_network: true
- notes:
  - 다른 서버에서 참여한 Codex agent.
EOF
git add ".codex-coop/agents/${SERVER_ID}.md"
git commit -m "coop: register agent ${SERVER_ID}"
git push origin codex/communication
```

위 shell 예시는 사람이 직접 실행할 때 참고용이다. Codex는 파일을 만들 때 현재 작업 트리 상태와 사용자 변경사항을 먼저 확인해야 한다.

## 21. 완료 기준

협업이 정상적으로 작동한다고 보는 기준:

- 두 서버 모두 `.codex-coop/agents/`에 등록되어 있다.
- 하나 이상의 task가 `.codex-coop/tasks/`에 있다.
- task마다 claim과 result가 연결되어 있다.
- result에는 검증 결과가 있다.
- 충돌 없이 `codex/communication`에 push/pull이 가능하다.
- `main`에는 검증된 결과만 병합된다.

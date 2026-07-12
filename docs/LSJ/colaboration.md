# 2인 공동 개발 협업 규칙

이 문서는 `/home/26s-w2-c3-08` 서버 저장소에서 두 계정이 같은 프로젝트를 함께 개발할 때 지켜야 하는 규칙이다. 사람 팀원과 Codex 같은 자동 개발 에이전트가 모두 같은 기준으로 움직이도록, 현재 서버 상태와 실제 작업 절차를 함께 기록한다.

문서 기준 시각: 2026-07-11 05:11:58 UTC

## 1. 현재 서버 상태

### 1.1 저장소 위치

- 프로젝트 경로: `/home/26s-w2-c3-08`
- Git 원격 저장소: `https://github.com/madcamp-official/26s-w2-c3-08.git`
- 현재 기본 브랜치: `main`
- 현재 최신 커밋:
  - `2cdec18 (HEAD -> main, origin/main, origin/HEAD) Initialize README`
  - `f039466 Initial commit`

### 1.2 참여 계정과 그룹

공동 개발 그룹은 `devteam`이다.

```bash
devteam:x:1002:tjwls8912,superloser030
```

현재 확인된 참여 계정은 다음과 같다.

| 계정 | 역할 |
|---|---|
| `tjwls8912` | 공동 개발자 |
| `superloser030` | 공동 개발자 |

현재 Codex가 실행된 계정은 `tjwls8912`이며, 이 계정은 `devteam` 그룹에 포함되어 있다.

```bash
uid=1002(tjwls8912) gid=1003(tjwls8912) groups=1003(tjwls8912),27(sudo),1002(devteam)
```

### 1.3 디렉터리 권한

프로젝트 루트와 `.git` 디렉터리는 모두 `root:devteam` 소유이며, 권한은 `2775`이다.

```bash
root devteam 2775 drwxrwsr-x /home/26s-w2-c3-08
root devteam 2775 drwxrwsr-x /home/26s-w2-c3-08/.git
```

`2775`의 의미:

- `2`: setgid가 켜져 있어, 새 파일과 디렉터리가 부모 디렉터리의 그룹인 `devteam`을 상속한다.
- `775`: 소유자와 그룹은 읽기/쓰기/실행 가능, 그 외 사용자는 읽기/실행만 가능하다.

현재 검사 결과:

- `devteam`이 아닌 그룹을 가진 파일/디렉터리는 발견되지 않았다.
- setgid가 빠진 하위 디렉터리는 발견되지 않았다.
- 그룹 쓰기 권한이 빠진 일반 파일은 발견되지 않았다.

### 1.4 Git 설정

현재 저장소 로컬 Git 설정에는 공동 작업용 설정이 들어 있다.

```bash
core.sharedrepository=group
```

이 설정은 Git이 새로 만드는 내부 파일도 그룹 공유에 맞게 생성하도록 돕는다.

현재 `tjwls8912` 계정에는 다음 Git 안전 디렉터리 설정이 들어 있다.

```bash
/home/26s-w2-c3-08
```

다른 계정에서 아래 오류가 발생하면 해당 계정에서도 안전 디렉터리를 등록해야 한다.

```bash
fatal: detected dubious ownership in repository at '/home/26s-w2-c3-08'
```

해결 명령:

```bash
git config --global --add safe.directory /home/26s-w2-c3-08
```

### 1.5 현재 작업 트리 상태

현재 `main` 브랜치는 `origin/main`을 추적하고 있다.

```bash
## main...origin/main
 M README.md
?? communication.md
?? plan.md
?? qwen.md
```

의미:

- `README.md`는 수정되었지만 아직 커밋되지 않았다.
- `communication.md`, `plan.md`, `qwen.md`는 Git에 아직 추가되지 않은 새 파일이다.
- 새 작업을 시작하기 전, 이 변경사항이 누구의 작업인지 먼저 확인하고 커밋 또는 정리해야 한다.

### 1.6 umask

현재 세션의 `umask`는 `0002`이다.

```bash
0002
```

이는 새 파일이 보통 `664`, 새 디렉터리가 보통 `775`로 생성된다는 뜻이다. 공동 개발 서버에서는 좋은 상태다. 단, 계정별 로그인 환경에서 달라질 수 있으므로 두 계정 모두 `umask 0002`를 유지해야 한다.

## 2. 핵심 원칙

1. `main`은 항상 실행 가능한 상태를 유지한다.
2. 각 작업은 브랜치를 나누어 진행한다.
3. 작업 전에는 반드시 최신 상태를 받고, 작업 후에는 반드시 커밋 단위로 공유한다.
4. 같은 파일을 동시에 크게 수정하지 않는다.
5. 권한 문제를 개인 계정 소유권 변경으로 해결하지 않는다.
6. Codex는 사용자가 만들었을 가능성이 있는 변경사항을 되돌리지 않는다.
7. 미완성 작업은 문서나 커밋 메시지에 남겨 다음 사람이 이어받을 수 있게 한다.

## 3. 첫 사용 시 필수 설정

각 계정은 처음 프로젝트를 만지기 전에 아래 명령을 한 번씩 실행한다.

```bash
git config --global --add safe.directory /home/26s-w2-c3-08
```

각 계정의 셸 설정에도 `umask 0002`를 넣는 것을 권장한다.

```bash
echo 'umask 0002' >> ~/.bashrc
source ~/.bashrc
```

확인 명령:

```bash
cd /home/26s-w2-c3-08
git status --short --branch
umask
id
```

정상 기준:

- `git status`가 ownership 오류 없이 실행된다.
- `umask`가 `0002`로 나온다.
- `id` 결과에 `devteam`이 포함된다.

## 4. 일반 개발 흐름

### 4.1 작업 시작 전

항상 저장소로 이동한다.

```bash
cd /home/26s-w2-c3-08
```

현재 상태를 확인한다.

```bash
git status --short --branch
```

다른 사람의 변경사항을 먼저 받는다.

```bash
git pull --rebase origin main
```

작업 브랜치를 만든다.

```bash
git switch -c feature/작업이름
```

예시:

```bash
git switch -c feature/socket-room
git switch -c feature/qwen-wrapper
git switch -c docs/collaboration-rules
git switch -c fix/login-error
```

### 4.2 작업 중

작업 중간에도 자주 상태를 확인한다.

```bash
git status --short
```

의도한 변경만 커밋에 포함한다.

```bash
git diff
git add 파일명
git diff --staged
```

커밋한다.

```bash
git commit -m "docs: 협업 규칙 추가"
```

권장 커밋 메시지 형식:

| 타입 | 의미 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 동작 변화 없는 구조 개선 |
| `test` | 테스트 추가/수정 |
| `chore` | 설정, 빌드, 기타 관리 작업 |

### 4.3 작업 공유

브랜치를 원격에 올린다.

```bash
git push -u origin feature/작업이름
```

가능하면 GitHub Pull Request로 `main`에 합친다. 시간이 급해서 직접 merge해야 할 경우에도, 최소한 다른 팀원에게 변경 범위와 테스트 결과를 공유한 뒤 진행한다.

## 5. `main` 브랜치 규칙

`main`에서 직접 큰 작업을 하지 않는다.

허용되는 예외:

- README 오탈자 수정
- 작은 문서 수정
- 충돌 해결 후 최종 merge
- 팀원이 명시적으로 합의한 긴급 수정

`main`에 반영하기 전 체크리스트:

- `git status`에 의도하지 않은 변경이 없다.
- 앱이 실행된다.
- 핵심 기능을 직접 눌러보거나 실행해봤다.
- 새 의존성을 추가했다면 설치 방법을 문서화했다.
- 환경변수가 필요하면 실제 값이 아닌 예시만 문서에 적었다.

## 6. 같은 파일을 동시에 수정하지 않는 방법

작업 시작 전에 아래 중 하나를 팀원에게 공유한다.

- 오늘 수정할 파일 목록
- 오늘 맡은 기능 영역
- 건드리지 말아야 할 파일
- 작업 완료 예상 시점

예시:

```text
오늘은 qwen.md의 API 설계 부분과 server/qwen 라우터만 수정합니다.
README.md는 건드리지 않겠습니다.
```

같은 파일을 둘 다 수정해야 한다면 먼저 파일 안에서 담당 구역을 나눈다.

예시:

```text
README.md
- A: 프로젝트 개요, 실행 방법
- B: API 명세, 시연 시나리오
```

## 7. 충돌 해결 규칙

충돌이 나면 먼저 현재 상태를 확인한다.

```bash
git status
```

충돌 파일을 열어 아래 표시를 찾는다.

```text
<<<<<<< HEAD
내 변경
=======
상대 변경
>>>>>>> 브랜치명
```

해결 기준:

1. 둘 중 하나만 무조건 선택하지 않는다.
2. 기능 변경이면 실제 동작 기준으로 합친다.
3. 문서 변경이면 더 최신이고 더 구체적인 내용을 살린다.
4. 판단이 애매하면 팀원에게 확인한다.
5. 해결 후 반드시 실행 또는 문서 미리보기 등으로 결과를 확인한다.

해결 후:

```bash
git add 충돌해결파일
git rebase --continue
```

merge 중이었다면:

```bash
git add 충돌해결파일
git commit
```

## 8. 권한 문제 해결 규칙

권한 문제가 생겼을 때 개인 계정으로 전체 소유권을 바꾸지 않는다.

피해야 할 명령:

```bash
sudo chown -R tjwls8912 /home/26s-w2-c3-08
sudo chown -R superloser030 /home/26s-w2-c3-08
```

공동 개발 저장소에서는 그룹 기준으로 복구한다.

```bash
sudo chgrp -R devteam /home/26s-w2-c3-08
sudo chmod -R g+rwX /home/26s-w2-c3-08
sudo find /home/26s-w2-c3-08 -type d -exec chmod g+s {} +
```

복구 후 확인:

```bash
find /home/26s-w2-c3-08 -not -group devteam -print
find /home/26s-w2-c3-08 -type d ! -perm -2000 -print
find /home/26s-w2-c3-08 -type f ! -perm -g=w -print
```

위 명령에서 출력이 없으면 정상이다.

## 9. 의존성 설치 규칙

프로젝트에 패키지 매니저가 생기면 아래 원칙을 따른다.

- Node.js 프로젝트: `package.json`과 lock 파일을 함께 커밋한다.
- Python 프로젝트: `requirements.txt`, `pyproject.toml`, `uv.lock` 등 사용한 방식을 명확히 커밋한다.
- 새 의존성은 왜 필요한지 커밋 메시지나 PR 설명에 남긴다.
- 전역 설치가 필요한 도구는 README에 적는다.
- 비밀키, 토큰, API 키는 절대 커밋하지 않는다.

환경변수 파일 규칙:

- `.env`에는 실제 비밀값이 들어갈 수 있으므로 커밋하지 않는다.
- `.env.example`에는 키 이름과 예시 값만 둔다.

예시:

```env
OPENAI_API_KEY=replace-me
QWEN_API_URL=http://localhost:8000
```

## 10. 문서 작성 규칙

문서는 코드와 같은 수준으로 관리한다.

중요 문서의 역할:

| 파일 | 역할 |
|---|---|
| `README.md` | 프로젝트 소개, 실행 방법, 최종 시연 정보 |
| `plan.md` | 기획, 일정, 구현 범위 |
| `communication.md` | 통신 구조, API, 실시간 기능 정리 |
| `qwen.md` | Qwen 또는 LLM Wrapper 관련 설계 |
| `colaboration.md` | 공동 개발 규칙과 Codex 작업 지침 |

문서를 고칠 때는 다음을 지킨다.

- 추측과 확정 사항을 구분한다.
- 실제로 확인한 명령은 명령과 결과를 함께 남긴다.
- 날짜가 중요한 내용은 절대 날짜로 적는다.
- API 키나 내부 토큰은 실제 값을 쓰지 않는다.

## 11. Codex 작업 규칙

Codex는 이 저장소에서 작업하기 전에 이 문서를 먼저 읽고, 아래 규칙을 따른다.

### 11.1 시작 체크

작업 시작 시 확인할 것:

```bash
pwd
git status --short --branch
id
umask
git config --get core.sharedRepository
```

확인해야 하는 기준:

- `pwd`는 `/home/26s-w2-c3-08`이어야 한다.
- `id` 결과에 `devteam`이 있어야 한다.
- `umask`는 가능하면 `0002`여야 한다.
- `core.sharedRepository`는 `group`이어야 한다.
- 작업 트리에 기존 변경사항이 있으면 사용자의 작업으로 간주한다.

### 11.2 기존 변경사항 보호

Codex는 다음을 하지 않는다.

- 사용자가 만들었을 가능성이 있는 변경사항을 임의로 되돌리지 않는다.
- `git reset --hard`를 사용하지 않는다.
- `git checkout -- 파일명`으로 파일을 되돌리지 않는다.
- 관련 없는 파일을 정리한다는 이유로 삭제하지 않는다.
- 비밀값이 들어간 파일을 새로 커밋 대상으로 만들지 않는다.

기존 변경사항이 작업과 충돌하면:

1. 먼저 `git status`와 필요한 `git diff`를 확인한다.
2. 관련 있는 변경만 읽고 이해한다.
3. 사용자의 변경을 보존하는 방향으로 수정한다.
4. 판단이 불가능하면 사용자에게 짧게 확인한다.

### 11.3 파일 수정 원칙

Codex는 요청받은 범위에 맞춰 최소한의 파일만 수정한다.

- 새 파일을 만들 때는 그룹 공유 권한이 유지되는지 확인한다.
- 문서 파일은 한국어 맥락을 유지한다.
- 코드 파일은 기존 스타일과 패턴을 따른다.
- 자동 포맷팅은 필요한 파일에만 적용한다.
- 대규모 리팩터링은 사용자가 요청하지 않으면 하지 않는다.

### 11.4 작업 완료 전 확인

Codex는 완료 전에 가능한 범위에서 아래를 확인한다.

```bash
git status --short
git diff --check
```

코드 변경이 있었다면 프로젝트에 맞는 테스트나 실행 확인도 수행한다.

예시:

```bash
npm test
npm run lint
pytest
```

실행할 수 없는 테스트가 있으면, 왜 실행하지 못했는지 최종 보고에 남긴다.

### 11.5 최종 보고

Codex는 최종 응답에 다음을 짧게 포함한다.

- 어떤 파일을 바꿨는지
- 핵심 변경 내용
- 확인한 명령
- 남은 주의사항

## 12. 작업 인수인계 템플릿

작업을 멈추거나 팀원에게 넘길 때 아래 형식으로 남긴다.

```text
작업자:
브랜치:
수정한 파일:
완료한 내용:
아직 남은 내용:
실행/테스트 결과:
주의할 점:
```

예시:

```text
작업자: tjwls8912
브랜치: feature/qwen-wrapper
수정한 파일: qwen.md, server/qwen.ts
완료한 내용: Qwen API 요청/응답 구조 초안 작성
아직 남은 내용: 에러 응답 포맷 정리
실행/테스트 결과: 문서만 수정해서 별도 실행 없음
주의할 점: README.md의 API 설명과 아직 맞춰야 함
```

## 13. 매일 작업 전 체크리스트

```bash
cd /home/26s-w2-c3-08
git status --short --branch
git pull --rebase origin main
umask
id
```

확인할 것:

- 내가 수정하지 않은 변경사항이 있는가?
- 오늘 만질 파일을 팀원에게 공유했는가?
- 같은 파일을 다른 사람이 수정 중인가?
- 내 브랜치가 최신 `main`에서 갈라졌는가?

## 14. 매일 작업 후 체크리스트

```bash
git status --short
git diff --check
```

확인할 것:

- 의도한 파일만 변경되었는가?
- 불필요한 로그, 임시 파일, 비밀값이 들어가지 않았는가?
- 실행 또는 테스트 결과를 팀원에게 공유했는가?
- 커밋 또는 인수인계 메모를 남겼는가?

## 15. 긴급 복구 명령 모음

### 15.1 Git ownership 오류

```bash
git config --global --add safe.directory /home/26s-w2-c3-08
```

### 15.2 공유 권한 복구

```bash
sudo chgrp -R devteam /home/26s-w2-c3-08
sudo chmod -R g+rwX /home/26s-w2-c3-08
sudo find /home/26s-w2-c3-08 -type d -exec chmod g+s {} +
```

### 15.3 현재 변경사항 확인

```bash
git status --short --branch
git diff
git diff --staged
```

### 15.4 원격 상태 갱신

```bash
git fetch origin
git status --short --branch
```

### 15.5 내 브랜치를 최신 main 위로 재정렬

```bash
git fetch origin
git rebase origin/main
```

충돌이 나면 충돌 파일을 해결한 뒤:

```bash
git add 충돌해결파일
git rebase --continue
```

## 16. 절대 하지 말아야 할 것

- `main`에서 큰 기능을 바로 개발하지 않는다.
- 사용자나 팀원의 변경사항을 확인 없이 삭제하지 않는다.
- 프로젝트 전체 소유자를 개인 계정으로 바꾸지 않는다.
- `.env`, API 키, 내부 토큰을 커밋하지 않는다.
- 충돌 표시가 남아 있는 파일을 커밋하지 않는다.
- 테스트하지 않은 변경을 테스트한 것처럼 말하지 않는다.
- 원인을 모르는 권한 문제를 `chmod 777`로 해결하지 않는다.

## 17. 추천 운영 방식

가장 안정적인 운영 방식은 다음과 같다.

1. 각자 기능 브랜치를 만든다.
2. 매일 시작할 때 `main`을 최신화한다.
3. 수정할 파일 범위를 먼저 공유한다.
4. 작은 단위로 커밋한다.
5. PR 또는 팀원 확인 후 `main`에 합친다.
6. `main`에 합친 뒤 다른 팀원은 즉시 `git pull --rebase origin main`을 실행한다.

현재 서버는 그룹 공유 개발을 위한 기본 권한 설정이 잘 잡혀 있다. 앞으로의 주요 리스크는 권한보다도 같은 파일을 동시에 수정하는 것, 미커밋 변경사항을 모른 채 작업을 시작하는 것, 그리고 Git 충돌을 급하게 해결하면서 상대 변경을 지우는 것이다. 이 문서의 체크리스트를 따르면 두 계정과 Codex가 같은 저장소에서 비교적 안전하게 함께 개발할 수 있다.

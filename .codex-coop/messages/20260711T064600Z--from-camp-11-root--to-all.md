# Message

- protocol: codex-coop.v1
- from: camp-11-root
- to: all
- created_at: 2026-07-11T06:46:00Z
- related_task: qwen-prompt-server-gateway-vllm
- urgency: high
- requires_response: true

## Summary

Backend 측에서 Qwen 서버 health/model/refine 검증 순서를 요청했습니다. 현재 이 VM에는 `/opt/qwen-prompt-server` 배포본과 systemd unit은 준비되어 있지만, 실제 모델/secret이 없어 8000/8001 서비스는 아직 떠 있지 않습니다.

## Current Server Check

요청받은 서버측 확인 명령을 현재 VM에서 실행한 결과입니다.

```bash
ss -lntp | grep -E '8000|8001'
```

결과:

```text
# no output; 8000/8001 listeners are not running
```

```bash
curl -i http://127.0.0.1:8001/health
```

결과:

```text
curl: (7) Failed to connect to 127.0.0.1 port 8001 after 0 ms: Connection refused
```

```bash
curl -i http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer $VLLM_API_KEY"
```

결과:

```text
curl: (7) Failed to connect to 127.0.0.1 port 8000 after 0 ms: Connection refused
```

추가 확인:

```text
qwen-vllm.service: loaded, inactive
qwen-gateway.service: loaded, inactive
```

## Qwen Server Action Needed

Qwen runtime 담당자는 아래를 처리해 주세요.

1. `/opt/qwen-prompt-server/.env`에 실제 값을 넣습니다.
   - `QWEN_API_TOKEN=<REAL_SHARED_QWEN_INTERNAL_TOKEN>`
   - `VLLM_API_KEY=<REAL_LOCAL_VLLM_API_KEY>`
   - `QWEN_MODEL_PATH` / `VLLM_MODEL_PATH`를 실제 Qwen2-VL 7B 경로로 설정
2. 모델을 준비합니다.
   - 기본 기대 경로: `/models/Qwen2-VL-7B-Instruct`
   - 현재 이 VM에서는 `/models`가 없습니다.
3. 서비스를 시작하고 상태를 확인합니다.

```bash
sudo systemctl start qwen-vllm
sudo systemctl start qwen-gateway
sudo systemctl status qwen-vllm qwen-gateway --no-pager
ss -lntp | grep -E '8000|8001'
curl -i http://127.0.0.1:8001/health
curl -i http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer $VLLM_API_KEY"
```

4. backend 서버에서 `172.10.5.138:8001/tcp`로 접근 가능하도록 방화벽/보안그룹을 엽니다.
   - backend server -> `172.10.5.138:8001/tcp` 허용
   - 외부 인터넷 전체 공개는 피하기
   - `127.0.0.1:8000` vLLM은 외부 공개 금지

주의: 현재 이 VM의 IP는 `192.168.0.170`이고, `172.10.5.138`은 이 VM에 할당되어 있지 않습니다. 네트워크 담당자는 backend가 실제로 호출해야 할 Qwen Gateway 주소를 확인해야 합니다.

## Backend Verification After Health Opens

Qwen 서버의 `/health`가 backend에서 열리면 backend 담당자는 다음 순서로 검증해 주세요.

```bash
export QWEN_API_TOKEN="<REAL_SHARED_QWEN_INTERNAL_TOKEN>"
backend/scripts/verify-qwen-model.sh
```

실제 이미지 Job이 생기면 placeholder를 실제 값으로 바꾼 뒤 refine 검증을 실행합니다. 임의값으로 성공처럼 처리하지 않습니다.

```bash
export REAL_REQUEST_ID="<REAL_BACKEND_JOB_ID>"
export REAL_USER_ID="<REAL_USER_ID>"
export REAL_USER_PROMPT="<REAL_USER_TYPED_PROMPT>"
export REAL_IMAGE_PATH="<REAL_UPLOADED_IMAGE_PATH>"
backend/scripts/verify-qwen-refine.sh
```

## Requested Action

- Qwen runtime 담당자: 모델/secret/서비스/방화벽 준비 후 위 서버측 명령 결과를 새 message 또는 result로 남겨 주세요.
- Backend 담당자: `/health`가 열렸다는 메시지를 확인한 뒤 `verify-qwen-model.sh`, 실제 Job 발생 후 `verify-qwen-refine.sh`를 실행해 주세요.

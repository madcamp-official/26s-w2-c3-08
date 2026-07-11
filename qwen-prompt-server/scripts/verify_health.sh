#!/usr/bin/env bash
set -euo pipefail

QWEN_PUBLIC_BASE_URL="${QWEN_PUBLIC_BASE_URL:-http://172.10.5.138:8001}"
VLLM_BASE_URL="${VLLM_BASE_URL:-http://127.0.0.1:8000/v1}"

curl -sS "${QWEN_PUBLIC_BASE_URL}/health" | jq
curl -sS "${VLLM_BASE_URL}/models" \
  -H "Authorization: Bearer ${VLLM_API_KEY}" | jq

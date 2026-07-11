#!/usr/bin/env bash
set -euo pipefail

: "${QWEN_API_TOKEN:?QWEN_API_TOKEN must be set to the real shared Qwen internal token}"
QWEN_BASE_URL="${QWEN_BASE_URL:-http://192.168.0.170:8001}"

echo "Checking Qwen model metadata at ${QWEN_BASE_URL}/v1/model"
curl -sS --connect-timeout 5 --max-time 10 -i "${QWEN_BASE_URL}/v1/model" \
  -H "X-Internal-Token: ${QWEN_API_TOKEN}"

#!/usr/bin/env bash
set -euo pipefail

QWEN_BASE_URL="${QWEN_BASE_URL:-http://172.10.5.138:8001}"

echo "Checking Qwen Gateway health at ${QWEN_BASE_URL}/health"
curl -sS --connect-timeout 5 --max-time 10 -i "${QWEN_BASE_URL}/health"

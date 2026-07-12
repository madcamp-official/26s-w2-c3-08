#!/usr/bin/env bash
set -euo pipefail

: "${QWEN_API_TOKEN:?QWEN_API_TOKEN must be set to the real shared internal token}"
: "${REAL_REQUEST_ID:?REAL_REQUEST_ID must be set from a real backend job}"
: "${REAL_USER_ID:?REAL_USER_ID must be set from a real user}"
: "${REAL_USER_PROMPT:?REAL_USER_PROMPT must be the real user prompt}"
: "${REAL_IMAGE_PATH:?REAL_IMAGE_PATH must point to a real PNG/JPEG/WEBP upload}"

QWEN_BASE_URL="${QWEN_BASE_URL:-http://172.10.5.138:8001}"

echo "Calling Qwen prompt refine at ${QWEN_BASE_URL}/v1/prompts/refine"
curl -sS --connect-timeout 5 --max-time 60 -i -X POST "${QWEN_BASE_URL}/v1/prompts/refine" \
  -H "X-Internal-Token: ${QWEN_API_TOKEN}" \
  -F "request_id=${REAL_REQUEST_ID}" \
  -F "user_id=${REAL_USER_ID}" \
  -F "target_type=avatar" \
  -F "user_prompt=${REAL_USER_PROMPT}" \
  -F "locale=ko-KR" \
  -F "style_preset=platformer_sprite" \
  -F "output_language=en" \
  -F "image=@${REAL_IMAGE_PATH}"

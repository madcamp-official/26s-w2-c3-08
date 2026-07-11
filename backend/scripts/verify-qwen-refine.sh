#!/usr/bin/env bash
set -euo pipefail

: "${QWEN_API_TOKEN:?QWEN_API_TOKEN must be set to the real shared internal token}"
: "${REAL_REQUEST_ID:?REAL_REQUEST_ID must be set from a real backend job}"
: "${REAL_USER_ID:?REAL_USER_ID must be set from a real user}"
: "${REAL_USER_PROMPT:?REAL_USER_PROMPT must be the real user prompt}"
: "${REAL_IMAGE_PATH:?REAL_IMAGE_PATH must point to the real uploaded image}"

QWEN_BASE_URL="${QWEN_BASE_URL:-http://172.10.5.138:8001}"
TARGET_TYPE="${TARGET_TYPE:-avatar}"
LOCALE="${LOCALE:-ko-KR}"
STYLE_PRESET="${STYLE_PRESET:-platformer_sprite}"
OUTPUT_LANGUAGE="${OUTPUT_LANGUAGE:-en}"

curl -i -X POST "${QWEN_BASE_URL}/v1/prompts/refine" \
  -H "X-Internal-Token: ${QWEN_API_TOKEN}" \
  -F "request_id=${REAL_REQUEST_ID}" \
  -F "user_id=${REAL_USER_ID}" \
  -F "target_type=${TARGET_TYPE}" \
  -F "user_prompt=${REAL_USER_PROMPT}" \
  -F "locale=${LOCALE}" \
  -F "style_preset=${STYLE_PRESET}" \
  -F "output_language=${OUTPUT_LANGUAGE}" \
  -F "image=@${REAL_IMAGE_PATH}"

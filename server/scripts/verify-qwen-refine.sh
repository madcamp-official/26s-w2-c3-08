#!/usr/bin/env bash
set -euo pipefail

: "${QWEN_API_TOKEN:?QWEN_API_TOKEN must be set to the real shared Qwen internal token}"
: "${REAL_REQUEST_ID:?REAL_REQUEST_ID must be set from a real backend job}"
: "${REAL_USER_ID:?REAL_USER_ID must be set from a real user}"
: "${REAL_TARGET_TYPE:?REAL_TARGET_TYPE must be avatar or asset}"
: "${REAL_USER_PROMPT:?REAL_USER_PROMPT must be the real user prompt}"
: "${REAL_IMAGE_PATH:?REAL_IMAGE_PATH must point to a real PNG/JPEG/WEBP upload}"

if [[ "${REAL_TARGET_TYPE}" != "avatar" && "${REAL_TARGET_TYPE}" != "asset" ]]; then
  echo "REAL_TARGET_TYPE must be avatar or asset" >&2
  exit 2
fi

if [[ ! -f "${REAL_IMAGE_PATH}" ]]; then
  echo "REAL_IMAGE_PATH does not point to an existing file" >&2
  exit 2
fi

QWEN_BASE_URL="${QWEN_BASE_URL:-http://192.168.0.170:8001}"

form_args=(
  -F "request_id=${REAL_REQUEST_ID}"
  -F "user_id=${REAL_USER_ID}"
  -F "target_type=${REAL_TARGET_TYPE}"
  -F "user_prompt=${REAL_USER_PROMPT}"
  -F "locale=ko-KR"
  -F "style_preset=platformer_sprite"
  -F "output_language=en"
  -F "image=@${REAL_IMAGE_PATH}"
)

if [[ "${REAL_TARGET_TYPE}" == "asset" ]]; then
  : "${REAL_ASSET_TYPE:?REAL_ASSET_TYPE is required for asset refine jobs}"
  form_args+=(-F "asset_type=${REAL_ASSET_TYPE}")
fi

echo "Calling Qwen prompt refine at ${QWEN_BASE_URL}/v1/prompts/refine"
curl -sS --connect-timeout 5 --max-time 60 -i -X POST "${QWEN_BASE_URL}/v1/prompts/refine" \
  -H "X-Internal-Token: ${QWEN_API_TOKEN}" \
  "${form_args[@]}"

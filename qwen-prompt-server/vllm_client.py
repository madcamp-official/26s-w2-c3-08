from __future__ import annotations

import json
from typing import Any

import httpx

from config import Settings
from errors import VLLM_TIMEOUT, VLLM_UNAVAILABLE, PromptGatewayError
from prompts import (
    JSON_REPAIR_SYSTEM_PROMPT,
    JSON_REPAIR_USER_TEMPLATE,
    SYSTEM_PROMPT,
    USER_PROMPT_TEMPLATE,
)


class VLLMClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.vllm_base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.settings.vllm_api_key:
            headers["Authorization"] = f"Bearer {self.settings.vllm_api_key}"
        return headers

    async def list_models(self) -> list[str]:
        url = f"{self.base_url}/models"
        timeout = httpx.Timeout(self.settings.qwen_request_timeout_sec)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, headers=self._headers())
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise PromptGatewayError(
                status_code=503,
                code=VLLM_TIMEOUT,
                message="vLLM /models request timed out",
            ) from exc
        except httpx.HTTPError as exc:
            raise PromptGatewayError(
                status_code=503,
                code=VLLM_UNAVAILABLE,
                message=f"vLLM /models request failed: {exc}",
            ) from exc

        payload = response.json()
        return [
            str(item.get("id"))
            for item in payload.get("data", [])
            if isinstance(item, dict) and item.get("id")
        ]

    async def chat_completion(self, messages: list[dict[str, Any]]) -> str:
        url = f"{self.base_url}/chat/completions"
        timeout = httpx.Timeout(self.settings.qwen_request_timeout_sec)
        payload = {
            "model": self.settings.vllm_model_id,
            "messages": messages,
            "temperature": self.settings.qwen_temperature,
            "top_p": self.settings.qwen_top_p,
            "max_tokens": self.settings.qwen_max_new_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload, headers=self._headers())
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise PromptGatewayError(
                status_code=503,
                code=VLLM_TIMEOUT,
                message="vLLM chat completion timed out",
            ) from exc
        except httpx.HTTPError as exc:
            raise PromptGatewayError(
                status_code=503,
                code=VLLM_UNAVAILABLE,
                message=f"vLLM chat completion failed: {exc}",
            ) from exc

        return extract_message_text(response.json())

    async def refine(
        self,
        *,
        request_id: str,
        target_type: str,
        asset_type: str | None,
        locale: str,
        style_preset: str,
        output_language: str,
        user_prompt: str,
        image_data_url: str,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_url},
                    },
                    {
                        "type": "text",
                        "text": USER_PROMPT_TEMPLATE.format(
                            request_id=request_id,
                            target_type=target_type,
                            asset_type=asset_type or "none",
                            locale=locale,
                            style_preset=style_preset,
                            output_language=output_language,
                            user_prompt=user_prompt,
                        ),
                    },
                ],
            },
        ]
        return await self.chat_completion(messages)

    async def repair_json(self, validation_error: str, raw_output: str) -> str:
        messages = [
            {
                "role": "system",
                "content": JSON_REPAIR_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": JSON_REPAIR_USER_TEMPLATE.format(
                    validation_error=validation_error,
                    raw_output=raw_output[:6000],
                ),
            },
        ]
        return await self.chat_completion(messages)


def extract_message_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if not choices or not isinstance(choices, list):
        return ""
    message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
    content = message.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return ""


def extract_json_payload(raw_output: str) -> dict[str, Any]:
    text = raw_output.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("model output does not contain a JSON object")
    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("model output JSON is not an object")
    return parsed

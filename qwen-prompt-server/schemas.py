from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator


TargetType = Literal["avatar", "asset"]

# 한글 음절/자모 — wan_prompt/negative는 영어 강제(이미지 모델이 한국어를 못 알아들음).
# 프롬프트 지시만으론 모델이 가끔 한국어를 섞어 내므로, 여기서 결정론적으로 걸러
# app.py의 repair 경로가 재생성하도록 한다.
_HANGUL = re.compile(r"[가-힣ᄀ-ᇿ㄰-㆏]")


class SpriteRequirements(BaseModel):
    background: Literal["transparent", "simple", "none", "parallax_ready"]
    view: Literal[
        "front_idle",
        "side_view",
        "three_quarter",
        "top_down",
        "single_object",
        "tile",
    ]
    framing: Literal["full_body", "centered_single_asset", "modular_tile", "portrait"]
    style: Literal["2d_platformer_sprite"]
    recommended_size: Literal["512x512"]


class PromptRefineModelOutput(BaseModel):
    ok: Literal[True]
    target_type: TargetType
    visual_summary_ko: str = Field(min_length=1)
    user_intent_ko: str = Field(min_length=1)
    wan_prompt: str = Field(min_length=1, max_length=900)
    wan_negative_prompt: str = Field(min_length=1)
    sprite_requirements: SpriteRequirements
    safety_flags: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("wan_prompt", "wan_negative_prompt")
    @classmethod
    def must_be_english(cls, value: str) -> str:
        if _HANGUL.search(value):
            raise ValueError(
                "wan_prompt and wan_negative_prompt must be English only (no Korean/Hangul)"
            )
        return value

    @field_validator("safety_flags")
    @classmethod
    def safety_flags_are_upper_snake(cls, values: list[str]) -> list[str]:
        for value in values:
            if value != value.upper() or " " in value:
                raise ValueError("safety_flags must use uppercase snake case strings")
        return values


class PromptRefineSuccess(PromptRefineModelOutput):
    request_id: str
    schema_version: str = "1.0"
    model: str
    engine: Literal["vllm"] = "vllm"
    latency_ms: int


class ErrorBody(BaseModel):
    code: str
    message: str


class PromptRefineError(BaseModel):
    ok: Literal[False]
    request_id: str | None
    error: ErrorBody

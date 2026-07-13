from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


TargetType = Literal["avatar", "asset"]


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

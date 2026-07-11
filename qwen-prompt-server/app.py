from __future__ import annotations

import asyncio
import logging
import time
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from config import settings
from errors import (
    GATEWAY_BUSY,
    INTERNAL_ERROR,
    INVALID_REQUEST,
    MODEL_NOT_READY,
    MODEL_OUTPUT_INVALID,
    UNAUTHORIZED,
    PromptGatewayError,
    error_response,
)
from image_utils import (
    image_bytes_to_data_url,
    normalize_image_to_png_bytes,
    validate_image_upload,
)
from logging_config import configure_logging
from schemas import PromptRefineModelOutput, PromptRefineSuccess
from vllm_client import VLLMClient, extract_json_payload


configure_logging()
logger = logging.getLogger("qwen-gateway")

app = FastAPI(title="Qwen2-VL Prompt Gateway", version="1.0")
vllm_client = VLLMClient(settings)
concurrency = asyncio.Semaphore(max(1, settings.qwen_max_concurrency))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return error_response(
        status_code=400,
        code=INVALID_REQUEST,
        message=str(exc),
        request_id=None,
    )


@app.exception_handler(PromptGatewayError)
async def prompt_gateway_exception_handler(
    request: Request, exc: PromptGatewayError
) -> JSONResponse:
    return error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        request_id=exc.request_id,
    )


async def require_internal_token(
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
) -> None:
    if not settings.token_configured:
        raise PromptGatewayError(
            status_code=500,
            code=INTERNAL_ERROR,
            message="QWEN_API_TOKEN is not configured",
        )
    if not x_internal_token or x_internal_token != settings.qwen_api_token:
        raise PromptGatewayError(
            status_code=401,
            code=UNAUTHORIZED,
            message="missing or invalid X-Internal-Token",
        )


async def get_vllm_state() -> tuple[bool, bool, list[str], str | None]:
    try:
        models = await vllm_client.list_models()
    except PromptGatewayError as exc:
        return False, False, [], exc.code
    model_loaded = settings.vllm_model_id in models or settings.qwen_model_id in models
    return True, model_loaded, models, None


@app.get("/health")
async def health() -> dict[str, object]:
    vllm_ok, model_loaded, models, error_code = await get_vllm_state()
    return {
        "ok": bool(vllm_ok and model_loaded),
        "gateway_ok": True,
        "vllm_ok": vllm_ok,
        "model_loaded": model_loaded,
        "engine": "vllm",
        "model": settings.vllm_model_id,
        "available_models": models,
        "model_path": settings.qwen_model_path,
        "model_path_exists": settings.model_path_exists,
        "token_configured": settings.token_configured,
        "vllm_error_code": error_code,
    }


@app.get("/v1/model", dependencies=[Depends(require_internal_token)])
async def model() -> dict[str, object]:
    vllm_ok, model_loaded, models, error_code = await get_vllm_state()
    return {
        "ok": bool(vllm_ok and model_loaded),
        "model_id": settings.vllm_model_id,
        "model_path": settings.qwen_model_path,
        "engine": "vllm",
        "engine_url": settings.vllm_base_url,
        "vllm_ok": vllm_ok,
        "model_loaded": model_loaded,
        "available_models": models,
        "model_path_exists": settings.model_path_exists,
        "vllm_error_code": error_code,
    }


@app.post("/v1/prompts/refine", dependencies=[Depends(require_internal_token)])
async def refine_prompt(
    request_id: Annotated[str, Form()],
    user_id: Annotated[str, Form()],
    target_type: Annotated[str, Form()],
    user_prompt: Annotated[str, Form()],
    image: Annotated[UploadFile, File()],
    locale: Annotated[str, Form()] = "ko-KR",
    style_preset: Annotated[str, Form()] = "platformer_sprite",
    output_language: Annotated[str, Form()] = "en",
    asset_type: Annotated[str | None, Form()] = None,
) -> JSONResponse:
    started = time.perf_counter()
    request_id = request_id.strip()
    user_id = user_id.strip()
    target_type = target_type.strip()
    user_prompt = user_prompt.strip()

    try:
        validate_refine_fields(request_id, user_id, target_type, user_prompt)
        if concurrency.locked():
            return error_response(
                status_code=429,
                code=GATEWAY_BUSY,
                message="gateway is already processing the maximum number of requests",
                request_id=request_id,
            )

        async with concurrency:
            raw_bytes = await validate_image_upload(image, settings.qwen_max_image_mb)
            png_bytes = normalize_image_to_png_bytes(
                raw_bytes, max_side=settings.qwen_max_image_side
            )
            image_data_url = image_bytes_to_data_url(png_bytes)

            vllm_ok, model_loaded, _, error_code = await get_vllm_state()
            if not vllm_ok:
                return error_response(
                    status_code=503,
                    code=error_code or MODEL_NOT_READY,
                    message="vLLM is unavailable",
                    request_id=request_id,
                )
            if not model_loaded:
                return error_response(
                    status_code=503,
                    code=MODEL_NOT_READY,
                    message=f"model {settings.vllm_model_id} is not loaded",
                    request_id=request_id,
                )

            raw_output = await vllm_client.refine(
                request_id=request_id,
                target_type=target_type,
                asset_type=asset_type,
                locale=locale,
                style_preset=style_preset,
                output_language=output_language,
                user_prompt=user_prompt,
                image_data_url=image_data_url,
            )
            model_output = await parse_or_repair_model_output(raw_output, target_type)
            latency_ms = int((time.perf_counter() - started) * 1000)
            success = PromptRefineSuccess(
                **model_output.model_dump(),
                request_id=request_id,
                model=settings.vllm_model_id,
                latency_ms=latency_ms,
            )
            logger.info(
                "refine succeeded request_id=%s user_id=%s target_type=%s latency_ms=%s",
                request_id,
                user_id,
                target_type,
                latency_ms,
            )
            return JSONResponse(status_code=200, content=success.model_dump())
    except PromptGatewayError as exc:
        logger.info(
            "refine failed request_id=%s user_id=%s target_type=%s error_code=%s",
            request_id,
            user_id,
            target_type,
            exc.code,
        )
        return error_response(exc.status_code, exc.code, exc.message, request_id)
    except Exception:
        logger.exception(
            "unexpected refine failure request_id=%s user_id=%s target_type=%s",
            request_id,
            user_id,
            target_type,
        )
        return error_response(
            status_code=500,
            code=INTERNAL_ERROR,
            message="unexpected gateway error",
            request_id=request_id,
        )


def validate_refine_fields(
    request_id: str,
    user_id: str,
    target_type: str,
    user_prompt: str,
) -> None:
    if not request_id:
        raise PromptGatewayError(400, INVALID_REQUEST, "request_id is required")
    if not user_id:
        raise PromptGatewayError(400, INVALID_REQUEST, "user_id is required", request_id)
    if target_type not in {"avatar", "asset"}:
        raise PromptGatewayError(
            400,
            INVALID_REQUEST,
            "target_type must be avatar or asset",
            request_id,
        )
    if not 1 <= len(user_prompt) <= 500:
        raise PromptGatewayError(
            400,
            INVALID_REQUEST,
            "user_prompt must be 1 to 500 characters",
            request_id,
        )


async def parse_or_repair_model_output(
    raw_output: str, expected_target_type: str
) -> PromptRefineModelOutput:
    try:
        return validate_model_output(raw_output, expected_target_type)
    except (ValueError, ValidationError) as first_error:
        repaired_output = await vllm_client.repair_json(str(first_error), raw_output)
        try:
            return validate_model_output(repaired_output, expected_target_type)
        except (ValueError, ValidationError) as repair_error:
            raise PromptGatewayError(
                status_code=422,
                code=MODEL_OUTPUT_INVALID,
                message=f"model output failed validation after repair: {repair_error}",
            ) from repair_error


def validate_model_output(
    raw_output: str, expected_target_type: str
) -> PromptRefineModelOutput:
    payload = extract_json_payload(raw_output)
    output = PromptRefineModelOutput.model_validate(payload)
    if output.target_type != expected_target_type:
        raise ValueError(
            f"target_type mismatch: expected {expected_target_type}, got {output.target_type}"
        )
    return output

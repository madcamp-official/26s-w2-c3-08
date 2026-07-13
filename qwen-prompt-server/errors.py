from __future__ import annotations

from dataclasses import dataclass

from fastapi.responses import JSONResponse

from schemas import PromptRefineError


UNAUTHORIZED = "UNAUTHORIZED"
INVALID_REQUEST = "INVALID_REQUEST"
INVALID_IMAGE_TYPE = "INVALID_IMAGE_TYPE"
IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"
VLLM_UNAVAILABLE = "VLLM_UNAVAILABLE"
VLLM_TIMEOUT = "VLLM_TIMEOUT"
MODEL_NOT_READY = "MODEL_NOT_READY"
MODEL_OUTPUT_INVALID = "MODEL_OUTPUT_INVALID"
INTERNAL_ERROR = "INTERNAL_ERROR"
GATEWAY_BUSY = "GATEWAY_BUSY"


@dataclass
class PromptGatewayError(Exception):
    status_code: int
    code: str
    message: str
    request_id: str | None = None


def error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: str | None = None,
) -> JSONResponse:
    body = PromptRefineError(
        ok=False,
        request_id=request_id,
        error={"code": code, "message": message},
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())

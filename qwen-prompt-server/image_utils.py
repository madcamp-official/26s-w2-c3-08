from __future__ import annotations

import base64
from io import BytesIO

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from errors import IMAGE_TOO_LARGE, INVALID_IMAGE_TYPE, PromptGatewayError


ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
}
ALLOWED_PIL_FORMATS = {"PNG", "JPEG", "WEBP"}


async def validate_image_upload(upload_file: UploadFile, max_mb: int) -> bytes:
    if upload_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise PromptGatewayError(
            status_code=400,
            code=INVALID_IMAGE_TYPE,
            message="image must be PNG, JPEG, or WEBP",
        )

    raw_bytes = await upload_file.read()
    max_bytes = max_mb * 1024 * 1024
    if len(raw_bytes) > max_bytes:
        raise PromptGatewayError(
            status_code=413,
            code=IMAGE_TOO_LARGE,
            message=f"image must be {max_mb}MB or smaller",
        )
    if not raw_bytes:
        raise PromptGatewayError(
            status_code=400,
            code=INVALID_IMAGE_TYPE,
            message="image file is empty",
        )

    try:
        with Image.open(BytesIO(raw_bytes)) as image:
            if image.format not in ALLOWED_PIL_FORMATS:
                raise PromptGatewayError(
                    status_code=400,
                    code=INVALID_IMAGE_TYPE,
                    message="image content is not PNG, JPEG, or WEBP",
                )
    except UnidentifiedImageError as exc:
        raise PromptGatewayError(
            status_code=400,
            code=INVALID_IMAGE_TYPE,
            message="image content could not be decoded",
        ) from exc

    return raw_bytes


def normalize_image_to_png_bytes(raw_bytes: bytes, max_side: int = 1024) -> bytes:
    try:
        with Image.open(BytesIO(raw_bytes)) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode in {"RGBA", "LA"} or (
                image.mode == "P" and "transparency" in image.info
            ):
                image = image.convert("RGBA")
            else:
                image = image.convert("RGB")

            image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="PNG", optimize=True)
            return output.getvalue()
    except UnidentifiedImageError as exc:
        raise PromptGatewayError(
            status_code=400,
            code=INVALID_IMAGE_TYPE,
            message="image content could not be decoded",
        ) from exc


def image_bytes_to_data_url(png_bytes: bytes) -> str:
    encoded = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"

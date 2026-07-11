from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    qwen_server_host: str = Field(default="0.0.0.0", alias="QWEN_SERVER_HOST")
    qwen_server_port: int = Field(default=8001, alias="QWEN_SERVER_PORT")
    qwen_api_token: str = Field(default="", alias="QWEN_API_TOKEN")

    qwen_model_path: str = Field(
        default="/models/Qwen2-VL-7B-Instruct", alias="QWEN_MODEL_PATH"
    )
    qwen_model_id: str = Field(default="qwen2-vl-7b-instruct", alias="QWEN_MODEL_ID")
    qwen_max_image_mb: int = Field(default=8, alias="QWEN_MAX_IMAGE_MB")
    qwen_max_image_side: int = Field(default=1024, alias="QWEN_MAX_IMAGE_SIDE")
    qwen_max_new_tokens: int = Field(default=900, alias="QWEN_MAX_NEW_TOKENS")
    qwen_temperature: float = Field(default=0.2, alias="QWEN_TEMPERATURE")
    qwen_top_p: float = Field(default=0.9, alias="QWEN_TOP_P")
    qwen_request_timeout_sec: float = Field(
        default=45.0, alias="QWEN_REQUEST_TIMEOUT_SEC"
    )
    qwen_max_concurrency: int = Field(default=1, alias="QWEN_MAX_CONCURRENCY")

    vllm_base_url: str = Field(default="http://127.0.0.1:8000/v1", alias="VLLM_BASE_URL")
    vllm_model_path: str = Field(
        default="/models/Qwen2-VL-7B-Instruct", alias="VLLM_MODEL_PATH"
    )
    vllm_model_id: str = Field(default="qwen2-vl-7b-instruct", alias="VLLM_MODEL_ID")
    vllm_api_key: str = Field(default="", alias="VLLM_API_KEY")
    vllm_max_model_len: int = Field(default=4096, alias="VLLM_MAX_MODEL_LEN")
    vllm_gpu_memory_utilization: float = Field(
        default=0.86, alias="VLLM_GPU_MEMORY_UTILIZATION"
    )
    vllm_limit_mm_per_prompt: str = Field(
        default='{"image":1}', alias="VLLM_LIMIT_MM_PER_PROMPT"
    )

    @property
    def model_path_exists(self) -> bool:
        return Path(self.qwen_model_path).exists()

    @property
    def token_configured(self) -> bool:
        return bool(self.qwen_api_token and not self.qwen_api_token.startswith("<REAL_"))

    @property
    def vllm_api_key_configured(self) -> bool:
        return bool(self.vllm_api_key and not self.vllm_api_key.startswith("<REAL_"))


settings = Settings()

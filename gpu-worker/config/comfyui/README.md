# ComfyUI 워크플로우 (외부 편집)

이 폴더의 `*.json`은 **ComfyUI API 포맷** 워크플로우다. 코드를 안 건드리고 여기 JSON만 바꾸면 생성 그래프가 바뀐다.

## 수정하는 법

1. ComfyUI UI에서 그래프를 원하는 대로 짜거나 고친다.
2. 아래 표의 노드들에 **정확한 제목(`_meta.title`)** 을 단다 (노드 우클릭 → Title).
3. **Save (API Format)** 로 내보내 이 파일을 덮어쓴다.

노드 **id는 바뀌어도 된다** — 코드는 id가 아니라 **제목**으로 주입 지점을 찾는다. 제목만 유지하면 재export해도 안 깨진다.

## 코드가 값을 주입하는 노드 (제목 = 계약)

| 제목 | 노드 | 주입되는 값 |
|---|---|---|
| `INPUT_IMAGE` | LoadImage | `image` = 업로드된 start_image 파일명 |
| `POSITIVE_PROMPT` | CLIPTextEncode | `text` = LLM이 준 wan_prompt |
| `NEGATIVE_PROMPT` | CLIPTextEncode | `text` = wan_negative_prompt |
| `VIDEO_SIZE` | WanImageToVideo | `width` `height` `length` (해상도·프레임수) |
| `SAMPLER_HIGH` | KSamplerAdvanced | `noise_seed` `steps` `cfg` |
| `SAMPLER_LOW` | KSamplerAdvanced | `noise_seed` `steps` `cfg` |
| `UNET_HIGH` / `UNET_LOW` | UnetLoaderGGUF | `unet_name` (config/pipeline.json의 모델 파일명) |
| `LORA_HIGH` / `LORA_LOW` | LoraLoaderModelOnly | `lora_name` |
| `OUTPUT` | SaveImage | (프레임 추출 대상 — 제목만 있으면 됨) |

제목이 있는데 위 표에 없는 값(shift, sampler_name 등)은 **JSON에 적힌 값이 그대로 쓰인다** → 여기서 튜닝하면 된다.

## 주의

- `width`/`height`는 16의 배수여야 한다(Wan2.2 VAE). 코드가 그렇게 유도하지만 수동 편집 시 유의.
- 모델/LoRA/VAE 파일명은 실제 `C:\dev\ComfyUI\models\...`에 있는 것과 일치해야 한다.

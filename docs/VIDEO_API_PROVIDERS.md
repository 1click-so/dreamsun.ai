# Video API Providers Reference

Covers all video generation API providers, their endpoints, param shapes, and how our system routes between them.

Last updated: 2026-03-11

---

## Provider Overview

| Provider | Models | Auth | Status |
|----------|--------|------|--------|
| **fal.ai** | LTX 2.3, Seedance, LightX Relight, (Kling - disabled) | API key via `FAL_KEY` | Active |
| **Kie.ai** | Kling 2.6, Kling 3.0, Kling MC 2.6, Kling MC 3.0 | API key via `KIE_API_KEY` | Active |

### How Routing Works

1. `getApiProvider(modelId, { resolution, audioTier })` queries `model_pricing` table
2. Returns whichever provider has `is_active = true` for that model+resolution+audio combo
3. Only ONE provider should be active per model tier (never both)
4. `animate-shot/route.ts` branches into fal path or kie path based on result

---

## Kie.ai API

**Base URL:** `https://api.kie.ai`
**Auth:** `Authorization: Bearer <KIE_API_KEY>`
**Client:** `src/lib/kie-ai.ts`

### Endpoints

| Action | Method | URL |
|--------|--------|-----|
| Create task | POST | `/api/v1/jobs/createTask` |
| Poll status | GET | `/api/v1/jobs/recordInfo?taskId=xxx` |

### Create Task - Request Body

```json
{
  "model": "kling-3.0/video",
  "input": { ... },
  "callBackUrl": "optional webhook"
}
```

### Create Task - Response

```json
{
  "code": 200,
  "data": { "taskId": "xxx" }
}
```

### Poll - Response

```json
{
  "code": 200,
  "data": {
    "taskId": "xxx",
    "model": "kling-3.0/video",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://...\"]}",
    "failCode": null,
    "failMsg": null,
    "costTime": 12345,
    "completeTime": 1234567890,
    "createTime": 1234567890
  }
}
```

**States:** `waiting` -> `queuing` -> `generating` -> `success` | `fail`

### Model Names (our ID -> Kie model)

| Our model_id | Kie model name |
|-------------|----------------|
| `kling-2-6` | `kling-2.6/video` |
| `kling-3` | `kling-3.0/video` |
| `kling-2-6-mc` | `kling-2.6/motion-control` |
| `kling-3-mc` | `kling-3.0/motion-control` |

### Input Params - Image-to-Video (kling-2.6/video, kling-3.0/video)

```json
{
  "prompt": "description",
  "duration": "5",
  "sound": true,
  "mode": "pro",
  "image_urls": ["https://start-frame.jpg", "https://end-frame.jpg"],
  "aspect_ratio": "16:9",
  "negative_prompt": "blur",
  "multi_shots": false,
  "multi_prompt": [],
  "camera_fixed": false,
  "kling_elements": [
    { "name": "element_0", "element_input_urls": ["https://ref.jpg"] }
  ]
}
```

| Param | Type | Notes |
|-------|------|-------|
| `prompt` | string | Required |
| `duration` | string | "3" to "15" |
| `sound` | boolean | true = with audio |
| `mode` | string | "std" = 720p, "pro" = 1080p |
| `image_urls` | string[] | [start_frame, end_frame?] |
| `aspect_ratio` | string | "16:9", "9:16", "1:1" |
| `negative_prompt` | string | Optional |
| `multi_shots` | boolean | Multi-shot storyboarding |
| `multi_prompt` | array | Per-shot prompts when multi_shots=true |
| `camera_fixed` | boolean | Lock camera |
| `kling_elements` | array | Character consistency references |

### Input Params - Motion Control (kling-2.6/motion-control, kling-3.0/motion-control)

> **WARNING (2026-03-11):** These param names need verification. The motion control
> API may use different field names than image-to-video. Currently untested.
> Known differences from fal.ai:
> - May use `input_urls` instead of `image_urls` for source images
> - May use `video_urls` (plural array) instead of `video_url` (singular string) for reference video
>
> **Current code uses:** `image_urls` + `video_url` (same as video gen)
> **Kie docs suggest:** `input_urls` + `video_urls` (different for MC)
>
> TEST BEFORE RELYING ON THIS IN PRODUCTION.

```json
{
  "prompt": "description",
  "mode": "pro",
  "image_urls": ["https://source-image.jpg"],
  "video_url": "https://reference-video.mp4",
  "negative_prompt": "blur",
  "camera_fixed": false
}
```

**If Kie MC uses different params, the correct shape would be:**

```json
{
  "prompt": "description",
  "mode": "pro",
  "input_urls": ["https://source-image.jpg"],
  "video_urls": ["https://reference-video.mp4"],
  "negative_prompt": "blur"
}
```

---

## fal.ai API

**Base URL:** Handled by `@fal-ai/client` SDK
**Auth:** `FAL_KEY` env var, configured via `fal.config({ credentials })`
**Queue pattern:** `fal.queue.submit()` -> `fal.queue.status()` -> `fal.queue.result()`

### Endpoints (active models only)

| Model | Endpoint |
|-------|----------|
| LTX 2.3 | `fal-ai/ltx-2.3/image-to-video` |
| LTX 2.3 Fast | `fal-ai/ltx-2.3/image-to-video/fast` |
| LTX 2.3 Audio | `fal-ai/ltx-2.3/audio-to-video` |
| Seedance 1.5 Pro | `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` |
| LightX Relight | `fal-ai/lightx/relight` |

### Disabled fal.ai Endpoints (Kling - switched to Kie)

| Model | Endpoint | Why Disabled |
|-------|----------|-------------|
| Kling 2.6 | `fal-ai/kling-video/v2.6/pro/image-to-video` | Switched to Kie (cheaper) |
| Kling 3.0 Pro | `fal-ai/kling-video/v3/pro/image-to-video` | Switched to Kie (cheaper) |
| Kling 3.0 Std | `fal-ai/kling-video/v3/standard/image-to-video` | Switched to Kie (cheaper) |
| Kling 2.6 MC Pro | `fal-ai/kling-video/v2.6/pro/motion-control` | Switched to Kie (cheaper) |
| Kling 2.6 MC Std | `fal-ai/kling-video/v2.6/standard/motion-control` | Switched to Kie (cheaper) |
| Kling 3.0 MC Pro | `fal-ai/kling-video/v3/pro/motion-control` | Switched to Kie (cheaper) |
| Kling 3.0 MC Std | `fal-ai/kling-video/v3/standard/motion-control` | Switched to Kie (cheaper) |

### fal.ai Param Mapping (per video-models.ts)

Each model in `video-models.ts` defines a `params` object that maps our generic names to fal's API param names:

| Our param | Kling fal param | LTX param | Seedance param |
|-----------|----------------|-----------|----------------|
| imageUrl | `start_image_url` | `image_url` | `image_url` |
| endImageUrl | `end_image_url` | `end_image_url` | `end_image_url` |
| prompt | `prompt` | `prompt` | `prompt` |
| duration | `duration` | `duration` | `duration` |
| aspectRatio | `aspect_ratio` | `aspect_ratio` | `aspect_ratio` |
| resolution | - | `resolution` | `resolution` |
| audioUrl | - | `audio_url` (LTX audio) | - |
| videoUrl | `video_url` (MC) | - | - |

### fal.ai vs Kie.ai - Key Differences

| Aspect | fal.ai | Kie.ai |
|--------|--------|--------|
| **SDK** | `@fal-ai/client` with queue | Raw `fetch()` calls |
| **Submit** | `fal.queue.submit(endpoint, { input })` | `POST /api/v1/jobs/createTask` with `{ model, input }` |
| **Poll** | `fal.queue.status(endpoint, { requestId })` | `GET /api/v1/jobs/recordInfo?taskId=xxx` |
| **Result** | `fal.queue.result(endpoint, { requestId })` -> `data.video.url` | Poll response includes `resultJson` with `resultUrls[]` |
| **Duration param** | number (e.g. `5`) | string (e.g. `"5"`) |
| **Audio param** | `generate_audio: false` to disable | `sound: true/false` |
| **Resolution** | Separate endpoints (standard vs pro) | `mode: "std"/"pro"` in input |
| **Image input** | `start_image_url` (string) | `image_urls` (array of strings) |
| **End frame** | `end_image_url` (string) | Second element in `image_urls` array |
| **Ref video (MC)** | `video_url` (string) | `video_url` (string) - NEEDS VERIFICATION |
| **Elements** | `elements: [{ frontal_image_url }]` | `kling_elements: [{ name, element_input_urls }]` |
| **Status values** | `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED` | `waiting`, `queuing`, `generating`, `success`, `fail` |

---

## Pricing (model_pricing table)

### Active Kie.ai Rows (2026-03-11)

| model_id | resolution | audio | api_cost_usd/s | credits/s |
|----------|-----------|-------|---------------|-----------|
| kling-2-6 | 1080p | off | $0.055 | 8 |
| kling-2-6 | 1080p | on | $0.110 | 14 |
| kling-2-6-mc | 1080p | - | $0.045 | 11 |
| kling-2-6-mc | 720p | - | $0.030 | 11 |
| kling-3 | 1080p | off | $0.135 | 19 |
| kling-3 | 1080p | on | $0.200 | 25 |
| kling-3 | 720p | off | $0.100 | 15 |
| kling-3 | 720p | on | $0.150 | 20 |
| kling-3-mc | 1080p | - | $0.100 | 16 |
| kling-3-mc | 720p | - | $0.060 | 12 |

### Active fal.ai Rows

| model_id | resolution | audio | api_cost_usd/s | credits/s |
|----------|-----------|-------|---------------|-----------|
| lightx-relight | - | - | $0.100 | 12 |
| ltx-2-3 | 1080p | - | $0.060 | 9 |
| ltx-2-3 | 1440p | - | $0.120 | 15 |
| ltx-2-3 | 2160p | - | $0.240 | 26 |
| ltx-2-3-fast | 1080p | - | $0.040 | 7 |
| ltx-2-3-fast | 1440p | - | $0.080 | 19 |
| ltx-2-3-fast | 2160p | - | $0.160 | 22 |
| seedance-1-5-pro | 480p | off | $0.012 | 3 |
| seedance-1-5-pro | 480p | on | $0.023 | 4 |
| seedance-1-5-pro | 720p | off | $0.026 | 5 |
| seedance-1-5-pro | 720p | on | $0.052 | 8 |
| seedance-1-5-pro | 1080p | off | $0.058 | 8 |
| seedance-1-5-pro | 1080p | on | $0.117 | 14 |

### Missing from Pricing Table

| model_id | Notes |
|----------|-------|
| `ltx-2-3-audio` | Exists in `video-models.ts` but has NO pricing rows. Users won't be charged. |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/kie-ai.ts` | Kie.ai client - createTask, getTaskStatus, pollUntilDone, parseResultUrls |
| `src/lib/video-models.ts` | All video model configs - endpoints, params, capabilities |
| `src/lib/credits.ts` | calculateCost, getApiProvider - reads model_pricing table |
| `src/app/api/animate-shot/route.ts` | Submit endpoint - branches fal vs kie, builds input params |
| `src/app/api/generation-poll/route.ts` | Poll endpoint - checks fal/kie status, uploads to storage |

---

## Known Issues / TODOs

1. **Kie MC param names unverified** - Motion control via Kie may need `input_urls`/`video_urls` instead of `image_urls`/`video_url`. Must test before first real MC generation via Kie.
2. **ltx-2-3-audio missing pricing** - Model exists in code but has no model_pricing rows.
3. **Kling 2.6 no 720p rows for Kie** - Only 1080p rows exist. If user selects 720p on Kling 2.6, `getApiProvider` falls back to any active row (gets kie 1080p). The generation will work but pricing may be off.
4. **Voice tier deleted** - Removed 2026-03-11. We don't offer voice generation.

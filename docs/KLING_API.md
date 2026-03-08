# Kling AI — Direct API Reference

> Extracted from official docs at `app.klingai.com/global/dev/document-api` on 2026-03-08.
> For use when bypassing fal.ai to avoid markup on Kling V3 image-to-video.

---

## Base URL

```
https://api-singapore.klingai.com
```

For servers outside China. Previously `https://api.klingai.com` (deprecated).

---

## Authentication (JWT)

Every request requires a JWT token signed with your AccessKey + SecretKey.

**Step 1:** Get `AccessKey` and `SecretKey` from Kling developer dashboard.

**Step 2:** Generate JWT token:

```typescript
import jwt from "jsonwebtoken";

function createKlingToken(accessKey: string, secretKey: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800, // 30 min validity
    nbf: Math.floor(Date.now() / 1000) - 5,     // valid 5s ago
  };
  return jwt.sign(payload, secretKey, { header });
}
```

**Step 3:** Send as header:

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Env vars needed:**
```
KLING_ACCESS_KEY=...
KLING_SECRET_KEY=...
```

---

## Image-to-Video

### Create Task

```
POST /v1/videos/image2video
```

**Request Body:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `model_name` | string | No | `kling-v1` | Model version. Values: `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1`, `kling-v2-1-master`, `kling-v2-5-turbo`, `kling-v2-6`, `kling-v3` |
| `image` | string | No* | — | Start frame. URL or raw base64 (no `data:` prefix). JPG/JPEG/PNG, max 10MB, min 300px, ratio 1:2.5–2.5:1 |
| `image_tail` | string | No | — | End frame (last frame control). Same format as `image`. Mutually exclusive with `dynamic_masks`, `static_mask`, `camera_control` |
| `prompt` | string | No* | — | Positive text prompt. Max 2500 chars. Required when `multi_shot` is false |
| `negative_prompt` | string | No | — | Negative prompt. Max 2500 chars |
| `duration` | string | No | `"5"` | Duration in seconds. Values: `"3"` to `"15"` (model-dependent) |
| `mode` | string | No | `"std"` | `"std"` = Standard (720p, cheaper), `"pro"` = Professional (1080p, higher quality) |
| `sound` | string | No | `"off"` | Audio generation. `"on"` / `"off"`. V2.6+ only |
| `cfg_scale` | float | No | `0.5` | Prompt adherence. Range [0, 1]. **Not supported on v2.x models** |
| `element_list` | array | No | — | Character consistency elements (up to 3). Format: `[{ "element_id": 123 }]` |
| `multi_shot` | bool | No | `false` | Enable multi-shot storyboarding. When true, `prompt` is ignored |
| `shot_type` | string | No | — | `"customize"` or `"intelligence"`. Required when `multi_shot` is true |
| `multi_prompt` | array | No | — | Per-shot config. Up to 6 shots. Format: `[{ "index": 1, "prompt": "...", "duration": "5" }]`. Required when `multi_shot=true` + `shot_type="customize"` |
| `voice_list` | array | No | — | Voice IDs for dialogue (up to 2). Format: `[{ "voice_id": "..." }]`. Requires `sound: "on"`. Mutually exclusive with `element_list` |
| `camera_control` | object | No | — | Camera movement. See Camera Control section below. Mutually exclusive with `image_tail` |
| `static_mask` | string | No | — | Static brush mask (motion brush feature) |
| `dynamic_masks` | array | No | — | Dynamic brush masks with trajectories (up to 6 groups) |
| `watermark_info` | object | No | — | `{ "enabled": true }` to generate watermarked result |
| `callback_url` | string | No | — | Webhook URL for status changes |
| `external_task_id` | string | No | — | Custom task ID (must be unique per account) |

\* At least one of `image` or `image_tail` must be provided.

**Response (200):**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "task_status": "submitted",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

### Query Task

```
GET /v1/videos/image2video/{task_id}
```

Poll until `task_status` is `succeed` or `failed`.

**Response (200):**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "succeed",
    "task_status_msg": "string",
    "task_result": {
      "videos": [
        {
          "id": "string",
          "url": "string",
          "watermark_url": "string",
          "duration": "string"
        }
      ]
    },
    "task_info": {
      "external_task_id": "string"
    },
    "final_unit_deduction": "string",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

**Task statuses:** `submitted` → `processing` → `succeed` / `failed`

**Note:** Generated videos are cleared after 30 days. Download promptly.

### Query Task List

```
GET /v1/videos/image2video?pageNum=1&pageSize=30
```

`pageNum`: 1–1000. `pageSize`: 1–500.

---

## Camera Control

Used via `camera_control` param. Mutually exclusive with `image_tail`.

**Preset types:**

| Type | Description |
|------|-------------|
| `simple` | Simple movement — requires `config` object |
| `down_back` | Camera descends + moves backward |
| `forward_up` | Camera moves forward + tilts up |
| `right_turn_forward` | Rotate right then advance |
| `left_turn_forward` | Rotate left then advance |

**Simple config** (choose one non-zero, rest must be 0):

| Param | Range | Description |
|-------|-------|-------------|
| `horizontal` | [-10, 10] | Camera X translation. Negative=left, Positive=right |
| `vertical` | [-10, 10] | Camera Y translation. Negative=down, Positive=up |
| `pan` | [-10, 10] | Y-axis rotation. Negative=left, Positive=right |
| `tilt` | [-10, 10] | X-axis rotation. Negative=down, Positive=up |
| `roll` | [-10, 10] | Z-axis rotation. Negative=CCW, Positive=CW |
| `zoom` | [-10, 10] | Focal length. Negative=narrow FOV, Positive=wide FOV |

---

## Multi-Shot Storyboarding

Enable with `multi_shot: true`. Up to 6 shots, total duration = sum of shot durations.

```json
{
  "model_name": "kling-v3",
  "image": "https://...",
  "multi_shot": true,
  "shot_type": "customize",
  "multi_prompt": [
    { "index": 1, "prompt": "Scene 1 description", "duration": "3" },
    { "index": 2, "prompt": "Scene 2 description", "duration": "4" },
    { "index": 3, "prompt": "Scene 3 description", "duration": "3" }
  ],
  "duration": "10",
  "mode": "pro",
  "sound": "on"
}
```

---

## Elements (Character Consistency)

Reference elements from Element Library for character/subject consistency.

```json
{
  "element_list": [
    { "element_id": 160 },
    { "element_id": 161 }
  ]
}
```

- Up to 3 elements per request
- Two types: Video Character Elements, Multi-Image Elements (different use cases)
- Use `<<<element_1>>>` syntax in prompt to reference
- Mutually exclusive with `voice_list`
- Element IDs obtained via the Element API (`/v1/elements`)

---

## Voice Control

Add dialogue to generated videos using voice IDs.

```json
{
  "prompt": "<<<voice_1>>>The man says: 'Welcome everyone'",
  "voice_list": [
    { "voice_id": "voice_id_1" }
  ],
  "sound": "on"
}
```

- Up to 2 voices per task
- Use `<<<voice_1>>>`, `<<<voice_2>>>` in prompt
- Requires `sound: "on"`
- Voice IDs from Custom Voices API (not Lip-Sync API)
- Mutually exclusive with `element_list`

---

## Other Endpoints (Available)

| Capability | Endpoint |
|------------|----------|
| Text to Video | `POST /v1/videos/text2video` |
| Motion Control | `POST /v1/videos/motion-control` (assumed, see docs) |
| Multi-Image to Video | See docs |
| Video Extension | See docs |
| Image Generation | `POST /v1/images/generations` |
| Lip-Sync | See docs |
| Avatar | See docs |
| TTS | See docs |
| Video to Audio | See docs |
| Virtual Try-On | See docs |
| Video Effects | See docs |

---

## Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 200 | 0 | Success |
| 401 | 1000–1004 | Auth failed (empty, invalid, not yet valid, expired) |
| 429 | 1100–1102 | Account issue (exception, arrears, resource pack depleted) |
| 403 | 1103 | Unauthorized access to resource |
| 400 | 1200–1201 | Invalid request params |
| 404 | 1202–1203 | Invalid method / resource not found |
| 400 | 1300–1301 | Platform policy / content security triggered |
| 429 | 1302–1304 | Rate limit / concurrency limit / IP whitelist |
| 500 | 5000 | Server error |
| 503 | 5001 | Server maintenance |
| 504 | 5002 | Server timeout |

---

## Pricing Comparison (fal.ai vs Direct)

Researched 2026-03-08. fal.ai markup over Kling direct pricing:

| Model | fal.ai Markup |
|-------|---------------|
| V3 Pro image-to-video | 1.78x – 2.25x |
| V2.6 Pro image-to-video | ~1.0x (at parity) |
| V2.6 Pro motion control | ~1.0x (at parity) |

**Verdict:** Direct integration saves ~50% on V3 generation costs. Worth it for V3; not necessary for V2.6.

---

## Implementation Notes

When implementing direct Kling integration:

1. **Provider abstraction** — Add `kling-direct.ts` alongside fal.ai
2. **JWT caching** — Token valid 30 min, cache and regenerate with 5-min buffer
3. **Polling** — No streaming. Poll `GET /v1/videos/image2video/{task_id}` every 5-10s
4. **Mode mapping** — Our `resolution: "720p"` → Kling `mode: "std"`, `resolution: "1080p"` → `mode: "pro"`
5. **Param mapping** — Our `imageUrl` → `image`, `endImageUrl` → `image_tail`, `generateAudio` → `sound`
6. **Timeout** — Video generation can take 2-5 minutes. Set polling timeout ~10 min
7. **Download** — Videos cleared after 30 days. Download and store immediately

---

*Last updated: 2026-03-08*

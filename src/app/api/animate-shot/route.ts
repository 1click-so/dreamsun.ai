import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getVideoModelById, resolveVideoEndpoint } from "@/lib/video-models";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, deductCredits, refundCredits, tryAutoTopup, getApiProvider } from "@/lib/credits";
import { getKieModelId, kieCreateTask } from "@/lib/kie-ai";
import { getWebhookBaseUrl } from "@/lib/generation-completion";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let userId = "";
  let cost = 0;
  let creditModelId = "";
  let generationId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const body = await req.json();
    const {
      videoModelId,
      prompt,
      imageUrl,
      endImageUrl,
      audioUrl,
      videoUrl,
      characterOrientation,
      keepOriginalSound,
      duration,
      aspectRatio,
      resolution,
      cameraFixed,
      generateAudio,
      multiShot,
      shotType,
      multiPrompt,
      elements: elementUrls,
      batchId,
      // Relight-specific
      relightVideoUrl,
      relightCondType,
      relightPrompt,
      relightDirection,
      relightCfg,
      relightCondImgUrl,
    } = body;

    if (!videoModelId) {
      return NextResponse.json(
        { error: "videoModelId is required" },
        { status: 400 }
      );
    }

    // Relight requires video, all others require image
    const isRelight = videoModelId === "lightx-relight";
    if (!isRelight && !imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }
    if (isRelight && !relightVideoUrl) {
      return NextResponse.json(
        { error: "relightVideoUrl is required for relight" },
        { status: 400 }
      );
    }

    const model = getVideoModelById(videoModelId);
    if (!model) {
      return NextResponse.json(
        { error: "Unknown video model" },
        { status: 400 }
      );
    }

    // Calculate cost
    const effectiveDuration = duration || model.defaultDuration;
    creditModelId = videoModelId;
    const audioTier = generateAudio === false ? "off" : "on";
    cost = await calculateCost(videoModelId, { duration: effectiveDuration, resolution: resolution || undefined, audioTier });

    // Build reference URLs early (needed for generation row)
    const refUrls: string[] = [];
    if (isRelight) {
      if (relightVideoUrl) refUrls.push(relightVideoUrl);
      if (relightCondImgUrl) refUrls.push(relightCondImgUrl);
    } else {
      if (imageUrl) refUrls.push(imageUrl);
      if (endImageUrl) refUrls.push(endImageUrl);
      if (videoUrl) refUrls.push(videoUrl);
    }

    // Insert PENDING generation row first (to get generationId for credit linking)
    const { data: genRow, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: "video",
        url: null,
        prompt: prompt || null,
        negative_prompt: body.negativePrompt || null,
        model_id: videoModelId,
        model_name: model.name,
        seed: null,
        request_id: null,
        width: null,
        height: null,
        duration: duration || null,
        aspect_ratio: aspectRatio || null,
        resolution: resolution || null,
        settings: { modelId: videoModelId, mode: isRelight ? "relight" : videoUrl ? "motion" : "create" },
        source_image_url: isRelight ? relightVideoUrl : (imageUrl || null),
        reference_image_urls: refUrls.length > 0 ? refUrls : null,
        batch_id: batchId || null,
        favorited: false,
        cost_estimate: cost || null,
      })
      .select("id")
      .single();

    if (genError) {
      console.error("[animate-shot] DB insert error:", genError);
    }
    generationId = genRow?.id ?? null;

    // Deduct credits (linked to generation row)
    if (cost > 0) {
      const deduction = await deductCredits(user.id, cost, { generationId: generationId ?? undefined, modelId: videoModelId, description: `Video: ${model.name} (${effectiveDuration}s)` });
      if (!deduction.success) {
        // Clean up the generation row
        if (generationId) {
          await supabase.from("generations").delete().eq("id", generationId);
          generationId = null;
        }
        return NextResponse.json(
          { error: "Insufficient credits", required: deduction.required ?? cost, available: deduction.available ?? 0 },
          { status: 402 }
        );
      }
      tryAutoTopup(user.id).catch(() => {});
    }

    // Build input using model's param mapping
    const input: Record<string, unknown> = {};

    if (isRelight) {
      // Relight — completely different input shape
      input.video_url = relightVideoUrl;
      if (prompt) input.prompt = prompt;
      input.relit_cond_type = relightCondType || "ic";

      if (relightCondType === "ic" || !relightCondType) {
        // Intrinsic conditioning — text-based relighting
        input.relight_parameters = {
          relight_prompt: relightPrompt || "Sunlight",
          bg_source: relightDirection || "Left",
          cfg: relightCfg ?? 2,
        };
      } else if (relightCondImgUrl) {
        // ref / hdr / bg — use a conditioning image
        input.relit_cond_img_url = relightCondImgUrl;
      }

      if (body.seed != null) input.seed = body.seed;
    } else {
      input[model.params.imageUrl] = imageUrl;
      input[model.params.prompt] = prompt || "";
    }

    // Standard (non-relight) input params
    if (!isRelight) {
      // Duration — only for models that have it (not motion control)
      if (model.params.duration) {
        const durationVal = duration || model.defaultDuration;
        input[model.params.duration] = typeof durationVal === "number" ? durationVal : Number(durationVal);
      }

      // Audio URL for audio-to-video models
      if (audioUrl && model.params.audioUrl) {
        input[model.params.audioUrl] = audioUrl;
      }

      // End image (last frame) for image-to-video
      if (endImageUrl && model.params.endImageUrl) {
        input[model.params.endImageUrl] = endImageUrl;
      }

      // Reference video for motion control
      if (videoUrl && model.params.videoUrl) {
        input[model.params.videoUrl] = videoUrl;
      }

      // Character orientation for motion control
      if (characterOrientation && model.params.characterOrientation) {
        input[model.params.characterOrientation] = characterOrientation;
      }

      // Keep original sound for motion control
      if (keepOriginalSound !== undefined && model.supportsKeepOriginalSound) {
        input.keep_original_sound = keepOriginalSound;
      }

      if (aspectRatio && model.params.aspectRatio) {
        input[model.params.aspectRatio] = aspectRatio;
      }

      if (resolution && model.params.resolution) {
        input[model.params.resolution] = resolution;
      }

      if (cameraFixed === true && model.supportsCameraFixed) {
        input.camera_fixed = true;
      }

      if (generateAudio === false && model.supportsGenerateAudio) {
        input.generate_audio = false;
      }

      // Add any extra input params the model requires (negative_prompt, cfg_scale, etc.)
      if (model.extraInput) {
        Object.assign(input, model.extraInput);
      }

      // Override with user-provided values
      if (body.negativePrompt && model.supportsNegativePrompt) {
        input.negative_prompt = body.negativePrompt;
      }
      if (body.cfgScale != null && model.supportsCfgScale) {
        input.cfg_scale = body.cfgScale;
      }

      // Multi-shot storyboarding
      if (multiShot && multiPrompt && Array.isArray(multiPrompt)) {
        input.multi_prompt = multiPrompt;
        input.shot_type = shotType || "customize";
      }

      // Elements (character consistency)
      if (elementUrls && Array.isArray(elementUrls) && elementUrls.length > 0) {
        input.elements = elementUrls.map((url: string) => ({
          frontal_image_url: url,
        }));
      }
    }

    // Determine API provider (audioTier already declared above)
    let activeProvider = await getApiProvider(videoModelId, { resolution: resolution || undefined, audioTier });

    let requestId: string;
    let endpoint: string;
    let usedProvider = activeProvider;

    // Helper: submit to fal.ai
    const submitToFal = async () => {
      const falEndpoint = resolveVideoEndpoint(model, resolution);
      const webhookBase = getWebhookBaseUrl();
      const falWebhookUrl = webhookBase ? `${webhookBase.trim()}/api/webhooks/fal-completion` : undefined;
      console.log(`[animate-shot] endpoint=${falEndpoint} input=`, JSON.stringify(input, null, 2));
      const { request_id: falRequestId } = await fal.queue.submit(falEndpoint, {
        input,
        webhookUrl: falWebhookUrl,
      });
      console.log(`[animate-shot] Queued on fal.ai: request_id=${falRequestId}, webhook=${falWebhookUrl || "none"}`);
      return { requestId: falRequestId, endpoint: falEndpoint };
    };

    if (activeProvider === "kie") {
      // ── Kie.ai path (with fal.ai fallback) ────────────────────
      const kieModel = getKieModelId(videoModelId);
      const kieInput: Record<string, unknown> = {
        prompt: prompt || "",
        duration: String(duration || model.defaultDuration),
        sound: generateAudio !== false,
        multi_shots: !!multiShot,
      };

      // mode: std=720p, pro=1080p
      kieInput.mode = resolution === "720p" ? "std" : "pro";

      // image_urls: [start, end?]
      const kieImageUrls: string[] = [imageUrl];
      if (endImageUrl) kieImageUrls.push(endImageUrl);
      kieInput.image_urls = kieImageUrls;

      if (aspectRatio) kieInput.aspect_ratio = aspectRatio;

      // Motion control - reference video
      if (videoUrl) {
        kieInput.video_url = videoUrl;
      }

      // Camera fixed
      if (cameraFixed === true && model.supportsCameraFixed) {
        kieInput.camera_fixed = true;
      }

      // Negative prompt
      if (body.negativePrompt && model.supportsNegativePrompt) {
        kieInput.negative_prompt = body.negativePrompt;
      }

      // Multi-shot prompts
      if (multiShot && multiPrompt && Array.isArray(multiPrompt)) {
        kieInput.multi_prompt = multiPrompt;
      }

      // Elements (character consistency) - NOT supported by Kie.ai, skip silently
      // kling_elements causes instant 500 "internal error" on Kie.ai

      try {
        const webhookBase = getWebhookBaseUrl();
        const kieCallbackUrl = webhookBase ? `${webhookBase.trim()}/api/webhooks/kie-completion` : undefined;
        const taskId = await kieCreateTask(kieModel, kieInput, kieCallbackUrl);
        requestId = taskId;
        endpoint = kieModel;
        usedProvider = "kie";
        console.log(`[animate-shot] Queued on Kie.ai: taskId=${taskId}, webhook=${kieCallbackUrl || "none"}`);
      } catch (kieError) {
        // Kie.ai failed - fall back to fal.ai transparently
        console.warn(`[animate-shot] Kie.ai submit failed, falling back to fal.ai:`, kieError);
        const falResult = await submitToFal();
        requestId = falResult.requestId;
        endpoint = falResult.endpoint;
        usedProvider = "fal";
      }
    } else {
      // ── fal.ai path (default) ────────────────────────────────
      const falResult = await submitToFal();
      requestId = falResult.requestId;
      endpoint = falResult.endpoint;
      usedProvider = "fal";
    }

    // Update generation row with request_id and final settings
    const settings: Record<string, unknown> = {
      modelId: videoModelId,
      mode: isRelight ? "relight" : videoUrl ? "motion" : "create",
      apiProvider: usedProvider,
      falEndpoint: endpoint,
      falRequestId: requestId,
    };
    if (isRelight) {
      Object.assign(settings, { relightCondType, relightPrompt, relightDirection, relightCfg });
    } else if (!videoUrl) {
      Object.assign(settings, { aspectRatio, resolution, duration, cameraFixed, generateAudio });
    } else {
      Object.assign(settings, { charOrientation: characterOrientation, keepOriginalSound });
    }

    if (generationId) {
      await supabase
        .from("generations")
        .update({ request_id: requestId, settings })
        .eq("id", generationId);
    }

    console.log(`[animate-shot] Pending generation saved: id=${generationId}`);

    // Return immediately — client will poll /api/generation-poll
    return NextResponse.json({
      generationId,
      falRequestId: requestId,
      model: model.name,
      creditsUsed: cost,
      status: "processing",
    });
  } catch (error: unknown) {
    // Clean up orphaned generation row (created before queue submission)
    if (generationId && userId) {
      try {
        const supabase = await createClient();
        await supabase.from("generations").delete().eq("id", generationId);
      } catch { /* cleanup best-effort */ }
    }
    // Refund credits on failure
    if (cost > 0 && userId) {
      await refundCredits(userId, cost, { generationId: generationId ?? undefined, modelId: creditModelId }).catch(() => {});
    }
    console.error("Animation error:", error);

    let message = "Animation failed";
    let status = 500;

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      if (err.status && typeof err.status === "number") status = err.status;
      if (err.body && typeof err.body === "object") {
        const body = err.body as Record<string, unknown>;
        if (typeof body.detail === "string") {
          message = body.detail;
        } else if (Array.isArray(body.detail)) {
          message = body.detail
            .map((e: Record<string, unknown>) => e.msg || JSON.stringify(e))
            .join("; ");
        } else if (typeof body.message === "string") {
          message = body.message;
        }
      } else if (err.message && typeof err.message === "string") {
        message = err.message;
      }
    }

    return NextResponse.json({ error: message }, { status });
  }
}

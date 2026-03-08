import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getVideoModelById, resolveVideoEndpoint } from "@/lib/video-models";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, deductCredits, refundCredits, tryAutoTopup } from "@/lib/credits";

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
    } = body;

    if (!videoModelId || !imageUrl) {
      return NextResponse.json(
        { error: "videoModelId and imageUrl are required" },
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

    // Credit deduction — duration-based for video, with resolution + audio tier
    const effectiveDuration = duration || model.defaultDuration;
    creditModelId = videoModelId;
    const audioTier = generateAudio === false ? "off" : "on";
    cost = await calculateCost(videoModelId, { duration: effectiveDuration, resolution: resolution || undefined, audioTier });
    if (cost > 0) {
      const deduction = await deductCredits(user.id, cost, { modelId: videoModelId, description: `Video: ${model.name} (${effectiveDuration}s)` });
      if (!deduction.success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: deduction.required ?? cost, available: deduction.available ?? 0 },
          { status: 402 }
        );
      }
      tryAutoTopup(user.id).catch(() => {});
    }

    // Build input using model's param mapping
    const input: Record<string, unknown> = {
      [model.params.imageUrl]: imageUrl,
      [model.params.prompt]: prompt || "",
    };

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

    // Resolve endpoint — for Kling, 720p→Standard, 1080p→Pro
    const endpoint = resolveVideoEndpoint(model, resolution);

    console.log(`[animate-shot] endpoint=${endpoint} input=`, JSON.stringify(input, null, 2));

    // Submit to fal.ai QUEUE (returns immediately with request_id)
    const { request_id: falRequestId } = await fal.queue.submit(endpoint, {
      input,
    });

    console.log(`[animate-shot] Queued on fal.ai: request_id=${falRequestId}`);

    // Build settings/reference data
    const refUrls: string[] = [];
    if (imageUrl) refUrls.push(imageUrl);
    if (endImageUrl) refUrls.push(endImageUrl);
    if (videoUrl) refUrls.push(videoUrl);

    const settings: Record<string, unknown> = {
      modelId: videoModelId,
      mode: videoUrl ? "motion" : "create",
      falEndpoint: endpoint,
      falRequestId,
    };
    if (!videoUrl) {
      Object.assign(settings, { aspectRatio, resolution, duration, cameraFixed, generateAudio });
    } else {
      Object.assign(settings, { charOrientation: characterOrientation, keepOriginalSound });
    }

    // Save PENDING generation to Supabase immediately (url = null = still processing)
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
        request_id: falRequestId,
        width: null,
        height: null,
        duration: duration || null,
        aspect_ratio: aspectRatio || null,
        resolution: resolution || null,
        settings,
        source_image_url: imageUrl || null,
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

    console.log(`[animate-shot] Pending generation saved: id=${generationId}`);

    // Return immediately — client will poll /api/generation-poll
    return NextResponse.json({
      generationId,
      falRequestId,
      model: model.name,
      creditsUsed: cost,
      status: "processing",
    });
  } catch (error: unknown) {
    // Refund credits on failure (only if we haven't submitted to fal queue)
    if (cost > 0 && userId && !generationId) {
      await refundCredits(userId, cost, { modelId: creditModelId }).catch(() => {});
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

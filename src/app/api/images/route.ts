import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelById } from "@/lib/models";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, deductCredits, refundCredits, tryAutoTopup, getApiProvider } from "@/lib/credits";
import { getKieModelId, kieCreateTask } from "@/lib/kie-ai";
import { getWebhookBaseUrl } from "@/lib/generation-completion";
import { sanitizeError, isRateLimitError } from "@/lib/error-sanitizer";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let userId = "";
  let cost = 0;
  let creditModelId = "";
  let generationId: string | null = null;
  let usedApiProvider = "fal";

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const body = await req.json();
    const { modelId, prompt, aspectRatio, referenceImageUrls, negativePrompt, safetyChecker, numImages, imageResolution } = body;

    if (!prompt || !modelId) {
      return NextResponse.json(
        { error: "prompt and modelId are required" },
        { status: 400 }
      );
    }

    const model = getModelById(modelId);
    if (!model) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    // Calculate cost and determine provider before creating generation row
    const effectiveNumImages = typeof numImages === "number" && numImages >= 1 && numImages <= 4 ? numImages : 1;
    creditModelId = modelId;
    cost = await calculateCost(modelId, { numImages: effectiveNumImages, resolution: imageResolution as string | undefined });
    const apiProvider = await getApiProvider(modelId, { resolution: imageResolution as string | undefined });
    usedApiProvider = apiProvider;

    // Build reference URLs
    const refUrls = referenceImageUrls && Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0
      ? referenceImageUrls
      : null;

    // Insert PENDING generation row first (to get generationId for credit linking)
    const { data: genRow, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type: "image",
        url: null,
        prompt: prompt || null,
        negative_prompt: negativePrompt || null,
        model_id: modelId,
        model_name: model.name,
        seed: null,
        request_id: null,
        width: null,
        height: null,
        aspect_ratio: aspectRatio || null,
        resolution: imageResolution || null,
        settings: { modelId, apiProvider, aspectRatio, resolution: imageResolution, numImages: effectiveNumImages, safetyChecker },
        reference_image_urls: refUrls,
        batch_id: body.batchId || null,
        favorited: false,
        cost_estimate: cost || null,
      })
      .select("id")
      .single();

    if (genError) {
      console.error("[api/images] DB insert error:", genError);
    }
    generationId = genRow?.id ?? null;

    // Deduct credits (linked to generation row)
    if (cost > 0) {
      const deduction = await deductCredits(user.id, cost, { generationId: generationId ?? undefined, modelId, description: `Image: ${model.name}` });
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

    // Build input based on model capability
    const input: Record<string, unknown> = {
      prompt,
    };

    // Always send aspect ratio in the model's preferred format
    if (aspectRatio) {
      if (model.sizeParam) {
        input[model.sizeParam.name] =
          model.sizeParam.mapping[aspectRatio] || aspectRatio;
      } else {
        input.aspect_ratio = aspectRatio;
      }
    }

    // Additionally, send explicit pixel dimensions for resolution control
    const resMultiplier: Record<string, number> = { "1k": 1024, "2k": 2048, "4k": 4096 };
    const longSide = resMultiplier[imageResolution as string];

    if (longSide && aspectRatio && !model.sizeParam) {
      const [w, h] = (aspectRatio as string).split(":").map(Number);
      const ratio = w / h;
      const width = ratio >= 1 ? longSide : Math.round(longSide * ratio);
      const height = ratio >= 1 ? Math.round(longSide / ratio) : longSide;
      input.image_size = { width, height };
    }

    // Add reference images using the model's specific parameter name
    if (
      referenceImageUrls &&
      Array.isArray(referenceImageUrls) &&
      referenceImageUrls.length > 0 &&
      model.referenceImage
    ) {
      const { paramName, isArray } = model.referenceImage;
      if (isArray) {
        input[paramName] = referenceImageUrls;
      } else {
        input[paramName] = referenceImageUrls[0];
      }
    }

    // Add negative prompt if model supports it
    if (negativePrompt && model.supportsNegativePrompt) {
      input.negative_prompt = negativePrompt;
    }

    // Add LoRA weights if model has them
    if (model.loras && model.loras.length > 0) {
      input.loras = model.loras;
    }

    // Add any extra input params the model requires
    if (model.extraInput) {
      Object.assign(input, model.extraInput);
    }

    let requestId: string;
    let endpoint: string;

    if (apiProvider === "kie") {
      // ── Kie.ai path - submit and return immediately ────────────
      const kieInput: Record<string, unknown> = { prompt };

      if (aspectRatio) kieInput.aspect_ratio = aspectRatio;

      // Kie.ai uses "1K", "2K", "4K" (uppercase)
      if (imageResolution) {
        kieInput.resolution = (imageResolution as string).toUpperCase();
      }

      kieInput.output_format = "png";

      // Reference images for edit mode
      if (referenceImageUrls && Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0) {
        kieInput.image_input = referenceImageUrls;
      }

      if (negativePrompt && model.supportsNegativePrompt) {
        kieInput.negative_prompt = negativePrompt;
      }

      const kieModel = getKieModelId(modelId);
      const webhookBase = getWebhookBaseUrl();
      const kieCallbackUrl = webhookBase ? `${webhookBase}/api/webhooks/kie-completion` : undefined;
      const taskId = await kieCreateTask(kieModel, kieInput, kieCallbackUrl);
      requestId = taskId;
      endpoint = kieModel;

      console.log(`[api/images] Queued image on Kie.ai: taskId=${taskId}, webhook=${kieCallbackUrl || "none"}`);
    } else {
      // ── fal.ai path - queue submit instead of subscribe ────────
      input.enable_safety_checker = safetyChecker === true;

      if (model.supportsOutputFormat !== false) {
        input.output_format = "png";
      }
      input.num_images = effectiveNumImages;

      endpoint = model.endpoint;

      const webhookBase = getWebhookBaseUrl();
      const falWebhookUrl = webhookBase ? `${webhookBase}/api/webhooks/fal-completion` : undefined;

      console.log(`[api/images] endpoint=${endpoint} input=`, JSON.stringify(input, null, 2));

      const { request_id: falRequestId } = await fal.queue.submit(endpoint, {
        input,
        webhookUrl: falWebhookUrl,
      });
      requestId = falRequestId;

      console.log(`[api/images] Queued image on fal.ai: request_id=${falRequestId}, webhook=${falWebhookUrl || "none"}`);
    }

    // Update generation row with request_id and final settings
    const settings: Record<string, unknown> = {
      modelId,
      apiProvider,
      falEndpoint: endpoint,
      falRequestId: requestId,
      aspectRatio,
      resolution: imageResolution,
      numImages: effectiveNumImages,
      safetyChecker,
    };

    if (generationId) {
      await supabase
        .from("generations")
        .update({ request_id: requestId, settings })
        .eq("id", generationId);
    }

    console.log(`[api/images] Pending image generation saved: id=${generationId}`);

    // Return immediately - client will poll /api/generation-poll
    return NextResponse.json({
      generationId,
      requestId,
      model: model.name,
      creditsUsed: cost,
      status: "processing",
    });
  } catch (error: unknown) {
    // Rate limit / concurrency error - queue for retry instead of failing
    if (isRateLimitError(error) && generationId && userId) {
      console.log(`[api/images] Rate limited - queuing generation ${generationId} for retry`);
      try {
        const supabase = await createClient();
        const rateLimitedModel = getModelById(creditModelId);
        await supabase.from("generations").update({
          settings: {
            modelId: creditModelId,
            apiProvider: usedApiProvider,
            falEndpoint: rateLimitedModel?.endpoint,
            queued: true,
            queuedAt: new Date().toISOString(),
            retryCount: 0,
          },
        }).eq("id", generationId);
      } catch { /* best effort */ }
      return NextResponse.json({
        generationId,
        status: "queued",
        message: "Our servers are busy. Your generation has been queued and will start automatically.",
      });
    }

    // Non-rate-limit error - clean up and refund
    if (generationId && userId) {
      try {
        const supabase = await createClient();
        await supabase.from("generations").delete().eq("id", generationId);
      } catch { /* cleanup best-effort */ }
    }
    if (cost > 0 && userId) {
      await refundCredits(userId, cost, { generationId: generationId ?? undefined, modelId: creditModelId }).catch(() => {});
    }
    console.error("Generation error (raw):", error);

    const sanitized = sanitizeError(error, "Generation failed");
    return NextResponse.json(
      { error: sanitized.message, category: sanitized.category, retryable: sanitized.retryable },
      { status: sanitized.status },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@supabase/supabase-js";
import { kieParseResultUrls } from "@/lib/kie-ai";
import { completeGeneration, failGeneration, getWebhookBaseUrl } from "@/lib/generation-completion";
import { getVideoModelById, resolveVideoEndpoint } from "@/lib/video-models";

fal.config({
  credentials: process.env.FAL_KEY,
});

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Try to re-submit a failed Kie.ai generation to fal.ai.
 * Returns true if fallback was submitted, false if it couldn't be done.
 */
async function fallbackToFal(generationId: string): Promise<boolean> {
  try {
    const supabase = getAdminClient();
    const { data: gen } = await supabase
      .from("generations")
      .select("id, model_id, prompt, negative_prompt, source_image_url, reference_image_urls, settings, request_id")
      .eq("id", generationId)
      .single();

    if (!gen) return false;

    const model = getVideoModelById(gen.model_id);
    if (!model) return false;

    const s = (gen.settings as Record<string, unknown>) || {};
    const res = s.resolution as string | undefined;
    const falEndpoint = resolveVideoEndpoint(model, res);

    // Rebuild fal.ai input from stored generation data
    const falInput: Record<string, unknown> = {};
    falInput[model.params.imageUrl] = gen.source_image_url;
    falInput[model.params.prompt] = gen.prompt || "";

    if (model.params.duration && s.duration) {
      falInput[model.params.duration] = Number(s.duration);
    }
    if (s.aspectRatio && model.params.aspectRatio) {
      falInput[model.params.aspectRatio] = s.aspectRatio;
    }
    if (res && model.params.resolution) {
      falInput[model.params.resolution] = res;
    }
    if (s.generateAudio === false && model.supportsGenerateAudio) {
      falInput.generate_audio = false;
    }
    if (s.cameraFixed === true && model.supportsCameraFixed) {
      falInput.camera_fixed = true;
    }
    if (gen.negative_prompt && model.supportsNegativePrompt) {
      falInput.negative_prompt = gen.negative_prompt;
    }
    if (model.extraInput) {
      Object.assign(falInput, model.extraInput);
    }

    // End image (second reference URL)
    const refs = gen.reference_image_urls as string[] | null;
    if (refs && refs.length > 1 && model.params.endImageUrl) {
      falInput[model.params.endImageUrl] = refs[1];
    }

    // Motion control - reference video
    if (s.mode === "motion" && refs && model.params.videoUrl) {
      const videoRef = refs.find((u: string) => u !== gen.source_image_url);
      if (videoRef) falInput[model.params.videoUrl] = videoRef;
    }

    // Elements (character consistency) - fal.ai format
    const storedElements = s.elementUrls as string[] | undefined;
    if (storedElements && Array.isArray(storedElements) && storedElements.length > 0) {
      falInput.elements = storedElements.map((url: string) => ({
        frontal_image_url: url,
      }));
    }

    const webhookBase = getWebhookBaseUrl();
    const falWebhookUrl = webhookBase ? `${webhookBase.trim()}/api/webhooks/fal-completion` : undefined;

    const { request_id: newRequestId } = await fal.queue.submit(falEndpoint, {
      input: falInput,
      webhookUrl: falWebhookUrl,
    });

    // Update DB row to point to fal.ai
    await supabase.from("generations").update({
      url: null,
      request_id: newRequestId,
      settings: {
        ...s,
        apiProvider: "fal",
        falEndpoint,
        falRequestId: newRequestId,
        kieFallback: true,
        kieOriginalRequestId: gen.request_id,
      },
    }).eq("id", generationId);

    console.log(`[kie-webhook] Fallback to fal.ai: ${generationId} -> request_id=${newRequestId}`);
    return true;
  } catch (err) {
    console.error("[kie-webhook] fal.ai fallback failed:", err);
    return false;
  }
}

/**
 * Kie.ai callback handler.
 * Called when a Kie.ai task reaches a terminal state (success or fail).
 * On failure, transparently falls back to fal.ai before marking as failed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Kie callback format - try multiple locations for the data
    const data = body.data || body;
    const taskId = data.taskId || body.taskId;
    const state = data.state || body.state;
    const resultJson = data.resultJson || body.resultJson;
    const failMsg = data.failMsg || body.failMsg;

    if (!taskId) {
      console.error("[kie-webhook] Missing taskId in payload:", JSON.stringify(body).slice(0, 500));
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    console.log(`[kie-webhook] Received: taskId=${taskId}, state=${state}`);

    // Look up generation by request_id (= taskId for Kie)
    const supabase = getAdminClient();
    const { data: gen } = await supabase
      .from("generations")
      .select("id, url")
      .eq("request_id", taskId)
      .single();

    if (!gen) {
      console.error(`[kie-webhook] No generation found for taskId=${taskId}`);
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Already handled (idempotent)
    if (gen.url && gen.url !== "error") {
      return NextResponse.json({ received: true, already_handled: true });
    }

    if (state === "success") {
      const urls = kieParseResultUrls(resultJson);
      const resultUrl = urls[0] || null;

      if (resultUrl) {
        await completeGeneration(gen.id, resultUrl, taskId);
        console.log(`[kie-webhook] Completed generation ${gen.id}`);
      } else {
        console.error("[kie-webhook] No URLs in resultJson:", resultJson);
        await failGeneration(gen.id, "No video URL in webhook payload");
      }
    } else if (state === "fail") {
      // Try fal.ai fallback before marking as failed
      console.log(`[kie-webhook] Kie.ai task failed: ${failMsg}. Attempting fal.ai fallback...`);
      const fellBack = await fallbackToFal(gen.id);
      if (!fellBack) {
        // Fallback also failed - now truly mark as failed
        await failGeneration(gen.id, failMsg || "Generation failed");
        console.log(`[kie-webhook] Both providers failed for ${gen.id}: ${failMsg}`);
      }
    } else {
      // Intermediate state (waiting, queuing, generating)
      console.log(`[kie-webhook] Intermediate state "${state}" for taskId=${taskId}, ignoring`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[kie-webhook] Error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

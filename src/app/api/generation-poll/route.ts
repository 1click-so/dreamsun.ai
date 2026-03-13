import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase-server";
import { refundCredits } from "@/lib/credits";
import { kieGetTaskStatus, kieParseResultUrls } from "@/lib/kie-ai";
import { getVideoModelById, resolveVideoEndpoint } from "@/lib/video-models";
import { getWebhookBaseUrl } from "@/lib/generation-completion";
import { sanitizeErrorMessage } from "@/lib/error-sanitizer";

fal.config({
  credentials: process.env.FAL_KEY,
});

/**
 * Poll for pending generation status.
 * Client sends generationId, we check fal.ai queue status.
 * When complete: fetch result, upload to Supabase storage, update DB row.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const generationId = req.nextUrl.searchParams.get("id");
    if (!generationId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Load generation from DB (includes fields needed for fal.ai fallback)
    const { data: gen, error: genError } = await supabase
      .from("generations")
      .select("id, type, url, request_id, settings, user_id, model_id, cost_estimate, prompt, negative_prompt, source_image_url, source_audio_url, reference_image_urls, aspect_ratio, resolution, num_images, duration, created_at")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (genError || !gen) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Already completed
    if (gen.url && gen.url !== "error") {
      return NextResponse.json({
        status: "completed",
        generationId: gen.id,
        url: gen.url,
      });
    }

    // Already marked as failed
    if (gen.url === "error") {
      const settings = gen.settings as Record<string, unknown> | null;
      const rawError = (settings?.error_message as string) || "Generation failed";
      return NextResponse.json({
        status: "failed",
        generationId: gen.id,
        error: sanitizeErrorMessage(rawError),
        refunded: !!settings?.refunded,
      });
    }

    const settings = gen.settings as Record<string, unknown> | null;
    const apiProvider = (settings?.apiProvider as string) || "fal";
    const falEndpoint = settings?.falEndpoint as string | undefined;
    const requestId = gen.request_id || (settings?.falRequestId as string | undefined);

    // Queued generation - attempt to submit to provider
    if (settings?.queued && !requestId) {
      const retryCount = (settings.retryCount as number) || 0;
      const queuedAt = settings.queuedAt as string | undefined;
      const maxRetries = 30; // ~2.5 minutes of client polling at 5s intervals
      const maxAge = 10 * 60 * 1000; // 10 minutes max queue time

      // Check if too old or too many retries
      if (retryCount >= maxRetries || (queuedAt && Date.now() - new Date(queuedAt).getTime() > maxAge)) {
        if (gen.cost_estimate && gen.cost_estimate > 0) {
          await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
        }
        await supabase.from("generations").update({
          url: "error",
          settings: { ...settings, queued: false, error_message: "Generation timed out in queue", refunded: true },
        }).eq("id", gen.id);
        return NextResponse.json({ status: "failed", generationId: gen.id, error: "Generation timed out. Your credits have been refunded.", refunded: true });
      }

      // Try to submit now
      const endpoint = falEndpoint || (settings.falEndpoint as string);
      if (!endpoint) {
        return NextResponse.json({ status: "queued", generationId: gen.id, queueStatus: "QUEUED", retryCount });
      }

      try {
        // Rebuild input from what we stored in the generation row
        const input: Record<string, unknown> = {};
        if (gen.prompt) input.prompt = gen.prompt;
        if (gen.negative_prompt) input.negative_prompt = gen.negative_prompt;
        if (gen.aspect_ratio) input.aspect_ratio = gen.aspect_ratio;
        if (gen.reference_image_urls) {
          const refs = gen.reference_image_urls as string[];
          if (refs.length > 0) input.image_url = refs[0];
        }
        if (gen.type === "image") {
          input.enable_safety_checker = true;
          input.output_format = "png";
          input.num_images = gen.num_images || 1;
          if (gen.resolution) {
            const resMultiplier: Record<string, number> = { "1k": 1024, "2k": 2048, "4k": 4096 };
            const longSide = resMultiplier[gen.resolution];
            if (longSide && gen.aspect_ratio) {
              const [w, h] = gen.aspect_ratio.split(":").map(Number);
              const ratio = w / h;
              input.image_size = {
                width: ratio >= 1 ? longSide : Math.round(longSide * ratio),
                height: ratio >= 1 ? Math.round(longSide / ratio) : longSide,
              };
            }
          }
        } else if (gen.type === "video") {
          if (gen.source_image_url) input.image_url = gen.source_image_url;
          if (gen.duration) input.duration = gen.duration;
        }

        const webhookBase = getWebhookBaseUrl();
        const webhookUrl = webhookBase ? `${webhookBase}/api/webhooks/fal-completion` : undefined;

        const { request_id: newRequestId } = await fal.queue.submit(endpoint, { input, webhookUrl });

        // Success - update generation with request_id and clear queued flag
        await supabase.from("generations").update({
          request_id: newRequestId,
          settings: { ...settings, queued: false, falRequestId: newRequestId, retriedAt: new Date().toISOString() },
        }).eq("id", gen.id);

        console.log(`[generation-poll] Queued generation ${gen.id} submitted successfully: ${newRequestId}`);
        return NextResponse.json({ status: "processing", generationId: gen.id, queueStatus: "IN_QUEUE" });
      } catch (retryErr) {
        // Still rate limited - increment retry count and tell client to keep polling
        console.log(`[generation-poll] Queue retry ${retryCount + 1} failed for ${gen.id}:`, retryErr);
        await supabase.from("generations").update({
          settings: { ...settings, retryCount: retryCount + 1 },
        }).eq("id", gen.id);
        return NextResponse.json({ status: "queued", generationId: gen.id, queueStatus: "QUEUED", retryCount: retryCount + 1 });
      }
    }

    if (!requestId) {
      return NextResponse.json({ error: "Generation is being prepared. Please wait." }, { status: 400 });
    }

    // ── Helper: fall back to fal.ai when Kie.ai fails ─────────
    const fallbackToFal = async (): Promise<boolean> => {
      try {
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

        console.log(`[generation-poll] Kie.ai failed for ${gen.id}, falling back to fal.ai: endpoint=${falEndpoint}`);

        const { request_id: newRequestId } = await fal.queue.submit(falEndpoint, {
          input: falInput,
          webhookUrl: falWebhookUrl,
        });

        // Update DB row to point to fal.ai
        await supabase.from("generations").update({
          request_id: newRequestId,
          settings: {
            ...s,
            apiProvider: "fal",
            falEndpoint,
            falRequestId: newRequestId,
            kieFallback: true,
            kieOriginalRequestId: gen.request_id,
          },
        }).eq("id", gen.id);

        console.log(`[generation-poll] Fallback submitted: ${gen.id} -> fal request_id=${newRequestId}`);
        return true;
      } catch (err) {
        console.error("[generation-poll] fal.ai fallback failed:", err);
        return false;
      }
    };

    // ── Kie.ai polling ─────────────────────────────────────────
    if (apiProvider === "kie") {
      let kieResult;
      try {
        kieResult = await kieGetTaskStatus(requestId);
      } catch (kieErr) {
        // Kie.ai API error (network, auth, etc.) - try fallback
        console.warn("[generation-poll] Kie.ai status check failed:", kieErr);
        if (await fallbackToFal()) {
          return NextResponse.json({ status: "processing", generationId: gen.id, queueStatus: "IN_QUEUE" });
        }
        // Fallback also failed
        return NextResponse.json({ error: "Provider unavailable" }, { status: 502 });
      }

      if (kieResult.state === "waiting" || kieResult.state === "queuing" || kieResult.state === "generating") {
        // Check for stuck tasks (waiting > 10 minutes = likely stuck)
        const ageMs = Date.now() - new Date(gen.created_at).getTime();
        if (kieResult.state === "waiting" && ageMs > 10 * 60 * 1000) {
          console.warn(`[generation-poll] Kie.ai task ${requestId} stuck in "waiting" for ${Math.round(ageMs / 60000)}min, falling back to fal.ai`);
          if (await fallbackToFal()) {
            return NextResponse.json({ status: "processing", generationId: gen.id, queueStatus: "IN_QUEUE" });
          }
        }

        return NextResponse.json({
          status: "processing",
          generationId: gen.id,
          queueStatus: kieResult.state,
        });
      }

      if (kieResult.state === "success") {
        const urls = kieParseResultUrls(kieResult.resultJson);
        const resultUrl = urls[0] || null;

        if (!resultUrl) {
          if (gen.cost_estimate && gen.cost_estimate > 0) {
            await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
          }
          const errorMsg = "No content generated";
          await supabase.from("generations").update({
            url: "error",
            settings: { ...(gen.settings as Record<string, unknown> || {}), error_message: errorMsg, refunded: true },
          }).eq("id", gen.id);
          return NextResponse.json({ status: "failed", generationId: gen.id, error: errorMsg, refunded: true });
        }

        // Upload to Supabase storage (detect type from generation row)
        const isImage = gen.type === "image";
        let permanentUrl = resultUrl;
        let fileSize: number | null = null;
        try {
          const fileRes = await fetch(resultUrl);
          if (fileRes.ok) {
            const buffer = Buffer.from(await fileRes.arrayBuffer());
            fileSize = buffer.length;
            const contentType = fileRes.headers.get("content-type") || (isImage ? "image/png" : "video/mp4");
            const ext = isImage ? (contentType.includes("jpeg") ? "jpg" : "png") : "mp4";
            const folder = isImage ? "images" : "videos";
            const storagePath = `${folder}/${requestId}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("generations")
              .upload(storagePath, buffer, { contentType, upsert: true });
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage.from("generations").getPublicUrl(storagePath);
              permanentUrl = urlData.publicUrl;
            }
          }
        } catch (copyErr) {
          console.error("[generation-poll] Storage copy failed:", copyErr);
        }

        await supabase.from("generations").update({ url: permanentUrl, file_size: fileSize, request_id: requestId }).eq("id", gen.id);
        console.log(`[generation-poll] Completed generation ${gen.id} (kie): ${permanentUrl}`);

        return NextResponse.json({ status: "completed", generationId: gen.id, url: permanentUrl, requestId });
      }

      // Kie.ai task failed - try fal.ai fallback before giving up
      if (await fallbackToFal()) {
        return NextResponse.json({ status: "processing", generationId: gen.id, queueStatus: "IN_QUEUE" });
      }

      // Both providers failed - refund and mark as error
      if (gen.cost_estimate && gen.cost_estimate > 0) {
        await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
      }
      const rawErrorMsg = kieResult.failMsg || "Generation failed";
      await supabase.from("generations").update({
        url: "error",
        settings: { ...(gen.settings as Record<string, unknown> || {}), error_message: rawErrorMsg, refunded: true },
      }).eq("id", gen.id);
      return NextResponse.json({ status: "failed", generationId: gen.id, error: sanitizeErrorMessage(rawErrorMsg), refunded: true });
    }

    // ── fal.ai polling (default) ───────────────────────────────
    if (!falEndpoint) {
      return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 400 });
    }

    const queueStatus = await fal.queue.status(falEndpoint, {
      requestId,
      logs: false,
    });

    const statusStr = queueStatus.status;

    if (statusStr === "IN_QUEUE" || statusStr === "IN_PROGRESS") {
      return NextResponse.json({
        status: "processing",
        generationId: gen.id,
        queueStatus: statusStr,
      });
    }

    if (statusStr === "COMPLETED") {
      const result = await fal.queue.result(falEndpoint, {
        requestId,
      });

      const data = result.data as Record<string, unknown>;

      // Extract result URL - check for video first, then images
      let resultUrl: string | null = null;
      let resultWidth: number | null = null;
      let resultHeight: number | null = null;

      if (data.video && typeof data.video === "object") {
        const video = data.video as Record<string, unknown>;
        resultUrl = video.url as string;
      } else if (typeof data.video_url === "string") {
        resultUrl = data.video_url;
      } else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        // Image result
        const img = data.images[0] as Record<string, unknown>;
        resultUrl = img.url as string;
        resultWidth = (img.width as number) || null;
        resultHeight = (img.height as number) || null;
      }

      if (!resultUrl) {
        if (gen.cost_estimate && gen.cost_estimate > 0) {
          await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
        }
        const errorMsg = "No content generated";
        await supabase.from("generations").update({
          url: "error",
          settings: { ...(gen.settings as Record<string, unknown> || {}), error_message: errorMsg, refunded: true },
        }).eq("id", gen.id);
        return NextResponse.json({ status: "failed", generationId: gen.id, error: errorMsg, refunded: true });
      }

      const isImage = gen.type === "image";
      let permanentUrl = resultUrl;
      let fileSize: number | null = null;
      try {
        const fileRes = await fetch(resultUrl);
        if (fileRes.ok) {
          const buffer = Buffer.from(await fileRes.arrayBuffer());
          fileSize = buffer.length;
          const contentType = fileRes.headers.get("content-type") || (isImage ? "image/png" : "video/mp4");
          const ext = isImage ? (contentType.includes("jpeg") ? "jpg" : "png") : "mp4";
          const folder = isImage ? "images" : "videos";
          const storagePath = `${folder}/${requestId}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("generations")
            .upload(storagePath, buffer, { contentType, upsert: true });
          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from("generations").getPublicUrl(storagePath);
            permanentUrl = urlData.publicUrl;
          }
        }
      } catch (copyErr) {
        console.error("[generation-poll] Storage copy failed:", copyErr);
      }

      const updateFields: Record<string, unknown> = { url: permanentUrl, file_size: fileSize, request_id: requestId };
      if (resultWidth) updateFields.width = resultWidth;
      if (resultHeight) updateFields.height = resultHeight;
      await supabase.from("generations").update(updateFields).eq("id", gen.id);
      console.log(`[generation-poll] Completed generation ${gen.id}: ${permanentUrl}`);

      return NextResponse.json({ status: "completed", generationId: gen.id, url: permanentUrl, requestId });
    }

    // Failed or unknown status
    if (gen.cost_estimate && gen.cost_estimate > 0) {
      await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
    }
    const rawErrorMsg = `Generation failed with status: ${statusStr}`;
    await supabase.from("generations").update({
      url: "error",
      settings: { ...(gen.settings as Record<string, unknown> || {}), error_message: rawErrorMsg, refunded: true },
    }).eq("id", gen.id);

    return NextResponse.json({
      status: "failed",
      generationId: gen.id,
      error: sanitizeErrorMessage(rawErrorMsg),
      refunded: true,
    });
  } catch (error) {
    console.error("[generation-poll] Error:", error);
    console.error("[generation-poll] Error (raw):", error);
    const rawMsg = error instanceof Error ? error.message : "Poll failed";
    return NextResponse.json({ error: sanitizeErrorMessage(rawMsg) }, { status: 500 });
  }
}


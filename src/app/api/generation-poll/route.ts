import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase-server";
import { refundCredits } from "@/lib/credits";
import { kieGetTaskStatus, kieParseResultUrls } from "@/lib/kie-ai";

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

    // Load generation from DB
    const { data: gen, error: genError } = await supabase
      .from("generations")
      .select("id, type, url, request_id, settings, user_id, model_id, cost_estimate")
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
      return NextResponse.json({
        status: "failed",
        generationId: gen.id,
        error: (settings?.error_message as string) || "Generation failed",
        refunded: !!settings?.refunded,
      });
    }

    const settings = gen.settings as Record<string, unknown> | null;
    const apiProvider = (settings?.apiProvider as string) || "fal";
    const falEndpoint = settings?.falEndpoint as string | undefined;
    const requestId = gen.request_id || (settings?.falRequestId as string | undefined);

    if (!requestId) {
      return NextResponse.json({ error: "Missing tracking data" }, { status: 400 });
    }

    // ── Kie.ai polling ─────────────────────────────────────────
    if (apiProvider === "kie") {
      const kieResult = await kieGetTaskStatus(requestId);

      if (kieResult.state === "waiting" || kieResult.state === "queuing" || kieResult.state === "generating") {
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

      // Failed
      if (gen.cost_estimate && gen.cost_estimate > 0) {
        await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
      }
      const errorMsg = kieResult.failMsg || "Generation failed";
      await supabase.from("generations").update({
        url: "error",
        settings: { ...(gen.settings as Record<string, unknown> || {}), error_message: errorMsg, refunded: true },
      }).eq("id", gen.id);
      return NextResponse.json({ status: "failed", generationId: gen.id, error: errorMsg, refunded: true });
    }

    // ── fal.ai polling (default) ───────────────────────────────
    if (!falEndpoint) {
      return NextResponse.json({ error: "Missing fal.ai endpoint" }, { status: 400 });
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
    const errorMsg = `Generation failed with status: ${statusStr}`;
    await supabase.from("generations").update({
      url: "error",
      settings: { ...(gen.settings as Record<string, unknown> || {}), error_message: errorMsg, refunded: true },
    }).eq("id", gen.id);

    return NextResponse.json({
      status: "failed",
      generationId: gen.id,
      error: errorMsg,
      refunded: true,
    });
  } catch (error) {
    console.error("[generation-poll] Error:", error);
    const message = error instanceof Error ? error.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


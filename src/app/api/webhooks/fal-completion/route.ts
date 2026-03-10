import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeGeneration, failGeneration } from "@/lib/generation-completion";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * fal.ai webhook handler.
 * Called when a fal.ai queue job completes (success or failure).
 * Payload: { request_id, status: "OK"|"ERROR", payload: {...}, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = body.request_id;
    const status = body.status;

    if (!requestId) {
      console.error("[fal-webhook] Missing request_id in payload:", JSON.stringify(body).slice(0, 500));
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    console.log(`[fal-webhook] Received: request_id=${requestId}, status=${status}`);

    // Look up generation by request_id
    const supabase = getAdminClient();
    const { data: gen } = await supabase
      .from("generations")
      .select("id, url")
      .eq("request_id", requestId)
      .single();

    if (!gen) {
      console.error(`[fal-webhook] No generation found for request_id=${requestId}`);
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Already handled (idempotent)
    if (gen.url) {
      return NextResponse.json({ received: true, already_handled: true });
    }

    if (status === "OK" && body.payload) {
      // Extract result URL from the fal payload (video or image)
      const payload = body.payload;
      let resultUrl: string | null = null;

      // Video models: payload.video.url
      if (payload.video && typeof payload.video === "object") {
        resultUrl = payload.video.url;
      }
      // Some models: payload.video_url
      if (!resultUrl && typeof payload.video_url === "string") {
        resultUrl = payload.video_url;
      }
      // Image models: payload.images[0].url
      if (!resultUrl && payload.images && Array.isArray(payload.images) && payload.images.length > 0) {
        resultUrl = payload.images[0].url;
      }
      // Relight/other: payload.output.url
      if (!resultUrl && payload.output && typeof payload.output === "object") {
        resultUrl = payload.output.url;
      }
      // Direct URL string
      if (!resultUrl && typeof payload.url === "string") {
        resultUrl = payload.url;
      }

      if (resultUrl) {
        await completeGeneration(gen.id, resultUrl, requestId);
        console.log(`[fal-webhook] Completed generation ${gen.id}`);
      } else {
        console.error("[fal-webhook] Could not extract URL from payload:", JSON.stringify(payload).slice(0, 500));
        await failGeneration(gen.id, "No video URL in webhook payload");
      }
    } else {
      // Failed
      const errorMsg = typeof body.error === "string"
        ? body.error
        : (body.error?.message || `Generation failed (status: ${status})`);
      await failGeneration(gen.id, errorMsg);
      console.log(`[fal-webhook] Failed generation ${gen.id}: ${errorMsg}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[fal-webhook] Error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

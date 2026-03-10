import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { kieParseResultUrls } from "@/lib/kie-ai";
import { completeGeneration, failGeneration } from "@/lib/generation-completion";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Kie.ai callback handler.
 * Called when a Kie.ai task reaches a terminal state (success or fail).
 * The exact payload format is inferred from the recordInfo response structure.
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
    if (gen.url) {
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
      await failGeneration(gen.id, failMsg || "Generation failed");
      console.log(`[kie-webhook] Failed generation ${gen.id}: ${failMsg}`);
    } else {
      // Intermediate state (waiting, queuing, generating) - might get called for each state change
      console.log(`[kie-webhook] Intermediate state "${state}" for taskId=${taskId}, ignoring`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[kie-webhook] Error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

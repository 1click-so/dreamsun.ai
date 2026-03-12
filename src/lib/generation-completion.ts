/**
 * Shared helpers for completing/failing a generation.
 * Used by both webhook handlers and generation-poll fallback.
 */

import { createClient } from "@supabase/supabase-js";
import { refundCredits } from "@/lib/credits";
import { trackGenerationCompleted, trackGenerationFailed } from "@/lib/analytics-server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Complete a generation: download video from external URL,
 * upload to Supabase storage, update DB row with permanent URL.
 * Idempotent - skips if generation already has a URL.
 */
export async function completeGeneration(
  generationId: string,
  videoUrl: string,
  requestId: string
): Promise<{ success: boolean; permanentUrl: string }> {
  const supabase = getAdminClient();

  // Check if already handled (idempotent)
  const { data: existing } = await supabase
    .from("generations")
    .select("url, type, model_id, model_name")
    .eq("id", generationId)
    .single();

  if (existing?.url && existing.url !== "error") {
    return { success: true, permanentUrl: existing.url };
  }

  let permanentUrl = videoUrl;
  let fileSize: number | null = null;

  try {
    const fileRes = await fetch(videoUrl);
    if (fileRes.ok) {
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      fileSize = buffer.length;
      const storagePath = `videos/${requestId}.mp4`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("generations")
        .upload(storagePath, buffer, { contentType: "video/mp4", upsert: true });
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("generations").getPublicUrl(storagePath);
        permanentUrl = urlData.publicUrl;
      }
    }
  } catch (err) {
    console.error("[generation-completion] Storage copy failed:", err);
  }

  await supabase
    .from("generations")
    .update({ url: permanentUrl, file_size: fileSize, request_id: requestId })
    .eq("id", generationId);

  // Server-side analytics
  const genType = (existing?.type === "video" ? "video" : "image") as "image" | "video";
  trackGenerationCompleted(genType, existing?.model_id ?? "unknown").catch(() => {});

  console.log(`[generation-completion] Completed ${generationId}: ${permanentUrl}`);
  return { success: true, permanentUrl };
}

/**
 * Mark a generation as failed: update DB row with error, refund credits.
 * Idempotent - skips if generation already completed or already failed.
 */
export async function failGeneration(
  generationId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getAdminClient();

  const { data: gen } = await supabase
    .from("generations")
    .select("user_id, cost_estimate, model_id, type, settings, url")
    .eq("id", generationId)
    .single();

  if (!gen) {
    console.error(`[generation-completion] Generation ${generationId} not found`);
    return;
  }

  // Already completed or already failed - skip
  if (gen.url && gen.url !== "error") return;
  if (gen.url === "error") return;

  // Refund credits
  if (gen.cost_estimate && gen.cost_estimate > 0) {
    await refundCredits(gen.user_id, gen.cost_estimate, { modelId: gen.model_id }).catch(() => {});
  }

  await supabase
    .from("generations")
    .update({
      url: "error",
      settings: {
        ...(gen.settings as Record<string, unknown> || {}),
        error_message: errorMessage,
        refunded: true,
      },
    })
    .eq("id", generationId);

  // Server-side analytics
  const genType = (gen.type === "video" ? "video" : "image") as "image" | "video";
  trackGenerationFailed(genType, gen.model_id ?? "unknown", errorMessage).catch(() => {});

  console.log(`[generation-completion] Failed ${generationId}: ${errorMessage}`);
}

/**
 * Get the webhook base URL for this deployment.
 * Returns null in local dev (webhooks can't reach localhost).
 */
export function getWebhookBaseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

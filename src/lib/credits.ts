import { createClient } from "@/lib/supabase-server";

// ── Types ──────────────────────────────────────────────────────

export interface CreditBalance {
  subscription: number;
  topup: number;
  total: number;
  tier: string;
}

interface DeductResult {
  success: boolean;
  deducted?: number;
  from_subscription?: number;
  from_topup?: number;
  balance_subscription?: number;
  balance_topup?: number;
  error?: string;
  available?: number;
  required?: number;
}

interface RefundResult {
  success: boolean;
  refunded?: number;
  to_subscription?: number;
  to_topup?: number;
  balance_subscription?: number;
  balance_topup?: number;
}

// ── Cost Calculation ───────────────────────────────────────────

/**
 * Calculate credit cost for a generation.
 *
 * `base_price_credits` is the per-unit cost (per image or per second).
 * Multiple rows may exist per model_id (different resolution/audio tiers).
 *
 * Image: base_price_credits * numImages
 * Video: base_price_credits * duration
 */
export async function calculateCost(
  modelId: string,
  opts: { numImages?: number; duration?: number; resolution?: string; audioTier?: string } = {}
): Promise<number> {
  const supabase = await createClient();

  let query = supabase
    .from("model_pricing")
    .select("base_price_credits, capability")
    .eq("model_id", modelId)
    .eq("is_active", true);

  if (opts.resolution) query = query.eq("resolution", opts.resolution);
  if (opts.audioTier) query = query.eq("audio_tier", opts.audioTier);

  const { data: rows } = await query.order("base_price_credits", { ascending: true }).limit(1);

  if (!rows || rows.length === 0) return 0;

  const row = rows[0];
  const unitCost = row.base_price_credits ?? 0;
  const isVideo = row.capability?.includes("video") || row.capability?.includes("audio");

  if (isVideo) {
    return unitCost * (opts.duration ?? 5);
  }

  return unitCost * (opts.numImages ?? 1);
}

// ── Balance ────────────────────────────────────────────────────

export async function getBalance(userId: string): Promise<CreditBalance> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("credits_subscription, credits_topup, subscription_tier")
    .eq("id", userId)
    .single();

  if (!data) {
    return { subscription: 0, topup: 0, total: 0, tier: "free" };
  }

  return {
    subscription: data.credits_subscription,
    topup: data.credits_topup,
    total: data.credits_subscription + data.credits_topup,
    tier: data.subscription_tier,
  };
}

// ── Deduct ─────────────────────────────────────────────────────

export async function deductCredits(
  userId: string,
  amount: number,
  opts: { generationId?: string; modelId?: string; description?: string } = {}
): Promise<DeductResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_generation_id: opts.generationId ?? null,
    p_model_id: opts.modelId ?? null,
    p_description: opts.description ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as DeductResult;
}

// ── Refund ─────────────────────────────────────────────────────

export async function refundCredits(
  userId: string,
  amount: number,
  opts: { generationId?: string; modelId?: string } = {}
): Promise<RefundResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_generation_id: opts.generationId ?? null,
    p_model_id: opts.modelId ?? null,
    p_description: "Generation failed — refund",
  });

  if (error) {
    return { success: false };
  }

  return data as RefundResult;
}

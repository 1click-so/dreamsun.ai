import { createClient } from "@/lib/supabase-server";
import { getStripe, getCreditsForDollars } from "@/lib/stripe";

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
  const hasFilters = !!(opts.resolution || opts.audioTier);

  // Try with resolution/audio tier first for tier-specific pricing
  if (hasFilters) {
    let query = supabase
      .from("model_pricing")
      .select("base_price_credits, capability")
      .eq("model_id", modelId)
      .eq("is_active", true);

    if (opts.resolution) query = query.eq("resolution", opts.resolution);
    if (opts.audioTier) query = query.eq("audio_tier", opts.audioTier);

    const { data: rows } = await query.order("base_price_credits", { ascending: true }).limit(1);

    if (rows && rows.length > 0) {
      const row = rows[0];
      const unitCost = row.base_price_credits ?? 0;
      const isVideo = row.capability?.includes("video") || row.capability?.includes("audio");
      return isVideo ? unitCost * (opts.duration ?? 5) : unitCost * (opts.numImages ?? 1);
    }
    // No tier-specific row found — fall through to base model lookup
  }

  // Base lookup (no resolution/audio filter) — for models without tier-specific pricing
  const { data: rows } = await supabase
    .from("model_pricing")
    .select("base_price_credits, capability")
    .eq("model_id", modelId)
    .eq("is_active", true)
    .order("base_price_credits", { ascending: true })
    .limit(1);

  if (!rows || rows.length === 0) return 0;

  const row = rows[0];
  const unitCost = row.base_price_credits ?? 0;
  const isVideo = row.capability?.includes("video") || row.capability?.includes("audio");

  return isVideo ? unitCost * (opts.duration ?? 5) : unitCost * (opts.numImages ?? 1);
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

// ── Auto Top-up ──────────────────────────────────────────────

/**
 * Check if auto-topup should trigger after a deduction.
 * Called after successful deduction — fires off-session Stripe charge.
 * Non-blocking: failures are logged but never break the generation flow.
 */
export async function tryAutoTopup(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("auto_topup_enabled, auto_topup_threshold, auto_topup_dollars, credits_subscription, credits_topup, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!profile?.auto_topup_enabled || !profile.stripe_customer_id) return;

    const totalCredits = (profile.credits_subscription ?? 0) + (profile.credits_topup ?? 0);
    if (totalCredits >= profile.auto_topup_threshold) return;

    // Balance is below threshold — charge saved payment method
    const stripe = getStripe();
    const dollars = profile.auto_topup_dollars;
    const credits = getCreditsForDollars(dollars);

    // Get default payment method
    const methods = await stripe.paymentMethods.list({
      customer: profile.stripe_customer_id,
      type: "card",
      limit: 1,
    });

    if (methods.data.length === 0) {
      console.warn(`[auto-topup] No payment method for user ${userId}, disabling auto-topup`);
      await supabase.from("profiles").update({ auto_topup_enabled: false }).eq("id", userId);
      return;
    }

    const paymentMethod = methods.data[0].id;

    // Create off-session payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: dollars * 100,
      currency: "usd",
      customer: profile.stripe_customer_id,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      metadata: {
        supabase_user_id: userId,
        type: "auto_topup",
        credits: String(credits),
      },
    });

    if (paymentIntent.status === "succeeded") {
      // Add credits immediately (don't wait for webhook)
      const newBalance = (profile.credits_topup ?? 0) + credits;
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await supabase
        .from("profiles")
        .update({
          credits_topup: newBalance,
          credits_topup_expires_at: expiresAt.toISOString(),
        })
        .eq("id", userId);

      await supabase.from("credit_transactions").insert({
        user_id: userId,
        type: "topup_purchase",
        amount: credits,
        pool: "topup",
        balance_after: newBalance,
        description: `Auto top-up: $${dollars} → ${credits.toLocaleString()} credits`,
        stripe_payment_intent_id: paymentIntent.id,
        metadata: { auto_topup: true },
      });

      console.log(`[auto-topup] User ${userId}: charged $${dollars}, added ${credits} credits`);
    }
  } catch (err) {
    // Never break the generation flow — just log
    console.error(`[auto-topup] Failed for user ${userId}:`, err);
  }
}

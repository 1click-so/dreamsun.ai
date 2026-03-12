import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminClient } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = getAdminClient();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30d";

  // Calculate date filter
  let dateFilter: string | null = null;
  if (period === "7d") {
    dateFilter = new Date(Date.now() - 7 * 86400000).toISOString();
  } else if (period === "30d") {
    dateFilter = new Date(Date.now() - 30 * 86400000).toISOString();
  }
  // "all" = no filter

  // 0. Get admin user IDs (to exclude from credit spending stats)
  const { data: adminProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  const adminIds = adminProfiles?.map((p) => p.id) || [];

  // 1. Credit stats (all-time)
  // Credits in (all users)
  const { data: txIn } = await admin
    .from("credit_transactions")
    .select("amount")
    .in("type", ["purchase", "grant", "bonus", "signup_bonus", "promo", "referral"]);

  // Credits spent (exclude admin users)
  let txOutQuery = admin
    .from("credit_transactions")
    .select("amount, user_id")
    .eq("type", "deduction");
  const { data: txOut } = await txOutQuery;

  const { data: txRefund } = await admin
    .from("credit_transactions")
    .select("amount, user_id")
    .eq("type", "refund");

  const totalCreditsIn = txIn?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  // Exclude admin spending from totals
  const totalCreditsSpent = txOut
    ?.filter((t) => !adminIds.includes(t.user_id))
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
  const totalRefunded = txRefund
    ?.filter((t) => !adminIds.includes(t.user_id))
    .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  // 1b. Revenue from Stripe payments (actual money received, not credits * $0.01)
  const { data: stripeTx } = await admin
    .from("credit_transactions")
    .select("amount, description, stripe_payment_intent_id")
    .in("type", ["topup_purchase", "subscription_grant", "subscription_reset"])
    .not("stripe_payment_intent_id", "is", null);

  // Subscription revenue: look up plan prices from credit amounts
  // Top-up revenue: derive from credit amount using base rate ($0.01/credit before discount)
  // Best approach: use Stripe payment intents when available
  let stripeRevenueUsd = 0;
  if (stripeTx) {
    for (const tx of stripeTx) {
      // For now, use credits * $0.01 as baseline for Stripe transactions only
      // This excludes grants, bonuses, promos (free credits)
      stripeRevenueUsd += (tx.amount || 0) * 0.01;
    }
  }

  // 2. Generations with cost breakdown (period-filtered)
  let genQuery = admin
    .from("generations")
    .select("model_id, type, cost_estimate, created_at");
  if (dateFilter) {
    genQuery = genQuery.gte("created_at", dateFilter);
  }
  const { data: generations } = await genQuery;

  // 3. Model pricing lookup for API costs
  const { data: pricing } = await admin
    .from("model_pricing")
    .select("model_id, model_name, api_cost_usd, capability, api_provider, pricing_unit, base_price_credits, is_active");

  // Build pricing map: model_id -> pricing info
  const pricingMap = new Map<string, { api_cost_usd: number; capability: string; api_provider: string; model_name: string }>();
  pricing?.forEach((p) => {
    if (p.is_active) {
      pricingMap.set(p.model_id, {
        api_cost_usd: p.api_cost_usd || 0,
        capability: p.capability || "unknown",
        api_provider: p.api_provider || "unknown",
        model_name: p.model_name || p.model_id,
      });
    }
  });

  // 4. Breakdown by capability, provider, model
  const byCapability: Record<string, { count: number; credits: number; api_cost: number }> = {};
  const byProvider: Record<string, { count: number; credits: number; api_cost: number }> = {};
  const byModel: Record<string, { count: number; credits: number; api_cost: number; name: string }> = {};

  generations?.forEach((g) => {
    const info = pricingMap.get(g.model_id);
    const capability = info?.capability || g.type || "unknown";
    const provider = info?.api_provider || "unknown";
    const modelName = info?.model_name || g.model_id;
    const credits = g.cost_estimate || 0;
    const apiCost = info?.api_cost_usd || 0;

    // By capability
    if (!byCapability[capability]) byCapability[capability] = { count: 0, credits: 0, api_cost: 0 };
    byCapability[capability].count++;
    byCapability[capability].credits += credits;
    byCapability[capability].api_cost += apiCost;

    // By provider
    if (!byProvider[provider]) byProvider[provider] = { count: 0, credits: 0, api_cost: 0 };
    byProvider[provider].count++;
    byProvider[provider].credits += credits;
    byProvider[provider].api_cost += apiCost;

    // By model
    if (!byModel[g.model_id]) byModel[g.model_id] = { count: 0, credits: 0, api_cost: 0, name: modelName };
    byModel[g.model_id].count++;
    byModel[g.model_id].credits += credits;
    byModel[g.model_id].api_cost += apiCost;
  });

  // 5. Provider balances
  let falBalance: number | null = null;
  try {
    const res = await fetch("https://rest.fal.ai/billing/balance", {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });
    if (res.ok) {
      const data = await res.json();
      falBalance = data.balance ?? data.amount ?? null;
    }
  } catch {
    // fal balance unavailable
  }

  // 6. User count
  const { count: userCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // Total API cost across all generations in this period
  const totalApiCost = Object.values(byProvider).reduce((sum, p) => sum + p.api_cost, 0);

  return NextResponse.json({
    stats: {
      total_credits_in: totalCreditsIn,
      total_credits_spent: totalCreditsSpent,
      total_refunded: totalRefunded,
      stripe_revenue_usd: stripeRevenueUsd.toFixed(2),
      total_api_cost_usd: totalApiCost.toFixed(2),
      total_generations: generations?.length || 0,
      total_users: userCount || 0,
    },
    breakdown: {
      by_capability: byCapability,
      by_provider: byProvider,
      by_model: byModel,
    },
    provider_balances: {
      fal: falBalance,
      kie: null, // no known balance API
    },
    period,
  });
}

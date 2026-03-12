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

  // 1. Credit stats (all-time, not filtered by period)
  const { data: creditStats } = await admin.rpc("exec_sql", {
    sql: `
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('purchase','grant','bonus','signup_bonus','promo','referral') THEN amount ELSE 0 END), 0) AS total_credits_in,
        COALESCE(SUM(CASE WHEN type = 'deduction' THEN ABS(amount) ELSE 0 END), 0) AS total_credits_spent,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS total_refunded
      FROM credit_transactions
    `,
  });

  // Fallback: query directly if RPC not available
  const { data: txIn } = await admin
    .from("credit_transactions")
    .select("amount")
    .in("type", ["purchase", "grant", "bonus", "signup_bonus", "promo", "referral"]);

  const { data: txOut } = await admin
    .from("credit_transactions")
    .select("amount")
    .eq("type", "deduction");

  const { data: txRefund } = await admin
    .from("credit_transactions")
    .select("amount")
    .eq("type", "refund");

  const totalCreditsIn = txIn?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  const totalCreditsSpent = txOut?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
  const totalRefunded = txRefund?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

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

  return NextResponse.json({
    stats: {
      total_credits_in: totalCreditsIn,
      total_credits_spent: totalCreditsSpent,
      total_refunded: totalRefunded,
      net_revenue_usd: (totalCreditsIn * 0.01).toFixed(2),
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

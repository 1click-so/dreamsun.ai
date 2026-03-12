import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminClient } from "@/lib/admin-guard";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = getAdminClient();

  // Get all pricing rows
  const { data: pricing } = await admin
    .from("model_pricing")
    .select("id, model_id, model_name, capability, api_provider, is_active, api_cost_usd, base_price_credits")
    .order("model_name")
    .order("api_provider");

  if (!pricing) {
    return NextResponse.json({ providers: [], models: [] });
  }

  // Group by provider
  const providerStats: Record<string, { active_models: number; total_models: number; total_rows: number }> = {};
  pricing.forEach((p) => {
    const prov = p.api_provider || "unknown";
    if (!providerStats[prov]) providerStats[prov] = { active_models: 0, total_models: 0, total_rows: 0 };
    providerStats[prov].total_rows++;
    if (p.is_active) providerStats[prov].active_models++;
  });

  // Group by model_id to show provider options
  const modelMap = new Map<string, Array<typeof pricing[0]>>();
  pricing.forEach((p) => {
    const rows = modelMap.get(p.model_id) || [];
    rows.push(p);
    modelMap.set(p.model_id, rows);
  });

  // Models that have multiple providers
  const models = Array.from(modelMap.entries()).map(([modelId, rows]) => {
    const providers = [...new Set(rows.map((r) => r.api_provider))];
    const activeProvider = rows.find((r) => r.is_active)?.api_provider || null;
    return {
      model_id: modelId,
      model_name: rows[0].model_name,
      capability: rows[0].capability,
      providers,
      active_provider: activeProvider,
      has_fallback: providers.length > 1,
      rows: rows.map((r) => ({ id: r.id, api_provider: r.api_provider, is_active: r.is_active })),
    };
  });

  return NextResponse.json({
    providers: Object.entries(providerStats).map(([name, stats]) => ({ name, ...stats })),
    models,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = getAdminClient();
  const body = await req.json();
  const { action } = body;

  if (action === "switch_provider") {
    // Switch active provider for a specific model
    const { model_id, new_provider } = body;
    if (!model_id || !new_provider) {
      return NextResponse.json({ error: "model_id and new_provider required" }, { status: 400 });
    }

    // Deactivate all rows for this model
    await admin
      .from("model_pricing")
      .update({ is_active: false })
      .eq("model_id", model_id);

    // Activate rows for the new provider
    const { data, error } = await admin
      .from("model_pricing")
      .update({ is_active: true })
      .eq("model_id", model_id)
      .eq("api_provider", new_provider)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data });
  }

  if (action === "bulk_switch") {
    // Switch all models of a provider to another
    const { from_provider, to_provider } = body;
    if (!from_provider || !to_provider) {
      return NextResponse.json({ error: "from_provider and to_provider required" }, { status: 400 });
    }

    // Get all model_ids that have both providers
    const { data: allRows } = await admin
      .from("model_pricing")
      .select("model_id, api_provider")
      .in("api_provider", [from_provider, to_provider]);

    if (!allRows) {
      return NextResponse.json({ error: "No rows found" }, { status: 404 });
    }

    // Find models that have the target provider
    const modelProviders = new Map<string, Set<string>>();
    allRows.forEach((r) => {
      const set = modelProviders.get(r.model_id) || new Set();
      set.add(r.api_provider);
      modelProviders.set(r.model_id, set);
    });

    const switchable = Array.from(modelProviders.entries())
      .filter(([, providers]) => providers.has(from_provider) && providers.has(to_provider))
      .map(([id]) => id);

    if (switchable.length === 0) {
      return NextResponse.json({ message: "No models have both providers", switched: 0 });
    }

    // Deactivate from_provider rows
    await admin
      .from("model_pricing")
      .update({ is_active: false })
      .in("model_id", switchable)
      .eq("api_provider", from_provider);

    // Activate to_provider rows
    await admin
      .from("model_pricing")
      .update({ is_active: true })
      .in("model_id", switchable)
      .eq("api_provider", to_provider);

    return NextResponse.json({ switched: switchable.length, model_ids: switchable });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

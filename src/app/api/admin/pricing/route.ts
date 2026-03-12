import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminClient } from "@/lib/admin-guard";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("model_pricing")
    .select("*")
    .order("capability")
    .order("model_name")
    .order("api_provider")
    .order("resolution");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = getAdminClient();
  const body = await req.json();

  // Support single update or batch
  const updates: Array<{
    id: string;
    base_price_credits?: number;
    discount_pct?: number;
    is_active?: boolean;
    is_promo?: boolean;
    promo_label?: string | null;
  }> = Array.isArray(body) ? body : [body];

  const results = [];
  const errors = [];

  for (const update of updates) {
    if (!update.id) {
      errors.push({ error: "Missing id", update });
      continue;
    }

    // Only allow updating specific fields
    const allowed: Record<string, unknown> = {};
    if (update.base_price_credits !== undefined) allowed.base_price_credits = update.base_price_credits;
    if (update.discount_pct !== undefined) allowed.discount_pct = update.discount_pct;
    if (update.is_active !== undefined) allowed.is_active = update.is_active;
    if (update.is_promo !== undefined) allowed.is_promo = update.is_promo;
    if (update.promo_label !== undefined) allowed.promo_label = update.promo_label;

    if (Object.keys(allowed).length === 0) {
      errors.push({ error: "No valid fields to update", id: update.id });
      continue;
    }

    const { data, error } = await admin
      .from("model_pricing")
      .update(allowed)
      .eq("id", update.id)
      .select()
      .single();

    if (error) {
      errors.push({ error: error.message, id: update.id });
    } else {
      results.push(data);
    }
  }

  return NextResponse.json({ updated: results, errors });
}

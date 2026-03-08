import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_tier, subscription_status, stripe_customer_id, subscription_ends_at, credits_topup_expires_at"
    )
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    email: user.email,
    display_name: user.user_metadata?.display_name || "",
    created_at: user.created_at,
    subscription_tier: profile?.subscription_tier || "free",
    subscription_status: profile?.subscription_status || null,
    subscription_ends_at: profile?.subscription_ends_at || null,
    credits_topup_expires_at: profile?.credits_topup_expires_at || null,
    has_billing: !!profile?.stripe_customer_id,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { display_name } = body;

  if (typeof display_name !== "string" || display_name.length > 100) {
    return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({
    data: { display_name: display_name.trim() },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ display_name: display_name.trim() });
}

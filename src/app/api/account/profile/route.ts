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
      "subscription_tier, subscription_status, stripe_customer_id, subscription_ends_at, credits_topup_expires_at, avatar_url, username, is_admin"
    )
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    email: user.email,
    display_name: user.user_metadata?.display_name || "",
    avatar_url: profile?.avatar_url || null,
    username: profile?.username || "",
    created_at: user.created_at,
    subscription_tier: profile?.subscription_tier || "free",
    subscription_status: profile?.subscription_status || null,
    subscription_ends_at: profile?.subscription_ends_at || null,
    credits_topup_expires_at: profile?.credits_topup_expires_at || null,
    has_billing: !!profile?.stripe_customer_id,
    is_admin: !!profile?.is_admin,
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
  const { display_name, username } = body;

  const result: Record<string, string> = {};

  // Update display name (stored in auth.users metadata)
  if (display_name !== undefined) {
    if (typeof display_name !== "string" || display_name.length > 100) {
      return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
    }
    const { error } = await supabase.auth.updateUser({
      data: { display_name: display_name.trim() },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    result.display_name = display_name.trim();
  }

  // Update username (stored in profiles table)
  if (username !== undefined) {
    const clean = String(username).toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 30);
    if (clean.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters (letters, numbers, underscores)" }, { status: 400 });
    }
    // Check uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", clean)
      .neq("id", user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }
    const { error } = await supabase
      .from("profiles")
      .update({ username: clean })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    result.username = clean;
  }

  return NextResponse.json(result);
}

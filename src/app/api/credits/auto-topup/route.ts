import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { TOPUP_MIN_DOLLARS, TOPUP_MAX_DOLLARS } from "@/lib/stripe";

/** GET — fetch auto-topup settings */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("auto_topup_enabled, auto_topup_threshold, auto_topup_dollars, stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Check if user has a saved payment method
  let hasPaymentMethod = false;
  if (profile.stripe_customer_id) {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const methods = await stripe.paymentMethods.list({
      customer: profile.stripe_customer_id,
      type: "card",
      limit: 1,
    });
    hasPaymentMethod = methods.data.length > 0;
  }

  return NextResponse.json({
    enabled: profile.auto_topup_enabled,
    threshold: profile.auto_topup_threshold,
    dollars: profile.auto_topup_dollars,
    hasPaymentMethod,
  });
}

/** PUT — update auto-topup settings */
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { enabled, threshold, dollars } = body;

  // Validate
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  if (enabled) {
    if (typeof threshold !== "number" || threshold < 10 || threshold > 10000) {
      return NextResponse.json({ error: "threshold must be 10–10,000" }, { status: 400 });
    }
    if (typeof dollars !== "number" || dollars < TOPUP_MIN_DOLLARS || dollars > TOPUP_MAX_DOLLARS) {
      return NextResponse.json(
        { error: `dollars must be ${TOPUP_MIN_DOLLARS}–${TOPUP_MAX_DOLLARS}` },
        { status: 400 }
      );
    }

    // Must have a saved payment method to enable
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profile?.stripe_customer_id) {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
      const methods = await stripe.paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: "card",
        limit: 1,
      });
      if (methods.data.length === 0) {
        return NextResponse.json(
          { error: "No payment method on file. Make a purchase first to save your card." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "No payment method on file. Make a purchase first to save your card." },
        { status: 400 }
      );
    }
  }

  await supabase
    .from("profiles")
    .update({
      auto_topup_enabled: enabled,
      auto_topup_threshold: threshold ?? 100,
      auto_topup_dollars: dollars ?? 25,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}

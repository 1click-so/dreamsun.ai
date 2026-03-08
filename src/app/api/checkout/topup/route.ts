import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe, TOPUP_MIN_DOLLARS, TOPUP_MAX_DOLLARS, CREDIT_PACKAGES, getCreditsForDollars } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  let amount: number;
  let credits: number;
  let packageId: string | undefined;

  if (body.packageId) {
    // Preset package
    const pkg = CREDIT_PACKAGES.find((p) => p.id === body.packageId);
    if (!pkg) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }
    amount = pkg.dollars;
    credits = pkg.credits;
    packageId = pkg.id;
  } else if (body.dollars) {
    // Custom amount (slider) — same discount curve as packages
    amount = Math.round(Number(body.dollars));
    credits = getCreditsForDollars(amount);
    packageId = undefined;
  } else {
    return NextResponse.json({ error: "Provide packageId or dollars" }, { status: 400 });
  }

  if (amount < TOPUP_MIN_DOLLARS || amount > TOPUP_MAX_DOLLARS) {
    return NextResponse.json(
      { error: `Amount must be between $${TOPUP_MIN_DOLLARS} and $${TOPUP_MAX_DOLLARS}` },
      { status: 400 }
    );
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, subscription_tier")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = req.headers.get("origin") || "https://dreamsun.ai";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    ui_mode: "embedded",
    payment_intent_data: {
      setup_future_usage: "off_session", // Save card for auto-topup
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount * 100, // cents
          product_data: {
            name: `${credits.toLocaleString()} DreamSun Credits`,
            description: `Top-up: ${credits.toLocaleString()} credits`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      supabase_user_id: user.id,
      type: "topup",
      credits: String(credits),
      ...(packageId ? { package_id: packageId } : {}),
    },
    return_url: `${origin}/pricing/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}

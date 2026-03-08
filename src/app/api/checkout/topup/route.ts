import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe, TOPUP_RATE, TOPUP_MIN_DOLLARS, TOPUP_MAX_DOLLARS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dollars } = await req.json();
  const amount = Math.round(Number(dollars));
  if (!amount || amount < TOPUP_MIN_DOLLARS || amount > TOPUP_MAX_DOLLARS) {
    return NextResponse.json(
      { error: `Amount must be between $${TOPUP_MIN_DOLLARS} and $${TOPUP_MAX_DOLLARS}` },
      { status: 400 }
    );
  }

  const credits = amount * TOPUP_RATE;

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
    },
    return_url: `${origin}/pricing/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}

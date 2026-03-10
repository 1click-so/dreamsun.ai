import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe, PLANS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await req.json();
  const plan = PLANS[planId as string];
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
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
    mode: "subscription",
    ui_mode: "embedded",
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: plan.priceInCents,
          product_data: {
            name: `DreamSun ${plan.name}`,
            description: `${plan.credits.toLocaleString()} credits/month`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      supabase_user_id: user.id,
      plan_id: planId,
      type: "subscription",
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        plan_id: planId,
      },
    },
    return_url: `${origin}/pricing/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}

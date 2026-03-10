import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe, PLANS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    console.log("[checkout/sub] 1. start");

    const supabase = await createClient();
    console.log("[checkout/sub] 2. supabase client created");

    const { data: { user } } = await supabase.auth.getUser();
    console.log("[checkout/sub] 3. user:", user?.id ?? "null");

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await req.json();
    const plan = PLANS[planId as string];
    console.log("[checkout/sub] 4. planId:", planId, "valid:", !!plan);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    console.log("[checkout/sub] 5. customerId:", customerId ?? "none");

    if (!customerId) {
      console.log("[checkout/sub] 5b. creating stripe customer...");
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      console.log("[checkout/sub] 5c. created:", customerId);
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") || "https://dreamsunai.com";
    console.log("[checkout/sub] 6. creating session...");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      ui_mode: "embedded",
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

    console.log("[checkout/sub] 7. session created:", session.id);
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("[checkout/sub] ERROR:", err);
    const message = err instanceof Error ? err.message : "Stripe session creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

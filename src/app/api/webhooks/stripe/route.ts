import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

// Use service role for webhook — no user session available
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        if (session.metadata?.type === "subscription") {
          const planId = session.metadata.plan_id;
          const plan = PLANS[planId];
          if (!plan) break;

          await supabase
            .from("profiles")
            .update({
              subscription_tier: planId,
              subscription_status: "active",
              stripe_subscription_id: session.subscription as string,
              credits_subscription: plan.credits,
            })
            .eq("id", userId);

          // Log credit grant
          await supabase.from("credit_transactions").insert({
            user_id: userId,
            type: "subscription_grant",
            amount: plan.credits,
            pool: "subscription",
            balance_after: plan.credits,
            description: `${plan.name} plan activated — ${plan.credits} credits`,
            stripe_payment_intent_id: session.payment_intent as string,
          });
        }

        if (session.metadata?.type === "topup") {
          const credits = parseInt(session.metadata.credits, 10);
          if (!credits || isNaN(credits)) break;

          // Add credits to topup pool
          const { data: profile } = await supabase
            .from("profiles")
            .select("credits_topup")
            .eq("id", userId)
            .single();

          const newBalance = (profile?.credits_topup ?? 0) + credits;
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          await supabase
            .from("profiles")
            .update({
              credits_topup: newBalance,
              credits_topup_expires_at: expiresAt.toISOString(),
            })
            .eq("id", userId);

          await supabase.from("credit_transactions").insert({
            user_id: userId,
            type: "topup_purchase",
            amount: credits,
            pool: "topup",
            balance_after: newBalance,
            description: `Top-up: ${credits} credits purchased`,
            stripe_payment_intent_id: session.payment_intent as string,
          });
        }
        break;
      }

      case "invoice.paid": {
        // Recurring subscription payment — reset subscription credits
        const invoice = event.data.object;
        const invoiceObj = invoice as unknown as Record<string, unknown>;
        const rawSub = invoiceObj.subscription;
        const subId = (typeof rawSub === "string" ? rawSub : (rawSub as Record<string, unknown> | null)?.id) as string | undefined;
        if (!subId) break;

        // Find user by stripe_subscription_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, subscription_tier")
          .eq("stripe_subscription_id", subId)
          .single();

        if (!profile) break;

        // Skip the first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === "subscription_create") break;

        const plan = PLANS[profile.subscription_tier];
        if (!plan) break;

        await supabase
          .from("profiles")
          .update({
            credits_subscription: plan.credits,
            subscription_status: "active",
          })
          .eq("id", profile.id);

        await supabase.from("credit_transactions").insert({
          user_id: profile.id,
          type: "subscription_reset",
          amount: plan.credits,
          pool: "subscription",
          balance_after: plan.credits,
          description: `Monthly reset — ${plan.credits} credits`,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const planId = sub.metadata?.plan_id;
        if (planId && PLANS[planId]) {
          await supabase
            .from("profiles")
            .update({
              subscription_tier: planId,
              subscription_status: sub.status === "active" ? "active" : sub.status,
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end as number | undefined;
        const endsAt = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : new Date().toISOString();

        await supabase
          .from("profiles")
          .update({
            subscription_status: "canceled",
            subscription_ends_at: endsAt,
          })
          .eq("id", userId);
        break;
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object;
        const failedInvoiceObj = failedInvoice as unknown as Record<string, unknown>;
        const failedRawSub = failedInvoiceObj.subscription;
        const failedSubId = (typeof failedRawSub === "string" ? failedRawSub : (failedRawSub as Record<string, unknown> | null)?.id) as string | undefined;
        if (!failedSubId) break;

        await supabase
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", failedSubId);
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

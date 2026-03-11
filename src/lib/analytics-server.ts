/**
 * Rybbit Analytics - Server-side event tracking
 *
 * Uses the Rybbit HTTP API to send events from server-side code
 * (webhooks, API routes) where window.rybbit is not available.
 *
 * Events tracked server-side:
 *   subscription_created    -> new subscription activated via Stripe
 *   subscription_renewed    -> recurring payment succeeded, credits reset
 *   subscription_upgraded   -> plan changed to higher tier
 *   subscription_downgraded -> plan changed to lower tier
 *   subscription_cancelled  -> subscription cancelled
 *   payment_failed          -> subscription payment failed
 *   credits_purchased       -> top-up credits bought
 *   auto_topup_triggered    -> auto top-up charged
 */

const RYBBIT_URL = process.env.RYBBIT_URL || "https://analytics.fam.social";
const RYBBIT_SITE_ID = process.env.RYBBIT_SITE_ID || "87fa7ec42978";

async function trackServerEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    await fetch(`${RYBBIT_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: RYBBIT_SITE_ID,
        type: "custom_event",
        event_name: eventName,
        hostname: "dreamsunai.com",
        pathname: "/api/webhooks/stripe",
        properties: properties ? JSON.stringify(properties) : undefined,
      }),
    });
  } catch {
    // Analytics should never break the main flow
  }
}

// -- Subscription Events --------------------------------------------------

export function trackSubscriptionCreated(plan: string, credits: number, amountCents: number): Promise<void> {
  return trackServerEvent("subscription_created", {
    plan,
    credits,
    amount_dollars: amountCents / 100,
  });
}

export function trackSubscriptionRenewed(plan: string, credits: number): Promise<void> {
  return trackServerEvent("subscription_renewed", {
    plan,
    credits,
  });
}

export function trackSubscriptionUpgraded(fromPlan: string, toPlan: string): Promise<void> {
  return trackServerEvent("subscription_upgraded", {
    from_plan: fromPlan,
    to_plan: toPlan,
  });
}

export function trackSubscriptionDowngraded(fromPlan: string, toPlan: string): Promise<void> {
  return trackServerEvent("subscription_downgraded", {
    from_plan: fromPlan,
    to_plan: toPlan,
  });
}

export function trackSubscriptionCancelled(plan: string): Promise<void> {
  return trackServerEvent("subscription_cancelled", { plan });
}

export function trackPaymentFailed(plan: string): Promise<void> {
  return trackServerEvent("payment_failed", { plan });
}

// -- Credit Events --------------------------------------------------------

export function trackCreditsPurchased(credits: number, amountCents: number): Promise<void> {
  return trackServerEvent("credits_purchased", {
    credits,
    amount_dollars: amountCents / 100,
  });
}

export function trackAutoTopupTriggered(credits: number, amountDollars: number): Promise<void> {
  return trackServerEvent("auto_topup_triggered", {
    credits,
    amount_dollars: amountDollars,
  });
}

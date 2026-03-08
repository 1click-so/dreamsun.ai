"use client";

import { useState, lazy, Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { useCredits } from "@/hooks/useCredits";
import { CreditIcon } from "@/components/ModelSelector";

const StripeCheckoutForm = lazy(() =>
  import("@/components/StripeCheckout").then((m) => ({ default: m.StripeCheckoutForm }))
);

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 100,
    bonusPct: 0,
    description: "One-time credits to try the platform",
    features: ["100 credits (one-time)", "All image models", "All video models", "No credit card required"],
  },
  {
    id: "starter",
    name: "Starter",
    price: 10,
    credits: 1000,
    bonusPct: 0,
    description: "For casual creators",
    features: ["1,000 credits/month", "All image models", "All video models", "Credits reset monthly"],
  },
  {
    id: "creator",
    name: "Creator",
    price: 40,
    credits: 4400,
    bonusPct: 10,
    popular: true,
    description: "For active creators",
    features: ["4,400 credits/month", "+10% bonus credits", "All models", "Priority generation"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 80,
    credits: 9200,
    bonusPct: 15,
    description: "For professionals and teams",
    features: ["9,200 credits/month", "+15% bonus credits", "All models", "Priority generation", "API access (coming soon)"],
  },
];

export default function PricingPage() {
  const { total, tier, loading } = useCredits();
  const [checkoutType, setCheckoutType] = useState<"subscription" | "topup" | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState(10);
  const [portalLoading, setPortalLoading] = useState(false);

  const isSubscribed = tier !== "free";

  const handleSubscribe = (planId: string) => {
    if (planId === "free") return;
    setCheckoutPlanId(planId);
    setCheckoutType("subscription");
  };

  const handleTopup = () => {
    setCheckoutType("topup");
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  const fetchSubscriptionSecret = async () => {
    const res = await fetch("/api/checkout/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: checkoutPlanId }),
    });
    const data = await res.json();
    return data.clientSecret;
  };

  const fetchTopupSecret = async () => {
    const res = await fetch("/api/checkout/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dollars: topupAmount }),
    });
    const data = await res.json();
    return data.clientSecret;
  };

  // Show Stripe checkout
  if (checkoutType) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <div className="mx-auto w-full max-w-xl px-4 py-12">
          <button
            onClick={() => setCheckoutType(null)}
            className="mb-6 text-xs text-muted hover:text-foreground transition"
          >
            &larr; Back to pricing
          </button>
          <Suspense fallback={<div className="text-center text-muted py-12">Loading checkout...</div>}>
            <StripeCheckoutForm
              fetchClientSecret={checkoutType === "subscription" ? fetchSubscriptionSecret : fetchTopupSecret}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-2 text-sm text-muted">
            Credits power every generation. Subscribe for monthly credits or top up anytime.
          </p>
          {!loading && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm">
              <CreditIcon size={14} />
              <span className="font-semibold">{total.toLocaleString()}</span>
              <span className="text-muted">credits available</span>
              {isSubscribed && (
                <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase">
                  {tier}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === tier;
            const isPopular = plan.id === "creator";

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-5 transition ${
                  isPopular
                    ? "border-accent/40 bg-accent/[0.03] shadow-[0_0_20px_var(--color-accent)/0.08]"
                    : "border-border bg-surface"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase text-black">
                    Most Popular
                  </span>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-0.5 text-xs text-muted">{plan.description}</p>
                </div>

                <div className="mb-4">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">${plan.price}</span>
                      <span className="text-sm text-muted">/month</span>
                    </>
                  )}
                </div>

                <div className="mb-5 flex items-center gap-1.5 text-sm">
                  <CreditIcon size={14} />
                  <span className="font-semibold">{plan.credits.toLocaleString()}</span>
                  <span className="text-muted">{plan.price === 0 ? "credits" : "credits/mo"}</span>
                  {plan.bonusPct > 0 && (
                    <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      +{plan.bonusPct}%
                    </span>
                  )}
                </div>

                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.id === "free" ? (
                  <div className="rounded-lg border border-border py-2 text-center text-xs text-muted">
                    {isCurrent ? "Current plan" : "Included"}
                  </div>
                ) : isCurrent ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="rounded-lg border border-accent py-2 text-xs font-semibold text-accent transition hover:bg-accent/10"
                  >
                    {portalLoading ? "Loading..." : "Manage Subscription"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    className={`rounded-lg py-2 text-xs font-semibold transition ${
                      isPopular
                        ? "bg-accent text-black hover:bg-accent-hover"
                        : "border border-accent text-accent hover:bg-accent/10"
                    }`}
                  >
                    {isSubscribed ? "Switch Plan" : "Subscribe"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Top-up Section */}
        <div className="mt-12 rounded-2xl border border-border bg-surface p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Top Up Credits</h3>
              <p className="mt-0.5 text-xs text-muted">
                Buy extra credits at $1 = 100 credits. Top-up credits roll over (1-year expiry).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-sm text-muted">$</span>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Math.max(5, Math.min(500, parseInt(e.target.value) || 5)))}
                  className="w-16 bg-transparent text-sm font-semibold text-foreground outline-none"
                />
                <span className="text-xs text-muted">= {(topupAmount * 100).toLocaleString()} credits</span>
              </div>
              <button
                onClick={handleTopup}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-black transition hover:bg-accent-hover"
              >
                Buy Credits
              </button>
            </div>
          </div>
        </div>

        {/* Manage billing */}
        {isSubscribed && (
          <div className="mt-6 text-center">
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="text-xs text-muted underline transition hover:text-foreground"
            >
              {portalLoading ? "Loading..." : "Manage billing & invoices"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

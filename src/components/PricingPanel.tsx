"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useCredits } from "@/hooks/useCredits";
import { CreditIcon } from "@/components/ModelSelector";
import { CREDIT_PACKAGES, TOPUP_RATE, TOPUP_MIN_DOLLARS, TOPUP_MAX_DOLLARS, getCreditsForDollars, getTopupDiscount } from "@/lib/stripe";
import { AutoTopupCard } from "@/components/account/AutoTopupCard";
import { trackCheckoutStarted } from "@/lib/analytics";

const StripeCheckoutForm = lazy(() =>
  import("@/components/StripeCheckout").then((m) => ({ default: m.StripeCheckoutForm }))
);

// ── Plan definitions ────────────────────────────────────────────

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

// ── Reference generation counts ─────────────────────────────────

const CHEAPEST_IMAGE_COST = 8;
const MID_VIDEO_COST_5S = 40;

function imageCount(credits: number) {
  return Math.floor(credits / CHEAPEST_IMAGE_COST);
}
function videoCount(credits: number) {
  return Math.floor(credits / MID_VIDEO_COST_5S);
}

// ── Tab selector ────────────────────────────────────────────────

type Tab = "plans" | "topup";

function TabSelector({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-surface p-1">
      <button
        onClick={() => onChange("plans")}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
          tab === "plans" ? "bg-accent text-black" : "text-muted hover:text-foreground"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Plans
      </button>
      <button
        onClick={() => onChange("topup")}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
          tab === "topup" ? "bg-accent text-black" : "text-muted hover:text-foreground"
        }`}
      >
        <CreditIcon size={12} />
        Top-up Credits
      </button>
    </div>
  );
}

// ── Check icon ──────────────────────────────────────────────────

function Check() {
  return (
    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main Panel ──────────────────────────────────────────────────

interface PricingPanelProps {
  initialTab?: Tab;
}

export function PricingPanel({ initialTab = "topup" }: PricingPanelProps) {
  const { total, tier, loading } = useCredits();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [checkoutType, setCheckoutType] = useState<"subscription" | "topup" | "custom" | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutPackageId, setCheckoutPackageId] = useState<string | null>(null);
  const [customDollars, setCustomDollars] = useState(25);
  const [customInput, setCustomInput] = useState("25"); // free-typing string
  const [portalLoading, setPortalLoading] = useState(false);

  const isSubscribed = tier !== "free";

  // ── Handlers ──────────────────────────────────────────────

  const handleSubscribe = (planId: string) => {
    if (planId === "free") return;
    const plan = PLANS.find((p) => p.id === planId);
    trackCheckoutStarted("subscription", planId, plan?.price);
    setCheckoutPlanId(planId);
    setCheckoutType("subscription");
  };

  const handleBuyPackage = (packageId: string) => {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    trackCheckoutStarted("topup", packageId, pkg?.dollars);
    setCheckoutPackageId(packageId);
    setCheckoutType("topup");
  };

  const handleBuyCustom = () => {
    trackCheckoutStarted("custom", undefined, customDollars);
    setCheckoutType("custom");
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
    if (!res.ok || !data.clientSecret) {
      console.error("[checkout] subscription error:", data);
      throw new Error(data.error || "Failed to create checkout session");
    }
    return data.clientSecret;
  };

  const fetchTopupSecret = async () => {
    const body = checkoutType === "custom"
      ? { dollars: customDollars }
      : { packageId: checkoutPackageId };
    const res = await fetch("/api/checkout/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) {
      console.error("[checkout] topup error:", data);
      throw new Error(data.error || "Failed to create checkout session");
    }
    return data.clientSecret;
  };

  // ── Checkout view ─────────────────────────────────────────

  if (checkoutType) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-4">
        <button
          onClick={() => setCheckoutType(null)}
          className="mb-3 text-xs text-muted hover:text-foreground transition"
        >
          &larr; Back to pricing
        </button>
        <Suspense fallback={<div className="text-center text-muted py-12">Loading checkout...</div>}>
          <StripeCheckoutForm
            fetchClientSecret={checkoutType === "subscription" ? fetchSubscriptionSecret : fetchTopupSecret}
            key={checkoutType === "custom" ? `custom-${customDollars}` : checkoutPackageId || checkoutPlanId}
          />
        </Suspense>
      </div>
    );
  }

  // ── Main pricing view ─────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-2 text-sm text-muted">
          Choose a plan for monthly credits, or add extra credits anytime.
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

      {/* Tabs */}
      <div className="mb-8 flex justify-center">
        <TabSelector tab={tab} onChange={setTab} />
      </div>

      {/* ═══════════ Plans Tab ═══════════ */}
      {tab === "plans" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === tier;
              const isPopular = plan.id === "creator";

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-5 transition ${
                    isPopular
                      ? "border-accent/40 bg-accent/[0.03]"
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
                        <Check />
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

          {/* Manage billing link */}
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
        </>
      )}

      {/* ═══════════ Top-up Credits Tab ═══════════ */}
      {tab === "topup" && !isSubscribed && (
        <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <CreditIcon size={20} />
          </div>
          <h3 className="text-lg font-semibold">Subscribe to buy credits</h3>
          <p className="mt-2 text-sm text-muted">
            Top-up credits are available for subscribers. Choose a plan to get monthly credits and unlock credit purchases.
          </p>
          <button
            onClick={() => setTab("plans")}
            className="mt-5 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition hover:bg-accent-hover"
          >
            View Plans
          </button>
        </div>
      )}
      {tab === "topup" && isSubscribed && (
        <div className="space-y-3">
          {/* Custom amount card */}
          {(() => {
            // Use customDollars (clamped number) for calculations
            const effectiveDollars = Math.max(TOPUP_MIN_DOLLARS, Math.min(TOPUP_MAX_DOLLARS, customDollars));
            const customCredits = getCreditsForDollars(effectiveDollars);
            const customDiscount = getTopupDiscount(effectiveDollars);
            const baseCredits = effectiveDollars * TOPUP_RATE;
            const inputNum = parseInt(customInput, 10);
            const isValidAmount = !isNaN(inputNum) && inputNum >= TOPUP_MIN_DOLLARS && inputNum <= TOPUP_MAX_DOLLARS;

            // Slider changes → update both number and string
            const handleSlider = (val: number) => {
              setCustomDollars(val);
              setCustomInput(String(val));
            };

            // Input changes → update string freely, update number only if parseable
            const handleInputTyping = (raw: string) => {
              // Allow only digits (and empty for deletion)
              const cleaned = raw.replace(/[^0-9]/g, "");
              setCustomInput(cleaned);
              const n = parseInt(cleaned, 10);
              if (!isNaN(n) && n > 0) {
                setCustomDollars(Math.min(n, TOPUP_MAX_DOLLARS));
              }
            };

            // On blur → clamp and sync both states
            const handleInputBlur = () => {
              const n = parseInt(customInput, 10);
              if (isNaN(n) || n < TOPUP_MIN_DOLLARS) {
                setCustomDollars(TOPUP_MIN_DOLLARS);
                setCustomInput(String(TOPUP_MIN_DOLLARS));
              } else if (n > TOPUP_MAX_DOLLARS) {
                setCustomDollars(TOPUP_MAX_DOLLARS);
                setCustomInput(String(TOPUP_MAX_DOLLARS));
              } else {
                setCustomDollars(n);
                setCustomInput(String(n));
              }
            };

            return (
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
                  {/* Left: title, slider, estimates */}
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Custom Amount</h3>
                      {customDiscount > 0 && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                          +{customDiscount}% bonus
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Slide or type any amount &middot; Bigger amounts get bigger bonuses
                    </p>

                    {/* Slider — caps at $500 */}
                    <div className="mt-auto pt-4">
                      <input
                        type="range"
                        min={5}
                        max={500}
                        step={5}
                        value={Math.min(customDollars, 500)}
                        onChange={(e) => handleSlider(Number(e.target.value))}
                        className="w-full accent-accent"
                      />
                      <div className="mt-0.5 flex justify-between text-[10px] text-muted">
                        <span>$5</span>
                        {customDollars > 500 ? (
                          <span className="text-accent">$500+&thinsp;&rsaquo;</span>
                        ) : (
                          <span>$500</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Check />
                        ~{imageCount(customCredits).toLocaleString()} images
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Check />
                        ~{videoCount(customCredits).toLocaleString()} videos (5s)
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden sm:block w-px bg-border" />

                  {/* Right: input, credits, purchase */}
                  <div className="flex flex-col items-center justify-center gap-3 sm:w-44">
                    {/* Dollar input — free typing, up to $2,500 */}
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-bold text-muted">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customInput}
                        onChange={(e) => handleInputTyping(e.target.value)}
                        onBlur={handleInputBlur}
                        className="h-11 w-28 rounded-xl border border-border bg-background pl-8 pr-3 text-center text-xl font-bold text-foreground outline-none transition focus:border-accent/60"
                      />
                    </div>

                    {/* Credits result */}
                    <div className="text-center text-xs">
                      <span className="font-semibold text-foreground">{customCredits.toLocaleString()}</span>
                      <span className="text-muted"> credits</span>
                      {customDiscount > 0 && (
                        <div className="text-[10px] text-muted">base: {baseCredits.toLocaleString()}</div>
                      )}
                    </div>

                    <button
                      onClick={handleBuyCustom}
                      disabled={!isValidAmount}
                      className="w-full rounded-lg bg-accent py-2 text-xs font-semibold text-black transition hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Purchase
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">or choose a package</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {CREDIT_PACKAGES.map((pkg) => {
            const isPopular = pkg.badge === "most_popular";
            const isBestValue = pkg.badge === "best_value";
            const baseCredits = pkg.dollars * TOPUP_RATE;

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col gap-4 rounded-xl border p-5 transition sm:flex-row sm:items-center sm:justify-between ${
                  isPopular
                    ? "border-accent/50 bg-accent/[0.04]"
                    : "border-border bg-surface"
                }`}
              >
                {/* Left: credits + info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight">
                      {pkg.credits.toLocaleString()} credits
                    </h3>

                    {/* Badges */}
                    {isPopular && (
                      <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                        Most Popular
                      </span>
                    )}
                    {isBestValue && (
                      <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                        Best Value
                      </span>
                    )}
                    {pkg.discountPct > 0 && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                        +{pkg.discountPct}% bonus
                      </span>
                    )}
                  </div>

                  {/* Generation estimates */}
                  <div className="mt-2 flex flex-col gap-1 text-xs text-muted sm:flex-row sm:gap-4">
                    <span className="flex items-center gap-1.5">
                      <Check />
                      Up to {imageCount(pkg.credits).toLocaleString()} image generations
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check />
                      Up to {videoCount(pkg.credits).toLocaleString()} video generations (5s)
                    </span>
                  </div>
                </div>

                {/* Right: price + buy button */}
                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                  <div className="text-right">
                    <span className="text-2xl font-bold">${pkg.dollars}</span>
                    {pkg.discountPct > 0 && (
                      <div className="text-[10px] text-muted">
                        base: {baseCredits.toLocaleString()} cr
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleBuyPackage(pkg.id)}
                    className={`rounded-lg px-6 py-2 text-xs font-semibold transition ${
                      isPopular
                        ? "bg-accent text-black hover:bg-accent-hover"
                        : "border border-accent text-accent hover:bg-accent/10"
                    }`}
                  >
                    Purchase
                  </button>
                </div>
              </div>
            );
          })}

          {/* Footer note */}
          <p className="pt-2 text-center text-[11px] text-muted">
            Top-up credits are valid for 1 year. All models included.
          </p>

          {/* ═══════════ Auto Top-up ═══════════ */}
          <div className="mt-6">
            <AutoTopupCard />
          </div>
        </div>
      )}
    </div>
  );
}

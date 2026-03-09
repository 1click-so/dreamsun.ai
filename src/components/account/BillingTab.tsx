"use client";

import { useState, useEffect } from "react";
import { useCredits } from "@/hooks/useCredits";
import { usePricingOverlay } from "@/contexts/PricingOverlay";
import { CreditIcon } from "@/components/ModelSelector";
import { AutoTopupCard } from "@/components/account/AutoTopupCard";

const PLAN_INFO: Record<
  string,
  { name: string; price: number; credits: number }
> = {
  free: { name: "Free", price: 0, credits: 100 },
  starter: { name: "Starter", price: 10, credits: 1000 },
  creator: { name: "Creator", price: 40, credits: 4400 },
  pro: { name: "Pro", price: 80, credits: 9200 },
};

export function BillingTab() {
  const {
    total,
    subscription,
    topup,
    tier,
    loading: creditsLoading,
  } = useCredits();
  const { openPricing } = usePricingOverlay();

  const [profile, setProfile] = useState<{
    subscription_status: string | null;
    subscription_ends_at: string | null;
    credits_topup_expires_at: string | null;
    has_billing: boolean;
  } | null>(null);

  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/account/profile")
      .then((r) => r.json())
      .then((data) => setProfile(data));
  }, []);

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

  const plan = PLAN_INFO[tier] || PLAN_INFO.free;
  const isSubscribed = tier !== "free";
  const maxCredits = isSubscribed ? plan.credits : 100;
  const ratio = total > 0 ? Math.min(total / maxCredits, 1) : 0;

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (creditsLoading || !profile) {
    return (
      <div className="py-12 text-center text-sm text-muted">Loading...</div>
    );
  }

  // ── Free plan: upgrade-focused view ──────────────────────────
  if (!isSubscribed) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Current plan — upgrade push */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold">Current plan</h3>
            <div className="mt-3">
              <span className="text-2xl font-bold">Free</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <CreditIcon size={12} />
              <span>100 credits (one-time trial)</span>
            </div>
            <p className="mt-3 text-xs text-muted">
              Upgrade to a plan to get monthly credits, buy top-ups, and unlock full access.
            </p>
            <button
              onClick={() => openPricing("plans")}
              className="mt-4 w-full rounded-lg bg-accent py-2 text-xs font-semibold text-black transition hover:bg-accent-hover"
            >
              Upgrade Plan
            </button>
          </div>

          {/* Credit balance — read-only, no buy */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold">Credit balance</h3>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {total.toLocaleString()}
              </span>
              <span className="text-sm text-muted">credits</span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/50">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((total / 100) * 100, 100)}%`,
                  backgroundColor:
                    total < 15
                      ? "var(--color-destructive)"
                      : total < 40
                        ? "#f59e0b"
                        : "var(--color-accent)",
                }}
              />
            </div>

            {topup > 0 && (
              <div className="mt-3 flex justify-between text-xs text-muted">
                <span>Top-up</span>
                <span className="font-medium text-foreground">
                  {topup.toLocaleString()}
                </span>
              </div>
            )}

            <button
              onClick={() => openPricing("plans")}
              className="mt-4 w-full rounded-lg border border-accent py-2 text-xs font-semibold text-accent transition hover:bg-accent/10"
            >
              Upgrade to Buy Credits
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Subscribed: full billing view ────────────────────────────
  return (
    <div className="space-y-6">
      {/* Two-column: Plan + Credits */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Current plan */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Current plan</h3>
            {profile.subscription_status && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  profile.subscription_status === "active"
                    ? "bg-accent/15 text-accent"
                    : profile.subscription_status === "past_due"
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-muted/15 text-muted"
                }`}
              >
                {profile.subscription_status}
              </span>
            )}
          </div>

          <div className="mt-3">
            <span className="text-2xl font-bold">{plan.name}</span>
            {plan.price > 0 && (
              <span className="ml-1 text-sm text-muted">
                ${plan.price}/mo
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <CreditIcon size={12} />
            <span>
              {plan.credits.toLocaleString()} credits/month
            </span>
          </div>

          {profile.subscription_ends_at && (
            <p className="mt-2 text-xs text-muted">
              {profile.subscription_status === "canceled"
                ? "Access until"
                : "Renews"}{" "}
              {formatDate(profile.subscription_ends_at)}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => openPricing("plans")}
              className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
            >
              Change Plan
            </button>
            {profile.has_billing && (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground hover:border-foreground/20"
              >
                {portalLoading ? "Loading..." : "Manage Billing"}
              </button>
            )}
          </div>
        </div>

        {/* Credit balance */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold">Credit balance</h3>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {total.toLocaleString()}
            </span>
            <span className="text-sm text-muted">credits</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/50">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(ratio * 100, 100)}%`,
                backgroundColor:
                  ratio < 0.15
                    ? "var(--color-destructive)"
                    : ratio < 0.4
                      ? "#f59e0b"
                      : "var(--color-accent)",
              }}
            />
          </div>

          <div className="mt-3 space-y-1 text-xs text-muted">
            {subscription > 0 && (
              <div className="flex justify-between">
                <span>Subscription</span>
                <span className="font-medium text-foreground">
                  {subscription.toLocaleString()}
                </span>
              </div>
            )}
            {topup > 0 && (
              <div className="flex justify-between">
                <span>Top-up</span>
                <span className="font-medium text-foreground">
                  {topup.toLocaleString()}
                </span>
              </div>
            )}
            {topup > 0 && profile.credits_topup_expires_at && (
              <div className="flex justify-between">
                <span>Top-up expires</span>
                <span>{formatDate(profile.credits_topup_expires_at)}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => openPricing("topup")}
            className="mt-4 w-full rounded-lg bg-accent py-2 text-xs font-semibold text-black transition hover:bg-accent-hover"
          >
            Buy Credits
          </button>
        </div>
      </div>

      {/* Auto top-up */}
      <AutoTopupCard />
    </div>
  );
}

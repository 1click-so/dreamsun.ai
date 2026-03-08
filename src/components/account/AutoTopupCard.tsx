"use client";

import { useState, useEffect, useCallback } from "react";
import { getCreditsForDollars } from "@/lib/stripe";

export function AutoTopupCard() {
  const [autoTopup, setAutoTopup] = useState({
    enabled: false,
    threshold: 100,
    dollars: 25,
    hasPaymentMethod: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAutoTopup = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/auto-topup");
      if (res.ok) {
        const data = await res.json();
        setAutoTopup(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutoTopup();
  }, [fetchAutoTopup]);

  const save = async (updates: Partial<typeof autoTopup>) => {
    const next = { ...autoTopup, ...updates };
    setAutoTopup(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/credits/auto-topup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.enabled,
          threshold: next.threshold,
          dollars: next.dollars,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setAutoTopup((prev) => ({ ...prev, ...updates, enabled: false }));
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-accent"
            >
              <path
                d="M8 1v14M1 8h14"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.3"
              />
              <path
                d="M8 3.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M8 6v4M6 8h4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <h3 className="text-sm font-semibold">Auto Top-up</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Automatically buy credits when your balance drops below a threshold
          </p>
        </div>

        {/* Toggle */}
        <button
          onClick={() => save({ enabled: !autoTopup.enabled })}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
            autoTopup.enabled ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
              autoTopup.enabled ? "translate-x-[21px]" : "translate-x-[3px]"
            }`}
            style={{ marginTop: "2px" }}
          />
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {!autoTopup.hasPaymentMethod && !autoTopup.enabled && (
        <p className="mt-3 text-xs text-muted">
          Make a purchase first to save your payment method, then you can enable
          auto top-up.
        </p>
      )}

      {autoTopup.enabled && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-muted">
              When credits drop below
            </label>
            <div className="relative">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              >
                <path
                  d="M8 1L14 5.5V10.5L8 15L2 10.5V5.5L8 1Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="number"
                min={10}
                max={10000}
                step={10}
                value={autoTopup.threshold}
                onChange={(e) =>
                  setAutoTopup((p) => ({
                    ...p,
                    threshold: Number(e.target.value),
                  }))
                }
                onBlur={() =>
                  save({
                    threshold: Math.max(
                      10,
                      Math.min(10000, autoTopup.threshold)
                    ),
                  })
                }
                className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent/60 sm:w-40"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-muted">
              Auto-buy amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
                $
              </span>
              <input
                type="number"
                min={5}
                max={2500}
                step={5}
                value={autoTopup.dollars}
                onChange={(e) =>
                  setAutoTopup((p) => ({
                    ...p,
                    dollars: Number(e.target.value),
                  }))
                }
                onBlur={() =>
                  save({
                    dollars: Math.max(5, Math.min(2500, autoTopup.dollars)),
                  })
                }
                className="h-9 w-full rounded-lg border border-border bg-background pl-7 pr-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent/60 sm:w-40"
              />
            </div>
            <span className="mt-1 block text-[10px] text-muted">
              = {getCreditsForDollars(autoTopup.dollars).toLocaleString()}{" "}
              credits
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

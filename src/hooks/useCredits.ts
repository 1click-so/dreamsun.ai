"use client";

import { useState, useEffect, useCallback } from "react";

export interface CreditBalance {
  subscription: number;
  topup: number;
  total: number;
  tier: string;
  loading: boolean;
}

let cache: Omit<CreditBalance, "loading"> | null = null;
const CREDIT_REFRESH_EVENT = "credits:refresh";

export function useCredits(): CreditBalance {
  const [balance, setBalance] = useState<Omit<CreditBalance, "loading">>(
    cache ?? { subscription: 0, topup: 0, total: 0, tier: "free" }
  );
  const [loading, setLoading] = useState(!cache);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const result = {
        subscription: data.subscription ?? 0,
        topup: data.topup ?? 0,
        total: data.total ?? 0,
        tier: data.tier ?? "free",
      };
      cache = result;
      setBalance(result);
    } catch {
      // Fetch failed - keep default values, stop loading
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cache) fetchBalance();

    // Listen for refresh events (from invalidateCredits)
    const handler = () => {
      cache = null;
      fetchBalance();
    };
    window.addEventListener(CREDIT_REFRESH_EVENT, handler);
    return () => window.removeEventListener(CREDIT_REFRESH_EVENT, handler);
  }, [fetchBalance]);

  return { ...balance, loading };
}

/** Invalidate the cached credit balance so all hooks re-fetch */
export function invalidateCredits() {
  cache = null;
  window.dispatchEvent(new Event(CREDIT_REFRESH_EVENT));
}

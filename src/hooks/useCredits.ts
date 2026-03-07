"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

export interface CreditBalance {
  credits: number;
  maxCredits: number;
  loading: boolean;
}

let cache: { credits: number; maxCredits: number } | null = null;

export function useCredits(): CreditBalance {
  const [balance, setBalance] = useState<{ credits: number; maxCredits: number }>(
    cache ?? { credits: 0, maxCredits: 0 }
  );
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }
      supabase
        .from("user_credits")
        .select("credits, max_credits")
        .eq("user_id", data.user.id)
        .single()
        .then(({ data: row }) => {
          const result = {
            credits: row?.credits ?? 0,
            maxCredits: row?.max_credits ?? 0,
          };
          cache = result;
          setBalance(result);
          setLoading(false);
        });
    });
  }, []);

  return { ...balance, loading };
}

/** Invalidate the cached credit balance so next render re-fetches */
export function invalidateCredits() {
  cache = null;
}

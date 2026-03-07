"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

export interface ModelPricing {
  model_id: string;
  base_price_credits: number;
  effective_credits: number;
  discount_pct: number;
  is_promo: boolean;
  promo_label: string | null;
}

let cache: Record<string, ModelPricing> | null = null;

export function usePricing() {
  const [pricing, setPricing] = useState<Record<string, ModelPricing>>(cache ?? {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    const supabase = createClient();
    supabase
      .from("model_pricing")
      .select("model_id, base_price_credits, effective_credits, discount_pct, is_promo, promo_label")
      .eq("is_active", true)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, ModelPricing> = {};
        for (const row of data) map[row.model_id] = row as ModelPricing;
        cache = map;
        setPricing(map);
        setLoading(false);
      });
  }, []);

  return { pricing, loading };
}

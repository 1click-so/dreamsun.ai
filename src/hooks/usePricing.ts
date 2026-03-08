"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

export interface ModelPricing {
  model_id: string;
  resolution: string | null;
  audio_tier: string | null;
  base_price_credits: number;
  effective_credits: number;
  discount_pct: number;
  is_promo: boolean;
  promo_label: string | null;
  pricing_unit: string;          // 'per_generation' | 'per_second'
}

/** Build a composite key for tier lookups: "model_id", "model_id:1080p", "model_id::on", "model_id:720p:on" */
function tierKey(modelId: string, resolution?: string | null, audioTier?: string | null): string {
  const res = resolution ?? "";
  const audio = audioTier ?? "";
  if (!res && !audio) return modelId;
  return `${modelId}:${res}:${audio}`;
}

export interface CreditRange {
  min: number;
  max: number;
}

let cache: Record<string, ModelPricing> | null = null;
let rangesCache: Record<string, CreditRange> | null = null;

export function usePricing() {
  const [pricing, setPricing] = useState<Record<string, ModelPricing>>(cache ?? {});
  const [creditRanges, setCreditRanges] = useState<Record<string, CreditRange>>(rangesCache ?? {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    const supabase = createClient();
    supabase
      .from("model_pricing")
      .select("model_id, resolution, audio_tier, base_price_credits, effective_credits, discount_pct, is_promo, promo_label, pricing_unit")
      .eq("is_active", true)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, ModelPricing> = {};
        const ranges: Record<string, CreditRange> = {};
        for (const row of data) {
          const p = row as ModelPricing;
          // Store under composite key for tier lookups
          map[tierKey(p.model_id, p.resolution, p.audio_tier)] = p;
          // Also store under plain model_id as fallback (first row wins — base/default tier)
          if (!map[p.model_id]) map[p.model_id] = p;
          // Build min/max credit ranges per model_id
          const c = p.effective_credits;
          if (!ranges[p.model_id]) {
            ranges[p.model_id] = { min: c, max: c };
          } else {
            if (c < ranges[p.model_id].min) ranges[p.model_id].min = c;
            if (c > ranges[p.model_id].max) ranges[p.model_id].max = c;
          }
        }
        cache = map;
        rangesCache = ranges;
        setPricing(map);
        setCreditRanges(ranges);
        setLoading(false);
      });
  }, []);

  return { pricing, creditRanges, loading, tierKey };
}

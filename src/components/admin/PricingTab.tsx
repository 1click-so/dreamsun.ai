"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, Input, Spinner, Toggle } from "@/components/ui";
import { cn } from "@/lib/cn";

interface PricingRow {
  id: string;
  model_id: string;
  model_name: string;
  capability: string;
  api_provider: string;
  api_cost_usd: number | null;
  base_price_credits: number;
  discount_pct: number;
  margin_usd: number | null;
  margin_pct: number | null;
  is_active: boolean;
  is_promo: boolean;
  promo_label: string | null;
  resolution: string | null;
  audio_tier: string | null;
  pricing_unit: string;
}

interface EditState {
  base_price_credits?: number;
  discount_pct?: number;
  is_promo?: boolean;
  promo_label?: string | null;
}

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-muted">-</span>;
  const color =
    pct >= 30 ? "text-green-500" : pct >= 15 ? "text-yellow-500" : "text-red-500";
  return <span className={cn("text-xs font-semibold", color)}>{pct.toFixed(0)}%</span>;
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase",
        provider === "fal"
          ? "bg-blue-500/15 text-blue-400"
          : provider === "kie"
            ? "bg-purple-500/15 text-purple-400"
            : "bg-surface text-muted"
      )}
    >
      {provider}
    </span>
  );
}

// Map capabilities to product categories
const CATEGORY_MAP: Record<string, string> = {
  "text-to-image": "Images",
  "image-to-image": "Images",
  "image-to-video": "Videos",
  "motion-control": "Videos",
  "audio-to-video": "Videos",
  relight: "Add-ons",
  upscale: "Add-ons",
  skin_enhance: "Add-ons",
};

const CATEGORY_ORDER = ["Images", "Videos", "Audio", "Add-ons"];

function capabilityLabel(cap: string): string {
  const labels: Record<string, string> = {
    "text-to-image": "text-to-image",
    "image-to-image": "image-to-image",
    "image-to-video": "image-to-video",
    "motion-control": "motion-control",
    "audio-to-video": "audio-to-video",
    relight: "relight",
    upscale: "upscale",
    skin_enhance: "skin-enhance",
  };
  return labels[cap] || cap;
}

function PricingVariantRow({
  row,
  variantLabel,
  onSave,
  onMakePrimary,
  saving,
  switchingProvider,
  hasSiblings,
}: {
  row: PricingRow;
  variantLabel?: string;
  onSave: (id: string, updates: EditState) => void;
  onMakePrimary: (modelId: string, provider: string) => void;
  saving: boolean;
  switchingProvider: boolean;
  hasSiblings: boolean;
}) {
  const [edits, setEdits] = useState<EditState>({});
  const hasChanges = Object.keys(edits).length > 0;

  const current = {
    base_price_credits: edits.base_price_credits ?? row.base_price_credits,
    discount_pct: edits.discount_pct ?? row.discount_pct,
    is_promo: edits.is_promo ?? row.is_promo,
    promo_label: edits.promo_label ?? row.promo_label,
  };

  // Live margin calculation: (credits * $0.01 - api_cost) / (credits * $0.01) * 100
  const revenueUsd = current.base_price_credits * 0.01;
  const apiCost = row.api_cost_usd ?? 0;
  const liveMarginPct = revenueUsd > 0 ? ((revenueUsd - apiCost) / revenueUsd) * 100 : null;

  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition",
        !row.is_active && "opacity-50"
      )}
    >
      {/* Provider */}
      <td className="px-3 py-2">
        <ProviderBadge provider={row.api_provider} />
      </td>

      {/* Role: Primary or Fallback */}
      <td className="px-3 py-2">
        {row.is_active ? (
          <span className="inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-text">
            Primary
          </span>
        ) : hasSiblings ? (
          <button
            onClick={() => onMakePrimary(row.model_id, row.api_provider)}
            disabled={switchingProvider}
            className="inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted transition hover:border-accent/40 hover:text-foreground"
          >
            {switchingProvider ? <Spinner size="xs" /> : "Fallback"}
          </button>
        ) : (
          <span className="text-[10px] text-muted">-</span>
        )}
      </td>

      {/* Variant */}
      <td className="px-3 py-2 text-xs text-muted">
        {variantLabel || "-"}
      </td>

      {/* Resolution / Audio */}
      <td className="px-3 py-2 text-xs text-muted">
        {row.resolution || "-"}
        {row.audio_tier ? ` / ${row.audio_tier}` : ""}
      </td>

      {/* API Cost */}
      <td className="px-3 py-2 text-right text-xs text-muted">
        {row.api_cost_usd !== null ? `$${row.api_cost_usd.toFixed(4)}` : "-"}
      </td>

      {/* Credits (editable) */}
      <td className="px-3 py-2">
        <Input
          type="number"
          value={current.base_price_credits}
          onChange={(e) =>
            setEdits((prev) => ({ ...prev, base_price_credits: Number(e.target.value) }))
          }
          className="w-20 px-2 py-1 text-xs"
          min={0}
          step={1}
        />
      </td>

      {/* Discount */}
      <td className="px-3 py-2">
        <Input
          type="number"
          value={current.discount_pct}
          onChange={(e) =>
            setEdits((prev) => ({ ...prev, discount_pct: Number(e.target.value) }))
          }
          className="w-16 px-2 py-1 text-xs"
          min={0}
          max={100}
          step={1}
        />
      </td>

      {/* Margin (live) */}
      <td className="px-3 py-2 text-right">
        <MarginBadge pct={liveMarginPct} />
      </td>

      {/* Promo */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Toggle
            checked={current.is_promo}
            onChange={(v) => setEdits((prev) => ({ ...prev, is_promo: v }))}
            size="sm"
          />
          {current.is_promo && (
            <Input
              type="text"
              value={current.promo_label || ""}
              onChange={(e) =>
                setEdits((prev) => ({ ...prev, promo_label: e.target.value || null }))
              }
              placeholder="Label"
              className="w-16 px-1 py-0.5 text-[10px]"
            />
          )}
        </div>
      </td>

      {/* Save */}
      <td className="px-3 py-2">
        {hasChanges && (
          <Button
            size="xs"
            onClick={() => {
              onSave(row.id, edits);
              setEdits({});
            }}
            disabled={saving}
          >
            {saving ? <Spinner size="xs" /> : "Save"}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function PricingTab() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [switchingModel, setSwitchingModel] = useState<string | null>(null);
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());

  const fetchPricing = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  // Optimistic save for pricing fields
  const handleSave = async (id: string, updates: EditState) => {
    setSaving(id);

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r };
        if (updates.base_price_credits !== undefined) updated.base_price_credits = updates.base_price_credits;
        if (updates.discount_pct !== undefined) updated.discount_pct = updates.discount_pct;
        if (updates.is_promo !== undefined) updated.is_promo = updates.is_promo;
        if (updates.promo_label !== undefined) updated.promo_label = updates.promo_label;
        return updated;
      })
    );

    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) fetchPricing();
    } catch {
      fetchPricing();
    } finally {
      setSaving(null);
    }
  };

  // Switch primary provider for a model (optimistic)
  const handleMakePrimary = async (modelId: string, newProvider: string) => {
    setSwitchingModel(modelId);

    // Optimistic: flip is_active for this model's rows
    setRows((prev) =>
      prev.map((r) => {
        if (r.model_id !== modelId) return r;
        return { ...r, is_active: r.api_provider === newProvider };
      })
    );

    try {
      const res = await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch_provider", model_id: modelId, new_provider: newProvider }),
      });
      if (!res.ok) fetchPricing();
    } catch {
      fetchPricing();
    } finally {
      setSwitchingModel(null);
    }
  };

  const toggleCap = (cap: string) => {
    setExpandedCaps((prev) => {
      const next = new Set(prev);
      next.has(cap) ? next.delete(cap) : next.add(cap);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  // Derive base model key: strip -edit, -mc suffixes to group related models together
  function baseModelKey(modelId: string): string {
    return modelId.replace(/-edit$/, "").replace(/-mc$/, "");
  }

  // Group by product category, then by base model (flat array of rows per group)
  const byCategory = new Map<string, Map<string, PricingRow[]>>();
  rows.forEach((r) => {
    const category = CATEGORY_MAP[r.capability] || "Other";
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const baseModels = byCategory.get(category)!;
    const base = baseModelKey(r.model_id);
    if (!baseModels.has(base)) baseModels.set(base, []);
    baseModels.get(base)!.push(r);
  });

  // Sort categories in defined order
  const sortedCategories = Array.from(byCategory.entries()).sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a[0]) ?? 99) - (CATEGORY_ORDER.indexOf(b[0]) ?? 99)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{rows.length} pricing rows across {byCategory.size} categories</p>
        <Button variant="ghost" size="xs" onClick={() => {
          if (expandedCaps.size === byCategory.size) {
            setExpandedCaps(new Set());
          } else {
            setExpandedCaps(new Set(byCategory.keys()));
          }
        }}>
          {expandedCaps.size === byCategory.size ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {sortedCategories.map(([category, baseModels]) => {
        const isExpanded = expandedCaps.has(category);
        const totalGroups = baseModels.size;
        const allRows = Array.from(baseModels.values()).flat();
        const activeCount = allRows.filter((r) => r.is_active).length;

        return (
          <Card key={category} className="overflow-hidden p-0">
            <button
              onClick={() => toggleCap(category)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className={cn("text-muted transition-transform", isExpanded && "rotate-90")}
                >
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <span className="text-sm font-semibold text-foreground">
                  {category}
                </span>
                <span className="text-[11px] text-muted">
                  {totalGroups} model{totalGroups !== 1 ? "s" : ""} - {activeCount} active
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border">
                {Array.from(baseModels.entries()).map(([baseKey, groupRows]) => {
                  // Split into variant sub-groups by model_id (e.g. create vs edit)
                  const variantMap = new Map<string, PricingRow[]>();
                  groupRows.forEach((r) => {
                    if (!variantMap.has(r.model_id)) variantMap.set(r.model_id, []);
                    variantMap.get(r.model_id)!.push(r);
                  });

                  // Sort variants: base model first, then -edit, then -mc
                  const sortedVariants = Array.from(variantMap.entries()).sort((a, b) => {
                    const aIsEdit = a[0].endsWith("-edit");
                    const bIsEdit = b[0].endsWith("-edit");
                    const aIsMc = a[0].endsWith("-mc");
                    const bIsMc = b[0].endsWith("-mc");
                    if (aIsEdit !== bIsEdit) return aIsEdit ? 1 : -1;
                    if (aIsMc !== bIsMc) return aIsMc ? 1 : -1;
                    return 0;
                  });

                  // Use the base (non-edit) variant's name for the group header
                  const baseName = sortedVariants[0][1][0].model_name.replace(/\s*\(Edit\)\s*$/i, "");
                  const hasMultipleVariants = sortedVariants.length > 1;
                  const allProviders = new Set(groupRows.map((r) => r.api_provider));
                  const hasMultiProviders = allProviders.size > 1;

                  return (
                    <div key={baseKey} className="border-b border-border last:border-0">
                      {/* Group header */}
                      <div className="flex items-center gap-2 bg-surface/50 px-4 py-2">
                        <span className="text-xs font-semibold text-foreground">
                          {baseName}
                        </span>
                        {hasMultipleVariants && (
                          <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent-text">
                            {sortedVariants.length} variants
                          </span>
                        )}
                        {hasMultiProviders && (
                          <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent-text">
                            fallback ready
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface/30">
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Provider</th>
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Role</th>
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Variant</th>
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Resolution</th>
                              <th className="px-3 py-1.5 text-right font-medium text-muted">API Cost</th>
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Credits</th>
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Discount</th>
                              <th className="px-3 py-1.5 text-right font-medium text-muted">Margin</th>
                              <th className="px-3 py-1.5 text-left font-medium text-muted">Promo</th>
                              <th className="px-3 py-1.5 text-right font-medium text-muted"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedVariants.map(([variantId, variantRows]) => {
                              // Sort within variant: primary first, then fallbacks
                              const sorted = [...variantRows].sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));
                              const variantProviders = new Set(variantRows.map((r) => r.api_provider));
                              const hasSiblings = variantProviders.size > 1;

                              return sorted.map((row) => (
                                <PricingVariantRow
                                  key={row.id}
                                  row={row}
                                  variantLabel={hasMultipleVariants ? capabilityLabel(row.capability) : undefined}
                                  onSave={handleSave}
                                  onMakePrimary={handleMakePrimary}
                                  saving={saving === row.id}
                                  switchingProvider={switchingModel === row.model_id}
                                  hasSiblings={hasSiblings}
                                />
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

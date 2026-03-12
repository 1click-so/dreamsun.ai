"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, Input, Toggle, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

interface PricingRow {
  id: string;
  model_id: string;
  model_name: string;
  capability: string;
  api_provider: string;
  api_cost_usd: number | null;
  base_price_credits: number;
  effective_credits: number;
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
  is_active?: boolean;
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

function CapabilityLabel({ cap }: { cap: string }) {
  const labels: Record<string, string> = {
    "text-to-image": "Text to Image",
    "image-to-image": "Image to Image",
    "image-to-video": "Image to Video",
    "motion-control": "Motion Control",
    "audio-to-video": "Audio to Video",
    relight: "Relight",
    upscale: "Upscale",
    skin_enhance: "Skin Enhance",
  };
  return <>{labels[cap] || cap}</>;
}

function PricingRowEditor({
  row,
  onSave,
  saving,
}: {
  row: PricingRow;
  onSave: (id: string, updates: EditState) => void;
  saving: boolean;
}) {
  const [edits, setEdits] = useState<EditState>({});
  const hasChanges = Object.keys(edits).length > 0;

  const current = {
    base_price_credits: edits.base_price_credits ?? row.base_price_credits,
    discount_pct: edits.discount_pct ?? row.discount_pct,
    is_active: edits.is_active ?? row.is_active,
    is_promo: edits.is_promo ?? row.is_promo,
    promo_label: edits.promo_label ?? row.promo_label,
  };

  // Calculate effective credits preview
  const effectivePreview = current.base_price_credits * (1 - current.discount_pct / 100);

  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition",
        !current.is_active && "opacity-40"
      )}
    >
      {/* Provider */}
      <td className="px-3 py-2">
        <ProviderBadge provider={row.api_provider} />
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

      {/* Base Price (editable) */}
      <td className="px-3 py-2">
        <Input
          type="number"
          value={current.base_price_credits}
          onChange={(e) =>
            setEdits((prev) => ({ ...prev, base_price_credits: Number(e.target.value) }))
          }
          className="w-20 px-2 py-1 text-xs text-right"
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
          className="w-16 px-2 py-1 text-xs text-right"
          min={0}
          max={100}
          step={1}
        />
      </td>

      {/* Effective */}
      <td className="px-3 py-2 text-right text-xs font-medium text-foreground">
        {effectivePreview.toFixed(0)}
      </td>

      {/* Margin */}
      <td className="px-3 py-2 text-right">
        <MarginBadge pct={row.margin_pct} />
      </td>

      {/* Active toggle */}
      <td className="px-3 py-2">
        <Toggle
          checked={current.is_active}
          onChange={(v) => setEdits((prev) => ({ ...prev, is_active: v }))}
          size="sm"
        />
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

  const handleSave = async (id: string, updates: EditState) => {
    setSaving(id);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        fetchPricing();
      }
    } finally {
      setSaving(null);
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

  // Group by capability, then by model
  const byCapability = new Map<string, Map<string, PricingRow[]>>();
  rows.forEach((r) => {
    const cap = r.capability || "unknown";
    if (!byCapability.has(cap)) byCapability.set(cap, new Map());
    const models = byCapability.get(cap)!;
    if (!models.has(r.model_id)) models.set(r.model_id, []);
    models.get(r.model_id)!.push(r);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{rows.length} pricing rows across {byCapability.size} capabilities</p>
        <Button variant="ghost" size="xs" onClick={() => {
          // Expand/collapse all
          if (expandedCaps.size === byCapability.size) {
            setExpandedCaps(new Set());
          } else {
            setExpandedCaps(new Set(byCapability.keys()));
          }
        }}>
          {expandedCaps.size === byCapability.size ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {Array.from(byCapability.entries()).map(([cap, models]) => {
        const isExpanded = expandedCaps.has(cap);
        const totalModels = models.size;
        const activeRows = Array.from(models.values()).flat().filter((r) => r.is_active).length;

        return (
          <Card key={cap} className="overflow-hidden p-0">
            {/* Capability header */}
            <button
              onClick={() => toggleCap(cap)}
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
                  <CapabilityLabel cap={cap} />
                </span>
                <span className="text-[11px] text-muted">
                  {totalModels} model{totalModels !== 1 ? "s" : ""} - {activeRows} active
                </span>
              </div>
            </button>

            {/* Models table */}
            {isExpanded && (
              <div className="border-t border-border">
                {Array.from(models.entries()).map(([modelId, modelRows]) => (
                  <div key={modelId} className="border-b border-border last:border-0">
                    {/* Model name header */}
                    <div className="bg-surface/50 px-4 py-2">
                      <span className="text-xs font-semibold text-foreground">
                        {modelRows[0].model_name}
                      </span>
                      <span className="ml-2 text-[10px] text-muted">{modelId}</span>
                    </div>

                    {/* Rows table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-surface/30">
                            <th className="px-3 py-1.5 text-left font-medium text-muted">Provider</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted">Res / Audio</th>
                            <th className="px-3 py-1.5 text-right font-medium text-muted">API Cost</th>
                            <th className="px-3 py-1.5 text-right font-medium text-muted">Base Cr.</th>
                            <th className="px-3 py-1.5 text-right font-medium text-muted">Disc %</th>
                            <th className="px-3 py-1.5 text-right font-medium text-muted">Effective</th>
                            <th className="px-3 py-1.5 text-right font-medium text-muted">Margin</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted">Active</th>
                            <th className="px-3 py-1.5 text-left font-medium text-muted">Promo</th>
                            <th className="px-3 py-1.5 text-right font-medium text-muted"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelRows.map((row) => (
                            <PricingRowEditor
                              key={row.id}
                              row={row}
                              onSave={handleSave}
                              saving={saving === row.id}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

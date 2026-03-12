"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ModelEntry {
  model_id: string;
  model_name: string;
  capability: string;
  providers: string[];
  active_provider: string | null;
  has_fallback: boolean;
  rows: Array<{ id: string; api_provider: string; is_active: boolean }>;
}

interface ProviderStat {
  name: string;
  active_models: number;
  total_rows: number;
}

interface ProvidersData {
  providers: ProviderStat[];
  models: ModelEntry[];
}

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

/**
 * Provider toggle pill - fal | kie
 * For models with both providers, shows a segmented toggle.
 * For single-provider models, shows a static badge.
 */
function ProviderToggle({
  model,
  onSwitch,
  switching,
}: {
  model: ModelEntry;
  onSwitch: (modelId: string, newProvider: string) => void;
  switching: boolean;
}) {
  if (!model.has_fallback) {
    // Single provider - just show it
    return (
      <span
        className={cn(
          "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
          model.active_provider === "fal"
            ? "bg-blue-500/15 text-blue-400"
            : "bg-purple-500/15 text-purple-400"
        )}
      >
        {model.active_provider || "none"}
      </span>
    );
  }

  // Multi-provider - segmented toggle
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-surface p-0.5">
      {model.providers.map((p) => {
        const isActive = p === model.active_provider;
        return (
          <button
            key={p}
            onClick={() => {
              if (!isActive && !switching) onSwitch(model.model_id, p);
            }}
            disabled={switching}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold transition",
              isActive
                ? p === "fal"
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                  : "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30"
                : "text-muted hover:text-foreground",
              switching && "opacity-50 cursor-wait"
            )}
          >
            {switching && isActive ? <Spinner size="xs" className="inline" /> : p}
          </button>
        );
      })}
    </div>
  );
}

export function ProvidersTab() {
  const [data, setData] = useState<ProvidersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const fetchProviders = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Optimistic switch
  const switchProvider = async (modelId: string, newProvider: string) => {
    setSwitching(modelId);

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: prev.models.map((m) =>
          m.model_id === modelId ? { ...m, active_provider: newProvider } : m
        ),
      };
    });

    try {
      const res = await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch_provider", model_id: modelId, new_provider: newProvider }),
      });
      if (!res.ok) fetchProviders(); // revert on failure
    } catch {
      fetchProviders();
    } finally {
      setSwitching(null);
    }
  };

  const bulkSwitch = async (from: string, to: string) => {
    setSwitching("bulk");
    try {
      await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_switch", from_provider: from, to_provider: to }),
      });
      fetchProviders();
    } finally {
      setSwitching(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data) {
    return <p className="py-10 text-center text-sm text-muted">Failed to load provider data.</p>;
  }

  const { providers, models } = data;

  // Group models by category
  const byCategory = new Map<string, ModelEntry[]>();
  models.forEach((m) => {
    const cat = CATEGORY_MAP[m.capability] || "Other";
    const list = byCategory.get(cat) || [];
    list.push(m);
    byCategory.set(cat, list);
  });

  const sortedCategories = Array.from(byCategory.entries()).sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a[0]) ?? 99) - (CATEGORY_ORDER.indexOf(b[0]) ?? 99)
  );

  // Stats
  const totalModels = models.length;
  const withFallback = models.filter((m) => m.has_fallback).length;

  return (
    <div className="space-y-6">
      {/* Summary + bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {providers.map((p) => (
            <span key={p.name} className="text-xs text-muted">
              <span
                className={cn(
                  "mr-1 inline-block h-2 w-2 rounded-full",
                  p.name === "fal" ? "bg-blue-400" : "bg-purple-400"
                )}
              />
              {p.name}: {p.active_models} active
            </span>
          ))}
          <span className="text-xs text-muted">
            {withFallback}/{totalModels} have fallback
          </span>
        </div>

        {providers.length >= 2 && (
          <div className="flex items-center gap-2">
            {providers.map((from) =>
              providers
                .filter((to) => to.name !== from.name)
                .map((to) => (
                  <Button
                    key={`${from.name}-${to.name}`}
                    variant="ghost"
                    size="xs"
                    onClick={() => bulkSwitch(from.name, to.name)}
                    disabled={switching === "bulk"}
                  >
                    {switching === "bulk" ? <Spinner size="xs" /> : `All to ${to.name}`}
                  </Button>
                ))
            )}
          </div>
        )}
      </div>

      {/* Models by category */}
      {sortedCategories.map(([category, categoryModels]) => (
        <Card key={category} className="overflow-hidden p-0">
          <div className="px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold text-foreground">{category}</span>
            <span className="ml-2 text-[11px] text-muted">{categoryModels.length} models</span>
          </div>

          <div className="divide-y divide-border">
            {categoryModels.map((m) => (
              <div
                key={m.model_id}
                className="flex items-center justify-between px-4 py-2.5 transition hover:bg-surface-hover"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground">{m.model_name}</span>
                  <span className="ml-2 text-[10px] text-muted">{m.model_id}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {!m.has_fallback && (
                    <span className="text-[10px] text-muted">no fallback</span>
                  )}
                  <ProviderToggle
                    model={m}
                    onSwitch={switchProvider}
                    switching={switching === m.model_id}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Card, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ProviderStat {
  name: string;
  active_models: number;
  total_models: number;
  total_rows: number;
}

interface ModelEntry {
  model_id: string;
  model_name: string;
  capability: string;
  providers: string[];
  active_provider: string | null;
  has_fallback: boolean;
  rows: Array<{ id: string; api_provider: string; is_active: boolean }>;
}

interface ProvidersData {
  providers: ProviderStat[];
  models: ModelEntry[];
}

function ProviderBadge({ provider, active }: { provider: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase transition",
        provider === "fal"
          ? active
            ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
            : "bg-blue-500/10 text-blue-400/50"
          : active
            ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30"
            : "bg-purple-500/10 text-purple-400/50"
      )}
    >
      {provider}
    </span>
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

  const switchProvider = async (modelId: string, newProvider: string) => {
    setSwitching(modelId);
    try {
      await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch_provider", model_id: modelId, new_provider: newProvider }),
      });
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
  const multiProviderModels = models.filter((m) => m.has_fallback);

  return (
    <div className="space-y-6">
      {/* Provider summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {providers.map((p) => (
          <Card key={p.name} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ProviderBadge provider={p.name} active />
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-[11px] text-muted">
                  {p.active_models} active / {p.total_rows} total rows
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bulk actions */}
      {providers.length >= 2 && (
        <Card>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Bulk Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            {providers.map((from) =>
              providers
                .filter((to) => to.name !== from.name)
                .map((to) => (
                  <Button
                    key={`${from.name}-${to.name}`}
                    variant="secondary"
                    size="xs"
                    onClick={() => bulkSwitch(from.name, to.name)}
                    disabled={switching === "bulk"}
                  >
                    {switching === "bulk" ? (
                      <Spinner size="xs" />
                    ) : (
                      `Switch all ${from.name} to ${to.name}`
                    )}
                  </Button>
                ))
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted">
            Only switches models that have rows for both providers.
          </p>
        </Card>
      )}

      {/* Multi-provider models */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Models with Multiple Providers ({multiProviderModels.length})
        </h3>
        {multiProviderModels.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">No models have multiple providers configured.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-3 py-2 text-left font-medium text-muted">Model</th>
                  <th className="px-3 py-2 text-left font-medium text-muted">Capability</th>
                  <th className="px-3 py-2 text-left font-medium text-muted">Providers</th>
                  <th className="px-3 py-2 text-right font-medium text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {multiProviderModels.map((m) => (
                  <tr key={m.model_id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{m.model_name}</span>
                      <br />
                      <span className="text-[10px] text-muted">{m.model_id}</span>
                    </td>
                    <td className="px-3 py-2 text-muted">{m.capability}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {m.providers.map((p) => (
                          <ProviderBadge
                            key={p}
                            provider={p}
                            active={p === m.active_provider}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.providers
                        .filter((p) => p !== m.active_provider)
                        .map((p) => (
                          <Button
                            key={p}
                            variant="ghost"
                            size="xs"
                            onClick={() => switchProvider(m.model_id, p)}
                            disabled={switching === m.model_id}
                          >
                            {switching === m.model_id ? (
                              <Spinner size="xs" />
                            ) : (
                              `Switch to ${p}`
                            )}
                          </Button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All models list */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          All Models ({models.length})
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-3 py-2 text-left font-medium text-muted">Model</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Capability</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Active Provider</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model_id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{m.model_name}</td>
                  <td className="px-3 py-2 text-muted">{m.capability}</td>
                  <td className="px-3 py-2">
                    {m.active_provider ? (
                      <ProviderBadge provider={m.active_provider} active />
                    ) : (
                      <span className="text-muted">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.has_fallback ? (
                      <span className="text-accent-text text-[10px] font-medium">Yes</span>
                    ) : (
                      <span className="text-muted text-[10px]">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Stats {
  total_credits_in: number;
  total_credits_spent: number;
  total_refunded: number;
  stripe_revenue_usd: string;
  total_api_cost_usd: string;
  total_generations: number;
  total_users: number;
}

interface BreakdownEntry {
  count: number;
  credits: number;
  api_cost: number;
  name?: string;
}

interface OverviewData {
  stats: Stats;
  breakdown: {
    by_capability: Record<string, BreakdownEntry>;
    by_provider: Record<string, BreakdownEntry>;
    by_model: Record<string, BreakdownEntry>;
  };
  provider_spending: {
    fal: { total: number; period: string } | null;
    kie: null;
  };
  period: string;
}

type Period = "7d" | "30d" | "all";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-xl font-bold tracking-tight text-foreground">{value}</span>
      {sub && <span className="text-[11px] text-muted">{sub}</span>}
    </Card>
  );
}

function BreakdownTable({
  title,
  data,
  showName,
}: {
  title: string;
  data: Record<string, BreakdownEntry>;
  showName?: boolean;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1].credits - a[1].credits);
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-3 py-2 text-left font-medium text-muted">Name</th>
              <th className="px-3 py-2 text-right font-medium text-muted">Count</th>
              <th className="px-3 py-2 text-right font-medium text-muted">Credits</th>
              <th className="px-3 py-2 text-right font-medium text-muted">API Cost</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, entry]) => (
              <tr key={key} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">
                  {showName && entry.name ? entry.name : key}
                </td>
                <td className="px-3 py-2 text-right text-muted">{entry.count.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-foreground">{entry.credits.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-muted">${entry.api_cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/overview?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data) {
    return <p className="py-10 text-center text-sm text-muted">Failed to load overview data.</p>;
  }

  const { stats, breakdown, provider_spending } = data;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Stripe Revenue" value={`$${stats.stripe_revenue_usd}`} sub="from payments" />
        <StatCard label="API Costs (est.)" value={`$${stats.total_api_cost_usd}`} sub={`${period === "all" ? "all time" : `last ${period}`}`} />
        <StatCard label="Credits Spent" value={stats.total_credits_spent.toLocaleString()} sub={`${stats.total_refunded.toLocaleString()} refunded (excl. admin)`} />
        <StatCard label="Generations" value={stats.total_generations.toLocaleString()} sub={`${period === "all" ? "all time" : `last ${period}`}`} />
        <StatCard label="Users" value={stats.total_users.toLocaleString()} sub="registered accounts" />
      </div>

      {/* Provider spending */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Provider Spending (from API)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">fal.ai</span>
              {provider_spending.fal && (
                <p className="text-[10px] text-muted">{provider_spending.fal.period}</p>
              )}
            </div>
            <span className={cn("text-sm font-bold", provider_spending.fal !== null ? "text-accent-text" : "text-muted")}>
              {provider_spending.fal !== null ? `$${provider_spending.fal.total.toFixed(2)}` : "N/A"}
            </span>
          </Card>
          <Card className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">Kie.ai</span>
            </div>
            <span className="text-sm font-bold text-muted">Manual check</span>
          </Card>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">Breakdown period:</span>
        <div className="inline-flex items-center rounded-full border border-border bg-surface p-0.5">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                period === p ? "bg-accent text-black" : "text-muted hover:text-foreground"
              )}
            >
              {p === "all" ? "All time" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable title="By Capability" data={breakdown.by_capability} />
        <BreakdownTable title="By Provider" data={breakdown.by_provider} />
      </div>
      <BreakdownTable title="By Model" data={breakdown.by_model} showName />
    </div>
  );
}

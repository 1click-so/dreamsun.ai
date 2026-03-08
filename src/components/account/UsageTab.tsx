"use client";

import { useState, useEffect, useCallback } from "react";

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  pool: string;
  balance_after: number;
  description: string;
}

const TYPE_LABELS: Record<string, string> = {
  subscription_grant: "Subscription",
  subscription_reset: "Renewal",
  topup_purchase: "Purchase",
  generation_deduct: "Generation",
  refund: "Refund",
  generation_refund: "Refund",
};

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] || type.replace(/_/g, " ");

  const isCredit =
    type.includes("grant") ||
    type.includes("purchase") ||
    type.includes("reset");
  const isRefund = type.includes("refund");

  let classes = "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ";
  if (isRefund) {
    classes += "bg-amber-500/15 text-amber-500";
  } else if (isCredit) {
    classes += "bg-accent/15 text-accent";
  } else {
    classes += "bg-muted/15 text-muted";
  }

  return <span className={classes}>{label}</span>;
}

export function UsageTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (p: number, append = false) => {
    const isFirst = p === 1;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/account/usage?page=${p}&limit=20`);
      const data = await res.json();
      setTransactions((prev) =>
        append ? [...prev, ...data.transactions] : data.transactions
      );
      setHasMore(data.has_more);
      setPage(p);
    } finally {
      if (isFirst) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted">Loading...</div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/10">
          <svg
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="none"
            className="text-muted"
          >
            <path
              d="M2 4h12M2 8h8M2 12h10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">
          No transactions yet
        </p>
        <p className="mt-1 text-xs text-muted">
          Your credit history will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Description</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Credits</th>
            <th className="px-4 py-3 font-medium text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const isPositive = tx.amount > 0;
            return (
              <tr
                key={tx.id}
                className="border-b border-border/50 last:border-0 transition hover:bg-surface-hover/50"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>{formatDate(tx.created_at)}</div>
                  <div className="text-muted">{formatTime(tx.created_at)}</div>
                </td>
                <td className="px-4 py-3 text-foreground">
                  {tx.description}
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={tx.type} />
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${
                    isPositive ? "text-accent" : "text-foreground"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {tx.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-muted">
                  {tx.balance_after.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hasMore && (
        <div className="border-t border-border p-4 text-center">
          <button
            onClick={() => fetchPage(page + 1, true)}
            disabled={loadingMore}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted transition hover:text-foreground hover:border-foreground/20 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

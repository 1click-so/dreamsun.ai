"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AccountTab } from "@/components/account/AccountTab";
import { BillingTab } from "@/components/account/BillingTab";
import { UsageTab } from "@/components/account/UsageTab";

type Tab = "account" | "billing" | "usage";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "billing", label: "Billing" },
  { id: "usage", label: "Usage" },
];

function AccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramTab = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    paramTab && TABS.some((t) => t.id === paramTab) ? paramTab : "account"
  );

  const handleTabChange = (t: Tab) => {
    setTab(t);
    const url = t === "account" ? "/account" : `/account?tab=${t}`;
    router.replace(url, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        {/* Header */}
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your account, billing, and usage.
        </p>

        {/* Tabs */}
        <div className="mt-6 mb-8">
          <div className="inline-flex items-center rounded-full border border-border bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  tab === t.id
                    ? "bg-accent text-black"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === "account" && <AccountTab />}
        {tab === "billing" && <BillingTab />}
        {tab === "usage" && <UsageTab />}
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}

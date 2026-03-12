"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { PricingTab } from "@/components/admin/PricingTab";
import { Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase-browser";

type Tab = "overview" | "pricing";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pricing", label: "Models & Pricing" },
];

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramTab = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    paramTab && TABS.some((t) => t.id === paramTab) ? paramTab : "overview"
  );
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Check admin status on mount
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/admin");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        router.replace("/explore");
        return;
      }
      setAuthorized(true);
    };
    checkAdmin();
  }, [router]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    const url = t === "overview" ? "/admin" : `/admin?tab=${t}`;
    router.replace(url, { scroll: false });
  };

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Header */}
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          Models, pricing, and financial overview.
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
        {tab === "overview" && <OverviewTab />}
        {tab === "pricing" && <PricingTab />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminContent />
    </Suspense>
  );
}

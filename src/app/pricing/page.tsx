"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { PricingPanel } from "@/components/PricingPanel";

function PricingPageInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") as "plans" | "topup" | null;

  return <PricingPanel initialTab={tab === "plans" ? "plans" : "topup"} />;
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <Suspense fallback={null}>
        <PricingPageInner />
      </Suspense>
    </div>
  );
}

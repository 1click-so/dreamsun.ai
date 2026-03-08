"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { invalidateCredits, useCredits } from "@/hooks/useCredits";

function ReturnContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const { total } = useCredits();

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    // Give webhook a moment to process, then refresh credits
    const timer = setTimeout(() => {
      invalidateCredits();
      setStatus("success");
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      {status === "loading" && (
        <>
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-muted">Processing your payment...</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Payment Successful</h1>
          <p className="mt-2 text-sm text-muted">
            Your credits have been updated. You now have <span className="font-semibold text-foreground">{total.toLocaleString()}</span> credits.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/images"
              className="rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-accent-hover"
            >
              Start Creating
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-border px-5 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
            >
              Back to Pricing
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            We couldn&apos;t verify your payment. If you were charged, your credits will appear shortly.
          </p>
          <Link
            href="/pricing"
            className="mt-6 rounded-lg border border-border px-5 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            Back to Pricing
          </Link>
        </>
      )}
    </main>
  );
}

export default function CheckoutReturnPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <Suspense fallback={
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="mt-4 text-sm text-muted">Loading...</p>
        </main>
      }>
        <ReturnContent />
      </Suspense>
    </div>
  );
}

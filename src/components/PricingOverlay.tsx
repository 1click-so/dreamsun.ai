"use client";

import { useEffect } from "react";
import { usePricingOverlay } from "@/contexts/PricingOverlay";
import { PricingPanel } from "@/components/PricingPanel";

export function PricingOverlay() {
  const { isOpen, closePricing, activeTab } = usePricingOverlay();

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePricing();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, closePricing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closePricing}
      />

      {/* Panel */}
      <div
        className="relative z-10 mx-auto mt-6 flex w-full max-w-[1400px] flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:mt-8"
        style={{
          maxHeight: "calc(100vh - 1.5rem)",
          animation: "pricing-slide-up 200ms ease-out",
        }}
      >
        {/* Close button */}
        <div className="flex items-center justify-end px-5 pt-4">
          <button
            onClick={closePricing}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover hover:text-foreground"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable content — hide scrollbar */}
        <div className="scrollbar-none flex-1 overflow-y-auto pb-8">
          <PricingPanel initialTab={activeTab} />
        </div>
      </div>
    </div>
  );
}

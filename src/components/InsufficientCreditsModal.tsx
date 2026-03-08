"use client";

import { Modal } from "@/components/ui/Modal";
import { CreditIcon } from "@/components/ModelSelector";
import { CREDIT_PACKAGES, type CreditPackage } from "@/lib/stripe";
import { usePricingOverlay } from "@/contexts/PricingOverlay";

interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
  required?: number;
  available?: number;
}

/** Quick-buy packages: show the 3 smallest that cover the deficit */
function getRecommendedPackages(deficit: number): CreditPackage[] {
  const sorted = [...CREDIT_PACKAGES].sort((a, b) => a.credits - b.credits);
  const coverIdx = sorted.findIndex((p) => p.credits >= deficit);
  if (coverIdx === -1) return sorted.slice(-3);
  const start = Math.max(0, coverIdx - 1);
  return sorted.slice(start, start + 3);
}

export function InsufficientCreditsModal({
  open,
  onClose,
  required,
  available,
}: InsufficientCreditsModalProps) {
  const { openPricing } = usePricingOverlay();
  const deficit = (required ?? 0) - (available ?? 0);
  const recommended = getRecommendedPackages(deficit);

  const goToPricing = () => {
    openPricing("topup");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-destructive">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h3 className="text-base font-semibold text-foreground">Not enough credits</h3>

        {required !== undefined && available !== undefined && (
          <div className="mt-2 flex items-center justify-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-muted">
              <CreditIcon size={11} />
              Need <span className="font-semibold text-foreground">{required.toLocaleString()}</span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1 text-muted">
              Have <span className="font-semibold text-destructive">{available.toLocaleString()}</span>
            </span>
          </div>
        )}

        {/* Quick-buy packages */}
        <div className="mt-5 w-full space-y-2">
          {recommended.map((pkg) => {
            const coversDeficit = pkg.credits >= deficit;
            return (
              <button
                key={pkg.id}
                onClick={goToPricing}
                className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition ${
                  coversDeficit
                    ? "border-accent/40 bg-accent/[0.04] hover:bg-accent/[0.08]"
                    : "border-border hover:bg-surface-hover"
                }`}
              >
                <div>
                  <span className="text-sm font-semibold text-foreground">
                    {pkg.credits.toLocaleString()} credits
                  </span>
                  {pkg.discountPct > 0 && (
                    <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                      +{pkg.discountPct}% bonus
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-foreground">${pkg.dollars}</span>
              </button>
            );
          })}
        </div>

        {/* View all */}
        <button
          onClick={goToPricing}
          className="mt-3 text-[11px] text-muted underline transition hover:text-foreground"
        >
          View all packages
        </button>
      </div>
    </Modal>
  );
}

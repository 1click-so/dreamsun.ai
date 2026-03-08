"use client";

import type { ReactNode } from "react";
import { PricingOverlayProvider } from "@/contexts/PricingOverlay";
import { PricingOverlay } from "@/components/PricingOverlay";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PricingOverlayProvider>
      {children}
      <PricingOverlay />
    </PricingOverlayProvider>
  );
}

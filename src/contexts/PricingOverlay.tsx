"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface PricingOverlayCtx {
  isOpen: boolean;
  /** Open the pricing overlay. Pass "topup" or "plans" to pre-select a tab. */
  openPricing: (tab?: "plans" | "topup") => void;
  closePricing: () => void;
  activeTab: "plans" | "topup";
}

const Ctx = createContext<PricingOverlayCtx>({
  isOpen: false,
  openPricing: () => {},
  closePricing: () => {},
  activeTab: "topup",
});

export function usePricingOverlay() {
  return useContext(Ctx);
}

export function PricingOverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"plans" | "topup">("topup");

  const openPricing = useCallback((tab?: "plans" | "topup") => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closePricing = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({ isOpen, openPricing, closePricing, activeTab }),
    [isOpen, openPricing, closePricing, activeTab]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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

  return (
    <Ctx.Provider value={{ isOpen, openPricing, closePricing, activeTab }}>
      {children}
    </Ctx.Provider>
  );
}

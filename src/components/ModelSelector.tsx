"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import type { ModelConfig } from "@/lib/models";
import type { ModelPricing } from "@/hooks/usePricing";

export function CreditIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L14 5.5V10.5L8 15L2 10.5V5.5L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 4.5L11 6.5V9.5L8 11.5L5 9.5V6.5L8 4.5Z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function CreditBadge({ credits, discount, promoLabel }: { credits: number; discount?: number; promoLabel?: string | null }) {
  if (!credits || credits <= 0) return null;
  const hasDiscount = (discount ?? 0) > 0;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {hasDiscount && promoLabel && (
        <span className="rounded-sm bg-accent/15 px-1.5 py-px text-[9px] font-semibold text-accent-text">
          {promoLabel}
        </span>
      )}
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <CreditIcon size={11} />
        <span className="font-medium">{credits}</span>
      </span>
    </span>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  Google: "bg-blue-500/20 text-blue-400",
  xAI: "bg-orange-500/20 text-orange-400",
  "Black Forest Labs": "bg-purple-500/20 text-purple-400",
};

function ProviderIcon({ provider }: { provider?: string }) {
  const colors = PROVIDER_COLORS[provider ?? ""] ?? "bg-accent/20 text-accent-text";
  const letter = provider?.[0] ?? "?";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${colors}`}>
      {letter}
    </span>
  );
}

function TagBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted">
      {label}
    </span>
  );
}

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  pricing?: Record<string, ModelPricing>;
}

export function ModelSelector({ models, selectedIds, onChange, pricing }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, sidebarRight: 0 });

  useEffect(() => setMounted(true), []);

  // Position: panel starts at the right edge of the sidebar, top-aligned with trigger
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    // Find the sidebar (closest aside ancestor)
    const sidebar = triggerRef.current.closest("aside");
    const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : triggerRect.right;
    setPos({ top: triggerRect.top, sidebarRight });
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      const sidebar = triggerRef.current!.closest("aside");
      const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : triggerRect.right;
      setPos({ top: triggerRect.top, sidebarRight });
    };
    const scrollParent = triggerRef.current.closest("[class*='overflow-y']");
    scrollParent?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      scrollParent?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const selectedModels = models.filter((m) => selectedIds.includes(m.id));
  const label =
    selectedModels.length === 0
      ? "Select models"
      : selectedModels.length === 1
        ? selectedModels[0].name
        : `${selectedModels.length} models`;

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    if (next.length === 0) return;
    onChange(next);
  };

  const featured = models.filter((m) => m.featured);
  const lora = models.filter((m) => m.loras && m.loras.length > 0);
  const other = models.filter((m) => !m.featured && !(m.loras && m.loras.length > 0));

  const availableWidth = typeof window !== "undefined" ? window.innerWidth - pos.sidebarRight - 24 : 600;
  const availableHeight = typeof window !== "undefined" ? window.innerHeight - pos.top - 24 : 500;

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim over gallery */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Panel over the gallery area */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: -16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[9999]"
            style={{
              top: pos.top,
              left: pos.sidebarRight + 12,
              width: Math.min(availableWidth, 520),
              maxHeight: Math.min(availableHeight, 560),
            }}
          >
            <div
              className="model-scroll flex h-full flex-col rounded-2xl border border-border bg-surface shadow-2xl"
              style={{ maxHeight: Math.min(availableHeight, 560), overflowY: "auto" }}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-surface px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Choose Model</h3>
                  <p className="mt-0.5 text-[10px] text-muted">Select one or more for parallel generation</p>
                </div>
                {selectedIds.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent-text">
                      {selectedIds.length} selected
                    </span>
                    <button
                      onClick={() => onChange([selectedIds[0]])}
                      className="text-[10px] text-muted transition hover:text-foreground"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Model list */}
              <div className="flex-1 px-1 py-1">
                {featured.length > 0 && (
                  <ModelSection label="Featured" models={featured} selectedIds={selectedIds} onToggle={toggle} pricing={pricing} />
                )}
                {lora.length > 0 && (
                  <ModelSection label="Custom LoRA" models={lora} selectedIds={selectedIds} onToggle={toggle} pricing={pricing} />
                )}
                {other.length > 0 && (
                  <ModelSection
                    label={featured.length > 0 || lora.length > 0 ? "Other" : undefined}
                    models={other}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    pricing={pricing}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 rounded-b-2xl border-t border-border bg-surface px-4 py-2.5">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-accent py-2 text-xs font-semibold text-black transition hover:bg-accent-hover"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition hover:border-accent/30 focus:border-accent"
      >
        {selectedModels.length === 1 && (
          <ProviderIcon provider={selectedModels[0].provider} />
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{label}</span>
          {selectedModels.length === 1 && (
            <span className="block truncate text-[10px] text-muted">{selectedModels[0].provider}</span>
          )}
        </div>
        {pricing && selectedModels.length >= 1 && (() => {
          const totalCredits = selectedModels.reduce((sum, m) => sum + (pricing[m.id]?.effective_credits ?? 0), 0);
          return totalCredits > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
              <CreditIcon size={11} />
              <span className="font-medium">{totalCredits}</span>
            </span>
          ) : null;
        })()}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M3.5 5.25l3.5 3.5 3.5-3.5" />
        </svg>
      </button>

      {mounted && createPortal(panel, document.body)}
    </>
  );
}

function ModelSection({
  label,
  models,
  selectedIds,
  onToggle,
  pricing,
}: {
  label?: string;
  models: ModelConfig[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  pricing?: Record<string, ModelPricing>;
}) {
  return (
    <div>
      {label && (
        <div className="px-4 pt-3 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        </div>
      )}
      <div className="space-y-1 px-1">
      {models.map((m) => {
        const checked = selectedIds.includes(m.id);
        return (
          <button
            key={m.id}
            onClick={() => onToggle(m.id)}
            className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
              checked ? "bg-accent/8" : "hover:bg-surface-hover"
            }`}
          >
            {/* Checkbox */}
            <span
              className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
                checked ? "border-accent bg-accent" : "border-border group-hover:border-accent/40"
              }`}
            >
              {checked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 5l2.5 2.5L8 3" />
                </svg>
              )}
            </span>

            {/* Provider icon */}
            <ProviderIcon provider={m.provider} />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-semibold ${checked ? "text-accent-text" : "text-foreground"}`}>
                  {m.name}
                </span>
                {m.badges?.map((badge) => (
                  <span
                    key={badge}
                    className={`rounded-sm px-1.5 py-px text-[9px] font-bold uppercase leading-tight ${
                      badge === "New"
                        ? "border border-accent text-accent-text"
                        : "bg-accent text-black shadow-[0_0_6px_var(--color-accent)]"
                    }`}
                  >
                    {badge}
                  </span>
                ))}
                {pricing?.[m.id] && (
                  <CreditBadge
                    credits={pricing[m.id].effective_credits}
                    discount={pricing[m.id].discount_pct}
                    promoLabel={pricing[m.id].promo_label}
                  />
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                {m.description}
              </p>
              {m.tags && m.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.tags.map((tag) => <TagBadge key={tag} label={tag} />)}
                </div>
              )}
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}

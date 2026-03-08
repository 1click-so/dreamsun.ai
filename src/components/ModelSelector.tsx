"use client";

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { ModelPricing, CreditRange } from "@/hooks/usePricing";

export function CreditIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L14 5.5V10.5L8 15L2 10.5V5.5L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 4.5L11 6.5V9.5L8 11.5L5 9.5V6.5L8 4.5Z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function CreditBadge({ credits, creditsMax, discount, promoLabel }: { credits: number; creditsMax?: number; discount?: number; promoLabel?: string | null }) {
  if (!credits || credits <= 0) return null;
  const hasDiscount = (discount ?? 0) > 0;
  const showRange = creditsMax != null && creditsMax > credits;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {hasDiscount && promoLabel && (
        <span className="rounded-sm bg-accent/15 px-1.5 py-px text-[9px] font-semibold text-accent-text">
          {promoLabel}
        </span>
      )}
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <CreditIcon size={11} />
        <span className="font-medium">{showRange ? `${credits}–${creditsMax}` : credits}</span>
      </span>
    </span>
  );
}

/** Minimal model shape accepted by the selector. Both image and video models can satisfy this. */
export interface SelectorModel {
  id: string;
  name: string;
  description?: string;
  /** Provider name — used for icon letter fallback and trigger subtitle */
  provider?: string;
  /** Override icon letter (defaults to first char of provider) */
  iconLetter?: string;
  /** Override icon color classes (defaults to PROVIDER_COLORS lookup) */
  iconColors?: string;
  tags?: string[];
  featured?: boolean;
  badges?: string[];
  /** Group label for sectioning — models with same group appear under a shared header */
  group?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  Google: "bg-blue-500/20 text-blue-400",
  xAI: "bg-orange-500/20 text-orange-400",
  "Black Forest Labs": "bg-purple-500/20 text-purple-400",
};

function ProviderIcon({ model }: { model: SelectorModel }) {
  const colors = model.iconColors ?? PROVIDER_COLORS[model.provider ?? ""] ?? "bg-accent/20 text-accent-text";
  const letter = model.iconLetter ?? model.provider?.[0] ?? "?";
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
  models: SelectorModel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  pricing?: Record<string, ModelPricing>;
  creditRanges?: Record<string, CreditRange>;
  /** "multi" = checkbox multi-select (default), "single" = select one and close */
  mode?: "single" | "multi";
  /** Panel title */
  title?: string;
  /** Panel subtitle */
  subtitle?: string;
}

export function ModelSelector({
  models, selectedIds, onChange, pricing, creditRanges,
  mode = "multi",
  title,
  subtitle,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, sidebarRight: 0 });

  useEffect(() => setMounted(true), []);

  // Clear search on close, focus on open
  useEffect(() => {
    if (!open) {
      setSearch("");
    } else {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
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
      ? "Select model"
      : selectedModels.length === 1
        ? selectedModels[0].name
        : `${selectedModels.length} models`;

  const handleSelect = (id: string) => {
    if (mode === "single") {
      onChange([id]);
      setOpen(false);
    } else {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      if (next.length === 0) return;
      onChange(next);
    }
  };

  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.provider?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.group?.toLowerCase().includes(q) ||
      m.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [models, search]);

  // Build sections from group field
  const sections = useMemo(() => {
    const result: { label?: string; models: SelectorModel[] }[] = [];
    const hasGroups = filteredModels.some((m) => m.group);
    if (hasGroups) {
      const groupOrder: string[] = [];
      const groupMap = new Map<string, SelectorModel[]>();
      for (const m of filteredModels) {
        const g = m.group ?? "";
        if (!groupMap.has(g)) {
          groupOrder.push(g);
          groupMap.set(g, []);
        }
        groupMap.get(g)!.push(m);
      }
      for (const g of groupOrder) {
        result.push({ label: g || undefined, models: groupMap.get(g)! });
      }
    } else {
      result.push({ label: undefined, models: filteredModels });
    }
    return result;
  }, [filteredModels]);

  const availableWidth = typeof window !== "undefined" ? window.innerWidth - pos.sidebarRight - 24 : 600;
  const availableHeight = typeof window !== "undefined" ? window.innerHeight - pos.top - 24 : 500;

  const panelTitle = title ?? "Choose Model";
  const panelSubtitle = subtitle ?? (mode === "multi" ? "Select one or more for parallel generation" : "Select a model");

  const panel = open ? (
        <>
          <div
            className="panel-backdrop fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          <div
            ref={panelRef}
            className="panel-slide fixed z-[9999]"
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
              <div className="sticky top-0 z-10 rounded-t-2xl border-b border-border bg-surface">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{panelTitle}</h3>
                    <p className="mt-0.5 text-[10px] text-muted">{panelSubtitle}</p>
                  </div>
                  {mode === "multi" && selectedIds.length > 1 && (
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
                {/* Search */}
                <div className="px-3 pb-2.5">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 focus-within:border-accent/40">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted">
                      <circle cx="6" cy="6" r="4.5" />
                      <path d="M9.5 9.5L13 13" />
                    </svg>
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search models..."
                      className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="shrink-0 text-muted transition hover:text-foreground">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 2l6 6M8 2l-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Model list */}
              <div className="flex-1 px-1 py-1">
                {filteredModels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs text-muted">No models match &ldquo;{search}&rdquo;</p>
                  </div>
                ) : (
                  sections.map((section, i) => (
                    <ModelSection
                      key={section.label ?? `section-${i}`}
                      label={section.label}
                      models={section.models}
                      selectedIds={selectedIds}
                      onSelect={handleSelect}
                      pricing={pricing}
                      creditRanges={creditRanges}
                    />
                  ))
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
          </div>
        </>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition hover:border-accent/30 focus:border-accent"
      >
        {selectedModels.length === 1 && (
          <ProviderIcon model={selectedModels[0]} />
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{label}</span>
          {selectedModels.length === 1 && selectedModels[0].provider && (
            <span className="block truncate text-[10px] text-muted">{selectedModels[0].provider}</span>
          )}
        </div>
        {pricing && selectedModels.length >= 1 && (() => {
          if (selectedModels.length === 1 && creditRanges?.[selectedModels[0].id]) {
            const range = creditRanges[selectedModels[0].id];
            if (range.min > 0) {
              const label = range.max > range.min ? `${range.min}–${range.max}` : `${range.min}`;
              return (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                  <CreditIcon size={11} />
                  <span className="font-medium">{label}</span>
                </span>
              );
            }
          }
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
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "translate-x-0.5" : ""}`}
        >
          <path d="M5.25 3.5l3.5 3.5-3.5 3.5" />
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
  onSelect,
  pricing,
  creditRanges,
}: {
  label?: string;
  models: SelectorModel[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  pricing?: Record<string, ModelPricing>;
  creditRanges?: Record<string, CreditRange>;
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
            onClick={() => onSelect(m.id)}
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
            <ProviderIcon model={m} />

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
                    credits={creditRanges?.[m.id]?.min ?? pricing[m.id].effective_credits}
                    creditsMax={creditRanges?.[m.id]?.max}
                    discount={pricing[m.id].discount_pct}
                    promoLabel={pricing[m.id].promo_label}
                  />
                )}
              </div>
              {m.description && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  {m.description}
                </p>
              )}
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

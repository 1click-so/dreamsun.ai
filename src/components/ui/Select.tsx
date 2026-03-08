"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectOption<T extends string> {
  value: T;
  label: string;
  detail?: React.ReactNode;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** Dropdown placement — "bottom" (default) opens below, "top" opens above */
  placement?: "bottom" | "top";
  /** Compact size for inline/tight contexts */
  compact?: boolean;
  /** Minimum dropdown width (useful when trigger is narrow) */
  minWidth?: number;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  placement = "bottom",
  compact = false,
  minWidth,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  // Compute position from trigger bounding rect
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.left, width: r.width });
  }, []);

  // Recalculate on open + scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePos]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  // Portal-rendered dropdown panel
  const panelWidth = minWidth ? Math.max(pos.width, minWidth) : pos.width;
  const gap = 4;
  const panelStyle: React.CSSProperties =
    placement === "top"
      ? { position: "fixed", bottom: window.innerHeight - pos.top + gap, left: pos.left, width: panelWidth }
      : { position: "fixed", top: pos.top + (triggerRef.current?.offsetHeight ?? 0) + gap, left: pos.left, width: panelWidth };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-surface text-foreground transition hover:border-accent/30 focus:border-accent",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-2 text-xs"
        )}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          size={compact ? 10 : 12}
          className={cn(
            "ml-1.5 shrink-0 text-muted transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(
              "scrollbar-none z-50 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl shadow-black/30",
            )}
            style={panelStyle}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between transition",
                  compact ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-2 text-xs",
                  opt.value === value
                    ? "bg-accent/10 text-accent"
                    : "text-foreground hover:bg-accent/5 hover:text-accent"
                )}
              >
                <span>{opt.label}</span>
                {opt.detail && (
                  <span className="ml-2 text-[10px] opacity-50">{opt.detail}</span>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

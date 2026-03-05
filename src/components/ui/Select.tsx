"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectOption<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground transition hover:border-accent/30 focus:border-accent"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          size={12}
          className={cn(
            "ml-2 shrink-0 text-muted transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-xs transition",
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
        </div>
      )}
    </div>
  );
}

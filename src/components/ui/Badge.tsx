import { cn } from "@/lib/cn";
import { type ReactNode } from "react";

/**
 * Badge / Pill for status indicators, labels, counts.
 *
 * accent   — Accent tint (active state, selected)
 * muted    — Subtle label
 * live     — Pulsing dot + accent (used on landing)
 */

type BadgeVariant = "accent" | "muted" | "live";

const variantStyles: Record<BadgeVariant, string> = {
  accent: "border-accent/30 bg-accent/10 text-accent",
  muted: "border-border bg-surface text-muted",
  live: "border-accent/30 bg-accent/10 text-accent",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "muted", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {variant === "live" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
      )}
      {children}
    </span>
  );
}

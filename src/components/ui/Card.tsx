import { cn } from "@/lib/cn";
import { type ReactNode } from "react";

/**
 * Card container — consistent bg, border, rounded corners.
 *
 * surface  — Default app card (bg-surface)
 * elevated — Slightly raised (bg-card, used on landing bento)
 * outlined — Border only, transparent bg
 */

type CardVariant = "surface" | "elevated" | "outlined";

const variantStyles: Record<CardVariant, string> = {
  surface: "bg-surface border-border",
  elevated: "bg-card border-border",
  outlined: "bg-transparent border-border",
};

interface CardProps {
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
}

export function Card({ variant = "surface", children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

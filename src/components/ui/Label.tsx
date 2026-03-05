import { cn } from "@/lib/cn";
import { type ReactNode } from "react";

/**
 * Form label — consistent sizing and color.
 *
 * Used in settings panels, forms, shot cards.
 * Sizes match the two contexts:
 * - md: Settings panels (text-xs)
 * - sm: Shot card inline labels (text-[10px])
 * - xs: Tiny inline labels (text-[9px])
 */

type LabelSize = "xs" | "sm" | "md";

const sizeStyles: Record<LabelSize, string> = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-xs",
};

interface LabelProps {
  children: ReactNode;
  size?: LabelSize;
  uppercase?: boolean;
  className?: string;
  htmlFor?: string;
}

export function Label({ children, size = "md", uppercase = false, className, htmlFor }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block font-medium text-muted",
        sizeStyles[size],
        uppercase && "uppercase tracking-wider",
        className
      )}
    >
      {children}
    </label>
  );
}

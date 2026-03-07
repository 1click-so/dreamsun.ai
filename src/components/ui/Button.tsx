import { cn } from "@/lib/cn";
import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * Button variants used across DreamSun.ai
 *
 * primary    — Accent filled (main CTA)
 * secondary  — Accent outline
 * ghost      — No border, subtle hover
 * destructive — Red for delete/cancel actions
 * pill       — Landing page rounded-full CTA
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "pill";
type ButtonSize = "xs" | "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-black font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "border border-accent text-accent font-medium hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed",
  ghost:
    "text-muted font-medium hover:text-foreground hover:bg-surface-hover",
  destructive:
    "border border-destructive/50 bg-destructive/10 text-destructive font-medium hover:bg-destructive/20",
  pill:
    "bg-accent text-black font-semibold rounded-full hover:scale-105 transition-transform",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-[10px] rounded-lg",
  sm: "px-3 py-2 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-8 py-3 text-lg rounded-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "sm", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 transition",
          variantStyles[variant],
          variant !== "pill" && sizeStyles[size],
          variant === "pill" && "px-8 py-3 text-lg",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

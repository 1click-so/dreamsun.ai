import { cn } from "@/lib/cn";
import { forwardRef, type InputHTMLAttributes } from "react";

/**
 * Standard text input.
 * All inputs use: surface bg, border, rounded-lg, accent focus.
 */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

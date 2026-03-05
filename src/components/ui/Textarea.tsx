import { cn } from "@/lib/cn";
import { forwardRef, type TextareaHTMLAttributes } from "react";

/**
 * Standard textarea.
 * Same visual treatment as Input — surface bg, border, rounded-lg, accent focus.
 */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/40 focus:border-accent",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

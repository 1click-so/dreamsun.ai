import { cn } from "@/lib/cn";

/**
 * Loading spinner — consistent size/color across all loading states.
 */

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  xs: "h-2.5 w-2.5 border",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-2",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-accent border-t-transparent",
        sizeStyles[size],
        className
      )}
    />
  );
}

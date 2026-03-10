import { cn } from "@/lib/cn";

/**
 * Toggle switch (On/Off).
 * Used for: Safety Filter, Sound, etc.
 * Active state uses accent color.
 */

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Toggle({ checked, onChange, label, description, size = "md", className }: ToggleProps) {
  const trackSize = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const thumbSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const translate = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center",
        (label || description) ? "justify-between" : "gap-2",
        className
      )}
    >
      {(label || description) && (
        <div className="text-left">
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      )}
      <span
        className={cn(
          "relative shrink-0 rounded-full transition",
          trackSize,
          checked ? "bg-accent" : "bg-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 rounded-full bg-foreground transition-transform dark:bg-background",
            thumbSize,
            checked && translate
          )}
        />
      </span>
    </button>
  );
}

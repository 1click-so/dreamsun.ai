import { cn } from "@/lib/cn";
import { type ReactNode } from "react";

/**
 * Section divider — centered title between two lines.
 * Used to separate major page sections.
 */

interface SectionDividerProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionDivider({ icon, title, subtitle, className }: SectionDividerProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="h-px flex-1 bg-border" />
      <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-foreground">
        {icon}
        {title}
        {subtitle && (
          <span className="text-xs font-normal normal-case tracking-normal text-muted/50">
            {subtitle}
          </span>
        )}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

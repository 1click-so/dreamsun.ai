"use client";

import { Monitor } from "lucide-react";

/**
 * Banner shown on mobile for pages that require desktop.
 * Two modes:
 * - "full" — takes over the entire page (shots)
 * - "inline" — sits above a gallery (images, video)
 */
export function DesktopOnlyBanner({ mode = "inline" }: { mode?: "full" | "inline" }) {
  if (mode === "full") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center lg:hidden">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
          <Monitor size={24} className="text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Desktop only</p>
          <p className="mt-1 text-xs text-muted">
            This tool is designed for desktop. Open dreamsunai.com on your computer to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
      <Monitor size={16} className="shrink-0 text-muted" />
      <p className="text-xs text-muted">
        Generation tools are available on desktop. Browse your gallery below.
      </p>
    </div>
  );
}

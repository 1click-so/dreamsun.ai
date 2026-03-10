"use client";

import { Monitor } from "lucide-react";

/**
 * Banner shown on mobile for pages that require desktop.
 * Two modes:
 * - "full" — takes over the entire page (shots)
 * - "inline" — mint ribbon above content (images, video)
 */
export function DesktopOnlyBanner({ mode = "inline" }: { mode?: "full" | "inline" }) {
  if (mode === "full") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center lg:hidden">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
          <Monitor size={24} className="text-accent" />
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
    <div className="flex items-center justify-center gap-2 bg-accent px-4 py-2 lg:hidden">
      <Monitor size={13} className="shrink-0 text-black/70" />
      <p className="text-[11px] font-medium text-black/80">
        Create on desktop - browse your gallery below
      </p>
    </div>
  );
}

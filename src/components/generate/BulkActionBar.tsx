"use client";

import { IconDownload } from "./Icons";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownload: () => void;
  onDelete: () => void;
  downloading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDownload,
  onDelete,
  downloading,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-6 pb-5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/60 bg-background px-5 py-3 shadow-xl shadow-black/20 backdrop-blur-xl">
        {/* Count */}
        <span className="text-sm font-semibold text-foreground">
          {selectedCount} selected
        </span>

        {/* Select All / Deselect All */}
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-[11px] font-medium text-accent-text transition hover:text-accent-hover"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>

        <div className="h-5 w-px bg-border/60" />

        {/* Download */}
        <button
          onClick={onDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:bg-surface-hover disabled:opacity-50"
        >
          <IconDownload />
          {downloading ? "Downloading..." : "Download"}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-[11px] font-medium text-destructive transition hover:bg-destructive/20"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h10M5 4V2.5h4V4M3 4l.7 8.1c.1.8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4L11 4" />
          </svg>
          Delete
        </button>

        {/* Cancel */}
        <button
          onClick={onDeselectAll}
          className="text-[11px] font-medium text-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

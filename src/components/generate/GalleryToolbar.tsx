"use client";

import { useState } from "react";
import { saveStorage } from "@/lib/storage";

export type GalleryFilter = "all" | "images" | "loved" | "videos" | "audio";

const ALL_FILTERS: GalleryFilter[] = ["all", "images", "videos", "audio", "loved"];

const FILTER_ICONS: Record<GalleryFilter, (active: boolean) => React.ReactNode> = {
  all: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="1" />
    </svg>
  ),
  images: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2" width="11" height="10" rx="1.5" />
      <circle cx="4.5" cy="5" r="1.2" />
      <path d="M1.5 10l3-3 2 2 3-3 3 3" />
    </svg>
  ),
  videos: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="8" height="9" rx="1.5" />
      <path d="M9.5 5.5l3-1.5v6l-3-1.5" />
    </svg>
  ),
  audio: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M3 5.5v3M5.5 4v6M8 3v8M10.5 5v4" />
    </svg>
  ),
  loved: (active) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3">
      <path d="M7 12.5S1 8.5 1 5a3 3 0 015.5-1.5h1A3 3 0 0113 5c0 3.5-6 7.5-6 7.5z" />
    </svg>
  ),
};

const FILTER_LABELS: Record<GalleryFilter, string> = {
  all: "All",
  images: "Images",
  videos: "Videos",
  audio: "Audio",
  loved: "Loved",
};

interface GalleryToolbarProps {
  totalCount: number;
  filteredCount: number;
  galleryFilter: GalleryFilter;
  onFilterChange: (f: GalleryFilter) => void;
  galleryRowHeight: number;
  onRowHeightChange: (v: number) => void;
  gallerySizeStorageKey: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const SCALES = [0.4, 0.6, 0.8, 1.0, 1.3, 1.7];

export function GalleryToolbar({
  totalCount,
  filteredCount,
  galleryFilter,
  onFilterChange,
  galleryRowHeight,
  onRowHeightChange,
  gallerySizeStorageKey,
  searchQuery,
  onSearchChange,
}: GalleryToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const scaleIdx = SCALES.indexOf(galleryRowHeight);

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5">
      {/* Left — count */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted/50">
          {filteredCount}{filteredCount !== totalCount ? `/${totalCount}` : ""} {totalCount === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Right — filter group + size slider + search */}
      <div className="flex items-center gap-2">
        {/* Format filter group */}
        <div className="flex items-center rounded-lg border border-border/60 bg-surface/50">
          {ALL_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium transition first:rounded-l-lg last:rounded-r-lg ${
                galleryFilter === f
                  ? "bg-accent/12 text-accent-text"
                  : "text-muted/60 hover:bg-surface-hover hover:text-foreground"
              }`}
              title={FILTER_LABELS[f]}
            >
              {FILTER_ICONS[f](galleryFilter === f)}
              <span className="hidden xl:inline">{FILTER_LABELS[f]}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border/60" />

        {/* Size slider */}
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" className="shrink-0 text-muted/50">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={scaleIdx !== -1 ? scaleIdx : 3}
            onChange={(e) => {
              const v = SCALES[Number(e.target.value)];
              onRowHeightChange(v);
              saveStorage(gallerySizeStorageKey, v);
            }}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
          />
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" className="shrink-0 text-muted/50">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" />
          </svg>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border/60" />

        {/* Search */}
        <div className="flex items-center">
          {searchOpen ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted/50">
                <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5L13 13" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="w-24 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    onSearchChange("");
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  className="text-muted/60 hover:text-foreground"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l6 6M7 1l-6 6" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-md p-1.5 text-muted/50 transition hover:bg-surface hover:text-foreground"
              title="Search"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5L13 13" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

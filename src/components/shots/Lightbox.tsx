"use client";

import { useState } from "react";

interface LightboxProps {
  src: string;
  type: "image" | "video";
  shotNumber?: string;
  onClose: () => void;
  onNewShotFromRef?: (imageUrl: string) => void;
  onEditImage?: (editPrompt: string) => void;
}

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition hover:bg-white/10"
    >
      <span className="text-base text-white/90">{icon}</span>
      <span className="text-[10px] font-medium text-white/60">{label}</span>
    </button>
  );
}

export function Lightbox({
  src,
  type,
  shotNumber,
  onClose,
  onNewShotFromRef,
  onEditImage,
}: LightboxProps) {
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [mediaLoaded, setMediaLoaded] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = type === "video" ? "mp4" : "png";
      const name = shotNumber ? `shot-${shotNumber}.${ext}` : `shot.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  const handleEditSubmit = () => {
    if (!editPrompt.trim() || !onEditImage) return;
    onEditImage(editPrompt.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Close button — top right of overlay */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>

      {/* Shot number badge — top left */}
      {shotNumber && (
        <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3.5 py-1.5 text-xs font-semibold text-white/80 shadow-lg ring-1 ring-white/15 backdrop-blur-sm">
          Shot #{shotNumber}
        </div>
      )}

      {/* Media — clean, no overlays */}
      <div onClick={(e) => e.stopPropagation()} className="relative">
        {!mediaLoaded && (
          <div className="flex max-h-[75vh] max-w-[90vw] items-center justify-center rounded-xl bg-surface/50" style={{ minWidth: 320, minHeight: 240 }}>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        )}
        {type === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            className={`max-h-[75vh] max-w-[90vw] rounded-xl shadow-2xl transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0 absolute"}`}
            onLoadedData={() => setMediaLoaded(true)}
            onLoadedMetadata={() => setMediaLoaded(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Preview"
            className={`max-h-[75vh] max-w-[90vw] rounded-xl object-contain shadow-2xl transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0 absolute"}`}
            onLoad={() => setMediaLoaded(true)}
          />
        )}
      </div>

      {/* Edit prompt input — appears above toolbar when active */}
      {showEditPrompt && (
        <div
          className="mt-3 flex w-full max-w-lg items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 shadow-lg backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleEditSubmit(); if (e.key === "Escape") setShowEditPrompt(false); }}
            placeholder="open the door, remove the hat..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            autoFocus
          />
          <button
            onClick={handleEditSubmit}
            disabled={!editPrompt.trim()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-accent-hover disabled:opacity-30"
          >
            Generate
          </button>
          <button
            onClick={() => setShowEditPrompt(false)}
            className="shrink-0 text-xs text-white/40 transition hover:text-white/70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toolbar — below image */}
      <div
        className={`${showEditPrompt ? "mt-2" : "mt-4"} flex items-center gap-1 rounded-2xl bg-black/50 px-2 py-1 shadow-lg ring-1 ring-white/15 backdrop-blur-sm`}
        onClick={(e) => e.stopPropagation()}
      >
        <ToolbarButton
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3v9M5 8l4 4 4-4" /><path d="M3 14h12" />
            </svg>
          }
          label="Save"
          onClick={handleDownload}
        />
        {type === "image" && onNewShotFromRef && (
          <ToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="14" height="14" rx="2" /><path d="M9 6v6M6 9h6" />
              </svg>
            }
            label="New Shot"
            onClick={() => {
              onNewShotFromRef(src);
              onClose();
            }}
          />
        )}
        {type === "image" && onEditImage && (
          <ToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 2l5 5-9 9H2v-5z" /><path d="M9.5 3.5l5 5" />
              </svg>
            }
            label="Edit"
            onClick={() => setShowEditPrompt(!showEditPrompt)}
          />
        )}
        {type === "image" && (
          <ToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l4-4 3 3 5-5" /><path d="M11 5h4v4" />
              </svg>
            }
            label="Upscale"
            onClick={() => {/* TODO */}}
          />
        )}
        <div className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 9a6 6 0 11-3-5.2" /><path d="M15 3v3h-3" />
            </svg>
          }
          label="Copy URL"
          onClick={() => navigator.clipboard.writeText(src)}
        />
      </div>
    </div>
  );
}

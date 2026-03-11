"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/cn";

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  /** Accept multiple selections (default: false = single pick) */
  multiple?: boolean;
  onSelectMultiple?: (urls: string[]) => void;
  /** Called when files are uploaded from computer (for cases that need File objects) */
  onUploadFiles?: (files: File[]) => void;
  title?: string;
}

interface GalleryImage {
  id: string;
  url: string;
  prompt: string | null;
  model_name: string | null;
  created_at: string;
  aspect_ratio: string | null;
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  multiple = false,
  onSelectMultiple,
  onUploadFiles,
  title = "Select Image",
}: MediaPickerModalProps) {
  const [tab, setTab] = useState<"gallery" | "upload">("gallery");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Fetch image generations from Supabase
  const fetchImages = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("generations")
      .select("id, url, prompt, model_name, created_at, aspect_ratio")
      .eq("type", "image")
      .not("url", "is", null)
      .neq("url", "error")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      setImages(data as GalleryImage[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchImages();
      setSelected(new Set());
      setTab("gallery");
    }
  }, [open, fetchImages]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleGallerySelect = (url: string) => {
    if (multiple) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        return next;
      });
    } else {
      onSelect(url);
      onClose();
    }
  };

  const handleConfirmMultiple = () => {
    if (onSelectMultiple && selected.size > 0) {
      onSelectMultiple(Array.from(selected));
    }
    onClose();
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (onUploadFiles) {
      onUploadFiles(Array.from(files));
    } else if (multiple && onSelectMultiple) {
      const urls = Array.from(files).map((f) => URL.createObjectURL(f));
      onSelectMultiple(urls);
    } else {
      onSelect(URL.createObjectURL(files[0]));
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-foreground"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("gallery")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition",
              tab === "gallery"
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            )}
          >
            Gallery
          </button>
          <button
            onClick={() => setTab("upload")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition",
              tab === "upload"
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            )}
          >
            Upload from Computer
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {tab === "gallery" && (
            <>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              ) : images.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  No images yet. Generate some on the Images page.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handleGallerySelect(img.url)}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border-2 transition",
                        selected.has(img.url)
                          ? "border-accent ring-1 ring-accent"
                          : "border-transparent hover:border-accent/50"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.prompt || "Generated image"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {selected.has(img.url) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-accent">
                            <path d="M5 10l4 4 6-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "upload" && (
            <div
              className={cn(
                "flex h-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition",
                dragOver ? "border-accent bg-accent/5" : "border-border"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileChange(e.dataTransfer.files);
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xs text-muted">Drag & drop or</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-accent px-4 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10"
              >
                Browse Files
              </button>
              <p className="text-[10px] text-muted/60">PNG, JPG, WebP</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple={multiple}
                className="hidden"
                onChange={(e) => {
                  handleFileChange(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>

        {/* Footer - only for multi-select */}
        {multiple && tab === "gallery" && selected.size > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <button
              onClick={handleConfirmMultiple}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-black transition hover:bg-accent/80"
            >
              Add Selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

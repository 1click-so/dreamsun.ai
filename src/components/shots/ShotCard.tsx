"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Shot, ShotStatus, ImageSettings, VideoSettings, UploadedRef } from "@/types/shots";
import type { ModelConfig } from "@/lib/models";
import type { VideoModelConfig } from "@/lib/video-models";
import { VIDEO_MODELS } from "@/lib/video-models";
import { getSelectableModels, getModelById, resolveModel } from "@/lib/models";
import { Button } from "@/components/ui/Button";
import { TaggableTextarea } from "@/components/ui/TaggableTextarea";
import { extractLastFrameAndUpload } from "@/lib/extract-frame";

/** Module-level cache of URLs that have already loaded — survives re-mounts */
const _loadedUrlCache = new Set<string>();

/** Helper: true when the src is a remote http(s) URL (not a blob: or data: URI) */
function isRemoteUrl(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

interface ShotCardProps {
  shot: Shot;
  masterRefs: UploadedRef[];
  globalDuration: number;
  globalAspectRatio: string;
  globalGenerateAudio: boolean;
  globalResolution: string;
  globalCameraFixed: boolean;
  videoModel: VideoModelConfig;
  imageModel: ModelConfig;
  onUpdate: (updates: Partial<Shot>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRefUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefFileDrop: (files: File[]) => void;
  onRefUrlDrop: (url: string) => void;
  onRefRemove: (refId: string) => void;
  refInputRef: (el: HTMLInputElement | null) => void;
  onGenerateImage: () => void;
  onAnimateShot: () => void;
  onCancelImage: () => void;
  onCancelVideo: () => void;
  onOpenLightbox: (src: string, type: "image" | "video") => void;
  onEndFrameUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndFrameRemove: () => void;
  onImageSettingsChange: (updates: Partial<ImageSettings>) => void;
  onVideoSettingsChange: (updates: Partial<VideoSettings>) => void;
  onDropOnFirst: (url: string) => void;
  onDropOnLast: (url: string) => void;
  onLastFrameToNext?: (frameUrl: string) => void;
}

/** Video that only loads when scrolled into view, with skeleton loader */
function LazyVideo({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(() => _loadedUrlCache.has(src));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const markLoaded = useCallback(() => {
    _loadedUrlCache.add(src);
    setLoaded(true);
  }, [src]);

  return (
    <div ref={containerRef} className="relative overflow-hidden" style={style}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse rounded-md bg-surface" />
      )}
      <video
        src={visible ? src : undefined}
        autoPlay={visible}
        loop
        muted
        playsInline
        preload="none"
        className={`h-full w-full ${className ?? ""} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoadedData={markLoaded}
        onLoadedMetadata={markLoaded}
      />
    </div>
  );
}

/** Small video thumbnail with skeleton loader */
function VideoThumb({ url, isActive, aspectRatio, index, onClick }: {
  url: string; isActive: boolean; aspectRatio: string; index: number; onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(() => _loadedUrlCache.has(url));
  const markLoaded = useCallback(() => { _loadedUrlCache.add(url); setLoaded(true); }, [url]);
  return (
    <div className="relative shrink-0 cursor-pointer" onClick={onClick}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse rounded-md bg-surface" style={{ aspectRatio }} />
      )}
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className={`h-16 rounded-md border object-cover transition hover:border-accent ${loaded ? "opacity-100" : "opacity-0"} ${
          isActive ? "border-accent" : "border-border/50"
        }`}
        style={{ aspectRatio }}
        onLoadedData={markLoaded}
        onLoadedMetadata={markLoaded}
        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
        onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
      />
      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[7px] leading-tight text-white/70">{index + 1}</span>
    </div>
  );
}

const statusColors: Record<ShotStatus, string> = {
  pending: "border-border text-muted",
  generating: "border-accent text-accent",
  done: "border-accent text-accent",
  error: "border-destructive text-destructive",
};

export function ShotCard({
  shot,
  masterRefs,
  globalDuration,
  globalAspectRatio,
  globalGenerateAudio,
  globalResolution,
  globalCameraFixed,
  videoModel,
  imageModel,
  onUpdate,
  onRemove,
  onRefUpload,
  onRefFileDrop,
  onRefUrlDrop,
  onRefRemove,
  refInputRef,
  onGenerateImage,
  onAnimateShot,
  onCancelImage,
  onCancelVideo,
  onOpenLightbox,
  onEndFrameUpload,
  onEndFrameRemove,
  onImageSettingsChange,
  onVideoSettingsChange,
  onDropOnFirst,
  onDropOnLast,
  onLastFrameToNext,
  onMoveUp,
  onMoveDown,
}: ShotCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);
  const cancelExtract = useCallback(() => {
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    setExtracting(false);
  }, []);

  // Track loaded state for remote images (skeleton → reveal)
  // Initialize from module-level cache so re-mounts don't flash
  const [genLoaded, setGenLoaded] = useState<Record<number, boolean>>({});
  const [firstLoaded, setFirstLoaded] = useState(() => !!shot.imageUrl && _loadedUrlCache.has(shot.imageUrl));
  const [lastLoaded, setLastLoaded] = useState(() => {
    const endSrc = shot.endImageUrl || shot.endImageRef?.preview;
    return !!endSrc && _loadedUrlCache.has(endSrc);
  });
  const markGenLoaded = useCallback((i: number, url: string) => {
    _loadedUrlCache.add(url);
    setGenLoaded((prev) => ({ ...prev, [i]: true }));
  }, []);
  const markFirstLoaded = useCallback(() => {
    if (shot.imageUrl) _loadedUrlCache.add(shot.imageUrl);
    setFirstLoaded(true);
  }, [shot.imageUrl]);
  const markLastLoaded = useCallback((url: string) => {
    _loadedUrlCache.add(url);
    setLastLoaded(true);
  }, []);

  // Reset loaded flags when the underlying URL changes (only if new URL not already cached)
  useEffect(() => { setFirstLoaded(!!shot.imageUrl && _loadedUrlCache.has(shot.imageUrl)); }, [shot.imageUrl]);
  useEffect(() => {
    const endSrc = shot.endImageUrl || shot.endImageRef?.preview;
    setLastLoaded(!!endSrc && _loadedUrlCache.has(endSrc));
  }, [shot.endImageUrl, shot.endImageRef?.preview]);

  // Suppress unused variable warning — statusColors kept for reference/future use
  void statusColors;

  const isImageBusy = shot.imageStatus === "generating";
  const isVideoBusy = shot.videoStatus === "generating";
  const canAnimate = shot.imageStatus === "done" && shot.imageUrl && !isVideoBusy;

  // Effective values (per-shot or global)
  const imgSettings = shot.settings.image;
  const vidSettings = shot.settings.video;
  const hasOverrides =
    imgSettings.modelId != null || imgSettings.aspectRatio != null ||
    vidSettings.modelId != null || vidSettings.duration != null || vidSettings.aspectRatio != null ||
    vidSettings.resolution != null || vidSettings.cameraFixed != null || vidSettings.generateAudio != null;

  const selectableModels = getSelectableModels();
  const effVideoModel = vidSettings.modelId
    ? VIDEO_MODELS.find((m) => m.id === vidSettings.modelId) ?? videoModel
    : videoModel;

  // Effective image model (per-shot override → global) for capability checks
  const hasRefs = (shot.refImages ?? []).some((r) => r.url);
  const effImageModelId = imgSettings.modelId ?? imageModel.id;
  const effImageModel = resolveModel(effImageModelId, hasRefs) ?? imageModel;
  const imageSupportsNeg = effImageModel.supportsNegativePrompt;
  const videoSupportsNeg = effVideoModel.supportsNegativePrompt;

  const endFrameSrc = shot.endImageRef?.preview ?? shot.endImageUrl;
  const endFrameUploading = shot.endImageRef?.uploading ?? false;
  const history = shot.imageHistory ?? [];
  const videoHistory = shot.videoHistory ?? [];
  const refImages = shot.refImages ?? [];

  // Effective image aspect ratio for this shot
  const effImageAR = imgSettings.aspectRatio ?? globalAspectRatio;
  const [arW, arH] = effImageAR.split(":").map(Number);
  const arRatio = arW / arH;

  // Output frame dimensions (long side = 160px)
  const outputW = arRatio >= 1 ? 160 : Math.round(160 * arRatio);
  const outputH = arRatio >= 1 ? Math.round(160 / arRatio) : 160;

  // Video frame may have its own aspect ratio
  const effVideoAR = vidSettings.aspectRatio ?? globalAspectRatio;
  const [vidArW, vidArH] = effVideoAR.split(":").map(Number);
  const vidRatio = vidArW / vidArH;
  const vidOutputW = vidRatio >= 1 ? 160 : Math.round(160 * vidRatio);
  const vidOutputH = vidRatio >= 1 ? Math.round(160 / vidRatio) : 160;

  // Unified image tag numbering: master refs first, then per-shot refs
  const masterRefOffset = masterRefs.filter((r) => r.url).length;
  const tagImages = [
    ...masterRefs.filter((r) => r.url).map((r, i) => ({
      number: i + 1,
      label: `Master ${i + 1}`,
      thumbnailUrl: r.preview,
    })),
    ...refImages.filter((r) => r.url).map((r, i) => ({
      number: masterRefOffset + i + 1,
      label: `Reference ${i + 1}`,
      thumbnailUrl: r.preview,
    })),
  ];

  // Drag-and-drop helpers
  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDrop = async (e: React.DragEvent, target: "first" | "last") => {
    e.preventDefault();
    // Internal drag (URL from another shot)
    const url = e.dataTransfer.getData("text/plain");
    if (url) {
      // If dropping a video URL onto a frame slot, extract the last frame
      if (/\.mp4($|\?)/i.test(url)) {
        const ac = new AbortController();
        extractAbortRef.current = ac;
        try {
          setExtracting(true);
          const frameUrl = await extractLastFrameAndUpload(url, ac.signal);
          if (target === "first") onDropOnFirst(frameUrl);
          else onDropOnLast(frameUrl);
        } catch (err) {
          if ((err as Error).name !== "AbortError") console.error("[ShotCard] Video frame extraction failed:", err);
        } finally {
          extractAbortRef.current = null;
          setExtracting(false);
        }
      } else {
        if (target === "first") onDropOnFirst(url);
        else onDropOnLast(url);
      }
      return;
    }
    // External file drop (from computer)
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        if (target === "first") onDropOnFirst(data.url);
        else onDropOnLast(data.url);
      }
    } catch (err) {
      console.error("[ShotCard] File drop upload failed:", err);
    }
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  const isBusy = isImageBusy || isVideoBusy;

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-surface transition-all ${
      isBusy ? "border-accent/50 glow-border"
      : shot.imageStatus === "error" || shot.videoStatus === "error" ? "border-destructive/30"
      : "border-border"
    }`}>
      {/* Subtle card shimmer when generating/animating */}
      {isBusy && (
        <div className="pointer-events-none absolute inset-0 z-[1] -translate-x-full animate-[shimmer_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/[0.03] to-transparent" />
      )}
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="shrink-0 flex items-center gap-1">
          <div className="flex flex-col">
            <button onClick={onMoveUp} disabled={!onMoveUp}
              className="px-0.5 text-[10px] leading-none text-muted transition hover:text-accent disabled:opacity-20">▲</button>
            <button onClick={onMoveDown} disabled={!onMoveDown}
              className="px-0.5 text-[10px] leading-none text-muted transition hover:text-accent disabled:opacity-20">▼</button>
          </div>
          <div className="flex items-center rounded-md bg-accent/10 px-2 py-1">
            <span className="font-mono text-sm font-bold text-accent">#</span>
            <input type="text" value={shot.number}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9a-zA-Z]/g, ""); if (v) onUpdate({ number: v }); }}
              className="w-8 bg-transparent text-center font-mono text-sm font-bold text-accent outline-none" />
          </div>
        </div>
        <input type="text" value={shot.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Shot title"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted/30" />
        {isBusy && (
          <span className="shimmer-text flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-accent">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            {isImageBusy ? "Generating..." : "Animating..."}
          </span>
        )}
        {shot.error && <span className="shrink-0 text-[11px] text-destructive">{shot.error}</span>}
        <button onClick={() => setShowSettings(!showSettings)}
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition ${hasOverrides ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted hover:border-accent/30"}`}
        >{showSettings ? "Less" : "More"}</button>
        <button onClick={onRemove} className="shrink-0 text-[11px] text-muted hover:text-destructive">delete</button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-[1fr_1fr_auto] border-t border-border">

        {/* BENTO: Image Controls */}
        <div className="flex flex-col border-r border-border p-3 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Image</span>
          <div>
            <TaggableTextarea
              value={shot.imagePrompt}
              onChange={(v) => onUpdate({ imagePrompt: v })}
              rows={3}
              placeholder="Image prompt... (@ to reference images)"
              className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
              images={tagImages}
            />
            {imageSupportsNeg && !shot.imageNegativePrompt && (
              <button
                onClick={() => onUpdate({ imageNegativePrompt: " " })}
                className="mt-1 flex items-center gap-1 text-[10px] text-muted/60 transition hover:text-destructive"
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-md bg-muted/10 text-[9px] font-bold leading-none">−</span>
                Negative
              </button>
            )}
            {imageSupportsNeg && shot.imageNegativePrompt && (
              <div className="relative mt-1">
                <textarea
                  value={shot.imageNegativePrompt.trim()}
                  onChange={(e) => onUpdate({ imageNegativePrompt: e.target.value })}
                  rows={2}
                  placeholder="no blur, no artifacts, no distortion..."
                  className="w-full resize-y rounded-lg border border-destructive/20 bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted/40 focus:border-destructive/40"
                />
                <button
                  onClick={() => onUpdate({ imageNegativePrompt: "" })}
                  className="absolute right-1.5 top-1.5 text-[9px] text-muted/40 hover:text-destructive"
                >✕</button>
              </div>
            )}
          </div>
          {/* Row 1: References + Generations */}
          <div className="grid grid-cols-2 gap-2">
            {/* References column */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) {
                  onRefFileDrop(Array.from(e.dataTransfer.files));
                } else {
                  const url = e.dataTransfer.getData("text/plain");
                  if (url) onRefUrlDrop(url);
                }
              }}>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">References</span>
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pb-1 storyboard-scroll">
                {refImages.map((ref, i) => (
                  <div key={ref.id} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border" draggable onDragStart={(e) => ref.url && handleDragStart(e, ref.url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.preview} alt="Ref" loading="lazy"
                      className="h-full w-full object-cover"
                      onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; _loadedUrlCache.add(ref.preview); }}
                      style={{ opacity: _loadedUrlCache.has(ref.preview) ? 1 : 0, transition: "opacity 0.2s" }} />
                    {!_loadedUrlCache.has(ref.preview) && !ref.uploading && <div className="absolute inset-0 animate-pulse bg-surface" />}
                    {ref.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                    <button onClick={() => onRefRemove(ref.id)} className="absolute -right-0.5 -top-0.5 rounded-full bg-black/70 px-0.5 text-[8px] text-white/70 hover:text-white">x</button>
                    <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 font-mono text-[7px] font-bold leading-tight text-accent">@{masterRefOffset + i + 1}</span>
                  </div>
                ))}
                <button onClick={() => (document.getElementById(`shot-ref-${shot.id}`) as HTMLInputElement)?.click()}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[11px] text-muted hover:border-accent/50 hover:text-accent">+</button>
                <input id={`shot-ref-${shot.id}`} ref={refInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onRefUpload} className="hidden" />
              </div>
            </div>
            {/* Generations column */}
            <div>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">Generations{history.length > 0 ? ` (${history.length})` : ""}</span>
              {history.length > 0 ? (
                <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pb-1 storyboard-scroll">
                  {history.map((url, i) => {
                    const genW = Math.round(64 * arRatio);
                    return (
                    <div key={i} draggable onDragStart={(e) => handleDragStart(e, url)} className="relative shrink-0 cursor-grab">
                      <button onClick={() => onOpenLightbox(url, "image")} className="block">
                        <div className="relative" style={{ width: genW, height: 64 }}>
                          {!genLoaded[i] && <div className="absolute inset-0 animate-pulse rounded-md bg-surface" />}
                          <Image src={url} alt={`Generation ${i + 1}`}
                            fill
                            sizes={`${genW}px`}
                            onLoad={() => markGenLoaded(i, url)}
                            className={`rounded border object-cover transition hover:border-accent ${
                              url === shot.imageUrl ? "border-accent" : "border-border/50"
                            } ${genLoaded[i] ? "opacity-100" : "opacity-0"}`} />
                        </div>
                      </button>
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[7px] leading-tight text-white/70">{i + 1}</span>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[9px] text-muted/40">No image generations yet</span>
              )}
            </div>
          </div>
          {/* Advanced image settings */}
          {showSettings && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Model</label>
                <select value={imgSettings.modelId ?? ""} onChange={(e) => onImageSettingsChange({ modelId: e.target.value || null })}
                  className="w-full rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">{imageModel.name}</option>
                  {selectableModels.filter((m) => m.id !== imageModel.id).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Ratio</label>
                <select value={imgSettings.aspectRatio ?? ""} onChange={(e) => onImageSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">{globalAspectRatio}</option>
                  {["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"].filter((r) => r !== globalAspectRatio).map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
            </div>
          )}
          {/* Generate button */}
          <div className="mt-auto pt-2">
            {isImageBusy ? (
              <Button variant="destructive" size="xs" onClick={onCancelImage}>Cancel</Button>
            ) : (
              <Button variant="primary" size="xs" onClick={onGenerateImage}>
                {shot.imageStatus === "done" ? "Regenerate" : "Generate"}
              </Button>
            )}
          </div>
        </div>

        {/* BENTO: Video Controls */}
        <div className="flex flex-col border-r border-border p-3 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Video</span>
          <div>
            <textarea value={shot.videoPrompt}
              onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
              rows={3} placeholder="Video/motion prompt..."
              className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
            {videoSupportsNeg && !shot.videoNegativePrompt && (
              <button
                onClick={() => onUpdate({ videoNegativePrompt: " " })}
                className="mt-1 flex items-center gap-1 text-[10px] text-muted/60 transition hover:text-destructive"
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-md bg-muted/10 text-[9px] font-bold leading-none">−</span>
                Negative
              </button>
            )}
            {videoSupportsNeg && shot.videoNegativePrompt && (
              <div className="relative mt-1">
                <textarea
                  value={shot.videoNegativePrompt.trim()}
                  onChange={(e) => onUpdate({ videoNegativePrompt: e.target.value })}
                  rows={2}
                  placeholder="blur, distort, low quality..."
                  className="w-full resize-y rounded-lg border border-destructive/20 bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted/40 focus:border-destructive/40"
                />
                <button
                  onClick={() => onUpdate({ videoNegativePrompt: "" })}
                  className="absolute right-1.5 top-1.5 text-[9px] text-muted/40 hover:text-destructive"
                >✕</button>
              </div>
            )}
          </div>
          {/* Row: Settings + Video Generations (mirrors Image's References + Generations) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Settings column (mirrors References column) */}
            <div>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">Settings</span>
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pb-1 storyboard-scroll">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-muted">Dur</span>
                  <select value={vidSettings.duration ?? ""} onChange={(e) => onVideoSettingsChange({ duration: e.target.value ? Number(e.target.value) : null })}
                    className="rounded-lg border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-muted">
                    <option value="">{globalDuration}s</option>
                    {(effVideoModel.durations ?? []).filter((d) => d !== globalDuration).map((d) => (<option key={d} value={d}>{d}s</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-muted">Ratio</span>
                  <select value={vidSettings.aspectRatio ?? ""} onChange={(e) => onVideoSettingsChange({ aspectRatio: e.target.value || null })}
                    className="rounded-lg border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-muted">
                    <option value="">{globalAspectRatio}</option>
                    {(effVideoModel.aspectRatios ?? []).filter((r) => r !== globalAspectRatio).map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
                {(effVideoModel.resolutions?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-medium uppercase text-muted">Res</span>
                    <select value={vidSettings.resolution ?? ""} onChange={(e) => onVideoSettingsChange({ resolution: e.target.value || null })}
                      className="rounded-lg border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-muted">
                      <option value="">{globalResolution}</option>
                      {(effVideoModel.resolutions ?? []).filter((r) => r !== globalResolution).map((r) => (<option key={r} value={r}>{r}</option>))}
                    </select>
                  </div>
                )}
                {effVideoModel.supportsGenerateAudio && (() => {
                  const effAudio = vidSettings.generateAudio ?? globalGenerateAudio;
                  return (
                    <button
                      onClick={() => onVideoSettingsChange({ generateAudio: effAudio ? false : true })}
                      className={`rounded-lg border px-1.5 py-0.5 text-[9px] font-medium uppercase transition ${
                        effAudio
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-border bg-background text-muted hover:border-muted"
                      }`}
                    >{effAudio ? "Sound on" : "Sound off"}</button>
                  );
                })()}
              </div>
            </div>
            {/* Video Generations column (mirrors Image Generations column) */}
            <div>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">Generations{videoHistory.length > 0 ? ` (${videoHistory.length})` : ""}</span>
              {videoHistory.length > 0 ? (
                <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pb-1 storyboard-scroll">
                  {videoHistory.map((url, i) => (
                    <VideoThumb
                      key={i}
                      url={url}
                      isActive={url === shot.videoUrl}
                      aspectRatio={`${vidArW}/${vidArH}`}
                      index={i}
                      onClick={() => onOpenLightbox(url, "video")}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-[9px] text-muted/40">No video generations yet</span>
              )}
            </div>
          </div>
          {/* Advanced video settings (mirrors Image's advanced settings below the grid) */}
          {showSettings && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Model</label>
                <select value={vidSettings.modelId ?? ""} onChange={(e) => {
                  const id = e.target.value || null;
                  onVideoSettingsChange({ modelId: id });
                  if (id) { const m = VIDEO_MODELS.find((v) => v.id === id); if (m && vidSettings.resolution && !m.resolutions.includes(vidSettings.resolution)) onVideoSettingsChange({ modelId: id, resolution: null }); }
                }} className="w-full rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">{videoModel.name}</option>
                  {VIDEO_MODELS.filter((m) => m.id !== videoModel.id).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              {effVideoModel.supportsCameraFixed && (
                <div>
                  <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Camera</label>
                  <select value={vidSettings.cameraFixed == null ? "" : vidSettings.cameraFixed ? "true" : "false"}
                    onChange={(e) => onVideoSettingsChange({ cameraFixed: e.target.value === "" ? null : e.target.value === "true" })}
                    className="w-full rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                    <option value="">{globalCameraFixed ? "Fixed" : "Free"}</option><option value="true">Fixed</option><option value="false">Free</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {/* Audio upload for audio-to-video models */}
          {effVideoModel.requiresAudio && (
            <div>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">Audio (2-20s)</span>
              {shot.audioUrl ? (
                <div className="flex items-center gap-2">
                  <audio src={shot.audioUrl} controls className="h-7 flex-1" style={{ maxWidth: 180 }} />
                  <button onClick={() => onUpdate({ audioUrl: null, audioRef: null })}
                    className="text-[9px] text-muted hover:text-destructive">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => (document.getElementById(`audio-${shot.id}`) as HTMLInputElement)?.click()}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-2 text-[10px] text-muted transition hover:border-accent/40 hover:text-accent"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M8 2v8M5 7l3 3 3-3" /><path d="M2 12h12" />
                    </svg>
                    Upload audio
                  </button>
                  {shot.audioRef?.uploading && <div className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />}
                </div>
              )}
              <input id={`audio-${shot.id}`} type="file" accept="audio/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onUpdate({ audioRef: { id: `audio_${Date.now()}`, preview: "", url: null, uploading: true } });
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/upload", { method: "POST", body: formData });
                    const data = await res.json();
                    if (data.url) onUpdate({ audioUrl: data.url, audioRef: { id: `audio_${Date.now()}`, preview: "", url: data.url, uploading: false } });
                    else onUpdate({ audioRef: null });
                  } catch (err) {
                    console.error("[ShotCard] Audio upload failed:", err);
                    onUpdate({ audioRef: null });
                  }
                  e.target.value = "";
                }}
              />
            </div>
          )}
          {/* Animate button */}
          <div className="mt-auto pt-2">
            {isVideoBusy ? (
              <Button variant="destructive" size="xs" onClick={onCancelVideo}>Cancel</Button>
            ) : (
              <Button variant="secondary" size="xs" onClick={onAnimateShot} disabled={!canAnimate && !effVideoModel.requiresAudio}>
                {shot.videoStatus === "done" ? "Re-animate" : "Animate"}
              </Button>
            )}
          </div>
        </div>

        {/* BENTO: Output */}
        <div className={`flex gap-2.5 p-3 ${arRatio >= 1 ? "flex-col items-center" : "flex-row"}`}>
          {/* First Frame */}
          <div className="text-center"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, "first")}
          >
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-muted">First</span>
            {shot.imageUrl ? (
              <div className="relative" draggable onDragStart={(e) => handleDragStart(e, shot.imageUrl!)}>
                <button onClick={() => onOpenLightbox(shot.imageUrl!, "image")} className="block">
                  <div className="relative" style={{ width: outputW, height: outputH }}>
                    {!firstLoaded && <div className="absolute inset-0 animate-pulse rounded-md bg-surface" />}
                    <Image src={shot.imageUrl} alt={`Shot ${shot.number}`}
                      fill
                      sizes={`${outputW}px`}
                      onLoad={markFirstLoaded}
                      className={`rounded-md border border-border object-cover transition hover:border-muted cursor-grab ${firstLoaded ? "opacity-100" : "opacity-0"}`} />
                  </div>
                </button>
                <button onClick={() => onUpdate({ imageUrl: null, imageStatus: "pending" as ShotStatus })}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] text-white/70 hover:text-white">x</button>
              </div>
            ) : (
              <button
                onClick={() => (document.getElementById(`first-frame-${shot.id}`) as HTMLInputElement)?.click()}
                className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border transition hover:border-accent/40 hover:text-accent"
                style={{ width: outputW, height: outputH }}>
                {isImageBusy ? (
                  <div className="absolute inset-0 overflow-hidden rounded-md">
                    <div className="absolute inset-0 animate-pulse bg-accent/[0.04]" />
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/[0.08] to-transparent" />
                  </div>
                ) : <span className="text-[8px] text-muted/40">Drop or<br/>click</span>}
              </button>
            )}
            <input id={`first-frame-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload", { method: "POST", body: formData });
                  const data = await res.json();
                  if (data.url) onDropOnFirst(data.url);
                } catch (err) { console.error("[ShotCard] First frame upload failed:", err); }
                e.target.value = "";
              }}
            />
          </div>

          {/* Last Frame */}
          <div className="text-center"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, "last")}
          >
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-muted">Last</span>
            {endFrameSrc ? (
              <div className="relative" draggable onDragStart={(e) => handleDragStart(e, shot.endImageUrl ?? endFrameSrc)}>
                <button onClick={() => onOpenLightbox(endFrameSrc, "image")} className="block">
                  <div className="relative" style={{ width: outputW, height: outputH }}>
                    {isRemoteUrl(endFrameSrc) ? (
                      <>
                        {!lastLoaded && <div className="absolute inset-0 animate-pulse rounded-md bg-surface" />}
                        <Image src={endFrameSrc} alt="End frame"
                          fill
                          sizes={`${outputW}px`}
                          onLoad={() => markLastLoaded(endFrameSrc)}
                          className={`rounded-md border border-border object-cover transition hover:border-muted cursor-grab ${lastLoaded ? "opacity-100" : "opacity-0"}`} />
                      </>
                    ) : (
                      /* Blob / data URI preview — keep as raw img */
                      <>
                        {!lastLoaded && <div className="absolute inset-0 animate-pulse rounded-md bg-surface" />}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={endFrameSrc} alt="End frame"
                          onLoad={() => markLastLoaded(endFrameSrc)}
                          className={`h-full w-full rounded-md border border-border object-cover transition hover:border-muted cursor-grab ${lastLoaded ? "opacity-100" : "opacity-0"}`} />
                      </>
                    )}
                  </div>
                </button>
                <button onClick={onEndFrameRemove}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] text-white/70 hover:text-white">x</button>
                {endFrameUploading && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}
              </div>
            ) : (
              <button
                onClick={() => (document.getElementById(`last-frame-${shot.id}`) as HTMLInputElement)?.click()}
                className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border transition hover:border-accent/40 hover:text-accent"
                style={{ width: outputW, height: outputH }}>
                <span className="text-[8px] text-muted/40">Drop or<br/>click</span>
              </button>
            )}
            <input id={`last-frame-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { onEndFrameUpload(e); }}
            />
          </div>

          {/* Video */}
          <div className="text-center">
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-muted">Video</span>
            {shot.videoUrl ? (
              <div
                className="group relative cursor-pointer"
                draggable
                onDragStart={(e) => handleDragStart(e, shot.videoUrl!)}
                onClick={() => onOpenLightbox(shot.videoUrl!, "video")}
              >
                <LazyVideo
                  src={shot.videoUrl}
                  className="rounded-md border border-border object-cover transition hover:border-muted"
                  style={{ width: vidOutputW, height: vidOutputH }}
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="white"><path d="M6 4l10 6-10 6z" /></svg>
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center overflow-hidden rounded-md border border-dashed border-border"
                style={{ width: vidOutputW, height: vidOutputH }}>
                {isVideoBusy ? (
                  <>
                    <div className="absolute inset-0 animate-pulse bg-accent/[0.04]" />
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/[0.08] to-transparent" />
                  </>
                ) : <span className="text-[8px] text-muted/40">No video</span>}
              </div>
            )}
            {/* Chain to next shot — extract last frame */}
            {shot.videoUrl && onLastFrameToNext && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (extracting) return;
                  const ac = new AbortController();
                  extractAbortRef.current = ac;
                  try {
                    setExtracting(true);
                    const frameUrl = await extractLastFrameAndUpload(shot.videoUrl!, ac.signal);
                    onLastFrameToNext(frameUrl);
                  } catch (err) {
                    if ((err as Error).name !== "AbortError") console.error("[ShotCard] Extract last frame failed:", err);
                  } finally {
                    extractAbortRef.current = null;
                    setExtracting(false);
                  }
                }}
                disabled={extracting}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-border px-1.5 py-0.5 text-[8px] font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                title="Extract last frame and set as first frame of next shot"
              >
                {extracting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
                    Extracting...
                  </>
                ) : (
                  "Last frame → Next shot"
                )}
              </button>
            )}
          </div>
          {/* Extracting indicator — small pill, no blur */}
          {extracting && (
            <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
              <div className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 shadow-md ring-1 ring-border">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-[9px] font-medium text-muted">Extracting frame...</span>
                <button onClick={cancelExtract} className="text-[9px] text-muted/60 transition hover:text-accent">✕</button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

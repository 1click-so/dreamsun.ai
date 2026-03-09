"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { Shot, ShotStatus } from "@/types/shots";
import { Button } from "@/components/ui/Button";
import { CreditIcon } from "@/components/ModelSelector";
import { extractLastFrameAndUpload } from "@/lib/extract-frame";

/** Module-level cache of URLs that have already loaded — survives re-mounts */
const _loadedUrlCache = new Set<string>();

interface StoryboardCardProps {
  shot: Shot;
  globalDuration: number;
  globalAspectRatio: string;
  isBlurred: boolean;
  onUpdate: (updates: Partial<Shot>) => void;
  onRemove: () => void;
  onGenerateImage: () => void;
  onAnimateShot: () => void;
  onCancelImage: () => void;
  onCancelVideo: () => void;
  onOpenLightbox: (src: string, type: "image" | "video") => void;
  onOpenModal: (mode: "image" | "video") => void;
  onDropOnFirst: (url: string) => void;
  onDropOnLast: (url: string) => void;
  onLastFrameToNext?: (frameUrl: string) => void;
  imgCredits?: number;
  vidCredits?: number;
}

export function StoryboardCard({
  shot,
  globalDuration,
  globalAspectRatio,
  isBlurred,
  onUpdate,
  onRemove,
  onGenerateImage,
  onAnimateShot,
  onCancelImage,
  onCancelVideo,
  onOpenLightbox,
  onOpenModal,
  onDropOnFirst,
  onDropOnLast,
  onLastFrameToNext,
  imgCredits = 0,
  vidCredits = 0,
}: StoryboardCardProps) {
  const [videoPaused, setVideoPaused] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);
  const [heroMode, setHeroMode] = useState<"video" | "image">("video");
  const [heroImgLoaded, setHeroImgLoaded] = useState(() => !!shot.imageUrl && _loadedUrlCache.has(shot.imageUrl));
  const [endFrameOverlayLoaded, setEndFrameOverlayLoaded] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [heroVideoLoaded, setHeroVideoLoaded] = useState(() => !!shot.videoUrl && _loadedUrlCache.has(shot.videoUrl));

  const markHeroImgLoaded = useCallback(() => {
    if (shot.imageUrl) _loadedUrlCache.add(shot.imageUrl);
    setHeroImgLoaded(true);
  }, [shot.imageUrl]);
  const markHeroVideoLoaded = useCallback(() => {
    if (shot.videoUrl) _loadedUrlCache.add(shot.videoUrl);
    setHeroVideoLoaded(true);
  }, [shot.videoUrl]);

  // Reset hero loading states when URLs change (check cache first)
  useEffect(() => { setHeroImgLoaded(!!shot.imageUrl && _loadedUrlCache.has(shot.imageUrl)); }, [shot.imageUrl]);
  useEffect(() => { setHeroVideoLoaded(!!shot.videoUrl && _loadedUrlCache.has(shot.videoUrl)); }, [shot.videoUrl]);

  const isBlobUrl = (url: string) => url.startsWith("blob:");

  const isImageBusy = shot.imageStatus === "generating";
  const isVideoBusy = shot.videoStatus === "generating";
  const isBusy = isImageBusy || isVideoBusy;
  const canAnimate = shot.imageStatus === "done" && shot.imageUrl && !isVideoBusy;

  // Image generation carousel (ensure current image is in history)
  const imgGensRaw = shot.imageHistory ?? [];
  const imgGens = shot.imageUrl && !imgGensRaw.includes(shot.imageUrl) ? [shot.imageUrl, ...imgGensRaw] : imgGensRaw;
  const hasMultipleImgGens = imgGens.length > 1;
  const imgGenIndex = shot.imageUrl ? imgGens.indexOf(shot.imageUrl) : -1;
  const imgGenTotal = imgGens.length;
  const imgGenDisplay = imgGenIndex >= 0 ? imgGenTotal - imgGenIndex : imgGenTotal;

  const switchImgGen = (dir: -1 | 1) => {
    if (!hasMultipleImgGens) return;
    const newIdx = (imgGenIndex + dir + imgGenTotal) % imgGenTotal;
    onUpdate({ imageUrl: imgGens[newIdx] });
  };

  // Video generation carousel (ensure current video is in history)
  const vidGensRaw = shot.videoHistory ?? [];
  const vidGens = shot.videoUrl && !vidGensRaw.includes(shot.videoUrl) ? [shot.videoUrl, ...vidGensRaw] : vidGensRaw;
  const hasMultipleVidGens = vidGens.length > 1;
  const vidGenIndex = shot.videoUrl ? vidGens.indexOf(shot.videoUrl) : -1;
  const vidGenTotal = vidGens.length;
  const vidGenDisplay = vidGenIndex >= 0 ? vidGenTotal - vidGenIndex : vidGenTotal;

  const switchVidGen = (dir: -1 | 1) => {
    if (!hasMultipleVidGens) return;
    const newIdx = (vidGenIndex + dir + vidGenTotal) % vidGenTotal;
    onUpdate({ videoUrl: vidGens[newIdx] });
  };

  const effDuration = shot.settings.video.duration ?? globalDuration;
  const endFrameSrc = shot.endImageRef?.preview ?? shot.endImageUrl;
  // Reset end frame loading states when source changes
  useEffect(() => { setEndFrameOverlayLoaded(false); }, [endFrameSrc]);
  const effImageAR = shot.settings.image.aspectRatio ?? globalAspectRatio;
  const [arW, arH] = effImageAR.split(":").map(Number);

  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDrop = async (e: React.DragEvent, target: "first" | "last") => {
    e.preventDefault();
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
          if ((err as Error).name !== "AbortError") console.error("[StoryboardCard] Video frame extraction failed:", err);
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
      console.error("[StoryboardCard] File drop upload failed:", err);
    }
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  return (
    <div className={`relative flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border bg-surface transition-all ${
      isBlurred ? "pointer-events-none scale-[0.98] opacity-40 blur-[2px]" : ""
    } ${
      isBusy ? "border-accent/50 glow-border"
      : shot.imageStatus === "error" || shot.videoStatus === "error" ? "border-destructive/30"
      : "border-border hover:border-border/80"
    }`} style={{ scrollSnapAlign: "start" }}>
      {/* Subtle card shimmer when generating/animating */}
      {isBusy && (
        <div className="pointer-events-none absolute inset-0 z-[1] -translate-x-full animate-[shimmer_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/[0.03] to-transparent" />
      )}
      {/* Hero Image */}
      <div
        className="relative"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, "first")}
      >
        {/* Determine what to show in hero: video mode, image mode, or empty */}
        {shot.videoUrl && heroMode === "video" ? (
          <div className="group relative">
            {!heroVideoLoaded && (
              <div className="absolute inset-0 animate-pulse rounded-t-lg bg-surface" style={{ aspectRatio: `${arW}/${arH}`, maxHeight: "360px" }} />
            )}
            <video
              ref={videoRef}
              src={shot.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className={`w-full rounded-t-lg object-cover cursor-pointer transition-opacity duration-300 ${heroVideoLoaded ? "opacity-100" : "opacity-0"}`}
              style={{ aspectRatio: `${arW}/${arH}`, maxHeight: "360px" }}
              onClick={() => onOpenLightbox(shot.videoUrl!, "video")}
              onLoadedData={markHeroVideoLoaded}
              onLoadedMetadata={markHeroVideoLoaded}
            />
            {/* Pause/play toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) { v.play(); setVideoPaused(false); }
                else { v.pause(); setVideoPaused(true); }
              }}
              className="absolute left-2 bottom-8 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/80 opacity-0 shadow transition group-hover:opacity-100 hover:bg-black/70 hover:text-white"
            >
              {videoPaused ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4z" /></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="0.5" /><rect x="6" y="1" width="3" height="8" rx="0.5" /></svg>
              )}
            </button>

            {/* Video generation carousel arrows */}
            {hasMultipleVidGens && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); switchVidGen(-1); }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 shadow transition group-hover:opacity-100 hover:bg-black/70 hover:text-white"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2L4 6l4 4" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); switchVidGen(1); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 shadow transition group-hover:opacity-100 hover:bg-black/70 hover:text-white"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 2l4 4-4 4" /></svg>
                </button>
              </>
            )}
            {/* Clickable generation counters — switch hero mode */}
            <div className="absolute left-2 top-2 flex gap-1.5">
              <div className="rounded-full bg-accent/80 px-2 py-0.5 text-[9px] font-bold text-black shadow">
                &#9654; {vidGenDisplay}/{vidGenTotal}
              </div>
              {imgGenTotal > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setHeroMode("image"); }}
                  className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white/80 shadow transition hover:bg-black/70">
                  &#9632; {imgGenTotal}
                </button>
              )}
            </div>
          </div>
        ) : shot.imageUrl ? (
          <div className="group relative" draggable onDragStart={(e) => handleDragStart(e, shot.imageUrl!)}>
            <button onClick={() => onOpenLightbox(shot.imageUrl!, "image")} className="relative block w-full"
              style={{ aspectRatio: `${arW}/${arH}`, maxHeight: "360px" }}>
              {!heroImgLoaded && <div className="absolute inset-0 animate-pulse rounded-t-lg bg-surface" />}
              <Image src={shot.imageUrl!} alt={`Shot ${shot.number}`} fill sizes="200px"
                onLoad={markHeroImgLoaded}
                className={`rounded-t-lg object-cover cursor-grab transition-opacity ${heroImgLoaded ? "opacity-100" : "opacity-0"}`} />
            </button>
            <button onClick={() => onUpdate({ imageUrl: null, imageStatus: "pending" as ShotStatus })}
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white/80 hover:text-white">x</button>

            {/* Image generation carousel arrows */}
            {hasMultipleImgGens && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); switchImgGen(-1); }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 shadow transition group-hover:opacity-100 hover:bg-black/70 hover:text-white"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2L4 6l4 4" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); switchImgGen(1); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 shadow transition group-hover:opacity-100 hover:bg-black/70 hover:text-white"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 2l4 4-4 4" /></svg>
                </button>
              </>
            )}
            {/* Clickable generation counters — switch hero mode */}
            <div className="absolute left-2 top-2 flex gap-1.5">
              <div className="rounded-full bg-accent/80 px-2 py-0.5 text-[9px] font-bold text-black shadow">
                &#9632; {imgGenDisplay}/{imgGenTotal}
              </div>
              {vidGenTotal > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setHeroMode("video"); }}
                  className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white/80 shadow transition hover:bg-black/70">
                  &#9654; {vidGenTotal}
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => (document.getElementById(`sb-first-${shot.id}`) as HTMLInputElement)?.click()}
            className="flex w-full cursor-pointer items-center justify-center rounded-t-lg border-b border-dashed border-border bg-background/50 transition hover:border-accent/40"
            style={{ aspectRatio: `${arW}/${arH}`, maxHeight: "360px" }}>
            {isImageBusy ? (
              <div className="absolute inset-0 overflow-hidden rounded-t-lg">
                <div className="absolute inset-0 animate-pulse bg-accent/[0.04]" />
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/[0.08] to-transparent" />
              </div>
            ) : (
              <span className="text-xs text-muted/40">Drop or click</span>
            )}
          </button>
        )}
        <input id={`sb-first-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const formData = new FormData();
              formData.append("file", file);
              const res = await fetch("/api/upload", { method: "POST", body: formData });
              const data = await res.json();
              if (data.url) onDropOnFirst(data.url);
            } catch (err) { console.error("[StoryboardCard] First frame upload failed:", err); }
            e.target.value = "";
          }}
        />

        {/* Shot number + duration overlay */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 rounded-b-none">
          <span className="text-sm font-bold tracking-wide text-white/90"><span className="text-white/50">#</span>{shot.number}</span>
          <div className="flex items-center gap-1.5">
            {shot.videoUrl && <span className="text-[9px] text-accent">&#9654;</span>}
            <span className="text-[10px] text-white/70">{effDuration}s</span>
          </div>
        </div>

        {/* Last frame mini overlay */}
        {endFrameSrc && (
          <div className="absolute right-1.5 bottom-8 h-10 w-7 overflow-hidden rounded-md border border-accent/40 shadow"
            draggable onDragStart={(e) => handleDragStart(e, shot.endImageUrl ?? endFrameSrc)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, "last")}>
            {isBlobUrl(endFrameSrc) ? (
              <>
                {!_loadedUrlCache.has(endFrameSrc) && <div className="absolute inset-0 animate-pulse bg-surface" />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={endFrameSrc} alt="Last"
                  className="h-full w-full object-cover"
                  onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; _loadedUrlCache.add(endFrameSrc); }}
                  style={{ opacity: _loadedUrlCache.has(endFrameSrc) ? 1 : 0, transition: "opacity 0.2s" }} />
              </>
            ) : (
              <div className="relative h-full w-full">
                {!endFrameOverlayLoaded && <div className="absolute inset-0 animate-pulse bg-surface" />}
                <Image src={endFrameSrc} alt="Last" fill sizes="28px"
                  onLoad={() => setEndFrameOverlayLoaded(true)}
                  className={`object-cover transition-opacity ${endFrameOverlayLoaded ? "opacity-100" : "opacity-0"}`} />
              </div>
            )}
          </div>
        )}

        {/* Generating indicator — right side to avoid tag overlap */}
        {isBusy && (
          <div className="absolute right-2 top-2">
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="shimmer-text">{isImageBusy ? "Generating..." : "Animating..."}</span>
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="relative px-2 pt-2">
        <input type="text" value={shot.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Title"
          className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted/30" />
        <div className="pointer-events-none absolute right-2 top-2 h-full w-6 bg-gradient-to-l from-surface to-transparent" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 px-2 py-2">
        {isImageBusy ? (
          <Button variant="destructive" size="xs" className="flex-1" onClick={onCancelImage}>Cancel</Button>
        ) : (
          <Button variant="primary" size="xs" className="flex-1" onClick={onGenerateImage}>
            {shot.imageStatus === "done" ? "Regenerate" : "Generate"}
            {imgCredits > 0 && (
              <span className="ml-0.5 flex items-center gap-0.5 opacity-60">
                <CreditIcon size={7} />{imgCredits}
              </span>
            )}
          </Button>
        )}
        {isVideoBusy ? (
          <Button variant="destructive" size="xs" className="flex-1" onClick={onCancelVideo}>Cancel</Button>
        ) : (
          <Button variant="secondary" size="xs" className="flex-1 whitespace-nowrap" onClick={onAnimateShot} disabled={!canAnimate}>
            {shot.videoStatus === "done" ? "Re-Animate" : "Animate"}
            {vidCredits > 0 && (
              <span className="ml-0.5 flex items-center gap-0.5 opacity-60">
                <CreditIcon size={7} />{vidCredits}
              </span>
            )}
          </Button>
        )}
      </div>
      {/* Chain to next shot */}
      {shot.videoUrl && onLastFrameToNext && (
        <div className="px-2 pb-1">
          <button
            onClick={async () => {
              if (extracting) return;
              const ac = new AbortController();
              extractAbortRef.current = ac;
              try {
                setExtracting(true);
                const frameUrl = await extractLastFrameAndUpload(shot.videoUrl!, ac.signal);
                onLastFrameToNext(frameUrl);
              } catch (err) {
                if ((err as Error).name !== "AbortError") console.error("[StoryboardCard] Extract last frame failed:", err);
              } finally {
                extractAbortRef.current = null;
                setExtracting(false);
              }
            }}
            disabled={extracting}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-border px-2 py-1 text-[9px] font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
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
        </div>
      )}

      {/* Settings + Delete */}
      <div className="flex items-center gap-1 border-t border-border/50 px-2 py-1.5">
        <button onClick={() => onOpenModal("image")}
          className="flex-1 rounded-md py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted transition hover:bg-accent/10 hover:text-accent">
          Image
        </button>
        <button onClick={() => onOpenModal("video")}
          className="flex-1 rounded-md py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted transition hover:bg-accent/10 hover:text-accent">
          Video
        </button>
        <button onClick={onRemove} className="px-1 text-[9px] text-muted/40 hover:text-destructive">&times;</button>
      </div>
    </div>
  );
}

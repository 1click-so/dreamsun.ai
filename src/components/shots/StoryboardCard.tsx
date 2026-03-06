"use client";

import React, { useState } from "react";
import type { Shot, ShotStatus, ImageSettings, VideoSettings, UploadedRef } from "@/types/shots";
import type { ModelConfig } from "@/lib/models";
import type { VideoModelConfig } from "@/lib/video-models";
import { VIDEO_MODELS } from "@/lib/video-models";
import { getSelectableModels, resolveModel } from "@/lib/models";
import { Button } from "@/components/ui/Button";
import { TaggableTextarea } from "@/components/ui/TaggableTextarea";

interface StoryboardCardProps {
  shot: Shot;
  masterRefs: UploadedRef[];
  globalDuration: number;
  globalAspectRatio: string;
  globalGenerateAudio: boolean;
  globalResolution: string;
  videoModel: VideoModelConfig;
  imageModel: ModelConfig;
  onUpdate: (updates: Partial<Shot>) => void;
  onRemove: () => void;
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
}

export function StoryboardCard({
  shot,
  masterRefs,
  globalDuration,
  globalAspectRatio,
  globalGenerateAudio,
  globalResolution,
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
}: StoryboardCardProps) {
  const [expandedSection, setExpandedSection] = useState<"image" | "video" | null>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const [heroMode, setHeroMode] = useState<"video" | "image">("video");
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const hasRefs = (shot.refImages ?? []).some((r) => r.url);
  const effImageModelId = shot.settings.image.modelId ?? imageModel.id;
  const effImageModel = resolveModel(effImageModelId, hasRefs) ?? imageModel;
  const imageSupportsNeg = effImageModel.supportsNegativePrompt;

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

  const vidSettings = shot.settings.video;
  const effDuration = vidSettings.duration ?? globalDuration;
  const effVideoModel = vidSettings.modelId
    ? VIDEO_MODELS.find((m) => m.id === vidSettings.modelId) ?? videoModel
    : videoModel;
  const videoSupportsNeg = effVideoModel.supportsNegativePrompt;
  const endFrameSrc = shot.endImageRef?.preview ?? shot.endImageUrl;
  const refImages = shot.refImages ?? [];
  const selectableModels = getSelectableModels();
  const imgSettings = shot.settings.image;
  const effImageAR = imgSettings.aspectRatio ?? globalAspectRatio;
  const [arW, arH] = effImageAR.split(":").map(Number);

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

  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDrop = async (e: React.DragEvent, target: "first" | "last") => {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/plain");
    if (url) {
      if (target === "first") onDropOnFirst(url);
      else onDropOnLast(url);
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
    <div className={`flex w-56 shrink-0 flex-col rounded-lg border bg-surface transition-all ${
      isBusy ? "border-accent/50 glow-border"
      : shot.imageStatus === "error" || shot.videoStatus === "error" ? "border-destructive/30"
      : "border-border hover:border-border/80"
    }`} style={{ scrollSnapAlign: "start" }}>
      {/* Hero Image */}
      <div
        className="relative"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, "first")}
      >
        {/* Determine what to show in hero: video mode, image mode, or empty */}
        {shot.videoUrl && heroMode === "video" ? (
          <div className="group relative">
            <video
              ref={videoRef}
              src={shot.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-t-lg object-cover cursor-pointer"
              style={{ aspectRatio: `${arW}/${arH}`, maxHeight: "360px" }}
              onClick={() => onOpenLightbox(shot.videoUrl!, "video")}
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
            <button onClick={() => onOpenLightbox(shot.imageUrl!, "image")} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.imageUrl} alt={`Shot ${shot.number}`}
                className="w-full rounded-t-lg object-cover cursor-grab" style={{ aspectRatio: `${arW}/${arH}`, maxHeight: "360px" }} />
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
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
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
          <span className="text-xs font-bold text-white/90">#{shot.number}</span>
          <div className="flex items-center gap-1.5">
            {shot.videoUrl && <span className="text-[9px] text-accent">&#9654;</span>}
            <span className="text-[10px] text-white/70">{effDuration}s</span>
          </div>
        </div>

        {/* Last frame mini overlay */}
        {endFrameSrc && (
          <div className="absolute right-1.5 bottom-8 h-10 w-7 overflow-hidden rounded border border-accent/40 shadow"
            draggable onDragStart={(e) => handleDragStart(e, shot.endImageUrl ?? endFrameSrc)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, "last")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={endFrameSrc} alt="Last" className="h-full w-full object-cover" />
            <button onClick={onEndFrameRemove}
              className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-black/70 text-[7px] text-white/80 hover:text-white">x</button>
          </div>
        )}

        {/* Generating indicator — right side to avoid tag overlap */}
        {isBusy && (
          <div className="absolute right-2 top-2">
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-accent">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {isImageBusy ? "Image..." : "Video..."}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="px-2 pt-2">
        <input type="text" value={shot.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Title"
          className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted/30" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 px-2 py-2">
        {isImageBusy ? (
          <Button variant="destructive" size="xs" className="flex-1" onClick={onCancelImage}>Cancel</Button>
        ) : (
          <Button variant="primary" size="xs" className="flex-1" onClick={onGenerateImage}>
            {shot.imageStatus === "done" ? "Regenerate" : "Generate"}
          </Button>
        )}
        {isVideoBusy ? (
          <Button variant="destructive" size="xs" className="flex-1" onClick={onCancelVideo}>Cancel</Button>
        ) : (
          <Button variant="secondary" size="xs" className="flex-1" onClick={onAnimateShot} disabled={!canAnimate}>
            {shot.videoStatus === "done" ? "Re-Animate" : "Animate"}
          </Button>
        )}
      </div>

      {/* Expandable sections */}
      <div className="border-t border-border/50 px-2 py-1">
        {/* Image section toggle */}
        <button onClick={() => setExpandedSection(expandedSection === "image" ? null : "image")}
          className={`w-full flex items-center justify-between py-1 text-[9px] font-semibold uppercase tracking-wider transition ${
            expandedSection === "image" ? "text-accent" : "text-muted hover:text-foreground"}`}>
          <span>Image</span>
          <span>{expandedSection === "image" ? "\u2212" : "+"}</span>
        </button>
        {expandedSection === "image" && (
          <div className="space-y-2 pb-2">
            <TaggableTextarea
              value={shot.imagePrompt}
              onChange={(v) => onUpdate({ imagePrompt: v })}
              rows={3}
              placeholder="Image prompt... (@ to ref images)"
              className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
              images={tagImages}
            />
            {imageSupportsNeg && !shot.imageNegativePrompt && (
              <button onClick={() => onUpdate({ imageNegativePrompt: " " })}
                className="flex items-center gap-1 self-start text-[9px] text-muted/60 transition hover:text-destructive">
                <span className="flex h-3 w-3 items-center justify-center rounded bg-muted/10 text-[8px] font-bold leading-none">−</span>
                Negative
              </button>
            )}
            {imageSupportsNeg && shot.imageNegativePrompt && (
              <div className="relative">
                <textarea value={shot.imageNegativePrompt.trim()} onChange={(e) => onUpdate({ imageNegativePrompt: e.target.value })}
                  rows={2} placeholder="no blur, no artifacts..."
                  className="w-full resize-y rounded-lg border border-destructive/20 bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-destructive/40" />
                <button onClick={() => onUpdate({ imageNegativePrompt: "" })}
                  className="absolute right-1.5 top-1.5 text-[8px] text-muted/40 hover:text-destructive">✕</button>
              </div>
            )}
            {/* Refs */}
            <div className="flex flex-wrap items-center gap-1"
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
              <span className="text-[8px] font-medium uppercase text-muted">References:</span>
              {refImages.map((ref, i) => (
                <div key={ref.id} className="relative h-6 w-6 overflow-hidden rounded border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.preview} alt="Ref" className="h-full w-full object-cover" />
                  <button onClick={() => onRefRemove(ref.id)} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[7px] text-muted hover:text-foreground">x</button>
                  <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-0.5 font-mono text-[6px] font-bold leading-tight text-accent">@{masterRefOffset + i + 1}</span>
                </div>
              ))}
              <button onClick={() => (document.getElementById(`sb-ref-${shot.id}`) as HTMLInputElement)?.click()}
                className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-border text-[9px] text-muted hover:border-accent/50 hover:text-accent">+</button>
              <input id={`sb-ref-${shot.id}`} ref={refInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onRefUpload} className="hidden" />
            </div>
            {/* Image model/ratio */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Model</label>
                <select value={imgSettings.modelId ?? ""} onChange={(e) => onImageSettingsChange({ modelId: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-muted">
                  <option value="">Global</option>
                  {selectableModels.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Ratio</label>
                <select value={imgSettings.aspectRatio ?? ""} onChange={(e) => onImageSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-muted">
                  <option value="">Global</option>
                  {["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"].map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Video section toggle */}
        <button onClick={() => setExpandedSection(expandedSection === "video" ? null : "video")}
          className={`w-full flex items-center justify-between py-1 text-[9px] font-semibold uppercase tracking-wider transition ${
            expandedSection === "video" ? "text-accent" : "text-muted hover:text-foreground"}`}>
          <span>Video</span>
          <span>{expandedSection === "video" ? "\u2212" : "+"}</span>
        </button>
        {expandedSection === "video" && (
          <div className="space-y-2 pb-2">
            <textarea value={shot.videoPrompt}
              onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
              rows={3} placeholder="Video/motion prompt..."
              className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
            {videoSupportsNeg && !shot.videoNegativePrompt && (
              <button onClick={() => onUpdate({ videoNegativePrompt: " " })}
                className="flex items-center gap-1 self-start text-[9px] text-muted/60 transition hover:text-destructive">
                <span className="flex h-3 w-3 items-center justify-center rounded bg-muted/10 text-[8px] font-bold leading-none">−</span>
                Negative
              </button>
            )}
            {videoSupportsNeg && shot.videoNegativePrompt && (
              <div className="relative">
                <textarea value={shot.videoNegativePrompt.trim()} onChange={(e) => onUpdate({ videoNegativePrompt: e.target.value })}
                  rows={2} placeholder="blur, distort, low quality..."
                  className="w-full resize-y rounded-lg border border-destructive/20 bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-destructive/40" />
                <button onClick={() => onUpdate({ videoNegativePrompt: "" })}
                  className="absolute right-1.5 top-1.5 text-[8px] text-muted/40 hover:text-destructive">✕</button>
              </div>
            )}
            {/* Last frame */}
            <div className="flex items-center gap-1"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "last")}>
              <span className="text-[8px] font-medium uppercase text-muted">Last:</span>
              {endFrameSrc ? (
                <div className="relative h-6 w-6 overflow-hidden rounded border border-accent/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={endFrameSrc} alt="End" className="h-full w-full object-cover" />
                  <button onClick={onEndFrameRemove} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[7px] text-muted hover:text-foreground">x</button>
                </div>
              ) : (
                <button onClick={() => (document.getElementById(`sb-end-${shot.id}`) as HTMLInputElement)?.click()}
                  className="rounded border border-dashed border-border px-1 text-[8px] text-muted hover:border-accent/40 hover:text-accent">+ upload</button>
              )}
              <input id={`sb-end-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={onEndFrameUpload} className="hidden" />
            </div>
            {/* Duration / Ratio / Res / Sound */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Duration</label>
                <select value={vidSettings.duration ?? ""} onChange={(e) => onVideoSettingsChange({ duration: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-muted">
                  <option value="">{globalDuration}s</option>
                  {(effVideoModel.durations ?? []).map((d) => (<option key={d} value={d}>{d}s</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Ratio</label>
                <select value={vidSettings.aspectRatio ?? ""} onChange={(e) => onVideoSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-muted">
                  <option value="">{globalAspectRatio}</option>
                  {(effVideoModel.aspectRatios ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
              {(effVideoModel.resolutions?.length ?? 0) > 0 && (
                <div>
                  <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Res</label>
                  <select value={vidSettings.resolution ?? ""} onChange={(e) => onVideoSettingsChange({ resolution: e.target.value || null })}
                    className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-muted">
                    <option value="">{globalResolution}</option>
                    {(effVideoModel.resolutions ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Model</label>
                <select value={vidSettings.modelId ?? ""} onChange={(e) => onVideoSettingsChange({ modelId: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-muted">
                  <option value="">Global</option>
                  {VIDEO_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
            </div>
            {effVideoModel.supportsGenerateAudio && (() => {
              const effAudio = vidSettings.generateAudio ?? globalGenerateAudio;
              return (
                <button onClick={() => onVideoSettingsChange({ generateAudio: effAudio ? false : true })}
                  className={`w-full rounded border py-0.5 text-[9px] font-medium uppercase transition ${
                    effAudio
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:border-muted"
                  }`}>{effAudio ? "Sound on" : "Sound off"}</button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="border-t border-border/30 px-2 py-1">
        <button onClick={onRemove} className="w-full text-center text-[9px] text-muted/50 hover:text-destructive">delete</button>
      </div>
    </div>
  );
}

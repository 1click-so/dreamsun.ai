"use client";

import { useState } from "react";
import type { Shot, ShotStatus, ImageSettings, VideoSettings } from "@/types/shots";
import type { ModelConfig } from "@/lib/models";
import type { VideoModelConfig } from "@/lib/video-models";
import { VIDEO_MODELS } from "@/lib/video-models";
import { getSelectableModels } from "@/lib/models";
import { Button } from "@/components/ui/Button";

interface StoryboardCardProps {
  shot: Shot;
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

  // Suppress unused variable warnings
  void imageModel;

  const isImageBusy = shot.imageStatus === "generating";
  const isVideoBusy = shot.videoStatus === "generating";
  const isBusy = isImageBusy || isVideoBusy;
  const canAnimate = shot.imageStatus === "done" && shot.imageUrl && !isVideoBusy;

  const vidSettings = shot.settings.video;
  const effDuration = vidSettings.duration ?? globalDuration;
  const effVideoModel = vidSettings.modelId
    ? VIDEO_MODELS.find((m) => m.id === vidSettings.modelId) ?? videoModel
    : videoModel;
  const endFrameSrc = shot.endImageRef?.preview ?? shot.endImageUrl;
  const refImages = shot.refImages ?? [];
  const selectableModels = getSelectableModels();
  const imgSettings = shot.settings.image;

  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDrop = (e: React.DragEvent, target: "first" | "last") => {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/plain");
    if (!url) return;
    if (target === "first") onDropOnFirst(url);
    else onDropOnLast(url);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  return (
    <div className={`flex w-56 shrink-0 flex-col rounded-lg border bg-surface transition-all ${
      isBusy ? "border-accent/60 shadow-[0_0_12px_-3px] shadow-accent/20"
      : shot.imageStatus === "done" && shot.videoStatus === "done" ? "border-accent/25"
      : shot.imageStatus === "error" || shot.videoStatus === "error" ? "border-destructive/30"
      : "border-border hover:border-border/80"
    }`} style={{ scrollSnapAlign: "start" }}>
      {/* Hero Image */}
      <div
        className="relative"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, "first")}
      >
        {shot.imageUrl ? (
          <div draggable onDragStart={(e) => handleDragStart(e, shot.imageUrl!)}>
            <button onClick={() => onOpenLightbox(shot.imageUrl!, "image")} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.imageUrl} alt={`Shot ${shot.number}`}
                className="w-full rounded-t-lg object-cover cursor-grab" style={{ aspectRatio: "9/16", maxHeight: "360px" }} />
            </button>
            <button onClick={() => onUpdate({ imageUrl: null, imageStatus: "pending" as ShotStatus })}
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white/80 hover:text-white">x</button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-center rounded-t-lg border-b border-dashed border-border bg-background/50"
            style={{ aspectRatio: "9/16", maxHeight: "360px" }}>
            {isImageBusy ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              <span className="text-xs text-muted/40">No image</span>
            )}
          </div>
        )}

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

        {/* Generating indicator */}
        {isBusy && (
          <div className="absolute left-2 top-2">
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
            {shot.imageStatus === "done" ? "Regen" : "Generate"}
          </Button>
        )}
        {isVideoBusy ? (
          <Button variant="destructive" size="xs" className="flex-1" onClick={onCancelVideo}>Cancel</Button>
        ) : (
          <Button variant="secondary" size="xs" className="flex-1" onClick={onAnimateShot} disabled={!canAnimate}>
            {shot.videoStatus === "done" ? "Re-anim" : "Animate"}
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
            <textarea value={shot.imagePrompt}
              onChange={(e) => onUpdate({ imagePrompt: e.target.value })}
              rows={3} placeholder="Image prompt..."
              className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
            {/* Refs */}
            <div className="flex flex-wrap items-center gap-1"
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
              onDrop={(e) => { if (e.dataTransfer.files.length > 0) { e.preventDefault(); onRefFileDrop(Array.from(e.dataTransfer.files)); } }}>
              <span className="text-[8px] font-medium uppercase text-muted">Refs:</span>
              {refImages.map((ref) => (
                <div key={ref.id} className="relative h-6 w-6 overflow-hidden rounded border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.preview} alt="Ref" className="h-full w-full object-cover" />
                  <button onClick={() => onRefRemove(ref.id)} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[7px] text-muted hover:text-foreground">x</button>
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

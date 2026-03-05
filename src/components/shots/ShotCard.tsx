"use client";

import { useState } from "react";
import type { Shot, ShotStatus, ImageSettings, VideoSettings, UploadedRef } from "@/types/shots";
import type { ModelConfig } from "@/lib/models";
import type { VideoModelConfig } from "@/lib/video-models";
import { VIDEO_MODELS } from "@/lib/video-models";
import { getSelectableModels } from "@/lib/models";
import { Button } from "@/components/ui/Button";

interface ShotCardProps {
  shot: Shot;
  globalDuration: number;
  globalAspectRatio: string;
  globalGenerateAudio: boolean;
  globalResolution: string;
  videoModel: VideoModelConfig;
  imageModel: ModelConfig;
  onUpdate: (updates: Partial<Shot>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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

const statusColors: Record<ShotStatus, string> = {
  pending: "border-border text-muted",
  generating: "border-accent text-accent",
  done: "border-accent text-accent",
  error: "border-destructive text-destructive",
};

export function ShotCard({
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
  onMoveUp,
  onMoveDown,
}: ShotCardProps) {
  const [showSettings, setShowSettings] = useState(false);

  // Suppress unused variable warning — statusColors kept for reference/future use
  void statusColors;

  const isImageBusy = shot.imageStatus === "generating";
  const isVideoBusy = shot.videoStatus === "generating";
  const canAnimate = shot.imageStatus === "done" && shot.imageUrl && !isVideoBusy;

  // Effective values (per-shot or global)
  const effDuration = shot.settings.video.duration ?? globalDuration;
  const effAspectRatio = shot.settings.video.aspectRatio ?? globalAspectRatio;
  const imgSettings = shot.settings.image;
  const vidSettings = shot.settings.video;
  const hasOverrides =
    imgSettings.modelId != null || imgSettings.aspectRatio != null ||
    vidSettings.modelId != null || vidSettings.duration != null || vidSettings.aspectRatio != null ||
    vidSettings.resolution != null || vidSettings.cameraFixed != null || vidSettings.generateAudio != null;

  // Suppress unused — effAspectRatio used implicitly in video settings display
  void effAspectRatio;
  void effDuration;

  const selectableModels = getSelectableModels();
  const effVideoModel = vidSettings.modelId
    ? VIDEO_MODELS.find((m) => m.id === vidSettings.modelId) ?? videoModel
    : videoModel;

  const endFrameSrc = shot.endImageRef?.preview ?? shot.endImageUrl;
  const endFrameUploading = shot.endImageRef?.uploading ?? false;
  const history = shot.imageHistory ?? [];
  const refImages = shot.refImages ?? [];

  // Drag-and-drop helpers
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

  const isBusy = isImageBusy || isVideoBusy;

  return (
    <div className={`overflow-hidden rounded-lg border bg-surface transition-all ${
      isBusy ? "border-accent/60 shadow-[0_0_12px_-3px] shadow-accent/20"
      : shot.imageStatus === "done" && shot.videoStatus === "done" ? "border-accent/25"
      : shot.imageStatus === "error" || shot.videoStatus === "error" ? "border-destructive/30"
      : "border-border"
    }`}>
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
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-accent">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            {isImageBusy ? "Generating..." : "Animating..."}
          </span>
        )}
        {shot.error && <span className="shrink-0 text-[11px] text-destructive">{shot.error}</span>}
        <button onClick={() => setShowSettings(!showSettings)}
          className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-medium transition ${hasOverrides ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted hover:border-accent/30"}`}
        >{showSettings ? "Less" : "More"}</button>
        <button onClick={onRemove} className="shrink-0 text-[11px] text-muted hover:text-destructive">delete</button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-[1fr_1fr_auto] border-t border-border">

        {/* BENTO: Image Controls */}
        <div className="flex flex-col border-r border-border p-3 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Image</span>
          <textarea value={shot.imagePrompt}
            onChange={(e) => onUpdate({ imagePrompt: e.target.value })}
            rows={3} placeholder="Image prompt..."
            className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
          {/* Row 1: References + Generations */}
          <div className="grid grid-cols-2 gap-2">
            {/* References column */}
            <div
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
              onDrop={(e) => { if (e.dataTransfer.files.length > 0) { e.preventDefault(); onRefFileDrop(Array.from(e.dataTransfer.files)); } }}>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">References</span>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pb-1 storyboard-scroll">
                {refImages.map((ref) => (
                  <div key={ref.id} className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-border" draggable onDragStart={(e) => ref.url && handleDragStart(e, ref.url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.preview} alt="Ref" className="h-full w-full object-cover" />
                    {ref.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                    <button onClick={() => onRefRemove(ref.id)} className="absolute -right-0.5 -top-0.5 rounded-full bg-black/70 px-0.5 text-[8px] text-white/70 hover:text-white">x</button>
                  </div>
                ))}
                <button onClick={() => (document.getElementById(`shot-ref-${shot.id}`) as HTMLInputElement)?.click()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-dashed border-border text-[11px] text-muted hover:border-accent/50 hover:text-accent">+</button>
                <input id={`shot-ref-${shot.id}`} ref={refInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onRefUpload} className="hidden" />
              </div>
            </div>
            {/* Generations column */}
            <div>
              <span className="mb-1 block text-[9px] font-medium uppercase text-muted">Generations{history.length > 0 ? ` (${history.length})` : ""}</span>
              {history.length > 0 ? (
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pb-1 storyboard-scroll">
                  {history.map((url, i) => (
                    <div key={i} draggable onDragStart={(e) => handleDragStart(e, url)} className="relative shrink-0 cursor-grab">
                      <button onClick={() => onOpenLightbox(url, "image")} className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Generation ${i + 1}`}
                          className={`h-12 w-12 rounded border object-cover transition hover:border-accent ${
                            url === shot.imageUrl ? "border-accent" : "border-border/50"
                          }`} />
                      </button>
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[7px] leading-tight text-white/70">{i + 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[9px] text-muted/40">No generations yet</span>
              )}
            </div>
          </div>
          {/* Advanced image settings */}
          {showSettings && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Model</label>
                <select value={imgSettings.modelId ?? ""} onChange={(e) => onImageSettingsChange({ modelId: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">Global</option>
                  {selectableModels.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Ratio</label>
                <select value={imgSettings.aspectRatio ?? ""} onChange={(e) => onImageSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">Global</option>
                  {["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"].map((r) => (<option key={r} value={r}>{r}</option>))}
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
          <textarea value={shot.videoPrompt}
            onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
            rows={3} placeholder="Video/motion prompt..."
            className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
          {/* Last frame */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase text-muted">Last:</span>
            {endFrameSrc ? (
              <div className="relative h-7 w-7 overflow-hidden rounded border border-accent/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={endFrameSrc} alt="End" className="h-full w-full object-cover" />
                {endFrameUploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                <button onClick={onEndFrameRemove} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[8px] text-muted hover:text-foreground">x</button>
              </div>
            ) : (
              <button onClick={() => (document.getElementById(`end-frame-${shot.id}`) as HTMLInputElement)?.click()}
                className="flex h-7 items-center rounded border border-dashed border-border px-1.5 text-[9px] text-muted hover:border-accent/40 hover:text-accent">+ upload</button>
            )}
            <input id={`end-frame-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={onEndFrameUpload} className="hidden" />
          </div>
          {/* Duration / Ratio / Res / Sound */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium uppercase text-muted">Dur</span>
              <select value={vidSettings.duration ?? ""} onChange={(e) => onVideoSettingsChange({ duration: e.target.value ? Number(e.target.value) : null })}
                className="rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-muted">
                <option value="">{globalDuration}s</option>
                {(effVideoModel.durations ?? []).map((d) => (<option key={d} value={d}>{d}s</option>))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium uppercase text-muted">Ratio</span>
              <select value={vidSettings.aspectRatio ?? ""} onChange={(e) => onVideoSettingsChange({ aspectRatio: e.target.value || null })}
                className="rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-muted">
                <option value="">{globalAspectRatio}</option>
                {(effVideoModel.aspectRatios ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            {(effVideoModel.resolutions?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-medium uppercase text-muted">Res</span>
                <select value={vidSettings.resolution ?? ""} onChange={(e) => onVideoSettingsChange({ resolution: e.target.value || null })}
                  className="rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">{globalResolution}</option>
                  {(effVideoModel.resolutions ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
            )}
            {effVideoModel.supportsGenerateAudio && (() => {
              const effAudio = vidSettings.generateAudio ?? globalGenerateAudio;
              return (
                <button
                  onClick={() => onVideoSettingsChange({ generateAudio: effAudio ? false : true })}
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase transition ${
                    effAudio
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:border-muted"
                  }`}
                >{effAudio ? "Sound on" : "Sound off"}</button>
              );
            })()}
          </div>
          {/* Advanced video settings */}
          {showSettings && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Model</label>
                <select value={vidSettings.modelId ?? ""} onChange={(e) => {
                  const id = e.target.value || null;
                  onVideoSettingsChange({ modelId: id });
                  if (id) { const m = VIDEO_MODELS.find((v) => v.id === id); if (m && vidSettings.resolution && !m.resolutions.includes(vidSettings.resolution)) onVideoSettingsChange({ modelId: id, resolution: null }); }
                }} className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                  <option value="">Global</option>
                  {VIDEO_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              {effVideoModel.supportsCameraFixed && (
                <div>
                  <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Camera</label>
                  <select value={vidSettings.cameraFixed == null ? "" : vidSettings.cameraFixed ? "true" : "false"}
                    onChange={(e) => onVideoSettingsChange({ cameraFixed: e.target.value === "" ? null : e.target.value === "true" })}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-muted">
                    <option value="">Auto</option><option value="true">Fixed</option><option value="false">Free</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {/* Animate button */}
          <div className="mt-auto pt-2">
            {isVideoBusy ? (
              <Button variant="destructive" size="xs" onClick={onCancelVideo}>Cancel</Button>
            ) : (
              <Button variant="secondary" size="xs" onClick={onAnimateShot} disabled={!canAnimate}>
                {shot.videoStatus === "done" ? "Re-animate" : "Animate"}
              </Button>
            )}
          </div>
        </div>

        {/* BENTO: Output */}
        <div className="flex gap-2.5 p-3">
          {/* First Frame */}
          <div className="text-center"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, "first")}
          >
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-muted">First</span>
            {shot.imageUrl ? (
              <div className="relative" draggable onDragStart={(e) => handleDragStart(e, shot.imageUrl!)}>
                <button onClick={() => onOpenLightbox(shot.imageUrl!, "image")} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.imageUrl} alt={`Shot ${shot.number}`}
                    className="h-40 w-[90px] rounded-md border border-border object-cover transition hover:border-muted cursor-grab" />
                </button>
                <button onClick={() => onUpdate({ imageUrl: null, imageStatus: "pending" as ShotStatus })}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] text-white/70 hover:text-white">x</button>
              </div>
            ) : (
              <div className="flex h-40 w-[90px] items-center justify-center rounded-md border-2 border-dashed border-border">
                {isImageBusy ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  : <span className="text-[8px] text-muted/40">Drop or<br/>generate</span>}
              </div>
            )}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={endFrameSrc} alt="End frame"
                    className="h-40 w-[90px] rounded-md border border-border object-cover transition hover:border-muted cursor-grab" />
                </button>
                <button onClick={onEndFrameRemove}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] text-white/70 hover:text-white">x</button>
                {endFrameUploading && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}
              </div>
            ) : (
              <div className="flex h-40 w-[90px] items-center justify-center rounded-md border-2 border-dashed border-border">
                <span className="text-[8px] text-muted/40">Drop or<br/>upload</span>
              </div>
            )}
          </div>

          {/* Video */}
          <div className="text-center">
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-muted">Video</span>
            {shot.videoUrl ? (
              <button onClick={() => onOpenLightbox(shot.videoUrl!, "video")} className="block">
                <div className="flex h-40 w-[90px] items-center justify-center rounded-md border border-border bg-surface transition hover:border-muted">
                  <span className="text-[10px] font-medium text-foreground">Play</span>
                </div>
              </button>
            ) : (
              <div className="flex h-40 w-[90px] items-center justify-center rounded-md border border-dashed border-border">
                {isVideoBusy ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  : <span className="text-[8px] text-muted/40">No video</span>}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

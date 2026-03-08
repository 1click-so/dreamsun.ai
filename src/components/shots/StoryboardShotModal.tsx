"use client";

import React, { useEffect, useCallback } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import type { Shot, ImageSettings, VideoSettings, UploadedRef } from "@/types/shots";
import type { ModelConfig } from "@/lib/models";
import type { VideoModelConfig } from "@/lib/video-models";
import { VIDEO_MODELS, getCreateModels } from "@/lib/video-models";
import { getSelectableModels, resolveModel } from "@/lib/models";
import { TaggableTextarea } from "@/components/ui/TaggableTextarea";
import { Select } from "@/components/ui/Select";

interface StoryboardShotModalProps {
  shot: Shot;
  mode: "image" | "video";
  masterRefs: UploadedRef[];
  globalDuration: number;
  globalAspectRatio: string;
  globalGenerateAudio: boolean;
  globalResolution: string;
  videoModel: VideoModelConfig;
  imageModel: ModelConfig;
  onUpdate: (updates: Partial<Shot>) => void;
  onRefUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefFileDrop: (files: File[]) => void;
  onRefUrlDrop: (url: string) => void;
  onRefRemove: (refId: string) => void;
  refInputRef: (el: HTMLInputElement | null) => void;
  onEndFrameUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndFrameRemove: () => void;
  onImageSettingsChange: (updates: Partial<ImageSettings>) => void;
  onVideoSettingsChange: (updates: Partial<VideoSettings>) => void;
  onClose: () => void;
  onSetMode: (mode: "image" | "video") => void;
}

/** Module-level cache of URLs that have already loaded */
const _loadedUrlCache = new Set<string>();

export function StoryboardShotModal({
  shot,
  mode,
  masterRefs,
  globalDuration,
  globalAspectRatio,
  globalGenerateAudio,
  globalResolution,
  videoModel,
  imageModel,
  onUpdate,
  onRefUpload,
  onRefFileDrop,
  onRefUrlDrop,
  onRefRemove,
  refInputRef,
  onEndFrameUpload,
  onEndFrameRemove,
  onImageSettingsChange,
  onVideoSettingsChange,
  onClose,
  onSetMode,
}: StoryboardShotModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Image model resolution
  const hasRefs = (shot.refImages ?? []).some((r) => r.url);
  const effImageModelId = shot.settings.image.modelId ?? imageModel.id;
  const effImageModel = resolveModel(effImageModelId, hasRefs) ?? imageModel;
  const imageSupportsNeg = effImageModel.supportsNegativePrompt;

  // Video model resolution
  const vidSettings = shot.settings.video;
  const effVideoModel = vidSettings.modelId
    ? VIDEO_MODELS.find((m) => m.id === vidSettings.modelId) ?? videoModel
    : videoModel;
  const videoSupportsNeg = effVideoModel.supportsNegativePrompt;
  const endFrameSrc = shot.endImageRef?.preview ?? shot.endImageUrl;

  const refImages = shot.refImages ?? [];
  const selectableModels = getSelectableModels();
  const imgSettings = shot.settings.image;

  // Tag images for TaggableTextarea
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

  const isBlobUrl = (url: string) => url.startsWith("blob:");

  const modal = (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop — no blur here, blur is on cards */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal content */}
      <div
        className="relative z-10 flex w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "85vh" }}
      >
        {/* Left: Image preview */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-border bg-background/50">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
            {shot.imageUrl ? (
              <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "auto" }}>
                <Image
                  src={shot.imageUrl}
                  alt={`Shot ${shot.number}`}
                  width={260}
                  height={400}
                  className="h-auto w-full rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-border">
                <span className="text-xs text-muted/40">No image yet</span>
              </div>
            )}
          </div>

          {/* End frame preview (video mode) */}
          {mode === "video" && endFrameSrc && (
            <div className="border-t border-border p-3">
              <div className="mb-1.5 text-[10px] font-medium uppercase text-muted">Last Frame</div>
              <div className="relative h-16 w-full overflow-hidden rounded-md border border-accent/20">
                {isBlobUrl(endFrameSrc) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={endFrameSrc} alt="End frame" className="h-full w-full object-cover" />
                ) : (
                  <Image src={endFrameSrc} alt="End frame" fill sizes="260px" className="object-cover" />
                )}
                <button
                  onClick={onEndFrameRemove}
                  className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[8px] text-white/80 hover:text-white"
                >x</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings panel */}
        <div className="flex flex-1 flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-bold tracking-wide text-accent">
                <span className="mr-px text-accent/60">#</span>{shot.number}
              </span>
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  value={shot.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder="Shot title..."
                  className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted/30"
                />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-surface to-transparent" />
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => onSetMode("image")}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                mode === "image" ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              Image Settings
            </button>
            <button
              onClick={() => onSetMode("video")}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                mode === "video" ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              Video Settings
            </button>
          </div>

          {/* Settings content */}
          <div className="flex-1 space-y-4 p-5">
            {mode === "image" ? (
              <>
                {/* Image prompt */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Prompt</label>
                  <TaggableTextarea
                    value={shot.imagePrompt}
                    onChange={(v) => onUpdate({ imagePrompt: v })}
                    rows={4}
                    placeholder="Image prompt... (@ to ref images)"
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
                    images={tagImages}
                  />
                </div>

                {/* Negative prompt */}
                {imageSupportsNeg && !shot.imageNegativePrompt && (
                  <button
                    onClick={() => onUpdate({ imageNegativePrompt: " " })}
                    className="flex items-center gap-1.5 text-xs text-muted/60 transition hover:text-destructive"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-md bg-muted/10 text-[10px] font-bold leading-none">−</span>
                    Add negative prompt
                  </button>
                )}
                {imageSupportsNeg && shot.imageNegativePrompt && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-[11px] font-medium uppercase text-muted">Negative Prompt</label>
                      <button onClick={() => onUpdate({ imageNegativePrompt: "" })}
                        className="text-[10px] text-muted/40 hover:text-destructive">Remove</button>
                    </div>
                    <textarea
                      value={shot.imageNegativePrompt.trim()}
                      onChange={(e) => onUpdate({ imageNegativePrompt: e.target.value })}
                      rows={2}
                      placeholder="no blur, no artifacts..."
                      className="w-full resize-y rounded-lg border border-destructive/20 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-destructive/40"
                    />
                  </div>
                )}

                {/* Reference images */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">References</label>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files.length > 0) {
                        onRefFileDrop(Array.from(e.dataTransfer.files));
                      } else {
                        const url = e.dataTransfer.getData("text/plain");
                        if (url) onRefUrlDrop(url);
                      }
                    }}
                  >
                    {refImages.map((ref, i) => (
                      <div key={ref.id} className="relative h-10 w-10 overflow-hidden rounded-lg border border-border">
                        {!_loadedUrlCache.has(ref.preview) && <div className="absolute inset-0 animate-pulse bg-surface" />}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.preview}
                          alt="Ref"
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; _loadedUrlCache.add(ref.preview); }}
                          style={{ opacity: _loadedUrlCache.has(ref.preview) ? 1 : 0, transition: "opacity 0.2s" }}
                        />
                        <button
                          onClick={() => onRefRemove(ref.id)}
                          className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-1 text-[8px] text-muted hover:text-foreground"
                        >x</button>
                        <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 font-mono text-[7px] font-bold leading-tight text-accent">
                          @{masterRefOffset + i + 1}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => (document.getElementById(`modal-ref-${shot.id}`) as HTMLInputElement)?.click()}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted hover:border-accent/50 hover:text-accent"
                    >+</button>
                    <input
                      id={`modal-ref-${shot.id}`}
                      ref={refInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={onRefUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Model + Ratio */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Model</label>
                    <Select
                      value={imgSettings.modelId ?? ""}
                      options={[
                        { value: "", label: imageModel.name },
                        ...selectableModels.filter((m) => m.id !== imageModel.id).map((m) => ({ value: m.id, label: m.name })),
                      ]}
                      onChange={(v) => onImageSettingsChange({ modelId: v || null })}
                      compact
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Ratio</label>
                    <Select
                      value={imgSettings.aspectRatio ?? ""}
                      options={[
                        { value: "", label: globalAspectRatio },
                        ...["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"].filter((r) => r !== globalAspectRatio).map((r) => ({ value: r, label: r })),
                      ]}
                      onChange={(v) => onImageSettingsChange({ aspectRatio: v || null })}
                      compact
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Video prompt */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Motion Prompt</label>
                  <textarea
                    value={shot.videoPrompt}
                    onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
                    rows={4}
                    placeholder="Video/motion prompt..."
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
                  />
                </div>

                {/* Negative prompt */}
                {videoSupportsNeg && !shot.videoNegativePrompt && (
                  <button
                    onClick={() => onUpdate({ videoNegativePrompt: " " })}
                    className="flex items-center gap-1.5 text-xs text-muted/60 transition hover:text-destructive"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-md bg-muted/10 text-[10px] font-bold leading-none">−</span>
                    Add negative prompt
                  </button>
                )}
                {videoSupportsNeg && shot.videoNegativePrompt && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-[11px] font-medium uppercase text-muted">Negative Prompt</label>
                      <button onClick={() => onUpdate({ videoNegativePrompt: "" })}
                        className="text-[10px] text-muted/40 hover:text-destructive">Remove</button>
                    </div>
                    <textarea
                      value={shot.videoNegativePrompt.trim()}
                      onChange={(e) => onUpdate({ videoNegativePrompt: e.target.value })}
                      rows={2}
                      placeholder="blur, distort, low quality..."
                      className="w-full resize-y rounded-lg border border-destructive/20 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-destructive/40"
                    />
                  </div>
                )}

                {/* Last frame */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Last Frame</label>
                  {endFrameSrc ? (
                    <div className="relative inline-block h-12 w-12 overflow-hidden rounded-lg border border-accent/30">
                      {isBlobUrl(endFrameSrc) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={endFrameSrc} alt="End" className="h-full w-full object-cover" />
                      ) : (
                        <Image src={endFrameSrc} alt="End" fill sizes="48px" className="object-cover" />
                      )}
                      <button
                        onClick={onEndFrameRemove}
                        className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-1 text-[8px] text-muted hover:text-foreground"
                      >x</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => (document.getElementById(`modal-end-${shot.id}`) as HTMLInputElement)?.click()}
                      className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-accent"
                    >+ Upload end frame</button>
                  )}
                  <input
                    id={`modal-end-${shot.id}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onEndFrameUpload}
                    className="hidden"
                  />
                </div>

                {/* Duration / Ratio / Res / Model — only show options the effective model supports */}
                {(() => {
                  const durations = effVideoModel.durations ?? [];
                  const aspectRatios = effVideoModel.aspectRatios ?? [];
                  const resolutions = effVideoModel.resolutions ?? [];
                  const showDuration = durations.length > 1;
                  const showRatio = aspectRatios.length > 1;
                  const showRes = resolutions.length > 1;
                  const hasGrid = showDuration || showRatio || showRes;
                  return hasGrid ? (
                    <div className="grid grid-cols-2 gap-3">
                      {showDuration && (
                        <div>
                          <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Duration</label>
                          <Select
                            value={String(vidSettings.duration ?? "")}
                            options={[
                              { value: "", label: `${globalDuration}s` },
                              ...durations.filter((d) => d !== globalDuration).map((d) => ({ value: String(d), label: `${d}s` })),
                            ]}
                            onChange={(v) => onVideoSettingsChange({ duration: v ? Number(v) : null })}
                            compact
                          />
                        </div>
                      )}
                      {showRatio && (
                        <div>
                          <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Ratio</label>
                          <Select
                            value={vidSettings.aspectRatio ?? ""}
                            options={[
                              { value: "", label: globalAspectRatio },
                              ...aspectRatios.filter((r) => r !== globalAspectRatio).map((r) => ({ value: r, label: r })),
                            ]}
                            onChange={(v) => onVideoSettingsChange({ aspectRatio: v || null })}
                            compact
                          />
                        </div>
                      )}
                      {showRes && (
                        <div>
                          <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Resolution</label>
                          <Select
                            value={vidSettings.resolution ?? ""}
                            options={[
                              { value: "", label: globalResolution },
                              ...resolutions.filter((r) => r !== globalResolution).map((r) => ({ value: r, label: r })),
                            ]}
                            onChange={(v) => onVideoSettingsChange({ resolution: v || null })}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* Model override */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase text-muted">Model</label>
                  <Select
                    value={vidSettings.modelId ?? ""}
                    options={[
                      { value: "", label: videoModel.name },
                      ...getCreateModels().filter((m) => m.id !== videoModel.id).map((m) => ({ value: m.id, label: m.name })),
                    ]}
                    onChange={(v) => onVideoSettingsChange({ modelId: v || null })}
                    compact
                  />
                </div>

                {/* Sound toggle — only if the effective model supports it */}
                {effVideoModel.supportsGenerateAudio && (() => {
                  const effAudio = vidSettings.generateAudio ?? globalGenerateAudio;
                  return (
                    <button
                      onClick={() => onVideoSettingsChange({ generateAudio: effAudio ? false : true })}
                      className={`w-full rounded-lg border py-1.5 text-xs font-medium uppercase transition ${
                        effAudio
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-border bg-background text-muted hover:border-muted"
                      }`}
                    >
                      {effAudio ? "Sound on" : "Sound off"}
                    </button>
                  );
                })()}

                {/* Camera fixed — only if the effective model supports it */}
                {effVideoModel.supportsCameraFixed && (() => {
                  const effFixed = vidSettings.cameraFixed ?? false;
                  return (
                    <button
                      onClick={() => onVideoSettingsChange({ cameraFixed: !effFixed })}
                      className={`w-full rounded-lg border py-1.5 text-xs font-medium uppercase transition ${
                        effFixed
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-border bg-background text-muted hover:border-muted"
                      }`}
                    >
                      {effFixed ? "Camera fixed" : "Camera free"}
                    </button>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { GenerationResult } from "@/types/generations";

function LightboxToolbarButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition hover:bg-white/10 ${danger ? "hover:text-red-400" : ""}`}
    >
      <span className={`text-base ${danger ? "text-white/70" : "text-white/90"}`}>{icon}</span>
      <span className={`text-[10px] font-medium ${danger ? "text-white/40" : "text-white/60"}`}>{label}</span>
    </button>
  );
}

function LightboxRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] text-white/40">{label}</span>
      <span className="text-right text-[11px] font-medium text-white/70">{value}</span>
    </div>
  );
}

export interface MediaLightboxProps {
  result: GenerationResult;
  onClose: () => void;
  onFavorite: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
  onUseAsReference: () => void;
  onDelete: () => void;
  onAddToShots?: (imageUrl: string) => void;
  copied: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function MediaLightbox({
  result,
  onClose,
  onFavorite,
  onDownload,
  onCopyUrl,
  onUseAsReference,
  onDelete,
  onAddToShots,
  copied,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: MediaLightboxProps) {
  const router = useRouter();
  const [promptCopied, setPromptCopied] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ w: number; h: number; sizeKB: number | null }>({ w: result.width, h: result.height, sizeKB: null });
  const [lightboxImgLoaded, setLightboxImgLoaded] = useState(false);
  const [showShotPicker, setShowShotPicker] = useState(false);
  const [sceneSearch, setSceneSearch] = useState("");
  const [scenes, setScenes] = useState<{ id: string; name: string; shots: unknown[] }[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasNext) { e.preventDefault(); onNext(); }
      if (e.key === "ArrowRight" && hasPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  const copyPrompt = () => {
    if (!result.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  useEffect(() => {
    setLightboxImgLoaded(false);
    if (result.type === "video") {
      setLightboxImgLoaded(true);
      return;
    }
    const img = document.createElement("img");
    img.onload = () => {
      setImageMeta((prev) => ({ ...prev, w: img.naturalWidth, h: img.naturalHeight }));
    };
    img.src = result.imageUrl;

    fetch(result.imageUrl, { method: "HEAD" }).then((res) => {
      const len = res.headers.get("content-length");
      if (len) setImageMeta((prev) => ({ ...prev, sizeKB: Math.round(Number(len) / 1024) }));
    }).catch(() => {});
  }, [result.imageUrl, result.type]);

  useEffect(() => {
    if (onAddToShots) {
      fetch("/api/scenes").then((r) => r.ok ? r.json() : []).then(setScenes).catch(() => {});
    }
  }, [onAddToShots]);

  const createdDate = result.createdAt
    ? new Date(result.createdAt).toLocaleString()
    : null;

  const sizeLabel = imageMeta.w && imageMeta.h ? `${imageMeta.w} × ${imageMeta.h}` : null;
  const fileSizeLabel = imageMeta.sizeKB != null
    ? imageMeta.sizeKB >= 1024 ? `${(imageMeta.sizeKB / 1024).toFixed(1)} MB` : `${imageMeta.sizeKB} KB`
    : null;

  const isVideo = result.type === "video";
  const infoLabel = isVideo ? "Video Info" : "Image Info";

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Left — media + floating toolbar */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-8">
        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/60 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.5 15L7.5 10L12.5 5" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/60 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 5L12.5 10L7.5 15" />
            </svg>
          </button>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          {isVideo ? (
            <video
              src={result.imageUrl}
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
              controls
              autoPlay
              loop
              playsInline
            />
          ) : (
            <div className="relative">
              {!lightboxImgLoaded && (
                <div className="flex max-h-[75vh] items-center justify-center" style={{ width: imageMeta.w ? Math.min(imageMeta.w, 1200) : 600, height: imageMeta.h ? Math.min(imageMeta.h, 800) : 400 }}>
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
              )}
              <Image
                src={result.imageUrl}
                alt="Preview"
                width={imageMeta.w || result.width || 1024}
                height={imageMeta.h || result.height || 1024}
                quality={90}
                sizes="75vw"
                className={`max-h-[75vh] w-auto rounded-xl object-contain shadow-2xl transition-opacity duration-300 ${lightboxImgLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setLightboxImgLoaded(true)}
              />
            </div>
          )}
        </div>

        {/* Floating toolbar */}
        <div
          className="relative mt-4 flex items-center gap-1 rounded-2xl bg-black/50 px-2 py-1 shadow-lg ring-1 ring-white/15 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <LightboxToolbarButton
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v9M5 8l4 4 4-4" /><path d="M3 14h12" /></svg>}
            label="Save"
            onClick={onDownload}
          />
          <LightboxToolbarButton
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="14" height="14" rx="2" /><path d="M9 6v6M6 9h6" /></svg>}
            label="Reference"
            onClick={() => { onUseAsReference(); onClose(); }}
          />
          <LightboxToolbarButton
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l4-4 3 3 5-5" /><path d="M11 5h4v4" /></svg>}
            label="Upscale"
            onClick={() => {
              sessionStorage.setItem("dreamsun_upscale_image", result.imageUrl);
              onClose();
              router.push("/images?mode=upscale");
            }}
          />
          {onAddToShots && (
            <>
              <div className="mx-1 h-6 w-px bg-white/10" />
              <div className="relative">
                <LightboxToolbarButton
                  icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="16" height="12" rx="2" /><path d="M6 3V1.5h6V3" /><path d="M9 7v4M7 9h4" /></svg>}
                  label="Add to Shots"
                  onClick={() => { setShowShotPicker(!showShotPicker); setSceneSearch(""); }}
                />
                {showShotPicker && (
                  <div className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#1a1a1a] p-2 shadow-2xl">
                    <span className="mb-1.5 block px-2 text-[10px] font-medium uppercase tracking-wider text-white/40">Choose a scene</span>
                    {scenes.length >= 5 && (
                      <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-white/30">
                          <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5L13 13" />
                        </svg>
                        <input
                          type="text"
                          value={sceneSearch}
                          onChange={(e) => setSceneSearch(e.target.value)}
                          placeholder="Search scenes..."
                          className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
                          autoFocus
                        />
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        const newScene = {
                          id: `scene_${Date.now()}`,
                          name: `Scene ${scenes.length + 1}`,
                          shots: [{
                            id: `shot_${Date.now()}`,
                            number: "1",
                            title: "",
                            imagePrompt: result.prompt || "",
                            imageNegativePrompt: "",
                            videoPrompt: "",
                            videoNegativePrompt: "",
                            imageStatus: "done",
                            videoStatus: "pending",
                            imageUrl: result.imageUrl,
                            videoUrl: null,
                            localImagePath: null,
                            localVideoPath: null,
                            error: null,
                            refImages: [],
                            endImageUrl: null,
                            endImageRef: null,
                            imageHistory: [result.imageUrl],
                            videoHistory: [],
                            settings: {
                              image: { modelId: null, aspectRatio: null, safetyChecker: null },
                              video: { modelId: null, duration: null, aspectRatio: null, resolution: null, cameraFixed: null, generateAudio: null },
                            },
                          }],
                          settings: {
                            imageModelId: "nano-banana-2",
                            videoModelId: "seedance-1-5-pro",
                            aspectRatio: result.settings?.aspectRatio || "9:16",
                            imageResolution: result.settings?.resolution || "1k",
                            numImages: 1,
                            safetyChecker: false,
                            duration: 5,
                            resolution: "720p",
                            generateAudio: false,
                            cameraFixed: false,
                            promptPrefix: "",
                            outputFolder: "",
                          },
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                        };
                        setScenes((prev) => [newScene, ...prev]);
                        onAddToShots(result.imageUrl);
                        setShowShotPicker(false);
                        fetch("/api/scenes", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ...newScene, sort_order: 0 }),
                        }).catch(() => {});
                      }}
                      className="mb-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-left transition hover:border-accent/30 hover:bg-white/5"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-accent">
                        <path d="M6 2v8M2 6h8" />
                      </svg>
                      <span className="text-xs text-accent">New Scene</span>
                    </button>
                    {scenes.length > 0 && (() => {
                      const q = sceneSearch.toLowerCase().trim();
                      const filtered = q ? scenes.filter((s) => s.name.toLowerCase().includes(q)) : scenes;
                      return filtered.length > 0 ? (
                        <div className="max-h-48 space-y-0.5 overflow-y-auto">
                          {filtered.map((scene) => (
                            <button
                              key={scene.id}
                              onClick={async () => {
                                const target = scenes.find((s) => s.id === scene.id);
                                if (target) {
                                  const maxNum = (target.shots as { number?: string | number }[]).reduce((max: number, s: { number?: string | number }) => {
                                    const n = parseInt(String(s.number ?? 0), 10) || 0;
                                    return n > max ? n : max;
                                  }, 0);
                                  const newShot = {
                                    id: `shot_${Date.now()}`,
                                    number: String(maxNum + 1),
                                    title: "",
                                    imagePrompt: result.prompt || "",
                                    imageNegativePrompt: "",
                                    videoPrompt: "",
                                    videoNegativePrompt: "",
                                    imageStatus: "done",
                                    videoStatus: "pending",
                                    imageUrl: result.imageUrl,
                                    videoUrl: null,
                                    localImagePath: null,
                                    localVideoPath: null,
                                    error: null,
                                    refImages: [],
                                    endImageUrl: null,
                                    endImageRef: null,
                                    imageHistory: [result.imageUrl],
                                    videoHistory: [],
                                    settings: {
                                      image: { modelId: null, aspectRatio: null, safetyChecker: null },
                                      video: { modelId: null, duration: null, aspectRatio: null, resolution: null, cameraFixed: null, generateAudio: null },
                                    },
                                  };
                                  const updatedShots = [...(target.shots as unknown[]), newShot];
                                  setScenes((prev) => prev.map((s) =>
                                    s.id === scene.id ? { ...s, shots: updatedShots } : s
                                  ));
                                  fetch("/api/scenes", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ ...target, shots: updatedShots }),
                                  }).catch(() => {});
                                }
                                onAddToShots(result.imageUrl);
                                setShowShotPicker(false);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                            >
                              <span className="truncate text-xs text-white/80">{scene.name}</span>
                              <span className="shrink-0 text-[10px] text-white/30">{scene.shots.length} shots</span>
                            </button>
                          ))}
                        </div>
                      ) : q ? (
                        <p className="px-2 py-2 text-center text-[11px] text-white/30">No matches</p>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="mx-1 h-6 w-px bg-white/10" />
          <LightboxToolbarButton
            icon={
              copied ? (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 7l4 4L12 3" className="text-accent" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 9a6 6 0 11-3-5.2" /><path d="M15 3v3h-3" />
                </svg>
              )
            }
            label={copied ? "Copied" : "Copy URL"}
            onClick={onCopyUrl}
          />
          <LightboxToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h10M5 4V2.5h4V4M3 4l.7 8.1c.1.8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4L11 4" />
              </svg>
            }
            label="Delete"
            onClick={onDelete}
            danger
          />
        </div>
      </div>

      {/* Right sidebar — info panel */}
      <div
        className="flex w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-xs font-semibold text-white/90">{result.model}</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white/80"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Actions row */}
          <div className="flex items-center gap-1 border-b border-white/10 px-4 py-3">
            <button onClick={onFavorite} className={`rounded-md p-1.5 transition ${result.favorited ? "text-red-400" : "text-white/50 hover:text-red-400"}`} title="Love">
              <svg width="14" height="14" viewBox="0 0 14 14" fill={result.favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                <path d="M7 12.5S1 8.5 1 5a3 3 0 015.5-1.5h1A3 3 0 0113 5c0 3.5-6 7.5-6 7.5z" />
              </svg>
            </button>
            <button onClick={onDownload} className="rounded-md p-1.5 text-white/50 transition hover:text-white" title="Download">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3v9M5 8l4 4 4-4" /><path d="M3 14h12" />
              </svg>
            </button>
            <button onClick={onCopyUrl} className="rounded-md p-1.5 text-white/50 transition hover:text-white" title="Copy URL">
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 7l4 4L12 3" className="text-accent" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" />
                </svg>
              )}
            </button>
            <button onClick={() => { onUseAsReference(); onClose(); }} className="rounded-md p-1.5 text-white/50 transition hover:text-white" title="Use as reference">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="14" height="14" rx="2" /><path d="M9 6v6M6 9h6" />
              </svg>
            </button>
            <div className="flex-1" />
            <button onClick={onDelete} className="rounded-md p-1.5 text-white/50 transition hover:text-red-400" title="Delete">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h10M5 4V2.5h4V4M3 4l.7 8.1c.1.8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4L11 4" />
              </svg>
            </button>
          </div>

          {/* Prompt */}
          {result.prompt && (
            <div className="border-b border-white/10 px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Prompt</span>
                <button
                  onClick={copyPrompt}
                  className="text-[10px] font-medium text-accent/70 transition hover:text-accent"
                >
                  {promptCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-white/70">
                {result.prompt}
              </p>
            </div>
          )}

          {result.settings?.negativePrompt && (
            <div className="border-b border-white/10 px-4 py-3">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/40">Negative Prompt</span>
              <p className="text-xs leading-relaxed text-white/50">
                {result.settings.negativePrompt}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="border-b border-white/10 px-4 py-3">
            <span className="mb-2.5 block text-[10px] font-medium uppercase tracking-wider text-white/40">{infoLabel}</span>
            <div className="space-y-2">
              {sizeLabel && <LightboxRow label="Dimensions" value={sizeLabel} />}
              {fileSizeLabel && <LightboxRow label="File Size" value={fileSizeLabel} />}
              {result.duration != null && <LightboxRow label="Duration" value={`${result.duration}s`} />}
              {result.settings && (
                <>
                  {result.settings.aspectRatio && <LightboxRow label="Aspect Ratio" value={result.settings.aspectRatio} />}
                  {result.settings.resolution && <LightboxRow label="Resolution" value={result.settings.resolution.toUpperCase()} />}
                </>
              )}
              {result.seed != null && <LightboxRow label="Seed" value={String(result.seed)} />}
              {createdDate && <LightboxRow label="Created" value={createdDate} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

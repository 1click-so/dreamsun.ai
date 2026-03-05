"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { fal } from "@fal-ai/client";
import {
  MODELS,
  type ModelConfig,
  getSelectableModels,
  resolveModel,
} from "@/lib/models";
import { Navbar } from "@/components/Navbar";
import { Lightbox } from "@/components/shots/Lightbox";
import { Toggle } from "@/components/ui/Toggle";

fal.config({ proxyUrl: "/api/fal/proxy" });

// --- Types ---

interface GenerationResult {
  imageUrl: string;
  allImageUrls?: string[];
  width: number;
  height: number;
  seed: number;
  model: string;
  requestId: string;
  prompt?: string;
  batchId?: string;
}

interface UploadedImage {
  id: string;
  preview: string;
  url: string | null;
  uploading: boolean;
}

// --- localStorage helpers ---

const STORAGE_KEYS = {
  models: "dreamsun_gen_models",
  ratio: "dreamsun_gen_ratio",
  resolution: "dreamsun_gen_resolution",
  numImages: "dreamsun_gen_num_images",
  safety: "dreamsun_gen_safety",
  history: "dreamsun_gen_history",
  gallerySize: "dreamsun_gen_gallery_size",
} as const;

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded */
  }
}

let imageIdCounter = 0;
let batchIdCounter = 0;

// --- Icon Components ---

function IconRegenerate() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 9a6 6 0 11-3-5.2" /><path d="M15 3v3h-3" />
    </svg>
  );
}

function IconUpscale() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l4-4 3 3 5-5" /><path d="M11 5h4v4" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2l5 5-9 9H2v-5z" /><path d="M9.5 3.5l5 5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v9M5 8l4 4 4-4" /><path d="M3 14h12" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8l5-5v3.5h5v3H7V13L2 8z" fill="currentColor" />
    </svg>
  );
}

// --- Model Multi-Select ---

function ModelSelector({
  models,
  selectedIds,
  onChange,
}: {
  models: ModelConfig[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedModels = models.filter((m) => selectedIds.includes(m.id));
  const label =
    selectedModels.length === 0
      ? "Select models"
      : selectedModels.length === 1
        ? selectedModels[0].name
        : `${selectedModels.length} models`;

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    if (next.length === 0) return;
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground transition hover:border-accent/30 focus:border-accent"
      >
        <span className="truncate">{label}</span>
        <IconChevron open={open} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface py-1 shadow-lg">
          {models.map((m) => {
            const checked = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition ${
                  checked
                    ? "text-accent"
                    : "text-foreground hover:bg-accent/5 hover:text-accent"
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
                    checked
                      ? "border-accent bg-accent"
                      : "border-border bg-surface"
                  }`}
                >
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 4l2 2L6.5 2" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 text-left">{m.name}</span>
                <span className="text-[10px] text-muted/50">{m.costPerImage}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Gallery Image Card ---

function GalleryCard({
  result,
  isFeatured,
  onDownload,
  onCopyUrl,
  onEdit,
  onRegenerate,
  onClick,
  copied,
}: {
  result: GenerationResult;
  isFeatured: boolean;
  onDownload: () => void;
  onCopyUrl: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onClick: () => void;
  copied: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={result.imageUrl}
        alt={`Generated by ${result.model}`}
        className="h-full w-full rounded-lg object-cover"
      />

      {/* Model badge */}
      <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
        {result.model}
      </div>

      {/* Hover overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end rounded-lg bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-200 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-end justify-between p-2.5" onClick={(e) => e.stopPropagation()}>
          <span className="text-[9px] font-medium text-white/50">
            {result.width}x{result.height}
          </span>
          <div className="flex items-center gap-0.5">
            {isFeatured && (
              <button onClick={onRegenerate} className="rounded-md p-1.5 text-accent transition hover:bg-white/10" title="Regenerate">
                <IconRegenerate />
              </button>
            )}
            <button onClick={() => {/* TODO */}} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" title="Upscale">
              <IconUpscale />
            </button>
            {isFeatured && (
              <button onClick={onEdit} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" title="Edit">
                <IconEdit />
              </button>
            )}
            <button onClick={onDownload} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" title="Save">
              <IconDownload />
            </button>
            <button onClick={onCopyUrl} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" title="Copy URL">
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 7l4 4L12 3" className="text-accent" />
                </svg>
              ) : (
                <IconCopy />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Section Label ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted">
      {children}
    </label>
  );
}

// --- Pill Button (for aspect ratio, resolution, num images) ---

function PillButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[10px] font-medium transition ${
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border text-muted hover:border-accent/20 hover:text-foreground"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

// --- Page ---

export default function GeneratePage() {
  // Settings state (persisted)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [MODELS[0].id];
    return loadStorage<string[]>(STORAGE_KEYS.models, [MODELS[0].id]);
  });
  const [aspectRatio, setAspectRatio] = useState(() =>
    loadStorage(STORAGE_KEYS.ratio, "16:9")
  );
  const [imageResolution, setImageResolution] = useState(() =>
    loadStorage(STORAGE_KEYS.resolution, "1k")
  );
  const [numImages, setNumImages] = useState(() =>
    loadStorage(STORAGE_KEYS.numImages, 1)
  );
  const [safetyChecker, setSafetyChecker] = useState(() =>
    loadStorage(STORAGE_KEYS.safety, false)
  );

  // Generation state
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [generatingSlots, setGeneratingSlots] = useState<{ modelName: string; modelId: string }[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>(() =>
    loadStorage<GenerationResult[]>(STORAGE_KEYS.history, [])
  );
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPromptValue, setEditPromptValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxResult, setLightboxResult] = useState<GenerationResult | null>(null);
  const [galleryRowHeight, setGalleryRowHeight] = useState(() =>
    loadStorage(STORAGE_KEYS.gallerySize, 180)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const isGenerating = generatingSlots.length > 0;

  // Derived
  const hasRefs = referenceImages.some((img) => img.url);
  const selectableModels = getSelectableModels();
  const selectedModels = selectableModels.filter((m) => selectedModelIds.includes(m.id));
  const primaryModel = selectedModels[0] ?? selectableModels[0];
  const currentEffectiveModel =
    resolveModel(primaryModel.id, hasRefs) ?? primaryModel;
  const maxImages = currentEffectiveModel.referenceImage?.maxImages ?? 14;

  // Persist history to localStorage
  useEffect(() => {
    saveStorage(STORAGE_KEYS.history, history);
  }, [history]);

  // Latest batch
  const latestBatch = currentBatchId
    ? history.filter((r) => r.batchId === currentBatchId)
    : [];
  const previousHistory = currentBatchId
    ? history.filter((r) => r.batchId !== currentBatchId)
    : history;

  // --- Handlers ---

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const filesToProcess = Array.from(files).slice(0, 14 - referenceImages.length);

      for (const file of filesToProcess) {
        const id = `img_${++imageIdCounter}`;
        const preview = URL.createObjectURL(file);
        const newImage: UploadedImage = { id, preview, url: null, uploading: true };
        setReferenceImages((prev) => [...prev, newImage]);

        try {
          const url = await fal.storage.upload(file);
          setReferenceImages((prev) =>
            prev.map((img) =>
              img.id === id ? { ...img, url, uploading: false } : img
            )
          );
        } catch (err) {
          setReferenceImages((prev) => prev.filter((img) => img.id !== id));
          setError(
            `Upload failed: ${err instanceof Error ? err.message : "Network error"}`
          );
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [referenceImages.length]
  );

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleGenerate = async (overridePrompt?: string) => {
    const usedPrompt = overridePrompt ?? prompt;
    if (!usedPrompt.trim()) return;

    setError(null);
    setShowEditPrompt(false);

    const batchId = `batch_${++batchIdCounter}`;
    setCurrentBatchId(batchId);

    const modelsToRun = selectedModels.length > 0 ? selectedModels : [primaryModel];
    setGeneratingSlots(modelsToRun.map((m) => ({ modelName: m.name, modelId: m.id })));

    if (galleryRef.current) galleryRef.current.scrollTop = 0;

    modelsToRun.forEach(async (model) => {
      const effectiveModel = resolveModel(model.id, hasRefs) ?? model;

      const body: Record<string, unknown> = {
        modelId: effectiveModel.id,
        prompt: usedPrompt.trim(),
        aspectRatio,
        imageResolution,
        numImages,
        safetyChecker,
      };

      if (hasRefs && effectiveModel.capability === "image-to-image") {
        const urls = referenceImages
          .filter((img) => img.url)
          .map((img) => img.url as string);
        if (urls.length > 0) body.referenceImageUrls = urls;
      }

      if (negativePrompt.trim() && effectiveModel.supportsNegativePrompt) {
        body.negativePrompt = negativePrompt.trim();
      }

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");

        const genResult: GenerationResult = {
          ...data,
          prompt: usedPrompt.trim(),
          batchId,
        };

        setHistory((prev) => [genResult, ...prev]);
      } catch (err) {
        setError((prev) =>
          prev
            ? `${prev}; ${model.name}: ${err instanceof Error ? err.message : "Failed"}`
            : `${model.name}: ${err instanceof Error ? err.message : "Failed"}`
        );
      } finally {
        setGeneratingSlots((prev) => prev.filter((s) => s.modelId !== model.id));
      }
    });
  };

  const handleRegenerate = () => {
    const firstResult = latestBatch[0] ?? history[0];
    if (firstResult?.prompt) {
      handleGenerate(firstResult.prompt);
    } else {
      handleGenerate();
    }
  };

  const handleEdit = () => {
    setShowEditPrompt(!showEditPrompt);
    setEditPromptValue("");
  };

  const handleEditSubmit = () => {
    if (!editPromptValue.trim()) return;
    const firstResult = latestBatch[0] ?? history[0];
    if (firstResult) {
      const editId = `img_${++imageIdCounter}`;
      const editImage: UploadedImage = {
        id: editId,
        preview: firstResult.imageUrl,
        url: firstResult.imageUrl,
        uploading: false,
      };
      setReferenceImages((prev) => [editImage, ...prev]);
    }
    handleGenerate(editPromptValue.trim());
  };

  const handleDownload = async (r: GenerationResult) => {
    try {
      const res = await fetch(r.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dreamsun-${r.model.replace(/\s+/g, "-").toLowerCase()}-${r.requestId || Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(r.imageUrl, "_blank");
    }
  };

  const handleCopyUrl = (r: GenerationResult) => {
    navigator.clipboard.writeText(r.imageUrl);
    setCopiedId(r.requestId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleModelsChange = (ids: string[]) => {
    setSelectedModelIds(ids);
    saveStorage(STORAGE_KEYS.models, ids);
    const newPrimary = MODELS.find((m) => m.id === ids[0]);
    if (newPrimary && !newPrimary.aspectRatios.includes(aspectRatio)) {
      const newRatio = newPrimary.defaultAspectRatio;
      setAspectRatio(newRatio);
      saveStorage(STORAGE_KEYS.ratio, newRatio);
    }
  };

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!isGenerating && prompt.trim()) handleGenerate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isGenerating]);

  const hasAnyContent = history.length > 0 || isGenerating;
  const canGenerate = !isGenerating && prompt.trim() && !referenceImages.some((img) => img.uploading);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Navbar />

      <div className="flex min-h-0 flex-1">
        {/* ================================================================
            LEFT SIDEBAR — All controls + prompt (28% width)
            ================================================================ */}
        <aside className="hidden w-[28%] min-w-[280px] max-w-[400px] shrink-0 flex-col border-r border-border lg:flex">
          {/* Scrollable settings area */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-5">
              {/* Model */}
              <div>
                <SectionLabel>Model</SectionLabel>
                <ModelSelector
                  models={selectableModels}
                  selectedIds={selectedModelIds}
                  onChange={handleModelsChange}
                />
                {selectedModels.length > 1 && (
                  <p className="mt-1.5 text-[10px] text-muted/60">
                    Generates with {selectedModels.length} models in parallel
                  </p>
                )}
              </div>

              {/* Reference Images */}
              {primaryModel.editVariant && (
                <div>
                  <SectionLabel>Reference Images</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {referenceImages.map((img) => (
                      <div
                        key={img.id}
                        className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.preview}
                          alt="Ref"
                          className="h-full w-full object-cover"
                        />
                        {img.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <div className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
                          </div>
                        )}
                        <button
                          onClick={() => removeReferenceImage(img.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1 1l8 8M9 1l-8 8" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {referenceImages.length < maxImages && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted/40 transition hover:border-accent/40 hover:text-accent"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M9 3v12M3 9h12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple={maxImages > 1}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {hasRefs && (
                    <p className="mt-1.5 text-[10px] text-accent/60">
                      Auto-switching to {currentEffectiveModel.name}
                    </p>
                  )}
                </div>
              )}

              {/* Aspect Ratio */}
              <div>
                <SectionLabel>Aspect Ratio</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {primaryModel.aspectRatios.map((ratio) => (
                    <PillButton
                      key={ratio}
                      active={aspectRatio === ratio}
                      onClick={() => {
                        setAspectRatio(ratio);
                        saveStorage(STORAGE_KEYS.ratio, ratio);
                      }}
                    >
                      {ratio}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <SectionLabel>Resolution</SectionLabel>
                <div className="flex gap-1.5">
                  {(["1k", "2k", "4k"] as const).map((res) => (
                    <PillButton
                      key={res}
                      active={imageResolution === res}
                      onClick={() => {
                        setImageResolution(res);
                        saveStorage(STORAGE_KEYS.resolution, res);
                      }}
                      className="flex-1 uppercase"
                    >
                      {res}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Num Images */}
              <div>
                <SectionLabel>Images per Model</SectionLabel>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <PillButton
                      key={n}
                      active={numImages === n}
                      onClick={() => {
                        setNumImages(n);
                        saveStorage(STORAGE_KEYS.numImages, n);
                      }}
                      className="flex-1"
                    >
                      {n}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Safety — only show when a selected model supports it */}
              {selectedModels.some(
                (m) => !m.extraInput || !("enable_safety_checker" in m.extraInput)
              ) && (
                <Toggle
                  checked={safetyChecker}
                  onChange={(v) => {
                    setSafetyChecker(v);
                    saveStorage(STORAGE_KEYS.safety, v);
                  }}
                  label="Safety Filter"
                  size="sm"
                  className="w-full"
                />
              )}

              {/* Negative Prompt (collapsible) */}
              {currentEffectiveModel.supportsNegativePrompt && (
                <div>
                  <button
                    onClick={() => setNegativeOpen(!negativeOpen)}
                    className="flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted transition hover:text-foreground"
                  >
                    Negative Prompt
                    <IconChevron open={negativeOpen} />
                  </button>
                  {negativeOpen && (
                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="What to avoid..."
                      rows={3}
                      className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none transition placeholder:text-muted/40 focus:border-accent"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Prompt area — pinned to bottom of sidebar */}
          <div className="border-t border-border p-4">
            {/* Prompt container with embedded Generate button */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canGenerate) handleGenerate();
                  }
                }}
                placeholder="Describe the image you want to generate..."
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-3 pr-12 text-sm leading-relaxed text-foreground outline-none transition placeholder:text-muted/40 focus:border-accent"
              />
              {/* Generate button — inside textarea, bottom right */}
              <button
                onClick={() => handleGenerate()}
                disabled={!canGenerate}
                className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  canGenerate
                    ? "bg-accent text-black hover:bg-accent-hover"
                    : "bg-surface-hover text-muted/30 cursor-not-allowed"
                }`}
                title={isGenerating ? "Generating..." : "Generate (Enter)"}
              >
                {isGenerating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <IconSend />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted/40">
              Enter to generate, Shift+Enter for new line
            </p>
          </div>
        </aside>

        {/* ================================================================
            MOBILE — controls drawer (below lg)
            ================================================================ */}
        <div className="flex w-full flex-col lg:hidden">
          {/* Mobile top bar with essential controls */}
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-36">
                <ModelSelector
                  models={selectableModels}
                  selectedIds={selectedModelIds}
                  onChange={handleModelsChange}
                />
              </div>
              <div className="flex gap-1">
                {primaryModel.aspectRatios.slice(0, 4).map((ratio) => (
                  <PillButton
                    key={ratio}
                    active={aspectRatio === ratio}
                    onClick={() => {
                      setAspectRatio(ratio);
                      saveStorage(STORAGE_KEYS.ratio, ratio);
                    }}
                  >
                    {ratio}
                  </PillButton>
                ))}
              </div>
              <div className="flex gap-1">
                {(["1k", "2k"] as const).map((res) => (
                  <PillButton
                    key={res}
                    active={imageResolution === res}
                    onClick={() => {
                      setImageResolution(res);
                      saveStorage(STORAGE_KEYS.resolution, res);
                    }}
                    className="uppercase"
                  >
                    {res}
                  </PillButton>
                ))}
              </div>
            </div>
            {/* Mobile prompt */}
            <div className="relative mt-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canGenerate) handleGenerate();
                  }
                }}
                placeholder="Describe the image..."
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 pr-12 text-sm text-foreground outline-none transition placeholder:text-muted/40 focus:border-accent"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={!canGenerate}
                className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md transition ${
                  canGenerate
                    ? "bg-accent text-black hover:bg-accent-hover"
                    : "bg-surface-hover text-muted/30"
                }`}
              >
                {isGenerating ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <IconSend />
                )}
              </button>
            </div>
          </div>

          {/* Mobile gallery */}
          <div className="flex-1 overflow-y-auto p-3">
            {!hasAnyContent ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted/40">Generate your first image</p>
              </div>
            ) : (
              <GalleryGrid
                latestBatch={latestBatch}
                previousHistory={previousHistory}
                generatingSlots={generatingSlots}
                isGenerating={isGenerating}
                showEditPrompt={showEditPrompt}
                editPromptValue={editPromptValue}
                setEditPromptValue={setEditPromptValue}
                error={error}
                copiedId={copiedId}
                targetRowHeight={galleryRowHeight}
                onRegenerate={handleRegenerate}
                onEdit={handleEdit}
                onEditSubmit={handleEditSubmit}
                setShowEditPrompt={setShowEditPrompt}
                onDownload={handleDownload}
                onCopyUrl={handleCopyUrl}
                onClickImage={setLightboxResult}
              />
            )}
          </div>
        </div>

        {/* ================================================================
            RIGHT SIDE — Gallery (takes remaining ~72%)
            ================================================================ */}
        <main ref={galleryRef} className="hidden min-w-0 flex-1 flex-col lg:flex">
          {!hasAnyContent ? (
            /* Empty state */
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface">
                  <svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-muted/30">
                    <rect x="2" y="2" width="16" height="16" rx="3" />
                    <circle cx="7" cy="7" r="1.5" />
                    <path d="M2 14l4-4 3 3 4-4 5 5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted/40">
                  Your generations will appear here
                </p>
                <p className="mt-1.5 text-[11px] text-muted/25">
                  Write a prompt in the sidebar and hit Generate
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Gallery content */}
              <div className="flex-1 overflow-y-auto p-4">
                <GalleryGrid
                  latestBatch={latestBatch}
                  previousHistory={previousHistory}
                  generatingSlots={generatingSlots}
                  isGenerating={isGenerating}
                  showEditPrompt={showEditPrompt}
                  editPromptValue={editPromptValue}
                  setEditPromptValue={setEditPromptValue}
                  error={error}
                  copiedId={copiedId}
                  targetRowHeight={galleryRowHeight}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                  onEditSubmit={handleEditSubmit}
                  setShowEditPrompt={setShowEditPrompt}
                  onDownload={handleDownload}
                  onCopyUrl={handleCopyUrl}
                  onClickImage={setLightboxResult}
                />
              </div>

              {/* Size slider — pinned to bottom of gallery */}
              <div className="flex items-center gap-3 border-t border-border px-4 py-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0 text-muted/50">
                  <rect x="1" y="1" width="5" height="5" rx="1" />
                  <rect x="8" y="1" width="5" height="5" rx="1" />
                  <rect x="1" y="8" width="5" height="5" rx="1" />
                  <rect x="8" y="8" width="5" height="5" rx="1" />
                </svg>
                <input
                  type="range"
                  min={80}
                  max={400}
                  step={10}
                  value={galleryRowHeight}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGalleryRowHeight(v);
                    saveStorage(STORAGE_KEYS.gallerySize, v);
                  }}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
                />
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0 text-muted/50">
                  <rect x="1" y="1" width="5" height="5" rx="1" />
                  <rect x="8" y="1" width="5" height="5" rx="1" />
                  <rect x="1" y="8" width="5" height="5" rx="1" />
                  <rect x="8" y="8" width="5" height="5" rx="1" />
                </svg>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {lightboxResult && (
        <Lightbox
          src={lightboxResult.imageUrl}
          type="image"
          onClose={() => setLightboxResult(null)}
          onEditImage={(editPrompt) => {
            const editId = `img_${++imageIdCounter}`;
            const editImage: UploadedImage = {
              id: editId,
              preview: lightboxResult.imageUrl,
              url: lightboxResult.imageUrl,
              uploading: false,
            };
            setReferenceImages((prev) => [editImage, ...prev]);
            setLightboxResult(null);
            handleGenerate(editPrompt);
          }}
        />
      )}
    </div>
  );
}

// --- Justified Row Gallery ---

interface GalleryItem {
  type: "result";
  result: GenerationResult;
  aspectRatio: number;
}

interface GallerySlot {
  type: "slot";
  modelId: string;
  modelName: string;
  aspectRatio: number;
}

type GalleryEntry = GalleryItem | GallerySlot;

function buildJustifiedRows(
  items: GalleryEntry[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number
): GalleryEntry[][] {
  if (containerWidth <= 0 || items.length === 0) return [];

  const rows: GalleryEntry[][] = [];
  let currentRow: GalleryEntry[] = [];
  let currentRowWidth = 0;

  for (const item of items) {
    const itemWidth = targetRowHeight * item.aspectRatio;
    const gapWidth = currentRow.length > 0 ? gap : 0;

    if (currentRow.length > 0 && currentRowWidth + gapWidth + itemWidth > containerWidth * 1.3) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }

    currentRow.push(item);
    currentRowWidth += itemWidth + (currentRow.length > 1 ? gap : 0);
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

function GalleryGrid({
  latestBatch,
  previousHistory,
  generatingSlots,
  isGenerating,
  showEditPrompt,
  editPromptValue,
  setEditPromptValue,
  error,
  copiedId,
  targetRowHeight,
  onRegenerate,
  onEdit,
  onEditSubmit,
  setShowEditPrompt,
  onDownload,
  onCopyUrl,
  onClickImage,
}: {
  latestBatch: GenerationResult[];
  previousHistory: GenerationResult[];
  generatingSlots: { modelName: string; modelId: string }[];
  isGenerating: boolean;
  showEditPrompt: boolean;
  editPromptValue: string;
  setEditPromptValue: (v: string) => void;
  error: string | null;
  copiedId: string | null;
  targetRowHeight: number;
  onRegenerate: () => void;
  onEdit: () => void;
  onEditSubmit: () => void;
  setShowEditPrompt: (v: boolean) => void;
  onDownload: (r: GenerationResult) => void;
  onCopyUrl: (r: GenerationResult) => void;
  onClickImage: (r: GenerationResult) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const latestIds = new Set(latestBatch.map((r) => r.requestId));
  const gap = 6;

  // Build gallery entries: slots first, then results
  const entries: GalleryEntry[] = [
    ...generatingSlots.map((slot): GallerySlot => ({
      type: "slot",
      modelId: slot.modelId,
      modelName: slot.modelName,
      aspectRatio: 3 / 4, // placeholder ratio
    })),
    ...[...latestBatch, ...previousHistory].map((r): GalleryItem => ({
      type: "result",
      result: r,
      aspectRatio: r.width && r.height ? r.width / r.height : 1,
    })),
  ];

  const rows = buildJustifiedRows(entries, containerWidth, targetRowHeight, gap);

  return (
    <div ref={containerRef}>
      {/* Status bar */}
      {(isGenerating || error || (!isGenerating && latestBatch.length > 0)) && (
        <div className="mb-2.5 flex items-center justify-between">
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted/60">
                Generating {generatingSlots.length} {generatingSlots.length === 1 ? "image" : "images"}
              </span>
            </div>
          ) : (
            <div />
          )}
          {!isGenerating && latestBatch.length > 0 && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 text-[10px] font-medium text-accent/70 transition hover:text-accent"
            >
              <IconRegenerate /> Regenerate
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive/80">
          {error}
        </div>
      )}

      {/* Edit prompt inline */}
      {showEditPrompt && latestBatch.length > 0 && (
        <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <IconEdit />
          <input
            type="text"
            value={editPromptValue}
            onChange={(e) => setEditPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditSubmit();
              if (e.key === "Escape") setShowEditPrompt(false);
            }}
            placeholder="Describe the edit..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/40"
            autoFocus
          />
          <button
            onClick={onEditSubmit}
            disabled={!editPromptValue.trim()}
            className="shrink-0 rounded-md bg-accent px-3 py-1 text-[10px] font-semibold text-black transition hover:bg-accent-hover disabled:opacity-30"
          >
            Go
          </button>
          <button
            onClick={() => setShowEditPrompt(false)}
            className="text-[10px] text-muted transition hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Justified row gallery */}
      {containerWidth > 0 && (
        <div className="flex flex-col" style={{ gap }}>
          {rows.map((row, rowIdx) => {
            // Calculate actual row height so images fill full width
            const totalGap = (row.length - 1) * gap;
            const availableWidth = containerWidth - totalGap;
            const totalAR = row.reduce((sum, e) => sum + e.aspectRatio, 0);
            const rowHeight = Math.min(availableWidth / totalAR, targetRowHeight * 1.5);

            return (
              <div key={rowIdx} className="flex" style={{ gap, height: rowHeight }}>
                {row.map((entry, colIdx) => {
                  const itemWidth = rowHeight * entry.aspectRatio;

                  if (entry.type === "slot") {
                    return (
                      <div
                        key={`slot-${entry.modelId}`}
                        className="glow-border flex shrink-0 items-center justify-center rounded-lg border border-accent/15 bg-surface"
                        style={{ width: itemWidth, height: rowHeight }}
                      >
                        <div className="text-center">
                          <div className="mx-auto mb-1.5 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                          <p className="text-[9px] font-medium text-muted">
                            {entry.modelName}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const r = entry.result;
                  const isLatest = latestIds.has(r.requestId);

                  return (
                    <div
                      key={`${r.requestId}-${rowIdx}-${colIdx}`}
                      className={`shrink-0 ${isLatest ? "ring-1 ring-accent/30 rounded-lg" : ""}`}
                      style={{ width: itemWidth, height: rowHeight }}
                    >
                      <GalleryCard
                        result={r}
                        isFeatured={isLatest}
                        onDownload={() => onDownload(r)}
                        onCopyUrl={() => onCopyUrl(r)}
                        onEdit={onEdit}
                        onRegenerate={onRegenerate}
                        onClick={() => onClickImage(r)}
                        copied={copiedId === r.requestId}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

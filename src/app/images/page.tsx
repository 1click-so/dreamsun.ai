"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { fal } from "@fal-ai/client";
import {
  MODELS,
  type ModelConfig,
  getSelectableModels,
  resolveModel,
} from "@/lib/models";
import { Navbar } from "@/components/Navbar";
import { Toggle } from "@/components/ui/Toggle";
import { ModelSelector, CreditIcon } from "@/components/ModelSelector";
import { usePricing, tierKey } from "@/hooks/usePricing";
import { invalidateCredits } from "@/hooks/useCredits";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import { useGenerations, type Generation } from "@/hooks/useGenerations";
import { GalleryToolbar, type GalleryFilter } from "@/components/generate/GalleryToolbar";
import { BulkActionBar } from "@/components/generate/BulkActionBar";
import { ModeBar, ModeComingSoon, type ModeConfig } from "@/components/generate/ModeBar";
import { UpscalePanel } from "@/components/generate/UpscalePanel";

fal.config({ proxyUrl: "/api/fal/proxy" });

// --- Types ---

interface GenerationSettings {
  modelId: string;
  aspectRatio: string;
  resolution: string;
  numImages: number;
  safetyChecker: boolean;
  negativePrompt?: string;
  hasReferenceImages: boolean;
}

interface GenerationResult {
  id?: string;
  type?: "image" | "video" | "audio";
  imageUrl: string;
  allImageUrls?: string[];
  width: number;
  height: number;
  duration?: number | null;
  seed: number;
  model: string;
  modelId?: string;
  requestId: string;
  prompt?: string;
  batchId?: string;
  settings?: GenerationSettings;
  createdAt?: number;
  favorited?: boolean;
  sceneId?: string | null;
  shotNumber?: string | null;
  pending?: boolean;
  thumbnailUrl?: string | null;
}

interface UploadedImage {
  id: string;
  preview: string;
  url: string | null;
  uploading: boolean;
}

interface Character {
  id: string;
  name: string;
  images: string[]; // fal CDN URLs
  promptPrefix?: string;
  createdAt: number;
}

// --- localStorage helpers ---

const STORAGE_KEYS = {
  mode: "dreamsun_gen_mode",
  models: "dreamsun_gen_models",
  ratio: "dreamsun_gen_ratio",
  resolution: "dreamsun_gen_resolution",
  numImages: "dreamsun_gen_num_images",
  safety: "dreamsun_gen_safety",
  history: "dreamsun_gen_history",
  gallerySize: "dreamsun_gen_gallery_size",
  characters: "dreamsun_gen_characters",
  pending: "dreamsun_gen_pending",
} as const;

interface PendingGeneration {
  slotId: string;
  modelName: string;
  modelId: string;
  prompt: string;
  batchId: string;
  settings: GenerationSettings;
  createdAt: number;
}

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
    // Quota exceeded — if this is history, trim oldest entries and retry
    if (key === STORAGE_KEYS.history && Array.isArray(value)) {
      let trimmed = value as unknown[];
      while (trimmed.length > 10) {
        trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.8));
        try {
          localStorage.setItem(key, JSON.stringify(trimmed));
          console.warn(`[DreamSun] localStorage full — trimmed history to ${trimmed.length} items`);
          return;
        } catch {
          continue;
        }
      }
    }
    console.error("[DreamSun] localStorage save failed for key:", key);
  }
}

let imageIdCounter = 0;
let batchIdCounter = 0;

/** Convert a Supabase Generation row to the UI's GenerationResult format */
function generationToResult(g: Generation): GenerationResult {
  // Merge the DB-level aspect_ratio into settings so the gallery can parse it
  const settings = (g.settings ?? {}) as Record<string, unknown>;
  if (g.aspect_ratio && !settings.aspectRatio) {
    settings.aspectRatio = g.aspect_ratio;
  }
  return {
    id: g.id,
    type: g.type,
    imageUrl: g.url ?? "",
    width: g.width ?? 0,
    height: g.height ?? 0,
    duration: g.duration,
    seed: g.seed ?? 0,
    model: g.model_name ?? g.model_id,
    modelId: g.model_id,
    requestId: g.request_id ?? g.id,
    prompt: g.prompt ?? undefined,
    batchId: g.batch_id ?? undefined,
    settings: settings as unknown as GenerationSettings | undefined,
    createdAt: new Date(g.created_at).getTime(),
    favorited: g.favorited,
    sceneId: g.scene_id,
    shotNumber: g.shot_number,
    pending: !g.url,
    thumbnailUrl: g.thumbnail_url ?? (g.type === "video" ? g.source_image_url : null),
  };
}

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

function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C8.37 3.2 12.8 7.63 16 8c-3.2.37-7.63 4.8-8 8-.37-3.2-4.8-7.63-8-8C3.2 7.63 7.63 3.2 8 0z" />
    </svg>
  );
}

// --- Image Mode System ---

type ImageMode = "create" | "upscale" | "edit" | "skin";

const IMAGE_MODES: ModeConfig[] = [
  {
    id: "create",
    label: "Create",
    icon: <IconSparkle size={12} />,
    description: "Generate images from text prompts",
    ready: true,
  },
  {
    id: "upscale",
    label: "Upscale",
    icon: <IconUpscale />,
    description: "Enhance resolution and detail",
    ready: true,
    hasPrompt: false,
  },
  {
    id: "edit",
    label: "Edit",
    icon: <IconEdit />,
    description: "Modify images with prompts",
    ready: false,
  },
  {
    id: "skin",
    label: "Skin Enhance",
    icon: (
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" /><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
    description: "Enhance skin texture and lighting",
    ready: true,
    hasPrompt: false,
  },
];

// --- Video Thumbnail (lazy load via IntersectionObserver) ---

function VideoThumb({ src, thumbnailUrl, hovered, onLoaded }: {
  src: string;
  thumbnailUrl?: string | null;
  hovered: boolean;
  onLoaded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (hovered) { setMounted(true); } else { setMounted(false); setVideoReady(false); }
  }, [hovered]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (mounted) { el.play().catch(() => {}); } else { el.pause(); el.currentTime = 0; }
  }, [mounted]);

  return (
    <>
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          quality={60}
          className={`rounded-lg object-cover transition-opacity duration-150 ${videoReady ? "opacity-0" : "opacity-100"}`}
          draggable={false}
          onLoad={onLoaded}
        />
      )}
      {mounted && (
        <video
          ref={videoRef}
          src={src}
          className={`h-full w-full rounded-lg object-cover transition-opacity duration-150 ${videoReady ? "opacity-100" : "opacity-0"}`}
          muted loop playsInline autoPlay preload="auto"
          draggable={false}
          onPlaying={() => setVideoReady(true)}
        />
      )}
      {!thumbnailUrl && !mounted && (
        <VideoMetadataLoader src={src} onLoaded={onLoaded} />
      )}
      {!videoReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white" stroke="none">
              <path d="M4 2.5l8 4.5-8 4.5V2.5z" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}

function VideoMetadataLoader({ src, onLoaded }: { src: string; onLoaded: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shouldLoad) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShouldLoad(true); obs.disconnect(); } },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldLoad]);

  return (
    <video
      ref={ref}
      src={src}
      className={`h-full w-full rounded-lg object-cover transition-opacity duration-300 ${shouldLoad ? "opacity-100" : "opacity-0"}`}
      muted playsInline
      preload={shouldLoad ? "metadata" : "none"}
      draggable={false}
      onLoadedData={onLoaded}
    />
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
  onFavorite,
  onDelete,
  onUpscale,
  onClick,
  copied,
  onImageLoad,
  isLoaded,
  onMediaLoaded,
  selectMode,
  selected,
  onToggleSelect,
}: {
  result: GenerationResult;
  isFeatured: boolean;
  onDownload: () => void;
  onCopyUrl: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onUpscale?: () => void;
  onClick: () => void;
  copied: boolean;
  onImageLoad?: (url: string, w: number, h: number) => void;
  isLoaded?: boolean;
  onMediaLoaded?: (url: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const loaded = (isLoaded ?? false) || localLoaded;

  const handleMediaReady = useCallback(() => {
    setLocalLoaded(true);
    onMediaLoaded?.(result.imageUrl);
  }, [onMediaLoaded, result.imageUrl]);

  const handleClick = selectMode ? (onToggleSelect ?? onClick) : onClick;

  return (
    <div
      className={`group relative h-full w-full cursor-pointer overflow-hidden rounded-lg transition-all ${
        selectMode && selected ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      draggable={!selectMode}
      onDragStart={(e) => {
        if (selectMode) { e.preventDefault(); return; }
        e.dataTransfer.setData("text/uri-list", result.imageUrl);
        e.dataTransfer.setData("text/plain", result.imageUrl);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      {/* Select mode checkbox */}
      {selectMode && (
        <div className="absolute left-2 top-2 z-20">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] transition ${
              selected ? "border-accent bg-accent" : "border-white/60 bg-black/40 backdrop-blur-sm"
            }`}
          >
            {selected && (
              <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5l2.5 2.5L8 3" />
              </svg>
            )}
          </span>
        </div>
      )}

      {/* Skeleton placeholder until media loads */}
      {!loaded && (
        <div className="absolute inset-0 skeleton-shimmer rounded-lg" />
      )}
      {result.type === "video" ? (
        <VideoThumb
          src={result.imageUrl}
          thumbnailUrl={result.thumbnailUrl}
          hovered={hovered}
          onLoaded={handleMediaReady}
        />
      ) : (
        <Image
          src={result.imageUrl}
          alt={`Generated by ${result.model}`}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          quality={75}
          className={`rounded-lg object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          draggable={false}
          onLoad={(e) => {
            handleMediaReady();
            const img = e.target as HTMLImageElement;
            onImageLoad?.(result.imageUrl, img.naturalWidth, img.naturalHeight);
          }}
        />
      )}

      {/* Model badge — subtle, hover-visible */}
      {!selectMode && (
        <div className="absolute left-1.5 top-1.5 rounded-md bg-black/40 px-1.5 py-px text-[8px] font-medium text-white/60 backdrop-blur-sm transition-opacity group-hover:opacity-100 opacity-0">
          {result.model.replace(/\s*\(Edit\)/i, "")}
        </div>
      )}

      {/* Favorite heart — top right, visible on hover or when favorited */}
      {!selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition ${
            result.favorited
              ? "bg-black/50 text-red-400 opacity-100"
              : `bg-black/40 text-white/60 hover:text-red-400 ${hovered ? "opacity-100" : "opacity-0"}`
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill={result.favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
            <path d="M7 12.5S1 8.5 1 5a3 3 0 015.5-1.5h1A3 3 0 0113 5c0 3.5-6 7.5-6 7.5z" />
          </svg>
        </button>
      )}

      {/* Hover overlay — actions only (hidden in select mode) */}
      {!selectMode && <div
        className={`absolute inset-x-0 bottom-0 flex items-center justify-end gap-0.5 rounded-b-lg bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6 transition-opacity duration-200 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onDownload} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" title="Download">
          <IconDownload />
        </button>
        <button onClick={onUpscale} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" title="Upscale">
          <IconUpscale />
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
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-md p-1.5 text-white/70 transition hover:bg-white/10 hover:text-red-400" title="Delete">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h10M5 4V2.5h4V4M3 4l.7 8.1c.1.8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4L11 4" />
          </svg>
        </button>
      </div>}
    </div>
  );
}

// --- Section Label ---

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-foreground/60 ${className ?? ""}`}>
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
          ? "border-accent/30 bg-accent/10 text-accent-text"
          : "border-border text-foreground/50 hover:border-accent/20 hover:text-foreground"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

// --- Page ---

const VALID_MODES: ImageMode[] = ["create", "upscale", "edit", "skin"];

export default function GeneratePage() {
  const searchParams = useSearchParams();

  // Mode — URL param > localStorage > default
  const [activeMode, setActiveMode] = useState<ImageMode>(() => {
    if (typeof window === "undefined") return "create";
    const urlMode = new URLSearchParams(window.location.search).get("mode") as ImageMode | null;
    if (urlMode && VALID_MODES.includes(urlMode)) return urlMode;
    return loadStorage<ImageMode>(STORAGE_KEYS.mode, "create");
  });

  // Sync when searchParams change (e.g. navigating from explore page)
  useEffect(() => {
    const urlMode = searchParams.get("mode") as ImageMode | null;
    if (urlMode && VALID_MODES.includes(urlMode) && urlMode !== activeMode) {
      setActiveMode(urlMode);
      saveStorage(STORAGE_KEYS.mode, urlMode);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [generatingSlots, setGeneratingSlots] = useState<{ modelName: string; modelId: string; slotId: string }[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creditsShortfall, setCreditsShortfall] = useState<{ required: number; available: number } | null>(null);

  // Supabase-backed generations (master gallery)
  const {
    generations: dbGenerations,
    loading: generationsLoading,
    addGenerations: addDbGenerations,
    toggleFavorite: dbToggleFavorite,
    deleteGeneration: dbDeleteGeneration,
    deleteGenerations: dbDeleteGenerations,
  } = useGenerations();

  // Convert DB rows to UI format
  const history = useMemo(
    () => dbGenerations.map(generationToResult),
    [dbGenerations]
  );
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPromptValue, setEditPromptValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<GenerationResult | null>(null);
  const [upscaleImageUrl, setUpscaleImageUrl] = useState<string | null>(null);
  const [upscaleKey, setUpscaleKey] = useState(0);
  const [promptBarDragOver, setPromptBarDragOver] = useState(false);
  const [refsDragOver, setRefsDragOver] = useState(false);
  const [galleryRowHeight, setGalleryRowHeight] = useState(() => {
    const stored = loadStorage(STORAGE_KEYS.gallerySize, 1.0);
    // Migrate old pixel values to scale
    return stored > 10 ? 1.0 : stored;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("images");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Characters
  const [characters, setCharacters] = useState<Character[]>(() =>
    loadStorage<Character[]>(STORAGE_KEYS.characters, [])
  );
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [characterName, setCharacterName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const { pricing, creditRanges, loading: pricingLoading } = usePricing();

  const isGenerating = generatingSlots.length > 0;

  // Derived
  const hasRefs = referenceImages.some((img) => img.url);
  const selectableModels = useMemo(() =>
    getSelectableModels().map((m) => ({
      ...m,
      group: m.featured ? "Featured" : m.loras?.length ? "Custom LoRA" : "Other",
    })),
    []
  );
  const selectedModels = selectableModels.filter((m) => selectedModelIds.includes(m.id));
  const primaryModel = selectedModels[0] ?? selectableModels[0];
  const currentEffectiveModel =
    resolveModel(primaryModel.id, hasRefs) ?? primaryModel;
  const maxImages = currentEffectiveModel.referenceImage?.maxImages ?? 14;

  // Persist characters to localStorage
  useEffect(() => {
    saveStorage(STORAGE_KEYS.characters, characters);
  }, [characters]);

  // Re-submit a pending generation (used on page load to recover interrupted generations)
  const resubmitPending = useCallback(async (pending: PendingGeneration) => {
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: pending.modelId,
          prompt: pending.prompt,
          aspectRatio: pending.settings.aspectRatio,
          imageResolution: pending.settings.resolution,
          numImages: pending.settings.numImages,
          safetyChecker: pending.settings.safetyChecker,
          negativePrompt: pending.settings.negativePrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const imageUrls: string[] = data.allImageUrls && data.allImageUrls.length > 0
        ? data.allImageUrls
        : [data.imageUrl];

      const now = Date.now();
      const model = MODELS.find((m) => m.id === pending.modelId) ?? MODELS[0];

      // Persist each image to Supabase and add to gallery
      const persistedGens: Generation[] = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const reqId = imageUrls.length > 1 ? `${data.requestId}_${i}` : data.requestId;
        try {
          const persistRes = await fetch("/api/persist-generation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "image",
              url,
              prompt: pending.prompt,
              modelId: model.id,
              modelName: model.name,
              seed: data.seed,
              requestId: reqId,
              width: data.width,
              height: data.height,
              aspectRatio: pending.settings.aspectRatio,
              resolution: pending.settings.resolution,
              numImages: pending.settings.numImages,
              settings: pending.settings,
              batchId: pending.batchId,
            }),
          });
          const persistData = await persistRes.json();
          persistedGens.push({
            id: persistData.id,
            type: "image",
            url: persistData.url ?? url,
            width: data.width ?? null,
            height: data.height ?? null,
            duration: null,
            prompt: pending.prompt,
            negative_prompt: null,
            model_id: model.id,
            model_name: model.name,
            seed: data.seed ?? null,
            request_id: reqId,
            aspect_ratio: pending.settings.aspectRatio ?? null,
            resolution: pending.settings.resolution ?? null,
            settings: pending.settings as unknown as Record<string, unknown>,
            batch_id: pending.batchId ?? null,
            favorited: false,
            created_at: new Date(now + i).toISOString(),
            scene_id: null,
            shot_number: null,
            project_id: null,
            source_image_url: null,
            thumbnail_url: null,
            reference_image_urls: null,
          });
        } catch (e) {
          console.error("[persist] resubmit failed:", e);
        }
      }
      if (persistedGens.length > 0) addDbGenerations(persistedGens);
    } catch (err) {
      setError((prev) =>
        prev
          ? `${prev}; ${pending.modelName}: ${err instanceof Error ? err.message : "Failed"}`
          : `${pending.modelName}: ${err instanceof Error ? err.message : "Failed"}`
      );
    } finally {
      // Remove from pending + slot
      const stored = loadStorage<PendingGeneration[]>(STORAGE_KEYS.pending, []);
      saveStorage(STORAGE_KEYS.pending, stored.filter((p) => p.slotId !== pending.slotId));
      setGeneratingSlots((prev) => prev.filter((s) => s.slotId !== pending.slotId));
    }
  }, [addDbGenerations]);

  // Resume pending generations on page load
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;

    const pending = loadStorage<PendingGeneration[]>(STORAGE_KEYS.pending, []);
    if (pending.length === 0) return;

    // Filter out stale pending (older than 10 minutes)
    const fresh = pending.filter((p) => Date.now() - p.createdAt < 10 * 60 * 1000);
    if (fresh.length < pending.length) {
      saveStorage(STORAGE_KEYS.pending, fresh);
    }
    if (fresh.length === 0) return;

    // Recreate slots and re-submit
    setGeneratingSlots((prev) => [
      ...fresh.map((p) => ({ modelName: p.modelName, modelId: p.modelId, slotId: p.slotId })),
      ...prev,
    ]);
    fresh.forEach((p) => resubmitPending(p));
  }, [resubmitPending]);

  // Filter by gallery filter + search
  let filteredHistory = history;
  if (galleryFilter === "loved") {
    filteredHistory = filteredHistory.filter((r) => r.favorited);
  } else if (galleryFilter === "images") {
    filteredHistory = filteredHistory.filter((r) => !r.type || r.type === "image");
  } else if (galleryFilter === "videos") {
    filteredHistory = filteredHistory.filter((r) => r.type === "video");
  } else if (galleryFilter === "audio") {
    filteredHistory = filteredHistory.filter((r) => r.type === "audio");
  }
  // "all" → no filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredHistory = filteredHistory.filter((r) =>
      r.prompt?.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q)
    );
  }

  // Latest batch
  const latestBatch = currentBatchId
    ? filteredHistory.filter((r) => r.batchId === currentBatchId)
    : [];
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

  // Add a reference image from a URL (drag from gallery, lightbox "Use as Reference", etc.)
  const addReferenceFromUrl = useCallback((url: string) => {
    const id = `img_${++imageIdCounter}`;
    const newImage: UploadedImage = { id, preview: url, url, uploading: false };
    setReferenceImages((prev) => [...prev, newImage]);
  }, []);

  // Handle drops on the prompt bar — files from computer OR image URLs from gallery
  const handlePromptBarDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setPromptBarDragOver(false);

      // 1) Check for image URL (dragged from gallery)
      const imageUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) && /\.(png|jpe?g|webp)/i.test(imageUrl)) {
        addReferenceFromUrl(imageUrl);
        return;
      }

      // 2) Check for dropped files from computer
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        for (const file of imageFiles.slice(0, 14 - referenceImages.length)) {
          const id = `img_${++imageIdCounter}`;
          const preview = URL.createObjectURL(file);
          const newImage: UploadedImage = { id, preview, url: null, uploading: true };
          setReferenceImages((prev) => [...prev, newImage]);
          try {
            const url = await fal.storage.upload(file);
            setReferenceImages((prev) =>
              prev.map((img) => (img.id === id ? { ...img, url, uploading: false } : img))
            );
          } catch (err) {
            setReferenceImages((prev) => prev.filter((img) => img.id !== id));
            setError(`Upload failed: ${err instanceof Error ? err.message : "Network error"}`);
          }
        }
      }
    },
    [referenceImages.length, addReferenceFromUrl]
  );

  // Handle drops on the reference images area — from gallery or desktop
  const handleRefsDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setRefsDragOver(false);

      // 1) Image URL from gallery drag
      const imageUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) && /\.(png|jpe?g|webp)/i.test(imageUrl)) {
        addReferenceFromUrl(imageUrl);
        return;
      }

      // 2) Files from desktop
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        for (const file of imageFiles.slice(0, 14 - referenceImages.length)) {
          const id = `img_${++imageIdCounter}`;
          const preview = URL.createObjectURL(file);
          const newImage: UploadedImage = { id, preview, url: null, uploading: true };
          setReferenceImages((prev) => [...prev, newImage]);
          try {
            const url = await fal.storage.upload(file);
            setReferenceImages((prev) =>
              prev.map((img) => (img.id === id ? { ...img, url, uploading: false } : img))
            );
          } catch (err) {
            setReferenceImages((prev) => prev.filter((img) => img.id !== id));
            setError(`Upload failed: ${err instanceof Error ? err.message : "Network error"}`);
          }
        }
      }
    },
    [referenceImages.length, addReferenceFromUrl]
  );

  const handleGenerate = async (overridePrompt?: string) => {
    const usedPrompt = overridePrompt ?? prompt;
    if (!usedPrompt.trim()) return;

    setError(null);
    setShowEditPrompt(false);

    const batchId = `batch_${++batchIdCounter}`;
    setCurrentBatchId(batchId);

    const modelsToRun = selectedModels.length > 0 ? selectedModels : [primaryModel];
    const newSlots = modelsToRun.map((m) => ({ modelName: m.name, modelId: m.id, slotId: `slot_${++batchIdCounter}` }));
    setGeneratingSlots((prev) => [...newSlots, ...prev]);

    if (galleryRef.current) galleryRef.current.scrollTop = 0;

    newSlots.forEach(async (slot) => {
      const model = modelsToRun.find((m) => m.id === slot.modelId)!;
      const effectiveModel = resolveModel(model.id, hasRefs) ?? model;

      // Save pending to localStorage BEFORE the API call so it survives refresh
      const pending: PendingGeneration = {
        slotId: slot.slotId,
        modelName: model.name,
        modelId: effectiveModel.id,
        prompt: usedPrompt.trim(),
        batchId,
        settings: {
          modelId: effectiveModel.id,
          aspectRatio,
          resolution: imageResolution,
          numImages,
          safetyChecker,
          negativePrompt: negativePrompt.trim() || undefined,
          hasReferenceImages: hasRefs,
        },
        createdAt: Date.now(),
      };

      const stored = loadStorage<PendingGeneration[]>(STORAGE_KEYS.pending, []);
      saveStorage(STORAGE_KEYS.pending, [...stored, pending]);

      try {
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

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 402) {
            setCreditsShortfall({ required: data.required, available: data.available });
            invalidateCredits();
            throw new Error(`Insufficient credits`);
          }
          throw new Error(data.error || "Generation failed");
        }
        // Refresh credit display after successful generation
        invalidateCredits();

        const imageUrls: string[] = data.allImageUrls && data.allImageUrls.length > 0
          ? data.allImageUrls
          : [data.imageUrl];

        const now = Date.now();

        // Persist each image to Supabase and add to gallery
        const persistedGens: Generation[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
          const url = imageUrls[i];
          const reqId = imageUrls.length > 1 ? `${data.requestId}_${i}` : data.requestId;
          try {
            const persistRes = await fetch("/api/persist-generation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "image",
                url,
                prompt: usedPrompt.trim(),
                modelId: model.id,
                modelName: model.name,
                seed: data.seed,
                requestId: reqId,
                width: data.width,
                height: data.height,
                aspectRatio: pending.settings.aspectRatio,
                resolution: pending.settings.resolution,
                numImages: pending.settings.numImages,
                settings: pending.settings,
                referenceImageUrls: hasRefs ? referenceImages.filter((r) => r.url).map((r) => r.url) : null,
                batchId,
              }),
            });
            const persistData = await persistRes.json();
            persistedGens.push({
              id: persistData.id,
              type: "image",
              url: persistData.url ?? url,
              width: data.width ?? null,
              height: data.height ?? null,
              duration: null,
              prompt: usedPrompt.trim(),
              negative_prompt: pending.settings.negativePrompt ?? null,
              model_id: model.id,
              model_name: model.name,
              seed: data.seed ?? null,
              request_id: reqId,
              aspect_ratio: pending.settings.aspectRatio ?? null,
              resolution: pending.settings.resolution ?? null,
              settings: pending.settings as unknown as Record<string, unknown>,
              batch_id: batchId ?? null,
              favorited: false,
              created_at: new Date(now + i).toISOString(),
              scene_id: null,
              shot_number: null,
              project_id: null,
              source_image_url: null,
              thumbnail_url: null,
              reference_image_urls: hasRefs ? referenceImages.filter((r) => r.url).map((r) => r.url!) : null,
            });
          } catch (e) {
            console.error("[persist] Failed:", e);
          }
        }
        if (persistedGens.length > 0) addDbGenerations(persistedGens);
      } catch (err) {
        setError((prev) =>
          prev
            ? `${prev}; ${model.name}: ${err instanceof Error ? err.message : "Failed"}`
            : `${model.name}: ${err instanceof Error ? err.message : "Failed"}`
        );
      } finally {
        // Remove from pending + slot
        const cur = loadStorage<PendingGeneration[]>(STORAGE_KEYS.pending, []);
        saveStorage(STORAGE_KEYS.pending, cur.filter((p) => p.slotId !== slot.slotId));
        setGeneratingSlots((prev) => prev.filter((s) => s.slotId !== slot.slotId));
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

  const toggleFavorite = (requestId: string) => {
    // Find by requestId, but toggle via DB id
    const gen = history.find((r) => r.requestId === requestId);
    if (gen?.id) dbToggleFavorite(gen.id);
    // Also update selectedResult if it's the same
    setSelectedResult((prev) =>
      prev && prev.requestId === requestId ? { ...prev, favorited: !prev.favorited } : prev
    );
  };

  const deleteImage = (requestId: string) => {
    const gen = history.find((r) => r.requestId === requestId);
    if (gen?.id) dbDeleteGeneration(gen.id);
    // Close lightbox if this image is open
    setSelectedResult((prev) => (prev && prev.requestId === requestId ? null : prev));
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

  // --- Bulk select handlers ---

  const toggleSelect = useCallback((requestId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredHistory.map((r) => r.requestId)));
  }, [filteredHistory]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set()); // clear on exit
      return !prev;
    });
  }, []);

  const bulkDownload = useCallback(async () => {
    const items = filteredHistory.filter((r) => selectedIds.has(r.requestId));
    if (items.length === 0) return;
    setBulkDownloading(true);
    for (const r of items) {
      try {
        const res = await fetch(r.imageUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = r.type === "video" ? "mp4" : "png";
        a.download = `dreamsun-${r.model.replace(/\s+/g, "-").toLowerCase()}-${r.requestId || Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        // Small delay to prevent browser download throttling
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch {
        window.open(r.imageUrl, "_blank");
      }
    }
    setBulkDownloading(false);
  }, [filteredHistory, selectedIds]);

  const bulkDelete = useCallback(() => {
    const items = filteredHistory.filter((r) => selectedIds.has(r.requestId));
    const dbIds = items.map((r) => r.id).filter(Boolean) as string[];
    if (dbIds.length === 0) return;
    dbDeleteGenerations(dbIds);
    setSelectedIds(new Set());
    setSelectMode(false);
    // Close lightbox if open item was deleted
    setSelectedResult((prev) => (prev && selectedIds.has(prev.requestId) ? null : prev));
  }, [filteredHistory, selectedIds, dbDeleteGenerations]);

  // --- Character handlers ---

  const saveCharacter = () => {
    const name = characterName.trim();
    if (!name) return;
    const urls = referenceImages.map((img) => img.url).filter(Boolean) as string[];
    if (urls.length === 0) return;
    const char: Character = {
      id: `char_${Date.now()}`,
      name,
      images: urls.slice(0, 4),
      createdAt: Date.now(),
    };
    setCharacters((prev) => [char, ...prev]);
    setActiveCharacterId(char.id);
    setShowCharacterModal(false);
    setCharacterName("");
  };

  const loadCharacter = (char: Character) => {
    // Load character images as references
    const refs: UploadedImage[] = char.images.map((url, i) => ({
      id: `char_ref_${Date.now()}_${i}`,
      preview: url,
      url,
      uploading: false,
    }));
    setReferenceImages(refs);
    setActiveCharacterId(char.id);
  };

  const clearCharacter = () => {
    setReferenceImages([]);
    setActiveCharacterId(null);
  };

  const deleteCharacter = (charId: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== charId));
    if (activeCharacterId === charId) {
      setActiveCharacterId(null);
    }
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
        if (prompt.trim()) handleGenerate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isGenerating]);

  const hasAnyContent = history.length > 0 || isGenerating || generationsLoading;
  const canGenerate = prompt.trim() && !referenceImages.some((img) => img.uploading);

  const estimatedCredits = useMemo(() => {
    if (pricingLoading) return 0;
    const models = selectedModels.length > 0 ? selectedModels : [primaryModel];
    return models.reduce((sum, m) => {
      const key = tierKey(m.id, imageResolution);
      return sum + (pricing[key]?.base_price_credits ?? pricing[m.id]?.base_price_credits ?? 0);
    }, 0) * numImages;
  }, [selectedModels, primaryModel, pricing, pricingLoading, numImages, imageResolution]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Navbar />

      <div className="flex min-h-0 flex-1">
        {/* ================================================================
            LEFT SIDEBAR — All controls + prompt (28% width)
            ================================================================ */}
        <aside className="hidden w-[28%] min-w-[280px] max-w-[400px] shrink-0 flex-col border-r border-border lg:flex">
          {/* Mode bar — fixed at top */}
          <div className="border-b border-border px-2 py-2">
            <ModeBar modes={IMAGE_MODES} active={activeMode} onChange={(id) => { setActiveMode(id as ImageMode); saveStorage(STORAGE_KEYS.mode, id); }} columns={2} />
          </div>

          {/* Scrollable settings area */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeMode === "upscale" ? (
              <UpscalePanel key={`upscale-${upscaleKey}`} category="upscale" initialImageUrl={upscaleImageUrl} />
            ) : activeMode === "skin" ? (
              <UpscalePanel key="skin" category="skin" />
            ) : activeMode === "create" ? (
            <div className="space-y-5">
              {/* Model */}
              <div>
                <SectionLabel>Model</SectionLabel>
                <ModelSelector
                  models={selectableModels}
                  selectedIds={selectedModelIds}
                  onChange={handleModelsChange}
                  pricing={pricing}
                  creditRanges={creditRanges}
                />
                {selectedModels.length > 1 && (
                  <p className="mt-1.5 text-[10px] text-muted">
                    Generates with {selectedModels.length} models in parallel
                  </p>
                )}
              </div>

              {/* Characters — hidden, feature ready but not launched */}
              {false && primaryModel.editVariant && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <SectionLabel className="mb-0">Characters</SectionLabel>
                    {hasRefs && referenceImages.every((img) => img.url) && (
                      <button
                        onClick={() => setShowCharacterModal(true)}
                        className="text-[10px] font-medium text-accent/70 transition hover:text-accent"
                      >
                        Save
                      </button>
                    )}
                  </div>

                  {characters.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {characters.map((char) => (
                        <div key={char.id} className="group relative">
                          <button
                            onClick={() =>
                              activeCharacterId === char.id ? clearCharacter() : loadCharacter(char)
                            }
                            className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition ${
                              activeCharacterId === char.id
                                ? "border-accent ring-1 ring-accent/30"
                                : "border-border hover:border-accent/40"
                            }`}
                            title={char.name}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={char.images[0]}
                              alt={char.name}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <span className="mt-0.5 block max-w-[56px] truncate text-center text-[8px] text-muted/60">
                            {char.name}
                          </span>
                          <button
                            onClick={() => deleteCharacter(char.id)}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background/80 text-muted opacity-0 shadow transition hover:text-destructive group-hover:opacity-100"
                          >
                            <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M1 1l6 6M7 1l-6 6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted/60">
                      Upload reference images, then save as character
                    </p>
                  )}
                </div>
              )}

              {/* Save Character Modal — hidden */}
              {false && showCharacterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCharacterModal(false)}>
                  <div className="w-[320px] rounded-xl border border-border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <p className="mb-3 text-sm font-semibold text-foreground">Save Character</p>
                    <p className="mb-3 text-[11px] text-muted">
                      Saving {referenceImages.filter((r) => r.url).length} reference image{referenceImages.filter((r) => r.url).length !== 1 ? "s" : ""} as a reusable character.
                    </p>
                    <input
                      type="text"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveCharacter(); if (e.key === "Escape") setShowCharacterModal(false); }}
                      placeholder="Character name..."
                      className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setShowCharacterModal(false)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveCharacter}
                        disabled={!characterName.trim()}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-accent-hover disabled:opacity-30"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reference Images */}
              {primaryModel.editVariant && (
                <div>
                  <SectionLabel>Reference Images</SectionLabel>
                  <div
                    className={`flex flex-wrap gap-2 rounded-lg p-1.5 -m-1.5 transition ${
                      refsDragOver ? "bg-accent/10 ring-1 ring-accent/30" : ""
                    }`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setRefsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setRefsDragOver(false); }}
                    onDrop={handleRefsDrop}
                  >
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
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed transition ${
                          refsDragOver
                            ? "border-accent bg-accent/10 text-accent-text"
                            : "border-border text-muted hover:border-accent/40 hover:text-accent"
                        }`}
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
                    <p className="mt-1.5 text-[10px] text-accent/80">
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
                    className="flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wider text-foreground/60 transition hover:text-foreground"
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
                      className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none transition placeholder:text-muted focus:border-accent"
                    />
                  )}
                </div>
              )}
            </div>
            ) : (
              <ModeComingSoon mode={IMAGE_MODES.find((m) => m.id === activeMode)!} />
            )}
          </div>

          {/* Sidebar bottom spacer — prompt moved to floating bar */}
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
                  pricing={pricing}
                  creditRanges={creditRanges}
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
            <div className="mt-2 rounded-xl border border-border bg-surface transition-all focus-within:border-accent/40">
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 100) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canGenerate) handleGenerate();
                  }
                }}
                placeholder="Describe your image..."
                className="scrollbar-none block w-full resize-none overflow-y-auto bg-transparent px-3 pt-2.5 pb-0.5 text-sm text-foreground outline-none placeholder:text-muted"
                style={{ minHeight: "38px", maxHeight: "100px" }}
              />
              <div className="flex items-center justify-end px-2 pb-2 pt-0.5">
                <button
                  onClick={() => handleGenerate()}
                  disabled={!canGenerate}
                  className={`flex items-center gap-2 rounded-full py-2 pl-3.5 pr-4 text-xs font-semibold transition ${
                    canGenerate
                      ? "bg-accent text-black hover:bg-accent-hover"
                      : "cursor-not-allowed bg-surface-hover text-muted/50"
                  }`}
                >
                  {isGenerating ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  ) : (
                    <IconSparkle size={12} />
                  )}
                  Generate
                  {estimatedCredits > 0 && !isGenerating && (
                    <span className="flex items-center gap-1 opacity-60">
                      <CreditIcon size={10} /> {estimatedCredits}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile gallery */}
          <div className="flex-1 overflow-y-auto p-3">
            {!hasAnyContent ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted/60">Generate your first image</p>
              </div>
            ) : (
              <GalleryGrid
                results={filteredHistory}
                latestBatchId={currentBatchId}
                generatingSlots={generatingSlots}
                isGenerating={isGenerating}
                showEditPrompt={showEditPrompt}
                editPromptValue={editPromptValue}
                setEditPromptValue={setEditPromptValue}
                error={error}
                copiedId={copiedId}
                targetRowHeight={galleryRowHeight}
                slotAspectRatio={(() => { const [w, h] = aspectRatio.split(":").map(Number); return w && h ? w / h : 1; })()}
                onRegenerate={handleRegenerate}
                onEdit={handleEdit}
                onEditSubmit={handleEditSubmit}
                setShowEditPrompt={setShowEditPrompt}
                onDownload={handleDownload}
                onCopyUrl={handleCopyUrl}
                onClickImage={setSelectedResult}
                onFavorite={toggleFavorite}
                onDelete={deleteImage}
                onUpscale={(r) => {
                  setUpscaleImageUrl(r.imageUrl);
                  setUpscaleKey((k) => k + 1);
                  setActiveMode("upscale");
                  saveStorage(STORAGE_KEYS.mode, "upscale");
                }}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            )}
          </div>
        </div>

        {/* ================================================================
            RIGHT SIDE — Gallery (takes remaining ~72%)
            ================================================================ */}
        <main ref={galleryRef} className="relative hidden min-w-0 flex-1 flex-col lg:flex">
          {!hasAnyContent ? (
            /* Empty / loading state */
            <div className="flex flex-1 items-center justify-center pb-32">
              {generationsLoading ? (
                <div className="w-full p-4">
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="skeleton-shimmer rounded-lg"
                        style={{ aspectRatio: [1, 0.75, 1.33, 0.66, 1, 0.75, 1.33, 1, 0.66, 1, 0.75, 1.33][i] }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface">
                    <svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-muted/50">
                      <rect x="2" y="2" width="16" height="16" rx="3" />
                      <circle cx="7" cy="7" r="1.5" />
                      <path d="M2 14l4-4 3 3 4-4 5 5" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted/60">
                    Your generations will appear here
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted/50">
                    Write a prompt and hit Generate
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Gallery toolbar */}
              <GalleryToolbar
                totalCount={history.length}
                filteredCount={filteredHistory.length}
                galleryFilter={galleryFilter}
                onFilterChange={setGalleryFilter}
                galleryRowHeight={galleryRowHeight}
                onRowHeightChange={setGalleryRowHeight}
                gallerySizeStorageKey={STORAGE_KEYS.gallerySize}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectMode={selectMode}
                onToggleSelectMode={toggleSelectMode}
                selectedCount={selectedIds.size}
              />

              {/* Gallery content — extra bottom padding for floating prompt bar */}
              <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-28">
                {generationsLoading && history.length === 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="skeleton-shimmer rounded-lg"
                        style={{ aspectRatio: [1, 0.75, 1.33, 0.66, 1, 0.75, 1.33, 1, 0.66, 1, 0.75, 1.33][i] }}
                      />
                    ))}
                  </div>
                ) : (
                <GalleryGrid
                  results={filteredHistory}
                  latestBatchId={currentBatchId}
                  generatingSlots={generatingSlots}
                  isGenerating={isGenerating}
                  showEditPrompt={showEditPrompt}
                  editPromptValue={editPromptValue}
                  setEditPromptValue={setEditPromptValue}
                  error={error}
                  copiedId={copiedId}
                  targetRowHeight={galleryRowHeight}
                  slotAspectRatio={(() => { const [w, h] = aspectRatio.split(":").map(Number); return w && h ? w / h : 1; })()}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                  onEditSubmit={handleEditSubmit}
                  setShowEditPrompt={setShowEditPrompt}
                  onDownload={handleDownload}
                  onCopyUrl={handleCopyUrl}
                  onClickImage={setSelectedResult}
                  onFavorite={toggleFavorite}
                  onDelete={deleteImage}
                  onUpscale={(r) => {
                    setUpscaleImageUrl(r.imageUrl);
                    setUpscaleKey((k) => k + 1);
                    setActiveMode("upscale");
                    saveStorage(STORAGE_KEYS.mode, "upscale");
                  }}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
                )}
              </div>

            </div>
          )}

          {/* Bulk action bar (select mode) */}
          {selectMode && selectedIds.size > 0 && (
            <BulkActionBar
              selectedCount={selectedIds.size}
              totalCount={filteredHistory.length}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onDownload={bulkDownload}
              onDelete={bulkDelete}
              downloading={bulkDownloading}
            />
          )}

          {/* ============================================================
              FLOATING PROMPT BAR — overlays bottom of gallery
              ============================================================ */}
          {(IMAGE_MODES.find((m) => m.id === activeMode)?.hasPrompt !== false) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-5">
            <div
              className={`pointer-events-auto w-full max-w-2xl rounded-2xl border bg-background backdrop-blur-xl transition-all duration-300 ${
                promptBarDragOver
                  ? "border-accent shadow-[0_0_32px_rgba(161,252,223,0.15)]"
                  : "border-border/60 shadow-xl shadow-black/10 focus-within:border-accent/40 focus-within:shadow-[0_0_24px_rgba(161,252,223,0.06)]"
              }`}
              onDragOver={(e) => { e.preventDefault(); setPromptBarDragOver(true); }}
              onDragLeave={() => setPromptBarDragOver(false)}
              onDrop={handlePromptBarDrop}
            >
              {/* Reference image thumbnails — shown when images are attached */}
              {referenceImages.length > 0 && (
                <div className="flex items-center gap-2 px-4 pt-3">
                  {referenceImages.map((img) => (
                    <div key={img.id} className="group/ref relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt="Ref" className="h-full w-full object-cover" />
                      {img.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <div className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent" />
                        </div>
                      )}
                      <button
                        onClick={() => removeReferenceImage(img.id)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover/ref:opacity-100"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 1l6 6M7 1l-6 6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {referenceImages.length < maxImages && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 text-muted/50 transition hover:border-accent/40 hover:text-accent"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M7 2v10M2 7h10" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 140) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canGenerate) handleGenerate();
                  }
                }}
                placeholder={promptBarDragOver ? "Drop image to use as reference..." : "Describe your image..."}
                className="scrollbar-none block w-full resize-none overflow-y-auto bg-transparent px-4 pt-3.5 pb-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted"
                style={{ minHeight: "44px", maxHeight: "140px" }}
              />

              {/* Bottom bar — attach + hints left, generate right */}
              <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
                <div className="flex items-center gap-2">
                  {/* Add reference image — squared box with plus, consistent with rest of platform */}
                  {primaryModel.editVariant && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted/60 transition hover:border-accent/40 hover:text-accent"
                      title="Add reference image"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M6 1v10M1 6h10" />
                      </svg>
                    </button>
                  )}
                  <span className="select-none text-[10px] text-muted/40">
                    ↵ generate · ⇧↵ new line
                  </span>
                </div>
                <button
                  onClick={() => handleGenerate()}
                  disabled={!canGenerate}
                  className={`flex items-center gap-2 rounded-full py-2 pl-3.5 pr-4 text-xs font-semibold tracking-wide transition ${
                    canGenerate
                      ? "bg-accent text-black hover:bg-accent-hover"
                      : "cursor-not-allowed bg-surface-hover text-muted/50"
                  }`}
                  title="Generate (Enter)"
                >
                  <IconSparkle size={12} />
                  Generate
                  {estimatedCredits > 0 && (
                    <span className="flex items-center gap-1 opacity-60">
                      <CreditIcon size={10} /> {estimatedCredits}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>

      {/* Lightbox + Detail Sidebar */}
      {selectedResult && (
        <ImageLightbox
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          onFavorite={() => toggleFavorite(selectedResult.requestId)}
          onDownload={() => handleDownload(selectedResult)}
          onCopyUrl={() => handleCopyUrl(selectedResult)}
          onUseAsReference={() => {
            const editId = `img_${++imageIdCounter}`;
            const editImage: UploadedImage = {
              id: editId,
              preview: selectedResult.imageUrl,
              url: selectedResult.imageUrl,
              uploading: false,
            };
            setReferenceImages((prev) => [editImage, ...prev]);
          }}
          onDelete={() => deleteImage(selectedResult.requestId)}
          onAddToShots={() => { setSelectedResult(null); }}
          onUpscale={() => {
            setUpscaleImageUrl(selectedResult.imageUrl);
            setUpscaleKey((k) => k + 1);
            setSelectedResult(null);
            setActiveMode("upscale");
            saveStorage(STORAGE_KEYS.mode, "upscale");
          }}
          copied={copiedId === selectedResult.requestId}
          onPrev={() => {
            const idx = filteredHistory.findIndex((r) => r.requestId === selectedResult.requestId);
            if (idx < filteredHistory.length - 1) setSelectedResult(filteredHistory[idx + 1]);
          }}
          onNext={() => {
            const idx = filteredHistory.findIndex((r) => r.requestId === selectedResult.requestId);
            if (idx > 0) setSelectedResult(filteredHistory[idx - 1]);
          }}
          hasPrev={(() => { const idx = filteredHistory.findIndex((r) => r.requestId === selectedResult.requestId); return idx < filteredHistory.length - 1; })()}
          hasNext={(() => { const idx = filteredHistory.findIndex((r) => r.requestId === selectedResult.requestId); return idx > 0; })()}
        />
      )}

      {/* Insufficient credits modal */}
      <InsufficientCreditsModal
        open={creditsShortfall !== null}
        onClose={() => setCreditsShortfall(null)}
        required={creditsShortfall?.required}
        available={creditsShortfall?.available}
      />
    </div>
  );
}

// --- Image Lightbox with Detail Sidebar ---

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

function ImageLightbox({
  result,
  onClose,
  onFavorite,
  onDownload,
  onCopyUrl,
  onUseAsReference,
  onDelete,
  onAddToShots,
  onUpscale,
  copied,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  result: GenerationResult;
  onClose: () => void;
  onFavorite: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
  onUseAsReference: () => void;
  onDelete: () => void;
  onAddToShots: (imageUrl: string) => void;
  onUpscale: () => void;
  copied: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const [promptCopied, setPromptCopied] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ w: number; h: number; sizeKB: number | null }>({ w: result.width, h: result.height, sizeKB: null });
  const [showShotPicker, setShowShotPicker] = useState(false);
  const [sceneSearch, setSceneSearch] = useState("");

  // Keyboard navigation: arrows + escape
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

  // Load real dimensions + file size from the image itself
  useEffect(() => {
    // Reset file size but keep w/h from result to avoid layout shift
    setImageMeta({ w: result.width || 1024, h: result.height || 1024, sizeKB: null });
    const img = document.createElement("img");
    img.onload = () => {
      setImageMeta((prev) => ({ ...prev, w: img.naturalWidth, h: img.naturalHeight }));
    };
    img.src = result.imageUrl;

    // Fetch file size
    fetch(result.imageUrl, { method: "HEAD" }).then((res) => {
      const len = res.headers.get("content-length");
      if (len) setImageMeta((prev) => ({ ...prev, sizeKB: Math.round(Number(len) / 1024) }));
    }).catch(() => {});
  }, [result.imageUrl, result.width, result.height]);

  const createdDate = result.createdAt
    ? new Date(result.createdAt).toLocaleString()
    : null;

  // Load scenes from Supabase for the shot picker
  const [scenes, setScenes] = useState<{ id: string; name: string; shots: unknown[] }[]>([]);
  useEffect(() => {
    fetch("/api/scenes").then((r) => r.ok ? r.json() : []).then(setScenes).catch(() => {});
  }, []);

  const sizeLabel = imageMeta.w && imageMeta.h ? `${imageMeta.w} × ${imageMeta.h}` : null;
  const fileSizeLabel = imageMeta.sizeKB != null
    ? imageMeta.sizeKB >= 1024 ? `${(imageMeta.sizeKB / 1024).toFixed(1)} MB` : `${imageMeta.sizeKB} KB`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Left — image + floating toolbar */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-8">
        {/* Prev arrow */}
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
        {/* Next arrow */}
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
        {/* Image / Video */}
        <div onClick={(e) => e.stopPropagation()}>
          {result.type === "video" ? (
            <video
              src={result.imageUrl}
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
              controls
              autoPlay
              loop
              playsInline
            />
          ) : (
            <img // eslint-disable-line @next/next/no-img-element
              src={result.imageUrl}
              alt="Preview"
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          )}
        </div>

        {/* Floating toolbar — below image */}
        <div
          className="relative mt-4 flex items-center gap-1 rounded-2xl bg-black/50 px-2 py-1 shadow-lg ring-1 ring-white/15 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <LightboxToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3v9M5 8l4 4 4-4" /><path d="M3 14h12" />
              </svg>
            }
            label="Save"
            onClick={onDownload}
          />
          <LightboxToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="14" height="14" rx="2" /><path d="M9 6v6M6 9h6" />
              </svg>
            }
            label="Reference"
            onClick={() => { onUseAsReference(); onClose(); }}
          />
          <LightboxToolbarButton
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l4-4 3 3 5-5" /><path d="M11 5h4v4" />
              </svg>
            }
            label="Upscale"
            onClick={onUpscale}
          />
          <div className="mx-1 h-6 w-px bg-white/10" />
          {/* Add to Shots */}
          <div className="relative">
            <LightboxToolbarButton
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="16" height="12" rx="2" /><path d="M6 3V1.5h6V3" /><path d="M9 7v4M7 9h4" />
                </svg>
              }
              label="Add to Shots"
              onClick={() => { setShowShotPicker(!showShotPicker); setSceneSearch(""); }}
            />
            {/* Scene picker dropdown */}
            {showShotPicker && (
              <div className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#1a1a1a] p-2 shadow-2xl">
                <span className="mb-1.5 block px-2 text-[10px] font-medium uppercase tracking-wider text-white/40">Choose a scene</span>
                {/* Search — shows when 5+ scenes */}
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
                {/* New Scene — always available */}
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
                    // Fire-and-forget save to Supabase
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
                {/* Existing scenes */}
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
                            // Fire-and-forget save to Supabase
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

      {/* Right sidebar — history/info panel */}
      <div
        className="flex w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — model + close */}
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

        {/* Scrollable content */}
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
            <button onClick={onCopyUrl} className="rounded-md p-1.5 text-white/50 transition hover:text-white" title="Copy image URL">
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
            <span className="mb-2.5 block text-[10px] font-medium uppercase tracking-wider text-white/40">Image Info</span>
            <div className="space-y-2">
              {sizeLabel && <LightboxRow label="Dimensions" value={sizeLabel} />}
              {fileSizeLabel && <LightboxRow label="File Size" value={fileSizeLabel} />}
              {result.settings && (
                <>
                  {result.settings.aspectRatio && <LightboxRow label="Aspect Ratio" value={result.settings.aspectRatio} />}
                  {result.settings.resolution && <LightboxRow label="Resolution" value={result.settings.resolution.toUpperCase()} />}
                </>
              )}
              {result.seed != null && (
                <LightboxRow label="Seed" value={String(result.seed)} />
              )}
              {createdDate && (
                <LightboxRow label="Created" value={createdDate} />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
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

// --- Justified Row Gallery ---

interface GalleryItem {
  type: "result";
  result: GenerationResult;
  aspectRatio: number;
}

interface GallerySlot {
  type: "slot";
  slotId: string;
  modelId: string;
  modelName: string;
  aspectRatio: number;
}

type GalleryEntry = GalleryItem | GallerySlot;

// Base height tiers based on dominant orientation
const ROW_HEIGHT_LANDSCAPE = 160;
const ROW_HEIGHT_SQUARE = 210;
const ROW_HEIGHT_PORTRAIT = 300;

function getDominantHeight(row: GalleryEntry[], scale: number): number {
  let portrait = 0;
  let landscape = 0;
  let square = 0;
  for (const e of row) {
    const ar = e.aspectRatio;
    if (ar < 0.85) portrait++;
    else if (ar > 1.2) landscape++;
    else square++;
  }
  let base: number;
  if (portrait >= landscape && portrait >= square) base = ROW_HEIGHT_PORTRAIT;
  else if (landscape >= portrait && landscape >= square) base = ROW_HEIGHT_LANDSCAPE;
  else base = ROW_HEIGHT_SQUARE;
  return base * scale;
}

function buildJustifiedRows(
  items: GalleryEntry[],
  containerWidth: number,
  scale: number,
  gap: number
): GalleryEntry[][] {
  if (containerWidth <= 0 || items.length === 0) return [];

  const rows: GalleryEntry[][] = [];
  let currentRow: GalleryEntry[] = [];

  for (const item of items) {
    currentRow.push(item);

    const totalGap = (currentRow.length - 1) * gap;
    const availableWidth = containerWidth - totalGap;
    const totalAR = currentRow.reduce((sum, e) => sum + e.aspectRatio, 0);
    const rowHeight = availableWidth / totalAR;

    const targetHeight = getDominantHeight(currentRow, scale);

    if (rowHeight <= targetHeight) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

function GalleryGrid({
  results,
  latestBatchId,
  generatingSlots,
  isGenerating,
  showEditPrompt,
  editPromptValue,
  setEditPromptValue,
  error,
  copiedId,
  targetRowHeight,
  slotAspectRatio,
  onRegenerate,
  onEdit,
  onEditSubmit,
  setShowEditPrompt,
  onDownload,
  onCopyUrl,
  onClickImage,
  onFavorite,
  onDelete,
  onUpscale,
  selectMode,
  selectedIds,
  onToggleSelect,
}: {
  results: GenerationResult[];
  latestBatchId: string | null;
  generatingSlots: { modelName: string; modelId: string; slotId: string }[];
  isGenerating: boolean;
  showEditPrompt: boolean;
  editPromptValue: string;
  setEditPromptValue: (v: string) => void;
  error: string | null;
  copiedId: string | null;
  targetRowHeight: number;
  slotAspectRatio: number;
  onRegenerate: () => void;
  onEdit: () => void;
  onEditSubmit: () => void;
  setShowEditPrompt: (v: boolean) => void;
  onDownload: (r: GenerationResult) => void;
  onCopyUrl: (r: GenerationResult) => void;
  onClickImage: (r: GenerationResult) => void;
  onFavorite: (requestId: string) => void;
  onDelete: (requestId: string) => void;
  onUpscale?: (r: GenerationResult) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (requestId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // Cache detected aspect ratios by URL (populated by img onLoad)
  const [arCache, setArCache] = useState<Record<string, number>>({});
  const arCacheRef = useRef(arCache);
  arCacheRef.current = arCache;
  // Track which URLs have finished loading (survives filter switches)
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());
  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => { if (prev.has(url)) return prev; const next = new Set(prev); next.add(url); return next; });
  }, []);

  const onImageLoad = useCallback((url: string, naturalW: number, naturalH: number) => {
    if (naturalW > 0 && naturalH > 0 && !arCacheRef.current[url]) {
      setArCache((prev) => ({ ...prev, [url]: naturalW / naturalH }));
    }
  }, []);

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

  const latestIds = new Set(
    latestBatchId ? results.filter((r) => r.batchId === latestBatchId).map((r) => r.requestId) : []
  );
  const hasLatestBatch = latestIds.size > 0;
  const gap = 6;

  // Build gallery entries: slots first, then results in stable history order
  const entries: GalleryEntry[] = [
    ...generatingSlots.map((slot): GallerySlot => ({
      type: "slot",
      slotId: slot.slotId,
      modelId: slot.modelId,
      modelName: slot.modelName,
      aspectRatio: slotAspectRatio,
    })),
    ...results.map((r): GalleryItem => {
      // 1. Cached natural dimensions from img onLoad
      let ar = arCache[r.imageUrl];
      // 2. DB dimensions
      if (!ar && r.width && r.height) {
        ar = r.width / r.height;
      }
      // 3. Settings aspect ratio string (e.g. "16:9")
      if (!ar && r.settings?.aspectRatio) {
        const [w, h] = r.settings.aspectRatio.split(":").map(Number);
        if (w && h) ar = w / h;
      }
      // 4. Default: 16:9 for video, 1:1 for image
      if (!ar) ar = r.type === "video" ? 16 / 9 : 1;
      return { type: "result", result: r, aspectRatio: ar };
    }),
  ];

  const allRows = buildJustifiedRows(entries, containerWidth, targetRowHeight, gap);

  // Progressive rendering — mount first INITIAL_ROWS, reveal more on scroll
  const INITIAL_ROWS = 8;
  const ROWS_PER_BATCH = 6;
  const [visibleRowCount, setVisibleRowCount] = useState(INITIAL_ROWS);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleRowCount(INITIAL_ROWS); }, [allRows.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleRowCount >= allRows.length) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleRowCount((prev) => Math.min(prev + ROWS_PER_BATCH, allRows.length)); },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [visibleRowCount, allRows.length]);

  const rows = allRows.slice(0, visibleRowCount);

  return (
    <div ref={containerRef} className="overflow-hidden">
      {/* Status bar */}
      {(isGenerating || error || (!isGenerating && hasLatestBatch)) && (
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
          {!isGenerating && hasLatestBatch && (
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
      {showEditPrompt && hasLatestBatch && (
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
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
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
            const totalGap = (row.length - 1) * gap;
            const availableWidth = containerWidth - totalGap;
            const totalAR = row.reduce((sum, e) => sum + e.aspectRatio, 0);
            const justifiedHeight = availableWidth / totalAR;
            const dominantHeight = getDominantHeight(row, targetRowHeight);
            const isLastRow = rowIdx === rows.length - 1;
            const rowHeight = (isLastRow && row.length <= 2 && justifiedHeight > dominantHeight * 1.5)
              ? dominantHeight
              : justifiedHeight;

            return (
              <div key={rowIdx} className="flex" style={{ gap, height: rowHeight }}>
                {row.map((entry) => {
                  if (entry.type === "slot") {
                    return (
                      <div
                        key={entry.slotId}
                        className="relative min-w-0 overflow-hidden rounded-lg"
                        style={{ flex: `1 1 ${rowHeight * entry.aspectRatio}px`, height: rowHeight }}
                      >
                        <div className="absolute inset-0 skeleton-shimmer" />
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent/[0.07] to-transparent" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <div className="h-6 w-24 skeleton-shimmer rounded-md" />
                          <span className="animate-pulse text-[10px] font-medium text-muted/50">
                            {entry.modelName}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const r = entry.result;
                  const isLatest = latestIds.has(r.requestId);

                  return (
                    <div
                      key={r.requestId}
                      className="min-w-0"
                      style={{ flex: `1 1 ${rowHeight * entry.aspectRatio}px`, height: rowHeight }}
                    >
                      <GalleryCard
                        result={r}
                        isFeatured={isLatest}
                        onDownload={() => onDownload(r)}
                        onCopyUrl={() => onCopyUrl(r)}
                        onEdit={onEdit}
                        onRegenerate={onRegenerate}
                        onFavorite={() => onFavorite(r.requestId)}
                        onDelete={() => onDelete(r.requestId)}
                        onUpscale={onUpscale ? () => onUpscale(r) : undefined}
                        onClick={() => onClickImage(r)}
                        copied={copiedId === r.requestId}
                        onImageLoad={onImageLoad}
                        isLoaded={loadedUrls.has(r.imageUrl)}
                        onMediaLoaded={markLoaded}
                        selectMode={selectMode}
                        selected={selectedIds?.has(r.requestId)}
                        onToggleSelect={() => onToggleSelect?.(r.requestId)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {visibleRowCount < allRows.length && (
        <div ref={sentinelRef} className="h-px" />
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { fal } from "@fal-ai/client";
import { type VideoModelConfig, VIDEO_MODELS, getCreateModels, getMotionControlModels, getRelightModels, videoModelsToSelectorItems } from "@/lib/video-models";
import { loadStorage, saveStorage } from "@/lib/storage";
import { trackVideoGenerated } from "@/lib/analytics";
import { Navbar } from "@/components/Navbar";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { ModelSelector, CreditIcon } from "@/components/ModelSelector";
import { SectionLabel, PillButton } from "@/components/generate/SidebarWidgets";
import { GalleryGrid } from "@/components/generate/GalleryGrid";
import { GalleryToolbar, type GalleryFilter } from "@/components/generate/GalleryToolbar";
import { BulkActionBar } from "@/components/generate/BulkActionBar";
import { MediaLightbox } from "@/components/generate/MediaLightbox";
import { IconBolt, IconChevron, IconUpscale, IconVideo, IconMotion, IconRelight } from "@/components/generate/Icons";
import { ModeBar, ModeComingSoon, type ModeConfig } from "@/components/generate/ModeBar";
import { DesktopOnlyBanner } from "@/components/DesktopOnlyBanner";
import { useGenerations, type Generation } from "@/hooks/useGenerations";
import { usePricing, tierKey } from "@/hooks/usePricing";
import { invalidateCredits } from "@/hooks/useCredits";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import { generationToResult, type GenerationResult, type UploadedImage } from "@/types/generations";

fal.config({ proxyUrl: "/api/fal/proxy" });

// --- Storage keys ---

const STORAGE_KEYS: Record<string, string> = {
  activeMode: "dreamsun_vid_mode",
  videoModel: "dreamsun_vid_model",
  mcModel: "dreamsun_vid_mc_model",
  duration: "dreamsun_vid_duration",
  aspectRatio: "dreamsun_vid_ratio",
  resolution: "dreamsun_vid_resolution",
  cameraFixed: "dreamsun_vid_camera_fixed",
  generateAudio: "dreamsun_vid_gen_audio",
  gallerySize: "dreamsun_vid_gallery_size",
  charOrientation: "dreamsun_vid_char_orient",
  prompt: "dreamsun_vid_prompt",
  pending: "dreamsun_vid_pending",
  firstFrameUrl: "dreamsun_vid_first_frame",
  lastFrameUrl: "dreamsun_vid_last_frame",
  refVideoUrl: "dreamsun_vid_ref_video",
  rlModel: "dreamsun_vid_rl_model",
  rlCondType: "dreamsun_vid_rl_cond",
  rlDirection: "dreamsun_vid_rl_dir",
  rlCfg: "dreamsun_vid_rl_cfg",
  rlVideoUrl: "dreamsun_vid_rl_video",
  rlPrompt: "dreamsun_vid_rl_prompt",
} as const;

// --- Pending generation (survives refresh) ---

interface PendingVideoGeneration {
  slotId: string;
  modelName: string;
  modelId: string;
  prompt: string;
  batchId: string;
  mode: VideoMode;
  createdAt: number;
}

// --- Video modes ---

type VideoMode = "create" | "motion" | "relight";

const VIDEO_MODES: ModeConfig[] = [
  {
    id: "create",
    label: "Create",
    icon: <IconVideo size={12} />,
    description: "Image to video generation",
    ready: true,
  },
  {
    id: "motion",
    label: "Motion Control",
    icon: <IconMotion size={12} />,
    description: "Transfer motion from reference video",
    ready: true,
    hasPrompt: false,
  },
  {
    id: "relight",
    label: "Relight",
    icon: <IconRelight size={12} />,
    description: "Change lighting on any video",
    ready: true,
    hasPrompt: false,
  },
];

// --- Helpers ---

let imageIdCounter = 0;
let batchIdCounter = 0;

// --- Upload zone (image or video) ---

function UploadZone({ file, onRemove, onUpload, inputRef, label, dragOver, setDragOver, onDrop, accept, isVideo, compact }: {
  file: UploadedImage | null;
  onRemove: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  accept?: string;
  isVideo?: boolean;
  compact?: boolean;
}) {
  const h = compact ? "h-24" : "h-32";
  return (
    <div className={compact ? "min-w-0 flex-1" : ""}>
      <SectionLabel>{label}</SectionLabel>
      <div
        className={`relative rounded-lg transition ${dragOver ? "ring-1 ring-accent/30" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e) => { setDragOver(false); onDrop(e); }}
      >
        {file ? (
          <div className={`group relative ${h} w-full overflow-hidden rounded-lg border border-border`}>
            {isVideo ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={file.preview} className="h-full w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.preview} alt={label} className="h-full w-full object-cover" />
            )}
            {file.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            )}
            <button
              onClick={onRemove}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h10M5 4V2.5h4V4M3 4l.7 8.1c.1.8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4L11 4" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className={`flex ${h} w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed transition ${
              dragOver
                ? "border-accent bg-accent/10 text-accent-text"
                : "border-border text-muted hover:border-accent/40 hover:text-accent"
            }`}
          >
            <svg width={compact ? "18" : "24"} height={compact ? "18" : "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-[10px] font-medium">
              {dragOver ? (isVideo ? "Drop video" : "Drop image") : (isVideo ? "Upload or drag video" : "Upload or drag")}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? "image/png,image/jpeg,image/webp"}
        onChange={onUpload}
        className="hidden"
      />
    </div>
  );
}

// --- Page ---

const VALID_VIDEO_MODES: VideoMode[] = ["create", "motion", "relight"];

export default function VideoPage() {
  const [activeMode, setActiveModeRaw] = useState<VideoMode>(() => {
    if (typeof window === "undefined") return "create";
    const urlMode = new URLSearchParams(window.location.search).get("mode") as VideoMode | null;
    if (urlMode && VALID_VIDEO_MODES.includes(urlMode)) return urlMode;
    return loadStorage(STORAGE_KEYS.activeMode, "create") as VideoMode;
  });

  // Model — separate for each mode
  const [createModelId, setCreateModelId] = useState(() =>
    loadStorage(STORAGE_KEYS.videoModel, "seedance-1-5-pro")
  );
  const [mcModelId, setMcModelId] = useState(() =>
    loadStorage(STORAGE_KEYS.mcModel, "kling-3-mc-standard")
  );

  // Create mode settings
  const [duration, setDuration] = useState(() =>
    loadStorage(STORAGE_KEYS.duration, 5)
  );
  const [aspectRatio, setAspectRatio] = useState(() =>
    loadStorage(STORAGE_KEYS.aspectRatio, "16:9")
  );
  const [resolution, setResolution] = useState(() =>
    loadStorage(STORAGE_KEYS.resolution, "720p")
  );
  const [cameraFixed, setCameraFixed] = useState(() =>
    loadStorage(STORAGE_KEYS.cameraFixed, false)
  );
  const [generateAudio, setGenerateAudio] = useState(() =>
    loadStorage(STORAGE_KEYS.generateAudio, false)
  );

  // Motion control settings
  const [charOrientation, setCharOrientation] = useState<string>(() =>
    loadStorage(STORAGE_KEYS.charOrientation, "video")
  );
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);

  // Relight settings
  const [rlModelId, setRlModelId] = useState(() =>
    loadStorage(STORAGE_KEYS.rlModel, "lightx-relight")
  );
  const [rlCondType, setRlCondType] = useState<string>(() =>
    loadStorage(STORAGE_KEYS.rlCondType, "ic")
  );
  const [rlDirection, setRlDirection] = useState<string>(() =>
    loadStorage(STORAGE_KEYS.rlDirection, "Left")
  );
  const [rlCfg, setRlCfg] = useState<number>(() =>
    loadStorage(STORAGE_KEYS.rlCfg, 2)
  );
  const [rlPromptText, setRlPromptText] = useState<string>(() =>
    loadStorage(STORAGE_KEYS.rlPrompt, "Sunlight")
  );
  const [rlVideo, setRlVideoRaw] = useState<UploadedImage | null>(null);
  const [rlCondImage, setRlCondImage] = useState<UploadedImage | null>(null);
  const [rlVideoDragOver, setRlVideoDragOver] = useState(false);
  const [rlCondDragOver, setRlCondDragOver] = useState(false);
  const rlVideoInputRef = useRef<HTMLInputElement>(null);
  const rlCondInputRef = useRef<HTMLInputElement>(null);

  const setRlVideo = useCallback((img: UploadedImage | null) => {
    setRlVideoRaw(img);
    saveStorage(STORAGE_KEYS.rlVideoUrl, img?.url ?? null);
    if (img?.duration) saveStorage("dreamsun_vid_rl_dur", img.duration);
  }, []);

  // Restore relight video from localStorage with duration
  const rlRestoredRef = useRef(false);
  useEffect(() => {
    if (rlRestoredRef.current) return;
    rlRestoredRef.current = true;
    const url = loadStorage<string | null>(STORAGE_KEYS.rlVideoUrl, null);
    if (!url) return;
    const savedDur = loadStorage<number>("dreamsun_vid_rl_dur", 0);
    setRlVideoRaw({ id: "restored_rl", preview: url, url, uploading: false, duration: savedDur || undefined });
  }, []);

  // Wrapped setters that persist to localStorage
  const setActiveMode = useCallback((mode: VideoMode) => {
    setActiveModeRaw(mode);
    saveStorage(STORAGE_KEYS.activeMode, mode);
  }, []);

  const setFirstFrame = useCallback((img: UploadedImage | null) => {
    setFirstFrameRaw(img);
    saveStorage(STORAGE_KEYS.firstFrameUrl, img?.url ?? null);
  }, []);

  const setLastFrame = useCallback((img: UploadedImage | null) => {
    setLastFrameRaw(img);
    saveStorage(STORAGE_KEYS.lastFrameUrl, img?.url ?? null);
  }, []);

  const setRefVideo = useCallback((img: UploadedImage | null) => {
    setRefVideoRaw(img);
    saveStorage(STORAGE_KEYS.refVideoUrl, img?.url ?? null);
    if (img?.duration) saveStorage("dreamsun_vid_mc_dur", img.duration);
  }, []);

  // Generation state
  const [prompt, setPromptRaw] = useState(() => loadStorage(STORAGE_KEYS.prompt, ""));
  const [negativePrompt, setNegativePrompt] = useState("");

  // Debounced prompt save
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPrompt = useCallback((value: string) => {
    setPromptRaw(value);
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => saveStorage(STORAGE_KEYS.prompt, value), 500);
  }, []);
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [firstFrame, setFirstFrameRaw] = useState<UploadedImage | null>(() => {
    const url = loadStorage<string | null>(STORAGE_KEYS.firstFrameUrl, null);
    return url ? { id: "restored_first", preview: url, url, uploading: false } : null;
  });
  const [lastFrame, setLastFrameRaw] = useState<UploadedImage | null>(() => {
    const url = loadStorage<string | null>(STORAGE_KEYS.lastFrameUrl, null);
    return url ? { id: "restored_last", preview: url, url, uploading: false } : null;
  });
  const [refVideo, setRefVideoRaw] = useState<UploadedImage | null>(() => {
    const url = loadStorage<string | null>(STORAGE_KEYS.refVideoUrl, null);
    if (!url) return null;
    const savedDur = loadStorage<number>("dreamsun_vid_mc_dur", 0);
    return { id: "restored_ref", preview: url, url, uploading: false, duration: savedDur || undefined };
  });
  const [generatingSlots, setGeneratingSlots] = useState<{ modelName: string; modelId: string; slotId: string }[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creditsShortfall, setCreditsShortfall] = useState<{ required: number; available: number } | null>(null);

  // Multi-shot storyboarding
  const [multiShotEnabled, setMultiShotEnabled] = useState(false);
  const [shots, setShots] = useState<{ prompt: string; duration: number }[]>([
    { prompt: "", duration: 5 },
    { prompt: "", duration: 5 },
  ]);

  // Elements (character consistency)
  const [elements, setElements] = useState<(UploadedImage | null)[]>([null, null, null]);
  const [elementDragOver, setElementDragOver] = useState<number | null>(null);
  const elementInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Gallery state
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("videos");
  const [searchQuery, setSearchQuery] = useState("");
  const [galleryRowHeight, setGalleryRowHeight] = useState(() =>
    loadStorage(STORAGE_KEYS.gallerySize, 1.0)
  );
  const [selectedResult, setSelectedResult] = useState<GenerationResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPromptValue, setEditPromptValue] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [firstDragOver, setFirstDragOver] = useState(false);
  const [lastDragOver, setLastDragOver] = useState(false);
  const [refVideoDragOver, setRefVideoDragOver] = useState(false);
  const [promptBarDragOver, setPromptBarDragOver] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const lastInputRef = useRef<HTMLInputElement>(null);
  const refVideoInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Supabase generations
  const {
    generations: dbGenerations,
    loading: generationsLoading,
    addGenerations: addDbGenerations,
    updateGeneration: updateDbGeneration,
    toggleFavorite: dbToggleFavorite,
    deleteGeneration: dbDeleteGeneration,
    deleteGenerations: dbDeleteGenerations,
  } = useGenerations();

  const history = useMemo(
    () => dbGenerations.map(generationToResult),
    [dbGenerations]
  );

  const { pricing, creditRanges } = usePricing();

  const isGenerating = generatingSlots.length > 0;

  // Poll a pending generation until it completes or fails
  const pollGeneration = useCallback(async (genId: string, slotId: string) => {
    const POLL_INTERVAL = 5000;
    const MAX_POLLS = 120; // 10 minutes max
    let polls = 0;

    while (polls < MAX_POLLS) {
      polls++;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      try {
        const res = await fetch(`/api/generation-poll?id=${genId}`);
        const data = await res.json();

        if (data.status === "completed" && data.url) {
          updateDbGeneration(genId, { url: data.url });
          invalidateCredits();
          setGeneratingSlots((prev) => prev.filter((s) => s.slotId !== slotId));
          return;
        }

        if (data.status === "failed") {
          // Update the generation in local state to show error card (DB already updated by poll endpoint)
          updateDbGeneration(genId, { url: "error" });
          invalidateCredits();
          setGeneratingSlots((prev) => prev.filter((s) => s.slotId !== slotId));
          return;
        }
      } catch {
        // Network error — keep trying
      }
    }

    setError("Generation timed out — it may still complete. Refresh to check.");
    setGeneratingSlots((prev) => prev.filter((s) => s.slotId !== slotId));
  }, [updateDbGeneration]);

  // Resume polling for pending generations on page load
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || generationsLoading) return;
    resumedRef.current = true;

    // Find pending generations (url=null) from Supabase
    const pendingGens = dbGenerations.filter((g) => !g.url && g.type === "video");
    if (pendingGens.length === 0) return;

    // Filter out stale ones (older than 15 minutes)
    const fresh = pendingGens.filter((g) => {
      const age = Date.now() - new Date(g.created_at).getTime();
      return age < 15 * 60 * 1000;
    });

    if (fresh.length === 0) return;

    // Create generating slots and start polling for each
    const newSlots = fresh.map((g) => ({
      modelName: g.model_name ?? g.model_id,
      modelId: g.model_id,
      slotId: `resume_${g.id}`,
    }));
    setGeneratingSlots((prev) => [...newSlots, ...prev]);

    fresh.forEach((g) => {
      pollGeneration(g.id, `resume_${g.id}`);
    });

    console.log(`[video] Resumed polling for ${fresh.length} pending generation(s)`);
  }, [generationsLoading, dbGenerations, pollGeneration]);

  // Model lists — selector shows ALL models, grouped by type
  const createModels = useMemo(() => getCreateModels(), []);
  const mcModels = useMemo(() => getMotionControlModels(), []);
  const rlModels = useMemo(() => getRelightModels(), []);
  const activeSelectorItems = useMemo(() => {
    const models = activeMode === "create" ? createModels : activeMode === "relight" ? rlModels : mcModels;
    return videoModelsToSelectorItems(models);
  }, [activeMode, createModels, mcModels, rlModels]);

  const selectedModelId = activeMode === "create" ? createModelId : activeMode === "relight" ? rlModelId : mcModelId;
  const activeModels = activeMode === "create" ? createModels : activeMode === "relight" ? rlModels : mcModels;
  const currentModel = activeModels.find((m) => m.id === selectedModelId) ?? activeModels[0];

  // Create mode: does current model support last frame?
  const supportsLastFrame = activeMode === "create" && !!currentModel.params.endImageUrl;

  // Ensure selected model is valid for current mode
  useEffect(() => {
    if (activeMode === "create" && !createModels.find((m) => m.id === createModelId)) {
      setCreateModelId(createModels[0].id);
    }
    if (activeMode === "motion" && !mcModels.find((m) => m.id === mcModelId)) {
      setMcModelId(mcModels[0].id);
    }
    if (activeMode === "relight" && !rlModels.find((m) => m.id === rlModelId)) {
      setRlModelId(rlModels[0].id);
    }
  }, [activeMode, createModelId, mcModelId, rlModelId, createModels, mcModels, rlModels]);

  // Ensure duration is valid for current model
  useEffect(() => {
    if (currentModel.durations.length > 0 && !currentModel.durations.includes(duration)) {
      setDuration(currentModel.defaultDuration);
    }
  }, [currentModel, duration]);

  // Ensure aspect ratio is valid
  useEffect(() => {
    if (currentModel.aspectRatios.length > 0 && !currentModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(currentModel.aspectRatios[0]);
    }
  }, [currentModel, aspectRatio]);

  // Ensure resolution is valid
  useEffect(() => {
    if (currentModel.resolutions.length > 0 && !currentModel.resolutions.includes(resolution)) {
      setResolution(currentModel.defaultResolution);
    }
  }, [currentModel, resolution]);

  // Reset multi-shot & elements when switching to a model that doesn't support them
  useEffect(() => {
    if (!currentModel.supportsMultiShot) {
      setMultiShotEnabled(false);
      setShots([{ prompt: "", duration: 5 }, { prompt: "", duration: 5 }]);
    }
    if (!currentModel.supportsElements) {
      setElements([null, null, null]);
    }
  }, [currentModel]);

  // Multi-shot total duration
  const multiShotTotalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  const maxModelDuration = currentModel.durations.length > 0 ? currentModel.durations[currentModel.durations.length - 1] : 15;

  // Estimated credit cost for current generation
  const estimatedVidCredits = useMemo(() => {
    const audioTier = currentModel.supportsGenerateAudio ? (generateAudio ? "on" : "off") : null;
    const key = tierKey(currentModel.id, resolution, audioTier);
    const unitCost = pricing[key]?.base_price_credits ?? pricing[currentModel.id]?.base_price_credits ?? 0;
    if (unitCost === 0) return 0;
    if (activeMode === "relight") {
      const rlDur = rlVideo?.duration ?? 0;
      return rlDur > 0 ? Math.round(unitCost * rlDur) : 0;
    }
    if (activeMode === "motion") {
      const mcDur = refVideo?.duration ?? 0;
      return mcDur > 0 ? Math.round(unitCost * mcDur) : 0;
    }
    const effectiveDuration = multiShotEnabled ? multiShotTotalDuration : duration;
    return Math.round(unitCost * effectiveDuration);
  }, [pricing, currentModel.id, currentModel.supportsGenerateAudio, duration, resolution, generateAudio, multiShotEnabled, multiShotTotalDuration, activeMode, rlVideo?.duration, refVideo?.duration]);

  // Filter gallery — memoized to avoid recalculating on every render
  const filteredHistory = useMemo(() => {
    let filtered = history.filter((r) => !r.pending);
    if (galleryFilter === "loved") {
      filtered = filtered.filter((r) => r.favorited);
    } else if (galleryFilter === "videos") {
      filtered = filtered.filter((r) => r.type === "video");
    } else if (galleryFilter === "images") {
      filtered = filtered.filter((r) => !r.type || r.type === "image");
    } else if (galleryFilter === "audio") {
      filtered = filtered.filter((r) => r.type === "audio");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.prompt?.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [history, galleryFilter, searchQuery]);

  const latestBatch = currentBatchId
    ? filteredHistory.filter((r) => r.batchId === currentBatchId)
    : [];

  // --- Helpers ---

  /** Read duration from a video file via a hidden <video> element */
  const getVideoDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const dur = Math.ceil(video.duration);
        URL.revokeObjectURL(video.src);
        resolve(dur);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0);
      };
      video.src = URL.createObjectURL(file);
    });
  }, []);

  /** Read duration from a video URL via a hidden <video> element */
  const getVideoUrlDuration = useCallback((url: string): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.crossOrigin = "anonymous";
      video.onloadedmetadata = () => {
        resolve(Math.ceil(video.duration));
      };
      video.onerror = () => resolve(0);
      video.src = url;
    });
  }, []);

  /** Upload a video file and read its duration */
  const uploadVideo = useCallback(async (file: File, setter: (img: UploadedImage | null) => void) => {
    const id = `vid_${++imageIdCounter}`;
    const preview = URL.createObjectURL(file);
    const dur = await getVideoDuration(file);
    setter({ id, preview, url: null, uploading: true, duration: dur });
    try {
      const url = await fal.storage.upload(file);
      setter({ id, preview, url, uploading: false, duration: dur });
    } catch (err) {
      setter(null);
      setError(`Upload failed: ${err instanceof Error ? err.message : "Network error"}`);
    }
  }, [getVideoDuration]);

  // --- Image upload handlers ---

  const uploadImage = useCallback(async (file: File, setter: (img: UploadedImage | null) => void) => {
    const id = `img_${++imageIdCounter}`;
    const preview = URL.createObjectURL(file);
    setter({ id, preview, url: null, uploading: true });
    try {
      const url = await fal.storage.upload(file);
      setter({ id, preview, url, uploading: false });
    } catch (err) {
      setter(null);
      setError(`Upload failed: ${err instanceof Error ? err.message : "Network error"}`);
    }
  }, []);

  const handleFirstUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, setFirstFrame);
    if (firstInputRef.current) firstInputRef.current.value = "";
  }, [uploadImage]);

  const handleLastUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, setLastFrame);
    if (lastInputRef.current) lastInputRef.current.value = "";
  }, [uploadImage]);

  const handleImageDrop = useCallback(async (e: React.DragEvent, setter: (img: UploadedImage | null) => void) => {
    e.preventDefault();
    e.stopPropagation();

    const imageUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (imageUrl && imageUrl.startsWith("http") && /\.(png|jpe?g|webp)/i.test(imageUrl)) {
      const id = `img_${++imageIdCounter}`;
      setter({ id, preview: imageUrl, url: imageUrl, uploading: false });
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadImage(file, setter);
    }
  }, [uploadImage]);

  const handlePromptBarDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setPromptBarDragOver(false);

    const imageUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (imageUrl && imageUrl.startsWith("http") && /\.(png|jpe?g|webp)/i.test(imageUrl)) {
      const id = `img_${++imageIdCounter}`;
      setFirstFrame({ id, preview: imageUrl, url: imageUrl, uploading: false });
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadImage(file, setFirstFrame);
    }
  }, [uploadImage]);

  // --- Element upload handlers ---

  const handleElementUpload = useCallback((index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setter = (img: UploadedImage | null) => {
      setElements((prev) => { const next = [...prev]; next[index] = img; return next; });
    };
    uploadImage(file, setter);
    if (elementInputRefs[index].current) elementInputRefs[index].current!.value = "";
  }, [uploadImage, elementInputRefs]);

  const handleElementDrop = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setElementDragOver(null);

    const imageUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (imageUrl && imageUrl.startsWith("http") && /\.(png|jpe?g|webp)/i.test(imageUrl)) {
      const id = `img_${++imageIdCounter}`;
      setElements((prev) => { const next = [...prev]; next[index] = { id, preview: imageUrl, url: imageUrl, uploading: false }; return next; });
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const setter = (img: UploadedImage | null) => {
        setElements((prev) => { const next = [...prev]; next[index] = img; return next; });
      };
      uploadImage(file, setter);
    }
  }, [uploadImage]);

  const removeElement = useCallback((index: number) => {
    setElements((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]!.preview);
      next[index] = null;
      return next;
    });
  }, []);

  // --- Shot helpers ---

  const addShot = useCallback(() => {
    setShots((prev) => prev.length < 6 ? [...prev, { prompt: "", duration: 5 }] : prev);
  }, []);

  const removeShot = useCallback((index: number) => {
    setShots((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const updateShotPrompt = useCallback((index: number, prompt: string) => {
    setShots((prev) => prev.map((s, i) => i === index ? { ...s, prompt } : s));
  }, []);

  const updateShotDuration = useCallback((index: number, duration: number) => {
    setShots((prev) => prev.map((s, i) => i === index ? { ...s, duration } : s));
  }, []);

  // --- Generation (queue-based) ---

  const handleGenerate = async (overridePrompt?: string) => {
    const usedPrompt = overridePrompt ?? prompt;
    if (activeMode === "relight") {
      if (!rlVideo?.url) {
        setError("Upload a video to relight");
        return;
      }
    } else if (!firstFrame?.url) {
      setError("Reference image is required");
      return;
    }
    if (activeMode === "motion" && !refVideo?.url) {
      setError("Reference video is required for motion control");
      return;
    }

    setError(null);
    setShowEditPrompt(false);

    const batchId = `batch_${++batchIdCounter}`;
    setCurrentBatchId(batchId);

    const slotId = `slot_${++batchIdCounter}`;
    setGeneratingSlots((prev) => [{ modelName: currentModel.name, modelId: currentModel.id, slotId }, ...prev]);

    if (galleryRef.current) galleryRef.current.scrollTop = 0;

    try {
      const body: Record<string, unknown> = {
        videoModelId: currentModel.id,
        prompt: usedPrompt.trim(),
        imageUrl: activeMode === "relight" ? null : firstFrame?.url,
        batchId,
      };

      if (activeMode === "relight") {
        body.relightVideoUrl = rlVideo!.url;
        body.relightCondType = rlCondType;
        body.relightPrompt = rlPromptText;
        body.relightDirection = rlDirection;
        body.relightCfg = rlCfg;
        body.duration = rlVideo!.duration;
        if (rlCondImage?.url && rlCondType !== "ic") {
          body.relightCondImgUrl = rlCondImage.url;
        }
      } else if (activeMode === "create") {
        body.duration = duration;
        if (currentModel.aspectRatios.length > 0) body.aspectRatio = aspectRatio;
        if (currentModel.resolutions.length > 0) body.resolution = resolution;
        if (currentModel.supportsCameraFixed) body.cameraFixed = cameraFixed;
        if (currentModel.supportsGenerateAudio) body.generateAudio = generateAudio;
        if (supportsLastFrame && lastFrame?.url) body.endImageUrl = lastFrame.url;
        if (negativePrompt.trim() && currentModel.supportsNegativePrompt) body.negativePrompt = negativePrompt.trim();

        if (multiShotEnabled && currentModel.supportsMultiShot && shots.length > 0) {
          const validShots = shots.filter((s) => s.prompt.trim());
          if (validShots.length > 0) {
            body.multiShot = true;
            body.shotType = "customize";
            body.multiPrompt = shots.map((s, i) => ({
              index: i + 1,
              prompt: s.prompt,
              duration: s.duration,
            }));
            body.duration = shots.reduce((sum, s) => sum + s.duration, 0);
          }
        }

        const elementUrls = elements.filter(Boolean).map((e) => e!.url).filter(Boolean) as string[];
        if (elementUrls.length > 0 && currentModel.supportsElements) {
          body.elements = elementUrls;
        }
      } else {
        body.videoUrl = refVideo!.url;
        body.duration = refVideo!.duration;
        body.characterOrientation = charOrientation;
        if (currentModel.resolutions.length > 0) body.resolution = resolution;
        if (currentModel.supportsKeepOriginalSound) body.keepOriginalSound = keepOriginalSound;
      }

      // Submit to queue — returns immediately
      const res = await fetch("/api/animate-shot", {
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
        throw new Error(data.error || "Video generation failed");
      }
      trackVideoGenerated(currentModel.id, duration);
      invalidateCredits();

      const generationId = data.generationId;

      // Add pending generation to local cache (url=null, pending=true via generationToResult)
      const refUrls: string[] = [];
      if (activeMode === "relight") {
        if (rlVideo?.url) refUrls.push(rlVideo.url);
        if (rlCondImage?.url) refUrls.push(rlCondImage.url);
      } else {
        if (firstFrame?.url) refUrls.push(firstFrame.url);
        if (activeMode === "create" && lastFrame?.url) refUrls.push(lastFrame.url);
        if (activeMode === "motion" && refVideo?.url) refUrls.push(refVideo.url);
      }

      const settings: Record<string, unknown> = {
        modelId: currentModel.id,
        mode: activeMode,
        falRequestId: data.falRequestId,
      };
      if (activeMode === "relight") {
        Object.assign(settings, { relightCondType: rlCondType, relightPrompt: rlPromptText, relightDirection: rlDirection, relightCfg: rlCfg });
      } else if (activeMode === "create") {
        Object.assign(settings, { aspectRatio, resolution, duration, cameraFixed, generateAudio });
      } else {
        Object.assign(settings, { charOrientation, keepOriginalSound });
      }

      addDbGenerations([{
        id: generationId,
        type: "video",
        url: null, // pending — will be updated when poll completes
        width: null,
        height: null,
        duration: activeMode === "create" ? duration : null,
        prompt: usedPrompt.trim(),
        negative_prompt: activeMode === "create" && negativePrompt.trim() ? negativePrompt.trim() : null,
        model_id: currentModel.id,
        model_name: currentModel.name,
        seed: null,
        request_id: data.falRequestId,
        aspect_ratio: activeMode === "create" ? aspectRatio : null,
        resolution: activeMode === "create" && currentModel.resolutions.length > 0 ? resolution : null,
        settings,
        batch_id: batchId,
        favorited: false,
        created_at: new Date().toISOString(),
        scene_id: null,
        shot_number: null,
        project_id: null,
        source_image_url: activeMode === "relight" ? rlVideo?.url ?? null : firstFrame?.url ?? null,
        thumbnail_url: null,
        reference_image_urls: refUrls,
      }]);

      // Start polling in background — non-blocking
      pollGeneration(generationId, slotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
      setGeneratingSlots((prev) => prev.filter((s) => s.slotId !== slotId));
    }
  };

  const handleRegenerate = () => {
    const firstResult = latestBatch[0] ?? history.find((r) => r.type === "video");
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
    handleGenerate(editPromptValue.trim());
  };

  const toggleFavorite = (requestId: string) => {
    const gen = history.find((r) => r.requestId === requestId);
    if (gen?.id) dbToggleFavorite(gen.id);
    setSelectedResult((prev) =>
      prev && prev.requestId === requestId ? { ...prev, favorited: !prev.favorited } : prev
    );
  };

  const deleteVideo = (requestId: string) => {
    const gen = history.find((r) => r.requestId === requestId);
    if (gen?.id) dbDeleteGeneration(gen.id);
    setSelectedResult((prev) => (prev && prev.requestId === requestId ? null : prev));
  };

  const handleDownload = async (r: GenerationResult) => {
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
      if (prev) setSelectedIds(new Set());
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
    setSelectedResult((prev) => (prev && selectedIds.has(prev.requestId) ? null : prev));
  }, [filteredHistory, selectedIds, dbDeleteGenerations]);

  // Video upload handler (motion control)
  const handleRefVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadVideo(file, setRefVideo);
    if (refVideoInputRef.current) refVideoInputRef.current.value = "";
  }, [uploadVideo]);

  const handleVideoDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const videoUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (videoUrl && videoUrl.startsWith("http") && /\.(mp4|mov|webm|m4v)/i.test(videoUrl)) {
      const id = `vid_${++imageIdCounter}`;
      const dur = await getVideoUrlDuration(videoUrl);
      setRefVideo({ id, preview: videoUrl, url: videoUrl, uploading: false, duration: dur });
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      uploadVideo(file, setRefVideo);
    }
  }, [uploadVideo, getVideoUrlDuration]);

  // Model change — auto-switch mode if model is from the other group
  const handleModelChange = (ids: string[]) => {
    const id = ids[0];
    const model = VIDEO_MODELS.find((m) => m.id === id);
    if (!model) return;

    if (model.type === "image-to-video") {
      setCreateModelId(id);
      saveStorage(STORAGE_KEYS.videoModel, id);
      if (activeMode !== "create") setActiveMode("create");
    } else if (model.type === "relight") {
      setRlModelId(id);
      saveStorage(STORAGE_KEYS.rlModel, id);
      if (activeMode !== "relight") setActiveMode("relight");
    } else {
      setMcModelId(id);
      saveStorage(STORAGE_KEYS.mcModel, id);
      if (activeMode !== "motion") setActiveMode("motion");
    }
  };

  // Relight upload handlers
  const handleRlVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadVideo(file, setRlVideo);
    if (rlVideoInputRef.current) rlVideoInputRef.current.value = "";
  }, [uploadVideo, setRlVideo]);

  const handleRlVideoDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const videoUrlVal = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (videoUrlVal && videoUrlVal.startsWith("http") && /\.(mp4|mov|webm|m4v)/i.test(videoUrlVal)) {
      const id = `vid_${++imageIdCounter}`;
      // Read duration from URL
      const dur = await getVideoUrlDuration(videoUrlVal);
      setRlVideo({ id, preview: videoUrlVal, url: videoUrlVal, uploading: false, duration: dur });
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      uploadVideo(file, setRlVideo);
    }
  }, [uploadVideo, setRlVideo, getVideoUrlDuration]);

  const handleRlCondUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, setRlCondImage);
    if (rlCondInputRef.current) rlCondInputRef.current.value = "";
  }, [uploadImage]);

  const handleRlCondDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imgUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (imgUrl && imgUrl.startsWith("http") && /\.(png|jpe?g|webp)/i.test(imgUrl)) {
      const id = `img_${++imageIdCounter}`;
      setRlCondImage({ id, preview: imgUrl, url: imgUrl, uploading: false });
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadImage(file, setRlCondImage);
    }
  }, [uploadImage]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (firstFrame?.url && !firstFrame.uploading) handleGenerate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isGenerating, firstFrame]);

  const hasAnyContent = history.length > 0 || isGenerating || generationsLoading;
  const canGenerate = activeMode === "create"
    ? firstFrame?.url && !firstFrame.uploading
    : activeMode === "relight"
      ? rlVideo?.url && !rlVideo.uploading
      : firstFrame?.url && !firstFrame.uploading && refVideo?.url && !refVideo.uploading;

  const slotAspectRatio = (() => {
    const [w, h] = aspectRatio.split(":").map(Number);
    return w && h ? w / h : 16 / 9;
  })();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Navbar />

      <div className="flex min-h-0 flex-1">
        {/* ================================================================
            LEFT SIDEBAR
            ================================================================ */}
        <aside className="hidden w-[28%] min-w-[280px] max-w-[400px] shrink-0 flex-col border-r border-border lg:flex">
          {/* Mode bar — fixed at top */}
          <div className="border-b border-border px-2 py-2">
            <ModeBar modes={VIDEO_MODES} active={activeMode} onChange={(id) => setActiveMode(id as VideoMode)} columns={2} />
          </div>

          {/* Scrollable settings area */}
          <div className="scrollbar-none flex-1 overflow-y-auto p-4">
            <div className="space-y-5">
              {/* Model — always shown */}
              <div>
                <SectionLabel>Model</SectionLabel>
                <ModelSelector
                  models={activeSelectorItems}
                  selectedIds={[selectedModelId]}
                  onChange={handleModelChange}
                  pricing={pricing}
                  creditRanges={creditRanges}
                  mode="single"
                  title={activeMode === "create" ? "Choose Video Model" : "Choose Motion Control Model"}
                />
              </div>

              {/* ========================
                  CREATE MODE SETTINGS
                  ======================== */}
              {activeMode === "create" && (
                <>
                  {/* First + Last Frame — horizontal when both shown */}
                  {supportsLastFrame ? (
                    <div className="flex gap-3">
                      <UploadZone
                        file={firstFrame}
                        onRemove={() => { if (firstFrame) URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }}
                        onUpload={handleFirstUpload}
                        inputRef={firstInputRef}
                        label="First Frame"
                        dragOver={firstDragOver}
                        setDragOver={setFirstDragOver}
                        onDrop={(e) => handleImageDrop(e, setFirstFrame)}
                        compact
                      />
                      <UploadZone
                        file={lastFrame}
                        onRemove={() => { if (lastFrame) URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }}
                        onUpload={handleLastUpload}
                        inputRef={lastInputRef}
                        label="Last Frame"
                        dragOver={lastDragOver}
                        setDragOver={setLastDragOver}
                        onDrop={(e) => handleImageDrop(e, setLastFrame)}
                        compact
                      />
                    </div>
                  ) : (
                    <UploadZone
                      file={firstFrame}
                      onRemove={() => { if (firstFrame) URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }}
                      onUpload={handleFirstUpload}
                      inputRef={firstInputRef}
                      label="First Frame"
                      dragOver={firstDragOver}
                      setDragOver={setFirstDragOver}
                      onDrop={(e) => handleImageDrop(e, setFirstFrame)}
                    />
                  )}

                  {/* Multi-Shot toggle */}
                  {currentModel.supportsMultiShot && (
                    <Toggle
                      checked={multiShotEnabled}
                      onChange={setMultiShotEnabled}
                      label="Multi-Shot"
                      description="Storyboard with per-shot prompts"
                      size="sm"
                      className="w-full"
                    />
                  )}

                  {/* Duration — hidden when multi-shot is active */}
                  {currentModel.durations.length > 0 && !(multiShotEnabled && currentModel.supportsMultiShot) && (
                    <div>
                      <SectionLabel>Duration</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {currentModel.durations.map((d) => (
                          <PillButton
                            key={d}
                            active={duration === d}
                            onClick={() => {
                              setDuration(d);
                              saveStorage(STORAGE_KEYS.duration, d);
                            }}
                          >
                            {d}s
                          </PillButton>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Elements (character consistency) */}
                  {currentModel.supportsElements && (
                    <div>
                      <SectionLabel>Elements</SectionLabel>
                      <p className="mb-2 text-[10px] text-muted">Reference as @Element1, @Element2, @Element3 in prompts</p>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((idx) => (
                          <div key={idx} className="relative">
                            <div
                              className={`relative h-[60px] w-[60px] rounded-lg transition ${
                                elementDragOver === idx ? "ring-1 ring-accent/30" : ""
                              }`}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setElementDragOver(idx); }}
                              onDragLeave={(e) => { e.preventDefault(); setElementDragOver(null); }}
                              onDrop={handleElementDrop(idx)}
                            >
                              {elements[idx] ? (
                                <div className="group relative h-full w-full overflow-hidden rounded-lg border border-border">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={elements[idx]!.preview} alt={`Element ${idx + 1}`} className="h-full w-full object-cover" />
                                  {elements[idx]!.uploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => removeElement(idx)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                                  >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                      <path d="M2 2l6 6M8 2l-6 6" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => elementInputRefs[idx].current?.click()}
                                  className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed transition ${
                                    elementDragOver === idx
                                      ? "border-accent bg-accent/10 text-accent-text"
                                      : "border-border text-muted hover:border-accent/40 hover:text-accent"
                                  }`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M7 3v8M3 7h8" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            {/* Badge */}
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[8px] font-bold text-muted ring-1 ring-border">
                              @{idx + 1}
                            </span>
                            <input
                              ref={elementInputRefs[idx]}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleElementUpload(idx)}
                              className="hidden"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aspect Ratio */}
                  {currentModel.aspectRatios.length > 0 && (
                    <div>
                      <SectionLabel>Aspect Ratio</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {currentModel.aspectRatios.map((ratio) => (
                          <PillButton
                            key={ratio}
                            active={aspectRatio === ratio}
                            onClick={() => {
                              setAspectRatio(ratio);
                              saveStorage(STORAGE_KEYS.aspectRatio, ratio);
                            }}
                          >
                            {ratio}
                          </PillButton>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution */}
                  {currentModel.resolutions.length > 0 && (
                    <div>
                      <SectionLabel>Resolution</SectionLabel>
                      <div className="flex gap-1.5">
                        {currentModel.resolutions.map((r) => (
                          <PillButton
                            key={r}
                            active={resolution === r}
                            onClick={() => {
                              setResolution(r);
                              saveStorage(STORAGE_KEYS.resolution, r);
                            }}
                            className="flex-1"
                          >
                            {r}
                          </PillButton>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Camera Fixed toggle */}
                  {currentModel.supportsCameraFixed && (
                    <Toggle
                      checked={cameraFixed}
                      onChange={(v) => {
                        setCameraFixed(v);
                        saveStorage(STORAGE_KEYS.cameraFixed, v);
                      }}
                      label="Lock Camera"
                      size="sm"
                      className="w-full"
                    />
                  )}

                  {/* Generate Audio toggle */}
                  {currentModel.supportsGenerateAudio && (
                    <Toggle
                      checked={generateAudio}
                      onChange={(v) => {
                        setGenerateAudio(v);
                        saveStorage(STORAGE_KEYS.generateAudio, v);
                      }}
                      label="Generate Audio"
                      size="sm"
                      className="w-full"
                    />
                  )}

                  {/* Negative Prompt */}
                  {currentModel.supportsNegativePrompt && (
                    <div>
                      <button
                        onClick={() => setNegativeOpen(!negativeOpen)}
                        className="flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-wider text-foreground/85 transition hover:text-foreground"
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
                </>
              )}

              {/* ========================
                  RELIGHT SETTINGS
                  ======================== */}
              {activeMode === "relight" && (
                <>
                  {/* Source Video */}
                  <div>
                    <UploadZone
                      file={rlVideo}
                      onRemove={() => { if (rlVideo) URL.revokeObjectURL(rlVideo.preview); setRlVideo(null); }}
                      onUpload={handleRlVideoUpload}
                      inputRef={rlVideoInputRef}
                      label="Source Video"
                      dragOver={rlVideoDragOver}
                      setDragOver={setRlVideoDragOver}
                      onDrop={handleRlVideoDrop}
                      accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                      isVideo
                    />
                    {rlVideo?.duration && rlVideo.duration > 0 && (
                      <p className="mt-1.5 text-[10px] text-muted">{rlVideo.duration}s video</p>
                    )}
                  </div>

                  {/* Relight Mode */}
                  <div>
                    <SectionLabel>Relight Mode</SectionLabel>
                    <div className="flex gap-1.5">
                      {[
                        { id: "ic", label: "Text" },
                        { id: "ref", label: "Reference" },
                      ].map((ct) => (
                        <PillButton
                          key={ct.id}
                          active={rlCondType === ct.id}
                          onClick={() => {
                            setRlCondType(ct.id);
                            saveStorage(STORAGE_KEYS.rlCondType, ct.id);
                          }}
                          className="flex-1"
                        >
                          {ct.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  {/* Text-based lighting controls (ic mode) */}
                  {rlCondType === "ic" && (
                    <>
                      <div>
                        <SectionLabel>Light Description</SectionLabel>
                        <input
                          type="text"
                          value={rlPromptText}
                          onChange={(e) => {
                            setRlPromptText(e.target.value);
                            saveStorage(STORAGE_KEYS.rlPrompt, e.target.value);
                          }}
                          placeholder="e.g. Warm sunset, Neon blue glow, Studio lighting..."
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none transition placeholder:text-muted focus:border-accent"
                        />
                      </div>

                      <div>
                        <SectionLabel>Light Direction</SectionLabel>
                        <div className="flex gap-1.5">
                          {["Left", "Right", "Top", "Bottom"].map((dir) => (
                            <PillButton
                              key={dir}
                              active={rlDirection === dir}
                              onClick={() => {
                                setRlDirection(dir);
                                saveStorage(STORAGE_KEYS.rlDirection, dir);
                              }}
                              className="flex-1"
                            >
                              {dir}
                            </PillButton>
                          ))}
                        </div>
                      </div>

                      <div>
                        <SectionLabel>Guidance (CFG)</SectionLabel>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={rlCfg}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setRlCfg(v);
                              saveStorage(STORAGE_KEYS.rlCfg, v);
                            }}
                            className="flex-1 accent-accent"
                          />
                          <span className="w-8 text-right text-xs text-muted">{rlCfg}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted">
                          Low = subtle, High = dramatic
                        </p>
                      </div>
                    </>
                  )}

                  {/* Reference image (ref mode) */}
                  {rlCondType === "ref" && (
                    <UploadZone
                      file={rlCondImage}
                      onRemove={() => { if (rlCondImage) URL.revokeObjectURL(rlCondImage.preview); setRlCondImage(null); }}
                      onUpload={handleRlCondUpload}
                      inputRef={rlCondInputRef}
                      label="Reference Image"
                      dragOver={rlCondDragOver}
                      setDragOver={setRlCondDragOver}
                      onDrop={handleRlCondDrop}
                    />
                  )}

                  {/* Generate button — sticky at bottom */}
                  <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-background px-4 py-4">
                    <button
                      onClick={() => handleGenerate()}
                      disabled={!canGenerate}
                      className={`flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold tracking-wide transition ${
                        canGenerate
                          ? "bg-accent text-black hover:bg-accent-hover"
                          : "cursor-not-allowed bg-surface-hover text-muted"
                      }`}
                      title="Generate (Enter)"
                    >
                      <IconBolt size={14} />
                      Generate
                      {estimatedVidCredits > 0 && (
                        <span className="flex items-center gap-1">
                          <CreditIcon size={10} /> {estimatedVidCredits}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* ========================
                  MOTION CONTROL SETTINGS
                  ======================== */}
              {activeMode === "motion" && (
                <>
                  {/* Reference Video + Character Image — horizontal */}
                  <div className="flex gap-3">
                    <UploadZone
                      file={refVideo}
                      onRemove={() => { if (refVideo) URL.revokeObjectURL(refVideo.preview); setRefVideo(null); }}
                      onUpload={handleRefVideoUpload}
                      inputRef={refVideoInputRef}
                      label="Reference Video"
                      dragOver={refVideoDragOver}
                      setDragOver={setRefVideoDragOver}
                      onDrop={handleVideoDrop}
                      accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                      isVideo
                      compact
                    />
                    <UploadZone
                      file={firstFrame}
                      onRemove={() => { if (firstFrame) URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }}
                      onUpload={handleFirstUpload}
                      inputRef={firstInputRef}
                      label="Character Image"
                      dragOver={firstDragOver}
                      setDragOver={setFirstDragOver}
                      onDrop={(e) => handleImageDrop(e, setFirstFrame)}
                      compact
                    />
                  </div>
                  {refVideo?.duration && refVideo.duration > 0 && (
                    <p className="mt-1.5 text-[10px] text-muted">{refVideo.duration}s video</p>
                  )}

                  {/* Scene Source */}
                  {currentModel.characterOrientations && currentModel.characterOrientations.length > 0 && (
                    <div>
                      <SectionLabel>Scene Source</SectionLabel>
                      <div className="flex gap-1.5">
                        {currentModel.characterOrientations.map((orient) => (
                          <PillButton
                            key={orient}
                            active={charOrientation === orient}
                            onClick={() => {
                              setCharOrientation(orient);
                              saveStorage(STORAGE_KEYS.charOrientation, orient);
                            }}
                            className="flex-1 capitalize"
                          >
                            {orient}
                          </PillButton>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted">
                        {charOrientation === "video"
                          ? "Background from motion video (max 30s)"
                          : "Background from character image (max 10s)"}
                      </p>
                    </div>
                  )}

                  {/* Resolution (Kling MC models now have 720p/1080p) */}
                  {currentModel.resolutions.length > 0 && (
                    <div>
                      <SectionLabel>Resolution</SectionLabel>
                      <div className="flex gap-1.5">
                        {currentModel.resolutions.map((r) => (
                          <PillButton
                            key={r}
                            active={resolution === r}
                            onClick={() => {
                              setResolution(r);
                              saveStorage(STORAGE_KEYS.resolution, r);
                            }}
                            className="flex-1"
                          >
                            {r}
                          </PillButton>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keep Original Sound */}
                  {currentModel.supportsKeepOriginalSound && (
                    <Toggle
                      checked={keepOriginalSound}
                      onChange={setKeepOriginalSound}
                      label="Keep Original Sound"
                      size="sm"
                      className="w-full"
                    />
                  )}

                  {/* Generate button — sticky at bottom */}
                  <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-background px-4 py-4">
                    <button
                      onClick={() => handleGenerate()}
                      disabled={!canGenerate}
                      className={`flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold tracking-wide transition ${
                        canGenerate
                          ? "bg-accent text-black hover:bg-accent-hover"
                          : "cursor-not-allowed bg-surface-hover text-muted"
                      }`}
                      title="Generate (Enter)"
                    >
                      <IconBolt size={14} />
                      Generate
                      {estimatedVidCredits > 0 && (
                        <span className="flex items-center gap-1">
                          <CreditIcon size={10} /> {estimatedVidCredits}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* ================================================================
            MOBILE — gallery only, no generation controls
            ================================================================ */}
        <div className="flex w-full flex-col lg:hidden">
          <DesktopOnlyBanner />
          <div className="flex-1 overflow-y-auto p-3">
            {hasAnyContent ? (
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
                targetRowHeight={160}
                slotAspectRatio={slotAspectRatio}
                onRegenerate={handleRegenerate}
                onEdit={handleEdit}
                onEditSubmit={handleEditSubmit}
                setShowEditPrompt={setShowEditPrompt}
                onDownload={handleDownload}
                onCopyUrl={handleCopyUrl}
                onClickImage={setSelectedResult}
                onFavorite={toggleFavorite}
                onDelete={deleteVideo}
                selectMode={false}
                selectedIds={new Set()}
                onToggleSelect={() => {}}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted">No videos yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================
            RIGHT SIDE — Gallery (desktop)
            ================================================================ */}
        <main ref={galleryRef} className="relative hidden min-w-0 flex-1 flex-col lg:flex">
          {!hasAnyContent ? (
            <div className="flex flex-1 items-center justify-center pb-32">
              {generationsLoading ? (
                <div className="w-full p-4">
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="skeleton-shimmer rounded-lg"
                        style={{ aspectRatio: 16 / 9 }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface">
                    <svg width="32" height="32" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-muted">
                      <rect x="2" y="3" width="16" height="14" rx="3" />
                      <path d="M8 7l5 3-5 3V7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted">
                    Your videos will appear here
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted">
                    Upload a first frame image and hit Generate
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

              {/* Gallery content */}
              <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-28">
                {generationsLoading && history.length === 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="skeleton-shimmer rounded-lg"
                        style={{ aspectRatio: 16 / 9 }}
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
                    slotAspectRatio={slotAspectRatio}
                    onRegenerate={handleRegenerate}
                    onEdit={handleEdit}
                    onEditSubmit={handleEditSubmit}
                    setShowEditPrompt={setShowEditPrompt}
                    onDownload={handleDownload}
                    onCopyUrl={handleCopyUrl}
                    onClickImage={setSelectedResult}
                    onFavorite={toggleFavorite}
                    onDelete={deleteVideo}
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
              FLOATING PROMPT BAR — hidden for modes without prompt (motion, relight)
              ============================================================ */}
          {(VIDEO_MODES.find((m) => m.id === activeMode)?.hasPrompt !== false) && (
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
              {/* Frame thumbnails in prompt bar */}
              {(firstFrame || (activeMode === "motion" && refVideo)) && activeMode !== "relight" && (
                <div className="flex items-center gap-2 px-4 pt-3">
                  {firstFrame && (
                    <div className="group/ref relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={firstFrame.preview} alt="Reference" className="h-full w-full object-cover" />
                      {firstFrame.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <div className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent" />
                        </div>
                      )}
                      <button
                        onClick={() => { if (firstFrame) URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover/ref:opacity-100"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 1l6 6M7 1l-6 6" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {activeMode === "create" && supportsLastFrame && lastFrame && (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted/70">
                        <path d="M4 6h4M6.5 4l2 2-2 2" />
                      </svg>
                      <div className="group/ref relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lastFrame.preview} alt="Last frame" className="h-full w-full object-cover" />
                        <button
                          onClick={() => { if (lastFrame) URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover/ref:opacity-100"
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1 1l6 6M7 1l-6 6" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                  {activeMode === "motion" && refVideo && (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted/70">
                        <path d="M4 6h4M6.5 4l2 2-2 2" />
                      </svg>
                      <div className="group/ref relative h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video src={refVideo.preview} className="h-full w-full object-cover" muted />
                        {refVideo.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <div className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent" />
                          </div>
                        )}
                        <button
                          onClick={() => { if (refVideo) URL.revokeObjectURL(refVideo.preview); setRefVideo(null); }}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover/ref:opacity-100"
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1 1l6 6M7 1l-6 6" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                  <span className="text-[9px] text-muted/70">{currentModel.name}</span>
                </div>
              )}

              {/* Prompt area — single or multi-shot storyboard */}
              {multiShotEnabled && currentModel.supportsMultiShot ? (
                <>
                  {/* Multi-shot storyboard editor */}
                  <div className="scrollbar-none max-h-[280px] overflow-y-auto px-3 pt-3 pb-1">
                    <div className="space-y-1.5">
                      {shots.map((shot, i) => (
                        <div key={i} className="group/shot flex items-start gap-2 rounded-lg border border-border/40 bg-surface/50 px-2.5 py-2 transition hover:border-border">
                          {/* Shot number badge */}
                          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent-text">
                            {i + 1}
                          </span>
                          {/* Prompt input */}
                          <textarea
                            value={shot.prompt}
                            onChange={(e) => updateShotPrompt(i, e.target.value)}
                            placeholder={`Shot ${i + 1} — describe scene...`}
                            rows={1}
                            className="scrollbar-none min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-xs leading-relaxed text-foreground outline-none placeholder:text-muted/70"
                            onInput={(e) => {
                              const el = e.target as HTMLTextAreaElement;
                              el.style.height = "auto";
                              el.style.height = Math.min(el.scrollHeight, 80) + "px";
                            }}
                          />
                          {/* Duration selector */}
                          <Select
                            value={String(shot.duration)}
                            options={Array.from({ length: 15 }, (_, n) => ({
                              value: String(n + 1),
                              label: `${n + 1}s`,
                            }))}
                            onChange={(v) => updateShotDuration(i, Number(v))}
                            compact
                            placement="top"
                            minWidth={60}
                            className="mt-0.5 w-[52px] shrink-0"
                          />
                          {/* Remove button */}
                          {shots.length > 1 && (
                            <button
                              onClick={() => removeShot(i)}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-muted transition hover:text-red-400 opacity-0 group-hover/shot:opacity-100"
                              title="Remove shot"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M2 2l6 6M8 2l-6 6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Add shot */}
                    {shots.length < 6 && (
                      <button
                        onClick={addShot}
                        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 py-1.5 text-[10px] font-medium text-muted transition hover:border-accent/40 hover:text-accent"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M5 1v8M1 5h8" />
                        </svg>
                        Add Shot
                      </button>
                    )}
                  </div>

                  {/* Bottom bar — multi-shot */}
                  <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-medium ${multiShotTotalDuration > maxModelDuration ? "text-red-400" : "text-muted"}`}>
                        {shots.length} shots · {multiShotTotalDuration}s{multiShotTotalDuration > maxModelDuration ? ` (max ${maxModelDuration}s)` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleGenerate()}
                      disabled={!canGenerate}
                      className={`flex items-center gap-2 rounded-full py-2.5 pl-4 pr-5 text-sm font-semibold tracking-wide transition ${
                        canGenerate
                          ? "bg-accent text-black hover:bg-accent-hover"
                          : "cursor-not-allowed bg-surface-hover text-muted"
                      }`}
                      title="Generate (Enter)"
                    >
                      <IconBolt size={14} />
                      Generate
                      {estimatedVidCredits > 0 && (
                        <span className="flex items-center gap-1">
                          <CreditIcon size={10} /> {estimatedVidCredits}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Single prompt textarea */}
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
                    placeholder={promptBarDragOver ? "Drop image as first frame..." : activeMode === "relight" ? "Optional: describe the scene..." : "Describe the video motion..."}
                    className="scrollbar-none block w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 pb-1.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted"
                    style={{ minHeight: "48px", maxHeight: "160px" }}
                  />

                  {/* Bottom bar — single prompt */}
                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => firstInputRef.current?.click()}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted transition hover:border-accent/40 hover:text-accent"
                        title="Add first frame"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M6 1v10M1 6h10" />
                        </svg>
                      </button>
                      <span className="select-none text-[10px] text-muted/70">
                        ↵ generate · ⇧↵ new line
                      </span>
                    </div>
                    <button
                      onClick={() => handleGenerate()}
                      disabled={!canGenerate}
                      className={`flex items-center gap-2 rounded-full py-2.5 pl-4 pr-5 text-sm font-semibold tracking-wide transition ${
                        canGenerate
                          ? "bg-accent text-black hover:bg-accent-hover"
                          : "cursor-not-allowed bg-surface-hover text-muted"
                      }`}
                      title="Generate (Enter)"
                    >
                      <IconBolt size={14} />
                      Generate
                      {estimatedVidCredits > 0 && (
                        <span className="flex items-center gap-1">
                          <CreditIcon size={10} /> {estimatedVidCredits}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {selectedResult && (
        <MediaLightbox
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          onFavorite={() => toggleFavorite(selectedResult.requestId)}
          onDownload={() => handleDownload(selectedResult)}
          onCopyUrl={() => handleCopyUrl(selectedResult)}
          onUseAsReference={() => {
            const id = `img_${++imageIdCounter}`;
            setFirstFrame({ id, preview: selectedResult.imageUrl, url: selectedResult.imageUrl, uploading: false });
          }}
          onDelete={() => deleteVideo(selectedResult.requestId)}
          copied={copiedId === selectedResult.requestId}
          onPrev={() => {
            const idx = history.findIndex((r) => r.requestId === selectedResult.requestId);
            if (idx < history.length - 1) setSelectedResult(history[idx + 1]);
          }}
          onNext={() => {
            const idx = history.findIndex((r) => r.requestId === selectedResult.requestId);
            if (idx > 0) setSelectedResult(history[idx - 1]);
          }}
          hasPrev={(() => { const idx = history.findIndex((r) => r.requestId === selectedResult.requestId); return idx < history.length - 1; })()}
          hasNext={(() => { const idx = history.findIndex((r) => r.requestId === selectedResult.requestId); return idx > 0; })()}
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

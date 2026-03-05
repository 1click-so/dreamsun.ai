"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { fal } from "@fal-ai/client";
import { MODELS, type ModelConfig, getSelectableModels, resolveModel } from "@/lib/models";
import { VIDEO_MODELS, type VideoModelConfig } from "@/lib/video-models";
import { parseShotList, type ParsedShot } from "@/lib/shot-parser";

fal.config({ proxyUrl: "/api/fal/proxy" });

/** Sort "1" < "1A" < "1B" < "2" < "10" < "10A" */
function compareShotNumbers(a: string | number, b: string | number): number {
  const sa = String(a);
  const sb = String(b);
  const numA = parseInt(sa, 10) || 0;
  const numB = parseInt(sb, 10) || 0;
  if (numA !== numB) return numA - numB;
  const suffA = sa.replace(/^\d+/, "");
  const suffB = sb.replace(/^\d+/, "");
  return suffA.localeCompare(suffB, undefined, { sensitivity: "base" });
}

type ShotStatus = "pending" | "generating" | "done" | "error";

interface ImageSettings {
  modelId: string | null;        // null = use global
  aspectRatio: string | null;    // null = use global
  safetyChecker: boolean | null; // null = use global (false)
}

interface VideoSettings {
  modelId: string | null;        // null = use global
  duration: number | null;       // null = use global
  aspectRatio: string | null;    // null = use global
  resolution: string | null;     // null = use model default
  cameraFixed: boolean | null;   // null = don't send
  generateAudio: boolean | null; // null = use model default
}

interface ShotSettings {
  image: ImageSettings;
  video: VideoSettings;
}

interface Shot {
  id: string;
  number: string;
  title: string;
  imagePrompt: string;
  videoPrompt: string;
  imageStatus: ShotStatus;
  videoStatus: ShotStatus;
  imageUrl: string | null;
  videoUrl: string | null;
  localImagePath: string | null;
  localVideoPath: string | null;
  error: string | null;
  /** Per-shot reference image URLs (fal CDN) */
  refImages: UploadedRef[];
  /** Per-shot end frame (last frame) for video */
  endImageUrl: string | null;
  endImageRef: UploadedRef | null;
  /** Per-shot overrides (null = use global) */
  settings: ShotSettings;
  /** History of all generated image URLs (newest first) */
  imageHistory: string[];
}

interface UploadedRef {
  id: string;
  preview: string;
  url: string | null;
  uploading: boolean;
}

let idCounter = Date.now();
const nextId = () => `shot_${++idCounter}`;
let refIdCounter = Date.now();
const nextRefId = () => `ref_${++refIdCounter}`;

function createShot(parsed?: ParsedShot): Shot {
  return {
    id: nextId(),
    number: parsed?.number ?? "1",
    title: parsed?.title ?? "",
    imagePrompt: parsed?.imagePrompt ?? "",
    videoPrompt: parsed?.videoPrompt ?? "",
    imageStatus: "pending",
    videoStatus: "pending",
    imageUrl: null,
    videoUrl: null,
    localImagePath: null,
    localVideoPath: null,
    error: null,
    refImages: [],
    endImageUrl: null,
    endImageRef: null,
    imageHistory: [],
    settings: {
      image: {
        modelId: null,
        aspectRatio: null,
        safetyChecker: null,
      },
      video: {
        modelId: null,
        duration: null,
        aspectRatio: null,
        resolution: null,
        cameraFixed: null,
        generateAudio: null,
      },
    },
  };
}

/** Migrate shots from old flat settings to new nested image/video settings */
function migrateShot(raw: Record<string, unknown>): Shot {
  const base = createShot();
  const s = { ...base, ...raw, refImages: [], endImageRef: null } as Shot;

  // If settings is missing or has old flat shape (no .image/.video), rebuild it
  const settings = raw.settings as Record<string, unknown> | undefined;
  if (!settings || !settings.video || !settings.image) {
    s.settings = {
      image: {
        modelId: (settings as Record<string, unknown>)?.modelId as string | null ?? null,
        aspectRatio: null,
        safetyChecker: null,
      },
      video: {
        modelId: null,
        duration: (settings as Record<string, unknown>)?.duration as number | null ?? null,
        aspectRatio: (settings as Record<string, unknown>)?.aspectRatio as string | null ?? null,
        resolution: (settings as Record<string, unknown>)?.resolution as string | null ?? null,
        cameraFixed: (settings as Record<string, unknown>)?.cameraFixed as boolean | null ?? null,
        generateAudio: (settings as Record<string, unknown>)?.generateAudio as boolean | null ?? null,
      },
    };
  }

  // Coerce old numeric number to string
  if (typeof s.number === "number") s.number = String(s.number);
  if (!s.number) s.number = "0";

  if (!s.endImageUrl) s.endImageUrl = null;
  if (!s.endImageRef) s.endImageRef = null;
  if (!Array.isArray(s.imageHistory)) s.imageHistory = [];

  return s;
}

// --- localStorage helpers ---
const STORAGE_KEYS = {
  folder: "dreamsun_shots_folder",
  promptPrefix: "dreamsun_shots_prompt_prefix",
  imageModel: "dreamsun_shots_image_model",
  videoModel: "dreamsun_shots_video_model",
  aspectRatio: "dreamsun_shots_ratio",
  duration: "dreamsun_shots_duration",
  shots: "dreamsun_shots_data",
} as const;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded — ignore */ }
}

// --- Lightbox Modal ---
function Lightbox({
  src,
  type,
  shotNumber,
  onClose,
  onNewShotFromRef,
}: {
  src: string;
  type: "image" | "video";
  shotNumber?: string;
  onClose: () => void;
  onNewShotFromRef?: (imageUrl: string) => void;
}) {
  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = type === "video" ? "mp4" : "png";
      const name = shotNumber ? `shot-${shotNumber}.${ext}` : `shot.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
        <div className="absolute right-2 top-2 flex gap-2">
          {type === "image" && onNewShotFromRef && (
            <button
              onClick={() => { onNewShotFromRef(src); onClose(); }}
              className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
            >
              New Shot from Ref
            </button>
          )}
          <button
            onClick={handleDownload}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:bg-accent-hover"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShotsPage() {
  // --- Settings (all persisted to localStorage) ---
  const [outputFolder, setOutputFolder] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEYS.folder) || "";
  });
  const [promptPrefix, setPromptPrefix] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEYS.promptPrefix) || "";
  });
  const [selectedImageModel, setSelectedImageModel] = useState<ModelConfig>(
    () => {
      if (typeof window === "undefined") return MODELS.find((m) => m.id === "nano-banana-2") ?? MODELS[0];
      const savedId = localStorage.getItem(STORAGE_KEYS.imageModel);
      if (savedId) {
        const found = MODELS.find((m) => m.id === savedId);
        if (found) return found;
      }
      return MODELS.find((m) => m.id === "nano-banana-2") ?? MODELS[0];
    }
  );
  const [selectedVideoModel, setSelectedVideoModel] =
    useState<VideoModelConfig>(() => {
      if (typeof window === "undefined") return VIDEO_MODELS[0];
      const savedId = localStorage.getItem(STORAGE_KEYS.videoModel);
      if (savedId) {
        const found = VIDEO_MODELS.find((m) => m.id === savedId);
        if (found) return found;
      }
      return VIDEO_MODELS.find((m) => m.id === "seedance-1-5-pro") ?? VIDEO_MODELS[0];
    });
  const [aspectRatio, setAspectRatio] = useState(() =>
    loadFromStorage(STORAGE_KEYS.aspectRatio, "9:16")
  );
  const [duration, setDuration] = useState(() =>
    loadFromStorage(STORAGE_KEYS.duration, 5)
  );

  // --- View mode ---
  const [viewMode, setViewMode] = useState<"list" | "storyboard">(() =>
    loadFromStorage("dreamsun_shots_view", "list") as "list" | "storyboard"
  );

  // --- Project-level character reference images ---
  const [charRefs, setCharRefs] = useState<UploadedRef[]>([]);
  const charRefInput = useRef<HTMLInputElement>(null);

  // --- Shots (persisted to localStorage, with migration for old format) ---
  const [shots, setShots] = useState<Shot[]>(() => {
    const raw = loadFromStorage<Record<string, unknown>[]>(STORAGE_KEYS.shots, []);
    return raw.map(migrateShot);
  });
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; type: "image" | "video"; shotNumber?: string } | null>(null);
  const [newShotModal, setNewShotModal] = useState<{ imageUrl: string; suggestedNumber: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);

  // --- Persist state changes to localStorage ---
  useEffect(() => {
    // Save shots without refImages/endImageRef previews (ObjectURLs aren't valid across sessions)
    const serializable = shots.map((s) => ({ ...s, refImages: [], endImageRef: null }));
    saveToStorage(STORAGE_KEYS.shots, serializable);
  }, [shots]);

  // --- Batch progress ---
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isBatchAnimating, setIsBatchAnimating] = useState(false);

  // Per-shot file input refs
  const shotRefInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Abort controllers for in-flight requests (keyed by shot id + type)
  const abortControllers = useRef<Record<string, AbortController>>({});

  // --- Handlers ---

  const handleOutputFolderChange = (val: string) => {
    setOutputFolder(val);
    localStorage.setItem(STORAGE_KEYS.folder, val);
  };

  const handleParse = () => {
    const parsed = parseShotList(pasteText);
    if (parsed.length === 0) return;
    setShots(parsed.map((p) => createShot(p)));
    setShowPasteModal(false);
    setPasteText("");
  };

  const addShot = () => {
    setShots((prev) => [
      ...prev,
      createShot({
        number: String(prev.length + 1),
        title: "",
        imagePrompt: "",
        videoPrompt: "",
      }),
    ]);
  };

  const createShotFromRef = useCallback((imageUrl: string) => {
    // Find highest numeric shot number and suggest +1
    const maxNum = shots.reduce((max, s) => {
      const n = parseInt(String(s.number), 10) || 0;
      return n > max ? n : max;
    }, 0);
    setNewShotModal({ imageUrl, suggestedNumber: String(maxNum + 1) });
  }, [shots]);

  const confirmNewShotFromRef = useCallback(async (imageUrl: string, shotNumber: string) => {
    setNewShotModal(null);
    const refId = nextRefId();
    let falUrl: string | null = null;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "ref.png", { type: blob.type });
      falUrl = await fal.storage.upload(file);
    } catch {
      falUrl = imageUrl;
    }

    const ref: UploadedRef = { id: refId, preview: imageUrl, url: falUrl, uploading: false };
    const shot = createShot({ number: shotNumber, title: "", imagePrompt: "", videoPrompt: "" });
    shot.refImages = [ref];
    setShots((prev) => [...prev, shot]);
  }, []);

  const removeShot = (id: string) => {
    const shot = shots.find((s) => s.id === id);
    const label = shot ? `#${shot.number}${shot.title ? ` — ${shot.title}` : ""}` : "this shot";
    setDeleteConfirm({ id, label });
  };

  const confirmRemoveShot = () => {
    if (!deleteConfirm) return;
    setShots((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  const moveShot = (id: string, direction: "up" | "down") => {
    setShots((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateShot = (id: string, updates: Partial<Shot>) => {
    setShots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  // --- Character ref upload ---
  const handleCharRefUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        const id = nextRefId();
        const preview = URL.createObjectURL(file);
        const newRef: UploadedRef = { id, preview, url: null, uploading: true };
        setCharRefs((prev) => [...prev, newRef]);

        try {
          const url = await fal.storage.upload(file);
          setCharRefs((prev) =>
            prev.map((r) => (r.id === id ? { ...r, url, uploading: false } : r))
          );
        } catch {
          setCharRefs((prev) => prev.filter((r) => r.id !== id));
        }
      }

      if (charRefInput.current) charRefInput.current.value = "";
    },
    []
  );

  const removeCharRef = (id: string) => {
    setCharRefs((prev) => {
      const ref = prev.find((r) => r.id === id);
      if (ref) URL.revokeObjectURL(ref.preview);
      return prev.filter((r) => r.id !== id);
    });
  };

  // --- Per-shot ref upload ---
  const handleShotRefUpload = useCallback(
    async (shotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        const id = nextRefId();
        const preview = URL.createObjectURL(file);
        const newRef: UploadedRef = { id, preview, url: null, uploading: true };

        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId
              ? { ...s, refImages: [...s.refImages, newRef] }
              : s
          )
        );

        try {
          const url = await fal.storage.upload(file);
          setShots((prev) =>
            prev.map((s) =>
              s.id === shotId
                ? {
                    ...s,
                    refImages: s.refImages.map((r) =>
                      r.id === id ? { ...r, url, uploading: false } : r
                    ),
                  }
                : s
            )
          );
        } catch {
          setShots((prev) =>
            prev.map((s) =>
              s.id === shotId
                ? { ...s, refImages: s.refImages.filter((r) => r.id !== id) }
                : s
            )
          );
        }
      }

      const input = shotRefInputs.current[shotId];
      if (input) input.value = "";
    },
    []
  );

  const handleShotRefFiles = useCallback(
    async (shotId: string, files: File[]) => {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const id = nextRefId();
        const preview = URL.createObjectURL(file);
        const newRef: UploadedRef = { id, preview, url: null, uploading: true };

        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId ? { ...s, refImages: [...s.refImages, newRef] } : s
          )
        );

        try {
          const url = await fal.storage.upload(file);
          setShots((prev) =>
            prev.map((s) =>
              s.id === shotId
                ? { ...s, refImages: s.refImages.map((r) => r.id === id ? { ...r, url, uploading: false } : r) }
                : s
            )
          );
        } catch {
          setShots((prev) =>
            prev.map((s) =>
              s.id === shotId ? { ...s, refImages: s.refImages.filter((r) => r.id !== id) } : s
            )
          );
        }
      }
    },
    []
  );

  const removeShotRef = (shotId: string, refId: string) => {
    setShots((prev) =>
      prev.map((s) => {
        if (s.id !== shotId) return s;
        const ref = s.refImages.find((r) => r.id === refId);
        if (ref) URL.revokeObjectURL(ref.preview);
        return { ...s, refImages: s.refImages.filter((r) => r.id !== refId) };
      })
    );
  };

  // --- End frame (last frame) upload ---
  const handleEndFrameUpload = useCallback(
    async (shotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const id = nextRefId();
      const preview = URL.createObjectURL(file);
      const newRef: UploadedRef = { id, preview, url: null, uploading: true };

      setShots((prev) =>
        prev.map((s) =>
          s.id === shotId ? { ...s, endImageRef: newRef, endImageUrl: null } : s
        )
      );

      try {
        const url = await fal.storage.upload(file);
        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId
              ? { ...s, endImageRef: { ...newRef, url, uploading: false }, endImageUrl: url }
              : s
          )
        );
      } catch {
        setShots((prev) =>
          prev.map((s) =>
            s.id === shotId ? { ...s, endImageRef: null, endImageUrl: null } : s
          )
        );
      }

      e.target.value = "";
    },
    []
  );

  const removeEndFrame = (shotId: string) => {
    setShots((prev) =>
      prev.map((s) => {
        if (s.id !== shotId) return s;
        if (s.endImageRef) URL.revokeObjectURL(s.endImageRef.preview);
        return { ...s, endImageRef: null, endImageUrl: null };
      })
    );
  };

  // --- Update per-shot settings ---
  const updateShotImageSettings = (shotId: string, updates: Partial<ImageSettings>) => {
    setShots((prev) =>
      prev.map((s) =>
        s.id === shotId
          ? { ...s, settings: { ...s.settings, image: { ...s.settings.image, ...updates } } }
          : s
      )
    );
  };

  const updateShotVideoSettings = (shotId: string, updates: Partial<VideoSettings>) => {
    setShots((prev) =>
      prev.map((s) =>
        s.id === shotId
          ? { ...s, settings: { ...s.settings, video: { ...s.settings.video, ...updates } } }
          : s
      )
    );
  };

  // --- Single Shot Image Generation (reusable) ---
  const generateSingleShot = async (shot: Shot) => {
    // Abort any previous in-flight request for this shot
    const abortKey = `img_${shot.id}`;
    abortControllers.current[abortKey]?.abort();
    const controller = new AbortController();
    abortControllers.current[abortKey] = controller;

    updateShot(shot.id, { imageStatus: "generating", error: null });

    const charRefUrls = charRefs
      .filter((r) => r.url)
      .map((r) => r.url as string);
    const shotRefUrls = shot.refImages
      .filter((r) => r.url)
      .map((r) => r.url as string);
    const allRefs = [...charRefUrls, ...shotRefUrls];

    try {
      const shotHasRefs = allRefs.length > 0;
      const shotImageModelId = shot.settings.image.modelId ?? selectedImageModel.id;
      const model = resolveModel(shotImageModelId, shotHasRefs) ?? selectedImageModel;
      const shotAR = shot.settings.image.aspectRatio ?? aspectRatio;
      const shotSafety = shot.settings.image.safetyChecker ?? false;

      const body: Record<string, unknown> = {
        modelId: model.id,
        prompt: promptPrefix ? `${promptPrefix.trim()} ${shot.imagePrompt}` : shot.imagePrompt,
        aspectRatio: shotAR,
        shotNumber: shot.number,
        outputFolder: outputFolder || undefined,
        safetyChecker: shotSafety,
      };

      if (shotHasRefs && model.capability === "image-to-image") {
        body.referenceImageUrls = allRefs;
      }

      console.log(`[Shot #${shot.number}] Model: ${model.id} (${model.capability})`, {
        charRefs: charRefUrls.length,
        shotRefs: shotRefUrls.length,
        totalRefs: allRefs.length,
        hasRefs: shotHasRefs,
        sentRefs: body.referenceImageUrls ? (body.referenceImageUrls as string[]).length : 0,
      });

      const res = await fetch("/api/generate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        updateShot(shot.id, {
          imageStatus: "error",
          error: data.error || "Generation failed",
        });
        return;
      }

      // Push previous image to history before replacing
      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== shot.id) return s;
          const prevHistory = s.imageHistory ?? [];
          const newHistory = s.imageUrl ? [s.imageUrl, ...prevHistory] : prevHistory;
          return {
            ...s,
            imageStatus: "done" as ShotStatus,
            imageUrl: data.imageUrl,
            localImagePath: data.localPath,
            videoStatus: "pending" as ShotStatus,
            videoUrl: null,
            localVideoPath: null,
            error: null,
            imageHistory: newHistory,
          };
        })
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateShot(shot.id, { imageStatus: "pending", error: "Cancelled" });
        return;
      }
      updateShot(shot.id, {
        imageStatus: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      delete abortControllers.current[abortKey];
    }
  };

  // --- Single Shot Animation (reusable) ---
  const animateSingleShot = async (shot: Shot) => {
    if (!shot.imageUrl) return;

    const abortKey = `vid_${shot.id}`;
    abortControllers.current[abortKey]?.abort();
    const controller = new AbortController();
    abortControllers.current[abortKey] = controller;

    updateShot(shot.id, { videoStatus: "generating", error: null });

    // Per-shot settings override globals
    const shotDuration = shot.settings.video.duration ?? duration;
    const shotAspectRatio = shot.settings.video.aspectRatio ?? aspectRatio;
    const shotResolution = shot.settings.video.resolution ?? null;
    const shotVideoModelId = shot.settings.video.modelId ?? selectedVideoModel.id;

    try {
      const animateBody: Record<string, unknown> = {
        videoModelId: shotVideoModelId,
        prompt: shot.videoPrompt,
        imageUrl: shot.imageUrl,
        duration: shotDuration,
        aspectRatio: shotAspectRatio,
        shotNumber: shot.number,
        outputFolder: outputFolder || undefined,
      };

      // End image (last frame)
      if (shot.endImageUrl) {
        animateBody.endImageUrl = shot.endImageUrl;
      }

      // Resolution
      if (shotResolution) {
        animateBody.resolution = shotResolution;
      }

      // Camera fixed
      if (shot.settings.video.cameraFixed != null) {
        animateBody.cameraFixed = shot.settings.video.cameraFixed;
      }

      // Generate audio — default OFF
      animateBody.generateAudio = shot.settings.video.generateAudio ?? false;

      const res = await fetch("/api/animate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(animateBody),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        updateShot(shot.id, {
          videoStatus: "error",
          error: data.error || "Animation failed",
        });
        return;
      }

      updateShot(shot.id, {
        videoStatus: "done",
        videoUrl: data.videoUrl,
        localVideoPath: data.localPath,
        error: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateShot(shot.id, { videoStatus: "pending", error: "Cancelled" });
        return;
      }
      updateShot(shot.id, {
        videoStatus: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      delete abortControllers.current[abortKey];
    }
  };

  // --- Cancel a shot's generation ---
  const cancelShot = (shotId: string, type: "image" | "video") => {
    const abortKey = type === "image" ? `img_${shotId}` : `vid_${shotId}`;
    const controller = abortControllers.current[abortKey];
    if (controller) {
      controller.abort();
      delete abortControllers.current[abortKey];
    }
    // Force-reset status immediately (server may still be running but UI is unblocked)
    if (type === "image") {
      updateShot(shotId, { imageStatus: "pending", error: "Cancelled" });
    } else {
      updateShot(shotId, { videoStatus: "pending", error: "Cancelled" });
    }
  };

  // --- Batch Image Generation ---
  const generateAllImages = async () => {
    setIsBatchGenerating(true);
    const shotsToGenerate = shots.filter(
      (s) => s.imageStatus === "pending" || s.imageStatus === "error"
    );
    await Promise.allSettled(shotsToGenerate.map((s) => generateSingleShot(s)));
    setIsBatchGenerating(false);
  };

  // --- Batch Video Animation ---
  const animateAll = async () => {
    setIsBatchAnimating(true);
    const shotsToAnimate = shots.filter(
      (s) =>
        s.imageStatus === "done" &&
        s.imageUrl &&
        (s.videoStatus === "pending" || s.videoStatus === "error")
    );
    await Promise.allSettled(shotsToAnimate.map((s) => animateSingleShot(s)));
    setIsBatchAnimating(false);
  };

  // --- Computed ---
  const sortedShots = useMemo(
    () => [...shots].sort((a, b) => compareShotNumbers(a.number, b.number)),
    [shots]
  );
  const selectableModels = getSelectableModels();

  // Whether any refs exist (project-level or per-shot)
  const hasAnyRefs = charRefs.some((r) => r.url);

  // The actual model that will be used (auto-switches to edit variant when refs present)
  const effectiveModel = resolveModel(selectedImageModel.id, hasAnyRefs) ?? selectedImageModel;

  const imagesCompleted = shots.filter((s) => s.imageStatus === "done").length;
  const imagesGenerating = shots.filter(
    (s) => s.imageStatus === "generating"
  ).length;
  const videosCompleted = shots.filter((s) => s.videoStatus === "done").length;
  const videosGenerating = shots.filter(
    (s) => s.videoStatus === "generating"
  ).length;
  const allImagesDone =
    shots.length > 0 && shots.every((s) => s.imageStatus === "done");

  const estimatedImageCost = (() => {
    const cost = parseFloat(
      effectiveModel.costPerImage.replace(/[^0-9.]/g, "")
    );
    return (cost * shots.length).toFixed(2);
  })();

  const estimatedVideoCost = (() => {
    const costPer5 = parseFloat(
      selectedVideoModel.costPer5Sec.replace(/[^0-9.]/g, "")
    );
    const costPerSec = costPer5 / 5;
    const readyShots = shots.filter((s) => s.imageStatus === "done").length;
    return (costPerSec * duration * readyShots).toFixed(2);
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-muted hover:text-foreground">
              &larr; Generator
            </a>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-accent">Shot</span> List Production
            </h1>
          </div>
          <span className="text-sm text-muted">
            {shots.length} shot{shots.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Settings Bar */}
      <div className="border-b border-border bg-surface px-6 py-4 space-y-3">
        {/* Top row: Output Folder + Prompt Prefix */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
          {/* Output Folder */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Output Folder
            </label>
            <input
              type="text"
              value={outputFolder}
              onChange={(e) => handleOutputFolderChange(e.target.value)}
              placeholder="G:\My Drive\Shorts\PROJECT"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
            />
          </div>

          {/* Prompt Prefix */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Prompt Prefix
              <span className="ml-1.5 text-muted/50">(prepended to every shot)</span>
            </label>
            <input
              type="text"
              value={promptPrefix}
              onChange={(e) => {
                setPromptPrefix(e.target.value);
                localStorage.setItem(STORAGE_KEYS.promptPrefix, e.target.value);
              }}
              placeholder="The same donkey with the same animated characteristics. Do not modify the animation style - on a white background."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
            />
          </div>
        </div>

        {/* Bottom row: Models + Settings */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">

          {/* Image Model */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Image Model
              {hasAnyRefs && effectiveModel.id !== selectedImageModel.id && (
                <span className="ml-1.5 text-accent">
                  (Edit mode)
                </span>
              )}
            </label>
            <select
              value={selectedImageModel.id}
              onChange={(e) => {
                const m = MODELS.find((m) => m.id === e.target.value);
                if (m) {
                  setSelectedImageModel(m);
                  localStorage.setItem(STORAGE_KEYS.imageModel, m.id);
                }
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {selectableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.costPerImage}
                </option>
              ))}
            </select>
          </div>

          {/* Video Model */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Video Model
            </label>
            <select
              value={selectedVideoModel.id}
              onChange={(e) => {
                const m = VIDEO_MODELS.find((m) => m.id === e.target.value);
                if (m) {
                  setSelectedVideoModel(m);
                  localStorage.setItem(STORAGE_KEYS.videoModel, m.id);
                  if (!m.durations.includes(duration)) {
                    const newDur = m.defaultDuration;
                    setDuration(newDur);
                    saveToStorage(STORAGE_KEYS.duration, newDur);
                  }
                }
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {VIDEO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.costPer5Sec}/5s
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDuration(d);
                saveToStorage(STORAGE_KEYS.duration, d);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {selectedVideoModel.durations.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Aspect Ratio
            </label>
            <div className="flex gap-1.5">
              {["9:16", "16:9", "1:1"].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => {
                    setAspectRatio(ratio);
                    saveToStorage(STORAGE_KEYS.aspectRatio, ratio);
                  }}
                  className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium transition ${
                    aspectRatio === ratio
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:border-accent/30"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Character References */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Character Refs
            </label>
            <div className="flex items-center gap-2">
              {charRefs.map((ref) => (
                <div
                  key={ref.id}
                  className="relative h-9 w-9 overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.preview}
                    alt="Ref"
                    className="h-full w-full object-cover"
                  />
                  {ref.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <div className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
                    </div>
                  )}
                  <button
                    onClick={() => removeCharRef(ref.id)}
                    className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-1 text-[10px] text-muted hover:text-foreground"
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                onClick={() => charRefInput.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border text-muted transition hover:border-accent/50 hover:text-accent"
              >
                +
              </button>
              <input
                ref={charRefInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleCharRefUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Shot List Actions */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPasteModal(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent-hover"
          >
            Paste Shot List
          </button>
          <button
            onClick={addShot}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-accent/50 hover:text-foreground"
          >
            + Add Shot
          </button>
        </div>
        <div className="flex rounded-md border border-border">
          <button
            onClick={() => { setViewMode("list"); saveToStorage("dreamsun_shots_view", "list"); }}
            className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
          >List</button>
          <button
            onClick={() => { setViewMode("storyboard"); saveToStorage("dreamsun_shots_view", "storyboard"); }}
            className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === "storyboard" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
          >Storyboard</button>
        </div>
      </div>

      {/* Shot Cards */}
      <div className={viewMode === "storyboard" ? "px-6 py-4 overflow-x-auto" : "px-6 py-4"}>
        {shots.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center text-muted">
              <p className="mb-2 text-sm">No shots yet</p>
              <p className="text-xs">
                Paste a shot list or add shots manually
              </p>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {sortedShots.map((shot, idx) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                globalDuration={duration}
                globalAspectRatio={aspectRatio}
                videoModel={selectedVideoModel}
                onUpdate={(updates) => updateShot(shot.id, updates)}
                onRemove={() => removeShot(shot.id)}
                onMoveUp={idx > 0 ? () => moveShot(shot.id, "up") : undefined}
                onMoveDown={idx < sortedShots.length - 1 ? () => moveShot(shot.id, "down") : undefined}
                onRefUpload={(e) => handleShotRefUpload(shot.id, e)}
                onRefFileDrop={(files) => handleShotRefFiles(shot.id, files)}
                onRefRemove={(refId) => removeShotRef(shot.id, refId)}
                refInputRef={(el) => {
                  shotRefInputs.current[shot.id] = el;
                }}
                onGenerateImage={() => generateSingleShot(shot)}
                onAnimateShot={() => animateSingleShot(shot)}
                onCancelImage={() => cancelShot(shot.id, "image")}
                onCancelVideo={() => cancelShot(shot.id, "video")}
                onOpenLightbox={(src, type) => setLightbox({ src, type, shotNumber: shot.number })}
                onEndFrameUpload={(e) => handleEndFrameUpload(shot.id, e)}
                onEndFrameRemove={() => removeEndFrame(shot.id)}
                onImageSettingsChange={(updates) => updateShotImageSettings(shot.id, updates)}
                onVideoSettingsChange={(updates) => updateShotVideoSettings(shot.id, updates)}
                imageModel={selectedImageModel}
                onDropOnFirst={(url) => updateShot(shot.id, { imageUrl: url })}
                onDropOnLast={(url) => updateShot(shot.id, { endImageUrl: url })}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
            {sortedShots.map((shot) => (
              <StoryboardCard
                key={shot.id}
                shot={shot}
                globalDuration={duration}
                globalAspectRatio={aspectRatio}
                videoModel={selectedVideoModel}
                imageModel={selectedImageModel}
                onUpdate={(updates) => updateShot(shot.id, updates)}
                onRemove={() => removeShot(shot.id)}
                onRefUpload={(e) => handleShotRefUpload(shot.id, e)}
                onRefFileDrop={(files) => handleShotRefFiles(shot.id, files)}
                onRefRemove={(refId) => removeShotRef(shot.id, refId)}
                refInputRef={(el) => { shotRefInputs.current[shot.id] = el; }}
                onGenerateImage={() => generateSingleShot(shot)}
                onAnimateShot={() => animateSingleShot(shot)}
                onCancelImage={() => cancelShot(shot.id, "image")}
                onCancelVideo={() => cancelShot(shot.id, "video")}
                onOpenLightbox={(src, type) => setLightbox({ src, type, shotNumber: shot.number })}
                onEndFrameUpload={(e) => handleEndFrameUpload(shot.id, e)}
                onEndFrameRemove={() => removeEndFrame(shot.id)}
                onImageSettingsChange={(updates) => updateShotImageSettings(shot.id, updates)}
                onVideoSettingsChange={(updates) => updateShotVideoSettings(shot.id, updates)}
                onDropOnFirst={(url) => updateShot(shot.id, { imageUrl: url })}
                onDropOnLast={(url) => updateShot(shot.id, { endImageUrl: url })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      {shots.length > 0 && (
        <div className="sticky bottom-0 border-t border-border bg-surface px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm text-muted">
              <span>
                {shots.length} shot{shots.length !== 1 ? "s" : ""}
              </span>
              <span>
                Images: {imagesCompleted}/{shots.length}
                {imagesGenerating > 0 && (
                  <span className="text-accent">
                    {" "}
                    ({imagesGenerating} generating)
                  </span>
                )}
              </span>
              <span>
                Videos: {videosCompleted}/{shots.length}
                {videosGenerating > 0 && (
                  <span className="text-accent">
                    {" "}
                    ({videosGenerating} generating)
                  </span>
                )}
              </span>
              <span>Est. ~${estimatedImageCost} images</span>
              {allImagesDone && <span>Est. ~${estimatedVideoCost} videos</span>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={generateAllImages}
                disabled={
                  isBatchGenerating ||
                  shots.length === 0 ||
                  shots.every((s) => s.imageStatus === "done")
                }
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchGenerating
                  ? `Generating (${imagesCompleted}/${shots.length})...`
                  : "Generate All Images"}
              </button>
              <button
                onClick={animateAll}
                disabled={!allImagesDone || isBatchAnimating}
                className="rounded-md border border-accent bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchAnimating
                  ? `Animating (${videosCompleted}/${shots.filter((s) => s.imageStatus === "done").length})...`
                  : "Animate All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightbox && (
        <Lightbox
          src={lightbox.src}
          type={lightbox.type}
          shotNumber={lightbox.shotNumber}
          onClose={() => setLightbox(null)}
          onNewShotFromRef={createShotFromRef}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Delete Shot {deleteConfirm.label}?</h2>
            <p className="mb-4 text-xs text-muted">This cannot be undone. The shot and all its generated images will be removed.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground">Cancel</button>
              <button onClick={confirmRemoveShot}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* New Shot from Ref Modal */}
      {newShotModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setNewShotModal(null)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-semibold">New Shot from Reference</h2>
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newShotModal.imageUrl} alt="Ref" className="h-16 w-12 rounded border border-border object-cover" />
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted">Shot Number</label>
                <input
                  type="text"
                  defaultValue={newShotModal.suggestedNumber}
                  autoFocus
                  id="new-shot-number-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.replace(/[^0-9a-zA-Z]/g, "") || newShotModal.suggestedNumber;
                      confirmNewShotFromRef(newShotModal.imageUrl, val);
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
                  placeholder={`e.g. ${newShotModal.suggestedNumber} or 1B`}
                />
                <p className="mt-1 text-[10px] text-muted">Type a number like &quot;5&quot; or &quot;1B&quot; to insert between shots</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNewShotModal(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground">Cancel</button>
              <button onClick={() => {
                const input = document.getElementById("new-shot-number-input") as HTMLInputElement;
                const val = input?.value.replace(/[^0-9a-zA-Z]/g, "") || newShotModal.suggestedNumber;
                confirmNewShotFromRef(newShotModal.imageUrl, val);
              }} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover">Create Shot</button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold">Paste Shot List</h2>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`SHOT 1 — Title\nIMAGE: image prompt here\nVIDEO: video prompt here\n\nSHOT 2 — Title\nIMAGE: image prompt here\nVIDEO: video prompt here`}
              rows={16}
              className="w-full resize-y rounded-md border border-border bg-background px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
              autoFocus
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPasteText("");
                }}
                className="rounded-md border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!pasteText.trim()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent-hover disabled:opacity-50"
              >
                Parse & Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Shot Card Component ---

function ShotCard({
  shot,
  globalDuration,
  globalAspectRatio,
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
}: {
  shot: Shot;
  globalDuration: number;
  globalAspectRatio: string;
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
}) {
  const [showSettings, setShowSettings] = useState(false);

  const statusColors: Record<ShotStatus, string> = {
    pending: "border-border text-muted",
    generating: "border-accent text-accent",
    done: "border-green-500 text-green-400",
    error: "border-red-500 text-red-400",
  };

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

  const selectableModels = getSelectableModels();
  // Resolve the effective video model for this shot (for showing durations/resolutions)
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
    <div className={`rounded-lg border bg-surface p-4 transition-colors ${
      isBusy ? "border-accent/60 shadow-[0_0_12px_-3px] shadow-accent/20" : "border-border"
    }`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="shrink-0 flex items-center gap-0.5">
          <div className="flex flex-col -mr-0.5">
            <button onClick={onMoveUp} disabled={!onMoveUp}
              className="px-0.5 text-[9px] leading-none text-muted transition hover:text-accent disabled:opacity-20 disabled:hover:text-muted">▲</button>
            <button onClick={onMoveDown} disabled={!onMoveDown}
              className="px-0.5 text-[9px] leading-none text-muted transition hover:text-accent disabled:opacity-20 disabled:hover:text-muted">▼</button>
          </div>
          <div className="flex items-center rounded bg-accent/10">
            <span className="pl-2 text-xs font-bold text-accent">#</span>
            <input type="text" value={shot.number}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9a-zA-Z]/g, ""); if (v) onUpdate({ number: v }); }}
              className="w-10 bg-transparent py-0.5 pr-1 text-center text-xs font-bold text-accent outline-none" />
          </div>
        </div>
        <input type="text" value={shot.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Shot title"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted/40" />
        {isBusy && (
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-accent">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {isImageBusy ? "Generating image…" : "Animating…"}
          </span>
        )}
        <button onClick={() => setShowSettings(!showSettings)}
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${hasOverrides ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-muted hover:border-accent/30"}`}
        >{showSettings ? "Less" : "More"}</button>
        <button onClick={onRemove} className="shrink-0 text-xs text-muted hover:text-red-400">delete</button>
      </div>

      {shot.error && <p className="mb-2 text-xs text-red-400">{shot.error}</p>}

      {/* 3-column: Image Controls | Video Controls | Output */}
      <div className="flex gap-4">

        {/* COL 1: Image Controls */}
        <div className="min-w-0 flex-1 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Image</span>
          <textarea value={shot.imagePrompt}
            onChange={(e) => onUpdate({ imagePrompt: e.target.value })}
            rows={3} placeholder="Image prompt..."
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
          {/* Refs */}
          <div className="flex items-center gap-1.5"
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
            onDrop={(e) => { if (e.dataTransfer.files.length > 0) { e.preventDefault(); onRefFileDrop(Array.from(e.dataTransfer.files)); } }}>
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted">Refs:</span>
            {refImages.map((ref) => (
              <div key={ref.id} className="relative h-7 w-7 overflow-hidden rounded border border-border" draggable onDragStart={(e) => ref.url && handleDragStart(e, ref.url)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref.preview} alt="Ref" className="h-full w-full object-cover" />
                {ref.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                <button onClick={() => onRefRemove(ref.id)} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[8px] text-muted hover:text-foreground">x</button>
              </div>
            ))}
            <button onClick={() => (document.getElementById(`shot-ref-${shot.id}`) as HTMLInputElement)?.click()}
              className="flex h-7 w-7 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted hover:border-accent/50 hover:text-accent">+</button>
            <input id={`shot-ref-${shot.id}`} ref={refInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onRefUpload} className="hidden" />
          </div>
          {/* Generate button */}
          {isImageBusy ? (
            <button onClick={onCancelImage} className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20">Cancel</button>
          ) : (
            <button onClick={onGenerateImage} className="rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-black hover:bg-accent-hover">
              {shot.imageStatus === "done" ? "Regenerate" : "Generate"}</button>
          )}
          {/* Advanced image settings */}
          {showSettings && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Model</label>
                <select value={imgSettings.modelId ?? ""} onChange={(e) => onImageSettingsChange({ modelId: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-accent">
                  <option value="">Global</option>
                  {selectableModels.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Ratio</label>
                <select value={imgSettings.aspectRatio ?? ""} onChange={(e) => onImageSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-accent">
                  <option value="">Global</option>
                  {["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"].map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* COL 2: Video Controls */}
        <div className="min-w-0 flex-1 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Video</span>
          <textarea value={shot.videoPrompt}
            onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
            rows={3} placeholder="Video/motion prompt..."
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
          {/* Last frame */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted">Last frame:</span>
            {endFrameSrc ? (
              <div className="relative h-7 w-7 overflow-hidden rounded border border-blue-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={endFrameSrc} alt="End" className="h-full w-full object-cover" />
                {endFrameUploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                <button onClick={onEndFrameRemove} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[8px] text-muted hover:text-foreground">x</button>
              </div>
            ) : (
              <button onClick={() => (document.getElementById(`end-frame-${shot.id}`) as HTMLInputElement)?.click()}
                className="flex h-7 items-center rounded border border-dashed border-border px-1.5 text-[9px] text-muted hover:border-blue-500/40 hover:text-blue-400">+ upload</button>
            )}
            <input id={`end-frame-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={onEndFrameUpload} className="hidden" />
          </div>
          {/* Duration / Ratio / Res */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium uppercase text-muted">Dur</span>
              <select value={vidSettings.duration ?? ""} onChange={(e) => onVideoSettingsChange({ duration: e.target.value ? Number(e.target.value) : null })}
                className="rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-accent">
                <option value="">{globalDuration}s</option>
                {(effVideoModel.durations ?? []).map((d) => (<option key={d} value={d}>{d}s</option>))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium uppercase text-muted">Ratio</span>
              <select value={vidSettings.aspectRatio ?? ""} onChange={(e) => onVideoSettingsChange({ aspectRatio: e.target.value || null })}
                className="rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-accent">
                <option value="">{globalAspectRatio}</option>
                {(effVideoModel.aspectRatios ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            {(effVideoModel.resolutions?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-medium uppercase text-muted">Res</span>
                <select value={vidSettings.resolution ?? ""} onChange={(e) => onVideoSettingsChange({ resolution: e.target.value || null })}
                  className="rounded border border-border bg-background px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-accent">
                  <option value="">{effVideoModel.defaultResolution}</option>
                  {(effVideoModel.resolutions ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
            )}
            {effVideoModel.supportsGenerateAudio && (
              <button
                onClick={() => onVideoSettingsChange({ generateAudio: vidSettings.generateAudio === true ? null : true })}
                className={`rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase transition ${
                  vidSettings.generateAudio === true
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-border bg-background text-muted hover:border-accent/30"
                }`}
              >{vidSettings.generateAudio === true ? "Sound on" : "Sound off"}</button>
            )}
          </div>
          {/* Animate button */}
          {isVideoBusy ? (
            <button onClick={onCancelVideo} className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20">Cancel</button>
          ) : (
            <button onClick={onAnimateShot} disabled={!canAnimate}
              className="rounded-md border border-accent bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50">
              {shot.videoStatus === "done" ? "Re-animate" : "Animate"}</button>
          )}
          {/* Advanced video settings */}
          {showSettings && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Model</label>
                <select value={vidSettings.modelId ?? ""} onChange={(e) => {
                  const id = e.target.value || null;
                  onVideoSettingsChange({ modelId: id });
                  if (id) { const m = VIDEO_MODELS.find((v) => v.id === id); if (m && vidSettings.resolution && !m.resolutions.includes(vidSettings.resolution)) onVideoSettingsChange({ modelId: id, resolution: null }); }
                }} className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-accent">
                  <option value="">Global</option>
                  {VIDEO_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              {effVideoModel.supportsCameraFixed && (
                <div>
                  <label className="mb-0.5 block text-[9px] font-medium uppercase text-muted">Camera</label>
                  <select value={vidSettings.cameraFixed == null ? "" : vidSettings.cameraFixed ? "true" : "false"}
                    onChange={(e) => onVideoSettingsChange({ cameraFixed: e.target.value === "" ? null : e.target.value === "true" })}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-accent">
                    <option value="">Auto</option><option value="true">Fixed</option><option value="false">Free</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COL 3: Output — First / Last / Video */}
        <div className="flex shrink-0 gap-2">
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
                    className="h-28 w-[72px] rounded-md border border-border object-cover transition hover:border-accent cursor-grab" />
                </button>
                <button onClick={() => onUpdate({ imageUrl: null, imageStatus: "pending" as ShotStatus })}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-[9px] text-muted shadow hover:text-foreground">×</button>
              </div>
            ) : (
              <div className="flex h-28 w-[72px] items-center justify-center rounded-md border-2 border-dashed border-border">
                {isImageBusy ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  : <span className="text-[9px] text-muted/40">Drop or<br/>generate</span>}
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
                    className="h-28 w-[72px] rounded-md border border-blue-500/30 object-cover transition hover:border-blue-500/60 cursor-grab" />
                </button>
                <button onClick={onEndFrameRemove}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-[9px] text-muted shadow hover:text-foreground">×</button>
                {endFrameUploading && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>}
              </div>
            ) : (
              <div className="flex h-28 w-[72px] items-center justify-center rounded-md border-2 border-dashed border-blue-500/20">
                <span className="text-[9px] text-muted/40">Drop or<br/>upload</span>
              </div>
            )}
          </div>

          {/* Video */}
          <div className="text-center">
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-muted">Video</span>
            {shot.videoUrl ? (
              <button onClick={() => onOpenLightbox(shot.videoUrl!, "video")} className="block">
                <div className="flex h-28 w-[72px] items-center justify-center rounded-md border border-green-500/30 bg-green-500/5 transition hover:border-green-500/60">
                  <span className="text-[9px] text-green-400">Ready</span>
                </div>
              </button>
            ) : (
              <div className="flex h-28 w-[72px] items-center justify-center rounded-md border border-dashed border-border">
                {isVideoBusy ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  : <span className="text-[9px] text-muted/40">No video</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation History */}
      {history.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-2">
          <span className="mb-1.5 block text-[9px] font-medium uppercase tracking-wider text-muted">
            History ({history.length})
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {history.map((url, i) => (
              <div key={i} draggable onDragStart={(e) => handleDragStart(e, url)}
                className="relative shrink-0 cursor-grab">
                <button onClick={() => onOpenLightbox(url, "image")} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`History ${i + 1}`}
                    className="h-14 w-10 rounded border border-border/50 object-cover transition hover:border-accent" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Storyboard Card Component ---

function StoryboardCard({
  shot,
  globalDuration,
  globalAspectRatio,
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
}: {
  shot: Shot;
  globalDuration: number;
  globalAspectRatio: string;
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
}) {
  const [expandedSection, setExpandedSection] = useState<"image" | "video" | null>(null);

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
    <div className={`flex w-52 shrink-0 flex-col rounded-lg border bg-surface transition-colors ${
      isBusy ? "border-accent/60 shadow-[0_0_12px_-3px] shadow-accent/20" : "border-border"
    }`}>
      {/* Hero Image — First Frame */}
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
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white/80 hover:text-white">×</button>
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
            {shot.videoUrl && <span className="text-[9px] text-green-400">▶</span>}
            <span className="text-[10px] text-white/70">{effDuration}s</span>
          </div>
        </div>

        {/* Last frame mini overlay */}
        {endFrameSrc && (
          <div className="absolute right-1.5 bottom-8 h-10 w-7 overflow-hidden rounded border border-blue-500/40 shadow"
            draggable onDragStart={(e) => handleDragStart(e, shot.endImageUrl ?? endFrameSrc)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, "last")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={endFrameSrc} alt="Last" className="h-full w-full object-cover" />
            <button onClick={onEndFrameRemove}
              className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-black/70 text-[7px] text-white/80 hover:text-white">×</button>
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
          <button onClick={onCancelImage} className="flex-1 rounded border border-red-500/50 bg-red-500/10 py-1 text-[10px] font-medium text-red-400">Cancel</button>
        ) : (
          <button onClick={onGenerateImage} className="flex-1 rounded bg-accent py-1 text-[10px] font-medium text-black hover:bg-accent-hover">
            {shot.imageStatus === "done" ? "Regen" : "Generate"}</button>
        )}
        {isVideoBusy ? (
          <button onClick={onCancelVideo} className="flex-1 rounded border border-red-500/50 bg-red-500/10 py-1 text-[10px] font-medium text-red-400">Cancel</button>
        ) : (
          <button onClick={onAnimateShot} disabled={!canAnimate}
            className="flex-1 rounded border border-accent bg-accent/10 py-1 text-[10px] font-medium text-accent hover:bg-accent/20 disabled:opacity-40">
            {shot.videoStatus === "done" ? "Re-anim" : "Animate"}</button>
        )}
      </div>

      {/* Expandable sections */}
      <div className="border-t border-border/50 px-2 py-1">
        {/* Image section toggle */}
        <button onClick={() => setExpandedSection(expandedSection === "image" ? null : "image")}
          className={`w-full flex items-center justify-between py-1 text-[9px] font-semibold uppercase tracking-wider transition ${
            expandedSection === "image" ? "text-accent" : "text-muted hover:text-foreground"}`}>
          <span>Image</span>
          <span>{expandedSection === "image" ? "−" : "+"}</span>
        </button>
        {expandedSection === "image" && (
          <div className="space-y-2 pb-2">
            <textarea value={shot.imagePrompt}
              onChange={(e) => onUpdate({ imagePrompt: e.target.value })}
              rows={3} placeholder="Image prompt..."
              className="w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
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
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-accent">
                  <option value="">Global</option>
                  {selectableModels.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Ratio</label>
                <select value={imgSettings.aspectRatio ?? ""} onChange={(e) => onImageSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-accent">
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
          <span>{expandedSection === "video" ? "−" : "+"}</span>
        </button>
        {expandedSection === "video" && (
          <div className="space-y-2 pb-2">
            <textarea value={shot.videoPrompt}
              onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
              rows={3} placeholder="Video/motion prompt..."
              className="w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted/40 focus:border-accent" />
            {/* Last frame */}
            <div className="flex items-center gap-1"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "last")}>
              <span className="text-[8px] font-medium uppercase text-muted">Last:</span>
              {endFrameSrc ? (
                <div className="relative h-6 w-6 overflow-hidden rounded border border-blue-500/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={endFrameSrc} alt="End" className="h-full w-full object-cover" />
                  <button onClick={onEndFrameRemove} className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[7px] text-muted hover:text-foreground">x</button>
                </div>
              ) : (
                <button onClick={() => (document.getElementById(`sb-end-${shot.id}`) as HTMLInputElement)?.click()}
                  className="rounded border border-dashed border-border px-1 text-[8px] text-muted hover:border-blue-500/40 hover:text-blue-400">+ upload</button>
              )}
              <input id={`sb-end-${shot.id}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={onEndFrameUpload} className="hidden" />
            </div>
            {/* Duration / Ratio / Res / Sound */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Duration</label>
                <select value={vidSettings.duration ?? ""} onChange={(e) => onVideoSettingsChange({ duration: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-accent">
                  <option value="">{globalDuration}s</option>
                  {(effVideoModel.durations ?? []).map((d) => (<option key={d} value={d}>{d}s</option>))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Ratio</label>
                <select value={vidSettings.aspectRatio ?? ""} onChange={(e) => onVideoSettingsChange({ aspectRatio: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-accent">
                  <option value="">{globalAspectRatio}</option>
                  {(effVideoModel.aspectRatios ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
              {(effVideoModel.resolutions?.length ?? 0) > 0 && (
                <div>
                  <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Res</label>
                  <select value={vidSettings.resolution ?? ""} onChange={(e) => onVideoSettingsChange({ resolution: e.target.value || null })}
                    className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-accent">
                    <option value="">{effVideoModel.defaultResolution}</option>
                    {(effVideoModel.resolutions ?? []).map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-0.5 block text-[8px] font-medium uppercase text-muted">Model</label>
                <select value={vidSettings.modelId ?? ""} onChange={(e) => onVideoSettingsChange({ modelId: e.target.value || null })}
                  className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none focus:border-accent">
                  <option value="">Global</option>
                  {VIDEO_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
              </div>
            </div>
            {effVideoModel.supportsGenerateAudio && (
              <button onClick={() => onVideoSettingsChange({ generateAudio: vidSettings.generateAudio === true ? null : true })}
                className={`w-full rounded border py-0.5 text-[9px] font-medium uppercase transition ${
                  vidSettings.generateAudio === true
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-border bg-background text-muted hover:border-accent/30"
                }`}>{vidSettings.generateAudio === true ? "Sound on" : "Sound off"}</button>
            )}
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="border-t border-border/30 px-2 py-1">
        <button onClick={onRemove} className="w-full text-center text-[9px] text-muted/50 hover:text-red-400">delete</button>
      </div>
    </div>
  );
}

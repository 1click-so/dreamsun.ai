"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { fal } from "@fal-ai/client";
import { MODELS, type ModelConfig, getSelectableModels, resolveModel } from "@/lib/models";
import { Settings2, Plus, ClipboardList, LayoutList, LayoutGrid, Zap, Film, ChevronDown } from "lucide-react";
import { VIDEO_MODELS, type VideoModelConfig } from "@/lib/video-models";
import { parseShotList, type ParsedShot } from "@/lib/shot-parser";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Lightbox } from "@/components/shots/Lightbox";
import { ShotCard } from "@/components/shots/ShotCard";
import { StoryboardCard } from "@/components/shots/StoryboardCard";
import type { Shot, ShotStatus, ImageSettings, VideoSettings, ShotSettings, UploadedRef } from "@/types/shots";

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

// Types imported from @/types/shots

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
  imageResolution: "dreamsun_shots_img_res",
  numImages: "dreamsun_shots_num_images",
  safetyChecker: "dreamsun_shots_safety",
  resolution: "dreamsun_shots_resolution",
  generateAudio: "dreamsun_shots_audio",
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

// Lightbox, Select, ShotCard, StoryboardCard imported from components

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
  const [imageResolution, setImageResolution] = useState(() =>
    loadFromStorage<string>(STORAGE_KEYS.imageResolution, "1k")
  );
  const [numImages, setNumImages] = useState(() =>
    loadFromStorage(STORAGE_KEYS.numImages, 1)
  );
  const [safetyChecker, setSafetyChecker] = useState(() =>
    loadFromStorage(STORAGE_KEYS.safetyChecker, false)
  );
  const [duration, setDuration] = useState(() =>
    loadFromStorage(STORAGE_KEYS.duration, 5)
  );
  const [resolution, setResolution] = useState(() =>
    loadFromStorage<string>(STORAGE_KEYS.resolution, "720p")
  );
  const [generateAudio, setGenerateAudio] = useState(() =>
    loadFromStorage(STORAGE_KEYS.generateAudio, false)
  );

  // --- View mode ---
  const [viewMode, setViewMode] = useState<"list" | "storyboard">(() =>
    loadFromStorage("dreamsun_shots_view", "list") as "list" | "storyboard"
  );

  // --- Settings panel toggle ---
  const [showSettings, setShowSettings] = useState(false);

  // --- Localhost detection (for output folder) ---
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

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
    setShots((prev) => {
      const maxNum = prev.reduce((max, s) => {
        const n = parseInt(String(s.number), 10) || 0;
        return n > max ? n : max;
      }, 0);
      return [
        ...prev,
        createShot({
          number: String(maxNum + 1),
          title: "",
          imagePrompt: "",
          videoPrompt: "",
        }),
      ];
    });
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

  // --- Master setting change: reset per-shot overrides so all shots inherit the new global ---
  const resetAllShotImageSettings = (key: keyof ImageSettings) => {
    setShots((prev) => prev.map((s) => ({
      ...s,
      settings: { ...s.settings, image: { ...s.settings.image, [key]: null } },
    })));
  };
  const resetAllShotVideoSettings = (key: keyof VideoSettings) => {
    setShots((prev) => prev.map((s) => ({
      ...s,
      settings: { ...s.settings, video: { ...s.settings.video, [key]: null } },
    })));
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
      const shotSafety = shot.settings.image.safetyChecker ?? safetyChecker;

      const body: Record<string, unknown> = {
        modelId: model.id,
        prompt: promptPrefix ? `${promptPrefix.trim()} ${shot.imagePrompt}` : shot.imagePrompt,
        aspectRatio: shotAR,
        shotNumber: shot.number,
        outputFolder: outputFolder || undefined,
        safetyChecker: shotSafety,
        numImages,
        imageResolution,
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

      // All generated image URLs (first is primary, rest are alternatives)
      const allUrls: string[] = data.allImageUrls ?? [data.imageUrl];

      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== shot.id) return s;
          const prevGenerations = s.imageHistory ?? [];
          // All new images go to generations (newest batch first), then previous generations
          return {
            ...s,
            imageStatus: "done" as ShotStatus,
            imageUrl: allUrls[0],
            localImagePath: data.localPath,
            videoStatus: "pending" as ShotStatus,
            videoUrl: null,
            localVideoPath: null,
            error: null,
            imageHistory: [...allUrls, ...prevGenerations],
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
    const shotResolution = shot.settings.video.resolution ?? resolution;
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

      // Generate audio — per-shot overrides global, global defaults to off
      animateBody.generateAudio = shot.settings.video.generateAudio ?? generateAudio;

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
      <Navbar />
      {/* Page Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-2.5">
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="text-accent">Shot</span> List Production
        </h1>
        <span className="text-xs text-muted">
          {shots.length} shot{shots.length !== 1 ? "s" : ""}
        </span>
      </header>

      {/* Command Bar */}
      <div className="px-6 py-3">
        <div className="rounded-xl border border-border bg-surface/50 p-2">
          {/* Top row: actions + stats + controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Shot Actions */}
            <Button variant="primary" size="sm" onClick={() => setShowPasteModal(true)}>
              <ClipboardList size={13} />
              Paste Shot List
            </Button>
            <Button variant="secondary" size="sm" onClick={addShot}>
              <Plus size={13} />
              Add Shot
            </Button>

            <div className="h-5 w-px bg-border" />

            {/* Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={showSettings ? "bg-accent/10 text-accent" : ""}
            >
              <Settings2 size={14} />
              Settings
              <ChevronDown size={11} className={`ml-0.5 transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`} />
            </Button>

            <div className="flex-1" />

            {/* Stats */}
            {shots.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-1.5 text-[11px] text-muted">
                <span>{shots.length} shot{shots.length !== 1 ? "s" : ""}</span>
                <span className="text-border">|</span>
                <span>
                  Img {imagesCompleted}/{shots.length}
                  {imagesGenerating > 0 && <span className="text-accent"> ({imagesGenerating})</span>}
                </span>
                <span className="text-border">|</span>
                <span>
                  Vid {videosCompleted}/{shots.length}
                  {videosGenerating > 0 && <span className="text-accent"> ({videosGenerating})</span>}
                </span>
                <span className="text-border">|</span>
                <span>~${estimatedImageCost}</span>
                {allImagesDone && <><span className="text-border">|</span><span>~${estimatedVideoCost} vid</span></>}
              </div>
            )}

            <div className="h-5 w-px bg-border" />

            {/* View Toggle */}
            <div className="flex overflow-hidden rounded-lg border border-border">
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-none ${viewMode === "list" ? "bg-accent/10 text-accent" : ""}`}
                onClick={() => { setViewMode("list"); saveToStorage("dreamsun_shots_view", "list"); }}
              >
                <LayoutList size={13} />
                List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-none ${viewMode === "storyboard" ? "bg-accent/10 text-accent" : ""}`}
                onClick={() => { setViewMode("storyboard"); saveToStorage("dreamsun_shots_view", "storyboard"); }}
              >
                <LayoutGrid size={13} />
                Storyboard
              </Button>
            </div>

            <div className="h-5 w-px bg-border" />

            {/* Generate / Animate */}
            <Button
              variant="primary"
              size="sm"
              onClick={generateAllImages}
              disabled={isBatchGenerating || shots.length === 0 || shots.every((s) => s.imageStatus === "done")}
            >
              <Zap size={13} />
              {isBatchGenerating ? `Generating ${imagesCompleted}/${shots.length}` : "Generate All"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={animateAll}
              disabled={!allImagesDone || isBatchAnimating}
            >
              <Film size={13} />
              {isBatchAnimating ? `Animating ${videosCompleted}/${shots.filter((s) => s.imageStatus === "done").length}` : "Animate All"}
            </Button>
          </div>

          {/* Settings Panel (expandable) — split Image / Video */}
          {showSettings && (
            <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {/* Image Settings */}
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Image</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Image Model */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium text-muted">
                      Model
                      {hasAnyRefs && effectiveModel.id !== selectedImageModel.id && (
                        <span className="ml-1 text-accent">(Edit)</span>
                      )}
                    </label>
                    <Select
                      value={selectedImageModel.id}
                      options={selectableModels.map((m) => ({ value: m.id, label: m.name, detail: m.costPerImage }))}
                      onChange={(id) => {
                        const m = MODELS.find((m) => m.id === id);
                        if (m) {
                          setSelectedImageModel(m);
                          localStorage.setItem(STORAGE_KEYS.imageModel, m.id);
                          resetAllShotImageSettings("modelId");
                        }
                      }}
                    />
                  </div>

                  {/* Aspect Ratio + Num Images + Safety */}
                  <div className="space-y-3">
                    {/* Aspect Ratio */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium text-muted">
                        Aspect Ratio
                      </label>
                      <div className="flex gap-1.5">
                        {["9:16", "16:9", "1:1"].map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => {
                              setAspectRatio(ratio);
                              saveToStorage(STORAGE_KEYS.aspectRatio, ratio);
                              resetAllShotImageSettings("aspectRatio");
                            }}
                            className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                              aspectRatio === ratio
                                ? "border-accent/30 bg-accent/10 text-accent"
                                : "border-border bg-surface text-muted hover:border-accent/30"
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resolution */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium text-muted">
                        Resolution
                      </label>
                      <div className="flex gap-1.5">
                        {(["1k", "2k", "4k"] as const).map((res) => (
                          <button
                            key={res}
                            onClick={() => {
                              setImageResolution(res);
                              saveToStorage(STORAGE_KEYS.imageResolution, res);
                            }}
                            className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium uppercase transition ${
                              imageResolution === res
                                ? "border-accent/30 bg-accent/10 text-accent"
                                : "border-border bg-surface text-muted hover:border-accent/30"
                            }`}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Number of Images */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium text-muted">
                        Number of Images
                      </label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            onClick={() => {
                              setNumImages(n);
                              saveToStorage(STORAGE_KEYS.numImages, n);
                            }}
                            className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                              numImages === n
                                ? "border-accent/30 bg-accent/10 text-accent"
                                : "border-border bg-surface text-muted hover:border-accent/30"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Safety Checker */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium text-muted">
                        Safety Filter
                      </label>
                      <button
                        onClick={() => {
                          const next = !safetyChecker;
                          setSafetyChecker(next);
                          saveToStorage(STORAGE_KEYS.safetyChecker, next);
                          resetAllShotImageSettings("safetyChecker");
                        }}
                        className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
                          safetyChecker
                            ? "border-accent/30 bg-accent/10 text-accent"
                            : "border-border bg-surface text-muted hover:border-accent/30"
                        }`}
                      >
                        {safetyChecker ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Settings */}
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Video</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Video Model */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium text-muted">Model</label>
                    <Select
                      value={selectedVideoModel.id}
                      options={VIDEO_MODELS.map((m) => ({ value: m.id, label: m.name, detail: `${m.costPer5Sec}/5s` }))}
                      onChange={(id) => {
                        const m = VIDEO_MODELS.find((m) => m.id === id);
                        if (m) {
                          setSelectedVideoModel(m);
                          localStorage.setItem(STORAGE_KEYS.videoModel, m.id);
                          resetAllShotVideoSettings("modelId");
                          if (!m.durations.includes(duration)) {
                            const newDur = m.defaultDuration;
                            setDuration(newDur);
                            saveToStorage(STORAGE_KEYS.duration, newDur);
                            resetAllShotVideoSettings("duration");
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Duration + Resolution + Sound */}
                  <div className="space-y-3">
                    {/* Duration */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium text-muted">Duration</label>
                      <div className="flex flex-wrap gap-1">
                        {selectedVideoModel.durations.map((d) => (
                          <button
                            key={d}
                            onClick={() => {
                              setDuration(d);
                              saveToStorage(STORAGE_KEYS.duration, d);
                              resetAllShotVideoSettings("duration");
                            }}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                              duration === d
                                ? "border-accent/30 bg-accent/10 text-accent"
                                : "border-border bg-surface text-muted hover:border-accent/30"
                            }`}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resolution */}
                    {selectedVideoModel.resolutions.length > 0 && (
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium text-muted">Resolution</label>
                        <div className="flex gap-1.5">
                          {selectedVideoModel.resolutions.map((res) => (
                            <button
                              key={res}
                              onClick={() => {
                                setResolution(res);
                                saveToStorage(STORAGE_KEYS.resolution, res);
                                resetAllShotVideoSettings("resolution");
                              }}
                              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                                resolution === res
                                  ? "border-accent/30 bg-accent/10 text-accent"
                                  : "border-border bg-surface text-muted hover:border-accent/30"
                              }`}
                            >
                              {res}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sound */}
                    {selectedVideoModel.supportsGenerateAudio && (
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium text-muted">Sound</label>
                        <button
                          onClick={() => {
                            const next = !generateAudio;
                            setGenerateAudio(next);
                            saveToStorage(STORAGE_KEYS.generateAudio, next);
                            resetAllShotVideoSettings("generateAudio");
                          }}
                          className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
                            generateAudio
                              ? "border-accent/30 bg-accent/10 text-accent"
                              : "border-border bg-surface text-muted hover:border-accent/30"
                          }`}
                        >
                          {generateAudio ? "On" : "Off"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Output Folder — localhost only, under video settings */}
                {isLocal && (
                  <div className="mt-3 border-t border-border pt-3">
                    <label className="mb-1.5 block text-[10px] font-medium text-muted">Output Folder</label>
                    <input
                      type="text"
                      value={outputFolder}
                      onChange={(e) => handleOutputFolderChange(e.target.value)}
                      placeholder="G:\My Drive\Shorts\PROJECT"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 transition focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Always-visible: Master Reference + Prompt Prefix as bento sub-cells */}
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            {/* Master Reference Cell */}
            <div className="min-w-[240px] rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-[11px] font-medium text-muted">Master Reference</p>
              <p className="mb-2.5 text-[9px] text-muted/50">Applied to all shots</p>
              <div className="flex items-center gap-2">
                {charRefs.map((ref) => (
                  <div key={ref.id} className="relative h-12 w-12 overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.preview} alt="Ref" className="h-full w-full object-cover" />
                    {ref.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-transparent" />
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
                  className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted transition hover:border-muted hover:text-foreground"
                >
                  +
                </button>
                <input ref={charRefInput} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleCharRefUpload} className="hidden" />
              </div>
            </div>

            {/* Prompt Prefix Cell */}
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-[11px] font-medium text-muted">Prompt Prefix</p>
              <p className="mb-2.5 text-[9px] text-muted/50">Prepended to every shot prompt</p>
              <input
                type="text"
                value={promptPrefix}
                onChange={(e) => {
                  setPromptPrefix(e.target.value);
                  localStorage.setItem(STORAGE_KEYS.promptPrefix, e.target.value);
                }}
                placeholder="e.g. The same donkey with the same animated characteristics. Do not modify the animation style..."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 transition focus:border-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Shots Section */}
      <div className="mx-6 mt-6 mb-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <h2 className="flex items-center gap-2.5 text-lg font-bold uppercase tracking-widest text-foreground">
          <Film size={18} className="text-accent" />
          Shots
          <span className="text-xs font-normal normal-case tracking-normal text-muted/50">
            {shots.length > 0 ? `${shots.length} shot${shots.length !== 1 ? "s" : ""}` : ""}
          </span>
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className={viewMode === "storyboard" ? "relative px-6 pb-4" : "px-6 pb-4"}>
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
                globalGenerateAudio={generateAudio}
                globalResolution={resolution}
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
                onDropOnFirst={(url) => updateShot(shot.id, { imageUrl: url, imageStatus: "done" })}
                onDropOnLast={(url) => updateShot(shot.id, { endImageUrl: url })}
              />
            ))}
          </div>
        ) : (
          <div className="storyboard-scroll flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: "x mandatory" }}>
            {sortedShots.map((shot) => (
              <StoryboardCard
                key={shot.id}
                shot={shot}
                globalDuration={duration}
                globalAspectRatio={aspectRatio}
                globalGenerateAudio={generateAudio}
                globalResolution={resolution}
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
                onDropOnFirst={(url) => updateShot(shot.id, { imageUrl: url, imageStatus: "done" })}
                onDropOnLast={(url) => updateShot(shot.id, { endImageUrl: url })}
              />
            ))}
          </div>
        )}
      </div>


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
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={confirmRemoveShot}>Delete</Button>
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
                  placeholder={`e.g. ${newShotModal.suggestedNumber} or 1B`}
                />
                <p className="mt-1 text-[10px] text-muted">Type a number like &quot;5&quot; or &quot;1B&quot; to insert between shots</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setNewShotModal(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => {
                const input = document.getElementById("new-shot-number-input") as HTMLInputElement;
                const val = input?.value.replace(/[^0-9a-zA-Z]/g, "") || newShotModal.suggestedNumber;
                confirmNewShotFromRef(newShotModal.imageUrl, val);
              }}>Create Shot</Button>
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
              className="w-full resize-y rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
              autoFocus
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => { setShowPasteModal(false); setPasteText(""); }}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleParse} disabled={!pasteText.trim()}>
                Parse & Load
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


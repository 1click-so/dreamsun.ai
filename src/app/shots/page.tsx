"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { fal } from "@fal-ai/client";
import { MODELS, type ModelConfig, getSelectableModels, resolveModel } from "@/lib/models";
import { VIDEO_MODELS, type VideoModelConfig } from "@/lib/video-models";
import { parseShotList, type ParsedShot } from "@/lib/shot-parser";

fal.config({ proxyUrl: "/api/fal/proxy" });

type ShotStatus = "pending" | "generating" | "done" | "error";

interface Shot {
  id: string;
  number: number;
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
}

interface UploadedRef {
  id: string;
  preview: string;
  url: string | null;
  uploading: boolean;
}

let idCounter = 0;
const nextId = () => `shot_${++idCounter}`;
let refIdCounter = 0;
const nextRefId = () => `ref_${++refIdCounter}`;

function createShot(parsed?: ParsedShot): Shot {
  return {
    id: nextId(),
    number: parsed?.number ?? 1,
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
  };
}

// --- localStorage helpers ---
const STORAGE_KEYS = {
  folder: "dreamsun_shots_folder",
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

export default function ShotsPage() {
  // --- Settings (all persisted to localStorage) ---
  const [outputFolder, setOutputFolder] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEYS.folder) || "";
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

  // --- Project-level character reference images ---
  const [charRefs, setCharRefs] = useState<UploadedRef[]>([]);
  const charRefInput = useRef<HTMLInputElement>(null);

  // --- Shots (persisted to localStorage) ---
  const [shots, setShots] = useState<Shot[]>(() =>
    loadFromStorage<Shot[]>(STORAGE_KEYS.shots, [])
  );
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // --- Persist state changes to localStorage ---
  useEffect(() => {
    // Save shots without refImages previews (ObjectURLs aren't valid across sessions)
    const serializable = shots.map((s) => ({ ...s, refImages: [] }));
    saveToStorage(STORAGE_KEYS.shots, serializable);
  }, [shots]);

  // --- Batch progress ---
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isBatchAnimating, setIsBatchAnimating] = useState(false);

  // Per-shot file input refs
  const shotRefInputs = useRef<Record<string, HTMLInputElement | null>>({});

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
        number: prev.length + 1,
        title: "",
        imagePrompt: "",
        videoPrompt: "",
      }),
    ]);
  };

  const removeShot = (id: string) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
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

  // --- Single Shot Image Generation (reusable) ---
  const generateSingleShot = async (shot: Shot) => {
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
      const model = resolveModel(selectedImageModel.id, shotHasRefs) ?? selectedImageModel;

      const body: Record<string, unknown> = {
        modelId: model.id,
        prompt: shot.imagePrompt,
        aspectRatio,
        shotNumber: shot.number,
        outputFolder: outputFolder || undefined,
        safetyChecker: false,
      };

      if (shotHasRefs && model.capability === "image-to-image") {
        body.referenceImageUrls = allRefs;
      }

      const res = await fetch("/api/generate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        updateShot(shot.id, {
          imageStatus: "error",
          error: data.error || "Generation failed",
        });
        return;
      }

      updateShot(shot.id, {
        imageStatus: "done",
        imageUrl: data.imageUrl,
        localImagePath: data.localPath,
        // Reset video status when image changes
        videoStatus: "pending",
        videoUrl: null,
        localVideoPath: null,
        error: null,
      });
    } catch (err) {
      updateShot(shot.id, {
        imageStatus: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  // --- Single Shot Animation (reusable) ---
  const animateSingleShot = async (shot: Shot) => {
    if (!shot.imageUrl) return;
    updateShot(shot.id, { videoStatus: "generating", error: null });

    try {
      const res = await fetch("/api/animate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoModelId: selectedVideoModel.id,
          prompt: shot.videoPrompt,
          imageUrl: shot.imageUrl,
          duration,
          aspectRatio,
          shotNumber: shot.number,
          outputFolder: outputFolder || undefined,
        }),
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
      updateShot(shot.id, {
        videoStatus: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
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
      <div className="border-b border-border bg-surface px-6 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
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

      {/* Shot Cards */}
      <div className="px-6 py-4">
        {shots.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center text-muted">
              <p className="mb-2 text-sm">No shots yet</p>
              <p className="text-xs">
                Paste a shot list or add shots manually
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                onUpdate={(updates) => updateShot(shot.id, updates)}
                onRemove={() => removeShot(shot.id)}
                onRefUpload={(e) => handleShotRefUpload(shot.id, e)}
                onRefRemove={(refId) => removeShotRef(shot.id, refId)}
                refInputRef={(el) => {
                  shotRefInputs.current[shot.id] = el;
                }}
                onGenerateImage={() => generateSingleShot(shot)}
                onAnimateShot={() => animateSingleShot(shot)}
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
  onUpdate,
  onRemove,
  onRefUpload,
  onRefRemove,
  refInputRef,
  onGenerateImage,
  onAnimateShot,
}: {
  shot: Shot;
  onUpdate: (updates: Partial<Shot>) => void;
  onRemove: () => void;
  onRefUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefRemove: (refId: string) => void;
  refInputRef: (el: HTMLInputElement | null) => void;
  onGenerateImage: () => void;
  onAnimateShot: () => void;
}) {
  const statusColors: Record<ShotStatus, string> = {
    pending: "border-border text-muted",
    generating: "border-accent text-accent",
    done: "border-green-500 text-green-400",
    error: "border-red-500 text-red-400",
  };

  const isImageBusy = shot.imageStatus === "generating";
  const isVideoBusy = shot.videoStatus === "generating";
  const canAnimate = shot.imageStatus === "done" && shot.imageUrl && !isVideoBusy;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      {/* Header Row */}
      <div className="mb-3 flex items-center gap-3">
        <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
          #{shot.number}
        </span>
        <input
          type="text"
          value={shot.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Shot title"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted/40"
        />
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[shot.imageStatus]}`}
        >
          img: {shot.imageStatus}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[shot.videoStatus]}`}
        >
          vid: {shot.videoStatus}
        </span>
        <button
          onClick={onRemove}
          className="shrink-0 text-xs text-muted hover:text-red-400"
        >
          delete
        </button>
      </div>

      <div className="flex items-start gap-4">
        {/* Left: Prompts + Refs */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Prompts */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted">
                Image Prompt
              </label>
              <textarea
                value={shot.imagePrompt}
                onChange={(e) => onUpdate({ imagePrompt: e.target.value })}
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted">
                Video Prompt
              </label>
              <textarea
                value={shot.videoPrompt}
                onChange={(e) => onUpdate({ videoPrompt: e.target.value })}
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 focus:border-accent"
              />
            </div>
          </div>

          {/* Per-shot reference images */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              Shot refs:
            </span>
            {shot.refImages.map((ref) => (
              <div
                key={ref.id}
                className="relative h-8 w-8 overflow-hidden rounded border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ref.preview}
                  alt="Ref"
                  className="h-full w-full object-cover"
                />
                {ref.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <div className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent" />
                  </div>
                )}
                <button
                  onClick={() => onRefRemove(ref.id)}
                  className="absolute -right-0.5 -top-0.5 rounded-full bg-background/80 px-0.5 text-[8px] text-muted hover:text-foreground"
                >
                  x
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const input = document.getElementById(
                  `shot-ref-${shot.id}`
                ) as HTMLInputElement;
                input?.click();
              }}
              className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-border text-xs text-muted hover:border-accent/50 hover:text-accent"
            >
              +
            </button>
            <input
              id={`shot-ref-${shot.id}`}
              ref={refInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={onRefUpload}
              className="hidden"
            />
          </div>

          {/* Error */}
          {shot.error && (
            <p className="text-xs text-red-400">{shot.error}</p>
          )}

          {/* Per-shot action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onGenerateImage}
              disabled={isImageBusy}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImageBusy
                ? "Generating..."
                : shot.imageStatus === "done"
                  ? "Regenerate Image"
                  : "Generate Image"}
            </button>
            <button
              onClick={onAnimateShot}
              disabled={!canAnimate}
              className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVideoBusy
                ? "Animating..."
                : shot.videoStatus === "done"
                  ? "Re-animate"
                  : "Animate"}
            </button>
          </div>
        </div>

        {/* Right: Previews */}
        <div className="flex shrink-0 gap-2">
          {/* Image Preview */}
          <div>
            {shot.imageUrl ? (
              <a href={shot.imageUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.imageUrl}
                  alt={`Shot ${shot.number}`}
                  className="h-32 w-20 rounded-md border border-border object-cover transition hover:border-accent"
                />
              </a>
            ) : (
              <div className="flex h-32 w-20 items-center justify-center rounded-md border border-dashed border-border">
                {isImageBusy ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <span className="text-center text-[10px] text-muted/40">
                    No image
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Video Preview */}
          <div>
            {shot.videoUrl ? (
              <a href={shot.videoUrl} target="_blank" rel="noopener noreferrer">
                <div className="flex h-32 w-20 items-center justify-center rounded-md border border-green-500/30 bg-green-500/5">
                  <span className="text-center text-[10px] text-green-400">
                    Video ready
                  </span>
                </div>
              </a>
            ) : (
              <div className="flex h-32 w-20 items-center justify-center rounded-md border border-dashed border-border">
                {isVideoBusy ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <span className="text-center text-[10px] text-muted/40">
                    No video
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

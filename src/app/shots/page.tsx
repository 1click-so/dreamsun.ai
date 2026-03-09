"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fal } from "@fal-ai/client";
import { MODELS, type ModelConfig, getSelectableModels, resolveModel } from "@/lib/models";
import { Settings2, Plus, ClipboardList, LayoutList, LayoutGrid, Zap, Film, ChevronDown, Download } from "lucide-react";
import JSZip from "jszip";
import { VIDEO_MODELS, getCreateModels, type VideoModelConfig } from "@/lib/video-models";
import { parseShotList, type ParsedShot } from "@/lib/shot-parser";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Lightbox } from "@/components/shots/Lightbox";
import { ShotCard } from "@/components/shots/ShotCard";
import { StoryboardCard } from "@/components/shots/StoryboardCard";
import { StoryboardShotModal } from "@/components/shots/StoryboardShotModal";
import { usePricing, tierKey } from "@/hooks/usePricing";
import { invalidateCredits } from "@/hooks/useCredits";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import { CreditIcon } from "@/components/ModelSelector";
import type { Shot, ShotStatus, ImageSettings, VideoSettings, ShotSettings, UploadedRef } from "@/types/shots";
import Image from "next/image";

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
    imageNegativePrompt: "",
    videoPrompt: parsed?.videoPrompt ?? "",
    videoNegativePrompt: "",
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
    audioUrl: null,
    audioRef: null,
    imageHistory: [],
    videoHistory: [],
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
  if (!s.audioUrl) s.audioUrl = null;
  if (!s.audioRef) s.audioRef = null;
  if (!Array.isArray(s.imageHistory)) s.imageHistory = [];
  if (!Array.isArray(s.videoHistory)) s.videoHistory = [];

  return s;
}

// --- Scene types ---

export interface SceneSettings {
  imageModelId: string;
  videoModelId: string;
  aspectRatio: string;
  imageResolution: string;
  numImages: number;
  safetyChecker: boolean;
  duration: number;
  resolution: string;
  generateAudio: boolean;
  cameraFixed: boolean;
  promptPrefix: string;
  outputFolder: string;
}

export interface Scene {
  id: string;
  name: string;
  shots: Record<string, unknown>[]; // serialized Shot[]
  settings: SceneSettings;
  createdAt: number;
  updatedAt: number;
}

const SCENES_KEY = "dreamsun_scenes"; // legacy localStorage key for migration

// --- Supabase scene persistence ---

async function fetchScenesFromDB(): Promise<Scene[]> {
  try {
    const res = await fetch("/api/scenes");
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      shots: (r.shots as Record<string, unknown>[]) || [],
      settings: r.settings as SceneSettings,
      createdAt: new Date(r.created_at as string).getTime(),
      updatedAt: new Date(r.updated_at as string).getTime(),
    }));
  } catch { return []; }
}

export async function saveSceneToDB(scene: Scene) {
  try {
    await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: scene.id,
        name: scene.name,
        settings: scene.settings,
        shots: scene.shots,
      }),
    });
  } catch (err) { console.error("[scenes] Save failed:", err); }
}

async function deleteSceneFromDB(id: string) {
  try {
    await fetch(`/api/scenes?id=${id}`, { method: "DELETE" });
  } catch (err) { console.error("[scenes] Delete failed:", err); }
}

async function bulkSaveScenesToDB(scenes: Scene[]) {
  try {
    await fetch("/api/scenes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: scenes.map((s) => ({
          id: s.id,
          name: s.name,
          settings: s.settings,
          shots: s.shots,
        })),
      }),
    });
  } catch (err) { console.error("[scenes] Bulk save failed:", err); }
}

/** Load from legacy localStorage (for migration only) */
function loadScenesFromLocalStorage(): Scene[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCENES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getDefaultSettings(): SceneSettings {
  return {
    imageModelId: "nano-banana-2",
    videoModelId: "seedance-1-5-pro",
    aspectRatio: "9:16",
    imageResolution: "1k",
    numImages: 1,
    safetyChecker: false,
    duration: 5,
    resolution: "720p",
    generateAudio: false,
    cameraFixed: false,
    promptPrefix: "",
    outputFolder: "",
  };
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
  cameraFixed: "dreamsun_shots_camera_fixed",
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

// --- Scene Overview Component ---

function SceneOverview({
  scenes,
  onOpenScene,
  onCreateScene,
  onDeleteScene,
  onRenameScene,
}: {
  scenes: Scene[];
  onOpenScene: (id: string) => void;
  onCreateScene: () => void;
  onDeleteScene: (id: string) => void;
  onRenameScene: (id: string, name: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loadedThumbs, setLoadedThumbs] = useState<Set<string>>(new Set());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-accent">Scenes</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateScene}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-hover"
            >
              <Plus size={15} />
              New Scene
            </button>
          </div>
        </div>

        {scenes.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-border">
            <div className="text-center">
              <Film size={40} className="mx-auto mb-3 text-muted/30" />
              <p className="mb-1 text-sm text-muted">No scenes yet</p>
              <p className="mb-4 text-xs text-muted/50">Create your first scene to start producing</p>
              <button
                onClick={onCreateScene}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-hover"
              >
                Create Scene
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((scene) => {
              const shotCount = scene.shots.length;
              const imgCount = scene.shots.reduce((sum, raw) => {
                const s = raw as Record<string, unknown>;
                let count = Array.isArray(s.imageHistory) ? (s.imageHistory as string[]).length : 0;
                if (s.imageUrl && !(Array.isArray(s.imageHistory) && (s.imageHistory as string[]).includes(s.imageUrl as string))) count++;
                return sum + count;
              }, 0);
              const vidCount = scene.shots.reduce((sum, raw) => {
                const s = raw as Record<string, unknown>;
                let count = Array.isArray(s.videoHistory) ? (s.videoHistory as string[]).length : 0;
                if (s.videoUrl && !(Array.isArray(s.videoHistory) && (s.videoHistory as string[]).includes(s.videoUrl as string))) count++;
                return sum + count;
              }, 0);
              // Find first shot with an image for thumbnail
              const thumbShot = scene.shots.find((s) => (s as Record<string, unknown>).imageUrl) as Record<string, unknown> | undefined;
              const thumbUrl = thumbShot?.imageUrl as string | undefined;
              const date = new Date(scene.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <div
                  key={scene.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-accent/30 hover:shadow-lg"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => onOpenScene(scene.id)}
                    className="relative block aspect-video w-full overflow-hidden bg-background"
                  >
                    {thumbUrl ? (
                      <>
                        {!loadedThumbs.has(scene.id) && <div className="absolute inset-0 animate-pulse rounded-lg bg-surface" />}
                        <Image
                          src={thumbUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, 320px"
                          className={`object-cover transition-opacity ${loadedThumbs.has(scene.id) ? "opacity-100" : "opacity-0"}`}
                          onLoad={() => setLoadedThumbs((prev) => new Set(prev).add(scene.id))}
                        />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film size={32} className="text-muted/20" />
                      </div>
                    )}
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    {/* Shot count badge */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                      <Film size={10} />
                      {shotCount} shot{shotCount !== 1 ? "s" : ""}
                    </div>
                    {/* Stats badges */}
                    <div className="absolute bottom-2 right-2 flex gap-1.5">
                      {imgCount > 0 && (
                        <span className="rounded-full bg-accent/80 px-2 py-0.5 text-[9px] font-bold text-black">
                          {imgCount} img
                        </span>
                      )}
                      {vidCount > 0 && (
                        <span className="rounded-full bg-accent/80 px-2 py-0.5 text-[9px] font-bold text-black">
                          {vidCount} vid
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Info */}
                  <div className="flex flex-1 flex-col px-3 py-2.5">
                    {editingId === scene.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { onRenameScene(scene.id, editName.trim()); setEditingId(null); }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => { onRenameScene(scene.id, editName.trim()); setEditingId(null); }}
                        className="mb-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => onOpenScene(scene.id)}
                        className="mb-1 truncate text-left text-sm font-semibold text-foreground transition hover:text-accent"
                      >
                        {scene.name}
                      </button>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted/50">{date}</span>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => { setEditingId(scene.id); setEditName(scene.name); }}
                          className="rounded-md p-1 text-muted/50 transition hover:bg-surface-hover hover:text-foreground"
                          title="Rename"
                        >
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M8.5 2.5l3 3-7 7H1.5v-3z" />
                          </svg>
                        </button>
                        {deleteConfirm === scene.id ? (
                          <button
                            onClick={() => { onDeleteScene(scene.id); setDeleteConfirm(null); }}
                            className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-destructive transition hover:bg-destructive/10"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(scene.id)}
                            className="rounded-md p-1 text-muted/50 transition hover:bg-surface-hover hover:text-destructive"
                            title="Delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M2 4h10M5 4V2.5h4V4M3 4l.7 8.1c.1.8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4L11 4" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page (with scene routing) ---

const LAST_SCENE_KEY = "dreamsun_last_scene";

export default function ShotsPage() {
  const router = useRouter();
  // --- Scene management (Supabase-backed) ---
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoaded, setScenesLoaded] = useState(false);

  // Redirect to last active scene if one exists
  useEffect(() => {
    try {
      const lastScene = localStorage.getItem(LAST_SCENE_KEY);
      if (lastScene) {
        router.replace(`/shots/${lastScene}`);
      }
    } catch {}
  }, [router]);

  // Load scenes from Supabase on mount, migrate localStorage if needed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Fetch from Supabase
      const dbScenes = await fetchScenesFromDB();

      if (cancelled) return;

      if (dbScenes.length > 0) {
        // Supabase has scenes — use them
        setScenes(dbScenes);
        setScenesLoaded(true);
        return;
      }

      // 2. Supabase is empty — check localStorage for migration
      const localScenes = loadScenesFromLocalStorage();

      // Also check for legacy flat shots format
      if (localScenes.length === 0 && typeof window !== "undefined") {
        try {
          const oldShots = localStorage.getItem(STORAGE_KEYS.shots);
          if (oldShots) {
            const parsed = JSON.parse(oldShots);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const migrated: Scene = {
                id: `scene_${Date.now()}`,
                name: "Untitled Scene",
                shots: parsed,
                settings: {
                  imageModelId: localStorage.getItem(STORAGE_KEYS.imageModel) || "nano-banana-2",
                  videoModelId: localStorage.getItem(STORAGE_KEYS.videoModel) || "seedance-1-5-pro",
                  aspectRatio: loadFromStorage(STORAGE_KEYS.aspectRatio, "9:16"),
                  imageResolution: loadFromStorage(STORAGE_KEYS.imageResolution, "1k"),
                  numImages: loadFromStorage(STORAGE_KEYS.numImages, 1),
                  safetyChecker: loadFromStorage(STORAGE_KEYS.safetyChecker, false),
                  duration: loadFromStorage(STORAGE_KEYS.duration, 5),
                  resolution: loadFromStorage(STORAGE_KEYS.resolution, "720p"),
                  generateAudio: loadFromStorage(STORAGE_KEYS.generateAudio, false),
                  cameraFixed: loadFromStorage(STORAGE_KEYS.cameraFixed, false),
                  promptPrefix: localStorage.getItem(STORAGE_KEYS.promptPrefix) || "",
                  outputFolder: localStorage.getItem(STORAGE_KEYS.folder) || "",
                },
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              localScenes.push(migrated);
            }
          }
        } catch {}
      }

      if (localScenes.length > 0) {
        // Migrate localStorage scenes to Supabase
        setScenes(localScenes);
        setScenesLoaded(true);
        try {
          const res = await fetch("/api/scenes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenes: localScenes.map((s) => ({
                id: s.id,
                name: s.name,
                settings: s.settings,
                shots: s.shots,
              })),
            }),
          });
          if (res.ok) {
            // Only clear localStorage after confirmed save
            try { localStorage.removeItem(SCENES_KEY); } catch {}
            console.log(`[scenes] Migrated ${localScenes.length} scene(s) from localStorage to Supabase`);
          } else {
            console.error("[scenes] Migration save failed:", await res.text());
          }
        } catch (err) {
          console.error("[scenes] Migration save failed:", err);
        }
      } else {
        setScenesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scene CRUD — optimistic UI + async Supabase save
  const createScene = () => {
    const scene: Scene = {
      id: `scene_${Date.now()}`,
      name: `Scene ${scenes.length + 1}`,
      shots: [],
      settings: getDefaultSettings(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setScenes((prev) => [scene, ...prev]);
    saveSceneToDB(scene);
    router.push(`/shots/${scene.id}`);
  };

  const deleteScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
    deleteSceneFromDB(id);
    try {
      if (localStorage.getItem(LAST_SCENE_KEY) === id) localStorage.removeItem(LAST_SCENE_KEY);
    } catch {}
  };

  const renameScene = (id: string, name: string) => {
    if (!name) return;
    setScenes((prev) => {
      const updated = prev.map((s) => s.id === id ? { ...s, name, updatedAt: Date.now() } : s);
      const scene = updated.find((s) => s.id === id);
      if (scene) saveSceneToDB(scene);
      return updated;
    });
  };

  const openScene = (id: string) => {
    router.push(`/shots/${id}`);
  };

  if (!scenesLoaded) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <Skeleton className="h-7 w-24" />
              <Skeleton className="mt-2 h-4 w-16" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="p-3">
                  <Skeleton className="mb-2 h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SceneOverview
      scenes={scenes}
      onOpenScene={openScene}
      onCreateScene={createScene}
      onDeleteScene={deleteScene}
      onRenameScene={renameScene}
    />
  );
}

// --- Shot List Editor (the full shot list UI, scoped to one scene) ---

export function ShotListEditor({
  scene,
  onBack,
  onSave,
  onRename,
}: {
  scene: Scene;
  onBack: () => void;
  onSave: (shots: Shot[], settings: SceneSettings) => void;
  onRename?: (name: string) => void;
}) {
  // --- Settings (initialized from scene) ---
  const [outputFolder, setOutputFolder] = useState(scene.settings.outputFolder);
  const [promptPrefix, setPromptPrefix] = useState(scene.settings.promptPrefix);
  const [selectedImageModel, setSelectedImageModel] = useState<ModelConfig>(
    () => {
      const found = MODELS.find((m) => m.id === scene.settings.imageModelId);
      return found ?? MODELS.find((m) => m.id === "nano-banana-2") ?? MODELS[0];
    }
  );
  const [selectedVideoModel, setSelectedVideoModel] =
    useState<VideoModelConfig>(() => {
      const found = VIDEO_MODELS.find((m) => m.id === scene.settings.videoModelId);
      return found ?? VIDEO_MODELS.find((m) => m.id === "seedance-1-5-pro") ?? VIDEO_MODELS[0];
    });
  const [aspectRatio, setAspectRatio] = useState(scene.settings.aspectRatio);
  const [imageResolution, setImageResolution] = useState(scene.settings.imageResolution);
  const [numImages, setNumImages] = useState(scene.settings.numImages);
  const [safetyChecker, setSafetyChecker] = useState(scene.settings.safetyChecker);
  const [duration, setDuration] = useState(scene.settings.duration);
  const [resolution, setResolution] = useState(scene.settings.resolution);
  const [generateAudio, setGenerateAudio] = useState(scene.settings.generateAudio);
  const [cameraFixed, setCameraFixed] = useState(scene.settings.cameraFixed);

  // --- View mode ---
  const [viewMode, setViewMode] = useState<"list" | "storyboard">(() =>
    loadFromStorage("dreamsun_shots_view", "list") as "list" | "storyboard"
  );

  // --- Settings panel toggle ---
  const [showSettings, setShowSettings] = useState(false);

  // --- Credit pricing ---
  const { pricing, creditRanges } = usePricing();

  // --- Localhost detection (for output folder) ---
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // --- Project-level character reference images ---
  const [charRefs, setCharRefs] = useState<UploadedRef[]>([]);
  const charRefInput = useRef<HTMLInputElement>(null);

  // --- Shots (initialized from scene, auto-saved back) ---
  const [shots, setShots] = useState<Shot[]>(() => {
    return scene.shots.map(migrateShot);
  });
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; type: "image" | "video"; shotId?: string; shotNumber?: string } | null>(null);
  const [newShotModal, setNewShotModal] = useState<{ imageUrl: string; suggestedNumber: string } | null>(null);
  const [newShotRefLoaded, setNewShotRefLoaded] = useState(false);
  const [addShotModal, setAddShotModal] = useState<{ suggestedNumber: string } | null>(null);
  const [modalRefs, setModalRefs] = useState<UploadedRef[]>([]);
  const [modalFirstFrame, setModalFirstFrame] = useState<string | null>(null);
  const [modalEndFrame, setModalEndFrame] = useState<UploadedRef | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [storyboardModal, setStoryboardModal] = useState<{ shotId: string; mode: "image" | "video" } | null>(null);
  const [creditsShortfall, setCreditsShortfall] = useState<{ required: number; available: number } | null>(null);

  // --- Auto-save to scene on changes ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  // Collect current settings into a SceneSettings object
  const getCurrentSettings = useCallback((): SceneSettings => ({
    imageModelId: selectedImageModel.id,
    videoModelId: selectedVideoModel.id,
    aspectRatio,
    imageResolution,
    numImages,
    safetyChecker,
    duration,
    resolution,
    generateAudio,
    cameraFixed,
    promptPrefix,
    outputFolder,
  }), [selectedImageModel.id, selectedVideoModel.id, aspectRatio, imageResolution, numImages, safetyChecker, duration, resolution, generateAudio, cameraFixed, promptPrefix, outputFolder]);

  // Debounced auto-save: triggers 1s after last change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave(shotsRef.current, getCurrentSettings());
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [shots, getCurrentSettings, onSave]);

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
  };

  const handleParse = () => {
    const parsed = parseShotList(pasteText);
    if (parsed.length === 0) return;
    setShots(parsed.map((p) => createShot(p)));
    setShowPasteModal(false);
    setPasteText("");
  };

  const addShot = () => {
    const maxNum = shots.reduce((max, s) => {
      const n = parseInt(String(s.number), 10) || 0;
      return n > max ? n : max;
    }, 0);
    setModalRefs([]);
    setModalFirstFrame(null);
    setModalEndFrame(null);
    setAddShotModal({ suggestedNumber: String(maxNum + 1) });
  };

  const confirmAddShot = useCallback((number: string, title: string, imagePrompt: string, videoPrompt: string, refs: UploadedRef[], firstFrame: string | null, endFrame: UploadedRef | null) => {
    setAddShotModal(null);
    const shot = createShot({ number, title, imagePrompt, videoPrompt });
    shot.refImages = refs;
    if (firstFrame) {
      shot.imageUrl = firstFrame;
      shot.imageStatus = "done";
      shot.imageHistory = [firstFrame];
    }
    if (endFrame) {
      shot.endImageRef = endFrame;
      shot.endImageUrl = endFrame.url;
    }
    setShots((prev) => [...prev, shot]);
    setModalRefs([]);
    setModalFirstFrame(null);
    setModalEndFrame(null);
    // Scroll to new shot after render
    requestAnimationFrame(() => {
      const el = document.getElementById(`shot-${shot.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  // Modal ref helpers — upload files to fal and track in modalRefs state
  const addModalRefFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const id = nextRefId();
      const preview = URL.createObjectURL(file);
      const newRef: UploadedRef = { id, preview, url: null, uploading: true, file };
      setModalRefs((prev) => [...prev, newRef]);
      try {
        const url = await fal.storage.upload(file);
        setModalRefs((prev) => prev.map((r) => r.id === id ? { ...r, url, uploading: false } : r));
      } catch {
        setModalRefs((prev) => prev.filter((r) => r.id !== id));
      }
    }
  }, []);

  const addModalRefUrl = useCallback((url: string) => {
    if (!url) return;
    const id = nextRefId();
    setModalRefs((prev) => [...prev, { id, preview: url, url, uploading: false }]);
  }, []);

  const removeModalRef = useCallback((refId: string) => {
    setModalRefs((prev) => {
      const ref = prev.find((r) => r.id === refId);
      if (ref) URL.revokeObjectURL(ref.preview);
      return prev.filter((r) => r.id !== refId);
    });
  }, []);

  const addModalEndFrame = useCallback(async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const id = nextRefId();
    const preview = URL.createObjectURL(file);
    setModalEndFrame({ id, preview, url: null, uploading: true, file });
    try {
      const url = await fal.storage.upload(file);
      setModalEndFrame({ id, preview, url, uploading: false, file });
    } catch {
      setModalEndFrame(null);
    }
  }, []);

  const addModalEndFrameUrl = useCallback((url: string) => {
    if (!url) return;
    const id = nextRefId();
    setModalEndFrame({ id, preview: url, url, uploading: false });
  }, []);

  const createShotFromRef = useCallback((imageUrl: string) => {
    // Find highest numeric shot number and suggest +1
    const maxNum = shots.reduce((max, s) => {
      const n = parseInt(String(s.number), 10) || 0;
      return n > max ? n : max;
    }, 0);
    setNewShotRefLoaded(false);
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
    requestAnimationFrame(() => {
      const el = document.getElementById(`shot-${shot.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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
  const uploadCharRef = useCallback(async (file: File) => {
    const id = nextRefId();
    const preview = URL.createObjectURL(file);
    const newRef: UploadedRef = { id, preview, url: null, uploading: true, file };
    setCharRefs((prev) => [...prev, newRef]);

    try {
      const url = await fal.storage.upload(file);
      console.log("[charRef] Upload success:", url);
      setCharRefs((prev) =>
        prev.map((r) => (r.id === id ? { ...r, url, uploading: false } : r))
      );
    } catch (err) {
      console.error("[charRef] Upload failed:", err);
      // Keep ref visible (preview thumbnail) but url stays null — will retry upload on generation
      setCharRefs((prev) =>
        prev.map((r) => (r.id === id ? { ...r, url: null, uploading: false } : r))
      );
    }
  }, []);

  const handleCharRefUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        await uploadCharRef(file);
      }
      if (charRefInput.current) charRefInput.current.value = "";
    },
    [uploadCharRef]
  );

  const handleCharRefFileDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        await uploadCharRef(file);
      }
    },
    [uploadCharRef]
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
        const newRef: UploadedRef = { id, preview, url: null, uploading: true, file };

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
        const newRef: UploadedRef = { id, preview, url: null, uploading: true, file };

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

  // --- Add ref from URL (drag from generations/frames/other shots) ---
  const handleShotRefUrlDrop = useCallback((shotId: string, url: string) => {
    if (!url) return;
    const id = nextRefId();
    const newRef: UploadedRef = { id, preview: url, url, uploading: false };
    setShots((prev) =>
      prev.map((s) =>
        s.id === shotId ? { ...s, refImages: [...s.refImages, newRef] } : s
      )
    );
  }, []);

  // --- End frame (last frame) upload ---
  const handleEndFrameUpload = useCallback(
    async (shotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const id = nextRefId();
      const preview = URL.createObjectURL(file);
      const newRef: UploadedRef = { id, preview, url: null, uploading: true, file };

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

    // Collect valid fal URLs; retry upload for refs that failed initially
    const resolveRef = async (ref: UploadedRef): Promise<string | null> => {
      if (ref.url && ref.url.startsWith("https://")) return ref.url;
      if (ref.file) {
        try {
          const url = await fal.storage.upload(ref.file);
          return url;
        } catch { return null; }
      }
      return null;
    };
    const charRefUrls = (await Promise.all(charRefs.filter((r) => r.url || r.file).map(resolveRef))).filter(Boolean) as string[];
    const shotRefUrls = (await Promise.all(shot.refImages.filter((r) => r.url || r.file).map(resolveRef))).filter(Boolean) as string[];
    const allRefs = [...charRefUrls, ...shotRefUrls];

    try {
      const shotHasRefs = allRefs.length > 0;
      const shotImageModelId = shot.settings.image.modelId ?? selectedImageModel.id;
      const model = resolveModel(shotImageModelId, shotHasRefs) ?? selectedImageModel;
      const shotAR = shot.settings.image.aspectRatio ?? aspectRatio;
      const shotSafety = shot.settings.image.safetyChecker ?? safetyChecker;

      // Replace @N tags with natural language refs the model understands
      const resolvedPrompt = shot.imagePrompt.replace(
        /@(\d+)/g,
        (_, n) => `Reference Image ${n}`
      );
      const fullPrompt = promptPrefix ? `${promptPrefix.trim()} ${resolvedPrompt}` : resolvedPrompt;

      const body: Record<string, unknown> = {
        modelId: model.id,
        prompt: fullPrompt,
        aspectRatio: shotAR,
        shotNumber: shot.number,
        outputFolder: outputFolder || undefined,
        safetyChecker: shotSafety,
        numImages,
        imageResolution,
      };

      // Negative prompt — only send if model supports it
      if (shot.imageNegativePrompt && model.supportsNegativePrompt) {
        body.negativePrompt = shot.imageNegativePrompt;
      }

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

      // Handle non-JSON responses (e.g. Next.js 500 plain text)
      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        updateShot(shot.id, {
          imageStatus: "error",
          error: `Server error (${res.status}): ${text.slice(0, 200)}`,
        });
        return;
      }

      if (!res.ok) {
        if (res.status === 402) {
          setCreditsShortfall({ required: data.required as number, available: data.available as number });
          invalidateCredits();
        }
        updateShot(shot.id, {
          imageStatus: "error",
          error: res.status === 402 ? "Insufficient credits" : (data.error as string) || "Generation failed",
        });
        return;
      }
      invalidateCredits();

      // All generated image URLs (first is primary, rest are alternatives)
      const allUrls: string[] = (data.allImageUrls as string[] | undefined) ?? [data.imageUrl as string];

      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== shot.id) return s;
          const prevGenerations = s.imageHistory ?? [];
          // All new images go to generations (newest batch first), then previous generations
          return {
            ...s,
            imageStatus: "done" as ShotStatus,
            imageUrl: allUrls[0],
            localImagePath: (data.localPath as string | null) ?? null,
            videoStatus: "pending" as ShotStatus,
            videoUrl: null,
            localVideoPath: null,
            error: null,
            imageHistory: [...allUrls, ...prevGenerations],
          };
        })
      );

      // Persist images to Supabase (fire-and-forget)
      for (const url of allUrls) {
        fetch("/api/persist-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "image",
            url,
            prompt: shot.imagePrompt,
            modelId: model.id,
            modelName: model.name,
            requestId: data.requestId,
            width: data.width,
            height: data.height,
            aspectRatio: shotAR,
            resolution: imageResolution,
            settings: { ...shot.settings.image, modelId: model.id },
            referenceImageUrls: allRefs.length > 0 ? allRefs : null,
            shotNumber: shot.number,
          }),
        }).catch((err) => console.error("[persist] Shot image failed:", err));
      }
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

  // --- Edit Image (image-to-image with edit prompt, same shot) ---
  const editImage = async (shotId: string, sourceImageUrl: string, editPrompt: string) => {
    const shot = shots.find((s) => s.id === shotId);
    if (!shot) return;

    const abortKey = `img_${shotId}`;
    abortControllers.current[abortKey]?.abort();
    const controller = new AbortController();
    abortControllers.current[abortKey] = controller;

    updateShot(shotId, { imageStatus: "generating", error: null });

    try {
      // Force image-to-image: use the source image as the only reference
      const shotImageModelId = shot.settings.image.modelId ?? selectedImageModel.id;
      const model = resolveModel(shotImageModelId, true) ?? selectedImageModel;
      const shotAR = shot.settings.image.aspectRatio ?? aspectRatio;
      const shotSafety = shot.settings.image.safetyChecker ?? safetyChecker;

      const editInstruction = `Recreate this exact image. Just apply the following edit: ${editPrompt}`;
      const fullPrompt = promptPrefix ? `${promptPrefix.trim()} ${editInstruction}` : editInstruction;

      const body: Record<string, unknown> = {
        modelId: model.id,
        prompt: fullPrompt,
        aspectRatio: shotAR,
        shotNumber: shot.number,
        outputFolder: outputFolder || undefined,
        safetyChecker: shotSafety,
        numImages: 1,
        imageResolution,
        referenceImageUrls: [sourceImageUrl],
      };

      console.log(`[Shot #${shot.number} EDIT] Model: ${model.id}`, { sourceImageUrl, editPrompt });

      const res = await fetch("/api/generate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        updateShot(shotId, {
          imageStatus: "error",
          error: `Server error (${res.status}): ${text.slice(0, 200)}`,
        });
        return;
      }

      if (!res.ok) {
        if (res.status === 402) {
          setCreditsShortfall({ required: data.required as number, available: data.available as number });
          invalidateCredits();
        }
        updateShot(shotId, {
          imageStatus: "error",
          error: res.status === 402 ? "Insufficient credits" : (data.error as string) || "Edit failed",
        });
        return;
      }
      invalidateCredits();

      const allUrls: string[] = (data.allImageUrls as string[] | undefined) ?? [data.imageUrl as string];

      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== shotId) return s;
          const prevGenerations = s.imageHistory ?? [];
          return {
            ...s,
            imageStatus: "done" as ShotStatus,
            imageUrl: allUrls[0],
            localImagePath: (data.localPath as string | null) ?? null,
            error: null,
            imageHistory: [...allUrls, ...prevGenerations],
          };
        })
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateShot(shotId, { imageStatus: "pending", error: "Cancelled" });
        return;
      }
      updateShot(shotId, {
        imageStatus: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      delete abortControllers.current[abortKey];
    }
  };

  // --- Single Shot Animation (reusable) ---
  // Uses /api/animate-shot (queue-based) — refresh-safe, server persists to Supabase.
  const animateSingleShot = async (shot: Shot) => {
    const shotVideoModelId = shot.settings.video.modelId ?? selectedVideoModel.id;
    const model = VIDEO_MODELS.find((m) => m.id === shotVideoModelId) ?? selectedVideoModel;

    // Audio-to-video models need audio; image-to-video models need image
    if (model.requiresAudio) {
      if (!shot.audioUrl) return;
    } else {
      if (!shot.imageUrl) return;
    }

    const abortKey = `vid_${shot.id}`;
    abortControllers.current[abortKey]?.abort();
    const controller = new AbortController();
    abortControllers.current[abortKey] = controller;

    updateShot(shot.id, { videoStatus: "generating", error: null });

    // Per-shot settings override globals
    const shotDuration = shot.settings.video.duration ?? duration;
    const shotAspectRatio = shot.settings.video.aspectRatio ?? aspectRatio;
    const shotResolution = shot.settings.video.resolution ?? resolution;
    const useCameraFixed = shot.settings.video.cameraFixed ?? cameraFixed;
    const useGenerateAudio = shot.settings.video.generateAudio ?? generateAudio;

    try {
      // Build request body for /api/animate-shot
      const body: Record<string, unknown> = {
        videoModelId: model.id,
        prompt: shot.videoPrompt || "",
        imageUrl: shot.imageUrl,
        duration: shotDuration,
        aspectRatio: shotAspectRatio,
        resolution: shotResolution,
        cameraFixed: useCameraFixed,
        generateAudio: useGenerateAudio,
        shotNumber: shot.number,
      };

      if (shot.audioUrl) body.audioUrl = shot.audioUrl;
      if (shot.endImageUrl && shot.endImageUrl.startsWith("https://")) body.endImageUrl = shot.endImageUrl;
      if (shot.videoNegativePrompt) body.negativePrompt = shot.videoNegativePrompt;

      // Submit to queue via API (handles credits, fal queue submit, Supabase persistence)
      const res = await fetch("/api/animate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setCreditsShortfall({ required: data.required as number, available: data.available as number });
          updateShot(shot.id, { videoStatus: "error", error: "Insufficient credits" });
          invalidateCredits();
          return;
        }
        throw new Error(data.error || "Animation failed");
      }
      invalidateCredits();

      const generationId = data.generationId as string;

      // Poll for completion
      const POLL_INTERVAL = 5000;
      const MAX_POLLS = 120; // 10 minutes
      let polls = 0;

      while (polls < MAX_POLLS) {
        if (controller.signal.aborted) {
          updateShot(shot.id, { videoStatus: "pending", error: "Cancelled" });
          return;
        }
        polls++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));

        try {
          const pollRes = await fetch(`/api/generation-poll?id=${generationId}`, { signal: controller.signal });
          const pollData = await pollRes.json();

          if (pollData.status === "completed" && pollData.url) {
            // Save locally if outputFolder set
            let localPath: string | null = null;
            if (outputFolder && shot.number != null) {
              try {
                const paddedNum = String(shot.number).padStart(3, "0");
                const genNum = (shot.videoHistory?.length ?? 0) + 1;
                const saveRes = await fetch("/api/save-local", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    url: pollData.url,
                    outputFolder,
                    fileName: `video-shot-${paddedNum}_${genNum}.mp4`,
                  }),
                });
                if (saveRes.ok) {
                  const saveData = await saveRes.json();
                  localPath = saveData.localPath ?? null;
                }
              } catch {
                // Non-critical
              }
            }

            setShots((prev) =>
              prev.map((s) => {
                if (s.id !== shot.id) return s;
                const prevVideos = s.videoHistory ?? [];
                return {
                  ...s,
                  videoStatus: "done" as ShotStatus,
                  videoUrl: pollData.url,
                  localVideoPath: localPath,
                  error: null,
                  videoHistory: [pollData.url as string, ...prevVideos],
                };
              })
            );
            return;
          }

          if (pollData.status === "failed") {
            updateShot(shot.id, { videoStatus: "error", error: pollData.error || "Generation failed" });
            return;
          }

          // Still processing — continue polling
        } catch (pollErr) {
          if (controller.signal.aborted) {
            updateShot(shot.id, { videoStatus: "pending", error: "Cancelled" });
            return;
          }
          // Network error — keep trying
        }
      }

      // Timed out
      updateShot(shot.id, { videoStatus: "error", error: "Generation timed out" });
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        updateShot(shot.id, { videoStatus: "pending", error: "Cancelled" });
        return;
      }
      const message = err instanceof Error ? err.message : "Animation failed";
      updateShot(shot.id, { videoStatus: "error", error: message });
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

  // Total images/videos across all shots (all generations + any active URL not in history)
  const totalImages = shots.reduce((sum, s) => {
    let count = s.imageHistory?.length ?? 0;
    if (s.imageUrl && !(s.imageHistory ?? []).includes(s.imageUrl)) count++;
    return sum + count;
  }, 0);
  const totalVideos = shots.reduce((sum, s) => {
    let count = s.videoHistory?.length ?? 0;
    if (s.videoUrl && !(s.videoHistory ?? []).includes(s.videoUrl)) count++;
    return sum + count;
  }, 0);

  // Estimated credits for generating all shots with current settings
  const estimatedCredits = useMemo(() => {
    const imgKey = tierKey(effectiveModel.id, imageResolution);
    const imgCredits = pricing[imgKey]?.base_price_credits ?? pricing[effectiveModel.id]?.base_price_credits ?? 0;
    const audioTier = selectedVideoModel.supportsGenerateAudio ? (generateAudio ? "on" : "off") : null;
    const vidKey = tierKey(selectedVideoModel.id, resolution, audioTier);
    const vidUnitCost = pricing[vidKey]?.base_price_credits ?? pricing[selectedVideoModel.id]?.base_price_credits ?? 0;
    const vidCredits = vidUnitCost * duration;
    return (imgCredits + vidCredits) * shots.length;
  }, [pricing, effectiveModel.id, selectedVideoModel.id, selectedVideoModel.supportsGenerateAudio, shots.length, duration, imageResolution, resolution, generateAudio]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const hasAnyOutput = shots.some((s) => s.imageUrl || s.videoUrl);
  const hasAnyImage = shots.some((s) => s.imageUrl);
  const hasAnyVideo = shots.some((s) => s.videoUrl);
  const imageCount = shots.filter((s) => s.imageUrl).length;
  const videoCount = shots.filter((s) => s.videoUrl).length;

  const batchDownload = async (include: "all" | "images" | "videos") => {
    setShowDownloadModal(false);
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const sorted = [...shots].sort((a, b) => compareShotNumbers(a.number, b.number));

      for (const shot of sorted) {
        const pad = String(shot.number).padStart(3, "0");
        if ((include === "all" || include === "images") && shot.imageUrl) {
          try {
            const res = await fetch(shot.imageUrl);
            const blob = await res.blob();
            zip.file(`shot-${pad}.png`, blob);
          } catch { /* skip failed downloads */ }
        }
        if ((include === "all" || include === "videos") && shot.videoUrl) {
          try {
            const res = await fetch(shot.videoUrl);
            const blob = await res.blob();
            zip.file(`video-shot-${pad}.mp4`, blob);
          } catch { /* skip failed downloads */ }
        }
      }

      const suffix = include === "all" ? "" : `-${include}`;
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shots${suffix}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Batch download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Auto-hide header on scroll down, show on scroll up ---
  // Hide instantly on any scroll down. Show only after 600px sustained scroll up.
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const scrollUpAnchor = useRef(0); // where the upward scroll began
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    const UP_THRESHOLD = 600;
    const onScroll = () => {
      // Fewer than 5 shots — always keep header visible
      if (shots.length < 5) {
        setHeaderVisible(true);
        return;
      }

      const y = window.scrollY;
      const prev = lastScrollY.current;

      if (y < 80) {
        setHeaderVisible(true);
        scrollUpAnchor.current = y;
      } else if (y > prev) {
        // Scrolling down — hide instantly, reset anchor
        setHeaderVisible(false);
        scrollUpAnchor.current = y;
      } else if (y < prev) {
        // Scrolling up — check distance from anchor
        if (scrollUpAnchor.current - y >= UP_THRESHOLD) {
          setHeaderVisible(true);
        }
      }

      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [shots.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        ref={headerRef}
        className={`sticky top-0 z-30 bg-background transition-transform duration-300 ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
      <Navbar />
      {/* Page Header */}
      <header className="border-b border-border px-6 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Flush pending save immediately before leaving
              if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
              onSave(shotsRef.current, getCurrentSettings());
              onBack();
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2L4 7l5 5" />
            </svg>
            Scenes
          </button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-lg font-semibold tracking-tight">
            {onRename ? (
              <input
                type="text"
                defaultValue={scene.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== scene.name) onRename(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="bg-transparent text-accent outline-none border-b border-transparent focus:border-accent/30 w-auto min-w-[3ch]"
                style={{ width: `${Math.max(scene.name.length, 3)}ch` }}
              />
            ) : (
              <span className="text-accent">{scene.name}</span>
            )}
          </h1>
        </div>
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
                  {totalImages} img
                  {imagesGenerating > 0 && <span className="text-accent"> ({imagesGenerating})</span>}
                </span>
                <span className="text-border">|</span>
                <span>
                  {totalVideos} vid
                  {videosGenerating > 0 && <span className="text-accent"> ({videosGenerating})</span>}
                </span>
                {estimatedCredits > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1">
                      ~<CreditIcon size={10} /> {estimatedCredits}
                    </span>
                  </>
                )}
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

            {hasAnyOutput && (
              <>
                <div className="h-5 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => isDownloading ? null : setShowDownloadModal(true)}
                  disabled={isDownloading}
                >
                  <Download size={13} />
                  {isDownloading ? "Zipping..." : "Download"}
                </Button>
              </>
            )}
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
                      options={selectableModels.map((m) => {
                        const range = creditRanges[m.id];
                        const detail = range ? (
                          <span className="flex items-center gap-1">
                            <CreditIcon size={9} />
                            {range.max > range.min ? `${range.min}–${range.max}` : range.min}
                          </span>
                        ) : undefined;
                        return { value: m.id, label: m.name, detail };
                      })}
                      onChange={(id) => {
                        const m = MODELS.find((m) => m.id === id);
                        if (m) {
                          setSelectedImageModel(m);
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
                        {["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"].map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => {
                              setAspectRatio(ratio);
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
                      options={getCreateModels().map((m) => {
                        const range = creditRanges[m.id];
                        const detail = range ? (
                          <span className="flex items-center gap-1">
                            <CreditIcon size={9} />
                            {range.max > range.min ? `${range.min}–${range.max}` : range.min}
                          </span>
                        ) : undefined;
                        return { value: m.id, label: m.name, detail };
                      })}
                      onChange={(id) => {
                        const m = VIDEO_MODELS.find((m) => m.id === id);
                        if (m) {
                          setSelectedVideoModel(m);
                          resetAllShotVideoSettings("modelId");
                          if (!m.durations.includes(duration)) {
                            const newDur = m.defaultDuration;
                            setDuration(newDur);
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

                    {/* Camera Fixed */}
                    {selectedVideoModel.supportsCameraFixed && (
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium text-muted">Camera Fixed</label>
                        <button
                          onClick={() => {
                            const next = !cameraFixed;
                            setCameraFixed(next);
                            resetAllShotVideoSettings("cameraFixed");
                          }}
                          className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
                            cameraFixed
                              ? "border-accent/30 bg-accent/10 text-accent"
                              : "border-border bg-surface text-muted hover:border-accent/30"
                          }`}
                        >
                          {cameraFixed ? "Fixed" : "Free"}
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
            <div
              className="min-w-[240px] rounded-lg border border-border bg-background p-3"
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={(e) => {
                if (e.dataTransfer.files.length > 0) {
                  e.preventDefault();
                  handleCharRefFileDrop(Array.from(e.dataTransfer.files));
                }
              }}
            >
              <p className="mb-2 text-[11px] font-medium text-muted">Master Reference</p>
              <p className="mb-2.5 text-[9px] text-muted/50">Applied to all shots — drag & drop or click +</p>
              <div className="flex items-center gap-2">
                {charRefs.map((ref, i) => (
                  <div key={ref.id} className="relative h-14 w-14 overflow-hidden rounded-md border border-border">
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
                    <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 font-mono text-[7px] font-bold leading-tight text-accent">@{i + 1}</span>
                  </div>
                ))}
                <button
                  onClick={() => charRefInput.current?.click()}
                  className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted transition hover:border-muted hover:text-foreground"
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
                }}
                placeholder="e.g. The same donkey with the same animated characteristics. Do not modify the animation style..."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted/40 transition focus:border-accent"
              />
            </div>
          </div>
        </div>
      </div>
      </div>{/* end sticky header wrapper */}

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
      <div className={viewMode === "storyboard" ? "relative px-6 pb-[50vh]" : "px-6 pb-[50vh]"}>
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
              <div key={shot.id} id={`shot-${shot.id}`}>
              <ShotCard
                shot={shot}
                masterRefs={charRefs}
                globalDuration={duration}
                globalAspectRatio={aspectRatio}
                globalGenerateAudio={generateAudio}
                globalResolution={resolution}
                globalCameraFixed={cameraFixed}
                globalImageResolution={imageResolution}
                videoModel={selectedVideoModel}
                onUpdate={(updates) => updateShot(shot.id, updates)}
                onRemove={() => removeShot(shot.id)}
                onMoveUp={idx > 0 ? () => moveShot(shot.id, "up") : undefined}
                onMoveDown={idx < sortedShots.length - 1 ? () => moveShot(shot.id, "down") : undefined}
                onRefUpload={(e) => handleShotRefUpload(shot.id, e)}
                onRefFileDrop={(files) => handleShotRefFiles(shot.id, files)}
                onRefUrlDrop={(url) => handleShotRefUrlDrop(shot.id, url)}
                onRefRemove={(refId) => removeShotRef(shot.id, refId)}
                refInputRef={(el) => {
                  shotRefInputs.current[shot.id] = el;
                }}
                onGenerateImage={() => generateSingleShot(shot)}
                onAnimateShot={() => animateSingleShot(shot)}
                onCancelImage={() => cancelShot(shot.id, "image")}
                onCancelVideo={() => cancelShot(shot.id, "video")}
                onOpenLightbox={(src, type) => setLightbox({ src, type, shotId: shot.id, shotNumber: shot.number })}
                onEndFrameUpload={(e) => handleEndFrameUpload(shot.id, e)}
                onEndFrameRemove={() => removeEndFrame(shot.id)}
                onImageSettingsChange={(updates) => updateShotImageSettings(shot.id, updates)}
                onVideoSettingsChange={(updates) => updateShotVideoSettings(shot.id, updates)}
                imageModel={selectedImageModel}
                pricing={pricing}
                onDropOnFirst={(url) => updateShot(shot.id, { imageUrl: url, imageStatus: "done" })}
                onDropOnLast={(url) => updateShot(shot.id, { endImageUrl: url })}
                onLastFrameToNext={(frameUrl) => {
                  if (idx < sortedShots.length - 1) {
                    const nextShot = sortedShots[idx + 1];
                    updateShot(nextShot.id, { imageUrl: frameUrl, imageStatus: "done" as ShotStatus });
                  } else {
                    confirmNewShotFromRef(frameUrl, String((parseInt(String(shot.number), 10) || 0) + 1));
                  }
                }}
              />
              </div>
            ))}
          </div>
        ) : (
          <div className="storyboard-scroll -mx-3 flex gap-3 overflow-x-auto px-3 py-3" style={{ scrollSnapType: "x mandatory" }}>
            {sortedShots.map((shot, idx) => (
              <div key={shot.id} id={`shot-${shot.id}`}>
              <StoryboardCard
                shot={shot}
                globalDuration={duration}
                globalAspectRatio={aspectRatio}
                isBlurred={!!storyboardModal && storyboardModal.shotId !== shot.id}
                imgCredits={pricing[tierKey(selectedImageModel.id, imageResolution)]?.base_price_credits ?? pricing[selectedImageModel.id]?.base_price_credits ?? 0}
                vidCredits={Math.round((pricing[tierKey(selectedVideoModel.id, resolution, selectedVideoModel.supportsGenerateAudio ? (generateAudio ? "on" : "off") : null)]?.base_price_credits ?? pricing[selectedVideoModel.id]?.base_price_credits ?? 0) * duration)}
                onUpdate={(updates) => updateShot(shot.id, updates)}
                onRemove={() => removeShot(shot.id)}
                onGenerateImage={() => generateSingleShot(shot)}
                onAnimateShot={() => animateSingleShot(shot)}
                onCancelImage={() => cancelShot(shot.id, "image")}
                onCancelVideo={() => cancelShot(shot.id, "video")}
                onOpenLightbox={(src, type) => setLightbox({ src, type, shotId: shot.id, shotNumber: shot.number })}
                onOpenModal={(mode) => setStoryboardModal({ shotId: shot.id, mode })}
                onDropOnFirst={(url) => updateShot(shot.id, { imageUrl: url, imageStatus: "done" })}
                onDropOnLast={(url) => updateShot(shot.id, { endImageUrl: url })}
                onLastFrameToNext={(frameUrl) => {
                  if (idx < sortedShots.length - 1) {
                    const nextShot = sortedShots[idx + 1];
                    updateShot(nextShot.id, { imageUrl: frameUrl, imageStatus: "done" as ShotStatus });
                  } else {
                    confirmNewShotFromRef(frameUrl, String((parseInt(String(shot.number), 10) || 0) + 1));
                  }
                }}
              />
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Storyboard Shot Modal */}
      {storyboardModal && (() => {
        const modalShot = shots.find((s) => s.id === storyboardModal.shotId);
        if (!modalShot) return null;
        return (
          <StoryboardShotModal
            shot={modalShot}
            mode={storyboardModal.mode}
            masterRefs={charRefs}
            globalDuration={duration}
            globalAspectRatio={aspectRatio}
            globalGenerateAudio={generateAudio}
            globalResolution={resolution}
            videoModel={selectedVideoModel}
            imageModel={selectedImageModel}
            onUpdate={(updates) => updateShot(modalShot.id, updates)}
            onRefUpload={(e) => handleShotRefUpload(modalShot.id, e)}
            onRefFileDrop={(files) => handleShotRefFiles(modalShot.id, files)}
            onRefUrlDrop={(url) => handleShotRefUrlDrop(modalShot.id, url)}
            onRefRemove={(refId) => removeShotRef(modalShot.id, refId)}
            refInputRef={(el) => { shotRefInputs.current[modalShot.id] = el; }}
            onEndFrameUpload={(e) => handleEndFrameUpload(modalShot.id, e)}
            onEndFrameRemove={() => removeEndFrame(modalShot.id)}
            onImageSettingsChange={(updates) => updateShotImageSettings(modalShot.id, updates)}
            onVideoSettingsChange={(updates) => updateShotVideoSettings(modalShot.id, updates)}
            onClose={() => setStoryboardModal(null)}
            onSetMode={(mode) => setStoryboardModal({ shotId: storyboardModal.shotId, mode })}
            onGenerateImage={() => generateSingleShot(modalShot)}
            onAnimateShot={() => animateSingleShot(modalShot)}
            onCancelImage={() => cancelShot(modalShot.id, "image")}
            onCancelVideo={() => cancelShot(modalShot.id, "video")}
            imgCredits={pricing[tierKey(selectedImageModel.id, imageResolution)]?.base_price_credits ?? pricing[selectedImageModel.id]?.base_price_credits ?? 0}
            vidCredits={Math.round((pricing[tierKey(selectedVideoModel.id, resolution, selectedVideoModel.supportsGenerateAudio ? (generateAudio ? "on" : "off") : null)]?.base_price_credits ?? pricing[selectedVideoModel.id]?.base_price_credits ?? 0) * duration)}
          />
        );
      })()}

      {/* Lightbox Modal */}
      {lightbox && (
        <Lightbox
          src={lightbox.src}
          type={lightbox.type}
          shotNumber={lightbox.shotNumber}
          onClose={() => setLightbox(null)}
          onNewShotFromRef={createShotFromRef}
          onEditImage={lightbox.shotId ? (editPrompt) => {
            editImage(lightbox.shotId!, lightbox.src, editPrompt);
            setLightbox(null);
          } : undefined}
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
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                {!newShotRefLoaded && <div className="absolute inset-0 animate-pulse bg-surface" />}
                <Image
                  src={newShotModal.imageUrl}
                  alt="Ref"
                  fill
                  sizes="48px"
                  className={`object-cover transition-opacity ${newShotRefLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setNewShotRefLoaded(true)}
                />
              </div>
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

      {/* Add Shot Modal */}
      {addShotModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => { setAddShotModal(null); setModalRefs([]); setModalFirstFrame(null); setModalEndFrame(null); }} onKeyDown={(e) => { if (e.key === "Escape") { setAddShotModal(null); setModalRefs([]); setModalFirstFrame(null); setModalEndFrame(null); } }}>
          <div className="w-full max-w-md rounded-xl border border-accent/40 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Plus size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">New Shot</h2>
                <p className="text-[11px] text-muted">Add a new shot to the storyboard</p>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const num = (form.elements.namedItem("shotNumber") as HTMLInputElement)?.value.replace(/[^0-9a-zA-Z]/g, "") || addShotModal.suggestedNumber;
              const title = (form.elements.namedItem("shotTitle") as HTMLInputElement)?.value.trim() || "";
              const imgPrompt = (form.elements.namedItem("imagePrompt") as HTMLTextAreaElement)?.value.trim() || "";
              const vidPrompt = (form.elements.namedItem("videoPrompt") as HTMLTextAreaElement)?.value.trim() || "";
              confirmAddShot(num, title, imgPrompt, vidPrompt, modalRefs, modalFirstFrame, modalEndFrame);
            }}>
              <div className="space-y-3">
                {/* Shot Number + Title row */}
                <div className="flex gap-3">
                  <div className="w-24 shrink-0">
                    <label className="mb-1 block text-[11px] font-medium text-muted">Number</label>
                    <input
                      type="text"
                      name="shotNumber"
                      defaultValue={addShotModal.suggestedNumber}
                      className="w-full rounded-lg border-0 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:ring-1 focus:ring-accent/30"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-medium text-muted">Title <span className="text-muted/40">(optional)</span></label>
                    <input
                      type="text"
                      name="shotTitle"
                      autoFocus
                      className="w-full rounded-lg border-0 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:ring-1 focus:ring-accent/30"
                      placeholder="e.g. Wide establishing shot"
                    />
                  </div>
                </div>

                {/* Image Prompt */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted">Image Prompt <span className="text-muted/40">(optional)</span></label>
                  <textarea
                    name="imagePrompt"
                    rows={3}
                    className="w-full resize-none rounded-lg border-0 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:ring-1 focus:ring-accent/30"
                    placeholder="Describe the image you want to generate..."
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  />
                </div>

                {/* Video Prompt */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted">Video Prompt <span className="text-muted/40">(optional)</span></label>
                  <textarea
                    name="videoPrompt"
                    rows={2}
                    className="w-full resize-none rounded-lg border-0 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/40 focus:ring-1 focus:ring-accent/30"
                    placeholder="Describe the camera motion or action..."
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  />
                </div>

                {/* References → First Frame → Last Frame (horizontal) */}
                <div className="flex gap-4">
                  {/* References */}
                  <div className="flex-1"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files.length > 0) {
                        addModalRefFiles(Array.from(e.dataTransfer.files));
                      } else {
                        const url = e.dataTransfer.getData("text/plain");
                        if (url) addModalRefUrl(url);
                      }
                    }}
                  >
                    <label className="mb-1 block text-[11px] font-medium text-muted">References</label>
                    <div className="flex flex-wrap gap-1.5">
                      {modalRefs.map((ref) => (
                        <div key={ref.id} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ref.preview} alt="Ref" className="h-full w-full object-cover" />
                          {ref.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                          <button type="button" onClick={() => removeModalRef(ref.id)} className="absolute -right-0.5 -top-0.5 rounded-full bg-black/70 px-0.5 text-[8px] text-white/70 hover:text-white">x</button>
                        </div>
                      ))}
                      <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border text-[11px] text-muted hover:border-accent/50 hover:text-accent">
                        +
                        <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => {
                          if (e.target.files) addModalRefFiles(Array.from(e.target.files));
                          e.target.value = "";
                        }} />
                      </label>
                    </div>
                  </div>

                  {/* First Frame */}
                  <div className="shrink-0"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const url = e.dataTransfer.files.length > 0
                        ? URL.createObjectURL(e.dataTransfer.files[0])
                        : e.dataTransfer.getData("text/plain");
                      if (url) setModalFirstFrame(url);
                    }}
                  >
                    <label className="mb-1 block text-[11px] font-medium text-muted">First Frame</label>
                    {modalFirstFrame ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={modalFirstFrame} alt="First frame" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setModalFirstFrame(null)} className="absolute -right-0.5 -top-0.5 rounded-full bg-black/70 px-0.5 text-[8px] text-white/70 hover:text-white">x</button>
                      </div>
                    ) : (
                      <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border text-[8px] text-muted/40 hover:border-accent/50 hover:text-accent">
                        <span className="text-center leading-tight">Drop or<br/>upload</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setModalFirstFrame(URL.createObjectURL(f));
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>

                  {/* Last Frame */}
                  <div className="shrink-0"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files.length > 0) {
                        addModalEndFrame(Array.from(e.dataTransfer.files));
                      } else {
                        const url = e.dataTransfer.getData("text/plain");
                        if (url) addModalEndFrameUrl(url);
                      }
                    }}
                  >
                    <label className="mb-1 block text-[11px] font-medium text-muted">Last Frame</label>
                    {modalEndFrame ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={modalEndFrame.preview} alt="Last frame" className="h-full w-full object-cover" />
                        {modalEndFrame.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><div className="h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" /></div>}
                        <button type="button" onClick={() => setModalEndFrame(null)} className="absolute -right-0.5 -top-0.5 rounded-full bg-black/70 px-0.5 text-[8px] text-white/70 hover:text-white">x</button>
                      </div>
                    ) : (
                      <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border text-[8px] text-muted/40 hover:border-accent/50 hover:text-accent">
                        <span className="text-center leading-tight">Drop or<br/>upload</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                          if (e.target.files) addModalEndFrame(Array.from(e.target.files));
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-[10px] text-muted/50">Enter to add</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => { setAddShotModal(null); setModalRefs([]); setModalFirstFrame(null); setModalEndFrame(null); }}>Cancel</Button>
                  <Button variant="primary" size="sm" type="submit">
                    <Plus size={13} />
                    Add Shot
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setShowDownloadModal(false)}>
          <div className="w-full max-w-xs rounded-xl border border-accent/40 bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Download size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Download Shots</h2>
                <p className="text-[11px] text-muted">{imageCount} image{imageCount !== 1 ? "s" : ""}, {videoCount} video{videoCount !== 1 ? "s" : ""} ready</p>
              </div>
            </div>
            <div className="space-y-2">
              {hasAnyImage && hasAnyVideo && (
                <button
                  onClick={() => batchDownload("all")}
                  className="flex w-full items-center gap-3 rounded-lg bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-surface-hover"
                >
                  <span className="text-base">📦</span>
                  <div>
                    <div className="font-medium">Everything</div>
                    <div className="text-[10px] text-muted">{imageCount} images + {videoCount} videos as ZIP</div>
                  </div>
                </button>
              )}
              {hasAnyImage && (
                <button
                  onClick={() => batchDownload("images")}
                  className="flex w-full items-center gap-3 rounded-lg bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-surface-hover"
                >
                  <span className="text-base">🖼</span>
                  <div>
                    <div className="font-medium">Images only</div>
                    <div className="text-[10px] text-muted">{imageCount} PNG file{imageCount !== 1 ? "s" : ""}</div>
                  </div>
                </button>
              )}
              {hasAnyVideo && (
                <button
                  onClick={() => batchDownload("videos")}
                  className="flex w-full items-center gap-3 rounded-lg bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-surface-hover"
                >
                  <span className="text-base">🎬</span>
                  <div>
                    <div className="font-medium">Videos only</div>
                    <div className="text-[10px] text-muted">{videoCount} MP4 file{videoCount !== 1 ? "s" : ""}</div>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={() => setShowDownloadModal(false)}
              className="mt-3 w-full rounded-lg py-1.5 text-center text-xs text-muted transition hover:text-foreground"
            >Cancel</button>
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

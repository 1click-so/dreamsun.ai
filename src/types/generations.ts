import type { Generation } from "@/hooks/useGenerations";

export interface GenerationSettings {
  modelId: string;
  aspectRatio: string;
  resolution: string;
  numImages: number;
  safetyChecker: boolean;
  negativePrompt?: string;
  hasReferenceImages: boolean;
}

export interface GenerationResult {
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
}

export interface UploadedImage {
  id: string;
  preview: string;
  url: string | null;
  uploading: boolean;
}

/** Convert a Supabase Generation row to the UI's GenerationResult format */
export function generationToResult(g: Generation): GenerationResult {
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
  };
}

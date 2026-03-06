export type ShotStatus = "pending" | "generating" | "done" | "error";

export interface ImageSettings {
  modelId: string | null;        // null = use global
  aspectRatio: string | null;    // null = use global
  safetyChecker: boolean | null; // null = use global (false)
}

export interface VideoSettings {
  modelId: string | null;        // null = use global
  duration: number | null;       // null = use global
  aspectRatio: string | null;    // null = use global
  resolution: string | null;     // null = use model default
  cameraFixed: boolean | null;   // null = don't send
  generateAudio: boolean | null; // null = use model default
}

export interface ShotSettings {
  image: ImageSettings;
  video: VideoSettings;
}

export interface UploadedRef {
  id: string;
  preview: string;
  url: string | null;
  uploading: boolean;
  /** Original file kept in memory for re-upload if fal CDN URL expires */
  file?: File;
}

export interface Shot {
  id: string;
  number: string;
  title: string;
  imagePrompt: string;
  imageNegativePrompt: string;
  videoPrompt: string;
  videoNegativePrompt: string;
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
  /** Per-shot audio URL for audio-to-video models */
  audioUrl: string | null;
  audioRef: UploadedRef | null;
  /** Per-shot overrides (null = use global) */
  settings: ShotSettings;
  /** History of all generated image URLs (newest first) */
  imageHistory: string[];
  /** History of all generated video URLs (newest first) */
  videoHistory: string[];
}

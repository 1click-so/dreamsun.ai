export type VideoModelType = "image-to-video" | "motion-control" | "relight";

export interface VideoModelConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  /** Model type — determines which UI settings are shown */
  type: VideoModelType;
  costPerSec: string;
  defaultDuration: number;
  /** Allowed duration values in seconds */
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  /** Maps our generic params to the model's specific API param names */
  params: {
    imageUrl: string;
    endImageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
    characterOrientation?: string;
    prompt: string;
    duration?: string;
    aspectRatio?: string;
    resolution?: string;
  };
  /** Whether this model requires audio input */
  requiresAudio?: boolean;
  /** Whether this model requires a reference video (motion control) */
  requiresVideo?: boolean;
  /** Available character orientations (motion control) */
  characterOrientations?: string[];
  /** Whether model supports negative_prompt */
  supportsNegativePrompt: boolean;
  /** Whether model supports cfg_scale (0-2) */
  supportsCfgScale: boolean;
  /** Whether model supports camera_fixed */
  supportsCameraFixed: boolean;
  /** Whether model supports generate_audio */
  supportsGenerateAudio: boolean;
  /** Whether model supports keep_original_sound (motion control) */
  supportsKeepOriginalSound?: boolean;
  /** Whether model supports multi-shot storyboarding (per-shot prompts) */
  supportsMultiShot?: boolean;
  /** Whether model supports elements (character consistency via reference images) */
  supportsElements?: boolean;
  /** Relight: supported condition types */
  relightCondTypes?: string[];
  /** Relight: supported light directions */
  relightDirections?: string[];
  /** Extra params always sent with this model */
  extraInput?: Record<string, unknown>;
  /** Resolution → endpoint mapping (for models where Standard=720p, Pro=1080p) */
  endpointByResolution?: Record<string, string>;
}

export const VIDEO_MODELS: VideoModelConfig[] = [
  // ===== Image-to-Video =====
  {
    id: "kling-2-6",
    name: "Kling 2.6",
    description: "Reliable image-to-video with negative prompt and CFG control.",
    endpoint: "fal-ai/kling-video/v2.6/pro/image-to-video",
    type: "image-to-video",
    costPerSec: "$0.07",
    defaultDuration: 5,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["1080p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "start_image_url",
      endImageUrl: "end_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
    supportsNegativePrompt: true,
    supportsCfgScale: true,
    supportsCameraFixed: false,
    supportsGenerateAudio: true,
    extraInput: {
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
    },
  },
  {
    id: "kling-3",
    name: "Kling 3.0",
    description: "Latest Kling generation. First + last frame, audio, 3-15s duration.",
    endpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    type: "image-to-video",
    costPerSec: "$0.168–0.392",
    defaultDuration: 5,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "start_image_url",
      endImageUrl: "end_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
    supportsNegativePrompt: true,
    supportsCfgScale: true,
    supportsCameraFixed: false,
    supportsGenerateAudio: true,
    supportsMultiShot: true,
    supportsElements: true,
    extraInput: {
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
    },
    endpointByResolution: {
      "720p": "fal-ai/kling-video/v3/standard/image-to-video",
      "1080p": "fal-ai/kling-video/v3/pro/image-to-video",
    },
  },
  {
    id: "seedance-1-5-pro",
    name: "Seedance 1.5 Pro",
    description: "ByteDance's model. Camera lock, up to 1080p, affordable per-second pricing.",
    endpoint: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    type: "image-to-video",
    costPerSec: "$0.052",
    defaultDuration: 5,
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    params: {
      imageUrl: "image_url",
      endImageUrl: "end_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
      resolution: "resolution",
    },
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: true,
    supportsGenerateAudio: true,
    extraInput: { enable_safety_checker: false },
  },
  {
    id: "ltx-2-3",
    name: "LTX 2.3",
    description: "Lightricks image-to-video. Up to 2160p resolution with audio.",
    endpoint: "fal-ai/ltx-2.3/image-to-video",
    type: "image-to-video",
    costPerSec: "$0.06",
    defaultDuration: 6,
    durations: [6, 8, 10],
    aspectRatios: ["auto", "16:9", "9:16"],
    resolutions: ["1080p", "1440p", "2160p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "image_url",
      endImageUrl: "end_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
      resolution: "resolution",
    },
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: false,
    supportsGenerateAudio: true,
  },
  {
    id: "ltx-2-3-fast",
    name: "LTX 2.3 Fast",
    description: "Fast Lightricks variant. Up to 20s duration, lowest cost per second.",
    endpoint: "fal-ai/ltx-2.3/image-to-video/fast",
    type: "image-to-video",
    costPerSec: "$0.04",
    defaultDuration: 6,
    durations: [6, 8, 10, 12, 14, 16, 18, 20],
    aspectRatios: ["auto", "16:9", "9:16"],
    resolutions: ["1080p", "1440p", "2160p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "image_url",
      endImageUrl: "end_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
      resolution: "resolution",
    },
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: false,
    supportsGenerateAudio: true,
  },
  {
    id: "ltx-2-3-audio",
    name: "LTX 2.3 Audio-to-Video",
    description: "Sync video generation to an audio track. Image + audio input.",
    endpoint: "fal-ai/ltx-2.3/audio-to-video",
    type: "image-to-video",
    costPerSec: "$0.10",
    defaultDuration: 6,
    durations: [6, 8, 10],
    aspectRatios: ["auto", "16:9", "9:16"],
    resolutions: ["1080p", "1440p", "2160p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "image_url",
      audioUrl: "audio_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
      resolution: "resolution",
    },
    requiresAudio: true,
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: false,
    supportsGenerateAudio: false,
  },

  // ===== Motion Control =====
  {
    id: "kling-2-6-mc",
    name: "Kling 2.6",
    description: "Motion transfer. Copy movement from any reference video.",
    endpoint: "fal-ai/kling-video/v2.6/pro/motion-control",
    type: "motion-control",
    costPerSec: "$0.07–0.112",
    defaultDuration: 10,
    durations: [],
    aspectRatios: [],
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "image_url",
      videoUrl: "video_url",
      characterOrientation: "character_orientation",
      prompt: "prompt",
    },
    requiresVideo: true,
    characterOrientations: ["video", "image"],
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: false,
    supportsGenerateAudio: false,
    supportsKeepOriginalSound: true,
    endpointByResolution: {
      "720p": "fal-ai/kling-video/v2.6/standard/motion-control",
      "1080p": "fal-ai/kling-video/v2.6/pro/motion-control",
    },
  },
  {
    id: "kling-3-mc",
    name: "Kling 3.0",
    description: "Latest motion control. Facial consistency via elements, keep audio, up to 30s.",
    endpoint: "fal-ai/kling-video/v3/pro/motion-control",
    type: "motion-control",
    costPerSec: "$0.126–0.168",
    defaultDuration: 10,
    durations: [],
    aspectRatios: [],
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    params: {
      imageUrl: "image_url",
      videoUrl: "video_url",
      characterOrientation: "character_orientation",
      prompt: "prompt",
    },
    requiresVideo: true,
    characterOrientations: ["video", "image"],
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: false,
    supportsGenerateAudio: false,
    supportsKeepOriginalSound: true,
    endpointByResolution: {
      "720p": "fal-ai/kling-video/v3/standard/motion-control",
      "1080p": "fal-ai/kling-video/v3/pro/motion-control",
    },
  },

  // ===== Relight =====
  {
    id: "lightx-relight",
    name: "LightX Relight",
    description: "Relight any video — change lighting direction, mood, and intensity.",
    endpoint: "fal-ai/lightx/relight",
    type: "relight",
    costPerSec: "$0.10",
    defaultDuration: 5,
    durations: [],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: "",
    params: {
      imageUrl: "video_url", // relight uses video_url as primary input
      prompt: "prompt",
    },
    relightCondTypes: ["ic", "ref", "hdr", "bg"],
    relightDirections: ["Left", "Right", "Top", "Bottom"],
    supportsNegativePrompt: false,
    supportsCfgScale: false,
    supportsCameraFixed: false,
    supportsGenerateAudio: false,
  },
];

export function getVideoModelById(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

/** Resolve the actual fal.ai endpoint for a model, accounting for resolution-based routing */
export function resolveVideoEndpoint(model: VideoModelConfig, resolution?: string): string {
  if (model.endpointByResolution && resolution && model.endpointByResolution[resolution]) {
    return model.endpointByResolution[resolution];
  }
  return model.endpoint;
}

/** Image-to-video models (non-audio) for Create mode */
export function getCreateModels(): VideoModelConfig[] {
  return VIDEO_MODELS.filter((m) => m.type === "image-to-video" && !m.requiresAudio);
}

/** Motion control models */
export function getMotionControlModels(): VideoModelConfig[] {
  return VIDEO_MODELS.filter((m) => m.type === "motion-control");
}

/** Relight models */
export function getRelightModels(): VideoModelConfig[] {
  return VIDEO_MODELS.filter((m) => m.type === "relight");
}

const VIDEO_PROVIDER_MAP: Record<string, { letter: string; colors: string; provider: string }> = {
  kling: { letter: "K", colors: "bg-orange-500/20 text-orange-400", provider: "Kling" },
  seedance: { letter: "S", colors: "bg-purple-500/20 text-purple-400", provider: "ByteDance" },
  ltx: { letter: "L", colors: "bg-blue-500/20 text-blue-400", provider: "Lightricks" },
  lightx: { letter: "X", colors: "bg-amber-500/20 text-amber-400", provider: "LightX" },
};

/** Convert video models to SelectorModel[] for the shared ModelSelector component */
export function videoModelsToSelectorItems(models: VideoModelConfig[]) {
  return models.map((m) => {
    const prefix = Object.keys(VIDEO_PROVIDER_MAP).find((p) => m.id.startsWith(p));
    const meta = prefix ? VIDEO_PROVIDER_MAP[prefix] : { letter: "?", colors: "bg-accent/20 text-accent-text", provider: undefined };

    const tags: string[] = [];

    if (m.type === "image-to-video") {
      if (m.durations.length > 0) tags.push(`${m.durations[0]}-${m.durations[m.durations.length - 1]}s`);
      if (m.resolutions.length > 0) tags.push(`up to ${m.resolutions[m.resolutions.length - 1]}`);
      if (m.supportsCameraFixed) tags.push("camera lock");
      if (m.supportsGenerateAudio) tags.push("audio");
      if (m.params.endImageUrl) tags.push("last frame");
      if (m.supportsMultiShot) tags.push("multi-shot");
      if (m.supportsElements) tags.push("elements");
    } else if (m.type === "relight") {
      tags.push("video relighting");
      if (m.relightCondTypes) tags.push(`${m.relightCondTypes.length} modes`);
      tags.push("$0.10/s");
    } else {
      tags.push("motion transfer");
      if (m.characterOrientations?.includes("video")) tags.push("up to 30s");
      if (m.supportsKeepOriginalSound) tags.push("keep audio");
    }

    return {
      id: m.id,
      name: m.name,
      description: m.description,
      provider: meta.provider,
      iconLetter: meta.letter,
      iconColors: meta.colors,
      tags,
      group: m.type === "image-to-video" ? "Create" : m.type === "relight" ? "Relight" : "Motion Control",
    };
  });
}

export interface VideoModelConfig {
  id: string;
  name: string;
  endpoint: string;
  costPer5Sec: string;
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
    prompt: string;
    duration: string;
    aspectRatio?: string;
    resolution?: string;
  };
  /** Whether this model requires audio input */
  requiresAudio?: boolean;
  /** Whether model supports negative_prompt */
  supportsNegativePrompt: boolean;
  /** Whether model supports cfg_scale (0-2) */
  supportsCfgScale: boolean;
  /** Whether model supports camera_fixed */
  supportsCameraFixed: boolean;
  /** Whether model supports generate_audio */
  supportsGenerateAudio: boolean;
  /** Whether duration param must be sent as string (Kling) vs number (LTX/Seedance) */
  durationIsString?: boolean;
  /** Extra params always sent with this model */
  extraInput?: Record<string, unknown>;
}

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "kling-2-6-pro",
    name: "Kling 2.6 Pro",
    endpoint: "fal-ai/kling-video/v2.6/pro/image-to-video",
    costPer5Sec: "~$0.35",
    defaultDuration: 5,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: [],
    defaultResolution: "",
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
    id: "kling-3-standard",
    name: "Kling 3.0 Standard",
    endpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    costPer5Sec: "~$0.84",
    defaultDuration: 5,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: [],
    defaultResolution: "",
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
    id: "kling-3-pro",
    name: "Kling 3.0 Pro",
    endpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    costPer5Sec: "~$1.12",
    defaultDuration: 5,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: [],
    defaultResolution: "",
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
    id: "seedance-1-5-pro",
    name: "Seedance 1.5 Pro",
    endpoint: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    costPer5Sec: "~$0.26",
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
  },
  {
    id: "ltx-2-3",
    name: "LTX 2.3",
    endpoint: "fal-ai/ltx-2.3/image-to-video",
    costPer5Sec: "~$0.30",
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
    endpoint: "fal-ai/ltx-2.3/image-to-video/fast",
    costPer5Sec: "~$0.20",
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
    endpoint: "fal-ai/ltx-2.3/audio-to-video",
    costPer5Sec: "~$0.50",
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
];

export function getVideoModelById(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

export interface VideoModelConfig {
  id: string;
  name: string;
  endpoint: string;
  costPer5Sec: string;
  defaultDuration: number;
  /** Allowed duration values in seconds */
  durations: number[];
  aspectRatios: string[];
  /** Maps our generic params to the model's specific API param names */
  params: {
    imageUrl: string;
    prompt: string;
    duration: string;
    aspectRatio?: string;
  };
  /** Whether model supports negative_prompt */
  supportsNegativePrompt: boolean;
  /** Whether model supports cfg_scale (0-2) */
  supportsCfgScale: boolean;
  /** Extra params always sent with this model */
  extraInput?: Record<string, unknown>;
}

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "kling-3-standard",
    name: "Kling 3.0 Standard",
    endpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    costPer5Sec: "~$0.84",
    defaultDuration: 5,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    params: {
      imageUrl: "start_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
    supportsNegativePrompt: true,
    supportsCfgScale: true,
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
    params: {
      imageUrl: "start_image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
    supportsNegativePrompt: true,
    supportsCfgScale: true,
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
    params: {
      imageUrl: "image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
    supportsNegativePrompt: false,
    supportsCfgScale: false,
  },
];

export function getVideoModelById(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

export interface VideoModelConfig {
  id: string;
  name: string;
  endpoint: string;
  costPer5Sec: string;
  defaultDuration: number;
  aspectRatios: string[];
  /** Maps our generic params to the model's specific API param names */
  params: {
    imageUrl: string;
    prompt: string;
    duration: string;
    aspectRatio?: string;
  };
}

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "kling-3-standard",
    name: "Kling 3.0 Standard",
    endpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    costPer5Sec: "~$0.84",
    defaultDuration: 5,
    aspectRatios: ["16:9", "9:16", "1:1"],
    params: {
      imageUrl: "image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
  },
  {
    id: "kling-3-pro",
    name: "Kling 3.0 Pro",
    endpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    costPer5Sec: "~$1.12",
    defaultDuration: 5,
    aspectRatios: ["16:9", "9:16", "1:1"],
    params: {
      imageUrl: "image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
  },
  {
    id: "seedance-1-5-pro",
    name: "Seedance 1.5 Pro",
    endpoint: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    costPer5Sec: "~$0.26",
    defaultDuration: 5,
    aspectRatios: ["16:9", "9:16", "1:1"],
    params: {
      imageUrl: "image_url",
      prompt: "prompt",
      duration: "duration",
      aspectRatio: "aspect_ratio",
    },
  },
];

export function getVideoModelById(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

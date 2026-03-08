export type ModelCapability = "text-to-image" | "image-to-image" | "both";

export interface ReferenceImageConfig {
  /** The API parameter name this model expects (e.g. "image_url", "image_urls") */
  paramName: string;
  /** Whether the param expects an array of URLs or a single URL */
  isArray: boolean;
  /** Max number of reference images accepted */
  maxImages: number;
}

export interface LoRAConfig {
  path: string;
  scale: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  capability: ModelCapability;
  description: string;
  costPerImage: string;
  aspectRatios: string[];
  defaultAspectRatio: string;
  supportsNegativePrompt: boolean;
  /** Provider name shown in selector (e.g. "Google", "xAI") */
  provider?: string;
  /** Feature tags shown in selector (e.g. "4K", "Fast", "Edit") */
  tags?: string[];
  /** Whether this is a featured/recommended model */
  featured?: boolean;
  /** Special callout badges (e.g. "Hot", "New") */
  badges?: string[];
  /** Reference image configuration — only for image-to-image models */
  referenceImage?: ReferenceImageConfig;
  /** API param name for size — defaults to "aspect_ratio". GPT Image uses "image_size" with "1024x1024" format */
  sizeParam?: { name: string; mapping: Record<string, string> };
  /** LoRA weights to apply during generation */
  loras?: LoRAConfig[];
  /** Extra input params always sent with this model */
  extraInput?: Record<string, unknown>;
  /** Set false to skip sending output_format (some endpoints don't support it) */
  supportsOutputFormat?: boolean;
  /** ID of the image-to-image variant of this model (auto-switch when refs added) */
  editVariant?: string;
}

export const MODELS: ModelConfig[] = [
  // --- Text-to-Image ---
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    endpoint: "fal-ai/nano-banana-pro",
    capability: "text-to-image",
    description: "Google's latest. Excellent character consistency and typography.",
    costPerImage: "$0.15",
    provider: "Google",
    tags: ["4K", "Edit", "Neg. Prompt"],
    featured: true,
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: true,
    editVariant: "nano-banana-pro-edit",
  },
  {
    id: "nano-banana-2",
    name: "NanoBanana 2",
    endpoint: "fal-ai/nano-banana-2",
    capability: "text-to-image",
    description: "Fast, affordable text-to-image. Good quality at low cost.",
    costPerImage: "$0.08",
    provider: "Google",
    tags: ["Fast", "Edit"],
    badges: ["Hot", "New"],
    featured: true,
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
    editVariant: "nano-banana-2-edit",
  },
  {
    id: "grok-imagine",
    name: "Grok Imagine",
    endpoint: "xai/grok-imagine-image",
    capability: "text-to-image",
    description: "xAI's highly aesthetic image generation model.",
    costPerImage: "$0.02",
    provider: "xAI",
    tags: ["Aesthetic", "Edit"],
    featured: true,
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: false,
    editVariant: "grok-imagine-edit",
  },

  // --- LoRA ---
  {
    id: "flux-2-lora-ohwx",
    name: "FLUX 2 LoRA (ohwx)",
    endpoint: "fal-ai/flux-2/lora",
    capability: "text-to-image",
    description: "FLUX 2 with character LoRA. Trigger word: ohwx",
    costPerImage: "~$0.035",
    provider: "Black Forest Labs",
    tags: ["LoRA", "Character"],
    aspectRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
    supportsOutputFormat: false,
    loras: [
      {
        path: "https://v3b.fal.media/files/b/0a906ed4/hK6mYT27l_EYr5pt8mpw9_pytorch_lora_weights.safetensors",
        scale: 1.0,
      },
    ],
    sizeParam: {
      name: "image_size",
      mapping: {
        "16:9": "landscape_16_9",
        "4:3": "landscape_4_3",
        "3:2": "landscape_4_3",
        "1:1": "square_hd",
        "2:3": "portrait_4_3",
        "3:4": "portrait_4_3",
        "9:16": "portrait_16_9",
      },
    },
    extraInput: {
      enable_safety_checker: false,
      num_inference_steps: 28,
      guidance_scale: 3.5,
    },
  },
  {
    id: "flux-2-lora-ohwx-nsfw",
    name: "FLUX 2 LoRA (ohwx + NSFW)",
    endpoint: "fal-ai/flux-2/lora",
    capability: "text-to-image",
    description: "Character LoRA + NSFW Master stacked. Trigger word: ohwx",
    costPerImage: "~$0.035",
    provider: "Black Forest Labs",
    tags: ["LoRA", "Character", "NSFW"],
    aspectRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    defaultAspectRatio: "3:4",
    supportsNegativePrompt: false,
    supportsOutputFormat: false,
    loras: [
      {
        path: "https://v3b.fal.media/files/b/0a906ed4/hK6mYT27l_EYr5pt8mpw9_pytorch_lora_weights.safetensors",
        scale: 1.0,
      },
      {
        path: "https://v3b.fal.media/files/b/0a90946a/GeYC52k-5RbJytNrJNJms_NSFW_master_ZIT_000008766.safetensors",
        scale: 0.8,
      },
    ],
    sizeParam: {
      name: "image_size",
      mapping: {
        "16:9": "landscape_16_9",
        "4:3": "landscape_4_3",
        "3:2": "landscape_4_3",
        "1:1": "square_hd",
        "2:3": "portrait_4_3",
        "3:4": "portrait_4_3",
        "9:16": "portrait_16_9",
      },
    },
    extraInput: {
      enable_safety_checker: false,
      num_inference_steps: 28,
      guidance_scale: 3.5,
    },
  },
  {
    id: "flux-1-lora-ohwx-nsfw",
    name: "FLUX 1 LoRA (ohwx + NSFW)",
    endpoint: "fal-ai/flux-lora",
    capability: "text-to-image",
    description: "Flux 1 trained character LoRA + NSFW Master — native base. Trigger word: ohwx",
    costPerImage: "~$0.035",
    provider: "Black Forest Labs",
    tags: ["LoRA", "Character", "NSFW"],
    aspectRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    defaultAspectRatio: "3:4",
    supportsNegativePrompt: false,
    supportsOutputFormat: false,
    loras: [
      {
        path: "https://v3b.fal.media/files/b/0a9095b8/lGPkZU5MLmrlGLmPEn_3X_lora-flux1-fal.safetensors",
        scale: 1.0,
      },
      {
        path: "https://v3b.fal.media/files/b/0a90946a/GeYC52k-5RbJytNrJNJms_NSFW_master_ZIT_000008766.safetensors",
        scale: 0.8,
      },
    ],
    sizeParam: {
      name: "image_size",
      mapping: {
        "16:9": "landscape_16_9",
        "4:3": "landscape_4_3",
        "3:2": "landscape_4_3",
        "1:1": "square_hd",
        "2:3": "portrait_4_3",
        "3:4": "portrait_4_3",
        "9:16": "portrait_16_9",
      },
    },
    extraInput: {
      enable_safety_checker: false,
      num_inference_steps: 28,
      guidance_scale: 3.5,
    },
  },

  // --- Image-to-Image / Edit ---
  {
    id: "nano-banana-pro-edit",
    name: "Nano Banana Pro (Edit)",
    endpoint: "fal-ai/nano-banana-pro/edit",
    capability: "image-to-image",
    description: "Google's model with image editing. Up to 14 reference images.",
    costPerImage: "$0.15",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: true,
    referenceImage: { paramName: "image_urls", isArray: true, maxImages: 14 },
  },
  {
    id: "grok-imagine-edit",
    name: "Grok Imagine (Edit)",
    endpoint: "xai/grok-imagine-image/edit",
    capability: "image-to-image",
    description: "Edit images precisely with xAI's Grok Imagine model.",
    costPerImage: "$0.022",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: false,
    referenceImage: { paramName: "image_url", isArray: false, maxImages: 1 },
  },
  {
    id: "nano-banana-2-edit",
    name: "NanoBanana 2 (Edit)",
    endpoint: "fal-ai/nano-banana-2/edit",
    capability: "image-to-image",
    description: "Google's Nano Banana 2 with image editing. Up to 14 reference images.",
    costPerImage: "$0.08",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: false,
    referenceImage: { paramName: "image_urls", isArray: true, maxImages: 14 },
  },
];

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getTextToImageModels(): ModelConfig[] {
  return MODELS.filter((m) => m.capability === "text-to-image" || m.capability === "both");
}

export function getImageToImageModels(): ModelConfig[] {
  return MODELS.filter((m) => m.capability === "image-to-image" || m.capability === "both");
}

/** Models shown in the selector — text-to-image only (edit variants are auto-resolved) */
export function getSelectableModels(): ModelConfig[] {
  return MODELS.filter((m) => m.capability === "text-to-image");
}

/** Resolve which model to actually use: if refs are present and model has an edit variant, use that */
export function resolveModel(modelId: string, hasRefs: boolean): ModelConfig | undefined {
  const model = getModelById(modelId);
  if (!model) return undefined;
  if (hasRefs && model.editVariant) {
    return getModelById(model.editVariant) ?? model;
  }
  return model;
}

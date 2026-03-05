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
}

export const MODELS: ModelConfig[] = [
  // --- Text-to-Image ---
  {
    id: "flux-pro-ultra",
    name: "FLUX Pro 1.1 Ultra",
    endpoint: "fal-ai/flux-pro/v1.1-ultra",
    capability: "text-to-image",
    description: "Best quality FLUX model. 4MP max resolution.",
    costPerImage: "$0.06",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },
  {
    id: "flux-pro",
    name: "FLUX Pro 1.1",
    endpoint: "fal-ai/flux-pro/v1.1",
    capability: "text-to-image",
    description: "High quality FLUX, slightly lower resolution than Ultra.",
    costPerImage: "$0.05",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },
  {
    id: "flux-dev",
    name: "FLUX Dev",
    endpoint: "fal-ai/flux/dev",
    capability: "text-to-image",
    description: "Good balance of quality and cost. 12B params.",
    costPerImage: "$0.025",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },
  {
    id: "flux-schnell",
    name: "FLUX Schnell",
    endpoint: "fal-ai/flux/schnell",
    capability: "text-to-image",
    description: "Ultra-fast (~1 second). Great for testing.",
    costPerImage: "$0.003",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    endpoint: "fal-ai/nano-banana-pro",
    capability: "text-to-image",
    description: "Google's latest. Excellent character consistency and typography.",
    costPerImage: "$0.15",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: true,
  },
  {
    id: "nano-banana-2",
    name: "NanoBanana 2",
    endpoint: "fal-ai/nano-banana-2",
    capability: "text-to-image",
    description: "Fast, affordable text-to-image. Good quality at low cost.",
    costPerImage: "$0.08",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },
  {
    id: "recraft-v3",
    name: "Recraft V3",
    endpoint: "fal-ai/recraft-v3",
    capability: "text-to-image",
    description: "Best for text/typography in images. Vector art support.",
    costPerImage: "$0.04",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },
  {
    id: "grok-imagine",
    name: "Grok Imagine Image",
    endpoint: "xai/grok-imagine-image",
    capability: "text-to-image",
    description: "xAI's highly aesthetic image generation model.",
    costPerImage: "~$0.07",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: false,
  },
  {
    id: "flux-2-flex",
    name: "FLUX 2 Flex",
    endpoint: "fal-ai/flux-2-flex",
    capability: "text-to-image",
    description: "Latest FLUX 2. Adjustable steps, enhanced typography.",
    costPerImage: "~$0.05",
    aspectRatios: ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    supportsNegativePrompt: false,
  },

  // --- LoRA ---
  {
    id: "flux-2-lora-ohwx",
    name: "FLUX 2 LoRA (ohwx)",
    endpoint: "fal-ai/flux-2/lora",
    capability: "text-to-image",
    description: "FLUX 2 with character LoRA. Trigger word: ohwx",
    costPerImage: "~$0.035",
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
    id: "flux-kontext",
    name: "FLUX Kontext Pro",
    endpoint: "fal-ai/flux-pro/kontext",
    capability: "image-to-image",
    description: "Reference image + prompt. Targeted edits and scene transformations.",
    costPerImage: "~$0.08",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: false,
    referenceImage: { paramName: "image_url", isArray: false, maxImages: 1 },
  },
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
    id: "gpt-image-1-5-edit",
    name: "GPT Image 1.5 (Edit)",
    endpoint: "fal-ai/gpt-image-1.5/edit",
    capability: "image-to-image",
    description: "OpenAI's latest. Multi-reference images, high fidelity editing.",
    costPerImage: "~$0.13",
    aspectRatios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: false,
    referenceImage: { paramName: "image_urls", isArray: true, maxImages: 10 },
    sizeParam: {
      name: "image_size",
      mapping: {
        "1:1": "1024x1024",
        "3:4": "1024x1536",
        "4:3": "1536x1024",
        "16:9": "1536x1024",
        "9:16": "1024x1536",
      },
    },
  },
  {
    id: "grok-imagine-edit",
    name: "Grok Imagine (Edit)",
    endpoint: "xai/grok-imagine-image/edit",
    capability: "image-to-image",
    description: "Edit images precisely with xAI's Grok Imagine model.",
    costPerImage: "~$0.07",
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

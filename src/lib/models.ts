export type ModelCapability = "text-to-image" | "image-to-image" | "both";

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
  },
  {
    id: "nano-banana-pro-edit",
    name: "Nano Banana Pro (Edit)",
    endpoint: "fal-ai/nano-banana-pro/edit",
    capability: "image-to-image",
    description: "Google's model with image editing. Provide image + instructions.",
    costPerImage: "$0.15",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "1:1",
    supportsNegativePrompt: true,
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

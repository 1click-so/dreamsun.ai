import type { SelectorModel } from "@/components/ModelSelector";

export interface UpscaleModelConfig {
  id: string;
  name: string;
  endpoint: string;
  description: string;
  provider: string;
  /** Parameter name for the input image URL */
  imageParam: string;
  /** Parameter name for scale factor */
  scaleParam: string;
  /** Available scale factors */
  scales: number[];
  defaultScale: number;
  /** Extra params always sent */
  extraInput?: Record<string, unknown>;
  /** Tags for the model selector */
  tags?: string[];
  /** Which tabs this model appears in */
  categories: ("upscale" | "skin")[];
  /** How to extract the result URL from the API response */
  responseFormat?: "image" | "images_array";
}

export const UPSCALE_MODELS: UpscaleModelConfig[] = [
  {
    id: "topaz-upscale",
    name: "Topaz Upscale",
    endpoint: "fal-ai/topaz/upscale/image",
    description: "Premium upscaling with face enhancement and text refine.",
    provider: "Topaz",
    imageParam: "image_url",
    scaleParam: "upscale_factor",
    scales: [2, 3, 4],
    defaultScale: 2,
    tags: ["Face Enhance", "Premium"],
    categories: ["upscale"],
    extraInput: {
      model: "Standard V2",
      face_enhancement: true,
      face_enhancement_strength: 0.8,
      output_format: "png",
    },
  },
  {
    id: "seedvr2-upscale",
    name: "SeedVR2",
    endpoint: "fal-ai/seedvr/upscale/image",
    description: "Fast and affordable upscaling up to 10x.",
    provider: "ByteDance",
    imageParam: "image_url",
    scaleParam: "upscale_factor",
    scales: [2, 3, 4, 6, 8, 10],
    defaultScale: 2,
    tags: ["Fast", "Up to 10x"],
    categories: ["upscale"],
    extraInput: {
      upscale_mode: "factor",
      output_format: "png",
    },
  },
  {
    id: "crystal-upscaler",
    name: "Crystal Upscaler",
    endpoint: "clarityai/crystal-upscaler",
    description: "Portrait-optimized — skin texture, eye clarity, facial detail.",
    provider: "ClarityAI",
    imageParam: "image_url",
    scaleParam: "scale_factor",
    scales: [2, 4],
    defaultScale: 2,
    tags: ["Portraits", "Skin & Eyes"],
    categories: ["upscale", "skin"],
    responseFormat: "images_array",
    extraInput: {
      creativity: 0,
    },
  },
  {
    id: "crystal-skin-enhance",
    name: "Crystal Skin Enhance",
    endpoint: "clarityai/crystal-upscaler",
    description: "Enhance skin, eyes, and facial features with creative refinement.",
    provider: "ClarityAI",
    imageParam: "image_url",
    scaleParam: "scale_factor",
    scales: [2],
    defaultScale: 2,
    tags: ["Skin", "Face Refine"],
    categories: ["skin"],
    responseFormat: "images_array",
    extraInput: {
      creativity: 5,
    },
  },
];

export function getUpscaleModelById(id: string): UpscaleModelConfig | undefined {
  return UPSCALE_MODELS.find((m) => m.id === id);
}

export function getModelsByCategory(category: "upscale" | "skin"): UpscaleModelConfig[] {
  return UPSCALE_MODELS.filter((m) => m.categories.includes(category));
}

export function modelsToSelectorItems(category: "upscale" | "skin"): SelectorModel[] {
  return getModelsByCategory(category).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    provider: m.provider,
    tags: m.tags,
  }));
}

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelById } from "@/lib/models";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId, prompt, aspectRatio, referenceImageUrls, negativePrompt } = body;

    if (!prompt || !modelId) {
      return NextResponse.json(
        { error: "prompt and modelId are required" },
        { status: 400 }
      );
    }

    const model = getModelById(modelId);
    if (!model) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    // Build input based on model capability
    const input: Record<string, unknown> = {
      prompt,
    };

    // Add aspect ratio for text-to-image models
    if (aspectRatio) {
      input.aspect_ratio = aspectRatio;
    }

    // Add reference images using the model's specific parameter name
    if (
      referenceImageUrls &&
      Array.isArray(referenceImageUrls) &&
      referenceImageUrls.length > 0 &&
      model.referenceImage
    ) {
      const { paramName, isArray } = model.referenceImage;
      if (isArray) {
        // Model expects an array (e.g. Nano Banana Pro Edit: image_urls)
        input[paramName] = referenceImageUrls;
      } else {
        // Model expects a single URL (e.g. FLUX Kontext: image_url)
        input[paramName] = referenceImageUrls[0];
      }
    }

    // Add negative prompt if model supports it
    if (negativePrompt && model.supportsNegativePrompt) {
      input.negative_prompt = negativePrompt;
    }

    input.output_format = "jpeg";
    input.num_images = 1;

    const result = await fal.subscribe(model.endpoint, {
      input,
      logs: true,
    });

    // fal.ai response structure: { data: { images: [{ url, width, height }], seed, timings } }
    const data = result.data as Record<string, unknown>;
    const images = data.images as Array<{
      url: string;
      width: number;
      height: number;
      content_type: string;
    }>;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No images generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: images[0].url,
      width: images[0].width,
      height: images[0].height,
      seed: data.seed,
      model: model.name,
      requestId: result.requestId,
    });
  } catch (error) {
    console.error("Generation error:", error);
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

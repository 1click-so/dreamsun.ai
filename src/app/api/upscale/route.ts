import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getUpscaleModelById } from "@/lib/upscale-models";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, deductCredits, refundCredits, tryAutoTopup } from "@/lib/credits";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let userId = "";
  let cost = 0;
  let creditModelId = "";

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const body = await req.json();
    const { modelId, imageUrl, scale, imageWidth, imageHeight, creativity } = body;

    if (!modelId || !imageUrl) {
      return NextResponse.json({ error: "modelId and imageUrl are required" }, { status: 400 });
    }

    const model = getUpscaleModelById(modelId);
    if (!model) {
      return NextResponse.json({ error: "Unknown upscale model" }, { status: 400 });
    }

    // Calculate output megapixels for per_megapixel pricing
    const effectiveScale = scale || model.defaultScale;
    const inputW = imageWidth || 1024;
    const inputH = imageHeight || 1024;
    const outputMegapixels = (inputW * effectiveScale * inputH * effectiveScale) / 1_000_000;

    // Credit deduction
    creditModelId = modelId;
    cost = await calculateCost(modelId, { megapixels: outputMegapixels });
    if (cost > 0) {
      const deduction = await deductCredits(user.id, cost, { modelId, description: `Upscale: ${model.name} (${scale || model.defaultScale}x)` });
      if (!deduction.success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: deduction.required ?? cost, available: deduction.available ?? 0 },
          { status: 402 }
        );
      }
      tryAutoTopup(user.id).catch(() => {});
    }

    // Build input
    const input: Record<string, unknown> = {
      [model.imageParam]: imageUrl,
      [model.scaleParam]: scale || model.defaultScale,
    };

    if (model.extraInput) {
      Object.assign(input, model.extraInput);
    }

    // User-controlled creativity (overrides extraInput default)
    if (creativity != null && model.supportsCreativity) {
      input.creativity = creativity;
    }

    const result = await fal.subscribe(model.endpoint, { input, logs: true });
    const data = result.data as Record<string, unknown>;

    // Extract result URL based on response format
    let resultUrl: string | undefined;
    let resultWidth: number | undefined;
    let resultHeight: number | undefined;

    if (model.responseFormat === "images_array") {
      // Crystal Upscaler returns { images: [url] }
      const images = data.images as string[] | undefined;
      resultUrl = images?.[0];
    } else {
      // Topaz / SeedVR2 return { image: { url, width, height } }
      const image = data.image as { url: string; width: number; height: number } | undefined;
      resultUrl = image?.url;
      resultWidth = image?.width;
      resultHeight = image?.height;
    }

    if (!resultUrl) {
      return NextResponse.json({ error: "No upscaled image returned" }, { status: 500 });
    }

    return NextResponse.json({
      imageUrl: resultUrl,
      allImageUrls: [resultUrl],
      width: resultWidth ?? inputW * effectiveScale,
      height: resultHeight ?? inputH * effectiveScale,
      seed: null,
      model: model.name,
      requestId: result.requestId,
      creditsUsed: cost,
    });
  } catch (error: unknown) {
    if (cost > 0 && userId) {
      await refundCredits(userId, cost, { modelId: creditModelId }).catch(() => {});
    }
    console.error("Upscale error:", error);

    let message = "Upscale failed";
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      if (err.body && typeof err.body === "object") {
        const body = err.body as Record<string, unknown>;
        if (typeof body.detail === "string") message = body.detail;
        else if (typeof body.message === "string") message = body.message;
      } else if (err.message && typeof err.message === "string") {
        message = err.message;
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

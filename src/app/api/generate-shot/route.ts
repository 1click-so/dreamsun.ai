import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelById } from "@/lib/models";
import { writeFile, mkdir, readdir } from "fs/promises";
import { dirname, join } from "path";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, deductCredits, refundCredits, tryAutoTopup } from "@/lib/credits";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const maxDuration = 120;

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
    const {
      modelId,
      prompt,
      negativePrompt,
      aspectRatio,
      referenceImageUrls,
      shotNumber,
      outputFolder,
      safetyChecker,
      numImages,
      imageResolution,
    } = body;

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

    // Credit deduction
    const effectiveNumImages = typeof numImages === "number" && numImages >= 1 && numImages <= 4 ? numImages : 1;
    creditModelId = modelId;
    cost = await calculateCost(modelId, { numImages: effectiveNumImages, resolution: imageResolution as string | undefined });
    if (cost > 0) {
      const deduction = await deductCredits(user.id, cost, { modelId, description: `Shot image: ${model.name}` });
      if (!deduction.success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: deduction.required ?? cost, available: deduction.available ?? 0 },
          { status: 402 }
        );
      }
      tryAutoTopup(user.id).catch(() => {});
    }

    // Build input — same logic as /api/generate
    const input: Record<string, unknown> = { prompt };

    // Resolution → explicit pixel dimensions (overrides aspect_ratio with image_size)
    // 1k = 1024px long side, 2k = 2048px, 4k = 4096px
    const resMultiplier: Record<string, number> = { "1k": 1024, "2k": 2048, "4k": 4096 };
    const longSide = resMultiplier[imageResolution as string];

    if (longSide && aspectRatio && !model.sizeParam) {
      // Compute width/height from aspect ratio + resolution
      const [w, h] = (aspectRatio as string).split(":").map(Number);
      const ratio = w / h;
      const width = ratio >= 1 ? longSide : Math.round(longSide * ratio);
      const height = ratio >= 1 ? Math.round(longSide / ratio) : longSide;
      input.image_size = { width, height };
    } else if (aspectRatio) {
      if (model.sizeParam) {
        input[model.sizeParam.name] =
          model.sizeParam.mapping[aspectRatio] || aspectRatio;
      } else {
        input.aspect_ratio = aspectRatio;
      }
    }

    if (
      referenceImageUrls &&
      Array.isArray(referenceImageUrls) &&
      referenceImageUrls.length > 0 &&
      model.referenceImage
    ) {
      const { paramName, isArray } = model.referenceImage;
      if (isArray) {
        input[paramName] = referenceImageUrls;
      } else {
        input[paramName] = referenceImageUrls[0];
      }
    }

    if (model.loras && model.loras.length > 0) {
      input.loras = model.loras;
    }

    if (model.extraInput) {
      Object.assign(input, model.extraInput);
    }

    // Negative prompt — only if model supports it and user provided one
    if (negativePrompt && model.supportsNegativePrompt) {
      input.negative_prompt = negativePrompt;
    }

    input.enable_safety_checker = safetyChecker === true;

    if (model.supportsOutputFormat !== false) {
      input.output_format = "png";
    }
    input.num_images = typeof numImages === "number" && numImages >= 1 && numImages <= 4 ? numImages : 1;

    const result = await fal.subscribe(model.endpoint, {
      input,
      logs: true,
    });

    const data = result.data as Record<string, unknown>;
    const images = data.images as Array<{
      url: string;
      width: number;
      height: number;
    }>;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No images generated" },
        { status: 500 }
      );
    }

    const imageUrl = images[0].url;
    const allImageUrls = images.map((img) => img.url);
    let localPath: string | null = null;

    // Save to local file if outputFolder is specified
    console.log("[generate-shot] Save check:", { outputFolder, shotNumber, hasOutputFolder: !!outputFolder, shotNumberNotNull: shotNumber != null });
    if (outputFolder && shotNumber != null) {
      try {
        const paddedNum = String(shotNumber).padStart(3, "0");
        const prefix = `shot-${paddedNum}`;

        // Find next available generation number by scanning existing files
        await mkdir(outputFolder, { recursive: true });
        let nextGen = 1;
        try {
          const existing = await readdir(outputFolder);
          const pattern = new RegExp(`^${prefix}_(\\d+)(?:-\\d+)?\\.png$`);
          for (const f of existing) {
            const m = f.match(pattern);
            if (m) nextGen = Math.max(nextGen, Number(m[1]) + 1);
          }
        } catch { /* folder doesn't exist yet, nextGen stays 1 */ }

        // Save as shot-006_1.png, shot-006_1-2.png (multi-image), next gen: shot-006_2.png, etc.
        for (let i = 0; i < allImageUrls.length; i++) {
          const suffix = i === 0 ? "" : `-${i + 1}`;
          const fileName = `${prefix}_${nextGen}${suffix}.png`;
          const filePath = join(outputFolder, fileName);

          console.log("[generate-shot] Saving to:", filePath);

          const imgRes = await fetch(allImageUrls[i]);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          await writeFile(filePath, buffer);

          console.log("[generate-shot] Saved successfully:", filePath, `(${buffer.length} bytes)`);
          if (i === 0) localPath = filePath;
        }
      } catch (saveErr) {
        console.error("[generate-shot] Failed to save image locally:", saveErr);
      }
    }

    return NextResponse.json({
      imageUrl,
      allImageUrls,
      width: images[0].width,
      height: images[0].height,
      seed: data.seed,
      model: model.name,
      requestId: result.requestId,
      localPath,
      creditsUsed: cost,
    });
  } catch (error: unknown) {
    // Refund credits on generation failure
    if (cost > 0 && userId) {
      await refundCredits(userId, cost, { modelId: creditModelId }).catch(() => {});
    }
    console.error("Shot generation error:", error);

    let message = "Generation failed";
    let status = 500;

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      if (err.status && typeof err.status === "number") status = err.status;
      if (err.body && typeof err.body === "object") {
        const body = err.body as Record<string, unknown>;
        if (typeof body.detail === "string") {
          message = body.detail;
        } else if (Array.isArray(body.detail)) {
          message = body.detail
            .map((e: Record<string, unknown>) => e.msg || JSON.stringify(e))
            .join("; ");
        } else if (typeof body.message === "string") {
          message = body.message;
        }
      } else if (err.message && typeof err.message === "string") {
        message = err.message;
      }
    }

    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelById } from "@/lib/models";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      modelId,
      prompt,
      aspectRatio,
      referenceImageUrls,
      shotNumber,
      outputFolder,
      safetyChecker,
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

    // Build input — same logic as /api/generate
    const input: Record<string, unknown> = { prompt };

    if (aspectRatio) {
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

    input.enable_safety_checker = safetyChecker === true;

    if (model.supportsOutputFormat !== false) {
      input.output_format = "png";
    }
    input.num_images = 1;

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
    let localPath: string | null = null;

    // Save to local file if outputFolder is specified
    console.log("[generate-shot] Save check:", { outputFolder, shotNumber, hasOutputFolder: !!outputFolder, shotNumberNotNull: shotNumber != null });
    if (outputFolder && shotNumber != null) {
      try {
        const paddedNum = String(shotNumber).padStart(3, "0");
        const fileName = `shot-${paddedNum}.png`;
        const filePath = join(outputFolder, fileName);

        console.log("[generate-shot] Saving to:", filePath);

        // Ensure directory exists
        await mkdir(dirname(filePath), { recursive: true });

        // Fetch image bytes from fal.media URL
        const imgRes = await fetch(imageUrl);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        await writeFile(filePath, buffer);

        console.log("[generate-shot] Saved successfully:", filePath, `(${buffer.length} bytes)`);
        localPath = filePath;
      } catch (saveErr) {
        console.error("[generate-shot] Failed to save image locally:", saveErr);
        // Don't fail the request — image was still generated
      }
    }

    return NextResponse.json({
      imageUrl,
      width: images[0].width,
      height: images[0].height,
      seed: data.seed,
      model: model.name,
      requestId: result.requestId,
      localPath,
    });
  } catch (error: unknown) {
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

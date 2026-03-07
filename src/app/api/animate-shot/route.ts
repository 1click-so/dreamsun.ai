import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getVideoModelById } from "@/lib/video-models";
import { writeFile, mkdir, readdir } from "fs/promises";
import { dirname, join } from "path";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      videoModelId,
      prompt,
      imageUrl,
      endImageUrl,
      audioUrl,
      videoUrl,
      characterOrientation,
      keepOriginalSound,
      duration,
      aspectRatio,
      resolution,
      cameraFixed,
      generateAudio,
      shotNumber,
      outputFolder,
    } = body;

    if (!videoModelId || !imageUrl) {
      return NextResponse.json(
        { error: "videoModelId and imageUrl are required" },
        { status: 400 }
      );
    }

    const model = getVideoModelById(videoModelId);
    if (!model) {
      return NextResponse.json(
        { error: "Unknown video model" },
        { status: 400 }
      );
    }

    // Build input using model's param mapping
    const input: Record<string, unknown> = {
      [model.params.imageUrl]: imageUrl,
      [model.params.prompt]: prompt || "",
    };

    // Duration — only for models that have it (not motion control)
    if (model.params.duration) {
      const durationVal = duration || model.defaultDuration;
      input[model.params.duration] = typeof durationVal === "number" ? durationVal : Number(durationVal);
    }

    // Audio URL for audio-to-video models
    if (audioUrl && model.params.audioUrl) {
      input[model.params.audioUrl] = audioUrl;
    }

    // End image (last frame) for image-to-video
    if (endImageUrl && model.params.endImageUrl) {
      input[model.params.endImageUrl] = endImageUrl;
    }

    // Reference video for motion control
    if (videoUrl && model.params.videoUrl) {
      input[model.params.videoUrl] = videoUrl;
    }

    // Character orientation for motion control
    if (characterOrientation && model.params.characterOrientation) {
      input[model.params.characterOrientation] = characterOrientation;
    }

    // Keep original sound for motion control
    if (keepOriginalSound !== undefined && model.supportsKeepOriginalSound) {
      input.keep_original_sound = keepOriginalSound;
    }

    if (aspectRatio && model.params.aspectRatio) {
      input[model.params.aspectRatio] = aspectRatio;
    }

    if (resolution && model.params.resolution) {
      input[model.params.resolution] = resolution;
    }

    if (cameraFixed === true && model.supportsCameraFixed) {
      input.camera_fixed = true;
    }

    if (generateAudio === false && model.supportsGenerateAudio) {
      input.generate_audio = false;
    }

    // Add any extra input params the model requires (negative_prompt, cfg_scale, etc.)
    if (model.extraInput) {
      Object.assign(input, model.extraInput);
    }

    // Override with user-provided values
    if (body.negativePrompt && model.supportsNegativePrompt) {
      input.negative_prompt = body.negativePrompt;
    }
    if (body.cfgScale != null && model.supportsCfgScale) {
      input.cfg_scale = body.cfgScale;
    }

    console.log(`[animate-shot] endpoint=${model.endpoint} input=`, JSON.stringify(input, null, 2));

    const result = await fal.subscribe(model.endpoint, {
      input,
      logs: true,
    });

    const data = result.data as Record<string, unknown>;

    // Video models return { video: { url } } or { video_url }
    let resultVideoUrl: string | null = null;
    if (data.video && typeof data.video === "object") {
      const video = data.video as Record<string, unknown>;
      resultVideoUrl = video.url as string;
    } else if (typeof data.video_url === "string") {
      resultVideoUrl = data.video_url;
    }

    if (!resultVideoUrl) {
      return NextResponse.json(
        { error: "No video generated" },
        { status: 500 }
      );
    }

    let localPath: string | null = null;

    // Save to local file if outputFolder is specified
    if (outputFolder && shotNumber != null) {
      try {
        const paddedNum = String(shotNumber).padStart(3, "0");
        const prefix = `video-shot-${paddedNum}`;

        await mkdir(outputFolder, { recursive: true });
        let nextGen = 1;
        try {
          const existing = await readdir(outputFolder);
          const pattern = new RegExp(`^${prefix}_(\\d+)\\.mp4$`);
          for (const f of existing) {
            const m = f.match(pattern);
            if (m) nextGen = Math.max(nextGen, Number(m[1]) + 1);
          }
        } catch { /* folder doesn't exist yet */ }

        const fileName = `${prefix}_${nextGen}.mp4`;
        const filePath = join(outputFolder, fileName);

        const vidRes = await fetch(resultVideoUrl);
        const buffer = Buffer.from(await vidRes.arrayBuffer());
        await writeFile(filePath, buffer);

        localPath = filePath;
      } catch (saveErr) {
        console.error("Failed to save video locally:", saveErr);
      }
    }

    return NextResponse.json({
      videoUrl: resultVideoUrl,
      model: model.name,
      requestId: result.requestId,
      localPath,
    });
  } catch (error: unknown) {
    console.error("Animation error:", error);

    let message = "Animation failed";
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

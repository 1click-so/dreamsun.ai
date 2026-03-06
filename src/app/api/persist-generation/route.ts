import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/** Read PNG dimensions from buffer (IHDR chunk at byte 16) */
function pngDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null; // not PNG
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Read JPEG dimensions from SOF markers */
function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // not JPEG
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0-SOF3 markers contain dimensions
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function imageDimensions(buf: Buffer): { w: number; h: number } | null {
  return pngDimensions(buf) || jpegDimensions(buf);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      type,        // "image" | "video"
      url,         // fal.ai CDN URL
      prompt,
      negativePrompt,
      modelId,
      modelName,
      seed,
      requestId,
      width,
      height,
      duration,
      aspectRatio,
      resolution,
      numImages,
      settings,
      sourceImageUrl,
      sourceAudioUrl,
      referenceImageUrls,
      projectId,
      sceneId,
      shotNumber,
      batchId,
      favorited,
      costEstimate,
    } = body;

    if (!url || !modelId || !type) {
      return NextResponse.json(
        { error: "url, modelId, and type are required" },
        { status: 400 }
      );
    }

    // 1. Copy file from fal.ai CDN to Supabase Storage
    let permanentUrl = url;
    let fileSize: number | null = null;
    let detectedWidth: number | null = width || null;
    let detectedHeight: number | null = height || null;

    try {
      const fileRes = await fetch(url);
      if (fileRes.ok) {
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        fileSize = buffer.length;

        // Extract image dimensions from binary if not provided
        if (type === "image" && (!detectedWidth || !detectedHeight)) {
          const dims = imageDimensions(buffer);
          if (dims) {
            detectedWidth = dims.w;
            detectedHeight = dims.h;
          }
        }

        const contentType = fileRes.headers.get("content-type") || (type === "video" ? "video/mp4" : "image/png");
        const ext = type === "video" ? "mp4" : contentType.includes("jpeg") ? "jpg" : "png";
        const storagePath = `${type}s/${requestId || Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("generations")
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error("[persist] Storage upload error:", uploadError);
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from("generations")
            .getPublicUrl(storagePath);
          permanentUrl = urlData.publicUrl;
        }
      }
    } catch (copyErr) {
      console.error("[persist] File copy failed, using original URL:", copyErr);
    }

    // 2. Save metadata to database
    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        type,
        url: permanentUrl,
        prompt: prompt || null,
        negative_prompt: negativePrompt || null,
        model_id: modelId,
        model_name: modelName || null,
        seed: seed || null,
        request_id: requestId || null,
        width: detectedWidth,
        height: detectedHeight,
        duration: duration || null,
        file_size: fileSize,
        aspect_ratio: aspectRatio || null,
        resolution: resolution || null,
        num_images: numImages || 1,
        settings: settings || {},
        source_image_url: sourceImageUrl || null,
        source_audio_url: sourceAudioUrl || null,
        reference_image_urls: referenceImageUrls || null,
        project_id: projectId || null,
        scene_id: sceneId || null,
        shot_number: shotNumber || null,
        batch_id: batchId || null,
        favorited: favorited || false,
        cost_estimate: costEstimate || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[persist] DB insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      url: permanentUrl,
      originalUrl: url,
    });
  } catch (error: unknown) {
    console.error("[persist] Error:", error);
    const message = error instanceof Error ? error.message : "Persist failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

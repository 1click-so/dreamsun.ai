import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
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
    try {
      const fileRes = await fetch(url);
      if (fileRes.ok) {
        const buffer = Buffer.from(await fileRes.arrayBuffer());
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
        type,
        url: permanentUrl,
        prompt: prompt || null,
        negative_prompt: negativePrompt || null,
        model_id: modelId,
        model_name: modelName || null,
        seed: seed || null,
        request_id: requestId || null,
        width: width || null,
        height: height || null,
        duration: duration || null,
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

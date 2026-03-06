import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface MigrationItem {
  type: "image" | "video";
  url: string;
  prompt?: string;
  modelId?: string;
  modelName?: string;
  shotNumber?: string;
  sceneName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items: MigrationItem[] };

    if (!items?.length) {
      return NextResponse.json({ error: "No items to migrate" }, { status: 400 });
    }

    const results: { url: string; permanentUrl: string; error?: string }[] = [];

    for (const item of items) {
      // Skip non-fal URLs or already-migrated Supabase URLs
      if (!item.url || item.url.includes("supabase.co")) {
        results.push({ url: item.url, permanentUrl: item.url });
        continue;
      }

      try {
        // Download from fal.ai CDN
        const fileRes = await fetch(item.url);
        if (!fileRes.ok) {
          results.push({ url: item.url, permanentUrl: item.url, error: `Download failed: ${fileRes.status}` });
          continue;
        }

        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const contentType = fileRes.headers.get("content-type") || (item.type === "video" ? "video/mp4" : "image/png");
        const ext = item.type === "video" ? "mp4" : contentType.includes("jpeg") ? "jpg" : "png";
        const fileId = `migrate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const storagePath = `${item.type}s/${fileId}.${ext}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("generations")
          .upload(storagePath, buffer, { contentType, upsert: true });

        if (uploadError) {
          results.push({ url: item.url, permanentUrl: item.url, error: uploadError.message });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("generations")
          .getPublicUrl(storagePath);

        const permanentUrl = urlData.publicUrl;

        // Save to generations table
        await supabase.from("generations").insert({
          type: item.type,
          url: permanentUrl,
          prompt: item.prompt || null,
          model_id: item.modelId || "unknown",
          model_name: item.modelName || null,
          shot_number: item.shotNumber || null,
          settings: item.sceneName ? { sceneName: item.sceneName } : {},
        });

        results.push({ url: item.url, permanentUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ url: item.url, permanentUrl: item.url, error: msg });
      }
    }

    const migrated = results.filter((r) => r.url !== r.permanentUrl && !r.error).length;
    const failed = results.filter((r) => r.error).length;
    const skipped = results.filter((r) => r.url === r.permanentUrl && !r.error).length;

    return NextResponse.json({ migrated, failed, skipped, results });
  } catch (error: unknown) {
    console.error("[migrate] Error:", error);
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

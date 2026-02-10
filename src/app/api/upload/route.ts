import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

// Allow up to 20MB for image uploads (App Router route segment config)
export const maxDuration = 60;

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataUrl } = body;

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json(
        { error: "dataUrl is required" },
        { status: 400 }
      );
    }

    // Convert base64 data URL to Blob
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid data URL format" },
        { status: 400 }
      );
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mimeType });

    // Upload to fal.ai storage — returns a fal.media CDN URL
    const url = await fal.storage.upload(blob);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const maxDuration = 60;

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    // Upload directly to fal.ai storage — returns a fal.media CDN URL
    const url = await fal.storage.upload(file);

    return NextResponse.json({ url });
  } catch (error: unknown) {
    console.error("Upload error:", error);

    let message = "Upload failed";
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      if (err.body && typeof err.body === "object") {
        const body = err.body as Record<string, unknown>;
        message = (body.detail as string) || (body.message as string) || message;
      } else if (err.message && typeof err.message === "string") {
        message = err.message;
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

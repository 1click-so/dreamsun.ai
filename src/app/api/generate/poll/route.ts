import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { falRequestId, falEndpoint } = await req.json();

    if (!falRequestId || !falEndpoint) {
      return NextResponse.json(
        { error: "falRequestId and falEndpoint are required" },
        { status: 400 }
      );
    }

    // Check queue status
    const status = await fal.queue.status(falEndpoint, {
      requestId: falRequestId,
      logs: false,
    });

    if (status.status === "COMPLETED") {
      // Fetch the result
      const result = await fal.queue.result(falEndpoint, {
        requestId: falRequestId,
      });

      const data = result.data as Record<string, unknown>;
      const images = data.images as Array<{
        url: string;
        width: number;
        height: number;
        content_type: string;
      }>;

      if (!images || images.length === 0) {
        return NextResponse.json(
          { status: "FAILED", error: "No images generated" },
          { status: 200 }
        );
      }

      return NextResponse.json({
        status: "COMPLETED",
        imageUrl: images[0].url,
        allImageUrls: images.map((img) => img.url),
        width: images[0].width,
        height: images[0].height,
        seed: data.seed,
        requestId: falRequestId,
      });
    }

    // Still processing
    return NextResponse.json({
      status: status.status, // "IN_QUEUE" | "IN_PROGRESS"
    });
  } catch (error: unknown) {
    console.error("Poll error:", error);

    let message = "Poll failed";
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      if (err.message && typeof err.message === "string") {
        message = err.message;
      }
    }

    return NextResponse.json(
      { status: "FAILED", error: message },
      { status: 200 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, deductCredits, tryAutoTopup } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { modelId, duration, numImages, resolution, audioTier } = body;

  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  const cost = await calculateCost(modelId, { duration, numImages, resolution, audioTier });
  if (cost <= 0) {
    return NextResponse.json({ error: "Could not determine cost" }, { status: 400 });
  }

  const result = await deductCredits(user.id, cost, {
    modelId,
    description: `Generation: ${modelId}`,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, required: result.required ?? cost, available: result.available ?? 0 },
      { status: 402 }
    );
  }

  // Fire auto-topup check in background (non-blocking)
  tryAutoTopup(user.id).catch(() => {});

  return NextResponse.json({ ...result, creditsUsed: cost });
}

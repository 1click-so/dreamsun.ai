import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calculateCost, refundCredits } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { modelId, duration, numImages, resolution, audioTier, generationId } = body;

  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  const cost = await calculateCost(modelId, { duration, numImages, resolution, audioTier });
  if (cost <= 0) {
    return NextResponse.json({ error: "Could not determine cost" }, { status: 400 });
  }

  const result = await refundCredits(user.id, cost, {
    generationId,
    modelId,
  });

  return NextResponse.json(result);
}

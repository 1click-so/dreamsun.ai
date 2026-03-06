import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/scenes — load all scenes for the authenticated user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/scenes — create or upsert a scene
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, settings, shots, sort_order } = body;

  const { data, error } = await supabase
    .from("scenes")
    .upsert({
      id,
      user_id: user.id,
      name,
      settings: settings || {},
      shots: shots || [],
      sort_order: sort_order ?? 0,
    }, { onConflict: "id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/scenes — bulk upsert all scenes (for reordering, migration)
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenes } = await req.json();
  if (!Array.isArray(scenes)) {
    return NextResponse.json({ error: "scenes array required" }, { status: 400 });
  }

  const rows = scenes.map((s: Record<string, unknown>, i: number) => ({
    id: s.id,
    user_id: user.id,
    name: s.name || "Untitled",
    settings: s.settings || {},
    shots: s.shots || [],
    sort_order: i,
  }));

  const { error } = await supabase
    .from("scenes")
    .upsert(rows, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: rows.length });
}

// DELETE /api/scenes?id=xxx — delete a scene
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("scenes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

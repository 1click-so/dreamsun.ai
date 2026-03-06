import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

function pngDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all generations missing metadata
  const { data: rows, error } = await supabase
    .from("generations")
    .select("id, type, url, width, height, file_size")
    .eq("user_id", user.id)
    .or("file_size.is.null,width.is.null");

  if (error || !rows) {
    return NextResponse.json({ error: error?.message || "No rows" }, { status: 500 });
  }

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const res = await fetch(row.url);
      if (!res.ok) { failed++; continue; }

      const buffer = Buffer.from(await res.arrayBuffer());
      const patch: Record<string, unknown> = {};

      if (!row.file_size) patch.file_size = buffer.length;

      if (row.type === "image" && !row.width) {
        const dims = pngDimensions(buffer) || jpegDimensions(buffer);
        if (dims) {
          patch.width = dims.w;
          patch.height = dims.h;
        }
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from("generations").update(patch).eq("id", row.id);
        updated++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: rows.length, updated, failed });
}

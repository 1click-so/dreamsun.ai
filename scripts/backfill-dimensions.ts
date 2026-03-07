/**
 * Backfill script — downloads each image from Supabase storage,
 * detects PNG/JPEG dimensions, and prints SQL UPDATE statements.
 *
 * Run: npx tsx scripts/backfill-dimensions.ts > updates.sql
 * Then execute the SQL in Supabase.
 */

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

interface Row { id: string; url: string; type: string; }

async function main() {
  // Read rows from stdin or hardcoded
  const SUPABASE_URL = "https://ptmdsirqscorqmcrjqrk.supabase.co";
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Fetch rows via REST API (bypasses RLS since storage is public)
  // We'll just fetch the images directly since storage URLs are public
  const rows: Row[] = JSON.parse(process.argv[2] || "[]");

  if (rows.length === 0) {
    console.error("Usage: npx tsx scripts/backfill-dimensions.ts '<JSON array of {id, url, type}>'");
    process.exit(1);
  }

  console.error(`Processing ${rows.length} rows...`);

  const updates: string[] = [];
  let done = 0;

  for (const row of rows) {
    try {
      // Only first 64KB needed for dimension detection
      const res = await fetch(row.url, { headers: { Range: "bytes=0-65535" } });
      if (!res.ok && res.status !== 206) {
        console.error(`  SKIP ${row.id} — HTTP ${res.status}`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      if (row.type === "image") {
        const dims = pngDimensions(buffer) || jpegDimensions(buffer);
        if (dims) {
          updates.push(
            `UPDATE generations SET width = ${dims.w}, height = ${dims.h} WHERE id = '${row.id}';`
          );
          done++;
        } else {
          console.error(`  SKIP ${row.id} — can't detect dimensions`);
        }
      } else if (row.type === "video") {
        // Default 16:9 for videos
        updates.push(
          `UPDATE generations SET width = 1280, height = 720 WHERE id = '${row.id}';`
        );
        done++;
      }

      if (done % 20 === 0) console.error(`  Processed ${done}...`);
    } catch (err) {
      console.error(`  FAIL ${row.id} — ${err}`);
    }
  }

  // Output SQL
  console.log(updates.join("\n"));
  console.error(`\nDone: ${done} updates generated`);
}

main();

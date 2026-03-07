// Reads JSON array of {id, url, type} from stdin, detects image dimensions, outputs SQL updates
import { readFileSync } from "fs";

function pngDims(b: Buffer) {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function jpgDims(b: Buffer) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 8) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

async function main() {
  const input = readFileSync(process.argv[2] || "/dev/stdin", "utf-8");
  const rows: { id: string; url: string; type: string }[] = JSON.parse(input);
  console.error(`Processing ${rows.length} rows...`);

  const updates: string[] = [];
  let ok = 0, fail = 0;

  // Process in batches of 10 for speed
  for (let i = 0; i < rows.length; i += 10) {
    const batch = rows.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (r) => {
        try {
          if (r.type === "video") {
            return `UPDATE generations SET width=1280, height=720 WHERE id='${r.id}';`;
          }
          const res = await fetch(r.url, { headers: { Range: "bytes=0-65535" } });
          if (!res.ok && res.status !== 206) return null;
          const buf = Buffer.from(await res.arrayBuffer());
          const d = pngDims(buf) || jpgDims(buf);
          if (d) return `UPDATE generations SET width=${d.w}, height=${d.h} WHERE id='${r.id}';`;
          return null;
        } catch { return null; }
      })
    );
    for (const sql of results) {
      if (sql) { updates.push(sql); ok++; } else { fail++; }
    }
    if ((i + 10) % 50 === 0) console.error(`  ${i + 10}/${rows.length}...`);
  }

  console.log(updates.join("\n"));
  console.error(`Done: ${ok} updates, ${fail} failed`);
}

main();

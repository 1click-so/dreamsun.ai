import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { url, outputFolder, fileName } = await req.json();

    if (!url || !outputFolder || !fileName) {
      return NextResponse.json(
        { error: "url, outputFolder, and fileName are required" },
        { status: 400 }
      );
    }

    const filePath = join(outputFolder, fileName);
    await mkdir(dirname(filePath), { recursive: true });

    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({ localPath: filePath });
  } catch (error) {
    console.error("Save local error:", error);
    return NextResponse.json(
      { error: "Failed to save file locally" },
      { status: 500 }
    );
  }
}

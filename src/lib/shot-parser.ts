export interface ParsedShot {
  number: string;
  title: string;
  imagePrompt: string;
  videoPrompt: string;
}

/**
 * Parse shot list text format:
 *
 * SHOT 1 — Title
 * IMAGE: prompt text (may be multi-line)
 * VIDEO: prompt text (may be multi-line)
 *
 * Returns array of parsed shots.
 */
export function parseShotList(text: string): ParsedShot[] {
  const shots: ParsedShot[] = [];
  const lines = text.split("\n");

  let currentShot: Partial<ParsedShot> | null = null;
  let currentField: "image" | "video" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Match SHOT header: "SHOT 1 — Title" or "SHOT 1 - Title"
    const shotMatch = line.match(/^SHOT\s+(\d+[a-zA-Z]?)\s*[—\-–]\s*(.+)$/i);
    if (shotMatch) {
      // Save previous shot
      if (currentShot?.number != null) {
        shots.push(finalizeShot(currentShot));
      }
      currentShot = {
        number: shotMatch[1],
        title: shotMatch[2].trim(),
        imagePrompt: "",
        videoPrompt: "",
      };
      currentField = null;
      continue;
    }

    if (!currentShot) continue;

    // Match IMAGE: prefix
    const imageMatch = line.match(/^IMAGE:\s*(.*)/i);
    if (imageMatch) {
      currentField = "image";
      currentShot.imagePrompt = imageMatch[1];
      continue;
    }

    // Match VIDEO: prefix
    const videoMatch = line.match(/^VIDEO:\s*(.*)/i);
    if (videoMatch) {
      currentField = "video";
      currentShot.videoPrompt = videoMatch[1];
      continue;
    }

    // Continuation line — append to current field
    if (currentField && line) {
      if (currentField === "image") {
        currentShot.imagePrompt = (currentShot.imagePrompt || "") + " " + line;
      } else {
        currentShot.videoPrompt = (currentShot.videoPrompt || "") + " " + line;
      }
    }
  }

  // Don't forget the last shot
  if (currentShot?.number != null) {
    shots.push(finalizeShot(currentShot));
  }

  return shots;
}

function finalizeShot(partial: Partial<ParsedShot>): ParsedShot {
  return {
    number: partial.number ?? "0",
    title: (partial.title ?? "").trim(),
    imagePrompt: (partial.imagePrompt ?? "").trim(),
    videoPrompt: (partial.videoPrompt ?? "").trim(),
  };
}

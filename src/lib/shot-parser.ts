export interface ParsedShot {
  number: string;
  title: string;
  imagePrompt: string;
  videoPrompt: string;
}

/**
 * Parse shot list text format. Accepts many variations:
 *
 *   SHOT 1 — Title          SHOT 1A — Title
 *   IMAGE: prompt            IMAGE PROMPT
 *   VIDEO: prompt            VIDEO PROMPT
 *                             prompt on next line...
 *
 * Field markers accepted (case-insensitive):
 *   IMAGE: / IMAGE PROMPT / IMAGE PROMPT: / IMAGE
 *   VIDEO: / VIDEO PROMPT / VIDEO PROMPT: / VIDEO
 *   MOTION: / MOTION PROMPT / MOTION PROMPT: / MOTION
 *
 * Prompt text can be on the same line or start on the next line.
 */
export function parseShotList(text: string): ParsedShot[] {
  const shots: ParsedShot[] = [];
  const lines = text.split("\n");

  let currentShot: Partial<ParsedShot> | null = null;
  let currentField: "image" | "video" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Match SHOT header: "SHOT 1 — Title", "SHOT 1A - Title", or just "SHOT 1A"
    const shotMatch = line.match(/^SHOT\s+(\d+[a-zA-Z]?)\s*(?:[—\-–]\s*(.+))?$/i);
    if (shotMatch) {
      if (currentShot?.number != null) {
        shots.push(finalizeShot(currentShot));
      }
      currentShot = {
        number: shotMatch[1],
        title: (shotMatch[2] ?? "").trim(),
        imagePrompt: "",
        videoPrompt: "",
      };
      currentField = null;
      continue;
    }

    if (!currentShot) continue;

    // Match IMAGE field: "IMAGE:", "IMAGE PROMPT", "IMAGE PROMPT:", "IMAGE"
    const imageMatch = line.match(/^IMAGE(?:\s+PROMPT)?(?::\s*(.*)|\s*$)/i);
    if (imageMatch) {
      currentField = "image";
      const inline = (imageMatch[1] ?? "").trim();
      if (inline) currentShot.imagePrompt = inline;
      continue;
    }

    // Match VIDEO / MOTION field: "VIDEO:", "VIDEO PROMPT", "MOTION:", etc.
    const videoMatch = line.match(/^(?:VIDEO|MOTION)(?:\s+PROMPT)?(?::\s*(.*)|\s*$)/i);
    if (videoMatch) {
      currentField = "video";
      const inline = (videoMatch[1] ?? "").trim();
      if (inline) currentShot.videoPrompt = inline;
      continue;
    }

    // Continuation line — append to current field
    if (currentField && line) {
      if (currentField === "image") {
        currentShot.imagePrompt = (currentShot.imagePrompt || "") + (currentShot.imagePrompt ? " " : "") + line;
      } else {
        currentShot.videoPrompt = (currentShot.videoPrompt || "") + (currentShot.videoPrompt ? " " : "") + line;
      }
    }
  }

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

/**
 * Extract the last frame (or any frame) from a video URL using Canvas API.
 * Downloads video as blob first to avoid CORS/seeking issues, then extracts frame.
 * Returns a Blob of the frame as PNG.
 */
export function extractFrame(
  videoUrl: string,
  position: "last" | "first" | number = "last",
  signal?: AbortSignal
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }

    let blobUrl: string | null = null;

    const cleanup = () => {
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    };

    const onAbort = () => { cleanup(); reject(new DOMException("Aborted", "AbortError")); };
    signal?.addEventListener("abort", onAbort, { once: true });

    // Step 1: Download video as blob (handles CORS via fetch, not video element)
    fetch(videoUrl, { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
        return res.blob();
      })
      .then((videoBlob) => {
        if (signal?.aborted) { onAbort(); return; }

        // Step 2: Create object URL (no CORS issues on canvas)
        blobUrl = URL.createObjectURL(videoBlob);
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        // No crossOrigin needed — blob URL is same-origin

        video.onloadedmetadata = () => {
          if (position === "first") {
            video.currentTime = 0.05;
          } else if (position === "last") {
            video.currentTime = Math.max(0, video.duration - 0.05);
          } else {
            video.currentTime = Math.min(position, video.duration);
          }
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) { cleanup(); reject(new Error("Canvas context failed")); return; }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                cleanup();
                signal?.removeEventListener("abort", onAbort);
                if (blob) resolve(blob);
                else reject(new Error("Canvas toBlob returned null"));
              },
              "image/png"
            );
          } catch (err) {
            cleanup();
            signal?.removeEventListener("abort", onAbort);
            reject(err);
          }
        };

        video.onerror = () => {
          cleanup();
          signal?.removeEventListener("abort", onAbort);
          reject(new Error(`Failed to decode video: ${videoUrl}`));
        };

        video.src = blobUrl;
      })
      .catch((err) => {
        cleanup();
        signal?.removeEventListener("abort", onAbort);
        reject(err);
      });
  });
}

/**
 * Extract last frame from a video, upload via /api/upload, return the CDN URL.
 * Supports cancellation via AbortSignal.
 */
export async function extractLastFrameAndUpload(
  videoUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const blob = await extractFrame(videoUrl, "last", signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const file = new File([blob], `last-frame-${Date.now()}.png`, { type: "image/png" });
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData, signal });
  const data = await res.json();
  if (!data.url) throw new Error(data.error || "Upload failed");
  return data.url;
}

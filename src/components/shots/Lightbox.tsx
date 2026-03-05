"use client";

import { Button } from "@/components/ui/Button";

interface LightboxProps {
  src: string;
  type: "image" | "video";
  shotNumber?: string;
  onClose: () => void;
  onNewShotFromRef?: (imageUrl: string) => void;
}

export function Lightbox({
  src,
  type,
  shotNumber,
  onClose,
  onNewShotFromRef,
}: LightboxProps) {
  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = type === "video" ? "mp4" : "png";
      const name = shotNumber ? `shot-${shotNumber}.${ext}` : `shot.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
        <div className="absolute right-2 top-2 flex gap-2">
          {type === "image" && onNewShotFromRef && (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                onNewShotFromRef(src);
                onClose();
              }}
            >
              New Shot from Ref
            </Button>
          )}
          <Button variant="primary" size="xs" onClick={handleDownload}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="bg-background/80 hover:bg-background"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

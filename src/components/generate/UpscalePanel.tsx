"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { fal } from "@fal-ai/client";
import { ModelSelector, CreditIcon } from "@/components/ModelSelector";
import { SectionLabel, PillButton } from "@/components/generate/SidebarWidgets";
import { usePricing } from "@/hooks/usePricing";
import { invalidateCredits } from "@/hooks/useCredits";
import { trackUpscaleCompleted } from "@/lib/analytics";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import {
  getUpscaleModelById,
  getModelsByCategory,
  modelsToSelectorItems,
} from "@/lib/upscale-models";

// --- Types ---

interface UpscaleResult {
  imageUrl: string;
  width: number;
  height: number;
  model: string;
  creditsUsed: number;
}

// --- Helpers ---

/** Load natural dimensions of an image from a URL or blob */
function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1024, height: 1024 }); // fallback
    img.src = src;
  });
}

// --- Component ---

export function UpscalePanel({
  category = "upscale",
  initialImageUrl,
  onResult,
}: {
  /** Which category of models to show */
  category?: "upscale" | "skin";
  /** Pre-load this image URL (from lightbox/gallery upscale button) */
  initialImageUrl?: string | null;
  /** Called when upscale completes — parent can add to gallery */
  onResult?: (result: UpscaleResult) => void;
}) {
  // Model selection — filtered by category
  const categoryModels = getModelsByCategory(category);
  const [selectedModelId, setSelectedModelId] = useState(categoryModels[0]?.id ?? "");
  const selectedModel = getUpscaleModelById(selectedModelId) ?? categoryModels[0];

  // Scale factor
  const [scale, setScale] = useState(selectedModel.defaultScale);

  // Creativity (for Crystal models)
  const [creativity, setCreativity] = useState(selectedModel.defaultCreativity ?? 0);

  // Image upload
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credits
  const { pricing, creditRanges } = usePricing();
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  // Models for selector
  const selectorModels = modelsToSelectorItems(category);

  // Handle model change — reset scale to new model's default if current scale isn't available
  const handleModelChange = useCallback(
    (ids: string[]) => {
      const newId = ids[0];
      setSelectedModelId(newId);
      const newModel = getUpscaleModelById(newId);
      if (newModel) {
        if (!newModel.scales.includes(scale)) setScale(newModel.defaultScale);
        setCreativity(newModel.defaultCreativity ?? 0);
      }
    },
    [scale]
  );

  // Detect image dimensions from a source
  const detectDimensions = useCallback(async (src: string) => {
    const dims = await getImageDimensions(src);
    setImageDims(dims);
  }, []);

  // Pre-load image from prop or sessionStorage (lightbox/gallery "Upscale" button)
  useEffect(() => {
    const url = initialImageUrl || sessionStorage.getItem("dreamsun_upscale_image");
    if (url) {
      sessionStorage.removeItem("dreamsun_upscale_image");
      setImagePreview(url);
      setImageUrl(url);
      setImageDims(null);
      detectDimensions(url);
    }
  }, [initialImageUrl, detectDimensions]);

  // Upload image to fal storage
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];

      // Preview immediately
      const preview = URL.createObjectURL(file);
      setImagePreview(preview);
      setImageUrl(null);
      setImageDims(null);
      setUploading(true);
      setError(null);

      // Get dimensions from local preview
      detectDimensions(preview);

      try {
        const url = await fal.storage.upload(file);
        setImageUrl(url);
      } catch {
        setError("Failed to upload image");
        setImagePreview(null);
        setImageDims(null);
      } finally {
        setUploading(false);
      }
    },
    [detectDimensions]
  );

  // Clear image
  const clearImage = useCallback(() => {
    setImagePreview(null);
    setImageUrl(null);
    setImageDims(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Handle drag & drop
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      // Handle dropped URL (from gallery drag)
      const url = e.dataTransfer.getData("text/plain");
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        setImagePreview(url);
        setImageUrl(url);
        setError(null);
        detectDimensions(url);
        return;
      }

      // Handle dropped file
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect, detectDimensions]
  );

  // Upscale
  const handleUpscale = useCallback(async () => {
    if (!imageUrl || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          imageUrl,
          scale,
          imageWidth: imageDims?.width,
          imageHeight: imageDims?.height,
          creativity: selectedModel.supportsCreativity ? creativity : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setShowCreditsModal(true);
          return;
        }
        throw new Error(data.error || "Upscale failed");
      }

      trackUpscaleCompleted(selectedModelId);
      invalidateCredits();

      const result: UpscaleResult = {
        imageUrl: data.imageUrl,
        width: data.width,
        height: data.height,
        model: data.model,
        creditsUsed: data.creditsUsed,
      };

      onResult?.(result);

      // Replace preview with upscaled image
      setImagePreview(data.imageUrl);
      setImageUrl(data.imageUrl);
      setImageDims({ width: data.width, height: data.height });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upscale failed");
    } finally {
      setGenerating(false);
    }
  }, [imageUrl, generating, selectedModelId, scale, imageDims, onResult]);

  const canUpscale = !!imageUrl && !uploading && !generating;

  // Dynamic credit estimate based on actual image dimensions + scale
  const estimatedCredits = useMemo(() => {
    const p = pricing[selectedModelId];
    if (!p) return 0;
    if (p.pricing_unit === "per_megapixel") {
      if (!imageDims) return 0; // can't estimate without knowing image size
      const outputMP = (imageDims.width * scale * imageDims.height * scale) / 1_000_000;
      return Math.ceil(p.effective_credits * outputMP);
    }
    return p.effective_credits;
  }, [pricing, selectedModelId, imageDims, scale]);

  // Output dimensions label
  const outputLabel = useMemo(() => {
    if (!imageDims) return null;
    const w = imageDims.width * scale;
    const h = imageDims.height * scale;
    const mp = ((w * h) / 1_000_000).toFixed(1);
    return `${w}×${h} (${mp} MP)`;
  }, [imageDims, scale]);

  return (
    <>
      <div className="space-y-5">
        {/* Model selector */}
        <div>
          <SectionLabel>Model</SectionLabel>
          <ModelSelector
            models={selectorModels}
            selectedIds={[selectedModelId]}
            onChange={handleModelChange}
            pricing={pricing}
            creditRanges={creditRanges}
            mode="single"
            title="Upscale Model"
            subtitle="Select an upscale model"
          />
        </div>

        {/* Scale factor */}
        <div>
          <SectionLabel>Scale Factor</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {selectedModel.scales.map((s) => (
              <PillButton key={s} active={scale === s} onClick={() => setScale(s)}>
                {s}x
              </PillButton>
            ))}
          </div>
          {outputLabel && (
            <p className="mt-1.5 text-[10px] text-muted">
              Output: {outputLabel}
            </p>
          )}
        </div>

        {/* Creativity / Enhancement strength — Crystal models only */}
        {selectedModel.supportsCreativity && (
          <div>
            <SectionLabel>Enhancement Strength</SectionLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={creativity}
                onChange={(e) => setCreativity(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
              />
              <span className="w-6 shrink-0 text-right text-[11px] font-medium text-foreground">{creativity}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted">
              {creativity === 0 ? "Faithful — preserves original details" : creativity <= 3 ? "Subtle refinement" : creativity <= 6 ? "Moderate enhancement" : "Aggressive refinement"}
            </p>
          </div>
        )}

        {/* Image upload area */}
        <div>
          <SectionLabel>Source Image</SectionLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {imagePreview ? (
            <div className="group relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Source"
                className="w-full object-contain"
                style={{ maxHeight: 240 }}
              />

              {/* Upload spinner overlay */}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              )}

              {/* Dimensions badge */}
              {imageDims && !uploading && (
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
                  {imageDims.width}×{imageDims.height}
                </span>
              )}

              {/* Remove button */}
              {!generating && (
                <button
                  onClick={clearImage}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l6 6M7 1l-6 6" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 transition ${
                dragOver
                  ? "border-accent bg-accent/5"
                  : "border-border/60 hover:border-accent/40"
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/70">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 16l5-5 4 4 3-3 6 6" />
                <circle cx="15.5" cy="8.5" r="1.5" />
              </svg>
              <span className="text-xs text-muted">
                Drop image or click to upload
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* Upscale button */}
        <button
          onClick={handleUpscale}
          disabled={!canUpscale}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold tracking-wide transition ${
            canUpscale
              ? "bg-accent text-black hover:bg-accent-hover"
              : "cursor-not-allowed bg-surface-hover text-muted"
          }`}
        >
          {generating ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {category === "skin" ? "Enhancing..." : "Upscaling..."}
            </>
          ) : (
            <>
              {category === "skin" ? "Enhance" : "Upscale"}
              {estimatedCredits > 0 && (
                <span className="flex items-center gap-1 opacity-60">
                  <CreditIcon size={10} /> {estimatedCredits}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Insufficient credits modal */}
      <InsufficientCreditsModal open={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
    </>
  );
}

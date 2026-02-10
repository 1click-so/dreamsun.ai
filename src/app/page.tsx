"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { fal } from "@fal-ai/client";
import { MODELS, type ModelConfig } from "@/lib/models";

// Route uploads through our proxy (keeps FAL_KEY server-side).
// fal.storage.upload() sends file bytes directly to fal CDN via presigned URL,
// only the small initiation request goes through the proxy — no size limit.
fal.config({ proxyUrl: "/api/fal/proxy" });

interface GenerationResult {
  imageUrl: string;
  width: number;
  height: number;
  seed: number;
  model: string;
  requestId: string;
}

interface UploadedImage {
  /** Unique ID for stable React keys and matching */
  id: string;
  /** Object URL for local preview display */
  preview: string;
  /** fal.media CDN URL after upload */
  url: string | null;
  /** Upload in progress */
  uploading: boolean;
}

let imageIdCounter = 0;

function getInitialModel(): ModelConfig {
  if (typeof window === "undefined") return MODELS[0];
  const saved = localStorage.getItem("dreamsun_model");
  if (saved) {
    const found = MODELS.find((m) => m.id === saved);
    if (found) return found;
  }
  return MODELS[0];
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(getInitialModel);
  const [aspectRatio, setAspectRatio] = useState(() => {
    if (typeof window === "undefined") return "16:9";
    return localStorage.getItem("dreamsun_ratio") || "16:9";
  });
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxImages = selectedModel.referenceImage?.maxImages ?? 1;

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const filesToProcess = Array.from(files).slice(
        0,
        maxImages - referenceImages.length
      );

      for (const file of filesToProcess) {
        const id = `img_${++imageIdCounter}`;
        const preview = URL.createObjectURL(file);

        // Show preview immediately with uploading spinner
        const newImage: UploadedImage = { id, preview, url: null, uploading: true };
        setReferenceImages((prev) => [...prev, newImage]);

        try {
          // Upload directly to fal CDN via presigned URL (no server size limits)
          const url = await fal.storage.upload(file);

          setReferenceImages((prev) =>
            prev.map((img) =>
              img.id === id ? { ...img, url, uploading: false } : img
            )
          );
        } catch (err) {
          setReferenceImages((prev) => prev.filter((img) => img.id !== id));
          setError(
            `Upload failed: ${err instanceof Error ? err.message : "Network error"}`
          );
        }
      }

      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [maxImages, referenceImages.length]
  );

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        modelId: selectedModel.id,
        prompt: prompt.trim(),
        aspectRatio,
      };

      if (
        referenceImages.length > 0 &&
        selectedModel.capability === "image-to-image"
      ) {
        // Send the uploaded fal.media URLs (not base64)
        const urls = referenceImages
          .filter((img) => img.url)
          .map((img) => img.url as string);
        if (urls.length > 0) {
          body.referenceImageUrls = urls;
        }
      }

      if (negativePrompt.trim() && selectedModel.supportsNegativePrompt) {
        body.negativePrompt = negativePrompt.trim();
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      setResult(data);
      setHistory((prev) => [data, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    const model = MODELS.find((m) => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      localStorage.setItem("dreamsun_model", model.id);
      if (!model.aspectRatios.includes(aspectRatio)) {
        const newRatio = model.defaultAspectRatio;
        setAspectRatio(newRatio);
        localStorage.setItem("dreamsun_ratio", newRatio);
      }
      // Clear reference images when switching models
      if (model.capability !== selectedModel.capability) {
        setReferenceImages([]);
      }
    }
  };

  const textToImageModels = MODELS.filter(
    (m) => m.capability === "text-to-image" || m.capability === "both"
  );
  const imageToImageModels = MODELS.filter(
    (m) => m.capability === "image-to-image" || m.capability === "both"
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-accent">Dream</span>Sun.ai
          </h1>
          <span className="text-sm text-muted">AI Image Generator</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Left Column — Controls */}
          <div className="space-y-6">
            {/* Model Selector */}
            <section>
              <label className="mb-2 block text-sm font-medium text-muted">
                Model
              </label>
              <select
                value={selectedModel.id}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
              >
                <optgroup label="Text to Image">
                  {textToImageModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.costPerImage}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Image to Image">
                  {imageToImageModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.costPerImage}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1.5 text-xs text-muted">
                {selectedModel.description}
              </p>
            </section>

            {/* Reference Images (for image-to-image) */}
            {selectedModel.capability === "image-to-image" && (
              <section>
                <label className="mb-2 block text-sm font-medium text-muted">
                  Reference Image{maxImages > 1 ? `s (up to ${maxImages})` : ""}
                </label>

                {/* Uploaded images grid */}
                {referenceImages.length > 0 && (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {referenceImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative overflow-hidden rounded-md border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.preview}
                          alt="Reference"
                          className="aspect-square w-full object-cover"
                        />
                        {img.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                          </div>
                        )}
                        <button
                          onClick={() => removeReferenceImage(img.id)}
                          className="absolute right-1 top-1 rounded-full bg-background/80 px-1.5 py-0.5 text-xs text-muted hover:text-foreground"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload area — show if under max */}
                {referenceImages.length < maxImages && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex min-h-[100px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface transition hover:border-accent/50 hover:bg-surface-hover"
                  >
                    <div className="text-center text-sm text-muted">
                      <p className="mb-1">
                        {referenceImages.length === 0
                          ? "Click to upload reference image"
                          : "Add more images"}
                      </p>
                      <p className="text-xs">PNG, JPG, WebP</p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple={maxImages > 1}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </section>
            )}

            {/* Prompt */}
            <section>
              <label className="mb-2 block text-sm font-medium text-muted">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={5}
                className="w-full resize-y rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/50 focus:border-accent"
              />
            </section>

            {/* Negative Prompt */}
            {selectedModel.supportsNegativePrompt && (
              <section>
                <label className="mb-2 block text-sm font-medium text-muted">
                  Negative Prompt
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid in the generation..."
                  rows={2}
                  className="w-full resize-y rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/50 focus:border-accent"
                />
              </section>
            )}

            {/* Aspect Ratio */}
            <section>
              <label className="mb-2 block text-sm font-medium text-muted">
                Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedModel.aspectRatios.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => {
                      setAspectRatio(ratio);
                      localStorage.setItem("dreamsun_ratio", ratio);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      aspectRatio === ratio
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-muted hover:border-accent/30"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </section>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !prompt.trim() ||
                referenceImages.some((img) => img.uploading)
              }
              className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>

          </div>

          {/* Right Column — Output */}
          <div className="space-y-6">
            {/* Current Result */}
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted">Output</h2>
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-border bg-surface">
                {isGenerating ? (
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <p className="text-sm text-muted">
                      Generating with {selectedModel.name}...
                    </p>
                  </div>
                ) : error ? (
                  <div className="w-full p-4">
                    <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <p className="text-sm font-medium text-red-400">
                        Error
                      </p>
                      <p className="mt-1 text-sm text-red-400/80">{error}</p>
                    </div>
                  </div>
                ) : result ? (
                  <div className="w-full p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageUrl}
                      alt="Generated"
                      className="w-full rounded-md"
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <span>
                        {result.width}x{result.height} — {result.model}
                      </span>
                      <a
                        href={result.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        Open full size
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Generated image will appear here
                  </p>
                )}
              </div>
            </section>

            {/* History */}
            {history.length > 1 && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-muted">
                  History
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {history.slice(1).map((item, i) => (
                    <button
                      key={item.requestId || i}
                      onClick={() => setResult(item)}
                      className="overflow-hidden rounded-md border border-border transition hover:border-accent/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={`History ${i + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { MODELS, type ModelConfig } from "@/lib/models";

interface GenerationResult {
  imageUrl: string;
  width: number;
  height: number;
  seed: number;
  model: string;
  requestId: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(MODELS[0]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Create preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setReferencePreview(dataUrl);
        setReferenceImage(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    []
  );

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

      if (referenceImage && selectedModel.capability === "image-to-image") {
        body.referenceImageUrl = referenceImage;
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
      if (!model.aspectRatios.includes(aspectRatio)) {
        setAspectRatio(model.defaultAspectRatio);
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

            {/* Reference Image (for image-to-image) */}
            {selectedModel.capability === "image-to-image" && (
              <section>
                <label className="mb-2 block text-sm font-medium text-muted">
                  Reference Image
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex min-h-[160px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface transition hover:border-accent/50 hover:bg-surface-hover"
                >
                  {referencePreview ? (
                    <div className="relative p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={referencePreview}
                        alt="Reference"
                        className="max-h-[200px] rounded-md object-contain"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReferenceImage(null);
                          setReferencePreview(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted">
                      <p className="mb-1">Click to upload reference image</p>
                      <p className="text-xs">PNG, JPG, WebP</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
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
                    onClick={() => setAspectRatio(ratio)}
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
              disabled={isGenerating || !prompt.trim()}
              className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>

            {error && (
              <p className="rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
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

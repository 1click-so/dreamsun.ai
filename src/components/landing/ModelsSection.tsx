"use client";

import { motion } from "motion/react";
import { Clock } from "lucide-react";

interface ModelCard {
  name: string;
  provider: string;
  capability: "image" | "video";
  description: string;
  highlight?: string;
  comingSoon?: boolean;
}

const models: ModelCard[] = [
  // Image models
  {
    name: "Nano Banana Pro",
    provider: "Google",
    capability: "image",
    description: "Excellent character consistency and typography. Supports negative prompts and up to 4K.",
    highlight: "Featured",
  },
  {
    name: "NanoBanana 2",
    provider: "Google",
    capability: "image",
    description: "Fast, affordable generation with high quality. Great for rapid iteration.",
    highlight: "New",
  },
  {
    name: "Grok Imagine",
    provider: "xAI",
    capability: "image",
    description: "Highly aesthetic outputs with a distinctive artistic style. Lowest cost per image.",
  },
  {
    name: "FLUX 2",
    provider: "Black Forest Labs",
    capability: "image",
    description: "Open-source powerhouse with LoRA support for character consistency and custom styles.",
  },
  // Video models
  {
    name: "Kling 3.0",
    provider: "Kuaishou",
    capability: "video",
    description: "Latest generation. Multi-shot, elements for facial consistency, audio generation, 3–15s.",
    highlight: "Featured",
  },
  {
    name: "Veo",
    provider: "Google DeepMind",
    capability: "video",
    description: "Google's flagship video model. High-fidelity cinematic output with precise motion control.",
    comingSoon: true,
  },
  {
    name: "Sora",
    provider: "OpenAI",
    capability: "video",
    description: "OpenAI's world-simulation model. Photorealistic video from text and image inputs.",
    comingSoon: true,
  },
  {
    name: "Seedance 2.0",
    provider: "ByteDance",
    capability: "video",
    description: "Next-gen from ByteDance. Camera lock, multi-resolution, highly affordable per-second pricing.",
    comingSoon: true,
  },
];

const providerColors: Record<string, string> = {
  Google: "bg-blue-500/15 text-blue-400",
  "Google DeepMind": "bg-blue-500/15 text-blue-400",
  xAI: "bg-foreground/10 text-foreground/70",
  "Black Forest Labs": "bg-emerald-500/15 text-emerald-400",
  Kuaishou: "bg-orange-500/15 text-orange-400",
  OpenAI: "bg-foreground/10 text-foreground/70",
  ByteDance: "bg-purple-500/15 text-purple-400",
};

export function ModelsSection() {
  const imageModels = models.filter((m) => m.capability === "image");
  const videoModels = models.filter((m) => m.capability === "video");

  return (
    <section id="models" className="py-28 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">
            Models & Providers
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            The best AI under one roof
          </h2>
          <p className="text-muted text-base max-w-xl">
            We integrate the leading AI models so you can pick the right tool for every creative task — without switching platforms.
          </p>
        </motion.div>

        {/* Image models */}
        <div className="mb-12">
          <h3 className="text-xs uppercase tracking-[0.15em] text-muted/60 font-medium mb-5 pl-1">
            Image Generation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {imageModels.map((model, i) => (
              <ModelCardComponent key={model.name} model={model} delay={i * 0.06} />
            ))}
          </div>
        </div>

        {/* Video models */}
        <div>
          <h3 className="text-xs uppercase tracking-[0.15em] text-muted/60 font-medium mb-5 pl-1">
            Video Generation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {videoModels.map((model, i) => (
              <ModelCardComponent key={model.name} model={model} delay={i * 0.06} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModelCardComponent({ model, delay }: { model: ModelCard; delay: number }) {
  const colors = providerColors[model.provider] ?? "bg-accent/10 text-accent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      className={`group relative rounded-xl border bg-surface/30 p-5 flex flex-col ${
        model.comingSoon
          ? "border-border/50 opacity-75"
          : "border-border hover:border-accent/30 transition-colors"
      }`}
    >
      {/* Provider badge */}
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full ${colors}`}>
          {model.provider}
        </span>
        {model.highlight && !model.comingSoon && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-accent">
            {model.highlight}
          </span>
        )}
        {model.comingSoon && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-muted/50">
            <Clock size={10} />
            Soon
          </span>
        )}
      </div>

      <h4 className="font-display text-base font-semibold tracking-tight mb-2">
        {model.name}
      </h4>

      <p className="text-muted text-xs leading-relaxed flex-1">
        {model.description}
      </p>
    </motion.div>
  );
}

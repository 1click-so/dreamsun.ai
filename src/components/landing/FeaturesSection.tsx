"use client";

import { motion } from "motion/react";
import { Image as ImageIcon, Film, LayoutGrid, ArrowUpRight } from "lucide-react";

const features = [
  {
    icon: <ImageIcon size={22} />,
    title: "Image Generation",
    description:
      "Create stunning images from text with multiple state-of-the-art models. Choose between Google, xAI, and Black Forest Labs — each with unique strengths.",
    tags: ["Text-to-Image", "Reference Images", "Negative Prompts", "Up to 4K"],
  },
  {
    icon: <Film size={22} />,
    title: "Video Generation",
    description:
      "Transform any image into cinematic video. Control duration, resolution, camera movement, and generate synchronized audio — all from a single frame.",
    tags: ["Image-to-Video", "Motion Control", "Audio Sync", "Up to 2160p"],
  },
  {
    icon: <LayoutGrid size={22} />,
    title: "Shots & Storyboarding",
    description:
      "Plan multi-shot sequences with per-shot prompts. Generate images, then animate each shot into video. Build complete visual narratives scene by scene.",
    tags: ["Multi-Shot", "Per-Shot Prompts", "Scene Planning", "Batch Generate"],
  },
  {
    icon: <ArrowUpRight size={22} />,
    title: "Upscale & Edit",
    description:
      "Enhance resolution, edit with reference images, and refine outputs with image-to-image models. Up to 14 reference images for precise control.",
    tags: ["Super Resolution", "Image-to-Image", "Multi-Reference", "Precision Edit"],
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-6 md:px-12">
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
            What you can do
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Everything you need to create
          </h2>
        </motion.div>

        {/* Feature cards — 2×2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative rounded-xl border border-border bg-surface/50 p-7 sm:p-8 hover:border-accent/30 transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent mb-5">
                {feature.icon}
              </div>

              <h3 className="font-display text-xl font-semibold mb-3 tracking-tight">
                {feature.title}
              </h3>

              <p className="text-muted text-sm leading-relaxed mb-5">
                {feature.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {feature.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-accent/5 text-accent/70 border border-accent/10 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Hover glow */}
              <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-accent/10 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

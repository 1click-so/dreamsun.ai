"use client";

import { motion } from "motion/react";
import { Image as ImageIcon, Video, Wand2, Layers, Zap } from "lucide-react";

const features = [
  {
    title: "Cinematic Video",
    description: "Turn text into hyper-realistic 4K video sequences with precise camera control.",
    icon: <Video className="text-accent" size={24} />,
    className: "md:col-span-2 md:row-span-2",
    large: true,
  },
  {
    title: "Image Generation",
    description: "Create stunning artwork in any style.",
    icon: <ImageIcon className="text-accent" size={24} />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Style Transfer",
    description: "Apply the vibe of one image to another.",
    icon: <Wand2 className="text-accent" size={24} />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Infinite Canvas",
    description: "Outpaint and expand your creations boundlessly.",
    icon: <Layers className="text-accent" size={24} />,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Real-time Rendering",
    description: "See your ideas come to life instantly.",
    icon: <Zap className="text-accent" size={24} />,
    className: "md:col-span-1 md:row-span-1",
  },
];

export function BentoGrid() {
  return (
    <section id="features" className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
      <div className="mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "var(--font-hand)" }}>Creative Superpowers</h2>
        <p className="text-white/60 text-lg max-w-2xl">Everything you need to bring your imagination to life, powered by our next-generation multimodal models.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-[280px] gap-4 md:gap-6">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className={`group relative overflow-hidden rounded-3xl bg-card border border-border p-8 flex flex-col justify-between hover:border-accent/50 transition-colors ${feature.className}`}
          >
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                {feature.icon}
              </div>
            </div>

            <div className="relative z-10 mt-auto">
              <h3 className={`font-display font-bold mb-2 ${feature.large ? "text-3xl" : "text-xl"}`}>
                {feature.title}
              </h3>
              <p className="text-white/60 text-sm md:text-base leading-relaxed">
                {feature.description}
              </p>
            </div>

            {/* Hover Glow */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-accent/20 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

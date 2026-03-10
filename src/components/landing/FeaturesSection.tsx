"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Feature {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  video?: string;
  href: string;
  badge: string | null;
  span: string;
  tall?: boolean;
}

const features: Feature[] = [
  {
    title: "Image Generation",
    subtitle: "Text to stunning visuals",
    description: "4 models from Google, xAI & Black Forest Labs. Negative prompts, 4K output, reference images.",
    image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=900&q=80",
    href: "/images",
    badge: null,
    span: "col-span-12 md:col-span-7 row-span-2",
    tall: true,
  },
  {
    title: "Video Generation",
    subtitle: "Animate any image",
    description: "Kling 3.0, Seedance, LTX — up to 2160p. First & last frame control, audio generation.",
    image: "https://images.unsplash.com/photo-1518676590747-1e3dcf5a0bbb?w=900&q=80",
    video: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
    href: "/video",
    badge: "Hot",
    span: "col-span-12 md:col-span-5",
    tall: false,
  },
  {
    title: "Shots & Storyboard",
    subtitle: "Plan. Generate. Animate.",
    description: "Multi-shot scenes with per-shot prompts. Build visual narratives frame by frame.",
    image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=900&q=80",
    href: "/shots",
    badge: "New",
    span: "col-span-12 md:col-span-5",
    tall: false,
  },
  {
    title: "Upscale & Edit",
    subtitle: "Refine with precision",
    description: "Image-to-image editing with up to 14 reference images. Enhance resolution across all models.",
    image: "https://images.unsplash.com/photo-1549490349-8643362247b5?w=900&q=80",
    href: "/images",
    badge: null,
    span: "col-span-6 md:col-span-4",
    tall: false,
  },
  {
    title: "Motion Control",
    subtitle: "Transfer any movement",
    description: "Copy motion from reference videos. Facial consistency with Kling Elements.",
    image: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=900&q=80",
    href: "/video",
    badge: null,
    span: "col-span-6 md:col-span-4",
    tall: false,
  },
  {
    title: "Audio Sync",
    subtitle: "Sound meets vision",
    description: "Generate audio for video or sync to an existing track. Built into every video model.",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
    href: "/video",
    badge: null,
    span: "col-span-12 md:col-span-4",
    tall: false,
  },
];

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 16 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, margin: "-60px" as const },
  transition: { duration: 0.45, delay: 0.06 * i },
});

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-5 md:px-10">
      <div className="max-w-[1200px] mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">
            What you can do
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Everything you need to create
          </h2>
        </motion.div>

        {/* Bento grid */}
        <div className="grid auto-rows-[180px] grid-cols-12 gap-3">
          {features.map((feature, i) => (
            <motion.div key={feature.title} {...stagger(i)} className={feature.span}>
              <Link href={feature.href} className="group block h-full">
                <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border">
                  {/* Background — video or image */}
                  {feature.video ? (
                    <>
                      <video
                        src={feature.video}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={feature.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={feature.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading={i < 2 ? "eager" : "lazy"}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                  {/* Content */}
                  <div className="relative mt-auto p-5 md:p-6">
                    {feature.badge && (
                      <span className="mb-2 inline-block rounded-sm bg-accent px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-black shadow-[0_0_8px_var(--color-accent)]">
                        {feature.badge}
                      </span>
                    )}
                    <h3 className="font-display text-lg font-bold tracking-tight text-white md:text-xl">
                      {feature.title}
                    </h3>
                    <p
                      className="mt-0.5 text-sm text-accent/90"
                      style={{ fontFamily: "var(--font-hand)" }}
                    >
                      {feature.subtitle}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/50 max-w-sm">
                      {feature.description}
                    </p>
                  </div>

                  {/* Hover arrow */}
                  <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowRight size={14} className="text-white" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

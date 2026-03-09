"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  ImageIcon,
  Film,
  Clapperboard,
  Wand2,
  ScanEye,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Promotional banner data                                            */
/* ------------------------------------------------------------------ */

const PROMO_BANNERS = [
  {
    title: "SHOTS",
    subtitle: "Storyboard your vision",
    description: "Plan scenes. Generate per-shot. Export storyboards.",
    badge: "New",
    image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80",
    video: undefined as string | undefined,
    href: "/shots",
    span: "col-span-6 md:col-span-3 row-span-2",
    tall: true,
  },
  {
    title: "NanoBanana 2",
    subtitle: "Pro quality at flash speed",
    description: "Google's fastest model. $0.08 per image.",
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80",
    href: "/images",
    span: "col-span-6 md:col-span-5",
    tall: false,
  },
  {
    title: "Grok Imagine",
    subtitle: "Aesthetic generation by xAI",
    description: "Highly aesthetic results. Just $0.02 per image.",
    badge: null,
    image: "https://images.unsplash.com/photo-1549490349-8643362247b5?w=800&q=80",
    href: "/images",
    span: "col-span-6 md:col-span-4",
    tall: false,
  },
  {
    title: "Kling 3.0",
    subtitle: "Next-gen video generation",
    description: "First + last frame control. 3–15s clips. Audio generation.",
    badge: "New",
    video: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
    image: "https://images.unsplash.com/photo-1518676590747-1e3dcf5a0bbb?w=800&q=80",
    href: "/video",
    span: "col-span-6 md:col-span-5",
    tall: false,
  },
  {
    title: "Nano Banana Pro",
    subtitle: "4K with character consistency",
    description: "Typography, negative prompts, 14 reference images.",
    badge: null,
    image: "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?w=800&q=80",
    href: "/images",
    span: "col-span-6 md:col-span-4",
    tall: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Quick tools                                                        */
/* ------------------------------------------------------------------ */

const QUICK_TOOLS = [
  { icon: ImageIcon, label: "Image Generator", href: "/images", badge: null },
  { icon: Film, label: "Video Generator", href: "/video", badge: null },
  { icon: Clapperboard, label: "Shot Scenes", href: "/shots", badge: "Hot" },
  { icon: Wand2, label: "Edit with Refs", href: "/images", badge: null },
  { icon: ScanEye, label: "Upscale", href: "/images?mode=upscale", badge: "New" },
];

/* ------------------------------------------------------------------ */
/*  Gallery / showcase images                                          */
/* ------------------------------------------------------------------ */

const GALLERY_IMAGES = [
  { src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=500&q=80", label: "Image", type: "image" },
  { src: "https://images.unsplash.com/photo-1549490349-8643362247b5?w=500&q=80", label: "Image", type: "image" },
  { src: "https://images.unsplash.com/photo-1518676590747-1e3dcf5a0bbb?w=500&q=80", label: "Video", type: "video" },
  { src: "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?w=500&q=80", label: "Image", type: "image" },
  { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80", label: "Image", type: "image" },
  { src: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500&q=80", label: "Video", type: "video" },
  { src: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=500&q=80", label: "Image", type: "image" },
  { src: "https://images.unsplash.com/photo-1533158326339-7f3cf2404354?w=500&q=80", label: "Image", type: "image" },
];

/* ------------------------------------------------------------------ */
/*  Marquee images                                                     */
/* ------------------------------------------------------------------ */

const MARQUEE_ROW_1 = [
  "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80",
  "https://images.unsplash.com/photo-1549490349-8643362247b5?w=400&q=80",
  "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400&q=80",
  "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&q=80",
  "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?w=400&q=80",
  "https://images.unsplash.com/photo-1533158326339-7f3cf2404354?w=400&q=80",
];

const MARQUEE_ROW_2 = [
  "https://images.unsplash.com/photo-1518676590747-1e3dcf5a0bbb?w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&q=80",
];

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: 0.05 * i, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function MarqueeStrip({ images, reverse = false, speed = 35 }: { images: string[]; reverse?: boolean; speed?: number }) {
  const doubled = [...images, ...images];
  return (
    <div className="overflow-hidden">
      <div
        className="flex w-max gap-2"
        style={{ animation: `${reverse ? "marquee-reverse" : "marquee"} ${speed}s linear infinite` }}
      >
        {doubled.map((src, i) => (
          <div key={i} className="relative h-[110px] w-[165px] shrink-0 overflow-hidden rounded-lg md:h-[130px] md:w-[195px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="mx-auto max-w-[1440px] px-5 py-6 lg:px-8">

        {/* ============================================================ */}
        {/*  PROMO BANNERS — asymmetric bento grid                       */}
        {/* ============================================================ */}
        <div className="grid auto-rows-[160px] grid-cols-12 gap-3">
          {PROMO_BANNERS.map((banner, i) => (
            <motion.div key={banner.title} {...stagger(i)} className={banner.span}>
              <Link href={banner.href} className="group block h-full">
                <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border">
                  {/* Background — video or image */}
                  {banner.video ? (
                    <>
                      <video
                        src={banner.video}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {/* Fallback poster */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={banner.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={banner.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading={i < 2 ? "eager" : "lazy"}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                  <div className="relative mt-auto p-4 md:p-5">
                    {banner.badge && (
                      <span className="mb-2 inline-block rounded-sm bg-accent px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-black shadow-[0_0_8px_var(--color-accent)]">
                        {banner.badge}
                      </span>
                    )}
                    <h3 className="font-display text-lg font-bold tracking-tight text-white md:text-xl">
                      {banner.title}
                    </h3>
                    <p
                      className="mt-0.5 text-sm text-accent/90"
                      style={{ fontFamily: "var(--font-hand)" }}
                    >
                      {banner.subtitle}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                      {banner.description}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ============================================================ */}
        {/*  QUICK TOOLS — horizontal scrollable row                     */}
        {/* ============================================================ */}
        <motion.div {...stagger(5)} className="mt-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_TOOLS.map((tool) => (
              <Link
                key={tool.label}
                href={tool.href}
                className="group flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent/30 hover:bg-surface-hover"
              >
                <tool.icon size={16} className="text-accent" />
                <span className="text-xs font-medium text-foreground">{tool.label}</span>
                {tool.badge && (
                  <span className={`rounded-sm px-1.5 py-px text-[9px] font-bold uppercase leading-tight ${
                    tool.badge === "Hot"
                      ? "bg-accent text-black"
                      : "bg-muted/20 text-muted"
                  }`}>
                    {tool.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ============================================================ */}
        {/*  SHOWCASE MARQUEE                                             */}
        {/* ============================================================ */}
        <motion.div {...stagger(6)} className="mt-6 overflow-hidden rounded-xl border border-border bg-surface py-4">
          <div className="mb-3 flex items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <p
                className="text-base text-accent"
                style={{ fontFamily: "var(--font-hand)" }}
              >
                made with dreamsun
              </p>
            </div>
            <span className="text-[10px] text-muted">Community showcase</span>
          </div>
          <div className="space-y-2">
            <MarqueeStrip images={MARQUEE_ROW_1} speed={40} />
            <MarqueeStrip images={MARQUEE_ROW_2} reverse speed={45} />
          </div>
        </motion.div>

        {/* ============================================================ */}
        {/*  GET INSPIRED — image grid with type badges                   */}
        {/* ============================================================ */}
        <motion.div {...stagger(7)} className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Get inspired</h2>
            <div className="flex items-center gap-1.5">
              {["All", "Images", "Videos", "Shots"].map((tab, i) => (
                <button
                  key={tab}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    i === 0
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {GALLERY_IMAGES.map((item, i) => (
              <motion.div key={i} {...stagger(8 + i)}>
                <Link href="/images" className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                    {/* Type badge */}
                    <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {item.label}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ============================================================ */}
        {/*  BOTTOM CTA — image-backed with Gochi Hand                   */}
        {/* ============================================================ */}
        <motion.div {...stagger(16)} className="mt-6 mb-4">
          <Link href="/images" className="group block">
            <div className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1400&q=80"
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
              <div className="relative flex items-center justify-between gap-6 px-8 py-8">
                <div>
                  <p
                    className="text-xl text-accent"
                    style={{ fontFamily: "var(--font-hand)" }}
                  >
                    create something incredible today
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    6 image models, video generation, and full storyboarding — all in one place.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-black transition group-hover:bg-accent-hover">
                  Start creating
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

      </div>
    </div>
  );
}

"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute top-[15%] left-[15%] w-[45vw] h-[45vw] rounded-full blur-[140px]"
          style={{ background: "radial-gradient(circle, rgba(161,252,223,0.15) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{
            x: [0, -60, 30, 0],
            y: [0, 80, -40, 0],
            scale: [1, 1.3, 0.85, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[5%] right-[10%] w-[35vw] h-[35vw] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(161,252,223,0.08) 0%, transparent 70%)" }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(161,252,223,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(161,252,223,0.3) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 flex flex-col items-center text-center max-w-5xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-medium mb-10 tracking-wide"
        >
          <Sparkles size={12} />
          100 free credits when you sign up
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-[-0.04em] leading-[0.92] mb-7"
        >
          Every AI model.
          <br />
          <span className="text-gradient" style={{ fontFamily: "var(--font-hand)" }}>
            One creative studio.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="max-w-2xl text-base sm:text-lg md:text-xl text-muted mb-12 leading-relaxed"
        >
          Generate images with Google, xAI &amp; Black Forest Labs.
          Create cinematic videos with Kling, Veo &amp; Sora.
          All from one dashboard.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/login?mode=signup"
            className="group h-13 px-10 rounded-full bg-accent text-black font-semibold text-base flex items-center gap-2.5 hover:scale-105 hover:shadow-[0_0_40px_rgba(161,252,223,0.25)] transition-all"
          >
            Start Creating — Free
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="h-13 px-8 rounded-full border border-border text-foreground font-medium text-base flex items-center gap-2 hover:bg-surface transition-colors"
          >
            Sign In
          </Link>
        </motion.div>

        {/* Trust */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-8 text-xs text-muted/50"
        >
          No credit card required
        </motion.p>

        {/* Provider strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] text-muted/40 uppercase tracking-[0.2em] font-medium"
        >
          <span>Powered by</span>
          <span className="text-foreground/30">Google</span>
          <span className="text-foreground/30">xAI</span>
          <span className="text-foreground/30">Black Forest Labs</span>
          <span className="text-foreground/30">OpenAI</span>
          <span className="text-foreground/30">Kuaishou</span>
          <span className="text-foreground/30">ByteDance</span>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="w-5 h-8 rounded-full border border-border flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-1.5 rounded-full bg-accent/60" />
        </motion.div>
      </motion.div>
    </section>
  );
}

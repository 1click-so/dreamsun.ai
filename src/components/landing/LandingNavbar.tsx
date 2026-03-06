"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export function LandingNavbar() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 glass border-t-0 border-l-0 border-r-0 border-b border-white/5"
    >
      <Link href="/" className="flex items-center gap-2 group">
        <div className="group-hover:scale-110 transition-transform">
          <Logo size={16} />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">DreamSun</span>
      </Link>

      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
        <Link href="#features" className="hover:text-accent transition-colors">Features</Link>
        <Link href="#gallery" className="hover:text-accent transition-colors">Gallery</Link>
        <Link href="#pricing" className="hover:text-accent transition-colors">Pricing</Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm font-medium hover:text-accent transition-colors hidden sm:block">
          Log in
        </Link>
        <Link href="/login" className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-accent transition-colors">
          Start Creating
        </Link>
      </div>
    </motion.nav>
  );
}

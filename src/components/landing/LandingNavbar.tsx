"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Menu, X } from "lucide-react";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-border py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-12">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="group-hover:scale-110 transition-transform">
            <Logo size={16} />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">DreamSun</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          <a href="#features" className="hover:text-accent transition-colors">Features</a>
          <a href="#models" className="hover:text-accent transition-colors">Models</a>
          <a href="#pricing" className="hover:text-accent transition-colors">Pricing</a>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:text-accent transition-colors">
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="bg-accent text-black px-5 py-2 rounded-full text-sm font-bold hover:shadow-[0_0_20px_rgba(161,252,223,0.25)] hover:scale-105 transition-all"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-foreground"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-border mt-2 px-6 py-6 flex flex-col gap-4">
          <a href="#features" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-muted hover:text-accent transition-colors">Features</a>
          <a href="#models" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-muted hover:text-accent transition-colors">Models</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-muted hover:text-accent transition-colors">Pricing</a>
          <hr className="border-border" />
          <Link href="/login" className="text-sm font-medium text-muted hover:text-accent transition-colors">Sign in</Link>
          <Link
            href="/login?mode=signup"
            className="bg-accent text-black px-5 py-2.5 rounded-full text-sm font-bold text-center"
          >
            Get Started Free
          </Link>
        </div>
      )}
    </nav>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Logo } from "./Logo";
import { ProfileDropdown } from "./ProfileDropdown";

const NAV_ITEMS = [
  { href: "/images", label: "Images" },
  { href: "/video", label: "Videos" },
];

function NavBlobs() {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 w-[65%] overflow-hidden">
      {/* Core blob — centered exactly on logo (left-2 = ~20px, matching px-5 padding) */}
      <motion.div
        className="absolute left-2 -top-10 h-36 w-56 rounded-full bg-accent/[0.15] blur-3xl"
        animate={{
          x: [0, 10, -6, 0],
          y: [0, 8, -4, 0],
          scale: [1, 1.15, 0.93, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Secondary blob — just right of logo, reinforces epicenter */}
      <motion.div
        className="absolute left-8 -bottom-6 h-28 w-44 rounded-full bg-accent/[0.1] blur-3xl"
        animate={{
          x: [0, -10, 8, 0],
          y: [0, -6, 5, 0],
          scale: [1, 0.88, 1.12, 1],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      {/* Mid blob — covers Images / Videos buttons */}
      <motion.div
        className="absolute left-48 -top-6 h-28 w-48 rounded-full bg-accent/[0.07] blur-3xl"
        animate={{
          x: [0, -8, 6, 0],
          y: [0, -5, 4, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      {/* Far blob — behind SHOTS and beyond */}
      <motion.div
        className="absolute left-[340px] -bottom-4 h-24 w-44 rounded-full bg-accent/[0.05] blur-3xl"
        animate={{
          x: [0, 8, -12, 0],
          y: [0, 4, -2, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      {/* Fade-out mask — full strength first 30%, then dissolves */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent from-30% to-background" />
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isShotsActive = pathname?.startsWith("/shots");

  return (
    <nav className="relative flex items-center gap-5 border-b border-border px-5 py-3">
      {/* Living gradient blobs */}
      <NavBlobs />

      {/* Logo */}
      <div className="relative">
        <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-80">
          <Logo size={22} />
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            DreamSun
          </span>
        </Link>
      </div>

      <span className="relative text-border">|</span>

      {/* Nav items */}
      <div className="relative flex items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className="relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition"
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-accent/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </AnimatePresence>
                <span className={`relative ${isActive ? "text-accent-text" : "text-muted hover:text-foreground"}`}>
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}

        {/* Shots — premium feature */}
        <div>
          <Link
            href="/shots"
            className={`group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold tracking-wide transition ${
              isShotsActive
                ? "bg-accent/15 text-accent-text"
                : "text-accent-text hover:bg-accent/10"
            }`}
          >
            <span className="absolute inset-0 rounded-lg bg-accent/0 transition-all group-hover:bg-accent/8" />
            <span className="relative flex items-center gap-2">
              SHOTS
              <span className="rounded-sm bg-accent px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-black shadow-[0_0_8px_var(--color-accent)]">
                Hot
              </span>
            </span>
          </Link>
        </div>
      </div>

      {/* Right side — credits + profile */}
      <div className="relative ml-auto flex items-center gap-2">
        <Link
          href="/pricing"
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-accent/40 hover:text-accent"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L14 5.5V10.5L8 15L2 10.5V5.5L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M8 4.5L11 6.5V9.5L8 11.5L5 9.5V6.5L8 4.5Z" fill="currentColor" opacity="0.3" />
          </svg>
          Credits
        </Link>
        <ProfileDropdown />
      </div>
    </nav>
  );
}

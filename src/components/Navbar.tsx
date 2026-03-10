"use client";

import { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "./Logo";
import { ProfileDropdown } from "./ProfileDropdown";
import { usePricingOverlay } from "@/contexts/PricingOverlay";
import { AuthEventTracker } from "./AuthEventTracker";

const NAV_ITEMS = [
  { href: "/explore", label: "Explore" },
  { href: "/images", label: "Images" },
  { href: "/video", label: "Videos" },
];

function NavBlobs() {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 w-[65%] overflow-hidden">
      <div className="nav-blob-1 absolute left-2 -top-10 h-36 w-56 rounded-full bg-accent/[0.15] blur-3xl" />
      <div className="nav-blob-2 absolute left-8 -bottom-6 h-28 w-44 rounded-full bg-accent/[0.1] blur-3xl" />
      <div className="nav-blob-3 absolute left-48 -top-6 h-28 w-48 rounded-full bg-accent/[0.07] blur-3xl" />
      <div className="nav-blob-4 absolute left-[340px] -bottom-4 h-24 w-44 rounded-full bg-accent/[0.05] blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent from-30% to-background" />
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {open ? (
        <>
          <path d="M4 4l10 10" />
          <path d="M14 4L4 14" />
        </>
      ) : (
        <>
          <path d="M3 5h12" />
          <path d="M3 9h12" />
          <path d="M3 13h12" />
        </>
      )}
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isShotsActive = pathname?.startsWith("/shots");
  const isAudioActive = pathname?.startsWith("/audio");
  const isAvatarsActive = pathname?.startsWith("/avatars");
  const { openPricing } = usePricingOverlay();

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Track auth events (signup/login) from OAuth callback */}
      <Suspense><AuthEventTracker /></Suspense>

      <nav className="relative flex items-center gap-3 border-b border-border px-4 py-3 md:gap-5 md:px-5">
        <NavBlobs />

        {/* Logo */}
        <div className="relative">
          <Link href="/explore" className="flex items-center gap-2 transition hover:opacity-80 md:gap-2.5">
            <Logo size={22} />
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              DreamSun
            </span>
          </Link>
        </div>

        {/* Divider — desktop only */}
        <span className="relative hidden text-border md:block">|</span>

        {/* Desktop nav items */}
        <div className="relative hidden items-center gap-1.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className="relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition"
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg bg-accent/10 transition-all duration-200" />
                  )}
                  <span className={`relative ${isActive ? "text-accent-text" : "text-muted hover:text-foreground"}`}>
                    {item.label}
                  </span>
                </Link>
              </div>
            );
          })}

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

          <div>
            <Link
              href="/audio"
              className={`group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                isAudioActive
                  ? "bg-accent/15 text-accent-text"
                  : "text-muted hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <span className="relative flex items-center gap-2">
                Audio
                <span className="rounded-sm bg-muted/20 px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-muted">
                  Soon
                </span>
              </span>
            </Link>
          </div>

          <div>
            <Link
              href="/avatars"
              className={`group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                isAvatarsActive
                  ? "bg-accent/15 text-accent-text"
                  : "text-muted hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <span className="relative flex items-center gap-2">
                Avatars
                <span className="rounded-sm bg-muted/20 px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-muted">
                  Soon
                </span>
              </span>
            </Link>
          </div>
        </div>

        {/* Right side — credits + profile */}
        <div className="relative ml-auto flex items-center gap-2">
          <button
            onClick={() => openPricing("topup")}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-accent/40 hover:text-accent"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L14 5.5V10.5L8 15L2 10.5V5.5L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 4.5L11 6.5V9.5L8 11.5L5 9.5V6.5L8 4.5Z" fill="currentColor" opacity="0.3" />
            </svg>
            <span className="hidden sm:inline">Credits</span>
          </button>
          <ProfileDropdown />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover hover:text-foreground md:hidden"
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-[57px] z-50 border-b border-border bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-accent/10 text-accent-text" : "text-muted hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/shots"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isShotsActive ? "bg-accent/15 text-accent-text" : "text-accent-text hover:bg-accent/10"
              }`}
            >
              SHOTS
              <span className="rounded-sm bg-accent px-1.5 py-px text-[9px] font-bold uppercase leading-tight text-black">
                Hot
              </span>
            </Link>
            <Link
              href="/audio"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isAudioActive ? "bg-accent/15 text-accent-text" : "text-muted hover:bg-surface-hover"
              }`}
            >
              Audio
              <span className="rounded-sm bg-muted/20 px-1.5 py-px text-[9px] font-bold uppercase text-muted">Soon</span>
            </Link>
            <Link
              href="/avatars"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isAvatarsActive ? "bg-accent/15 text-accent-text" : "text-muted hover:bg-surface-hover"
              }`}
            >
              Avatars
              <span className="rounded-sm bg-muted/20 px-1.5 py-px text-[9px] font-bold uppercase text-muted">Soon</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

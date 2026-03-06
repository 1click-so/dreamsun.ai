"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "/generate", label: "Images" },
  { href: "/video", label: "Videos" },
];

export function Navbar() {
  const pathname = usePathname();
  const isShotsActive = pathname === "/shots";

  return (
    <nav className="flex items-center gap-4 border-b border-border px-5 py-2.5">
      <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
        <Logo size={20} />
        <span className="font-display text-sm font-bold tracking-tight text-foreground">DreamSun</span>
      </Link>
      <span className="text-border">|</span>
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Shots — hero feature, always accented */}
        <Link
          href="/shots"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition ${
            isShotsActive
              ? "bg-accent/15 text-accent"
              : "text-accent hover:bg-accent/10"
          }`}
        >
          Shots
          <span className="rounded bg-accent px-1 py-px text-[9px] font-bold uppercase leading-tight text-black">
            New
          </span>
        </Link>
      </div>
    </nav>
  );
}

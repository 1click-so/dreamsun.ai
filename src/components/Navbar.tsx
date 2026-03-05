"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "/", label: "Image" },
  { href: "/video", label: "Video" },
  { href: "/shots", label: "Shot List" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 border-b border-border px-5 py-2.5">
      <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
        <Logo size={20} />
        <span className="text-sm font-semibold text-foreground">DreamSun</span>
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
      </div>
    </nav>
  );
}

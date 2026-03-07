"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useCredits } from "@/hooks/useCredits";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { CreditIcon } from "@/components/ModelSelector";

/** SVG circular progress ring around the avatar */
function CreditRing({ ratio, size = 36 }: { ratio: number; size?: number }) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(Math.max(ratio, 0), 1));

  // Color shifts: accent (>40%), amber (15-40%), red (<15%)
  let strokeColor = "var(--color-accent)";
  if (ratio < 0.15) strokeColor = "var(--color-destructive)";
  else if (ratio < 0.4) strokeColor = "#f59e0b"; // amber-500

  return (
    <svg
      width={size}
      height={size}
      className="pointer-events-none absolute inset-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={stroke}
        opacity={0.5}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
  const { credits, maxCredits, loading: creditsLoading } = useCredits();
  const router = useRouter();

  // Fetch user email
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  const initial = email ? email[0].toUpperCase() : "?";
  const ratio = maxCredits > 0 ? credits / maxCredits : 1;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const avatarSize = 36;

  return (
    <div ref={ref} className="relative">
      {/* Avatar with credit ring */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center transition hover:opacity-80"
        style={{ width: avatarSize, height: avatarSize }}
      >
        <CreditRing ratio={creditsLoading ? 1 : ratio} size={avatarSize} />
        <span className="relative flex h-[28px] w-[28px] items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground">
          {initial}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-surface py-1.5 shadow-xl z-50">
          {/* Email */}
          {email && (
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-muted truncate">{email}</p>
            </div>
          )}

          {/* Credit balance */}
          <div className="px-3 py-2.5 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <CreditIcon size={12} />
                Credits
              </span>
              <span className="text-xs font-semibold text-foreground">
                {creditsLoading ? "..." : (
                  maxCredits > 0
                    ? <>{credits.toLocaleString()} <span className="text-muted font-normal">/ {maxCredits.toLocaleString()}</span></>
                    : <span className="text-muted">No plan</span>
                )}
              </span>
            </div>
            {!creditsLoading && maxCredits > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(ratio * 100, 100)}%`,
                    backgroundColor: ratio < 0.15 ? "var(--color-destructive)" : ratio < 0.4 ? "#f59e0b" : "var(--color-accent)",
                  }}
                />
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-foreground transition hover:bg-surface-hover"
          >
            <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
            <ThemeToggle isDark={theme === "dark"} />
          </button>

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 text-left text-xs text-destructive transition hover:bg-surface-hover"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Small pill toggle for dark/light */
function ThemeToggle({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`relative h-5 w-9 rounded-full transition-colors ${
        isDark ? "bg-accent/30" : "bg-border"
      }`}
    >
      <div
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-transform ${
          isDark ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </div>
  );
}

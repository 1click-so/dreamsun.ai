"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div ref={ref} className="relative">
      {/* Avatar circle */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground transition hover:bg-surface-hover"
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-surface py-1.5 shadow-lg z-50">
          {/* Email */}
          {email && (
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-muted truncate">{email}</p>
            </div>
          )}

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

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin progress bar at the top of the viewport (NProgress / YouTube style).
 * Shows instantly when the user clicks an internal link, giving immediate
 * feedback that navigation is happening. Completes when pathname changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "completing">("idle");
  const prevPathRef = useRef(pathname);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When pathname changes → complete the bar
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      if (state === "loading") {
        setState("completing");
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setState("idle"), 300);
      }
    }
  }, [pathname, state]);

  // Listen for clicks on internal links → start bar
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;

      // Skip if modifier keys (new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Skip if same page
      const url = new URL(href, window.location.origin);
      if (url.pathname === pathname) return;

      setState("loading");
      clearTimeout(timeoutRef.current);

      // Safety timeout — if navigation takes > 12s, auto-complete
      timeoutRef.current = setTimeout(() => {
        setState("completing");
        setTimeout(() => setState("idle"), 300);
      }, 12000);
    },
    [pathname]
  );

  useEffect(() => {
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [handleClick]);

  // Cleanup timeouts
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  if (state === "idle") return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] h-[2px]">
      <div
        className={`h-full bg-accent shadow-[0_0_8px_var(--color-accent)] ${
          state === "loading"
            ? "animate-nav-progress"
            : "animate-nav-complete"
        }`}
      />
    </div>
  );
}

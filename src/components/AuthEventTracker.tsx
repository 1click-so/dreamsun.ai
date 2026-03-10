"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trackSignupCompleted, trackLoginCompleted } from "@/lib/analytics";

/** Wait for window.rybbit to be available (script is defer-loaded) */
function waitForRybbit(maxMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.rybbit) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const check = setInterval(() => {
      if (window.rybbit) {
        clearInterval(check);
        resolve(true);
      } else if (Date.now() - start > maxMs) {
        clearInterval(check);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Invisible component that detects `?auth_event=signup:google` or `?auth_event=login:google`
 * (set by auth callback for OAuth flows) and fires the correct analytics event.
 * Must be wrapped in <Suspense> since it uses useSearchParams.
 */
export function AuthEventTracker() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authEvent = searchParams.get("auth_event");
    if (!authEvent) return;

    const [action, method] = authEvent.split(":") as [string, string];

    // Wait for Rybbit script to load before firing event
    waitForRybbit().then((ready) => {
      if (ready) {
        if (action === "signup") {
          trackSignupCompleted(method as "email" | "google");
        } else if (action === "login") {
          trackLoginCompleted(method as "email" | "google");
        }
      }

      // Clean the URL after event fires (or after timeout)
      const params = new URLSearchParams(searchParams.toString());
      params.delete("auth_event");
      const cleanUrl = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(cleanUrl, { scroll: false });
    });
  }, [searchParams, router, pathname]);

  return null;
}

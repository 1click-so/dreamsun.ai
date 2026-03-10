"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trackSignupCompleted, trackLoginCompleted } from "@/lib/analytics";

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

    if (action === "signup") {
      trackSignupCompleted(method as "email" | "google");
    } else if (action === "login") {
      trackLoginCompleted(method as "email" | "google");
    }

    // Clean the URL — remove the auth_event param without a page reload
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth_event");
    const cleanUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(cleanUrl, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}

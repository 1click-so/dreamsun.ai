"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trackSignupCompleted, trackLoginCompleted } from "@/lib/analytics";

/**
 * Detects `?auth_event=signup:google` or `?auth_event=login:google` param
 * (set by auth callback) and fires the correct analytics event, then cleans the URL.
 */
export function useNewSignupTracking() {
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
}

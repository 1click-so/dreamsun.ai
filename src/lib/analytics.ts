/**
 * Rybbit Analytics — DreamSun event tracking
 *
 * Events that tell the full user story:
 *   signup_completed      → new account created
 *   login_completed       → returning user signed in
 *   google_auth           → signed in/up via Google OAuth
 *   password_reset        → requested password reset
 *   image_generated       → generated image(s)
 *   video_generated       → generated a video
 *   shot_generated        → generated a shot (storyboard)
 *   shot_animated         → animated a shot to video
 *   upscale_completed     → upscaled an image
 *   checkout_started      → clicked subscribe or buy credits
 *   model_selected        → switched AI model
 */

declare global {
  interface Window {
    rybbit?: {
      event: (eventName: string, eventParams?: Record<string, string | number | boolean>) => void;
    };
  }
}

export function trackEvent(
  eventName: string,
  eventParams?: Record<string, string | number | boolean>
): void {
  try {
    if (typeof window !== "undefined" && window.rybbit) {
      window.rybbit.event(eventName, eventParams);
    }
  } catch {
    // Silently fail
  }
}

// ── Auth ─────────────────────────────────────────────────────────────

export function trackSignupCompleted(method: "email" | "google"): void {
  trackEvent("signup_completed", { method });
}

export function trackLoginCompleted(method: "email" | "google"): void {
  trackEvent("login_completed", { method });
}

export function trackPasswordReset(): void {
  trackEvent("password_reset");
}

// ── Generation ───────────────────────────────────────────────────────

export function trackImageGenerated(model: string, count: number): void {
  trackEvent("image_generated", { model, count });
}

export function trackVideoGenerated(model: string, duration: number): void {
  trackEvent("video_generated", { model, duration_seconds: duration });
}

export function trackShotGenerated(model: string): void {
  trackEvent("shot_generated", { model });
}

export function trackShotAnimated(model: string, duration: number): void {
  trackEvent("shot_animated", { model, duration_seconds: duration });
}

export function trackUpscaleCompleted(model: string): void {
  trackEvent("upscale_completed", { model });
}

// ── Checkout / Purchase ──────────────────────────────────────────────

export function trackCheckoutStarted(type: "subscription" | "topup" | "custom", plan?: string, amount?: number): void {
  trackEvent("checkout_started", {
    type,
    ...(plan && { plan }),
    ...(amount !== undefined && { amount_dollars: amount }),
  });
}

// ── Payment Completed ────────────────────────────────────────────────

export function trackPaymentCompleted(type: "subscription" | "topup", plan?: string, credits?: number, amount?: number): void {
  trackEvent("payment_completed", {
    type,
    ...(plan && { plan }),
    ...(credits !== undefined && { credits }),
    ...(amount !== undefined && { amount_dollars: amount }),
  });
}

// ── Engagement ───────────────────────────────────────────────────────

export function trackModelSelected(model: string, provider?: string): void {
  trackEvent("model_selected", {
    model,
    ...(provider && { provider }),
  });
}

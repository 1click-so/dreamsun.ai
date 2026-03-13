/**
 * Error sanitizer - strips provider names and raw error details from user-facing messages.
 *
 * All API routes MUST use sanitizeError() before returning error messages to clients.
 * Raw provider errors are logged server-side but never exposed to users.
 */

// Provider names/identifiers that must never appear in user-facing messages
const PROVIDER_PATTERNS = [
  /fal\.ai/gi,
  /fal\.run/gi,
  /kie\.ai/gi,
  /kie\s*ai/gi,
  /runway/gi,
  /replicate/gi,
  /comfyui/gi,
  /anthropic/gi,
  /openai/gi,
  /stability\.ai/gi,
  /hugging\s*face/gi,
];

// Patterns that indicate rate limiting / concurrency issues - these should become queue messages
const RATE_LIMIT_PATTERNS = [
  /too many/i,
  /rate limit/i,
  /concurrent/i,
  /throttl/i,
  /quota/i,
  /capacity/i,
  /overloaded/i,
  /busy/i,
  /try again/i,
  /exceed/i,
  /limit.*reach/i,
  /max.*task/i,
  /task.*limit/i,
  /queue.*full/i,
  /429/,
  /503/,
];

// Patterns that indicate validation errors (user's fault)
const VALIDATION_PATTERNS = [
  /invalid.*image/i,
  /unsupported.*format/i,
  /too large/i,
  /too small/i,
  /resolution/i,
  /dimension/i,
  /aspect ratio/i,
  /file size/i,
  /corrupt/i,
];

type ErrorCategory = "rate_limit" | "validation" | "generation_failed" | "network" | "unknown";

interface SanitizedError {
  /** User-friendly message - safe to display */
  message: string;
  /** Error category for client-side handling */
  category: ErrorCategory;
  /** Whether the client should auto-retry */
  retryable: boolean;
  /** HTTP status code */
  status: number;
}

/**
 * Extract raw error message from various provider error shapes.
 * This is for internal logging only - never send the result to clients.
 */
export function extractRawError(error: unknown): { message: string; status: number } {
  if (!error || typeof error !== "object") {
    return { message: String(error || "Unknown error"), status: 500 };
  }

  const err = error as Record<string, unknown>;
  let status = (typeof err.status === "number" ? err.status : 500);

  // Kie.ai style: providerStatus attached to Error
  if (typeof err.providerStatus === "number" && err.providerStatus !== 200) {
    status = err.providerStatus >= 400 ? err.providerStatus : 429; // Kie often uses non-HTTP codes
  }

  // fal.ai / Kie.ai style: { body: { detail, message } }
  if (err.body && typeof err.body === "object") {
    const body = err.body as Record<string, unknown>;
    if (typeof body.detail === "string") return { message: body.detail, status };
    if (Array.isArray(body.detail)) {
      const msg = body.detail.map((e: Record<string, unknown>) => e.msg || JSON.stringify(e)).join("; ");
      return { message: msg, status };
    }
    if (typeof body.message === "string") return { message: body.message, status };
  }

  // Kie.ai providerMessage (attached in kie-ai.ts)
  if (typeof err.providerMessage === "string") return { message: err.providerMessage, status };

  // Standard Error object
  if (typeof err.message === "string") return { message: err.message, status };

  return { message: JSON.stringify(error).slice(0, 200), status };
}

/**
 * Categorize an error based on its raw message content.
 */
function categorize(rawMessage: string, httpStatus: number): ErrorCategory {
  if (httpStatus === 429 || RATE_LIMIT_PATTERNS.some((p) => p.test(rawMessage))) {
    return "rate_limit";
  }
  if (httpStatus === 422 || VALIDATION_PATTERNS.some((p) => p.test(rawMessage))) {
    return "validation";
  }
  if (rawMessage.toLowerCase().includes("fetch") || rawMessage.toLowerCase().includes("network") || rawMessage.toLowerCase().includes("timeout")) {
    return "network";
  }
  return "generation_failed";
}

/** User-friendly messages per category */
const USER_MESSAGES: Record<ErrorCategory, string> = {
  rate_limit: "Our servers are busy. Your generation has been queued and will start automatically.",
  validation: "There was an issue with your input. Please check your image and settings.",
  generation_failed: "Generation failed. Your credits have been refunded.",
  network: "A temporary connection issue occurred. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * Sanitize a provider error into a user-safe message.
 *
 * Usage in API routes:
 * ```ts
 * } catch (error) {
 *   const sanitized = sanitizeError(error, "Generation failed");
 *   console.error("Generation error (raw):", error); // log raw for debugging
 *   return NextResponse.json({ error: sanitized.message, category: sanitized.category, retryable: sanitized.retryable }, { status: sanitized.status });
 * }
 * ```
 */
export function sanitizeError(error: unknown, fallbackMessage = "Something went wrong"): SanitizedError {
  const { message: rawMessage, status } = extractRawError(error);
  const category = categorize(rawMessage, status);

  return {
    message: USER_MESSAGES[category] || fallbackMessage,
    category,
    retryable: category === "rate_limit" || category === "network",
    status: category === "rate_limit" ? 429 : status,
  };
}

/**
 * Sanitize a string error message (e.g. from DB-stored error_message or webhook payloads).
 * Strips any provider names and returns a user-safe message.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  // Check if it's a rate limit message
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(rawMessage))) {
    return USER_MESSAGES.rate_limit;
  }

  // Check if it contains provider names - replace with generic message
  if (PROVIDER_PATTERNS.some((p) => p.test(rawMessage))) {
    return USER_MESSAGES.generation_failed;
  }

  // Check for internal status strings like "Generation failed with status: FAILED"
  if (/status:/i.test(rawMessage) || /queue/i.test(rawMessage)) {
    return USER_MESSAGES.generation_failed;
  }

  // If it looks like a technical error, sanitize it
  if (rawMessage.includes("Error:") || rawMessage.includes("error:") || rawMessage.length > 100) {
    return USER_MESSAGES.generation_failed;
  }

  // Short, simple messages that don't contain provider info are probably fine
  return rawMessage;
}

/**
 * Check if a raw error indicates a rate limit / concurrency issue.
 * Used to decide whether to queue a retry instead of failing.
 */
export function isRateLimitError(error: unknown): boolean {
  const { message, status } = extractRawError(error);
  return status === 429 || RATE_LIMIT_PATTERNS.some((p) => p.test(message));
}

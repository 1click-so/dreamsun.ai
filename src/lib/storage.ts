export function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — trim arrays and retry
    if (Array.isArray(value)) {
      let trimmed = value as unknown[];
      while (trimmed.length > 10) {
        trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.8));
        try {
          localStorage.setItem(key, JSON.stringify(trimmed));
          console.warn(`[DreamSun] localStorage full — trimmed to ${trimmed.length} items`);
          return;
        } catch {
          continue;
        }
      }
    }
    console.error("[DreamSun] localStorage save failed for key:", key);
  }
}

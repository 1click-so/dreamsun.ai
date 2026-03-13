/**
 * Kie.ai API client
 *
 * Single endpoint for all models: POST /api/v1/jobs/createTask
 * Poll with: GET /api/v1/jobs/recordInfo?taskId=xxx
 */

const KIE_BASE = "https://api.kie.ai";

function getApiKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY not set");
  return key;
}

// ── Model ID mapping: our model_id → Kie.ai model name ──────────

const KIE_MODEL_MAP: Record<string, string> = {
  // Image generation
  "nano-banana-pro": "nano-banana-pro",
  "nano-banana-pro-edit": "nano-banana-pro",
  "nano-banana-2": "nano-banana-2",
  "nano-banana-2-edit": "nano-banana-2",
  "grok-imagine": "grok-imagine",
  "grok-imagine-edit": "grok-imagine",
  // Video generation (image-to-video)
  "kling-2-6": "kling-2.6/video",
  "kling-3": "kling-3.0/video",
  // Motion control
  "kling-2-6-mc": "kling-2.6/motion-control",
  "kling-3-mc": "kling-3.0/motion-control",
};

export function getKieModelId(ourModelId: string): string {
  return KIE_MODEL_MAP[ourModelId] || ourModelId;
}

// ── Types ────────────────────────────────────────────────────────

export interface KieTaskResult {
  taskId: string;
  model: string;
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson: string | null;
  failCode: string | null;
  failMsg: string | null;
  costTime: number;
  completeTime: number;
  createTime: number;
}

// ── Create Task ──────────────────────────────────────────────────

export async function kieCreateTask(
  model: string,
  input: Record<string, unknown>,
  callBackUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = { model, input };
  if (callBackUrl) body.callBackUrl = callBackUrl;

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.code !== 200 || !data.data?.taskId) {
    const rawMsg = data.msg || data.message || JSON.stringify(data);
    const err = new Error(`Provider task creation failed: ${rawMsg}`);
    // Attach status for rate limit detection
    (err as unknown as Record<string, unknown>).providerStatus = data.code;
    (err as unknown as Record<string, unknown>).providerMessage = rawMsg;
    throw err;
  }

  return data.data.taskId;
}

// ── Poll Task Status ─────────────────────────────────────────────

export async function kieGetTaskStatus(taskId: string): Promise<KieTaskResult> {
  const res = await fetch(
    `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`,
    {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    }
  );

  const data = await res.json();

  if (data.code !== 200 || !data.data) {
    throw new Error(`Provider status check failed: ${data.msg || data.message || JSON.stringify(data)}`);
  }

  return data.data as KieTaskResult;
}

// ── Poll Until Done (blocking) ───────────────────────────────────

export async function kiePollUntilDone(
  taskId: string,
  opts: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<KieTaskResult> {
  const maxAttempts = opts.maxAttempts ?? 90;
  const intervalMs = opts.intervalMs ?? 3000;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await kieGetTaskStatus(taskId);

    if (result.state === "success") return result;
    if (result.state === "fail") {
      throw new Error(`Generation failed: ${result.failMsg || result.failCode || "unknown error"}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Generation timed out after ${maxAttempts * intervalMs / 1000}s`);
}

// ── Parse Result URLs ────────────────────────────────────────────

export function kieParseResultUrls(resultJson: string | null): string[] {
  if (!resultJson) return [];
  try {
    const parsed = JSON.parse(resultJson);
    return parsed.resultUrls || [];
  } catch {
    return [];
  }
}

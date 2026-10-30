import type { PpmaEvent } from "../types";

export interface EndpointConfig {
  endpointUrl: string;
  token: string;
  secret: string;
}

export interface RemoteResult {
  event_id: string;
  status: "delivered" | "queued" | "failed";
  at: string;
  detail: string;
  latency_ms: number | null;
  duplicate?: boolean;
}

function base(config: EndpointConfig): string {
  return config.endpointUrl.trim().replace(/\/$/, "");
}

async function hmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret || "recall-demo-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `sha256=${[...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function sendEvent(config: EndpointConfig, event: PpmaEvent): Promise<RemoteResult> {
  const started = performance.now();
  if (!base(config)) {
    return { event_id: event.event_id, status: "failed", at: new Date().toISOString(), detail: "No endpoint configured", latency_ms: null };
  }
  const body = JSON.stringify(event);
  let lastDetail = "network error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${base(config)}/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Recall-Signature": await hmac(config.secret, body),
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        body,
      });
      const payload = (await response.json()) as { accepted?: boolean; duplicate?: boolean; error?: string; memory_entries?: number };
      const latency = Math.round(performance.now() - started);
      if (response.ok && payload.accepted) {
        return {
          event_id: event.event_id,
          status: "delivered",
          at: new Date().toISOString(),
          detail: payload.duplicate ? "duplicate rejected" : `accepted · ${payload.memory_entries ?? 0} memory entries`,
          latency_ms: latency,
          duplicate: payload.duplicate,
        };
      }
      lastDetail = payload.error || `HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500) break;
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : "network error";
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  return { event_id: event.event_id, status: "failed", at: new Date().toISOString(), detail: lastDetail, latency_ms: null };
}

export async function sendCommand(config: EndpointConfig, command: { type: string; payload: Record<string, unknown>; target?: string }): Promise<{ ok: boolean; detail: string }> {
  if (!base(config)) return { ok: false, detail: "No endpoint configured" };
  try {
    const response = await fetch(`${base(config)}/v1/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}) },
      body: JSON.stringify({ kind: "command", target: command.target ?? "capture", ...command }),
    });
    return { ok: response.ok, detail: response.ok ? "command accepted" : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "network error" };
  }
}

export async function endpointHealth(config: EndpointConfig): Promise<{ ok: boolean; detail: string; data?: Record<string, unknown> }> {
  if (!base(config)) return { ok: false, detail: "No endpoint configured" };
  try {
    const response = await fetch(`${base(config)}/health`, { headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined });
    const data = (await response.json()) as Record<string, unknown>;
    return { ok: response.ok, detail: response.ok ? `ok · ${String(data.events ?? 0)} events` : `HTTP ${response.status}`, data };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "network error" };
  }
}

/**
 * RECALL ↔ PPMA live bridge.
 *
 * The browser cannot call PPMA's north API directly: PPMA has no CORS middleware and the
 * owner token must never reach the client. This sidecar is the same "ppma-bridge" pattern the
 * PPMA docs describe for native apps. It holds the credentials server-side, translates RECALL's
 * capture events into the north-contract envelope, and reads PPMA's memory views back.
 *
 * It is a transport boundary, not a fake: every accepted event is posted to a running PPMA
 * backend and every memory read comes from PPMA's own store.
 *
 * env:
 *   PORT                       default 8788
 *   HOST                       default 127.0.0.1
 *   PPMA_BASE_URL              default http://127.0.0.1:8770
 *   PPMA_SPACE                 default me
 *   PPMA_APP_ID                default capture
 *   PPMA_APP_VERSION           default 1.6.0
 *   PPMA_APP_TOKEN_FILE        default ../.ppma-app-token
 *   PPMA_OWNER_TOKEN_FILE      default ~/.config/ppma/setup-token
 *   RECALL_SHARED_SECRET       HMAC secret the browser signs with (default recall-demo-secret)
 *   RECALL_TOKEN               optional bearer token the browser must send
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze as analyzeTranscript } from "./analyzer.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || "127.0.0.1";
const PPMA_BASE = (process.env.PPMA_BASE_URL || "http://127.0.0.1:8770").replace(/\/$/, "");
const SPACE = process.env.PPMA_SPACE || "me";
const APP_ID = process.env.PPMA_APP_ID || "capture";
const APP_VERSION = process.env.PPMA_APP_VERSION || "1.6.0";
const SECRET = process.env.RECALL_SHARED_SECRET || "recall-demo-secret";
const TOKEN = process.env.RECALL_TOKEN || "";
const TOKEN_FILE = resolve(ROOT, process.env.PPMA_APP_TOKEN_FILE || ".ppma-app-token");
const OWNER_FILE = process.env.PPMA_OWNER_TOKEN_FILE || join(homedir(), ".config", "ppma", "setup-token");

const recent = [];
const streams = new Set();
let metrics = { received: 0, accepted: 0, duplicates: 0, rejected: 0, memory_reads: 0 };

function broadcast(message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const stream of streams) {
    try {
      stream.write(payload);
    } catch {
      streams.delete(stream);
    }
  }
}

function readSecret(path) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
  } catch {
    return "";
  }
}

const appToken = readSecret(TOKEN_FILE);
const ownerToken = readSecret(OWNER_FILE);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Recall-Signature");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function signature(raw, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(req, raw) {
  if (TOKEN) {
    if ((req.headers.authorization || "") !== `Bearer ${TOKEN}`) return { ok: false, reason: "bad token" };
  }
  const provided = String(req.headers["x-recall-signature"] || "");
  if (!provided) return { ok: false, reason: "missing signature" };
  return safeEqual(provided, signature(raw)) ? { ok: true } : { ok: false, reason: "bad signature" };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function encodeTime(ms, length) {
  let value = ms;
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

/** A valid, deterministic ULID for a RECALL event id, so retries stay idempotent in PPMA. */
export function ulidFor(eventId, occurredAt) {
  const when = Number.isFinite(Date.parse(occurredAt)) ? Date.parse(occurredAt) : Date.now();
  const digest = createHash("sha256").update(String(eventId)).digest();
  let bits = 0n;
  for (const byte of digest.subarray(0, 10)) bits = (bits << 8n) | BigInt(byte);
  let random = "";
  for (let i = 0; i < 16; i += 1) {
    random = ALPHABET[Number(bits & 31n)] + random;
    bits >>= 5n;
  }
  return encodeTime(when, 10) + random;
}

/** Translate a RECALL capture event into a PPMA north-contract Message. */
export function toNorthMessage(event, space = SPACE, appId = APP_ID, appVersion = APP_VERSION) {
  return {
    id: ulidFor(event.event_id, event.occurred_at),
    kind: "event",
    type: event.type,
    space,
    source: { app: appId, app_version: appVersion, device: event.device || "recall-web" },
    occurred_at: event.occurred_at || new Date().toISOString(),
    payload: event.payload || {},
  };
}

async function ppma(path, token, { method = "GET", body } = {}) {
  const request = await fetch(`${PPMA_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await request.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text.slice(0, 400) };
  }
  return { ok: request.ok, status: request.status, data };
}

async function readMemory() {
  const list = await ppma(`/v0/spaces/${SPACE}/memory/views`, ownerToken);
  if (!list.ok) return { ok: false, status: list.status, detail: list.data?.detail || "memory read failed", views: [] };
  const names = (list.data.views || []).map((view) => view.view || view.name).filter(Boolean);
  const views = [];
  for (const name of names) {
    const one = await ppma(`/v0/spaces/${SPACE}/memory/views/${encodeURIComponent(name)}`, ownerToken);
    if (!one.ok) continue;
    views.push({
      view: name,
      version: one.data.version,
      updated_at: one.data.updated_at,
      statements: Array.isArray(one.data.statements) ? one.data.statements : [],
    });
  }
  metrics.memory_reads += 1;
  return { ok: true, views, entries: views.reduce((sum, view) => sum + view.statements.length, 0) };
}

async function health() {
  const probe = await ppma(`/v0/spaces/${SPACE}/dispatches`, ownerToken);
  let memory = { entries: 0, views: [] };
  if (probe.ok) {
    const read = await readMemory().catch(() => ({ ok: false }));
    if (read.ok) memory = { entries: read.entries, views: read.views.map((view) => view.view) };
  }
  return {
    status: probe.ok ? "ok" : "degraded",
    ok: probe.ok,
    mode: "ppma-live",
    backend: PPMA_BASE,
    space: SPACE,
    app: APP_ID,
    app_token_loaded: Boolean(appToken),
    owner_token_loaded: Boolean(ownerToken),
    ppma_status: probe.status,
    memory_entries: memory.entries,
    memory_views: memory.views,
    events: metrics.accepted,
    metrics,
    recent: recent.slice(0, 20),
    at: new Date().toISOString(),
  };
}

async function handle(req, res, url) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/stream") {
    cors(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "ppma.stream.connected", at: new Date().toISOString() })}\n\n`);
    streams.add(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch {
        clearInterval(heartbeat);
        streams.delete(res);
      }
    }, 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      streams.delete(res);
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, await health());
    return;
  }

  if (req.method === "GET" && url.pathname === "/openapi.json") {
    json(res, 200, {
      openapi: "3.0.0",
      info: { title: "RECALL PPMA live bridge", version: APP_VERSION },
      paths: {
        "/health": { get: { summary: "Bridge and PPMA reachability" } },
        "/v1/events": { post: { summary: "Signed RECALL event -> PPMA north message" } },
        "/v1/memory": { get: { summary: "PPMA memory views read through the owner authority" } },
        "/v1/analyze": { post: { summary: "Raw transcript -> structured findings with evidence" } },
        "/v1/metrics": { get: { summary: "Delivery counters" } },
      },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/memory") {
    json(res, 200, await readMemory());
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/metrics") {
    json(res, 200, { ...metrics, recent: recent.slice(0, 20), backend: PPMA_BASE });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/events") {
    json(res, 200, { events: recent.slice(0, 50) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/events") {
    const raw = await readBody(req);
    const auth = authorized(req, raw);
    if (!auth.ok) {
      metrics.rejected += 1;
      json(res, 401, { accepted: false, error: auth.reason });
      return;
    }
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      metrics.rejected += 1;
      json(res, 400, { accepted: false, error: "invalid JSON" });
      return;
    }
    if (!event?.event_id || !event?.type) {
      metrics.rejected += 1;
      json(res, 400, { accepted: false, error: "event_id and type are required" });
      return;
    }
    if (!appToken) {
      metrics.rejected += 1;
      json(res, 503, { accepted: false, error: `no PPMA app token at ${TOKEN_FILE}; run scripts/ppma_register.py` });
      return;
    }
    metrics.received += 1;
    const message = toNorthMessage(event);
    const posted = await ppma(`/v0/spaces/${SPACE}/messages`, appToken, { method: "POST", body: { messages: [message] } });
    if (!posted.ok) {
      metrics.rejected += 1;
      json(res, 502, { accepted: false, error: `PPMA HTTP ${posted.status}`, detail: posted.data });
      return;
    }
    const duplicates = posted.data.duplicates || [];
    const accepted = posted.data.accepted || [];
    const duplicate = duplicates.includes(message.id) || accepted.length === 0;
    if (duplicate) metrics.duplicates += 1;
    else metrics.accepted += 1;
    recent.unshift({ event_id: event.event_id, message_id: message.id, type: event.type, duplicate, at: new Date().toISOString() });
    recent.splice(60);
    broadcast({ type: "ppma.memory_updated", view: "about_me", event_id: event.event_id, at: new Date().toISOString() });
    const memory = await readMemory().catch(() => ({ ok: false, entries: 0 }));
    json(res, 202, {
      accepted: !duplicate,
      duplicate,
      event_id: event.event_id,
      message_id: message.id,
      backend: PPMA_BASE,
      memory_entries: memory.ok ? memory.entries : 0,
      views: memory.ok ? memory.views.map((view) => view.view) : [],
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/analyze") {
    const raw = await readBody(req);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      json(res, 400, { ok: false, error: "invalid JSON" });
      return;
    }
    const meeting = body?.meeting;
    if (!meeting?.transcript?.length) {
      json(res, 400, { ok: false, error: "meeting.transcript is required" });
      return;
    }
    try {
      const analysis = await analyzeTranscript(meeting);
      recent.unshift({ kind: "analysis", title: meeting.title, findings: analysis.decisions.length + analysis.actions.length + analysis.risks.length, at: new Date().toISOString() });
      recent.splice(60);
      json(res, 200, { ok: true, analysis });
    } catch (error) {
      json(res, 502, { ok: false, error: error instanceof Error ? error.message : "analysis failed" });
    }
    return;
  }

  json(res, 404, { error: "not found" });
}

export function createLiveBridge() {
  return createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    handle(req, res, url).catch((error) => {
      json(res, 500, { error: error instanceof Error ? error.message : "bridge failure" });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!appToken) {
    console.error(`No app token at ${TOKEN_FILE}. Run: py -3 scripts/ppma_register.py --base ${PPMA_BASE}`);
  }
  if (!ownerToken) console.error(`No owner token at ${OWNER_FILE}; memory reads will stay empty.`);
  createLiveBridge().listen(PORT, HOST, () => {
    console.log(`RECALL PPMA bridge on http://${HOST}:${PORT} -> ${PPMA_BASE} (space ${SPACE}, app ${APP_ID})`);
  });
}

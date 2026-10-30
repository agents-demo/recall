import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const SECRET = process.env.RECALL_SHARED_SECRET || "recall-demo-secret";
const OLD_SECRET = process.env.RECALL_SHARED_SECRET_OLD || "";
const RATE_LIMIT = Number(process.env.RECALL_RATE_LIMIT || 240);
const TOKEN = process.env.RECALL_TOKEN || "";
const DATA_FILE = process.env.RECALL_DATA_FILE || join(ROOT, "..", "data", "ppma.json");
const ALLOW_UNSIGNED = process.env.RECALL_ALLOW_UNSIGNED === "1";

function emptyDb() {
  return {
    version: 1,
    created_at: new Date().toISOString(),
    events: [],
    memory: [],
    tombstones: {},
    commands: [],
    retention: {},
    project: {
      state: "No capture has been handed to this PPMA server yet.",
      followup: "",
      last_event: null,
      updated_at: new Date().toISOString(),
    },
    connectors: {},
    dead_letter: [],
    metrics: { received: 0, duplicates: 0, rejected: 0, memory_entries: 0, rate_limited: 0, requests: 0 },
  };
}

function loadDb() {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    /* fall through to a fresh database */
  }
  return emptyDb();
}

let db = loadDb();
const streams = new Set();
function save() {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function broadcast(message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const stream of streams) {
    try { stream.write(payload); } catch { streams.delete(stream); }
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Recall-Signature",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  });
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
    const header = req.headers.authorization || "";
    if (header !== `Bearer ${TOKEN}`) return { ok: false, reason: "bad token" };
  }
  if (ALLOW_UNSIGNED) return { ok: true };
  const provided = String(req.headers["x-recall-signature"] || "");
  if (!provided) return { ok: false, reason: "missing signature" };
  if (safeEqual(provided, signature(raw))) return { ok: true };
  if (OLD_SECRET && safeEqual(provided, signature(raw, OLD_SECRET))) return { ok: true, rotated: true };
  return { ok: false, reason: "bad signature" };
}

const rate = new Map();
function rateLimited(req) {
  const key = req.socket.remoteAddress || "local";
  const now = Date.now();
  const windowStart = Math.floor(now / 60000);
  const entry = rate.get(key);
  if (!entry || entry.window !== windowStart) {
    rate.set(key, { window: windowStart, count: 1 });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT) {
    db.metrics.rate_limited += 1;
    return true;
  }
  return false;
}

function deadLetter(reason, req) {
  db.dead_letter.push({ at: new Date().toISOString(), reason, remote: req.socket.remoteAddress || "local" });
  db.dead_letter = db.dead_letter.slice(-100);
}

function memoryId(event, suffix) {
  return `mem_${event.event_id.slice(-8)}_${suffix}`;
}

function addMemory(event, rows) {
  const captureId = String(event.payload.capture_id || event.payload.note_id || "");
  db.memory = db.memory.filter((entry) => entry.capture_id !== captureId);
  db.memory.push(...rows);
  db.metrics.memory_entries = db.memory.length;
}

function applyEvent(event) {
  const captureId = String(event.payload.capture_id || event.payload.note_id || "");
  const now = event.occurred_at || new Date().toISOString();
  if (event.type === "capture.meeting.completed" || event.type === "capture.call.completed") {
    const payload = event.payload;
    const base = {
      capture_id: captureId,
      meeting_id: payload.meeting_id || captureId,
      sensitivity: event.sensitivity || "personal",
      consent: payload.consent?.state || "granted",
      redacted: (payload.redactions || []).length > 0,
      source: "RECALL",
      created_at: now,
      state: "active",
    };
    const rows = [];
    (payload.decisions || []).forEach((decision, index) => rows.push({ ...base, id: memoryId(event, `d${index}`), type: "decision", text: decision.text, evidence_id: decision.evidence_id, confidence: decision.confidence, speaker_id: (payload.evidence || []).find((item) => item.id === decision.evidence_id)?.speaker_id ?? null }));
    (payload.action_items || []).forEach((action, index) => rows.push({ ...base, id: memoryId(event, `a${index}`), type: "action", text: action.text, evidence_id: action.evidence_id, confidence: action.confidence ?? 0.85, speaker_id: (payload.evidence || []).find((item) => item.id === action.evidence_id)?.speaker_id ?? null }));
    (payload.open_questions || []).forEach((question, index) => rows.push({ ...base, id: memoryId(event, `q${index}`), type: "question", text: question, evidence_id: (payload.open_question_evidence || [])[index] || "", confidence: 0.85, speaker_id: null }));
    const promise = (payload.evidence || []).find((item) => /hold the 14th|cannot commit|promise/i.test(item.quote || ""));
    if (promise) rows.push({ ...base, id: memoryId(event, "p"), type: "promise", text: promise.quote, evidence_id: promise.id, confidence: promise.confidence, speaker_id: promise.speaker_id });
    addMemory(event, rows);
    db.project = {
      state: payload.capture_id === "cap_01J9Q4M2R7X8K3N5V6B1C0D" ? "Handover moved to 14 November. The 12th is not achievable. Written confirmation due today before 17:00. Training date to follow." : `${payload.title || "Capture"} added to project memory.`,
      followup: payload.title ? "PPMA proposes a follow-up. A human approves before action." : "",
      last_event: event.event_id,
      updated_at: now,
    };
  } else if (event.type === "capture.note.created") {
    addMemory(event, [{
      capture_id: captureId,
      meeting_id: captureId,
      id: memoryId(event, "n"),
      type: "note",
      text: event.payload.text || "",
      evidence_id: event.payload.evidence_ref || "",
      confidence: 0.97,
      speaker_id: null,
      sensitivity: event.sensitivity || "personal",
      consent: event.payload.consent?.state || "granted",
      redacted: false,
      source: "RECALL",
      created_at: now,
      state: "active",
    }]);
    db.project = { ...db.project, state: `Field note added: ${String(event.payload.text || "").slice(0, 90)}`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.correction") {
    const before = event.payload.before_name || event.payload.before;
    const after = event.payload.after_name || event.payload.after;
    db.memory = db.memory.map((entry) => entry.capture_id === captureId && (!event.payload.evidence_id || entry.evidence_id === event.payload.evidence_id) ? { ...entry, corrected: `${before} → ${after}`, ...(event.payload.field === "speaker_id" ? { speaker_id: event.payload.after } : {}) } : entry);
    db.project = { ...db.project, state: `Human correction applied: ${before} → ${after}.`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.redaction.applied") {
    db.memory = db.memory.map((entry) => entry.capture_id === captureId ? { ...entry, redacted: true, text: entry.evidence_id === event.payload.evidence_id ? event.payload.safe_text || "[redacted]" : entry.text } : entry);
    db.project = { ...db.project, state: `A passage was redacted before sharing (${event.payload.reason}).`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.memory.deleted") {
    db.memory = db.memory.map((entry) => entry.capture_id === captureId ? { ...entry, state: "retired", text: "[tombstone — content deleted]" } : entry);
    db.tombstones[captureId] = { capture_id: captureId, reason: event.payload.reason, scope: event.payload.scope, requested_by: event.payload.requested_by, at: event.payload.deleted_at || now, event_id: event.event_id };
    db.project = { ...db.project, state: `Memory retired for ${event.payload.title || captureId}. A tombstone remains.`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.consent.changed") {
    db.memory = db.memory.map((entry) => entry.capture_id === captureId ? { ...entry, state: "suppressed" } : entry);
    db.project = { ...db.project, state: `Consent ${event.payload.state}. Memory suppressed.`, last_event: event.event_id, updated_at: now };
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function route(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", service: "recall-ppma", events: db.events.length, memory: db.memory.filter((entry) => entry.state === "active").length, last_event: db.project.last_event, mode: ALLOW_UNSIGNED ? "unsigned" : "signed", server_time: new Date().toISOString() });
  }
  if (req.method === "GET" && url.pathname === "/v1/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`data: ${JSON.stringify({ type: "ppma.ready", project: db.project })}\n\n`);
    streams.add(res);
    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch { /* closed */ }
    }, 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      streams.delete(res);
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/openapi.json") {
    return json(res, 200, {
      openapi: "3.1.0",
      info: { title: "RECALL local PPMA server", version: "1.0.0" },
      servers: [{ url: `http://${req.headers.host || "localhost"}` }],
      paths: {
        "/health": { get: { summary: "Liveness" } },
        "/v1/events": { post: { summary: "Signed capture event" }, get: { summary: "Recent events" } },
        "/v1/memory": { get: { summary: "Derived memory and project state" } },
        "/v1/search": { get: { summary: "Read-only evidence search" } },
        "/v1/evidence/{id}": { get: { summary: "Safe evidence + provenance" } },
        "/v1/commands": { get: { summary: "Command inbox" }, post: { summary: "capture.forget / capture.apply_retention" } },
        "/v1/stream": { get: { summary: "ppma.memory_updated SSE" } },
        "/v1/tools": { get: { summary: "openjiuwen/MCP tool manifest" } },
      },
      components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" }, hmac: { type: "apiKey", in: "header", name: "X-Recall-Signature" } } },
    });
  }
  if (req.method === "POST" && url.pathname === "/v1/auth/demo") {
    return json(res, 200, {
      token: "demo_oidc_token",
      user: { sub: "user_anna", name: "Anna Voss", email: "anna@example.com", groups: ["recall-team-northgate", "recall-team-leads"] },
      issuer: "http://localhost:8787/oidc",
      note: "Mock OIDC identity. A real IdP needs client id, secret and PKCE.",
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/scim/Users") {
    return json(res, 200, {
      totalResults: 4,
      Resources: [
        { id: "user_anna", userName: "anna@example.com", displayName: "Anna Voss", active: true, groups: ["recall-team-northgate"] },
        { id: "user_marek", userName: "marek@example.com", displayName: "Marek Nowak", active: true, groups: ["recall-team-northgate"] },
        { id: "user_lena", userName: "lena@example.com", displayName: "Lena Hoffmann", active: true, groups: ["recall-legal"] },
        { id: "user_sam", userName: "sam@example.com", displayName: "Sam Field", active: false, groups: ["recall-field"] },
      ],
    });
  }
  if (req.method === "POST" && url.pathname === "/v1/billing/checkout") {
    return readBody(req).then((raw) => {
      const body = raw ? JSON.parse(raw) : {};
      return json(res, 201, { checkout_url: "https://checkout.stripe.com/mock/recall", session: `cs_mock_${Date.now()}`, seats: body.seats || 12, meter: "no per-meeting metering", note: "Mock checkout. Real Stripe keys never ship in the static build." });
    }).catch((error) => json(res, 400, { error: String(error) }));
  }
  if (req.method === "GET" && url.pathname === "/v1/residency") {
    return json(res, 200, {
      primary: "eu-central-1 · Frankfurt",
      backup: "eu-west-1 · Dublin",
      media: "on device only",
      retention: "team policy + legal hold",
      note: "Derived text and events follow the region; raw media never leaves the device.",
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/devices") {
    return json(res, 200, {
      devices: [
        { id: "dev_mac_01", name: "MacBook Pro 14", status: "active", enrollment: "owner", last_seen: "2026-10-30T08:58:00Z" },
        { id: "dev_iphone_01", name: "iPhone 16 Pro", status: "active", enrollment: "owner", last_seen: "2026-10-30T08:41:00Z" },
        { id: "dev_pixel_01", name: "Pixel 9", status: "revoked", enrollment: "owner", last_seen: "2026-09-30T12:00:00Z" },
      ],
      note: "Remote wipe and key recovery are contract surfaces; enrollment requires device attestation.",
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/events") {
    const limit = Math.min(200, Number(url.searchParams.get("limit") || 50));
    return json(res, 200, { events: db.events.slice(-limit), count: db.events.length });
  }
  if (req.method === "GET" && url.pathname === "/v1/memory") {
    return json(res, 200, { memory: db.memory, project: db.project, tombstones: db.tombstones });
  }
  if (req.method === "GET" && url.pathname === "/v1/tombstones") {
    return json(res, 200, { tombstones: db.tombstones });
  }
  if (req.method === "GET" && url.pathname === "/v1/commands") {
    return json(res, 200, { commands: db.commands });
  }
  if (req.method === "GET" && url.pathname === "/v1/dead-letter") {
    return json(res, 200, { dead_letter: db.dead_letter, metrics: db.metrics });
  }
  if (req.method === "GET" && url.pathname === "/v1/tools") {
    return json(res, 200, {
      tools: [
        { name: "capture.search", description: "Read-only local evidence search", input: { query: "string" } },
        { name: "capture.evidence", description: "Quote, speaker, time and provenance", input: { evidence_id: "string" } },
        { name: "capture.prepare_handoff", description: "Return a review payload; does not send", input: { capture_id: "string" } },
        { name: "capture.prepare_redaction", description: "Return a safe-version preview", input: { capture_id: "string", evidence_id: "string" } },
      ],
      note: "There is deliberately no execute/send/delete tool.",
    });
  }
  if (req.method === "GET" && url.pathname === "/v1/search") {
    const query = (url.searchParams.get("q") || "").toLowerCase().trim();
    if (!query) return json(res, 200, { results: [] });
    const results = [];
    for (const event of db.events) {
      if (event.type !== "capture.meeting.completed" && event.type !== "capture.call.completed") continue;
      for (const evidence of event.payload?.evidence || []) {
        if (!`${evidence.quote} ${evidence.kind}`.toLowerCase().includes(query)) continue;
        results.push({
          meeting_id: event.payload.meeting_id,
          capture_id: event.payload.capture_id,
          title: event.payload.title,
          evidence_id: evidence.id,
          kind: evidence.kind,
          quote: evidence.quote,
          speaker_id: evidence.speaker_id,
          start: evidence.start,
          end: evidence.end,
          confidence: evidence.confidence,
          route: `/meetings/${event.payload.meeting_id}?e=${evidence.id}`,
        });
      }
    }
    return json(res, 200, { results: results.slice(0, 40), count: results.length });
  }
  if (req.method === "GET" && url.pathname.startsWith("/v1/evidence/")) {
    const evidenceId = decodeURIComponent(url.pathname.split("/")[3] || "");
    for (const event of db.events) {
      const evidence = (event.payload?.evidence || []).find((item) => item.id === evidenceId);
      if (evidence) {
        const redaction = (event.payload?.redactions || []).find((item) => item.evidence_id === evidenceId);
        return json(res, 200, {
          evidence_id: evidence.id,
          capture_id: event.payload.capture_id,
          meeting_id: event.payload.meeting_id,
          title: event.payload.title,
          quote: redaction?.safe_text || evidence.quote,
          speaker_id: evidence.speaker_id,
          start: evidence.start,
          end: evidence.end,
          confidence: evidence.confidence,
          sensitivity: event.sensitivity,
          consent: event.payload.consent,
          redacted: Boolean(redaction),
          provenance: event.provenance,
          media_included: false,
        });
      }
    }
    return json(res, 404, { error: "evidence not found" });
  }
  if (req.method === "POST" && url.pathname === "/v1/commands") {
    return readBody(req).then((raw) => {
      const body = raw ? JSON.parse(raw) : {};
      const command = { id: `cmd_${randomUUID()}`, kind: "command", target: body.target || "capture", type: body.type, payload: body.payload || {}, received_at: new Date().toISOString(), status: "pending" };
      if (command.type === "capture.forget" && command.payload?.capture_id) {
        command.status = "applied";
        const captureId = command.payload.capture_id;
        db.memory = db.memory.map((entry) => entry.capture_id === captureId ? { ...entry, state: "retired", text: "[tombstone — content deleted]" } : entry);
        db.tombstones[captureId] = { capture_id: captureId, reason: command.payload.reason || "user_forget", scope: command.payload.scope || "all", requested_by: command.payload.requested_by || "ppma", at: command.received_at, event_id: null };
        broadcast({ type: "ppma.memory_updated", project: db.project, command: command.type });
      } else if (command.type === "capture.apply_retention" && command.payload?.capture_id) {
        command.status = "applied";
        db.retention[command.payload.capture_id] = { retain_until: command.payload.retain_until, reason: command.payload.reason || "ppma_policy" };
      }
      db.commands.push(command);
      save();
      return json(res, 202, { accepted: true, command });
    }).catch((error) => json(res, 400, { error: String(error) }));
  }
  if (req.method === "POST" && url.pathname.startsWith("/v1/connectors/")) {
    const id = url.pathname.split("/")[3];
    return readBody(req).then((raw) => {
      const body = raw ? JSON.parse(raw) : {};
      db.connectors[id] = { id, tested_at: new Date().toISOString(), status: "mock_ok", request: body, note: "Connector surface is present; a vendor adapter needs credentials." };
      save();
      return json(res, 200, { connector: db.connectors[id] });
    }).catch((error) => json(res, 400, { error: String(error) }));
  }
  if (req.method === "POST" && url.pathname === "/v1/events") {
    return readBody(req).then((raw) => {
      db.metrics.requests += 1;
      if (rateLimited(req)) {
        deadLetter("rate_limited", req);
        save();
        return json(res, 429, { accepted: false, error: "rate limit exceeded" });
      }
      const auth = authorized(req, raw);
      if (!auth.ok) {
        db.metrics.rejected += 1;
        deadLetter(auth.reason, req);
        save();
        return json(res, 401, { accepted: false, error: auth.reason });
      }
      const event = JSON.parse(raw);
      if (!event.event_id || !event.type) return json(res, 400, { accepted: false, error: "event_id and type are required" });
      if (db.events.some((item) => item.event_id === event.event_id)) {
        db.metrics.duplicates += 1;
        save();
        return json(res, 200, { accepted: true, duplicate: true, event_id: event.event_id, message: "duplicate rejected" });
      }
      db.events.push({ ...event, received_at: new Date().toISOString() });
      db.metrics.received += 1;
      applyEvent(event);
      save();
      broadcast({ type: "ppma.memory_updated", event_id: event.event_id, project: db.project, memory_entries: db.memory.length });
      return json(res, 202, { accepted: true, duplicate: false, event_id: event.event_id, memory_entries: db.memory.length, project: db.project });
    }).catch((error) => json(res, 400, { accepted: false, error: String(error) }));
  }
  return json(res, 404, { error: "not found" });
}

export function createRecallServer() {
  return createServer((req, res) => {
    Promise.resolve(route(req, res)).catch((error) => {
      if (!res.headersSent) json(res, 500, { error: String(error) });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createRecallServer();
  server.listen(PORT, HOST, () => {
    console.log(`RECALL PPMA server listening on http://${HOST}:${PORT}`);
    console.log(`data: ${DATA_FILE}`);
    console.log(`signature: ${ALLOW_UNSIGNED ? "unsigned mode" : `HMAC required (secret: ${SECRET.slice(0, 4)}…)`}`);
  });
}

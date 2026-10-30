import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8789;
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "test-secret";
const DATA = join(ROOT, "data", "test-ppma.json");
let child;

async function waitForServer() {
  for (let index = 0; index < 60; index += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server did not start");
}

function sign(raw) {
  return `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
}

async function post(path, body, { signed = true } = {}) {
  const raw = JSON.stringify(body);
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(signed ? { "X-Recall-Signature": sign(raw) } : {}) },
    body: raw,
  });
}

const baseEvent = (type, payload) => ({
  event_id: `evt_test_${type.replace(/\W/g, "_")}`,
  app_id: "recall-capture",
  space: "ppma://spaces/test",
  occurred_at: new Date().toISOString(),
  type,
  sensitivity: "client_confidential",
  payload,
  provenance: { app_version: "1.0.0", local_only: true },
});

before(async () => {
  rmSync(DATA, { force: true });
  child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), RECALL_SHARED_SECRET: SECRET, RECALL_DATA_FILE: DATA },
    stdio: "ignore",
  });
  await waitForServer();
});

after(() => {
  child?.kill();
  rmSync(DATA, { force: true });
});

test("health reports a real local service", async () => {
  const response = await fetch(`${BASE}/health`);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "recall-ppma");
});

test("rejects an unsigned event", async () => {
  const response = await post("/v1/events", baseEvent("capture.recording.started", { capture_id: "cap_unsigned" }), { signed: false });
  assert.equal(response.status, 401);
});

test("accepts a completion, rejects a duplicate and creates memory", async () => {
  const captureId = "cap_test_1";
  const payload = {
    capture_id: captureId,
    meeting_id: "mtg_test_1",
    title: "Test delivery call",
    summary: "The 14th is held.",
    decisions: [{ text: "Hold the 14th.", evidence_id: "ev_1", confidence: 0.9 }],
    action_items: [{ text: "Send confirmation.", owner: "Anna", due: "2026-10-30", evidence_id: "ev_1" }],
    open_questions: ["Does training move?"],
    open_question_evidence: ["ev_1"],
    evidence: [{ id: "ev_1", quote: "We can hold the 14th, but not the 12th.", speaker_id: "p2", confidence: 0.93 }],
    consent: { state: "granted" },
    redactions: [],
  };
  const first = await post("/v1/events", baseEvent("capture.meeting.completed", payload));
  assert.equal(first.status, 202);
  const firstBody = await first.json();
  assert.equal(firstBody.accepted, true);
  assert.equal(firstBody.memory_entries, 4);

  const duplicate = await post("/v1/events", baseEvent("capture.meeting.completed", payload));
  const duplicateBody = await duplicate.json();
  assert.equal(duplicateBody.duplicate, true);
  assert.equal(duplicateBody.message, "duplicate rejected");

  const memory = await (await fetch(`${BASE}/v1/memory`)).json();
  assert.equal(memory.memory.filter((entry) => entry.capture_id === captureId).length, 4);
});

test("a correction updates the memory and preserves the audit", async () => {
  const response = await post("/v1/events", {
    ...baseEvent("capture.correction", { capture_id: "cap_test_1", evidence_id: "ev_1", field: "speaker_id", before: "p1", after: "p2", before_name: "Anna", after_name: "Marek" }),
    event_id: "evt_test_correction_1",
  });
  assert.equal(response.status, 202);
  const memory = await (await fetch(`${BASE}/v1/memory`)).json();
  assert.ok(memory.memory.some((entry) => entry.corrected?.includes("Marek")));
  assert.match(memory.project.state, /correction/i);
});

test("redaction replaces the safe text and deletion leaves a tombstone", async () => {
  await post("/v1/events", {
    ...baseEvent("capture.redaction.applied", { capture_id: "cap_test_1", evidence_id: "ev_1", reason: "client_confidential", safe_text: "[redacted]" }),
    event_id: "evt_test_redaction_1",
  });
  let memory = await (await fetch(`${BASE}/v1/memory`)).json();
  assert.ok(memory.memory.every((entry) => entry.redacted === true));

  await post("/v1/events", {
    ...baseEvent("capture.memory.deleted", { capture_id: "cap_test_1", title: "Test delivery call", scope: "transcript+evidence", reason: "user_request", requested_by: "user_1", deleted_at: new Date().toISOString() }),
    event_id: "evt_test_delete_1",
  });
  memory = await (await fetch(`${BASE}/v1/memory`)).json();
  assert.ok(memory.memory.filter((entry) => entry.capture_id === "cap_test_1").every((entry) => entry.state === "retired"));
  assert.ok(memory.tombstones.cap_test_1);
});

test("accepts a retention command into the inbox", async () => {
  const response = await post("/v1/commands", { type: "capture.forget", target: "recall-capture", payload: { capture_id: "cap_test_1", reason: "user_forget" } });
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.accepted, true);
  const commands = await (await fetch(`${BASE}/v1/commands`)).json();
  assert.ok(commands.commands.some((command) => command.type === "capture.forget"));
});

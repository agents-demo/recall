/**
 * Local analysis service for RECALL.
 *
 * Takes a raw, unstructured transcript and returns structured findings. This is the part the app
 * was missing: it does not read pre-filled decisions; it derives them from the transcript and links
 * every finding to an evidence line.
 *
 * It uses the same OpenAI-compatible endpoint as coachme (API_BASE / API_KEY / MODEL_NAME). The key
 * stays in this local process.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COACHME_ENV = process.env.COACHME_ENV || "C:\\Workspace\\openjiuwendemos\\coachme\\.env";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(COACHME_ENV);

const API_BASE = (process.env.API_BASE || "").replace(/\/$/, "");
const API_KEY = process.env.API_KEY || "";
const MODEL = process.env.MODEL_NAME || "deepseek-v4-pro";
const TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS || 120000);

const SYSTEM = `You are RECALL's extraction agent. You read a raw meeting transcript and return ONLY a JSON object.
Every finding must be supported by an exact transcript line. Never invent people, dates, decisions, actions or risks.
Use the transcript line id as evidence_id. If the transcript does not support a field, return an empty array.

Return this shape:
{
  "summary": "2-3 sentences, plain language, only from the transcript",
  "decisions": [{"text": "...", "evidence_id": "...", "confidence": 0.0}],
  "actions": [{"text": "...", "owner": "...", "due": "YYYY-MM-DD or empty", "evidence_id": "...", "confidence": 0.0}],
  "commitments": [{"text": "...", "owner": "...", "due": "YYYY-MM-DD or empty", "evidence_id": "...", "confidence": 0.0}],
  "risks": [{"text": "...", "severity": "high|warning|info", "evidence_id": "...", "why": "why this could hurt the project", "mitigation": "..."}],
  "contradictions": [{"text": "...", "evidence_a": "...", "evidence_b": "...", "why": "..."}],
  "questions": [{"text": "...", "evidence_id": "...", "answered": false}],
  "gaps": [{"text": "...", "why": "what is missing or unowned", "evidence_id": "..."}]
}

Rules:
- decisions are what the meeting settled.
- actions are things someone said they would do; owner must be a person in the transcript.
- commitments are promises with a date or a clear obligation.
- risks are things that could break delivery; include the reason and a mitigation.
- contradictions are two statements that cannot both be true, or a plan that conflicts with itself.
- questions are open questions; mark answered true only if the transcript answers them.
- gaps are missing owners, missing dates, unanswered client asks, or next steps nobody owns.
- Due dates: infer the calendar date from the meeting date and phrases like "Friday", "by the eighth" or "tomorrow". Use YYYY-MM-DD. If unclear, use "".
- Keep text close to the words in the transcript.`;

function buildUser(meeting) {
  const lines = (meeting.transcript || [])
    .map((line) => `[${line.id || "e?"}] ${line.speaker || "Speaker"} (${line.start ?? 0}s): ${line.text}`)
    .join("\n");
  return `Meeting: ${meeting.title || "Untitled"}
Date: ${meeting.occurred_at || ""}
Participants: ${(meeting.participants || []).map((p) => (typeof p === "string" ? p : p.name)).join(", ")}
Consent: ${meeting.consent?.state || "unknown"}

Transcript:
${lines}

Return the JSON object only.`;
}

function normalize(raw) {
  const array = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  return {
    summary: text(raw.summary),
    decisions: array(raw.decisions).map((item) => ({
      text: text(item.text),
      evidence_id: text(item.evidence_id),
      confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0.85,
    })).filter((item) => item.text),
    actions: array(raw.actions).map((item) => ({
      text: text(item.text),
      owner: text(item.owner) || "Unassigned",
      due: text(item.due),
      evidence_id: text(item.evidence_id),
      confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0.85,
    })).filter((item) => item.text),
    commitments: array(raw.commitments).map((item) => ({
      text: text(item.text),
      owner: text(item.owner) || "Unassigned",
      due: text(item.due),
      evidence_id: text(item.evidence_id),
      confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0.85,
    })).filter((item) => item.text),
    risks: array(raw.risks).map((item) => ({
      text: text(item.text),
      severity: ["high", "warning", "info"].includes(item.severity) ? item.severity : "warning",
      evidence_id: text(item.evidence_id),
      why: text(item.why),
      mitigation: text(item.mitigation),
    })).filter((item) => item.text),
    contradictions: array(raw.contradictions).map((item) => ({
      text: text(item.text),
      evidence_a: text(item.evidence_a),
      evidence_b: text(item.evidence_b),
      why: text(item.why),
    })).filter((item) => item.text),
    questions: array(raw.questions).map((item) => ({
      text: text(item.text),
      evidence_id: text(item.evidence_id),
      answered: Boolean(item.answered),
    })).filter((item) => item.text),
    gaps: array(raw.gaps).map((item) => ({
      text: text(item.text),
      why: text(item.why),
      evidence_id: text(item.evidence_id),
    })).filter((item) => item.text),
  };
}

export async function analyze(meeting) {
  if (!API_BASE || !API_KEY) {
    throw new Error("analysis is not configured: API_BASE and API_KEY are required");
  }
  const started = Date.now();
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUser(meeting) },
    ],
    temperature: 0.1,
    max_tokens: 3000,
    thinking: { type: "disabled" },
    reasoning: { enabled: false },
    enable_thinking: false,
  };
  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`model HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("model returned a non-JSON response");
  }
  const content = payload?.choices?.[0]?.message?.content || "";
  if (!content) {
    const finish = payload?.choices?.[0]?.finish_reason;
    const usage = JSON.stringify(payload?.usage || {});
    throw new Error(`model returned empty content (finish=${finish}): ${usage}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`model did not return JSON findings: ${content.slice(0, 600) || "(empty)"}`);
    parsed = JSON.parse(match[0]);
  }
  return {
    ...normalize(parsed),
    trace: {
      model: MODEL,
      provider: "OpenAI-compatible",
      latency_ms: Date.now() - started,
      prompt_tokens: payload?.usage?.prompt_tokens ?? null,
      completion_tokens: payload?.usage?.completion_tokens ?? null,
      transcript_lines: (meeting.transcript || []).length,
    },
  };
}

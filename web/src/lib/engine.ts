import type {
  Answer,
  Citation,
  Correction,
  Evidence,
  EvidencePack,
  Meeting,
  MemoryEntry,
  Note,
  Pack,
  PpmaEvent,
  Redaction,
  SearchHit,
} from "../types";

export const APP_ID = "recall-capture";
export const DEFAULT_SPACE = "ppma://spaces/northgate";

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by",
  "is", "was", "were", "are", "be", "been", "did", "do", "does", "we", "i", "you",
  "they", "it", "that", "this", "about", "what", "which", "who", "when", "where",
  "how", "can", "could", "should", "would", "please", "tell", "me", "our", "us",
]);

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(n: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, n));
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function fmtDate(iso: string, lang = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function fmtDateTime(iso: string, lang = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function shaLike(input: string): string {
  const a = hashString(input);
  const b = hashString(`${input}::salt::recall`);
  const c = hashString(`${b}::${a}`);
  return `${a}${b}${c}${hashString(`${c}${a}`)}`.slice(0, 16);
}

export function newId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xfffff).toString(36).padStart(4, "0");
  return `${prefix}_${stamp}${rand}`;
}

export function eventIdFor(seed: string): string {
  return `evt_${hashString(`recall::${seed}`)}${hashString(`evt::${seed}`).slice(0, 4)}`;
}

export function speakerName(meeting: Meeting, speakerId: string): string {
  return meeting.participants.find((p) => p.id === speakerId)?.name ?? speakerId;
}

export function speakerInitials(meeting: Meeting, speakerId: string): string {
  return meeting.participants.find((p) => p.id === speakerId)?.initials ?? "?";
}

export function speakerColor(meeting: Meeting, speakerId: string): string {
  return meeting.participants.find((p) => p.id === speakerId)?.color ?? "amber";
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s:.-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((t) => t.replace(/^[.:-]+|[.:-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function redactionFor(meeting: Meeting, evidence: Evidence): Redaction | undefined {
  if (!evidence.redaction_id) return undefined;
  return meeting.redactions.find((r) => r.id === evidence.redaction_id);
}

export function isRedacted(meeting: Meeting, evidence: Evidence): boolean {
  return redactionFor(meeting, evidence)?.status === "applied";
}

/** The text that may leave the device. Detected-but-unapplied passages stay local. */
export function safeQuote(meeting: Meeting, evidence: Evidence, includeDetected = false): string {
  const redaction = redactionFor(meeting, evidence);
  if (redaction && (redaction.status === "applied" || includeDetected)) return redaction.safe_text;
  if (isRedacted(meeting, evidence)) return redaction?.safe_text ?? "[redacted]";
  return evidence.quote;
}

export function utteranceText(meeting: Meeting, utteranceId: string): string {
  return meeting.utterances.find((u) => u.id === utteranceId)?.text ?? "";
}

interface SearchOptions {
  meeting_id?: string;
  speaker_id?: string;
  kind?: string;
  limit?: number;
}

/**
 * Deterministic local search. Matches transcript rows and extracted evidence, then
 * promotes a transcript row to its linked evidence so a hit always has provenance.
 */
export function searchPack(meetings: Meeting[], notes: Note[], query: string, options: SearchOptions = {}): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const hits: SearchHit[] = [];

  for (const meeting of meetings) {
    if (meeting.status === "tombstoned") continue;
    if (options.meeting_id && meeting.id !== options.meeting_id) continue;
    if (meeting.consent.state !== "granted") continue;

    const titleMatch = normalize(meeting.title).includes(q) || tokens.some((t) => normalize(meeting.title).includes(t));

    for (const evidence of meeting.evidence) {
      if (options.kind && evidence.kind !== options.kind) continue;
      if (options.speaker_id && evidence.speaker_id !== options.speaker_id) continue;
      const row = meeting.utterances.find((u) => u.id === evidence.utterance_id);
      const text = row?.text ?? evidence.quote;
      const n = normalize(`${text} ${evidence.kind} ${meeting.title}`);
      let match = 0;
      if (n.includes(q)) match += 10;
      for (const token of tokens) {
        if (n.includes(token)) match += 3;
        if (normalize(evidence.quote).includes(token)) match += 1.5;
      }
      if (titleMatch) match += 2.5;
      if (match <= 0) continue;
      const score = match + evidence.confidence + (evidence.kind === "promise" || evidence.kind === "decision" ? 0.8 : 0);
      hits.push({
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        type: "evidence",
        id: evidence.id,
        evidence_id: evidence.id,
        text,
        speaker_id: evidence.speaker_id,
        start: evidence.start,
        end: evidence.end,
        confidence: evidence.confidence,
        score: Math.round(score * 100) / 100,
        redacted: isRedacted(meeting, evidence),
        kind: evidence.kind,
      });
    }

    const evidenceRows = new Set(meeting.evidence.map((e) => e.utterance_id));
    for (const row of meeting.utterances) {
      if (evidenceRows.has(row.id)) continue; // the evidence hit above is the better result
      if (options.speaker_id && row.speaker_id !== options.speaker_id) continue;
      if (options.kind) continue;
      const n = normalize(`${row.text} ${meeting.title}`);
      let match = 0;
      if (n.includes(q)) match += 8;
      for (const token of tokens) if (n.includes(token)) match += 2.2;
      if (titleMatch) match += 2;
      if (match <= 0) continue;
      const score = match + row.confidence;
      const linked = meeting.evidence.find((e) => e.utterance_id === row.id);
      hits.push({
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        type: "utterance",
        id: row.id,
        evidence_id: linked?.id ?? row.id,
        text: row.text,
        speaker_id: row.speaker_id,
        start: row.start,
        end: row.end,
        confidence: row.confidence,
        score: Math.round(score * 100) / 100,
        redacted: Boolean(row.redacted_by),
        kind: linked?.kind,
      });
    }
  }

  for (const note of notes) {
    if (options.meeting_id || options.speaker_id || options.kind) continue;
    const n = normalize(`${note.title} ${note.text} ${note.photo.ocr}`);
    let match = 0;
    if (n.includes(q)) match += 7;
    for (const token of tokens) if (n.includes(token)) match += 2.5;
    if (match <= 0) continue;
    const score = match + note.photo.ocr_confidence;
    hits.push({
      meeting_id: note.id,
      meeting_title: note.title,
      type: "evidence",
      id: note.evidence_ref,
      evidence_id: note.evidence_ref,
      text: note.text,
      speaker_id: "",
      start: 0,
      end: 0,
      confidence: note.photo.ocr_confidence,
      score: Math.round(score * 100) / 100,
      redacted: false,
      kind: "note",
    });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, options.limit ?? 40);
}

export function citationFor(meeting: Meeting, evidence: Evidence): Citation {
  return {
    evidence_id: evidence.id,
    meeting_id: meeting.id,
    meeting_title: meeting.title,
    quote: safeQuote(meeting, evidence, true),
    speaker: speakerName(meeting, evidence.speaker_id),
    start: evidence.start,
    end: evidence.end,
    confidence: evidence.confidence,
  };
}

/**
 * A constrained local answer. It never invents a fact: if no evidence matches, it
 * refuses and says so. This is the product's answer policy, not a prompt.
 */
export function answerQuestion(pack: Pack, meetings: Meeting[], query: string): Answer {
  const t0 = 340 + Math.min(360, query.length * 9);
  const tokens = tokenize(query);
  const baseTrace = [
    { step: "Read", detail: `Question kept local: “${query.trim() || "(empty)"}”` },
    { step: "Search", detail: `Scanned ${meetings.filter((m) => m.status !== "tombstoned").length} captures and ${pack.notes.length} field notes on this device.` },
  ];
  if (!tokens.length) {
    return {
      answer: "Ask about a promise, a decision, an action or a quote. RECALL answers only from your captured evidence.",
      citations: [],
      trace: baseTrace,
      confidence: 0,
      refused: true,
      latency_ms: 180,
    };
  }

  const wantsActions = /\b(action|todo|next|follow.?up|owner|due)\b/i.test(query);
  const wantsWho = /\bwho\b/i.test(query);
  const wantsConsent = /\bconsent|permission|legal\b/i.test(query);
  const wantsRedaction = /\bredact|safe|share\b/i.test(query);

  const allHits = searchPack(meetings, pack.notes, query, { limit: 24 });
  const evidenceHits = allHits.filter((h) => h.type === "evidence");
  const relevant = (evidenceHits.length ? evidenceHits : allHits).slice(0, 4);

  if (!relevant.length) {
    return {
      answer:
        "I cannot find that in your evidence. RECALL does not answer from the open web or from memory that is not in a capture. Try a date, a person, or a word from the meeting.",
      citations: [],
      trace: [
        ...baseTrace,
        { step: "Refuse", detail: "No matching evidence. Zero citations, so there is no answer." },
      ],
      confidence: 0,
      refused: true,
      latency_ms: t0,
    };
  }

  const citations: Citation[] = [];
  for (const hit of relevant) {
    const meeting = meetings.find((m) => m.id === hit.meeting_id);
    if (!meeting) continue;
    const evidence = meeting.evidence.find((e) => e.id === hit.evidence_id);
    if (!evidence) continue;
    if (!citations.some((c) => c.evidence_id === evidence.id)) citations.push(citationFor(meeting, evidence));
  }

  const top = relevant[0];
  const topMeeting = meetings.find((m) => m.id === top.meeting_id);
  const topEvidence = topMeeting?.evidence.find((e) => e.id === top.evidence_id);
  const topSpeaker = topMeeting && topEvidence ? speakerName(topMeeting, topEvidence.speaker_id) : "";
  const topQuote = topMeeting && topEvidence ? safeQuote(topMeeting, topEvidence, true) : top.text;

  let answer: string;
  if (wantsConsent) {
    const granted = meetings.filter((m) => m.consent.state === "granted").length;
    const total = meetings.filter((m) => m.status !== "tombstoned").length;
    answer = `${granted} of ${total} local captures have a recorded consent state. Consent is checked before every capture and before every event leaves the device.`;
  } else if (wantsRedaction) {
    const redactions = meetings.flatMap((m) => m.redactions);
    const applied = redactions.filter((r) => r.status === "applied").length;
    answer = `${applied} of ${redactions.length} detected passages are redacted. The safe version is what PPMA receives; the unredacted text stays on this device.`;
  } else if (wantsWho && topSpeaker) {
    answer = `${topSpeaker} said: “${topQuote}” — ${topMeeting ? fmtTime(topEvidence?.start ?? 0) : ""} in ${topMeeting?.title ?? "a capture"}. Confidence ${Math.round((topEvidence?.confidence ?? 0) * 100)}%.`;
  } else if (wantsActions && topMeeting) {
    const actions = topMeeting.actions.filter((a) => a.status !== "done").slice(0, 3);
    if (actions.length) {
      answer = `Open actions from ${topMeeting.title}: ${actions.map((a) => `${a.text} (${a.owner}, due ${a.due})`).join(" · ")}`;
    } else {
      answer = `The closest evidence is “${topQuote}” at ${fmtTime(topEvidence?.start ?? 0)} in ${topMeeting.title}. I found no open action attached to it.`;
    }
  } else if (topEvidence?.kind === "promise" || topEvidence?.kind === "decision") {
    answer = `The commitment is: “${topQuote}” — ${topSpeaker}, ${fmtTime(topEvidence.start)} in ${topMeeting?.title ?? "a capture"}. ${topMeeting?.summary ?? ""}`.trim();
  } else {
    answer = `The closest evidence is: “${topQuote}” — ${topSpeaker}, ${fmtTime(topEvidence?.start ?? top.start)} in ${topMeeting?.title ?? "a capture"}.`;
  }

  const confidence =
    citations.reduce((sum, c) => sum + c.confidence, 0) / Math.max(1, citations.length);

  return {
    answer,
    citations,
    trace: [
      ...baseTrace,
      { step: "Keep", detail: `${relevant.length} evidence hit${relevant.length === 1 ? "" : "s"} kept; every claim must cite one.` },
      { step: "Filter", detail: "Consent checked; redacted text replaced with the safe version where applied." },
      { step: "Answer", detail: `Composed from ${citations.length} citation${citations.length === 1 ? "" : "s"}. No web, no model memory.` },
    ],
    confidence,
    refused: false,
    latency_ms: t0 + relevant.length * 42,
  };
}

// ------------------------------------------------------------------ state transforms

export function applyCorrection(meeting: Meeting, correction: Correction): Meeting {
  const next: Meeting = JSON.parse(JSON.stringify(meeting));
  const target = correction.target.replace(/^evidence:/, "");
  if (correction.field === "speaker_id") {
    const ev = next.evidence.find((e) => e.id === target);
    if (ev) {
      ev.speaker_id = correction.after;
      ev.attribution_confidence = 1;
      const row = next.utterances.find((u) => u.id === ev.utterance_id);
      if (row) row.speaker_id = correction.after;
    }
  } else if (correction.field === "text") {
    const row = next.utterances.find((u) => u.id === target);
    if (row) {
      row.text = correction.after;
      row.edited = true;
      const ev = next.evidence.find((e) => e.utterance_id === row.id);
      if (ev) ev.quote = correction.after;
    } else {
      const ev = next.evidence.find((e) => e.id === target);
      if (ev) ev.quote = correction.after;
    }
  } else if (correction.field === "item_text") {
    for (const list of [next.decisions, next.actions, next.questions]) {
      const item = (list as { id: string; text: string }[]).find((x) => x.id === target);
      if (item) item.text = correction.after;
    }
  }
  return next;
}

export function applyRedaction(meeting: Meeting, redaction: Redaction): Meeting {
  const next: Meeting = JSON.parse(JSON.stringify(meeting));
  const existing = next.redactions.find((r) => r.id === redaction.id);
  if (existing) Object.assign(existing, redaction);
  else next.redactions.push(redaction);
  const row = next.utterances.find((u) => u.id === redaction.utterance_id);
  if (row) row.redacted_by = redaction.id;
  return next;
}

export function tombstoneMeeting(meeting: Meeting, info: { reason: string; requested_by: string; at: string; scope?: string }): Meeting {
  return {
    ...meeting,
    status: "tombstoned",
    summary: "",
    utterances: [],
    decisions: [],
    actions: [],
    questions: [],
    evidence: [],
    redactions: [],
    deleted_at: info.at,
    deleted_reason: info.reason,
    tombstone_id: `tomb_${hashString(`${meeting.capture_id}::${info.at}`)}`,
  };
}

export function consentGate(meeting: Meeting): { ok: boolean; reason: string } {
  if (meeting.status === "tombstoned") return { ok: false, reason: "This memory has been deleted." };
  if (meeting.consent.state !== "granted") {
    return { ok: false, reason: `Consent is ${meeting.consent.state}. RECALL cannot emit a capture event.` };
  }
  return { ok: true, reason: "Consent recorded before capture." };
}

export function safeMeeting(meeting: Meeting, includeDetected = true): Meeting {
  const next: Meeting = JSON.parse(JSON.stringify(meeting));
  for (const ev of next.evidence) {
    const red = redactionFor(next, ev);
    if (red && (red.status === "applied" || includeDetected)) ev.quote = red.safe_text;
    else if (isRedacted(next, ev)) ev.quote = red?.safe_text ?? "[redacted]";
  }
  for (const row of next.utterances) {
    if (row.redacted_by) {
      const red = next.redactions.find((r) => r.id === row.redacted_by);
      if (red && (red.status === "applied" || includeDetected)) row.text = red.safe_text;
    }
  }
  return next;
}

export function meetingPayload(meeting: Meeting, opts: { safe?: boolean } = {}): Record<string, unknown> {
  const safe = opts.safe !== false;
  const shaped = safe ? safeMeeting(meeting, true) : safeMeeting(meeting, false);
  const appliedRedactions = shaped.redactions
    .filter((r) => r.status === "applied" || (safe && r.status === "detected"))
    .map((r) => ({ range: `${fmtTime(meeting.utterances.find((u) => u.id === r.utterance_id)?.start ?? 0)}–${fmtTime(meeting.utterances.find((u) => u.id === r.utterance_id)?.end ?? 0)}`, reason: r.reason, safe_text: r.safe_text }));
  return {
    capture_id: meeting.capture_id,
    title: meeting.title,
    mode: meeting.mode,
    started_at: meeting.started_at,
    ended_at: meeting.ended_at,
    language: meeting.language,
    jurisdiction: meeting.jurisdiction,
    participants: meeting.participants.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    summary: meeting.summary,
    decisions: shaped.decisions.map((d) => ({ text: d.text, evidence_id: d.evidence_id, confidence: d.confidence })),
    action_items: shaped.actions.map((a) => ({ text: a.text, owner: a.owner, due: a.due, evidence_id: a.evidence_id })),
    open_questions: shaped.questions.map((q) => q.text),
    open_question_evidence: shaped.questions.map((q) => q.evidence_id),
    consent: meeting.consent,
    redactions: appliedRedactions,
    evidence: shaped.evidence.map((e) => ({
      id: e.id,
      quote: e.quote,
      speaker_id: e.speaker_id,
      start: fmtTime(e.start),
      end: fmtTime(e.end),
      confidence: e.confidence,
    })),
    provenance: {
      device: meeting.provenance.device,
      model: meeting.provenance.asr_model,
      app_version: meeting.provenance.app_version,
      audio_sha256: meeting.provenance.audio_sha256,
      local_only: true,
    },
    evidence_pointer: `recall://captures/${meeting.capture_id}`,
    media_included: false,
  };
}

export function notePayload(note: Note): Record<string, unknown> {
  return {
    note_id: note.note_id,
    text: note.text,
    captured_at: note.captured_at,
    location: note.location,
    evidence_ref: note.evidence_ref,
    consent: note.consent,
    photo_ocr: note.photo.ocr,
    evidence_pointer: `recall://notes/${note.note_id}`,
    media_included: false,
  };
}

export function buildEvent(
  type: string,
  payload: Record<string, unknown>,
  opts: { sensitivity?: PpmaEvent["sensitivity"]; space?: string; occurredAt?: string; provenance?: Record<string, unknown>; seed?: string } = {},
): PpmaEvent {
  const occurredAt = opts.occurredAt ?? new Date().toISOString();
  const seed = opts.seed ?? `${type}::${String(payload.capture_id ?? payload.note_id ?? payload.event_seed ?? occurredAt)}::${occurredAt}`;
  return {
    event_id: eventIdFor(seed),
    app_id: APP_ID,
    space: opts.space ?? DEFAULT_SPACE,
    occurred_at: occurredAt,
    type,
    sensitivity: opts.sensitivity ?? "personal",
    payload,
    provenance: opts.provenance ?? { app_version: "1.0.0", local_only: true },
    delivery: { status: "queued", attempts: 0, delivered_at: null, duplicate: false, latency_ms: null },
  };
}

export function memoryFromMeeting(meeting: Meeting, eventId: string, now: string): MemoryEntry[] {
  const base = {
    capture_id: meeting.capture_id,
    meeting_id: meeting.id,
    sensitivity: meeting.sensitivity,
    consent: meeting.consent.state,
    redacted: meeting.redactions.some((r) => r.status === "applied"),
    source: "RECALL" as const,
    created_at: now,
    state: "active" as const,
  };
  const rows: MemoryEntry[] = [];
  meeting.decisions.forEach((d, i) => {
    rows.push({
      ...base,
      id: `mem_${hashString(`${eventId}::dec::${i}`)}`,
      type: "decision",
      text: d.text,
      speaker_id: meeting.evidence.find((e) => e.id === d.evidence_id)?.speaker_id ?? null,
      evidence_id: d.evidence_id,
      confidence: d.confidence,
    });
  });
  meeting.actions.forEach((a, i) => {
    rows.push({
      ...base,
      id: `mem_${hashString(`${eventId}::act::${i}`)}`,
      type: "action",
      text: a.text,
      speaker_id: meeting.evidence.find((e) => e.id === a.evidence_id)?.speaker_id ?? null,
      evidence_id: a.evidence_id,
      confidence: a.confidence,
    });
  });
  meeting.questions.forEach((q, i) => {
    rows.push({
      ...base,
      id: `mem_${hashString(`${eventId}::q::${i}`)}`,
      type: "question",
      text: q.text,
      speaker_id: null,
      evidence_id: q.evidence_id,
      confidence: q.confidence,
    });
  });
  const promise = meeting.evidence.find((e) => e.kind === "promise");
  if (promise && !meeting.decisions.some((d) => d.evidence_id === promise.id)) {
    rows.push({
      ...base,
      id: `mem_${hashString(`${eventId}::promise`)}`,
      type: "promise",
      text: safeQuote(meeting, promise, true),
      speaker_id: promise.speaker_id,
      evidence_id: promise.id,
      confidence: promise.confidence,
    });
  }
  return rows;
}

export function dedupeEvent(events: PpmaEvent[], event: PpmaEvent): boolean {
  return events.some((e) => e.event_id === event.event_id);
}

export function evidencePackFor(meeting: Meeting, evidenceId: string): EvidencePack | null {
  const evidence = meeting.evidence.find((e) => e.id === evidenceId);
  if (!evidence) return null;
  const speaker = speakerName(meeting, evidence.speaker_id);
  const redactions = meeting.redactions
    .filter((r) => r.evidence_id === evidenceId)
    .map((r) => ({ label: r.label, safe_text: r.safe_text }));
  const quote = safeQuote(meeting, evidence, true);
  const hash = `sha256:${shaLike(`${meeting.capture_id}::${evidence.id}::${quote}`)}`;
  const provenance = {
    device: meeting.provenance.device,
    model: meeting.provenance.asr_model,
    app_version: meeting.provenance.app_version,
    language: meeting.provenance.language,
    consent: meeting.consent.state,
    jurisdiction: meeting.consent.jurisdiction,
    local_only: "true",
    audio_sha256: meeting.provenance.audio_sha256,
  };
  const markdown = [
    `# Evidence pack — ${meeting.title}`,
    "",
    `**Quote:** “${quote}”`,
    "",
    `- Speaker: ${speaker} (${meeting.participants.find((p) => p.id === evidence.speaker_id)?.role ?? "participant"})`,
    `- Timestamp: ${fmtTime(evidence.start)}–${fmtTime(evidence.end)}`,
    `- Source: ${meeting.title} · ${meeting.capture_id}`,
    `- Confidence: ${Math.round(evidence.confidence * 100)}% (attribution ${Math.round(evidence.attribution_confidence * 100)}%)`,
    `- Consent: ${meeting.consent.state} · ${meeting.consent.basis} · ${meeting.consent.jurisdiction} (${meeting.consent.wording_version})`,
    `- Redactions: ${redactions.length ? redactions.map((r) => r.label).join(", ") : "none"}`,
    `- Evidence pointer: recall://captures/${meeting.capture_id}#${evidence.id}`,
    `- Integrity: ${hash}`,
    "",
    "## Provenance",
    "",
    ...Object.entries(provenance).map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`),
    "",
    "_Generated locally by RECALL. Raw audio is not included. No customer audio or transcript was used to train a model._",
  ].join("\n");
  return {
    title: meeting.title,
    generated_at: new Date().toISOString(),
    meeting: meeting.title,
    quote,
    speaker,
    start: fmtTime(evidence.start),
    end: fmtTime(evidence.end),
    source: `${meeting.title} · ${meeting.capture_id}`,
    confidence: evidence.confidence,
    redactions,
    provenance,
    hash,
    markdown,
  };
}

export function downloadText(filename: string, text: string, mime = "text/markdown;charset=utf-8"): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function consentCoverage(meetings: Meeting[]): number {
  const live = meetings.filter((m) => m.status !== "tombstoned");
  if (!live.length) return 1;
  return live.filter((m) => m.consent.state === "granted").length / live.length;
}

export function queueOf(events: PpmaEvent[]): PpmaEvent[] {
  return events.filter((e) => e.delivery.status === "queued");
}

export function projectStateFor(meeting: Meeting): string {
  const firstDecision = meeting.decisions[0]?.text;
  const firstAction = meeting.actions[0];
  if (!firstDecision) return `${meeting.title} added to the project memory.`;
  return `${firstDecision}${firstAction ? ` · Next: ${firstAction.text}` : ""}`;
}

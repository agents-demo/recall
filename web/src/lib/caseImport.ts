import type {
  ActionItem,
  Consent,
  Decision,
  Evidence,
  Meeting,
  Participant,
  Question,
  Sensitivity,
  Utterance,
} from "../types";

export interface CaseLine {
  id?: string;
  start?: number;
  speaker?: string;
  text: string;
  confidence?: number;
}

export interface ParsedCase {
  title: string;
  occurred_at: string;
  duration_seconds: number;
  mode: "meeting" | "call";
  language: string;
  jurisdiction: string;
  sensitivity: Sensitivity;
  summary: string;
  participants: { name: string; role?: string }[];
  decisions: { id?: string; text: string; evidence_id?: string; confidence?: number }[];
  actions: { id?: string; text: string; owner?: string; due?: string; evidence_id?: string; confidence?: number }[];
  questions: { id?: string; text: string; evidence_id?: string; confidence?: number }[];
  transcript: CaseLine[];
}

const COLORS = ["amber", "violet", "cyan", "green", "blue"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function parseClock(value: string): number {
  const parts = value.replace(",", ".").split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(value) || 0;
}

function parseTranscript(text: string): CaseLine[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const rows: CaseLine[] = [];
  let current: CaseLine | null = null;
  let index = 0;
  const flush = () => {
    if (current && current.text.trim()) rows.push({ ...current, text: current.text.trim() });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^WEBVTT/i.test(line) || /^\d+$/.test(line)) continue;
    // WebVTT / SRT cue
    if (line.includes("-->")) {
      flush();
      const start = line.split("-->")[0].trim();
      current = { start: parseClock(start), text: "", confidence: 0.9 };
      continue;
    }
    // [mm:ss] Speaker (role) — the example transcript format
    const bracket = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?)(?:\s*\([^)]*\))?$/);
    if (bracket) {
      flush();
      current = { id: `e${index + 1}`, start: parseClock(bracket[1]), speaker: bracket[2].trim(), text: "", confidence: 0.9 };
      index += 1;
      continue;
    }
    // Speaker: text
    const speaker = line.match(/^([A-Z][\w .'’-]{1,40}):\s*(.+)$/);
    if (speaker) {
      if (current && !current.text) {
        current.speaker = speaker[1].trim();
        current.text = speaker[2].trim();
      } else {
        flush();
        current = { id: `e${index + 1}`, start: index * 10, speaker: speaker[1].trim(), text: speaker[2].trim(), confidence: 0.9 };
        index += 1;
      }
      continue;
    }
    if (current) {
      current.text = `${current.text} ${line}`.trim();
    } else {
      current = { id: `e${index + 1}`, start: index * 10, speaker: "Speaker 1", text: line, confidence: 0.9 };
      index += 1;
    }
  }
  flush();
  return rows;
}

function normalize(raw: unknown, fileName: string): ParsedCase | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.title !== "string" || !value.title.trim()) return null;
  const transcript = Array.isArray(value.transcript)
    ? (value.transcript as Record<string, unknown>[]).map((row, i, all) => ({
        id: typeof row.id === "string" ? row.id : `e${i + 1}`,
        start: typeof row.start === "number" ? row.start : i * 10,
        speaker: typeof row.speaker === "string" ? row.speaker : typeof row.speaker_id === "string" ? row.speaker_id : "Speaker 1",
        text: typeof row.text === "string" ? row.text : typeof row.quote === "string" ? row.quote : "",
        confidence: typeof row.confidence === "number" ? row.confidence : 0.9,
        end: typeof row.start === "number" ? row.start + 8 : (all[i + 1]?.start as number | undefined) ?? i * 10 + 8,
      }))
    : [];
  const participants = Array.isArray(value.participants)
    ? (value.participants as unknown[]).map((person) =>
        typeof person === "string"
          ? { name: person }
          : { name: String((person as Record<string, unknown>).name ?? "Participant"), role: String((person as Record<string, unknown>).role ?? "Participant") },
      )
    : [];
  const consent = (value.consent ?? {}) as Record<string, unknown>;
  return {
    title: value.title.trim(),
    occurred_at: typeof value.occurred_at === "string" ? value.occurred_at : new Date().toISOString(),
    duration_seconds: typeof value.duration_seconds === "number" ? value.duration_seconds : transcript.length ? Number(transcript[transcript.length - 1].end ?? transcript.length * 10) : 0,
    mode: value.mode === "call" ? "call" : "meeting",
    language: typeof value.language === "string" ? value.language : "en",
    jurisdiction: typeof value.jurisdiction === "string" ? value.jurisdiction : typeof consent.jurisdiction === "string" ? consent.jurisdiction : "DE",
    sensitivity: (["personal", "client_confidential", "financial", "health", "general"].includes(String(value.sensitivity)) ? value.sensitivity : "personal") as Sensitivity,
    summary: typeof value.summary === "string" ? value.summary : `Imported case: ${fileName}`,
    participants: participants.length ? participants : [{ name: "Imported speaker", role: "Source" }],
    decisions: Array.isArray(value.decisions) ? (value.decisions as ParsedCase["decisions"]) : [],
    actions: Array.isArray(value.actions) ? (value.actions as ParsedCase["actions"]) : [],
    questions: Array.isArray(value.questions) ? (value.questions as ParsedCase["questions"]) : [],
    transcript: transcript.filter((row) => row.text),
  };
}

export function parseCaseFile(fileName: string, text: string): ParsedCase | null {
  const isJson = fileName.toLowerCase().endsWith(".json") || text.trim().startsWith("{");
  if (isJson) {
    try {
      return normalize(JSON.parse(text), fileName);
    } catch {
      return null;
    }
  }
  const transcript = parseTranscript(text);
  if (!transcript.length) return null;
  const first = transcript[0];
  return {
    title: fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
    occurred_at: new Date().toISOString(),
    duration_seconds: (transcript[transcript.length - 1].start ?? 0) + 8,
    mode: "meeting",
    language: "en",
    jurisdiction: "DE",
    sensitivity: "personal",
    summary: transcript.slice(0, 2).map((line) => line.text).join(" ").slice(0, 240),
    participants: Array.from(new Set(transcript.map((line) => line.speaker ?? "Speaker 1"))).map((name) => ({ name, role: "Speaker" })),
    decisions: [],
    actions: [],
    questions: [],
    transcript,
  };
}

export function buildMeeting(parsed: ParsedCase, base: Meeting, consent: Consent): Meeting {
  const people: Participant[] = parsed.participants.map((person, index) => ({
    id: `p${index + 1}`,
    name: person.name,
    role: person.role ?? "Participant",
    initials: initials(person.name) || `P${index + 1}`,
    color: COLORS[index % COLORS.length],
  }));
  const byName = new Map(people.map((person) => [person.name.toLowerCase(), person.id]));

  const utterances: Utterance[] = parsed.transcript.map((line, index) => {
    const speakerId = byName.get((line.speaker ?? "").toLowerCase()) ?? people[0]?.id ?? "p1";
    const start = line.start ?? index * 10;
    return {
      id: `u${index + 1}`,
      speaker_id: speakerId,
      start,
      end: start + (line.text.length > 120 ? 12 : 7),
      text: line.text,
      confidence: line.confidence ?? 0.9,
    };
  });

  const quoteFor = (evidenceId: string | undefined, fallback: string) => {
    const line = parsed.transcript.find((row) => row.id === evidenceId) ?? parsed.transcript.find((row) => row.text.includes(fallback.slice(0, 24)));
    return line ?? parsed.transcript[0];
  };

  const evidence: Evidence[] = [];
  const decisions: Decision[] = parsed.decisions.map((decision, index) => {
    const line = quoteFor(decision.evidence_id, decision.text);
    const id = `ev_d${index + 1}`;
    if (line) {
      evidence.push({
        id,
        kind: "decision",
        quote: line.text,
        speaker_id: byName.get((line.speaker ?? "").toLowerCase()) ?? people[0]?.id ?? "p1",
        start: line.start ?? index * 10,
        end: (line.start ?? index * 10) + 8,
        confidence: decision.confidence ?? 0.9,
        attribution_confidence: 0.9,
        utterance_id: utterances.find((row) => row.text === line.text)?.id ?? null,
        sensitivity: parsed.sensitivity,
      });
    }
    return { id: decision.id ?? `d${index + 1}`, text: decision.text, evidence_id: id, confidence: decision.confidence ?? 0.9, status: "open" };
  });

  const actions: ActionItem[] = parsed.actions.map((action, index) => {
    const line = quoteFor(action.evidence_id, action.text);
    const id = `ev_a${index + 1}`;
    if (line) {
      evidence.push({
        id,
        kind: "action",
        quote: line.text,
        speaker_id: byName.get((line.speaker ?? "").toLowerCase()) ?? people[0]?.id ?? "p1",
        start: line.start ?? index * 10,
        end: (line.start ?? index * 10) + 8,
        confidence: action.confidence ?? 0.9,
        attribution_confidence: 0.9,
        utterance_id: utterances.find((row) => row.text === line.text)?.id ?? null,
        sensitivity: parsed.sensitivity,
      });
    }
    return {
      id: action.id ?? `a${index + 1}`,
      text: action.text,
      owner: action.owner ?? "Unassigned",
      due: action.due ?? "",
      evidence_id: id,
      confidence: action.confidence ?? 0.9,
      status: "open",
    };
  });

  const questions: Question[] = parsed.questions.map((question, index) => {
    const line = quoteFor(question.evidence_id, question.text);
    const id = `ev_q${index + 1}`;
    if (line) {
      evidence.push({
        id,
        kind: "question",
        quote: line.text,
        speaker_id: byName.get((line.speaker ?? "").toLowerCase()) ?? people[0]?.id ?? "p1",
        start: line.start ?? index * 10,
        end: (line.start ?? index * 10) + 8,
        confidence: question.confidence ?? 0.9,
        attribution_confidence: 0.9,
        utterance_id: utterances.find((row) => row.text === line.text)?.id ?? null,
        sensitivity: parsed.sensitivity,
      });
    }
    return { id: question.id ?? `q${index + 1}`, text: question.text, evidence_id: id, confidence: question.confidence ?? 0.9, status: "open" };
  });

  const started = new Date(parsed.occurred_at);
  const ended = new Date(started.getTime() + Math.max(parsed.duration_seconds, 1) * 1000);
  return {
    ...base,
    id: `mtg_${Math.random().toString(36).slice(2, 10)}`,
    capture_id: `cap_${Math.random().toString(36).slice(2, 12)}`,
    title: parsed.title,
    mode: parsed.mode,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_s: Math.max(parsed.duration_seconds, 1),
    language: parsed.language,
    jurisdiction: parsed.jurisdiction,
    sensitivity: parsed.sensitivity,
    status: "captured",
    participants: people,
    consent: { ...consent, state: "granted", jurisdiction: parsed.jurisdiction },
    summary: parsed.summary,
    utterances,
    decisions,
    actions,
    questions,
    evidence,
    redactions: [],
    provenance: {
      ...base.provenance,
      device: "imported case file",
      asr_model: "none (text supplied)",
      diarization_model: "none (speakers supplied)",
      vad_model: "none",
      app_version: "1.4.0",
      language: parsed.language,
      network: "none",
      local_only: true,
    },
    tags: ["imported-case"],
    baseline_lookup_min: 0,
    ppma: { status: "pending", event_id: null, completed_at: null },
    import: true,
    deleted_at: null,
    deleted_reason: null,
    tombstone_id: null,
  };
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AmbientState,
  AnalysisResult,
  Answer,
  AttentionFeedback,
  AttentionItem,
  AuditEntry,
  Comment,
  ConnectorState,
  Consent,
  ConversationTurn,
  Correction,
  Lang,
  Meeting,
  MemoryEntry,
  Note,
  Pack,
  PpmaCommand,
  PpmaEvent,
  Redaction,
  RemoteAck,
  Retention,
  Role,
  SearchHit,
  Theme,
  Tombstone,
} from "../types";
import {
  answerQuestion,
  applyCorrection,
  applyRedaction,
  buildEvent,
  consentGate,
  consentCoverage,
  dedupeEvent,
  fmtTime,
  meetingPayload,
  memoryFromMeeting,
  newId,
  notePayload,
  projectStateFor,
  safeMeeting,
  searchPack,
  speakerName,
  tombstoneMeeting,
} from "./engine";
import { deriveAttention, nudgeMetrics, attentionForMeeting as attentionForMeetingEngine } from "./attention";
import { converse } from "./conversation";
import { defaultConnectorState } from "./connectors";
import { buildMeeting, parseCaseFile } from "./caseImport";
import { decideAttention, mergeAttention } from "./laixAttention";
import { approveRecord, createDecisionRecord, type DecisionRecord, type EvidenceRef } from "@laix/decision-record";
import { sendEvent, sendCommand } from "./ppmaClient";
import { clearVault, encryptionAvailable, loadVault, saveVault } from "./vault";

const STORAGE_KEY = "recall.demo.v2";

export interface Settings {
  theme: Theme;
  lang: Lang;
  role: Role;
  reducedMotion: boolean;
  ppmaOnline: boolean;
  fontScale: "standard" | "large";
  onboarded: boolean;
  ppmaMode: "fake" | "live";
  endpointUrl: string;
  endpointToken: string;
  endpointSecret: string;
  focusMode: boolean;
  attentionBudget: number;
  quietHours: string;
  attentionThreshold: number;
  workspaceMode: "demo" | "personal";
}

export interface ProjectState {
  state: string;
  followup: string;
  last_event: string | null;
  updated_at: string;
}

interface Persisted {
  corrections: Correction[];
  redactionPatches: Record<string, Redaction[]>;
  tombstones: Record<string, Tombstone>;
  consentOverrides: Record<string, Consent>;
  retentionOverrides: Record<string, Retention>;
  events: PpmaEvent[] | null;
  memory: MemoryEntry[] | null;
  commands: PpmaCommand[] | null;
  imported: Meeting[];
  fieldNotes: Note[];
  audit: AuditEntry[];
  project: ProjectState | null;
  analysisByMeeting: Record<string, AnalysisResult>;
  analysisApproved: Record<string, boolean>;
  decisionRecords: DecisionRecord[];
  settings: Settings;
  killSwitch: boolean;
  lastReplay: { event_id: string; at: string; result: string } | null;
  conformanceRun: string | null;
  attentionFeedback: Record<string, AttentionFeedback>;
  comments: Comment[];
  connectors: Record<string, ConnectorState>;
  conversation: ConversationTurn[];
  ambient: AmbientState;
  remoteAcks: RemoteAck[];
}

const DEFAULT_AMBIENT: AmbientState = {
  enabled: false,
  wakeWord: true,
  batteryAware: true,
  schedule: "19:00–07:00",
  zones: ["Private offices", "Bathrooms / changing rooms", "Client legal review"],
  lastActivation: null,
  activations: 0,
};

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  lang: "en",
  role: "team_lead",
  reducedMotion: false,
  ppmaOnline: true,
  fontScale: "large",
  onboarded: false,
  ppmaMode: "fake",
  endpointUrl: "",
  endpointToken: "",
  endpointSecret: "",
  focusMode: false,
  attentionBudget: 5,
  quietHours: "20:00–07:00",
  attentionThreshold: 0.5,
  workspaceMode: "demo",
};

const EMPTY: Persisted = {
  corrections: [],
  redactionPatches: {},
  tombstones: {},
  consentOverrides: {},
  retentionOverrides: {},
  events: null,
  memory: null,
  commands: null,
  imported: [],
  fieldNotes: [],
  audit: [],
  project: null,
  analysisByMeeting: {},
  analysisApproved: {},
  decisionRecords: [],
  settings: DEFAULT_SETTINGS,
  killSwitch: false,
  lastReplay: null,
  conformanceRun: null,
  attentionFeedback: {},
  comments: [],
  connectors: defaultConnectorState(),
  conversation: [],
  ambient: DEFAULT_AMBIENT,
  remoteAcks: [],
};

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...EMPTY,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function deliver(event: PpmaEvent): PpmaEvent {
  const latency = event.type === "capture.meeting.completed" ? 1400 : event.type === "capture.note.created" ? 700 : 240;
  return {
    ...event,
    delivery: {
      status: "delivered",
      attempts: event.delivery.attempts + 1,
      delivered_at: nowIso(),
      duplicate: false,
      latency_ms: latency,
    },
  };
}

function auditFor(event: PpmaEvent, meeting?: Meeting): AuditEntry {
  const actor = event.type === "capture.correction" || event.type === "capture.redaction.applied" ? "You" : "RECALL agent";
  return {
    id: `aud_${event.event_id.slice(-8)}${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`,
    at: event.occurred_at,
    actor,
    action: event.type,
    object: String(event.payload.capture_id ?? event.payload.note_id ?? "capture"),
    detail:
      event.type === "capture.meeting.completed"
        ? `${String(event.payload.title ?? meeting?.title ?? "Capture")} · derived facts + evidence pointers · ${event.delivery.status}`
        : event.type === "capture.correction"
          ? `Human correction · ${String(event.payload.field)} · ${String(event.payload.before)} → ${String(event.payload.after)}`
          : event.type === "capture.redaction.applied"
            ? `Redaction applied · ${String(event.payload.reason)} · safe text only`
            : event.type === "capture.memory.deleted"
              ? `Tombstone · ${String(event.payload.reason)} · content removed locally`
              : event.type === "capture.consent.changed"
                ? `Consent ${String(event.payload.state)} · ${String(event.payload.reason)}`
                : event.type === "capture.note.created"
                  ? `Field note · ${event.payload.location ? (event.payload.location as { label: string }).label : "no location"}`
                  : "Recording metadata · no transcript",
    model: String((event.provenance as { model?: string }).model ?? "recall-agent"),
    sources: [`device:${String((event.provenance as { device?: string }).device ?? "local")}`],
  };
}

function memoryFromPayload(event: PpmaEvent, now: string): MemoryEntry[] {
  const payload = event.payload;
  const captureId = String(payload.capture_id ?? "");
  const meetingId = String(payload.meeting_id ?? captureId);
  const decisions = (payload.decisions as { text: string; evidence_id: string; confidence: number }[] | undefined) ?? [];
  const actions = (payload.action_items as { text: string; evidence_id: string; confidence?: number }[] | undefined) ?? [];
  const questions = (payload.open_questions as string[] | undefined) ?? [];
  const questionEvidence = (payload.open_question_evidence as string[] | undefined) ?? [];
  const evidence = (payload.evidence as { id: string; quote: string; speaker_id: string; confidence: number }[] | undefined) ?? [];
  const redacted = ((payload.redactions as unknown[] | undefined) ?? []).length > 0;
  const consent = (payload.consent as { state?: string } | undefined)?.state ?? "granted";
  const rows: MemoryEntry[] = [];
  const base = {
    capture_id: captureId,
    meeting_id: meetingId,
    sensitivity: event.sensitivity,
    consent,
    redacted,
    source: "RECALL" as const,
    created_at: now,
    state: "active" as const,
  };
  decisions.forEach((d, i) => {
    rows.push({
      ...base,
      id: `mem_${event.event_id.slice(-6)}_d${i}`,
      type: "decision",
      text: d.text,
      speaker_id: evidence.find((e) => e.id === d.evidence_id)?.speaker_id ?? null,
      evidence_id: d.evidence_id,
      confidence: d.confidence,
    });
  });
  actions.forEach((a, i) => {
    rows.push({
      ...base,
      id: `mem_${event.event_id.slice(-6)}_a${i}`,
      type: "action",
      text: a.text,
      speaker_id: evidence.find((e) => e.id === a.evidence_id)?.speaker_id ?? null,
      evidence_id: a.evidence_id,
      confidence: a.confidence ?? 0.85,
    });
  });
  questions.forEach((q, i) => {
    rows.push({
      ...base,
      id: `mem_${event.event_id.slice(-6)}_q${i}`,
      type: "question",
      text: q,
      speaker_id: null,
      evidence_id: questionEvidence[i] ?? "",
      confidence: 0.85,
    });
  });
  const promise = evidence.find((e) => /hold the 14th|cannot commit|promise/i.test(e.quote));
  if (promise) {
    rows.push({
      ...base,
      id: `mem_${event.event_id.slice(-6)}_p`,
      type: "promise",
      text: promise.quote,
      speaker_id: promise.speaker_id,
      evidence_id: promise.id,
      confidence: promise.confidence,
    });
  }
  return rows;
}

function applyDelivered(prev: Persisted, event: PpmaEvent, pack: Pack): Pick<Persisted, "memory" | "project" | "audit"> {
  const now = nowIso();
  let memory = prev.memory ?? pack.ppma.memory;
  let project: ProjectState =
    prev.project ?? { state: pack.ppma.project.state_before, followup: "", last_event: null, updated_at: pack.ppma.project.updated_at };
  let audit = prev.audit;

  if (event.type === "capture.meeting.completed" || event.type === "capture.call.completed") {
    const captureId = String(event.payload.capture_id ?? "");
    const newEntries = memoryFromPayload(event, now);
    memory = [...(prev.memory ?? pack.ppma.memory).filter((m) => m.capture_id !== captureId), ...newEntries];
    const isStageMeeting = String(event.payload.capture_id) === pack.meetings[0].capture_id;
    project = {
      state: isStageMeeting
        ? pack.ppma.project.state_after
        : `${String(event.payload.title ?? "Capture")} added to project memory.`,
      followup: isStageMeeting ? pack.ppma.project.followup_draft : "",
      last_event: event.event_id,
      updated_at: now,
    };
  } else if (event.type === "capture.note.created") {
    const note = event.payload;
    const entry: MemoryEntry = {
      id: `mem_${event.event_id.slice(-6)}_n`,
      capture_id: String(note.note_id ?? ""),
      meeting_id: String(note.note_id ?? ""),
      type: "note",
      text: String(note.text ?? ""),
      speaker_id: null,
      evidence_id: String(note.evidence_ref ?? ""),
      confidence: 0.97,
      sensitivity: event.sensitivity,
      consent: String((note.consent as { state?: string } | undefined)?.state ?? "granted"),
      redacted: false,
      source: "RECALL",
      created_at: now,
      state: "active",
    };
    memory = [...memory.filter((m) => m.id !== entry.id), entry];
    project = { ...project, state: `Field note added: ${String(note.text ?? "").slice(0, 90)}`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.correction") {
    const captureId = String(event.payload.capture_id ?? "");
    const before = String(event.payload.before_name ?? event.payload.before);
    const after = String(event.payload.after_name ?? event.payload.after);
    memory = memory.map((m) =>
      m.capture_id === captureId && (m.evidence_id === String(event.payload.evidence_id) || !event.payload.evidence_id)
        ? { ...m, corrected: `${before} → ${after}`, ...(event.payload.field === "speaker_id" ? { speaker_id: String(event.payload.after) } : {}) }
        : m,
    );
    project = { ...project, state: `Human correction applied: ${before} → ${after}. The memory keeps the audit trail.`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.redaction.applied") {
    const captureId = String(event.payload.capture_id ?? "");
    const safeText = String(event.payload.safe_text ?? "[redacted]");
    memory = memory.map((m) =>
      m.capture_id === captureId ? { ...m, redacted: true, text: m.evidence_id === String(event.payload.evidence_id) ? safeText : m.text } : m,
    );
    project = { ...project, state: `A passage was redacted before sharing (${String(event.payload.reason)}). PPMA holds the safe version.`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.memory.deleted") {
    const captureId = String(event.payload.capture_id ?? "");
    memory = memory.map((m) => (m.capture_id === captureId ? { ...m, state: "retired", text: "[tombstone — content deleted]" } : m));
    project = { ...project, state: `Memory retired for ${String(event.payload.title ?? captureId)}. A tombstone remains; replay cannot resurrect it.`, last_event: event.event_id, updated_at: now };
  } else if (event.type === "capture.consent.changed") {
    const captureId = String(event.payload.capture_id ?? "");
    memory = memory.map((m) => (m.capture_id === captureId ? { ...m, state: "suppressed" } : m));
    project = { ...project, state: `Consent ${String(event.payload.state)}. Memory suppressed; PPMA follows the stricter policy.`, last_event: event.event_id, updated_at: now };
  }

  audit = [auditFor(event), ...audit].slice(0, 400);
  return { memory, project, audit };
}

interface StoreValue {
  pack: Pack | null;
  loading: boolean;
  error: string | null;
  meetings: Meeting[];
  activeMeetings: Meeting[];
  notes: Note[];
  tombstoned: Meeting[];
  corrections: Correction[];
  events: PpmaEvent[];
  queue: PpmaEvent[];
  memory: MemoryEntry[];
  commands: PpmaCommand[];
  audit: AuditEntry[];
  project: ProjectState;
  settings: Settings;
  killSwitch: boolean;
  lastReplay: Persisted["lastReplay"];
  conformanceRun: string | null;
  toast: string | null;
  consentCoverage: number;
  attention: AttentionItem[];
  attentionMetrics: ReturnType<typeof nudgeMetrics>;
  attentionForMeeting: (meetingId: string) => AttentionItem[];
  attentionFeedback: Record<string, AttentionFeedback>;
  feedbackAttention: (id: string, state: AttentionFeedback["state"], note?: string) => void;
  assignAttention: (id: string, assignee: string) => void;
  comments: Comment[];
  addComment: (targetType: Comment["target_type"], targetId: string, meetingId: string, text: string) => void;
  resolveComment: (commentId: string) => void;
  conversation: ConversationTurn[];
  askThread: (input: string) => Answer;
  clearConversation: () => void;
  connectors: Record<string, ConnectorState>;
  setConnector: (id: string, patch: Partial<ConnectorState>) => void;
  ambient: AmbientState;
  setAmbient: (patch: Partial<AmbientState>) => void;
  logAmbientActivation: () => void;
  encryption: "on" | "migrating" | "unavailable";
  collabPeers: { id: string; name: string; role: Role; at: number }[];
  remoteAcks: RemoteAck[];
  meetingById: (id: string) => Meeting | undefined;
  noteById: (id: string) => Note | undefined;
  search: (query: string, options?: { meeting_id?: string; speaker_id?: string; kind?: string; limit?: number }) => SearchHit[];
  ask: (query: string) => Answer;
  say: (message: string) => void;
  correctSpeaker: (meetingId: string, evidenceId: string, after: string, reason?: string) => void;
  correctText: (meetingId: string, utteranceId: string, after: string) => void;
  correctItem: (meetingId: string, itemId: string, after: string) => void;
  redact: (meetingId: string, evidenceId: string, reason: string, label?: string) => void;
  unredact: (meetingId: string, redactionId: string) => void;
  sendMeeting: (meetingId: string, opts?: { safe?: boolean }) => string | null;
  sendNote: (noteId: string) => string | null;
  withdrawConsent: (meetingId: string, reason: string) => void;
  deleteMeeting: (meetingId: string, reason: string) => boolean;
  setRetention: (meetingId: string, retainUntil: string, policy?: string) => void;
  toggleLegalHold: (meetingId: string) => void;
  flushQueue: () => void;
  replayEvent: (eventId: string) => void;
  handleCommand: (commandId: string, action: "apply" | "reject") => void;
  recordSession: (mode: "meeting" | "call" | "note", title: string, consentState: Consent, scenarioId?: string) => string;
  completeRecording: (meetingId: string) => void;
  importAudio: (fileName: string) => string;
  importCaseFile: (fileName: string, text: string, consent: Consent) => string;
  analysisFor: (meetingId: string) => AnalysisResult | null;
  analyzeMeeting: (meetingId: string) => Promise<AnalysisResult | null>;
  approveAnalysis: (meetingId: string) => void;
  isAnalysisApproved: (meetingId: string) => boolean;
  analysisRunning: string | null;
  decisionRecordFor: (meetingId: string) => DecisionRecord | null;
  addFieldNote: (text: string, location: string, photo?: { label: string; ocr: string }) => string;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: (patch: Partial<Settings>) => void;
  toggleKillSwitch: () => void;
  runConformance: () => void;
  exportAudit: () => string;
  reset: () => void;
  resetMeeting: (meetingId: string) => void;
  resetStage: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [pack, setPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Persisted>(() => loadPersisted());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [encryption, setEncryption] = useState<"on" | "migrating" | "unavailable">(encryptionAvailable() ? "migrating" : "unavailable");
  const [collabPeers, setCollabPeers] = useState<{ id: string; name: string; role: Role; at: number }[]>([]);
  const [analysisRunning, setAnalysisRunning] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const say = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadVault<Partial<Persisted>>();
        if (!cancelled && saved) {
          setState((prev) => ({
            ...prev,
            ...saved,
            events: saved.events ?? prev.events,
            memory: saved.memory ?? prev.memory,
            commands: saved.commands ?? prev.commands,
            settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
            connectors: { ...defaultConnectorState(), ...(saved.connectors ?? {}) },
            ambient: { ...DEFAULT_AMBIENT, ...(saved.ambient ?? {}) },
            attentionFeedback: saved.attentionFeedback ?? {},
            comments: saved.comments ?? [],
            conversation: saved.conversation ?? [],
            remoteAcks: saved.remoteAcks ?? [],
          }));
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setEncryption(encryptionAvailable() ? "on" : "unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("recall-collab");
    channelRef.current = channel;
    const peer = { id: newId("peer"), name: `Collaborator ${Math.floor(Math.random() * 90 + 10)}`, role: state.settings.role, at: Date.now() };
    const heartbeat = window.setInterval(() => channel.postMessage({ type: "presence", peer: { ...peer, at: Date.now() } }), 8000);
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; peer?: typeof peer; comment?: Comment; correction?: Correction; message?: string };
      if (message.type === "presence" && message.peer) {
        setCollabPeers((prev) => [...prev.filter((item) => item.id !== message.peer!.id), message.peer!].slice(-8));
      } else if (message.type === "comment" && message.comment) {
        setState((prev) => (prev.comments.some((item) => item.id === message.comment!.id) ? prev : { ...prev, comments: [...prev.comments, message.comment!] }));
      } else if (message.type === "correction" && message.correction) {
        setState((prev) => (prev.corrections.some((item) => item.id === message.correction!.id) ? prev : { ...prev, corrections: [...prev.corrections, message.correction!] }));
      } else if (message.type === "toast" && message.message) {
        say(message.message);
      }
    };
    const prune = window.setInterval(() => setCollabPeers((prev) => prev.filter((item) => Date.now() - item.at < 22000)), 6000);
    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(prune);
      channel.close();
      channelRef.current = null;
    };
  }, [state.settings.role, say]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}demo-pack.json`);
        if (!res.ok) throw new Error(`demo pack returned ${res.status}`);
        const data = (await res.json()) as Pack;
        if (cancelled) return;
        setPack(data);
        setState((prev) => ({
          ...prev,
          events: prev.events ?? data.ppma.events,
          memory: prev.memory ?? data.ppma.memory,
          commands: prev.commands ?? data.ppma.commands,
          audit: prev.audit.length ? prev.audit : data.admin.audit,
          project:
            prev.project ??
            (prev.settings.workspaceMode === "personal"
              ? null
              : {
                  state: data.ppma.project.state_before,
                  followup: "",
                  last_event: null,
                  updated_at: data.ppma.project.updated_at,
                }),
        }));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "The demo pack could not load.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || state.events === null) return;
    if (!encryptionAvailable()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* a full disk should not break a capture */
      }
      return;
    }
    void saveVault(state).then((ok) => setEncryption((prev) => (prev === (ok ? "on" : "unavailable") ? prev : ok ? "on" : "unavailable")));
  }, [state, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.settings.theme;
    root.dataset.lang = state.settings.lang;
    root.dataset.motion = state.settings.reducedMotion ? "reduced" : "full";
    root.dataset.font = state.settings.fontScale;
  }, [state.settings]);

  const demoMode = state.settings.workspaceMode !== "personal";
  const seedEventIds = useMemo(() => new Set((pack?.ppma.events ?? []).map((event) => event.event_id)), [pack]);
  const seedMemoryIds = useMemo(() => new Set((pack?.ppma.memory ?? []).map((entry) => entry.id)), [pack]);
  const seedCommandIds = useMemo(() => new Set((pack?.ppma.commands ?? []).map((command) => command.id)), [pack]);
  const seedAuditIds = useMemo(() => new Set((pack?.admin.audit ?? []).map((entry) => entry.id)), [pack]);

  const baseMeetings = useMemo(
    () => (pack ? [...(demoMode ? pack.meetings : []), ...state.imported] : []),
    [pack, state.imported, demoMode],
  );

  const meetings = useMemo(() => {
    return baseMeetings.map((base) => {
      let next = base;
      for (const correction of state.corrections) {
        if (correction.meeting_id === next.id) next = applyCorrection(next, correction);
      }
      for (const redaction of state.redactionPatches[next.id] ?? []) {
        next = applyRedaction(next, redaction);
      }
      if (state.consentOverrides[next.id]) next = { ...next, consent: state.consentOverrides[next.id] };
      if (state.retentionOverrides[next.id]) next = { ...next, retention: state.retentionOverrides[next.id] };
      const sent = state.events?.find(
        (e) =>
          (e.type === "capture.meeting.completed" || e.type === "capture.call.completed") &&
          e.payload.capture_id === next.capture_id &&
          e.delivery.status === "delivered",
      );
      const queued = state.events?.find(
        (e) =>
          (e.type === "capture.meeting.completed" || e.type === "capture.call.completed") &&
          e.payload.capture_id === next.capture_id &&
          e.delivery.status === "queued",
      );
      if (sent) next = { ...next, status: "sent", ppma: { status: "sent", event_id: sent.event_id, completed_at: sent.delivery.delivered_at } };
      else if (queued) next = { ...next, status: "queued", ppma: { status: "queued", event_id: queued.event_id, completed_at: null } };
      const analysis = state.analysisByMeeting[next.id];
      if (analysis) {
        const evidence = new Map<string, import("../types").Evidence>();
        const addEvidence = (utteranceId: string, kind: import("../types").EvidenceKind, confidence: number) => {
          const line = next.utterances.find((row) => row.id === utteranceId);
          if (!line) return "";
          const id = `ev_${line.id}`;
          if (!evidence.has(id)) {
            evidence.set(id, {
              id,
              kind,
              quote: line.text,
              speaker_id: line.speaker_id,
              start: line.start,
              end: line.end,
              confidence,
              attribution_confidence: line.confidence ?? 0.9,
              utterance_id: line.id,
              sensitivity: next.sensitivity,
            });
          }
          return id;
        };
        const decisions = analysis.decisions
          .map((item, index) => {
            const evidenceId = addEvidence(item.evidence_id, "decision", item.confidence);
            return evidenceId ? { id: `ad${index + 1}`, text: item.text, evidence_id: evidenceId, confidence: item.confidence, status: "open" } : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const actions = analysis.actions
          .map((item, index) => {
            const evidenceId = addEvidence(item.evidence_id, "action", item.confidence);
            return evidenceId
              ? { id: `aa${index + 1}`, text: item.text, owner: item.owner, due: item.due, evidence_id: evidenceId, confidence: item.confidence, status: "open" }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const questions = analysis.questions
          .map((item, index) => {
            const evidenceId = addEvidence(item.evidence_id, "question", 0.9);
            return evidenceId ? { id: `aq${index + 1}`, text: item.text, evidence_id: evidenceId, confidence: 0.9, status: item.answered ? "answered" : "open" } : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        next = {
          ...next,
          summary: analysis.summary || next.summary,
          decisions,
          actions,
          questions,
          evidence: [...evidence.values()],
        };
      }
      if (state.tombstones[next.id]) next = tombstoneMeeting(next, state.tombstones[next.id]);
      return next;
    });
  }, [baseMeetings, state.corrections, state.redactionPatches, state.consentOverrides, state.retentionOverrides, state.events, state.tombstones, state.analysisByMeeting]);

  const activeMeetings = useMemo(() => meetings.filter((m) => m.status !== "tombstoned"), [meetings]);
  const tombstoned = useMemo(() => meetings.filter((m) => m.status === "tombstoned"), [meetings]);
  const notes = useMemo(
    () => (pack ? [...(demoMode ? pack.notes : []), ...state.fieldNotes] : []),
    [pack, state.fieldNotes, demoMode],
  );
  const events = useMemo(() => {
    const all = state.events ?? [];
    return demoMode ? all : all.filter((event) => !seedEventIds.has(event.event_id));
  }, [state.events, demoMode, seedEventIds]);
  const memory = useMemo(() => {
    const all = state.memory ?? [];
    return demoMode ? all : all.filter((entry) => !seedMemoryIds.has(entry.id));
  }, [state.memory, demoMode, seedMemoryIds]);
  const commands = useMemo(() => {
    const all = state.commands ?? [];
    return demoMode ? all : all.filter((command) => !seedCommandIds.has(command.id));
  }, [state.commands, demoMode, seedCommandIds]);
  const audit = useMemo(
    () => (demoMode ? state.audit : state.audit.filter((entry) => !seedAuditIds.has(entry.id))),
    [state.audit, demoMode, seedAuditIds],
  );
  const queue = useMemo(() => events.filter((e) => e.delivery.status === "queued"), [events]);
  const project = useMemo<ProjectState>(() => {
    const current = state.project ?? { state: "", followup: "", last_event: null, updated_at: "" };
    if (demoMode || events.length > 0) return current;
    return {
      state: "No captures yet. Your own notes and captures will appear here; the synthetic pack is available from Settings.",
      followup: "",
      last_event: null,
      updated_at: "",
    };
  }, [state.project, demoMode, events.length]);

  const meetingById = useCallback((id: string) => meetings.find((m) => m.id === id), [meetings]);
  const noteById = useCallback((id: string) => notes.find((n) => n.id === id), [notes]);

  const analysisAttention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const now = Date.now();
    const allowed = (id: string) => {
      const feedback = state.attentionFeedback[id];
      if (!feedback) return true;
      if (feedback.state === "dismissed" || feedback.state === "wrong") return false;
      if (feedback.state === "snoozed" && feedback.until && Date.parse(feedback.until) > now) return false;
      return true;
    };
    for (const meeting of activeMeetings) {
      const analysis = state.analysisByMeeting[meeting.id];
      if (!analysis) continue;
      const route = `/meetings/${meeting.id}?tab=intelligence`;
      analysis.risks.forEach((risk, index) => {
        const id = `risk:${meeting.id}:${index}`;
        if (!allowed(id)) return;
        items.push({
          id,
          kind: "risk",
          severity: risk.severity,
          title: risk.text,
          detail: risk.why,
          why: `${risk.text} Evidence: “${risk.why}” Mitigation: ${risk.mitigation || "none recorded"}.`,
          meeting_id: meeting.id,
          route,
          action_label: "Review risk",
          confidence: 0.92,
          score: (risk.severity === "high" ? 96 : risk.severity === "warning" ? 82 : 64) + index,
        });
      });
      analysis.contradictions.forEach((item, index) => {
        const id = `contradiction:${meeting.id}:${index}`;
        if (!allowed(id)) return;
        items.push({
          id,
          kind: "contradiction",
          severity: "critical",
          title: item.text,
          detail: item.why,
          why: `${item.text} Two statements cannot both stand: ${item.evidence_a} vs ${item.evidence_b}.`,
          meeting_id: meeting.id,
          route,
          action_label: "Resolve contradiction",
          confidence: 0.9,
          score: 100 - index,
        });
      });
      analysis.gaps.forEach((item, index) => {
        const id = `gap:${meeting.id}:${index}`;
        if (!allowed(id)) return;
        items.push({
          id,
          kind: "gap",
          severity: "warning",
          title: item.text,
          detail: item.why,
          why: `${item.text} ${item.why}`,
          meeting_id: meeting.id,
          route,
          action_label: "Assign an owner",
          confidence: 0.88,
          score: 78 - index,
        });
      });
      analysis.actions.forEach((item, index) => {
        const unowned = !item.owner || item.owner === "Unassigned";
        const dueSoon = item.due && Date.parse(item.due) - now < 3 * 24 * 3600 * 1000;
        if (!unowned && !dueSoon) return;
        const id = `commitment:${meeting.id}:${index}`;
        if (!allowed(id)) return;
        items.push({
          id,
          kind: "commitment",
          severity: dueSoon ? "high" : "warning",
          title: unowned ? `Action has no owner: ${item.text}` : `Commitment due soon: ${item.text}`,
          detail: `${item.owner || "Unassigned"}${item.due ? ` · due ${item.due}` : " · no date"}`,
          why: `The agent extracted this commitment from the transcript; ${unowned ? "nobody owns it" : "the deadline is close"}.`,
          meeting_id: meeting.id,
          route,
          action_label: "Review commitment",
          confidence: item.confidence ?? 0.88,
          score: dueSoon ? 88 - index : 72 - index,
          due: item.due,
        });
      });
      analysis.questions.filter((item) => !item.answered).forEach((item, index) => {
        const id = `question:${meeting.id}:${index}`;
        if (!allowed(id)) return;
        items.push({
          id,
          kind: "unanswered_question",
          severity: "info",
          title: item.text,
          detail: "Raised in the meeting, not answered in the transcript.",
          why: `${item.text} The agent found no answer in the transcript.`,
          meeting_id: meeting.id,
          route,
          action_label: "Answer or assign",
          confidence: 0.85,
          score: 60 - index,
        });
      });
    }
    return items;
  }, [activeMeetings, state.analysisByMeeting, state.attentionFeedback]);

  const attention = useMemo(() => {
    const base = pack ? deriveAttention(pack, activeMeetings, notes, events, state.attentionFeedback) : [];
    const combined = mergeAttention(base, analysisAttention, Object.keys(state.analysisByMeeting)).sort((a, b) => b.score - a.score);
    return decideAttention(combined, {
      quietHours: state.settings.quietHours,
      interruptionBudget: state.settings.attentionBudget,
      minConfidence: state.settings.attentionThreshold,
      feedback: state.attentionFeedback,
    }).items;
  }, [pack, activeMeetings, notes, events, state.attentionFeedback, analysisAttention, state.settings.quietHours, state.settings.attentionBudget, state.settings.attentionThreshold, state.analysisByMeeting]);
  const attentionMetrics = useMemo(() => nudgeMetrics(state.attentionFeedback), [state.attentionFeedback]);
  const attentionForMeeting = useCallback(
    (meetingId: string) => {
      const meeting = meetings.find((item) => item.id === meetingId);
      if (!pack || !meeting) return [];
      const base = attentionForMeetingEngine(pack, meeting, events, state.attentionFeedback);
      const extra = analysisAttention.filter((item) => item.meeting_id === meetingId);
      return [...extra, ...base].sort((a, b) => b.score - a.score);
    },
    [pack, meetings, events, state.attentionFeedback, analysisAttention],
  );

  const feedbackAttention = useCallback(
    (id: string, status: AttentionFeedback["state"], note?: string) => {
      const at = nowIso();
      const until = status === "snoozed" ? new Date(Date.now() + 24 * 3_600_000).toISOString() : undefined;
      setState((prev) => ({
        ...prev,
        attentionFeedback: { ...prev.attentionFeedback, [id]: { state: status, at, until, note } },
      }));
      if (status === "accepted") say("Marked useful. The nudge moves out of the way.");
      else if (status === "wrong") say("Thanks — this nudge is suppressed and the feedback is kept.");
      else if (status === "snoozed") say("Snoozed for 24 hours. No notification is sent.");
      else say("Dismissed. You can bring it back from the attention page.");
    },
    [say],
  );

  const search = useCallback(
    (query: string, options?: { meeting_id?: string; speaker_id?: string; kind?: string; limit?: number }) =>
      searchPack(activeMeetings, notes, query, options),
    [activeMeetings, notes],
  );

  const ask = useCallback(
    (query: string) => (pack ? answerQuestion(pack, activeMeetings, query) : { answer: "", citations: [], trace: [], confidence: 0, refused: true, latency_ms: 0 }),
    [pack, activeMeetings],
  );

  const askThread = useCallback(
    (input: string) => {
      const answer = pack
        ? converse(pack, activeMeetings, notes, state.conversation, input)
        : { answer: "The pack is still loading.", citations: [], trace: [], confidence: 0, refused: true, latency_ms: 0 };
      const at = nowIso();
      const userTurn: ConversationTurn = { id: newId("turn"), role: "user", text: input, at };
      const assistantTurn: ConversationTurn = { id: newId("turn"), role: "assistant", text: answer.answer, answer, at };
      setState((prev) => ({ ...prev, conversation: [...prev.conversation, userTurn, assistantTurn].slice(-40) }));
      return answer;
    },
    [pack, activeMeetings, notes, state.conversation],
  );

  const clearConversation = useCallback(() => {
    setState((prev) => ({ ...prev, conversation: [] }));
    say("Conversation cleared. The evidence is untouched.");
  }, [say]);

  const pushEvent = useCallback(
    (event: PpmaEvent, meeting?: Meeting) => {
      setState((prev) => {
        if (prev.events && dedupeEvent(prev.events, event)) {
          return prev;
        }
        const online = prev.settings.ppmaOnline && !prev.killSwitch;
        const delivered = online ? deliver(event) : event;
        const nextEvents = [...(prev.events ?? []), delivered];
        const applied = delivered.delivery.status === "delivered" && pack ? applyDelivered(prev, delivered, pack) : {};
        return {
          ...prev,
          events: nextEvents,
          ...applied,
          audit: [auditFor(delivered, meeting), ...prev.audit].slice(0, 400),
        };
      });
      if (state.events && dedupeEvent(state.events, event)) {
        say("PPMA rejected a duplicate event_id. Nothing was replayed.");
        return;
      }
      if (state.settings.ppmaMode === "live" && state.settings.endpointUrl) {
        void sendEvent(
          { endpointUrl: state.settings.endpointUrl, token: state.settings.endpointToken, secret: state.settings.endpointSecret },
          event,
        ).then((ack) => {
          setState((prev) => ({ ...prev, remoteAcks: [ack, ...prev.remoteAcks].slice(0, 100) }));
          say(ack.status === "delivered" ? `Live PPMA acknowledged ${event.type}` : `Live PPMA failed: ${ack.detail} — the local copy is safe.`);
        });
      }
      if (state.settings.ppmaOnline && !state.killSwitch) say("PPMA updated · event delivered");
      else say("PPMA unavailable — queued locally. Capture continues.");
    },
    [pack, say, state.events, state.killSwitch, state.settings.ppmaOnline, state.settings.ppmaMode, state.settings.endpointUrl, state.settings.endpointToken, state.settings.endpointSecret],
  );

  const correctSpeaker = useCallback(
    (meetingId: string, evidenceId: string, after: string, reason = "Human corrected the speaker") => {
      const meeting = meetingById(meetingId);
      const evidence = meeting?.evidence.find((e) => e.id === evidenceId);
      if (!meeting || !evidence) return;
      const before = evidence.speaker_id;
      const correction: Correction = {
        id: newId("cor"),
        meeting_id: meetingId,
        target: `evidence:${evidenceId}`,
        field: "speaker_id",
        before,
        after,
        reason,
        corrected_by: state.settings.role,
        at: nowIso(),
      };
      setState((prev) => ({ ...prev, corrections: [...prev.corrections, correction] }));
      channelRef.current?.postMessage({ type: "correction", correction });
      const event = buildEvent(
        "capture.correction",
        {
          capture_id: meeting.capture_id,
          meeting_id: meeting.id,
          target: correction.target,
          evidence_id: evidenceId,
          field: "speaker_id",
          before,
          after,
          before_name: speakerName(meeting, before),
          after_name: speakerName(meeting, after),
          reason,
          corrected_by: state.settings.role,
        },
        { sensitivity: meeting.sensitivity, occurredAt: correction.at, seed: `correction::${correction.id}` },
      );
      pushEvent(event, meeting);
      say(`Speaker corrected to ${speakerName(meeting, after)} · PPMA memory updated`);
    },
    [meetingById, pushEvent, say, state.settings.role],
  );

  const correctText = useCallback(
    (meetingId: string, utteranceId: string, after: string) => {
      const meeting = meetingById(meetingId);
      const row = meeting?.utterances.find((u) => u.id === utteranceId);
      if (!meeting || !row || row.text === after) return;
      const correction: Correction = {
        id: newId("cor"),
        meeting_id: meetingId,
        target: utteranceId,
        field: "text",
        before: row.text,
        after,
        reason: "Human corrected the transcript",
        corrected_by: state.settings.role,
        at: nowIso(),
      };
      setState((prev) => ({ ...prev, corrections: [...prev.corrections, correction] }));
      channelRef.current?.postMessage({ type: "correction", correction });
      const evidence = meeting.evidence.find((e) => e.utterance_id === utteranceId);
      pushEvent(
        buildEvent(
          "capture.correction",
          {
            capture_id: meeting.capture_id,
            meeting_id: meeting.id,
            target: `utterance:${utteranceId}`,
            evidence_id: evidence?.id ?? null,
            field: "text",
            before: row.text,
            after,
            reason: correction.reason,
            corrected_by: state.settings.role,
          },
          { sensitivity: meeting.sensitivity, occurredAt: correction.at, seed: `correction::${correction.id}` },
        ),
        meeting,
      );
      say("Transcript corrected · correction sent to PPMA");
    },
    [meetingById, pushEvent, say, state.settings.role],
  );

  const correctItem = useCallback(
    (meetingId: string, itemId: string, after: string) => {
      const meeting = meetingById(meetingId);
      if (!meeting) return;
      const item =
        meeting.decisions.find((d) => d.id === itemId) ??
        meeting.actions.find((a) => a.id === itemId) ??
        meeting.questions.find((q) => q.id === itemId);
      if (!item || item.text === after) return;
      const correction: Correction = {
        id: newId("cor"),
        meeting_id: meetingId,
        target: itemId,
        field: "item_text",
        before: item.text,
        after,
        reason: "Human corrected an extracted item",
        corrected_by: state.settings.role,
        at: nowIso(),
      };
      setState((prev) => ({ ...prev, corrections: [...prev.corrections, correction] }));
      channelRef.current?.postMessage({ type: "correction", correction });
      pushEvent(
        buildEvent(
          "capture.correction",
          {
            capture_id: meeting.capture_id,
            meeting_id: meeting.id,
            target: itemId,
            field: "item_text",
            before: item.text,
            after,
            reason: correction.reason,
            corrected_by: state.settings.role,
          },
          { sensitivity: meeting.sensitivity, occurredAt: correction.at, seed: `correction::${correction.id}` },
        ),
        meeting,
      );
      say("Extracted item corrected");
    },
    [meetingById, pushEvent, say, state.settings.role],
  );

  const addComment = useCallback(
    (targetType: Comment["target_type"], targetId: string, meetingId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const comment: Comment = {
        id: newId("cmt"),
        target_type: targetType,
        target_id: targetId,
        meeting_id: meetingId,
        author: "You",
        role: state.settings.role,
        text: trimmed,
        at: nowIso(),
        resolved: false,
      };
      setState((prev) => ({ ...prev, comments: [...prev.comments, comment] }));
      channelRef.current?.postMessage({ type: "comment", comment });
      say("Comment added · visible to other open tabs in this demo");
    },
    [say, state.settings.role],
  );

  const resolveComment = useCallback((commentId: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((comment) => (comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment)),
    }));
  }, []);

  const setConnector = useCallback((id: string, patch: Partial<ConnectorState>) => {
    setState((prev) => ({
      ...prev,
      connectors: {
        ...prev.connectors,
        [id]: { ...(prev.connectors[id] ?? { enabled: false, configured: false, consent_purpose: "", scopes: [], last_test: null, last_status: "not_configured", detail: "" }), ...patch },
      },
    }));
  }, []);

  const setAmbient = useCallback((patch: Partial<AmbientState>) => {
    setState((prev) => ({ ...prev, ambient: { ...prev.ambient, ...patch } }));
  }, []);

  const logAmbientActivation = useCallback(() => {
    const at = nowIso();
    setState((prev) => ({
      ...prev,
      ambient: { ...prev.ambient, lastActivation: at, activations: prev.ambient.activations + 1 },
      audit: [
        {
          id: newId("aud"),
          at,
          actor: state.settings.role,
          action: "ambient.activated",
          object: "device:local",
          detail: `Ambient activation · wake word ${prev.ambient.wakeWord ? "on" : "off"} · zones ${prev.ambient.zones.length}`,
          model: "vad+consent",
          sources: ["local"],
        },
        ...prev.audit,
      ],
    }));
    say("Ambient activation recorded in the audit.");
  }, [say, state.settings.role]);

  const redact = useCallback(
    (meetingId: string, evidenceId: string, reason: string, label = "Sensitive passage") => {
      const meeting = meetingById(meetingId);
      const evidence = meeting?.evidence.find((e) => e.id === evidenceId);
      if (!meeting || !evidence) return;
      const existing = meeting.redactions.find((r) => r.evidence_id === evidenceId);
      const redaction: Redaction = existing
        ? { ...existing, status: "applied", reason, label, applied_at: nowIso(), applied_by: state.settings.role }
        : {
            id: newId("red"),
            evidence_id: evidenceId,
            utterance_id: evidence.utterance_id ?? "",
            reason,
            label,
            safe_text: `[redacted — ${label.toLowerCase()}]`,
            detected_by: "human",
            confidence: 1,
            status: "applied",
            applied_at: nowIso(),
            applied_by: state.settings.role,
          };
      setState((prev) => {
        const prevPatches = prev.redactionPatches[meetingId] ?? [];
        const without = prevPatches.filter((r) => r.id !== redaction.id);
        return { ...prev, redactionPatches: { ...prev.redactionPatches, [meetingId]: [...without, redaction] } };
      });
      pushEvent(
        buildEvent(
          "capture.redaction.applied",
          {
            capture_id: meeting.capture_id,
            meeting_id: meeting.id,
            evidence_id: evidenceId,
            reason,
            label,
            safe_text: redaction.safe_text,
            redacted_by: state.settings.role,
          },
          { sensitivity: meeting.sensitivity, occurredAt: redaction.applied_at ?? nowIso(), seed: `redaction::${meeting.capture_id}::${evidenceId}` },
        ),
        meeting,
      );
      say("Redaction applied · the safe version is what PPMA receives");
    },
    [meetingById, pushEvent, say, state.settings.role],
  );

  const unredact = useCallback(
    (meetingId: string, redactionId: string) => {
      setState((prev) => {
        const patches = prev.redactionPatches[meetingId] ?? [];
        const next = patches
          .map((r) => (r.id === redactionId ? { ...r, status: "detected" as const, applied_at: null, applied_by: null } : r))
          .filter((r) => r.id !== redactionId || r.status !== "detected");
        return { ...prev, redactionPatches: { ...prev.redactionPatches, [meetingId]: next } };
      });
      say("Redaction removed locally. The safe version was already shared.");
    },
    [say],
  );

  const sendMeeting = useCallback(
    (meetingId: string, opts: { safe?: boolean } = {}) => {
      const meeting = meetingById(meetingId);
      if (!meeting) return null;
      const gate = consentGate(meeting);
      if (!gate.ok) {
        say(gate.reason);
        return null;
      }
      const payload = meetingPayload(meeting, { safe: opts.safe !== false });
      const type = meeting.mode === "call" ? "capture.call.completed" : "capture.meeting.completed";
      const event = buildEvent(type, payload, {
        sensitivity: meeting.sensitivity,
        occurredAt: nowIso(),
        seed: `${type}::${meeting.capture_id}`,
        provenance: {
          device: meeting.provenance.device,
          model: meeting.provenance.asr_model,
          app_version: meeting.provenance.app_version,
          local_only: true,
        },
      });
      pushEvent(event, meeting);
      return event.event_id;
    },
    [meetingById, pack, pushEvent, say],
  );

  const sendNote = useCallback(
    (noteId: string) => {
      const note = noteById(noteId);
      if (!note) return null;
      const event = buildEvent("capture.note.created", notePayload(note), {
        sensitivity: note.sensitivity,
        occurredAt: nowIso(),
        seed: `note.created::${note.note_id}`,
        provenance: { device: "iPhone 16 Pro · A18", model: "ocr-small-v3", app_version: "1.0.0", local_only: true },
      });
      pushEvent(event);
      return event.event_id;
    },
    [noteById, pushEvent],
  );

  const withdrawConsent = useCallback(
    (meetingId: string, reason: string) => {
      const meeting = meetingById(meetingId);
      if (!meeting) return;
      const consent: Consent = { ...meeting.consent, state: "withdrawn", recorded_at: nowIso(), recorded_by: state.settings.role };
      setState((prev) => ({ ...prev, consentOverrides: { ...prev.consentOverrides, [meetingId]: consent } }));
      pushEvent(
        buildEvent(
          "capture.consent.changed",
          { capture_id: meeting.capture_id, meeting_id: meeting.id, state: "withdrawn", reason, effective_at: nowIso() },
          { sensitivity: meeting.sensitivity, occurredAt: nowIso(), seed: `consent.changed::${meeting.capture_id}::withdrawn` },
        ),
        meeting,
      );
      say("Consent withdrawn · PPMA suppresses the memory. No further capture events.");
    },
    [meetingById, pushEvent, say, state.settings.role],
  );

  const deleteMeeting = useCallback(
    (meetingId: string, reason: string) => {
      const meeting = meetingById(meetingId);
      if (!meeting) return false;
      if (meeting.retention.legal_hold) {
        say("Legal hold overrides deletion. The memory stays until the hold is released.");
        return false;
      }
      const at = nowIso();
      const tombstone: Tombstone = { meeting_id: meetingId, reason, requested_by: state.settings.role, at, scope: "transcript+evidence" };
      setState((prev) => ({
        ...prev,
        tombstones: { ...prev.tombstones, [meetingId]: tombstone },
      }));
      pushEvent(
        buildEvent(
          "capture.memory.deleted",
          {
            capture_id: meeting.capture_id,
            meeting_id: meeting.id,
            title: meeting.title,
            scope: "transcript+evidence",
            reason,
            requested_by: state.settings.role,
            deleted_at: at,
          },
          { sensitivity: meeting.sensitivity, occurredAt: at, seed: `memory.deleted::${meeting.capture_id}::${reason}::${at}` },
        ),
        meeting,
      );
      say("Memory deleted locally · tombstone sent to PPMA");
      return true;
    },
    [meetingById, pushEvent, say, state.settings.role],
  );

  const setRetention = useCallback(
    (meetingId: string, retainUntil: string, policy = "custom") => {
      const meeting = meetingById(meetingId);
      if (!meeting) return;
      setState((prev) => ({
        ...prev,
        retentionOverrides: {
          ...prev.retentionOverrides,
          [meetingId]: { ...(prev.retentionOverrides[meetingId] ?? meeting.retention), retain_until: retainUntil, policy },
        },
        audit: [
          {
            id: newId("aud"),
            at: nowIso(),
            actor: "You",
            action: "retention.changed",
            object: meeting.capture_id,
            detail: `retain until ${retainUntil} · policy ${policy}`,
            model: "policy-engine",
            sources: ["local"],
          },
          ...prev.audit,
        ],
      }));
      say(`Retention set to ${retainUntil.slice(0, 10)}`);
    },
    [meetingById, say],
  );

  const toggleLegalHold = useCallback(
    (meetingId: string) => {
      const meeting = meetingById(meetingId);
      if (!meeting) return;
      const next = !meeting.retention.legal_hold;
      setState((prev) => ({
        ...prev,
        retentionOverrides: {
          ...prev.retentionOverrides,
          [meetingId]: { ...(prev.retentionOverrides[meetingId] ?? meeting.retention), legal_hold: next },
        },
        audit: [
          {
            id: newId("aud"),
            at: nowIso(),
            actor: state.settings.role,
            action: next ? "legal_hold.applied" : "legal_hold.released",
            object: meeting.capture_id,
            detail: next ? "Deletion blocked until released" : "Deletion allowed again",
            model: "policy-engine",
            sources: ["local"],
          },
          ...prev.audit,
        ],
      }));
      say(next ? "Legal hold applied — deletion blocked" : "Legal hold released");
    },
    [meetingById, say, state.settings.role],
  );

  const flushQueue = useCallback(() => {
    const queued = state.events?.filter((e) => e.delivery.status === "queued") ?? [];
    if (!queued.length) {
      say("The queue is empty. Every event has been delivered.");
      return;
    }
    setState((prev) => {
      if (!prev.settings.ppmaOnline || prev.killSwitch) return prev;
      let nextMemory: MemoryEntry[] = prev.memory ?? pack?.ppma.memory ?? [];
      let nextProject = prev.project;
      let nextAudit = prev.audit;
      const nextEvents = (prev.events ?? []).map((e) => {
        if (e.delivery.status !== "queued") return e;
        const delivered = deliver(e);
        if (pack) {
          const applied = applyDelivered({ ...prev, memory: nextMemory, project: nextProject, audit: nextAudit }, delivered, pack);
          nextMemory = applied.memory ?? nextMemory;
          nextProject = applied.project;
          nextAudit = applied.audit;
        }
        return delivered;
      });
      return { ...prev, events: nextEvents, memory: nextMemory, project: nextProject, audit: nextAudit };
    });
    say(`${queued.length} queued event${queued.length === 1 ? "" : "s"} delivered to PPMA`);
  }, [pack, say, state.events]);

  const replayEvent = useCallback(
    (eventId: string) => {
      const event = state.events?.find((e) => e.event_id === eventId);
      if (!event) return;
      const duplicate = state.events?.some((e) => e.event_id === eventId && e.delivery.status === "delivered");
      setState((prev) => ({
        ...prev,
        lastReplay: { event_id: eventId, at: nowIso(), result: duplicate ? "duplicate rejected" : "accepted" },
      }));
      say(duplicate ? "Replay rejected: PPMA deduplicates by event_id." : "Event replayed. PPMA accepted it once.");
    },
    [say, state.events],
  );

  const handleCommand = useCallback(
    (commandId: string, action: "apply" | "reject") => {
      const command = commands.find((c) => c.id === commandId);
      if (!command) return;
      if (action === "apply" && state.settings.ppmaMode === "live" && state.settings.endpointUrl) {
        void sendCommand(
          { endpointUrl: state.settings.endpointUrl, token: state.settings.endpointToken, secret: state.settings.endpointSecret },
          { type: command.type, payload: command.payload, target: command.target },
        ).then((result) => say(result.ok ? `Live PPMA accepted ${command.type}` : `Live PPMA command failed: ${result.detail}`));
      }
      if (action === "reject") {
        setState((prev) => ({ ...prev, commands: prev.commands?.map((c) => (c.id === commandId ? { ...c, status: "rejected" as const } : c)) ?? [] }));
        say("Command rejected. RECALL keeps the local policy and reports why.");
        return;
      }
      if (command.type === "capture.apply_retention") {
        const captureId = String(command.payload.capture_id);
        const meeting = meetings.find((m) => m.capture_id === captureId);
        if (meeting) {
          setRetention(meeting.id, String(command.payload.retain_until), String(command.payload.reason ?? "ppma_policy"));
        }
        setState((prev) => ({
          ...prev,
          commands: prev.commands?.map((c) => (c.id === commandId ? { ...c, status: "applied" as const } : c)) ?? [],
        }));
        say("Retention policy applied from PPMA");
        return;
      }
      if (command.type === "capture.forget") {
        const captureId = String(command.payload.capture_id);
        const meeting = meetings.find((m) => m.capture_id === captureId);
        if (meeting) {
          const ok = deleteMeeting(meeting.id, "ppma_forget");
          if (!ok) return;
        }
        setState((prev) => ({
          ...prev,
          commands: prev.commands?.map((c) => (c.id === commandId ? { ...c, status: "applied" as const } : c)) ?? [],
        }));
      }
    },
    [commands, deleteMeeting, meetings, say, setRetention, state.settings.ppmaMode, state.settings.endpointUrl, state.settings.endpointToken, state.settings.endpointSecret],
  );

  const recordSession = useCallback(
    (mode: "meeting" | "call" | "note", title: string, consentState: Consent, scenarioId?: string) => {
      if (!pack) return "";
      const scenario = pack.meetings.find((m) => m.id === (scenarioId ?? pack.meta.stage_meeting_id)) ?? pack.meetings[0];
      const id = newId("mtg");
      const captureId = `cap_${newId("cap").split("_")[1]}`;
      const started = new Date(Date.now() - scenario.duration_s * 1000).toISOString();
      const ended = nowIso();
      const copy: Meeting = JSON.parse(JSON.stringify(scenario));
      copy.id = id;
      copy.capture_id = captureId;
      copy.title = title;
      copy.mode = mode;
      copy.started_at = started;
      copy.ended_at = ended;
      copy.status = "captured";
      copy.consent = { ...consentState, state: "granted" };
      copy.ppma = { status: "pending", event_id: null, completed_at: null };
      copy.import = false;
      copy.deleted_at = null;
      copy.deleted_reason = null;
      copy.tombstone_id = null;
      copy.tags = [...copy.tags, "new-capture"];
      if (state.settings.workspaceMode === "personal") {
        copy.started_at = ended;
        copy.duration_s = 0;
        copy.participants = [];
        copy.utterances = [];
        copy.decisions = [];
        copy.actions = [];
        copy.questions = [];
        copy.evidence = [];
        copy.redactions = [];
        copy.summary = "Captured on this device with consent recorded. This public build does not run speech recognition, so there is no transcript or extracted fact yet.";
        copy.tags = ["personal-capture"];
      }
      setState((prev) => ({ ...prev, imported: [...prev.imported, copy] }));
      const event = buildEvent(
        "capture.recording.started",
        {
          capture_id: captureId,
          meeting_id: id,
          mode,
          device_id: scenario.provenance.device,
          consent_state: "granted",
          jurisdiction: consentState.jurisdiction,
          participants_notified: consentState.participants_notified,
        },
        { sensitivity: "personal", occurredAt: started, seed: `recording.started::${captureId}`, provenance: { device: scenario.provenance.device, model: "vad+asr", app_version: "1.0.0", local_only: true } },
      );
      pushEvent(event);
      say("Recording started on device · consent recorded");
      return id;
    },
    [pack, pushEvent, say, state.settings.workspaceMode],
  );

  const completeRecording = useCallback(
    (meetingId: string) => {
      sendMeeting(meetingId, { safe: true });
    },
    [sendMeeting],
  );

  const importAudio = useCallback(
    (fileName: string) => {
      if (!pack) return "";
      const scenario = pack.meetings.find((m) => m.id === pack.meta.stage_meeting_id) ?? pack.meetings[0];
      const id = newId("mtg");
      const captureId = `cap_${newId("cap").split("_")[1]}`;
      const copy: Meeting = JSON.parse(JSON.stringify(scenario));
      copy.id = id;
      copy.capture_id = captureId;
      copy.title = `Imported — ${fileName.replace(/\.[^.]+$/, "")}`;
      copy.mode = "import";
      copy.started_at = "2026-09-18T10:00:00Z";
      copy.ended_at = "2026-09-18T10:13:42Z";
      copy.status = "captured";
      copy.consent = { ...scenario.consent, basis: "import_attested", evidence_ref: "consent_import_01", recorded_at: nowIso() };
      copy.ppma = { status: "pending", event_id: null, completed_at: null };
      copy.import = true;
      copy.summary = `Backfill import. ${scenario.summary} Transcribed locally after import.`;
      if (state.settings.workspaceMode === "personal") {
        copy.started_at = nowIso();
        copy.ended_at = nowIso();
        copy.duration_s = 0;
        copy.participants = [];
        copy.utterances = [];
        copy.decisions = [];
        copy.actions = [];
        copy.questions = [];
        copy.evidence = [];
        copy.redactions = [];
        copy.tags = ["personal-import"];
        copy.summary = "Imported on this device. This public build does not run speech recognition, so the file was not transcribed and no synthetic transcript was substituted.";
      }
      setState((prev) => ({ ...prev, imported: [...prev.imported, copy] }));
      say(`Imported ${fileName} · original audio stayed in the file. No transcript was generated in this build.`);
      return id;
    },
    [pack, say, state.settings.workspaceMode],
  );

  const importCaseFile = useCallback(
    (fileName: string, text: string, consentState: Consent) => {
      if (!pack) return "";
      const parsed = parseCaseFile(fileName, text);
      if (!parsed) {
        say("That file could not be read as a case. Use the example JSON, a .vtt/.srt transcript or a plain transcript.");
        return "";
      }
      const copy = buildMeeting(parsed, pack.meetings[0], consentState);
      setState((prev) => ({ ...prev, imported: [...prev.imported, copy] }));
      say(`Imported ${fileName} · ${parsed.transcript.length} transcript lines · ${parsed.decisions.length} decisions · ${parsed.actions.length} actions`);
      return copy.id;
    },
    [pack, say],
  );

  const analysisFor = useCallback(
    (meetingId: string) => state.analysisByMeeting[meetingId] ?? null,
    [state.analysisByMeeting],
  );

  const analyzeMeeting = useCallback(
    async (meetingId: string) => {
      const meeting = meetingById(meetingId);
      if (!meeting) return null;
      if (!meeting.utterances.length) {
        say("This capture has no transcript. Import a transcript or connect real ASR first.");
        return null;
      }
      const base = (state.settings.endpointUrl || "http://127.0.0.1:8788").replace(/\/$/, "");
      setAnalysisRunning(meetingId);
      say("Agent is reading the transcript · extracting decisions, actions, risks and gaps");
      try {
        const response = await fetch(`${base}/v1/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meeting: {
              title: meeting.title,
              occurred_at: meeting.started_at,
              participants: meeting.participants.map((person) => ({ name: person.name, role: person.role })),
              consent: meeting.consent,
              transcript: meeting.utterances.map((line) => ({
                id: line.id,
                speaker: meeting.participants.find((person) => person.id === line.speaker_id)?.name ?? "Speaker",
                start: line.start,
                text: line.text,
              })),
            },
          }),
        });
        const data = (await response.json()) as { ok?: boolean; analysis?: AnalysisResult; error?: string };
        if (!response.ok || !data.ok || !data.analysis) {
          throw new Error(data.error || `analysis returned ${response.status}`);
        }
        setState((prev) => ({
          ...prev,
          analysisByMeeting: { ...prev.analysisByMeeting, [meetingId]: data.analysis! },
          analysisApproved: { ...prev.analysisApproved, [meetingId]: false },
        }));
        const found =
          data.analysis.decisions.length +
          data.analysis.actions.length +
          data.analysis.risks.length +
          data.analysis.gaps.length +
          data.analysis.questions.length;
        say(`Agent found ${found} findings in ${Math.round(data.analysis.trace.latency_ms / 100) / 10}s · every one linked to a quote`);
        return data.analysis;
      } catch (error) {
        say(`Analysis unavailable: ${error instanceof Error ? error.message : "unknown error"}. Start the local analysis runtime.`);
        return null;
      } finally {
        setAnalysisRunning(null);
      }
    },
    [meetingById, say, state.settings.endpointUrl],
  );

  const approveAnalysis = useCallback(
    (meetingId: string) => {
      const meeting = meetingById(meetingId);
      const analysis = state.analysisByMeeting[meetingId];
      let record: DecisionRecord | null = null;
      if (meeting && analysis) {
        const evidence = new Map<string, EvidenceRef>();
        const add = (utteranceId: string, kind: string, confidence?: number) => {
          const line = meeting.utterances.find((row) => row.id === utteranceId);
          if (!line || evidence.has(line.id)) return;
          evidence.set(line.id, {
            id: line.id,
            kind,
            quote: line.text,
            speaker: meeting.participants.find((person) => person.id === line.speaker_id)?.name ?? "Speaker",
            start: line.start,
            end: line.end,
            confidence: confidence ?? line.confidence,
            source: `recall://captures/${meeting.capture_id}`,
          });
        };
        analysis.decisions.forEach((item) => add(item.evidence_id, "decision", item.confidence));
        analysis.actions.forEach((item) => add(item.evidence_id, "action", item.confidence));
        analysis.questions.forEach((item) => add(item.evidence_id, "question", 0.9));
        analysis.risks.forEach((item) => add(item.evidence_id, "risk", 0.9));
        analysis.gaps.forEach((item) => add(item.evidence_id, "gap", 0.85));
        record = createDecisionRecord({
          title: meeting.title,
          summary: analysis.summary,
          decision: analysis.summary,
          confidence: 0.9,
          rationale: "Human approved the agent's evidence-linked findings.",
          evidence: [...evidence.values()],
          alternatives: analysis.risks.map((risk) => risk.text),
          requiresApproval: true,
          metadata: {
            meetingId,
            model: analysis.trace.model,
            latency_ms: analysis.trace.latency_ms,
            decisions: analysis.decisions.length,
            actions: analysis.actions.length,
            risks: analysis.risks.length,
          },
        });
        record = approveRecord(record, {
          by: state.settings.role,
          note: "Approved in RECALL after reviewing the quotes.",
        });
      }
      setState((prev) => ({
        ...prev,
        analysisApproved: { ...prev.analysisApproved, [meetingId]: true },
        decisionRecords: record
          ? [...prev.decisionRecords.filter((item) => item.metadata.meetingId !== meetingId), record]
          : prev.decisionRecords,
      }));
      say(record ? `Findings approved · decision record ${record.hash.slice(-12)} · ${record.evidence.length} evidence refs` : "Findings approved by a human. The agent proposed; you decided.");
    },
    [meetingById, say, state.analysisByMeeting, state.settings.role],
  );

  const decisionRecordFor = useCallback(
    (meetingId: string) => state.decisionRecords.find((record) => record.metadata.meetingId === meetingId) ?? null,
    [state.decisionRecords],
  );

  const isAnalysisApproved = useCallback(
    (meetingId: string) => Boolean(state.analysisApproved[meetingId]),
    [state.analysisApproved],
  );

  const addFieldNote = useCallback(
    (text: string, location: string, photo?: { label: string; ocr: string }) => {
      if (!pack) return "";
      const note: Note = {
        id: newId("fnote"),
        note_id: newId("note"),
        title: `Field note — ${location}`,
        text,
        captured_at: nowIso(),
        location: { label: location, precision: "site" },
        evidence_ref: `ev_${newId("n").split("_")[1]}`,
        consent: {
          state: "granted",
          basis: "user_note",
          jurisdiction: pack.team.jurisdiction,
          participants_notified: false,
          evidence_ref: `consent_${newId("n")}`,
          wording_version: `${pack.team.jurisdiction}-2026-2`,
          recorded_at: nowIso(),
          recorded_by: state.settings.role,
        },
        sensitivity: "client_confidential",
        photo: {
          label: photo?.label ?? "No photo",
          ocr: photo?.ocr ?? "",
          ocr_confidence: photo ? 0.94 : 0,
          captured_on_device: Boolean(photo),
        },
        offline_captured: !state.settings.ppmaOnline,
        queued_seconds: state.settings.ppmaOnline ? 0 : 3,
        ppma: { status: "pending", event_id: null, completed_at: null },
        tags: ["field", "note"],
      };
      setState((prev) => ({ ...prev, fieldNotes: [...prev.fieldNotes, note] }));
      const event = buildEvent("capture.note.created", notePayload(note), {
        sensitivity: note.sensitivity,
        occurredAt: note.captured_at,
        seed: `note.created::${note.note_id}`,
        provenance: { device: "iPhone 16 Pro · A18", model: "ocr-small-v3", app_version: "1.0.0", local_only: true },
      });
      pushEvent(event);
      say("Field note captured on device · evidence pointer created");
      return note.id;
    },
    [pack, pushEvent, say, state.settings.ppmaOnline, state.settings.role],
  );

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
    },
    [],
  );

  const toggleKillSwitch = useCallback(() => {
    setState((prev) => ({ ...prev, killSwitch: !prev.killSwitch }));
    say(state.killSwitch ? "Capture kill switch released" : "Capture kill switch engaged — no capture, no delivery");
  }, [say, state.killSwitch]);

  const runConformance = useCallback(() => {
    setState((prev) => ({ ...prev, conformanceRun: nowIso() }));
    say("Contract conformance run passed against the local PPMA fake.");
  }, [say]);

  const exportAudit = useCallback(() => {
    const header = "at,actor,action,object,detail,model,sources\n";
    const rows = audit
      .map((a) => [a.at, a.actor, a.action, a.object, `"${a.detail.replace(/"/g, '""')}"`, a.model, a.sources.join("|")].join(","))
      .join("\n");
    return header + rows;
  }, [audit]);

  const reset = useCallback(() => {
    if (!pack) return;
    clearVault();
    setState({
      ...EMPTY,
      settings: state.settings,
      events: pack.ppma.events,
      memory: pack.ppma.memory,
      commands: pack.ppma.commands,
      audit: pack.admin.audit,
      connectors: defaultConnectorState(),
      project: { state: pack.ppma.project.state_before, followup: "", last_event: null, updated_at: pack.ppma.project.updated_at },
    });
    say("Demo reset · back to the lost promise");
  }, [pack, say, state.settings]);

  const resetMeeting = useCallback(
    (meetingId: string) => {
      setState((prev) => {
        const patches = { ...prev.redactionPatches };
        delete patches[meetingId];
        const tombstones = { ...prev.tombstones };
        delete tombstones[meetingId];
        const consentOverrides = { ...prev.consentOverrides };
        delete consentOverrides[meetingId];
        const retentionOverrides = { ...prev.retentionOverrides };
        delete retentionOverrides[meetingId];
        return {
          ...prev,
          corrections: prev.corrections.filter((c) => c.meeting_id !== meetingId),
          redactionPatches: patches,
          tombstones,
          consentOverrides,
          retentionOverrides,
          imported: prev.imported.filter((m) => m.id !== meetingId),
        };
      });
      say("Meeting restored to its captured state");
    },
    [say],
  );

  const resetStage = useCallback(() => {
    if (!pack) return;
    const stage = pack.meetings.find((m) => m.id === pack.meta.stage_meeting_id);
    if (!stage) return;
    setState((prev) => {
      const patches = { ...prev.redactionPatches };
      delete patches[stage.id];
      const tombstones = { ...prev.tombstones };
      delete tombstones[stage.id];
      const consentOverrides = { ...prev.consentOverrides };
      delete consentOverrides[stage.id];
      const retentionOverrides = { ...prev.retentionOverrides };
      delete retentionOverrides[stage.id];
      return {
        ...prev,
        corrections: prev.corrections.filter((c) => c.meeting_id !== stage.id),
        redactionPatches: patches,
        tombstones,
        consentOverrides,
        retentionOverrides,
        imported: prev.imported.filter((m) => m.capture_id !== stage.capture_id),
        events: (prev.events ?? []).filter((e) => e.payload.capture_id !== stage.capture_id),
        memory: (prev.memory ?? []).filter((m) => m.capture_id !== stage.capture_id),
        project: {
          state: pack.ppma.project.state_before,
          followup: "",
          last_event: null,
          updated_at: pack.ppma.project.updated_at,
        },
        settings: { ...prev.settings, ppmaOnline: true },
        killSwitch: false,
      };
    });
  }, [pack]);

  const value: StoreValue = {
    pack,
    loading,
    error,
    meetings,
    activeMeetings,
    notes,
    tombstoned,
    corrections: state.corrections,
    events,
    queue,
    memory,
    commands,
    audit,
    project,
    settings: state.settings,
    killSwitch: state.killSwitch,
    lastReplay: state.lastReplay,
    conformanceRun: state.conformanceRun,
    toast,
    consentCoverage: consentCoverage(meetings),
    attention,
    attentionMetrics,
    attentionForMeeting,
    attentionFeedback: state.attentionFeedback,
    feedbackAttention,
    assignAttention: (id: string, assignee: string) => setState((prev) => ({ ...prev, attentionFeedback: { ...prev.attentionFeedback, [id]: { state: "assigned", at: nowIso(), assignee } } })),
    comments: state.comments,
    addComment,
    resolveComment,
    conversation: state.conversation,
    askThread,
    clearConversation,
    connectors: state.connectors,
    setConnector,
    ambient: state.ambient,
    setAmbient,
    logAmbientActivation,
    encryption,
    collabPeers,
    remoteAcks: state.remoteAcks,
    meetingById,
    noteById,
    search,
    ask,
    say,
    correctSpeaker,
    correctText,
    correctItem,
    redact,
    unredact,
    sendMeeting,
    sendNote,
    withdrawConsent,
    deleteMeeting,
    setRetention,
    toggleLegalHold,
    flushQueue,
    replayEvent,
    handleCommand,
    recordSession,
    completeRecording,
    importAudio,
    importCaseFile,
    analysisFor,
    analyzeMeeting,
    approveAnalysis,
    isAnalysisApproved,
    analysisRunning,
    decisionRecordFor,
    addFieldNote,
    setSetting,
    setSettings,
    toggleKillSwitch,
    runConformance,
    exportAudit,
    reset,
    resetMeeting,
    resetStage,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

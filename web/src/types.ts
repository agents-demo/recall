export type Sensitivity = "personal" | "client_confidential" | "financial" | "health" | "legal";
export type ConsentState = "granted" | "withdrawn" | "pending";
export type Role = "individual" | "team_lead" | "privacy_legal" | "field" | "admin";
export type Theme = "dark" | "paper" | "contrast";
export type Lang = "en" | "zh";

export interface Participant {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

export interface Consent {
  state: ConsentState;
  basis: string;
  jurisdiction: string;
  participants_notified: boolean;
  evidence_ref: string;
  wording_version: string;
  recorded_at: string;
  recorded_by: string;
}

export interface Utterance {
  id: string;
  speaker_id: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  attribution_hint?: string;
  redacted_by?: string | null;
  edited?: boolean;
}

export type EvidenceKind = "promise" | "decision" | "action" | "question" | "note";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  quote: string;
  speaker_id: string;
  start: number;
  end: number;
  confidence: number;
  attribution_confidence: number;
  utterance_id: string | null;
  sensitivity: Sensitivity;
  redaction_id?: string | null;
}

export interface Redaction {
  id: string;
  evidence_id: string;
  utterance_id: string;
  reason: string;
  label: string;
  safe_text: string;
  detected_by: string;
  confidence: number;
  status: "detected" | "applied";
  applied_at: string | null;
  applied_by: string | null;
}

export interface Decision {
  id: string;
  text: string;
  evidence_id: string;
  confidence: number;
  status: string;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  due: string;
  evidence_id: string;
  confidence: number;
  status: string;
}

export interface Question {
  id: string;
  text: string;
  evidence_id: string;
  confidence: number;
  status: string;
}

export interface Retention {
  retain_until: string;
  policy: string;
  legal_hold: boolean;
}

export interface Provenance {
  device: string;
  npu: string;
  asr_model: string;
  diarization_model: string;
  vad_model: string;
  redaction_model: string;
  app_version: string;
  language: string;
  audio_sha256: string;
  local_only: boolean;
  encrypted_at_rest: string;
  retention: string;
  network: string;
}

export interface Meeting {
  id: string;
  capture_id: string;
  title: string;
  mode: "meeting" | "call" | "note" | "import";
  started_at: string;
  ended_at: string;
  duration_s: number;
  language: string;
  jurisdiction: string;
  sensitivity: Sensitivity;
  status: "captured" | "sent" | "queued" | "tombstoned";
  participants: Participant[];
  consent: Consent;
  summary: string;
  utterances: Utterance[];
  decisions: Decision[];
  actions: ActionItem[];
  questions: Question[];
  evidence: Evidence[];
  redactions: Redaction[];
  provenance: Provenance;
  retention: Retention;
  tags: string[];
  baseline_lookup_min: number;
  ppma: { status: string; event_id: string | null; completed_at: string | null };
  import: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  tombstone_id?: string | null;
}

export interface Note {
  id: string;
  note_id: string;
  title: string;
  text: string;
  captured_at: string;
  location: { label: string; precision: string; lat?: number; lon?: number };
  evidence_ref: string;
  consent: Consent;
  sensitivity: Sensitivity;
  photo: { label: string; ocr: string; ocr_confidence: number; captured_on_device: boolean };
  offline_captured: boolean;
  queued_seconds: number;
  ppma: { status: string; event_id: string | null; completed_at: string | null };
  tags: string[];
}

export interface DeliveryState {
  status: "delivered" | "queued" | "failed" | "duplicate" | "rejected";
  attempts: number;
  delivered_at: string | null;
  duplicate: boolean;
  latency_ms: number | null;
}

export interface PpmaEvent {
  event_id: string;
  app_id: string;
  space: string;
  occurred_at: string;
  type: string;
  sensitivity: Sensitivity;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
  delivery: DeliveryState;
  note?: string;
  assignee?: string;
}

export interface PpmaCommand {
  id: string;
  kind: "command";
  target: string;
  type: "capture.forget" | "capture.apply_retention";
  received_at: string;
  payload: Record<string, unknown>;
  status: "pending" | "applied" | "rejected";
  note: string;
}

export interface MemoryEntry {
  id: string;
  capture_id: string;
  meeting_id: string;
  type: "decision" | "action" | "question" | "promise" | "note" | "summary";
  text: string;
  speaker_id: string | null;
  evidence_id: string;
  confidence: number;
  sensitivity: Sensitivity;
  consent: string;
  redacted: boolean;
  source: "RECALL";
  created_at: string;
  state: "active" | "retired" | "suppressed";
  corrected?: string | null;
}

export interface EventTypeDef {
  type: string;
  sensitivity: string;
  resource: string;
  description: string;
}

export interface ConformanceCheck {
  id: string;
  label: string;
  status: "pass" | "watch" | "fail";
  detail: string;
}

export interface PpmaPack {
  manifest: {
    app_id: string;
    display_name: string;
    version: string;
    contract: string;
    direction: string;
    event_prefix: string;
    default_sensitivity: string;
    last_validated: string;
    resources: string;
    auth: string;
    events: EventTypeDef[];
    commands: { type: string; direction: string; description: string }[];
    deprecation: { window: string; migration: string };
  };
  project: {
    id: string;
    name: string;
    space: string;
    owner: string;
    state_before: string;
    state_after: string;
    followup_draft: string;
    link: string;
    proposed_action: string;
    approval_required: boolean;
    updated_at: string;
  };
  memory: MemoryEntry[];
  events: PpmaEvent[];
  queue: PpmaEvent[];
  commands: PpmaCommand[];
  limits: { per_team_per_minute: number; per_team_per_day: number; used_today: number; backpressure: string; dead_letter_after: number };
  credentials: { team: string; device: string; token_hint: string; created: string; rotated: string; status: string }[];
  conformance: ConformanceCheck[];
}

export interface PilotPack {
  baseline_min: number;
  quote_seconds: number;
  target_quote_seconds: number;
  capture_to_ppma_s: number;
  target_capture_to_ppma_s: number;
  useful_rate: number;
  quote_success: number;
  consent_coverage: number;
  redaction_precision: number;
  redaction_recall: number;
  deletion_propagation_syncs: number;
  action_conversion: number;
  weekly: { week: string; capture_to_ppma_s: number; useful_rate: number; quotes: number; actions: number; deletions: number }[];
  funnel: { stage: string; count: number }[];
  extraction: { kind: string; precision: number; recall: number; useful: number }[];
  gates: { id: string; label: string; target: string; actual: string; status: "pass" | "watch" | "fail" }[];
  notes: string[];
}

export interface TeamPack {
  id: string;
  name: string;
  space: string;
  plan: string;
  seats: number;
  jurisdiction: string;
  retention_days: number;
  consent_model: string;
  members: { id: string; name: string; role: Role; initials: string; email: string }[];
  devices: {
    id: string;
    name: string;
    kind: string;
    owner: string;
    status: string;
    last_seen: string;
    app_version: string;
    npu: string;
    storage_used_pct: number;
    battery_pct: number | null;
    mic: string;
  }[];
}

export interface AdminPack {
  spaces: { id: string; name: string; members: number; role: string; visibility: string; retention: string; status: string }[];
  roles: { role: string; can: string; cannot: string }[];
  sso: { provider: string; status: string; enforcement: string; scim: string; groups: string[] };
  residency: { primary: string; backup: string; media: string; note: string };
  compliance: { id: string; name: string; standard: string; status: string; controls: number; covered: number; detail: string }[];
  jurisdictions: { code: string; name: string; model: string; wording: string; status: string }[];
  billing: {
    plan: string;
    seats: number;
    per_seat_eur_month: number;
    bundle_discount_pct: number;
    enterprise_addon_eur_month: number;
    field_addon_eur_month: number;
    npu_included: boolean;
    mrr_eur: number;
    next_invoice: string;
    invoices: { id: string; date: string; amount_eur: number; status: string }[];
    metering: string;
  };
  model_cards: {
    id: string;
    name: string;
    version: string;
    kind: string;
    inputs: string;
    limits: string;
    failure_modes: string;
    owner: string;
    last_validated: string;
    status: string;
    metric: string;
  }[];
  health: {
    status: string;
    last_scan: string;
    metrics: Record<string, number>;
    drift: { model: string; status: string; delta: string; detail: string }[];
    incidents: { id: string; at: string; kind: string; severity: string; title: string; status: string; detail: string }[];
    kill_switch: boolean;
  };
  audit: {
    id: string;
    at: string;
    actor: string;
    action: string;
    object: string;
    detail: string;
    model: string;
    sources: string[];
  }[];
}

export interface Pack {
  meta: {
    version: string;
    generated: string;
    anchor: string;
    seed: number;
    product: string;
    app_id: string;
    model: string;
    note: string;
    stage_meeting_id: string;
    scenario_ids: string[];
  };
  team: TeamPack;
  meetings: Meeting[];
  notes: Note[];
  ppma: PpmaPack;
  pilot: PilotPack;
  admin: AdminPack;
}

export interface Correction {
  id: string;
  meeting_id: string;
  target: string;
  field: "speaker_id" | "text" | "item_text";
  before: string;
  after: string;
  reason: string;
  corrected_by: string;
  at: string;
}

export interface Tombstone {
  meeting_id: string;
  reason: string;
  requested_by: string;
  at: string;
  scope: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
  model: string;
  sources: string[];
}

export interface SearchHit {
  meeting_id: string;
  meeting_title: string;
  type: "evidence" | "utterance";
  id: string;
  evidence_id: string;
  text: string;
  speaker_id: string;
  start: number;
  end: number;
  confidence: number;
  score: number;
  redacted: boolean;
  kind?: EvidenceKind;
}

export interface Citation {
  evidence_id: string;
  meeting_id: string;
  meeting_title: string;
  quote: string;
  speaker: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Answer {
  answer: string;
  citations: Citation[];
  trace: { step: string; detail: string }[];
  confidence: number;
  refused: boolean;
  latency_ms: number;
  review?: { label: string; route: string };
}

export interface EvidencePack {
  title: string;
  generated_at: string;
  meeting: string;
  quote: string;
  speaker: string;
  start: string;
  end: string;
  source: string;
  confidence: number;
  redactions: { label: string; safe_text: string }[];
  provenance: Record<string, string>;
  hash: string;
  markdown: string;
}

export type AttentionKind =
  | "unsent_handoff"
  | "promise_due"
  | "unanswered_question"
  | "consent_gap"
  | "correction_needed"
  | "redaction_review"
  | "retention_expiry"
  | "queue_stuck"
  | "handoff_failed"
  | "note_unsent"
  | "device_health";

export type AttentionState = "dismissed" | "snoozed" | "accepted" | "wrong" | "assigned";

export interface AttentionFeedback {
  state: AttentionState;
  at: string;
  until?: string;
  note?: string;
  assignee?: string;
}

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  detail: string;
  why: string;
  meeting_id?: string;
  evidence_id?: string;
  route: string;
  action_label: string;
  confidence: number;
  score: number;
  due?: string;
}

export interface Comment {
  id: string;
  target_type: "meeting" | "evidence";
  target_id: string;
  meeting_id: string;
  author: string;
  role: string;
  text: string;
  at: string;
  resolved: boolean;
  parent_id?: string | null;
}

export interface ConnectorState {
  enabled: boolean;
  configured: boolean;
  consent_purpose: string;
  scopes: string[];
  last_test: string | null;
  last_status: "ok" | "error" | "not_configured";
  detail: string;
}

export interface ConnectorDef {
  id: string;
  name: string;
  category: string;
  direction: "read" | "write" | "read+write";
  purpose: string;
  scopes: string[];
  status: "available" | "preview" | "blocked";
  note: string;
  mock: boolean;
}

export interface AmbientState {
  enabled: boolean;
  wakeWord: boolean;
  batteryAware: boolean;
  schedule: string;
  zones: string[];
  lastActivation: string | null;
  activations: number;
}

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  answer?: Answer;
  at: string;
}

export interface ShareRecord {
  token: string;
  meeting_id: string;
  evidence_id: string;
  created_at: string;
  expires_at: string;
  redacted: boolean;
}

export interface RemoteAck {
  event_id: string;
  status: "delivered" | "queued" | "failed";
  at: string;
  detail: string;
  latency_ms: number | null;
}

export interface NudgeFeedbackView {
  accepted: number;
  dismissed: number;
  wrong: number;
  snoozed: number;
  acceptance: number;
}


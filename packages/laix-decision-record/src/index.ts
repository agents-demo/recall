/**
 * LAIX decision record — a storage-free, UI-free record of one decision:
 * what was decided, why, which evidence supports it, who approved it, and how to undo it.
 *
 * Extracted from RECALL's approval/evidence/audit model. It has no React, no database and no
 * RECALL types. A LAIX app can persist the returned JSON wherever it wants.
 */

export type RecordStatus = "draft" | "approved" | "rejected" | "executed" | "undone";
export type ApprovalState = "pending" | "approved" | "rejected";

export interface EvidenceRef {
  id: string;
  kind: string;
  quote: string;
  speaker?: string;
  start?: number;
  end?: number;
  confidence?: number;
  source?: string;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface Approval {
  required: boolean;
  state: ApprovalState;
  by?: string;
  at?: string;
  note?: string;
}

export interface Undo {
  available: boolean;
  how?: string;
  at?: string;
}

export interface DecisionRecord {
  id: string;
  version: 1;
  title: string;
  summary: string;
  decision: {
    text: string;
    confidence: number;
    rationale?: string;
  };
  evidence: EvidenceRef[];
  alternatives: string[];
  approval: Approval;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  audit: AuditEvent[];
  undo: Undo;
  metadata: Record<string, unknown>;
  hash: string;
}

export interface CreateDecisionInput {
  title: string;
  summary?: string;
  decision: string;
  confidence?: number;
  rationale?: string;
  evidence: EvidenceRef[];
  alternatives?: string[];
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateOptions {
  now?: string;
  id?: string;
}

export interface ApprovalInput {
  by: string;
  at?: string;
  note?: string;
}

export interface UndoInput {
  by: string;
  at?: string;
  reason?: string;
  how?: string;
}

/** Stable JSON: keys sorted, no undefined values. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
  return `{${entries.join(",")}}`;
}

/** FNV-1a 64-bit: a content fingerprint, not a cryptographic signature. */
export function fingerprint(value: unknown): string {
  const text = canonical(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function recordHash(record: DecisionRecord): string {
  const { hash: _ignored, ...rest } = record;
  return fingerprint(rest);
}

function newId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && "randomUUID" in cryptoApi) return `dr_${cryptoApi.randomUUID()}`;
  return `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function audit(record: DecisionRecord, event: AuditEvent): DecisionRecord {
  return { ...record, audit: [...record.audit, event] };
}

function seal(record: DecisionRecord): DecisionRecord {
  return { ...record, hash: recordHash(record) };
}

export function createDecisionRecord(input: CreateDecisionInput, options: CreateOptions = {}): DecisionRecord {
  if (!input.title.trim()) throw new Error("title is required");
  if (!input.decision.trim()) throw new Error("decision is required");
  if (!input.evidence.length) throw new Error("at least one evidence ref is required");
  for (const ref of input.evidence) {
    if (!ref.id || !ref.quote) throw new Error("every evidence ref needs an id and a quote");
  }
  const now = options.now ?? new Date().toISOString();
  const requiresApproval = input.requiresApproval ?? true;
  const base: DecisionRecord = {
    id: options.id ?? newId(),
    version: 1,
    title: input.title.trim(),
    summary: (input.summary ?? input.decision).trim(),
    decision: {
      text: input.decision.trim(),
      confidence: Math.max(0, Math.min(1, input.confidence ?? 0.8)),
      rationale: input.rationale,
    },
    evidence: input.evidence.map((ref) => ({ ...ref })),
    alternatives: input.alternatives ?? [],
    approval: {
      required: requiresApproval,
      state: requiresApproval ? "pending" : "approved",
      by: requiresApproval ? undefined : "system",
      at: requiresApproval ? undefined : now,
      note: requiresApproval ? undefined : "No approval required by policy.",
    },
    status: requiresApproval ? "draft" : "approved",
    createdAt: now,
    updatedAt: now,
    audit: [{ at: now, actor: "agent", action: "created", detail: `Draft with ${input.evidence.length} evidence refs.` }],
    undo: { available: false },
    metadata: input.metadata ?? {},
    hash: "",
  };
  return seal(base);
}

export function approveRecord(record: DecisionRecord, input: ApprovalInput): DecisionRecord {
  if (record.status !== "draft") throw new Error(`cannot approve a ${record.status} record`);
  const at = input.at ?? new Date().toISOString();
  const next = audit(
    {
      ...record,
      approval: { required: record.approval.required, state: "approved", by: input.by, at, note: input.note },
      status: "approved",
      updatedAt: at,
      undo: { available: true, how: "Undo the approved decision before it is executed." },
    },
    { at, actor: input.by, action: "approved", detail: input.note ?? "Human approved the decision." },
  );
  return seal(next);
}

export function rejectRecord(record: DecisionRecord, input: ApprovalInput): DecisionRecord {
  if (record.status !== "draft") throw new Error(`cannot reject a ${record.status} record`);
  const at = input.at ?? new Date().toISOString();
  const next = audit(
    {
      ...record,
      approval: { required: record.approval.required, state: "rejected", by: input.by, at, note: input.note },
      status: "rejected",
      updatedAt: at,
    },
    { at, actor: input.by, action: "rejected", detail: input.note ?? "Human rejected the decision." },
  );
  return seal(next);
}

export function markExecuted(record: DecisionRecord, input: { by: string; at?: string; note?: string }): DecisionRecord {
  if (record.status !== "approved") throw new Error(`cannot execute a ${record.status} record`);
  const at = input.at ?? new Date().toISOString();
  const next = audit(
    { ...record, status: "executed", updatedAt: at, undo: { available: true, how: record.undo.how } },
    { at, actor: input.by, action: "executed", detail: input.note ?? "Approved decision executed." },
  );
  return seal(next);
}

export function undoRecord(record: DecisionRecord, input: UndoInput): DecisionRecord {
  if (!["approved", "executed"].includes(record.status)) throw new Error(`cannot undo a ${record.status} record`);
  if (!record.undo.available) throw new Error("this record is not undoable");
  const at = input.at ?? new Date().toISOString();
  const next = audit(
    {
      ...record,
      status: "undone",
      updatedAt: at,
      undo: { available: false, how: input.how ?? record.undo.how, at },
    },
    { at, actor: input.by, action: "undone", detail: input.reason ?? "Decision undone by a human." },
  );
  return seal(next);
}

export function verifyRecord(record: DecisionRecord): boolean {
  return recordHash(record) === record.hash;
}

export function evidenceFromQuotes(
  quotes: { id: string; kind: string; quote: string; speaker?: string; start?: number; confidence?: number; source?: string }[],
): EvidenceRef[] {
  return quotes.map((item) => ({ ...item }));
}

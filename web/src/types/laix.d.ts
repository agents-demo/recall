/**
 * Type declarations for the pinned `laix` package.
 *
 * LAIX ships TypeScript source (no dist, no .d.ts). The app's `tsc --noEmit` would otherwise
 * type-check the dependency's own source, including its internal narrowing. This declaration
 * bridge keeps the public contract explicit while Vite still bundles the real package from
 * `node_modules/laix`.
 *
 * Keep this in sync with laix v0.2.1. It is types only: no runtime code, no second policy.
 */
declare module "laix" {
  export type DecisionAction = "wait" | "observe" | "guide" | "ask" | "act" | "verify" | "escalate";
  export type Severity = "critical" | "high" | "medium" | "low" | "info";
  export type OutcomeResult = "helped" | "no_effect" | "hurt" | "unknown";
  export type FeedbackState = "accepted" | "dismissed" | "snoozed" | "wrong" | "assigned";

  export interface Feedback {
    state: FeedbackState;
    at?: string;
    until?: string;
    note?: string;
  }

  export interface Intent {
    capability: string;
    args?: Record<string, unknown>;
  }

  export interface Escalation {
    target: string;
    reason?: string;
  }

  export interface Signal {
    id: string;
    kind: string;
    title?: string;
    detail?: string;
    severity?: Severity;
    confidence?: number;
    due?: string | null;
    evidenceRefs?: string[];
    groupKey?: string | null;
    interruptionCost?: number;
    requiresApproval?: boolean;
    intent?: Intent | null;
    reversible?: boolean;
    escalation?: Escalation | null;
  }

  export type QuietHours = [string, string] | string | null;

  export interface Context {
    now: string | Date;
    quietHours?: QuietHours;
    stopped?: boolean;
    minSeverity?: Severity;
    minConfidence?: number;
    mutedKinds?: string[];
    interruptionBudget?: number | null;
    sent?: string[];
    feedback?: Record<string, Feedback>;
    escalateAfterHours?: number | null;
    learned?: Record<string, number>;
    allowAct?: boolean;
  }

  export interface ScoreBreakdown {
    severity: number;
    due: number;
    confidence: number;
    interruption: number;
    learned: number;
    total: number;
  }

  export interface Decision {
    signalId: string;
    action: DecisionAction;
    score: number;
    reason: string;
    confidence: number;
    deliver: boolean;
    record: boolean;
    requiresApproval: boolean;
    evidenceRefs: string[];
    breakdown: ScoreBreakdown;
    traceId: string;
    intent: Intent | null;
    escalation: Escalation | null;
    costOfWaiting: number;
    reversible: boolean;
    undoHint: "withdraw" | "cancel" | null;
  }

  export interface Outcome {
    candidateId: string;
    action: DecisionAction;
    result: OutcomeResult;
    at: string;
    note?: string;
  }

  export class OutcomeLog {
    constructor(initial?: Outcome[]);
    record(outcome: Outcome): void;
    all(): Outcome[];
    adjustment(kind: string): number;
    acceptanceRate(): number;
  }

  export function decide(context: Context, signals: Signal[]): Decision[];
  export function isQuietHours(now: string | Date, quiet?: QuietHours): boolean;
  export function score(signal: Signal, context: Context): ScoreBreakdown;
  export function costOfWaiting(signal: Signal, context: Context): number;

  export type RecordStatus = "draft" | "approved" | "rejected" | "executed" | "undone";
  export type ApprovalState = "pending" | "approved" | "rejected";

  export interface EvidenceRef {
    id: string;
    kind: string;
    quote: string;
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
    decision: { text: string; confidence: number; rationale?: string };
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

  export function createDecisionRecord(input: CreateDecisionInput, options?: CreateOptions): DecisionRecord;
  export function approveRecord(record: DecisionRecord, input: ApprovalInput): DecisionRecord;
  export function rejectRecord(record: DecisionRecord, input: ApprovalInput): DecisionRecord;
  export function markExecuted(record: DecisionRecord, input: { by: string; at?: string; note?: string }): DecisionRecord;
  export function undoRecord(record: DecisionRecord, input: UndoInput): DecisionRecord;
  export function verifyRecord(record: DecisionRecord): boolean;
  export function fingerprint(value: unknown): string;
  export function canonical(value: unknown): string;

  export type Verb = "wait" | "observe" | "guide" | "ask" | "act" | "verify" | "escalate";
  export interface LayerDecision {
    verb: Verb;
    confidence: number;
    reasonCode: string;
    rationale: string;
    actionId: string | null;
    requiresApproval: boolean;
    score: number | null;
    traceId: string;
    deliver: boolean;
    record: boolean;
  }
  export class Layer {
    decide(request: {
      subject: string;
      at: string;
      signals?: Signal[];
      context?: Context;
      situation?: unknown;
      options?: unknown[];
    }): LayerDecision;
  }
}

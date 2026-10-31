import {
  decide,
  OutcomeLog,
  type Context,
  type Decision,
  type Feedback,
  type Outcome,
  type Signal,
} from "laix";
import type { AttentionFeedback, AttentionItem } from "../types";

export interface LaixAttentionInput {
  now?: Date;
  quietHours?: string;
  interruptionBudget?: number;
  minConfidence?: number;
  feedback?: Record<string, AttentionFeedback>;
}

export interface LaixAttentionResult {
  items: AttentionItem[];
  decisions: Decision[];
}

const SEVERITY: Record<AttentionItem["severity"], NonNullable<Signal["severity"]>> = {
  info: "info",
  warning: "medium",
  high: "high",
  critical: "critical",
};

const SEVERITY_COST: Record<AttentionItem["severity"], number> = {
  info: 0.12,
  warning: 0.24,
  high: 0.38,
  critical: 0.08,
};

/** RECALL attention item -> LAIX signal. */
export function toSignal(item: AttentionItem): Signal {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    detail: item.detail,
    severity: SEVERITY[item.severity],
    confidence: Math.max(0, Math.min(1, item.confidence)),
    due: item.due ?? null,
    evidenceRefs: item.evidence_id ? [item.evidence_id] : [],
    interruptionCost: SEVERITY_COST[item.severity],
    reversible: item.kind !== "consent_gap" && item.kind !== "contradiction",
    requiresApproval: item.kind !== "device_health" && item.kind !== "note_unsent",
  };
}

function toFeedback(feedback: Record<string, AttentionFeedback> | undefined): Record<string, Feedback> {
  if (!feedback) return {};
  return Object.fromEntries(
    Object.entries(feedback).map(([id, value]) => [
      id,
      {
        state: value.state,
        at: value.at,
        until: value.until,
        note: value.note,
      } as Feedback,
    ]),
  );
}

function toOutcomes(feedback: Record<string, AttentionFeedback> | undefined): Outcome[] {
  if (!feedback) return [];
  const at = new Date(0).toISOString();
  return Object.entries(feedback)
    .filter(([, value]) => ["accepted", "assigned", "dismissed", "wrong"].includes(value.state))
    .map(([candidateId, value]) => ({
      candidateId,
      action: "guide" as const,
      result:
        value.state === "accepted" || value.state === "assigned"
          ? ("helped" as const)
          : value.state === "dismissed"
            ? ("no_effect" as const)
            : ("hurt" as const),
      at: value.at ?? at,
      note: value.note,
    }));
}

function parseQuietHours(value: string | undefined): [string, string] | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})/);
  return match ? [match[1], match[2]] : null;
}

/** LAIX learned adjustments are points on the score; OutcomeLog returns -0.2..0.2. */
function learnedAdjustments(items: AttentionItem[], feedback: Record<string, AttentionFeedback> | undefined): Record<string, number> {
  const log = new OutcomeLog(toOutcomes(feedback));
  const kinds = new Set(items.map((item) => item.kind));
  return Object.fromEntries([...kinds].map((kind) => [kind, Math.round(log.adjustment(kind) * 1000) / 10]));
}

const OVERLAP = new Set(["promise_due", "unanswered_question", "correction_needed", "redaction_review"]);

/** Merge analysis-derived items with the rule-derived base without duplicating a meeting's topics. */
export function mergeAttention(base: AttentionItem[], analysis: AttentionItem[], analyzedMeetings: string[]): AttentionItem[] {
  const analyzed = new Set(analyzedMeetings);
  const keptBase = base.filter(
    (item) => !(item.meeting_id && analyzed.has(item.meeting_id) && OVERLAP.has(item.kind)),
  );
  const seen = new Set(analysis.map((item) => item.id));
  return [...analysis, ...keptBase.filter((item) => !seen.has(item.id))];
}

/**
 * Run RECALL's attention items through the real LAIX attention policy.
 * The app still owns the evidence route, the list and the UI; LAIX owns the decision.
 */
export function decideAttention(items: AttentionItem[], input: LaixAttentionInput = {}): LaixAttentionResult {
  if (items.length === 0) return { items, decisions: [] };
  const feedback = toFeedback(input.feedback);
  const context: Context = {
    now: input.now ?? new Date(),
    quietHours: parseQuietHours(input.quietHours),
    interruptionBudget: input.interruptionBudget,
    minConfidence: input.minConfidence,
    feedback,
    learned: learnedAdjustments(items, input.feedback),
  };
  const decisions = decide(context, items.map(toSignal));
  const byId = new Map(decisions.map((decision) => [decision.signalId, decision]));
  return {
    items: items.map((item) => {
      const decision = byId.get(item.id);
      return decision
        ? {
            ...item,
            laix_action: decision.action,
            laix_reason: decision.reason,
            laix_score: decision.score,
          }
        : item;
    }),
    decisions,
  };
}

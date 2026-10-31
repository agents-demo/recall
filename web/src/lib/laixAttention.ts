import { decide, type Candidate, type Decision, type Feedback, type Outcome } from "@laix/attention";
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

const SEVERITY_COST: Record<AttentionItem["severity"], number> = {
  info: 0.12,
  warning: 0.24,
  high: 0.38,
  critical: 0.08,
};

export function toCandidate(item: AttentionItem): Candidate {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    detail: item.detail,
    why: item.why,
    severity: item.severity,
    confidence: Math.max(0, Math.min(1, item.confidence)),
    due: item.due,
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
    .filter(([, value]) => value.state === "accepted" || value.state === "assigned" || value.state === "dismissed" || value.state === "wrong")
    .map(([candidateId, value]) => ({
      candidateId,
      action: "notify" as const,
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
 * Run RECALL's attention items through the LAIX attention decision layer.
 * The app still owns the UI and the evidence route; LAIX owns the timing decision.
 */
export function decideAttention(items: AttentionItem[], input: LaixAttentionInput = {}): LaixAttentionResult {
  if (items.length === 0) return { items, decisions: [] };
  const decisions = decide(
    {
      now: input.now ?? new Date(),
      quietHours: parseQuietHours(input.quietHours),
      interruptionBudget: input.interruptionBudget,
      minConfidence: input.minConfidence,
      feedback: toFeedback(input.feedback),
      outcomes: toOutcomes(input.feedback),
    },
    items.map(toCandidate),
  );
  const byId = new Map(decisions.map((decision) => [decision.candidateId, decision]));
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

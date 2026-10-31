/**
 * LAIX attention — a small, UI-free decision layer for "when should we intervene?".
 *
 * Extracted from RECALL's bounded attention engine so it can be taken into LAIX later.
 * It has no React, no browser and no RECALL types. The app supplies candidates and a context;
 * the module returns a decision per candidate and learns from recorded outcomes.
 */

export type DecisionAction = "wait" | "notify" | "ask" | "act" | "verify" | "escalate";
export type Severity = "info" | "warning" | "high" | "critical";
export type OutcomeResult = "helped" | "no_effect" | "hurt" | "unknown";
export type FeedbackState = "accepted" | "dismissed" | "snoozed" | "wrong" | "assigned";

export interface Feedback {
  state: FeedbackState;
  at?: string;
  until?: string;
  note?: string;
}

export interface Candidate {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  why?: string;
  severity: Severity;
  confidence: number;
  due?: string;
  evidenceRefs?: string[];
  interruptionCost?: number;
  reversible?: boolean;
  requiresApproval?: boolean;
}

export interface Context {
  now: string | Date;
  quietHours?: [string, string] | null;
  interruptionBudget?: number;
  maxInterruptions?: number;
  mutedKinds?: string[];
  minConfidence?: number;
  feedback?: Record<string, Feedback>;
  outcomes?: Outcome[];
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
  candidateId: string;
  action: DecisionAction;
  score: number;
  confidence: number;
  reason: string;
  evidenceRefs: string[];
  requiresApproval: boolean;
  breakdown: ScoreBreakdown;
}

export interface Outcome {
  candidateId: string;
  action: DecisionAction;
  result: OutcomeResult;
  at: string;
  note?: string;
}

export interface DecideOptions {
  notifyAt?: number;
  askAt?: number;
  escalateAt?: number;
  allowAct?: boolean;
}

const DEFAULT_OPTIONS: Required<DecideOptions> = {
  notifyAt: 48,
  askAt: 72,
  escalateAt: 92,
  allowAct: false,
};

const SEVERITY: Record<Severity, number> = {
  info: 28,
  warning: 52,
  high: 74,
  critical: 94,
};

function date(value: string | Date | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hoursUntil(due: string | undefined, now: Date): number | null {
  const target = date(due);
  if (!target) return null;
  return (target.getTime() - now.getTime()) / 3_600_000;
}

function dueScore(due: string | undefined, now: Date): number {
  const hours = hoursUntil(due, now);
  if (hours === null) return 0;
  if (hours < 0) return 30;
  if (hours < 12) return 24;
  if (hours < 48) return 16;
  if (hours < 24 * 7) return 8;
  return 0;
}

function minutesOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isQuietHours(now: Date, quiet?: [string, string] | null): boolean {
  if (!quiet) return false;
  const start = minutesOfDay(quiet[0]);
  const end = minutesOfDay(quiet[1]);
  if (start === null || end === null) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function feedbackBlocks(feedback: Feedback | undefined, now: Date): string | null {
  if (!feedback) return null;
  if (feedback.state === "dismissed") return "dismissed by the user";
  if (feedback.state === "wrong") return "marked wrong by the user";
  if (feedback.state === "accepted") return "already accepted";
  if (feedback.state === "snoozed") {
    const until = date(feedback.until);
    if (!until || until.getTime() > now.getTime()) return "snoozed";
  }
  return null;
}

/** A tiny outcome learner: recent evidence shifts the score per candidate kind. */
export class OutcomeLog {
  private readonly outcomes: Outcome[] = [];

  constructor(initial: Outcome[] = []) {
    this.outcomes = [...initial];
  }

  record(outcome: Outcome): void {
    this.outcomes.push(outcome);
    if (this.outcomes.length > 500) this.outcomes.shift();
  }

  all(): Outcome[] {
    return [...this.outcomes];
  }

  adjustment(kind: string): number {
    const relevant = this.outcomes.filter((outcome) => outcome.candidateId.startsWith(`${kind}:`) || outcome.candidateId.includes(kind));
    if (relevant.length === 0) return 0;
    let value = 0;
    for (const outcome of relevant.slice(-30)) {
      if (outcome.result === "helped") value += 0.04;
      else if (outcome.result === "hurt") value -= 0.08;
      else if (outcome.result === "no_effect") value -= 0.04;
    }
    return Math.max(-0.2, Math.min(0.2, value));
  }

  acceptanceRate(): number {
    const useful = this.outcomes.filter((outcome) => outcome.result === "helped").length;
    return this.outcomes.length ? useful / this.outcomes.length : 0;
  }
}

/**
 * Decide what to do with each candidate. The policy is deliberately simple and inspectable:
 * severity + due urgency + confidence - interruption cost + learned adjustment.
 */
export function decide(context: Context, candidates: Candidate[], options: DecideOptions = {}): Decision[] {
  const now = date(context.now) ?? new Date();
  const config = { ...DEFAULT_OPTIONS, ...options };
  const budget = context.interruptionBudget ?? context.maxInterruptions ?? Number.POSITIVE_INFINITY;
  const quiet = isQuietHours(now, context.quietHours ?? null);
  const outcomes = new OutcomeLog(context.outcomes ?? []);
  const decisions: Decision[] = [];
  let interruptions = 0;

  for (const candidate of candidates) {
    const blocked = feedbackBlocks(context.feedback?.[candidate.id], now);
    if (blocked) {
      decisions.push({
        candidateId: candidate.id,
        action: "wait",
        score: 0,
        confidence: candidate.confidence,
        reason: `Suppressed: ${blocked}.`,
        evidenceRefs: candidate.evidenceRefs ?? [],
        requiresApproval: Boolean(candidate.requiresApproval),
        breakdown: { severity: 0, due: 0, confidence: 0, interruption: 0, learned: 0, total: 0 },
      });
      continue;
    }

    if (context.mutedKinds?.includes(candidate.kind)) {
      decisions.push({
        candidateId: candidate.id,
        action: "wait",
        score: 0,
        confidence: candidate.confidence,
        reason: `The user muted ${candidate.kind}.`,
        evidenceRefs: candidate.evidenceRefs ?? [],
        requiresApproval: Boolean(candidate.requiresApproval),
        breakdown: { severity: 0, due: 0, confidence: 0, interruption: 0, learned: 0, total: 0 },
      });
      continue;
    }

    if (context.minConfidence !== undefined && candidate.confidence < context.minConfidence) {
      decisions.push({
        candidateId: candidate.id,
        action: "wait",
        score: 0,
        confidence: candidate.confidence,
        reason: `Confidence ${Math.round(candidate.confidence * 100)}% is below the user's floor.`,
        evidenceRefs: candidate.evidenceRefs ?? [],
        requiresApproval: Boolean(candidate.requiresApproval),
        breakdown: { severity: 0, due: 0, confidence: 0, interruption: 0, learned: 0, total: 0 },
      });
      continue;
    }

    const severity = SEVERITY[candidate.severity];
    const due = dueScore(candidate.due, now);
    const confidence = candidate.confidence * 12;
    const interruption = (candidate.interruptionCost ?? 0.3) * 20;
    const learned = outcomes.adjustment(candidate.kind) * 100;
    const total = Math.max(0, Math.min(100, severity + due + confidence - interruption + learned));
    const evidence = candidate.evidenceRefs ?? [];

    let action: DecisionAction;
    let reason: string;
    const urgent = hoursUntil(candidate.due, now);

    if (candidate.severity === "critical") {
      action = candidate.requiresApproval ? "ask" : "escalate";
      reason = "Critical severity: a human must see it now.";
    } else if (quiet && candidate.severity !== "high" && (urgent === null || urgent > 12)) {
      action = "wait";
      reason = "Quiet hours: hold until the user is available.";
    } else if (candidate.requiresApproval && total >= config.askAt) {
      action = "ask";
      reason = "The action needs a human decision.";
    } else if (total >= config.escalateAt) {
      action = "escalate";
      reason = "High score: escalate to a human.";
    } else if (total >= config.askAt) {
      action = "ask";
      reason = "High score: ask the user before acting.";
    } else if (total >= config.notifyAt) {
      action = config.allowAct && candidate.reversible && !candidate.requiresApproval ? "act" : "notify";
      reason = config.allowAct && candidate.reversible ? "Reversible and above the notify threshold." : "Worth surfacing, not acting.";
    } else {
      action = "wait";
      reason = "Below the notification threshold.";
    }

    if (action !== "wait" && interruptions >= budget && candidate.severity !== "critical") {
      action = "wait";
      reason = "Interruption budget exhausted; hold for the next window.";
    }
    if (action !== "wait") interruptions += 1;

    decisions.push({
      candidateId: candidate.id,
      action,
      score: Math.round(total),
      confidence: candidate.confidence,
      reason,
      evidenceRefs: evidence,
      requiresApproval: Boolean(candidate.requiresApproval),
      breakdown: {
        severity,
        due,
        confidence: Math.round(confidence),
        interruption: Math.round(interruption),
        learned: Math.round(learned),
        total: Math.round(total),
      },
    });
  }

  return decisions.sort((a, b) => b.score - a.score);
}

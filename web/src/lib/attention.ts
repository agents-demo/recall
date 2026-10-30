import type {
  AttentionFeedback,
  AttentionItem,
  AttentionKind,
  Meeting,
  Note,
  NudgeFeedbackView,
  Pack,
  PpmaEvent,
} from "../types";

interface Options {
  now?: Date;
  limit?: number;
  meetingId?: string;
}

const DAY = 86_400_000;

function date(value: string | Date | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function severityWeight(severity: AttentionItem["severity"]): number {
  return severity === "critical" ? 100 : severity === "high" ? 85 : severity === "warning" ? 65 : 40;
}

function dueWeight(due: string | undefined, now: Date): number {
  const d = date(due);
  if (!d) return 0;
  const hours = (d.getTime() - now.getTime()) / 3_600_000;
  if (hours < 0) return 30;
  if (hours < 12) return 24;
  if (hours < 48) return 16;
  if (hours < 24 * 7) return 8;
  return 0;
}

function feedbackAllows(feedback: AttentionFeedback | undefined, now: Date): boolean {
  if (!feedback) return true;
  if (feedback.state === "dismissed" || feedback.state === "accepted" || feedback.state === "wrong") return false;
  if (feedback.state === "assigned") return true;
  if (feedback.state === "snoozed") {
    const until = date(feedback.until);
    return Boolean(until && until.getTime() <= now.getTime());
  }
  return true;
}

/**
 * Derives the bounded "attention" layer. Every item points at evidence and an action the human
 * can take inside RECALL. None of them creates a task, sends a message or changes PPMA state.
 */
export function deriveAttention(
  pack: Pack,
  meetings: Meeting[],
  notes: Note[],
  events: PpmaEvent[],
  feedback: Record<string, AttentionFeedback> = {},
  options: Options = {},
): AttentionItem[] {
  const now = options.now ?? new Date();
  const items: AttentionItem[] = [];
  const active = meetings.filter((m) => m.status !== "tombstoned" && (!options.meetingId || m.id === options.meetingId));

  for (const meeting of active) {
    const evidenceRoute = (evidenceId?: string) =>
      `/meetings/${meeting.id}${evidenceId ? `?e=${evidenceId}&t=${Math.floor(meeting.evidence.find((e) => e.id === evidenceId)?.start ?? 0)}` : ""}`;

    if (meeting.consent.state !== "granted") {
      items.push({
        id: `consent_gap:${meeting.id}`,
        kind: "consent_gap",
        severity: "critical",
        title: `Consent is ${meeting.consent.state}`,
        detail: `${meeting.title} cannot be shared or handed to PPMA until a consent state is recorded.`,
        why: `The capture has consent=${meeting.consent.state} and no valid consent evidence.`,
        meeting_id: meeting.id,
        route: `${evidenceRoute()}?tab=rights`,
        action_label: "Review consent",
        confidence: 1,
        score: severityWeight("critical") + 20,
      });
    }

    if (meeting.status === "captured" && meeting.consent.state === "granted" && meeting.mode !== "note") {
      items.push({
        id: `unsent_handoff:${meeting.id}`,
        kind: "unsent_handoff",
        severity: "high",
        title: "Captured, but PPMA does not have it yet",
        detail: `${meeting.title} has ${meeting.decisions.length} decisions, ${meeting.actions.length} actions and ${meeting.evidence.length} evidence items waiting.`,
        why: `The local capture is complete and consent is granted; no delivered completion event exists for ${meeting.capture_id}.`,
        meeting_id: meeting.id,
        evidence_id: meeting.evidence[0]?.id,
        route: `/meetings/${meeting.id}`,
        action_label: "Review handoff",
        confidence: 0.99,
        score: severityWeight("high") + 6,
      });
    }

    for (const action of meeting.actions) {
      if (action.status === "done") continue;
      const due = date(action.due);
      if (!due) continue;
      const days = (due.getTime() - now.getTime()) / DAY;
      if (days > 7) continue;
      const severity: AttentionItem["severity"] = days < 0 ? "high" : days < 1 ? "high" : days < 3 ? "warning" : "info";
      items.push({
        id: `promise_due:${meeting.id}:${action.id}`,
        kind: "promise_due",
        severity,
        title: days < 0 ? "Promise is overdue" : days < 1 ? "Promise is due today" : "Promise is due soon",
        detail: `${action.text} · ${action.owner} · due ${action.due}`,
        why: `Action ${action.id} links to evidence ${action.evidence_id} and has not been completed.`,
        meeting_id: meeting.id,
        evidence_id: action.evidence_id,
        route: evidenceRoute(action.evidence_id),
        action_label: "Open the promise",
        confidence: action.confidence,
        score: severityWeight(severity) + dueWeight(action.due, now) + action.confidence * 4,
        due: action.due,
      });
    }

    for (const question of meeting.questions) {
      if (question.status === "answered") continue;
      const started = date(meeting.started_at);
      const ageDays = started ? (now.getTime() - started.getTime()) / DAY : 0;
      if (ageDays < 2) continue;
      items.push({
        id: `unanswered_question:${meeting.id}:${question.id}`,
        kind: "unanswered_question",
        severity: ageDays > 10 ? "warning" : "info",
        title: "An open question is still open",
        detail: question.text,
        why: `Question ${question.id} is unresolved and links to ${question.evidence_id}.`,
        meeting_id: meeting.id,
        evidence_id: question.evidence_id,
        route: evidenceRoute(question.evidence_id),
        action_label: "Open the question",
        confidence: question.confidence,
        score: severityWeight(ageDays > 10 ? "warning" : "info") + Math.min(14, ageDays),
      });
    }

    const uncertain = meeting.evidence.filter((e) => e.attribution_confidence < 0.8);
    if (uncertain.length && !meeting.evidence.some((e) => e.attribution_confidence === 1)) {
      const top = uncertain[0];
      items.push({
        id: `correction_needed:${meeting.id}:${top.id}`,
        kind: "correction_needed",
        severity: "warning",
        title: "Speaker attribution is uncertain",
        detail: `“${top.quote}” is attributed to ${meeting.participants.find((p) => p.id === top.speaker_id)?.name ?? top.speaker_id} at ${Math.round(top.attribution_confidence * 100)}%.`,
        why: `Evidence ${top.id} is below the 80% attribution threshold and has no human sign-off.`,
        meeting_id: meeting.id,
        evidence_id: top.id,
        route: evidenceRoute(top.id),
        action_label: "Check the speaker",
        confidence: top.attribution_confidence,
        score: severityWeight("warning") + (1 - top.attribution_confidence) * 30,
      });
    }

    for (const redaction of meeting.redactions.filter((r) => r.status === "detected")) {
      items.push({
        id: `redaction_review:${meeting.id}:${redaction.id}`,
        kind: "redaction_review",
        severity: "warning",
        title: "A sensitive passage is waiting",
        detail: `${redaction.label} detected at ${Math.round(redaction.confidence * 100)}% confidence.`,
        why: `The classifier flagged ${redaction.reason}; the safe version has not been applied.`,
        meeting_id: meeting.id,
        evidence_id: redaction.evidence_id,
        route: `/meetings/${meeting.id}?tab=rights`,
        action_label: "Review redaction",
        confidence: redaction.confidence,
        score: severityWeight("warning") + redaction.confidence * 10,
      });
    }

    const expiry = date(meeting.retention.retain_until);
    if (expiry) {
      const days = (expiry.getTime() - now.getTime()) / DAY;
      if (days >= 0 && days < 30) {
        items.push({
          id: `retention_expiry:${meeting.id}`,
          kind: "retention_expiry",
          severity: days < 7 ? "warning" : "info",
          title: "Retention expires soon",
          detail: `${meeting.title} is retained until ${meeting.retention.retain_until.slice(0, 10)}.`,
          why: `The retention policy ${meeting.retention.policy} is within 30 days of expiry.`,
          meeting_id: meeting.id,
          route: `/meetings/${meeting.id}?tab=rights`,
          action_label: "Review retention",
          confidence: 1,
          score: severityWeight(days < 7 ? "warning" : "info") + (30 - days) / 3,
          due: meeting.retention.retain_until,
        });
      }
    }
  }

  if (!options.meetingId) {
    const queued = events.filter((e) => e.delivery.status === "queued");
    if (queued.length) {
      items.push({
        id: "queue_stuck",
        kind: "queue_stuck",
        severity: "warning",
        title: `${queued.length} event${queued.length === 1 ? "" : "s"} waiting for PPMA`,
        detail: "Capture continues locally. Deliver the queue or keep it safe until the endpoint returns.",
        why: "The local queue is non-empty; no event loss is acceptable.",
        route: "/ppma",
        action_label: "Open delivery queue",
        confidence: 1,
        score: severityWeight("warning") + queued.length * 2,
      });
    }

    const failed = events.filter((e) => e.delivery.status === "failed");
    if (failed.length) {
      items.push({
        id: "handoff_failed",
        kind: "handoff_failed",
        severity: "high",
        title: "PPMA rejected an event",
        detail: `${failed.length} event${failed.length === 1 ? "" : "s"} need review before they can be retried.`,
        why: "A delivery failed after retries; the dead-letter path requires a human.",
        route: "/ppma",
        action_label: "Review failures",
        confidence: 1,
        score: severityWeight("high") + failed.length * 4,
      });
    }

    for (const note of notes) {
      const delivered = events.some((event) => event.payload.note_id === note.note_id && event.delivery.status === "delivered");
      if (!delivered && note.ppma.status !== "sent") {
        items.push({
          id: `note_unsent:${note.id}`,
          kind: "note_unsent",
          severity: "info",
          title: "Field note not handed to PPMA",
          detail: note.text.slice(0, 120),
          why: `Note ${note.note_id} has an evidence pointer but no delivered note event.`,
          route: "/field",
          action_label: "Open field note",
          confidence: 0.9,
          score: severityWeight("info") + 4,
        });
      }
    }

    for (const device of pack.team.devices) {
      if (device.status === "revoked") continue;
      if ((device.battery_pct ?? 100) < 25 || device.storage_used_pct > 90 || device.mic !== "ok") {
        items.push({
          id: `device_health:${device.id}`,
          kind: "device_health",
          severity: "info",
          title: `Device health: ${device.name}`,
          detail: `Battery ${device.battery_pct ?? "—"}% · storage ${device.storage_used_pct}% · mic ${device.mic}`,
          why: "A capture device is close to a condition that would interrupt a meeting.",
          route: "/health",
          action_label: "Open device health",
          confidence: 0.88,
          score: severityWeight("info") + 3,
        });
      }
    }
  }

  return items
    .filter((item) => feedbackAllows(feedback[item.id], now))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 200);
}

export function attentionForMeeting(
  pack: Pack,
  meeting: Meeting,
  events: PpmaEvent[],
  feedback: Record<string, AttentionFeedback> = {},
): AttentionItem[] {
  return deriveAttention(pack, [meeting], [], events, feedback, { meetingId: meeting.id });
}

export function nudgeMetrics(feedback: Record<string, AttentionFeedback>): NudgeFeedbackView {
  const values = Object.values(feedback);
  const accepted = values.filter((v) => v.state === "accepted").length;
  const dismissed = values.filter((v) => v.state === "dismissed").length;
  const wrong = values.filter((v) => v.state === "wrong").length;
  const snoozed = values.filter((v) => v.state === "snoozed").length;
  const total = accepted + dismissed + wrong;
  return { accepted, dismissed, wrong, snoozed, acceptance: total ? accepted / total : 0 };
}

export function attentionKindLabel(kind: AttentionKind): string {
  const labels: Record<AttentionKind, string> = {
    unsent_handoff: "handoff",
    promise_due: "promise",
    unanswered_question: "question",
    consent_gap: "consent",
    correction_needed: "attribution",
    redaction_review: "redaction",
    retention_expiry: "retention",
    queue_stuck: "queue",
    handoff_failed: "delivery",
    note_unsent: "field note",
    device_health: "device",
  };
  return labels[kind];
}

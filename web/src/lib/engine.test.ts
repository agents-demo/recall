import { describe, expect, it } from "vitest";
import packJson from "../../public/demo-pack.json";
import type { Correction, Meeting, Pack, Redaction } from "../types";
import {
  answerQuestion,
  applyCorrection,
  applyRedaction,
  dedupeEvent,
  evidencePackFor,
  meetingPayload,
  searchPack,
  consentGate,
  tombstoneMeeting,
  buildEvent,
  safeQuote,
} from "./engine";

const pack = packJson as unknown as Pack;
const meetings = pack.meetings;
const stage = meetings[0];

describe("local recall", () => {
  it("finds the promise as the top result for 'delivery'", () => {
    const hits = searchPack(meetings, pack.notes, "delivery");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].meeting_id).toBe(stage.id);
    expect(hits.some((h) => h.evidence_id === "ev_01")).toBe(true);
  });

  it("answers only from evidence and cites the promise", () => {
    const answer = answerQuestion(pack, meetings, "what did we promise about the 14th?");
    expect(answer.refused).toBe(false);
    expect(answer.answer).toContain("14th");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations[0].meeting_id).toBe(stage.id);
    expect(answer.trace.some((t) => t.step === "Answer")).toBe(true);
  });

  it("refuses when there is no evidence", () => {
    const answer = answerQuestion(pack, meetings, "what is the capital of France?");
    expect(answer.refused).toBe(true);
    expect(answer.citations).toHaveLength(0);
    expect(answer.answer.toLowerCase()).toContain("cannot find");
  });

  it("does not answer from a deleted memory", () => {
    const deleted = tombstoneMeeting(stage, { reason: "user_request", requested_by: "user_anna", at: "2026-10-30T12:00:00Z" });
    const answer = answerQuestion(pack, [deleted, ...meetings.slice(1)], "what did we promise about the 14th?");
    expect(answer.citations.every((c) => c.meeting_id !== stage.id)).toBe(true);
  });
});

describe("consent", () => {
  it("blocks an event when consent is withdrawn", () => {
    const withdrawn: Meeting = { ...stage, consent: { ...stage.consent, state: "withdrawn" } };
    expect(consentGate(withdrawn).ok).toBe(false);
    expect(consentGate(stage).ok).toBe(true);
  });

  it("keeps consent in the event payload", () => {
    const payload = meetingPayload(stage, { safe: true });
    expect((payload.consent as { state: string }).state).toBe("granted");
  });
});

describe("correction", () => {
  it("reassigns the speaker and marks attribution as human-verified", () => {
    const wrong = stage.evidence.find((e) => e.id === "ev_01")!;
    expect(wrong.speaker_id).toBe("p1");
    const correction: Correction = {
      id: "cor_1",
      meeting_id: stage.id,
      target: "evidence:ev_01",
      field: "speaker_id",
      before: "p1",
      after: "p2",
      reason: "wrong speaker",
      corrected_by: "user_anna",
      at: "2026-10-30T09:20:00Z",
    };
    const next = applyCorrection(stage, correction);
    const fixed = next.evidence.find((e) => e.id === "ev_01")!;
    expect(fixed.speaker_id).toBe("p2");
    expect(fixed.attribution_confidence).toBe(1);
    expect(next.utterances.find((u) => u.id === fixed.utterance_id)!.speaker_id).toBe("p2");
    // the original pack is untouched
    expect(stage.evidence.find((e) => e.id === "ev_01")!.speaker_id).toBe("p1");
  });
});

describe("redaction", () => {
  const applied: Redaction = {
    ...stage.redactions[0],
    status: "applied",
    applied_at: "2026-10-30T09:24:00Z",
    applied_by: "user_anna",
  };

  it("swaps the safe text without deleting the local original", () => {
    const next = applyRedaction(stage, applied);
    const ev = next.evidence.find((e) => e.id === "ev_05")!;
    expect(safeQuote(next, ev)).toBe("[redacted — internal client comment]");
    expect(next.utterances.find((u) => u.id === applied.utterance_id)!.text).toContain("chaotic");
  });

  it("never sends the unredacted internal comment to PPMA", () => {
    const payload = meetingPayload(applyRedaction(stage, applied), { safe: true });
    const evidence = payload.evidence as { id: string; quote: string }[];
    const internal = evidence.find((e) => e.id === "ev_05")!;
    expect(internal.quote).toContain("[redacted");
    expect(JSON.stringify(payload)).not.toContain("chaotic");
    expect((payload.redactions as unknown[]).length).toBe(1);
  });
});

describe("deletion", () => {
  it("leaves a tombstone and removes the transcript", () => {
    const dead = tombstoneMeeting(stage, { reason: "user_request", requested_by: "user_anna", at: "2026-10-30T12:00:00Z" });
    expect(dead.status).toBe("tombstoned");
    expect(dead.utterances).toHaveLength(0);
    expect(dead.evidence).toHaveLength(0);
    expect(dead.deleted_reason).toBe("user_request");
    expect(dead.tombstone_id).toBeTruthy();
  });
});

describe("PPMA contract", () => {
  it("builds a stable event id and detects a duplicate", () => {
    const a = buildEvent("capture.correction", { capture_id: "cap_x", correction_id: "cor_1" }, { occurredAt: "2026-10-30T09:20:00Z" });
    const b = buildEvent("capture.correction", { capture_id: "cap_x", correction_id: "cor_1" }, { occurredAt: "2026-10-30T09:20:00Z" });
    expect(a.event_id).toBe(b.event_id);
    expect(dedupeEvent([a], b)).toBe(true);
    expect(dedupeEvent([], b)).toBe(false);
  });

  it("exports an evidence pack with speaker, timestamp, source and hash", () => {
    const ev = evidencePackFor(stage, "ev_01")!;
    expect(ev.speaker).toBe("Anna Voss");
    expect(ev.start).toBe("00:11:24");
    expect(ev.source).toContain(stage.capture_id);
    expect(ev.hash).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(ev.markdown).toContain("Consent: granted");
    expect(ev.markdown).toContain("Raw audio is not included");
  });
});

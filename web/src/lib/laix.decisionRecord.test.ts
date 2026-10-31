import { describe, expect, it } from "vitest";
import {
  approveRecord,
  createDecisionRecord,
  markExecuted,
  rejectRecord,
  undoRecord,
  verifyRecord,
} from "@laix/decision-record";

const evidence = [
  {
    id: "e3",
    kind: "decision",
    quote: "Then we hold the enterprise pilot on the fourth and move self-serve onboarding to the eighteenth.",
    speaker: "Dana Whitfield",
    start: 68,
    confidence: 0.95,
  },
];

function record() {
  return createDecisionRecord(
    {
      title: "Helios rollout readiness review",
      decision: "Hold the enterprise pilot on 4 November; move self-serve onboarding to 18 November.",
      confidence: 0.94,
      meetingId: "mtg_1",
      evidence,
      requiresApproval: true,
    },
    { now: "2026-11-04T10:00:00Z", id: "dr_test" },
  );
}

describe("LAIX decision record", () => {
  it("creates a draft with evidence, approval pending and a fingerprint", () => {
    const draft = record();
    expect(draft.status).toBe("draft");
    expect(draft.approval.state).toBe("pending");
    expect(draft.evidence).toHaveLength(1);
    expect(draft.hash).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(verifyRecord(draft)).toBe(true);
  });

  it("rejects a record without evidence", () => {
    expect(() =>
      createDecisionRecord({ title: "No evidence", decision: "Do it", evidence: [] }),
    ).toThrow(/evidence/i);
  });

  it("approves, audits and seals", () => {
    const approved = approveRecord(record(), { by: "owner", at: "2026-11-04T10:05:00Z", note: "Reviewed the quote." });
    expect(approved.status).toBe("approved");
    expect(approved.approval.by).toBe("owner");
    expect(approved.audit.some((event) => event.action === "approved")).toBe(true);
    expect(approved.undo.available).toBe(true);
    expect(verifyRecord(approved)).toBe(true);
  });

  it("detects tampering", () => {
    const approved = approveRecord(record(), { by: "owner" });
    const tampered = { ...approved, decision: { ...approved.decision, text: "Something else" } };
    expect(verifyRecord(tampered)).toBe(false);
  });

  it("supports reject, execute and undo transitions", () => {
    const rejected = rejectRecord(record(), { by: "owner", note: "Not enough evidence." });
    expect(rejected.status).toBe("rejected");
    expect(() => approveRecord(rejected, { by: "owner" })).toThrow(/rejected/);

    const approved = approveRecord(record(), { by: "owner" });
    const executed = markExecuted(approved, { by: "ppma", note: "Project state updated." });
    expect(executed.status).toBe("executed");
    const undone = undoRecord(executed, { by: "owner", reason: "Wrong meeting." });
    expect(undone.status).toBe("undone");
    expect(undone.audit.some((event) => event.action === "undone")).toBe(true);
  });
});

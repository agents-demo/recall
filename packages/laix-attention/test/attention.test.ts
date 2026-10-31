import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OutcomeLog, decide, isQuietHours, type Candidate } from "../src/index.ts";

const base: Candidate = {
  id: "risk:1",
  kind: "risk",
  title: "Runbook is needed",
  severity: "high",
  confidence: 0.9,
  due: "2026-11-05T09:00:00Z",
  evidenceRefs: ["ev_1"],
  requiresApproval: true,
};

describe("laix-attention contract", () => {
  it("asks a human for a high, due, approval-required signal", () => {
    const [decision] = decide({ now: "2026-11-04T09:00:00Z" }, [base]);
    assert.equal(decision.action, "ask");
    assert.deepEqual(decision.evidenceRefs, ["ev_1"]);
  });

  it("escalates a critical signal without approval", () => {
    const [decision] = decide({ now: "2026-11-04T09:00:00Z" }, [{ ...base, severity: "critical", requiresApproval: false }]);
    assert.equal(decision.action, "escalate");
  });

  it("holds a warning during quiet hours", () => {
    const [decision] = decide(
      { now: "2026-11-04T23:00:00Z", quietHours: ["20:00", "07:00"] },
      [{ ...base, severity: "warning", due: "2026-11-20T09:00:00Z" }],
    );
    assert.equal(decision.action, "wait");
  });

  it("treats the quiet-hours end as exclusive in this implementation", () => {
    const now = new Date("2026-11-02T06:00:00Z");
    assert.equal(isQuietHours(now, ["22:00", "06:00"]), false);
  });

  it("respects a snooze", () => {
    const [decision] = decide(
      { now: "2026-11-04T09:00:00Z", feedback: { "risk:1": { state: "snoozed", until: "2026-11-05T09:00:00Z" } } },
      [base],
    );
    assert.equal(decision.action, "wait");
  });

  it("caps interruptions with the budget", () => {
    const decisions = decide(
      { now: "2026-11-04T09:00:00Z", interruptionBudget: 1 },
      [base, { ...base, id: "risk:2" }, { ...base, id: "risk:3" }],
    );
    assert.equal(decisions.filter((item) => item.action !== "wait").length, 1);
  });

  it("learns from outcomes", () => {
    const log = new OutcomeLog();
    assert.equal(log.adjustment("risk"), 0);
    log.record({ candidateId: "risk:1", action: "ask", result: "helped", at: "2026-11-04T09:00:00Z" });
    assert.ok(log.adjustment("risk") > 0);
    assert.equal(log.acceptanceRate(), 1);
  });
});

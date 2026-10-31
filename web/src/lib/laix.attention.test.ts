import { describe, expect, it } from "vitest";
import { OutcomeLog, decide, type Candidate } from "@laix/attention";
import { decideAttention, toCandidate } from "./laixAttention";
import type { AttentionItem } from "../types";

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "risk:1",
  kind: "risk",
  title: "Runbook is needed before the pilot",
  severity: "high",
  confidence: 0.9,
  due: "2026-11-05",
  evidenceRefs: ["ev_1"],
  requiresApproval: true,
  ...overrides,
});

describe("LAIX attention decision layer", () => {
  it("asks a human for a high, due, approval-required candidate", () => {
    const [decision] = decide({ now: "2026-11-04T09:00:00Z" }, [candidate()]);
    expect(decision.action).toBe("ask");
    expect(decision.evidenceRefs).toEqual(["ev_1"]);
    expect(decision.reason).toMatch(/human|approval/i);
  });

  it("escalates a critical candidate", () => {
    const [decision] = decide({ now: "2026-11-04T09:00:00Z" }, [candidate({ severity: "critical", requiresApproval: false })]);
    expect(decision.action).toBe("escalate");
  });

  it("waits during quiet hours for a non-urgent item", () => {
    const [decision] = decide(
      { now: "2026-11-04T23:00:00Z", quietHours: ["20:00", "07:00"] },
      [candidate({ due: "2026-11-20", severity: "warning" })],
    );
    expect(decision.action).toBe("wait");
    expect(decision.reason).toMatch(/quiet/i);
  });

  it("respects a snooze", () => {
    const [decision] = decide(
      { now: "2026-11-04T09:00:00Z", feedback: { "risk:1": { state: "snoozed", until: "2026-11-05T09:00:00Z" } } },
      [candidate()],
    );
    expect(decision.action).toBe("wait");
    expect(decision.reason).toMatch(/snoozed/i);
  });

  it("caps interruptions with the budget", () => {
    const decisions = decide(
      { now: "2026-11-04T09:00:00Z", interruptionBudget: 1 },
      [candidate({ id: "risk:1" }), candidate({ id: "risk:2" }), candidate({ id: "risk:3" })],
    );
    expect(decisions.filter((item) => item.action !== "wait")).toHaveLength(1);
  });

  it("learns from outcomes", () => {
    const log = new OutcomeLog();
    expect(log.adjustment("risk")).toBe(0);
    log.record({ candidateId: "risk:1", action: "ask", result: "helped", at: "2026-11-04T09:00:00Z" });
    expect(log.adjustment("risk")).toBeGreaterThan(0);
    expect(log.acceptanceRate()).toBe(1);
  });

  it("maps RECALL items to LAIX decisions without UI coupling", () => {
    const item: AttentionItem = {
      id: "risk:1",
      kind: "risk",
      severity: "high",
      title: "Runbook is needed",
      detail: "Field team is blocked",
      why: "No runbook",
      route: "/meetings/m1?tab=intelligence",
      action_label: "Review risk",
      confidence: 0.92,
      score: 98,
      due: "2026-11-05",
      evidence_id: "ev_1",
    };
    expect(toCandidate(item).requiresApproval).toBe(true);
    const result = decideAttention([item], { now: new Date("2026-11-04T09:00:00Z") });
    expect(result.items[0].laix_action).toBe("ask");
    expect(result.items[0].laix_score).toBeGreaterThan(0);
  });
});

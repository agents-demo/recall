import { describe, expect, it } from "vitest";
import { OutcomeLog, decide, type Signal } from "laix";
import { decideAttention, mergeAttention, toSignal } from "./laixAttention";
import type { AttentionItem } from "../types";

const signal = (overrides: Partial<Signal> = {}): Signal => ({
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
  it("guides a high, due signal and reports approval requirement", () => {
    const [decision] = decide({ now: "2026-11-04T09:00:00Z" }, [signal()]);
    expect(decision.action).toBe("guide");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.evidenceRefs).toEqual(["ev_1"]);
  });

  it("escalates an overdue critical signal", () => {
    const [decision] = decide(
      { now: "2026-11-04T09:00:00Z", escalateAfterHours: 24 },
      [signal({ severity: "critical", due: "2026-11-01T09:00:00Z", requiresApproval: false })],
    );
    expect(decision.action).toBe("escalate");
    expect(decision.reason).toMatch(/overdue/i);
  });

  it("waits during quiet hours for a non-critical item", () => {
    const [decision] = decide(
      { now: "2026-11-04T23:00:00Z", quietHours: ["20:00", "07:00"] },
      [signal({ due: "2026-11-20", severity: "high" })],
    );
    expect(decision.action).toBe("wait");
    expect(decision.reason).toMatch(/quiet/i);
  });

  it("respects a snooze", () => {
    const [decision] = decide(
      { now: "2026-11-04T09:00:00Z", feedback: { "risk:1": { state: "snoozed", until: "2026-11-05T09:00:00Z" } } },
      [signal()],
    );
    expect(decision.action).toBe("wait");
    expect(decision.reason).toMatch(/snoozed/i);
  });

  it("caps interruptions with the budget", () => {
    const decisions = decide(
      { now: "2026-11-04T09:00:00Z", interruptionBudget: 1 },
      [signal({ id: "risk:1" }), signal({ id: "risk:2" }), signal({ id: "risk:3" })],
    );
    expect(decisions.filter((item) => item.action !== "wait")).toHaveLength(1);
  });

  it("learns from outcomes", () => {
    const log = new OutcomeLog();
    expect(log.adjustment("risk")).toBe(0);
    log.record({ candidateId: "risk:1", action: "guide", result: "helped", at: "2026-11-04T09:00:00Z" });
    expect(log.adjustment("risk")).toBeGreaterThan(0);
    expect(log.acceptanceRate()).toBe(1);
  });

  it("maps RECALL items to LAIX signals and back to UI fields", () => {
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
    expect(toSignal(item).requiresApproval).toBe(true);
    expect(toSignal(item).severity).toBe("high");
    const result = decideAttention([item], { now: new Date("2026-11-04T09:00:00Z") });
    expect(result.decisions[0].signalId).toBe("risk:1");
    expect(result.items[0].laix_action).toBe("guide");
    expect(result.items[0].laix_score).toBeGreaterThan(0);
    expect(result.items[0].laix_reason).toBe(result.decisions[0].reason);
  });

  it("maps LAIX result to the item fields without showing notify", () => {
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
    const result = decideAttention([item], { now: new Date("2026-11-04T09:00:00Z") });
    expect(result.items[0].laix_action).toBe("guide");
    expect(result.items[0].laix_action).not.toBe("notify");
  });

  it("merges analysis and rule items without dropping the base", () => {
    const base: AttentionItem[] = [
      {
        id: "promise_due:m1",
        kind: "promise_due",
        severity: "high",
        title: "Promise is due",
        detail: "m1",
        why: "due",
        meeting_id: "m1",
        route: "/meetings/m1",
        action_label: "Open",
        confidence: 0.9,
        score: 80,
      },
      {
        id: "consent_gap:m2",
        kind: "consent_gap",
        severity: "critical",
        title: "Consent missing",
        detail: "m2",
        why: "no consent",
        meeting_id: "m2",
        route: "/meetings/m2",
        action_label: "Review",
        confidence: 1,
        score: 100,
      },
    ];
    const analysis: AttentionItem[] = [
      {
        id: "risk:m1:1",
        kind: "risk",
        severity: "high",
        title: "Runbook risk",
        detail: "m1",
        why: "blocked",
        meeting_id: "m1",
        route: "/meetings/m1?tab=intelligence",
        action_label: "Review",
        confidence: 0.9,
        score: 98,
      },
    ];
    const merged = mergeAttention(base, analysis, ["m1"]);
    expect(merged.some((item) => item.id === "risk:m1:1")).toBe(true);
    expect(merged.some((item) => item.id === "consent_gap:m2")).toBe(true);
    expect(merged.some((item) => item.id === "promise_due:m1")).toBe(false);
  });
});

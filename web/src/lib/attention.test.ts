import { describe, expect, it } from "vitest";
import packJson from "../../public/demo-pack.json";
import type { AttentionFeedback, Pack } from "../types";
import { deriveAttention, nudgeMetrics } from "./attention";

const pack = packJson as unknown as Pack;
const meetings = pack.meetings;

describe("bounded attention", () => {
  it("derives evidence-linked items and ranks the urgent ones", () => {
    const items = deriveAttention(pack, meetings, pack.notes, pack.ppma.events, {}, { now: new Date("2026-10-30T09:00:00Z") });
    expect(items.length).toBeGreaterThan(3);
    expect(items.some((item) => item.kind === "unsent_handoff")).toBe(true);
    expect(items.some((item) => item.kind === "correction_needed")).toBe(true);
    expect(items.some((item) => item.kind === "redaction_review")).toBe(true);
    expect(items.every((item) => item.why.length > 0)).toBe(true);
    expect(items[0].score).toBeGreaterThanOrEqual(items[items.length - 1].score);
    expect(items[0].route.startsWith("/")).toBe(true);
  });

  it("suppresses dismissed, wrong and snoozed items", () => {
    const items = deriveAttention(pack, meetings, pack.notes, pack.ppma.events, {}, { now: new Date("2026-10-30T09:00:00Z") });
    const feedback: Record<string, AttentionFeedback> = {
      [items[0].id]: { state: "dismissed", at: "2026-10-30T09:00:00Z" },
      [items[1].id]: { state: "wrong", at: "2026-10-30T09:00:00Z" },
      [items[2].id]: { state: "snoozed", at: "2026-10-30T09:00:00Z", until: "2026-11-05T09:00:00Z" },
    };
    const filtered = deriveAttention(pack, meetings, pack.notes, pack.ppma.events, feedback, { now: new Date("2026-10-30T10:00:00Z") });
    expect(filtered.some((item) => item.id === items[0].id)).toBe(false);
    expect(filtered.some((item) => item.id === items[1].id)).toBe(false);
    expect(filtered.some((item) => item.id === items[2].id)).toBe(false);
    expect(filtered.length).toBeLessThan(items.length);
  });

  it("counts feedback without inventing a score", () => {
    const metrics = nudgeMetrics({
      a: { state: "accepted", at: "x" },
      b: { state: "accepted", at: "x" },
      c: { state: "dismissed", at: "x" },
      d: { state: "snoozed", at: "x" },
    });
    expect(metrics.accepted).toBe(2);
    expect(metrics.dismissed).toBe(1);
    expect(metrics.acceptance).toBeCloseTo(2 / 3);
  });

  it("never emits an action device outside the app", () => {
    const items = deriveAttention(pack, meetings, pack.notes, pack.ppma.events, {}, { now: new Date("2026-10-30T09:00:00Z") });
    expect(items.every((item) => item.action_label.length > 0)).toBe(true);
    expect(items.every((item) => item.route.startsWith("/"))).toBe(true);
  });
});

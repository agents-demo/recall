# @laix/attention

A small, UI-free **decision layer for the right moment**, extracted from RECALL's bounded attention
engine so LAIX can take it later.

It answers one question:

> Given a candidate intervention, the current context and the user's limits, should we
> **wait, notify, ask, act, verify or escalate**?

No React. No browser. No RECALL types. Pure TypeScript.

## What it is not

- not a model or an agent framework;
- not a scheduler;
- not a memory;
- not a UI.

It is the policy between "something happened" and "the product does something".

## North interface (what an app supplies)

| App supplies | Module returns |
|---|---|
| a candidate: what happened, severity, confidence, due date, evidence refs | one `Decision` per candidate |
| context: now, quiet hours, interruption budget, muted kinds, minimum confidence | the action, score, reason, evidence refs |
| user feedback and past outcomes | suppression, ranking and a learned adjustment |
| whether the action needs approval | `requiresApproval` |

```ts
import { decide, OutcomeLog } from "@laix/attention";

const decisions = decide(
  {
    now: new Date(),
    quietHours: ["20:00", "07:00"],
    interruptionBudget: 3,
    minConfidence: 0.6,
    feedback: { "risk:1": { state: "snoozed", until: "2026-11-01T08:00:00Z" } },
  },
  [
    {
      id: "risk:1",
      kind: "risk",
      title: "Runbook is needed before the pilot",
      severity: "high",
      confidence: 0.92,
      due: "2026-11-05",
      evidenceRefs: ["ev_12"],
      requiresApproval: true,
      interruptionCost: 0.4,
    },
  ],
);
// decisions[0] = { action: "ask", score: ..., reason: ..., evidenceRefs: [...], ... }
```

## Decision actions

| Action | Meaning |
|---|---|
| `wait` | hold; do not interrupt |
| `notify` | surface it, no decision required |
| `ask` | ask the user / owner |
| `act` | execute a reversible, approved action (only when `allowAct` is true) |
| `verify` | check the result |
| `escalate` | hand to a human |

## Policy

The score is deliberately inspectable:

```
severity + due urgency + confidence - interruption cost + learned adjustment
```

Defaults: notify at 48, ask at 72, escalate at 92. All configurable. Critical items always reach a
human. Quiet hours hold non-high, non-urgent items. The interruption budget is a hard cap.

## Outcome learning

`OutcomeLog` is a small, bounded learner: `helped` raises the score for that kind, `hurt` lowers it.
It is not a bandit yet; it is the interface where a LAIX bandit can replace it.

```ts
const log = new OutcomeLog();
log.record({ candidateId: "risk:1", action: "ask", result: "helped", at: new Date().toISOString() });
log.acceptanceRate(); // 1
```

## Non-goals

- It never sends, deletes or executes anything by itself. The execution bridge is LAIX/platform.
- It never stores memory. PPMA owns memory.
- It never renders. The app owns the UI.

## RECALL as the first reference app

RECALL converts its attention items into candidates and uses the decisions to label/suppress them.
The evidence refs and human approval are already in RECALL; this module supplies the timing policy.

## Tests

Package-local contract tests use Node's built-in test runner with TypeScript type stripping:

```bash
cd packages/laix-attention
npm test
```

The CUE conformance report is a separate, non-failing command:

```bash
npm run conformance
```

It writes [`CONFORMANCE.md`](CONFORMANCE.md).

# LAIX extraction — what was taken out of RECALL

RECALL was rebuilt so two pieces can be lifted into LAIX without dragging the app with them:

| Package | What it is | Why LAIX |
|---|---|---|
| [`packages/laix-attention`](../packages/laix-attention/README.md) | a UI-free policy: wait / notify / ask / act / verify / escalate | LAIX is the layer that decides **when** to act |
| [`packages/laix-decision-record`](../packages/laix-decision-record/README.md) | a portable record: what, why, evidence, approval, audit, undo, fingerprint | LAIX/Max already needs a **decision record** |

Both are pure TypeScript. No React, no browser storage, no RECALL types, no PPMA memory.

## The boundary

```
LAIX        decides when and how to intervene
PPMA        remembers what matters over time and owns project state
RECALL      captures, proves, records the decision, and shows the evidence
```

That is the only version of RECALL that is complementary rather than a second PPMA.

## 1. `laix-attention`

North interface:

| App supplies | Module returns |
|---|---|
| candidates: severity, confidence, due, evidence refs, interruption cost | one decision per candidate |
| context: now, quiet hours, interruption budget, mute list, minimum confidence | action, score, reason, evidence refs |
| feedback and past outcomes | suppression, ranking, learned adjustment |

Actions: `wait`, `notify`, `ask`, `act`, `verify`, `escalate`.

The policy is inspectable:

```
severity + due urgency + confidence - interruption cost + learned adjustment
```

Defaults: notify at 48, ask at 72, escalate at 92. Critical items always reach a human. Quiet hours
and the interruption budget are hard constraints. `OutcomeLog` learns from `helped / no_effect /
hurt`; a LAIX bandit can replace it behind the same interface.

RECALL uses it in `web/src/lib/laixAttention.ts`: every attention item becomes a candidate and gets a
`LAIX · ask` / `LAIX · notify` label on Home.

## 2. `laix-decision-record`

Lifecycle:

```
draft --approve--> approved --execute--> executed --undo--> undone
  |
  +--reject--> rejected
```

Rules:

- at least one evidence ref with `id` and `quote` is required;
- only a draft can be approved or rejected;
- only approved records can be executed;
- every transition appends an audit event and re-seals the fingerprint;
- `verifyRecord` detects tampering.

`hash` is an FNV-1a 64-bit content fingerprint, not a cryptographic signature. A LAIX deployment
that needs signatures wraps it with its own key.

RECALL creates one record when a human approves the agent's findings. It carries the decision
summary, every quote as evidence, the approver and the audit trail. The Intelligence tab shows the
record and its fingerprint.

The JSON Schema is at
[`packages/laix-decision-record/schema/decision-record.schema.json`](../packages/laix-decision-record/schema/decision-record.schema.json).

## What was deliberately not extracted

| Not extracted | Why |
|---|---|
| transcript analysis | It belongs to PPMA/LAIX, not the capture layer |
| PPMA memory and project state | PPMA owns them |
| React pages and components | The app owns its experience |
| consent/redaction UI | It can become a policy adapter later, not a LAIX core |
| the local bridge | Deployment plumbing, not a decision layer |

## How LAIX can take the packages

1. Copy `packages/laix-attention` and `packages/laix-decision-record` into the LAIX repository.
2. Keep the exported types and the action/status enums.
3. Replace `OutcomeLog` with the LAIX bandit, preserving `adjustment(kind)`.
4. Replace the fingerprint with a signed hash if the deployment needs signatures.
5. Point the LAIX app at the same north interface; no RECALL import is required.
6. Move the contract tests with the packages; they are already independent of the app.

## Verification

- `packages/laix-attention`: 11 package tests; `packages/laix-decision-record`: 6 package tests.
- `packages/laix-attention/CONFORMANCE.md`: 23 CUE vectors compared; **7 pass, 16 fail**, reported by
  mismatch class. This is evidence, not a gate.
- `web/src/lib/laix.attention.test.ts` and `web/src/lib/laix.decisionRecord.test.ts` remain the app
  adapter tests.
- `web` build passes with the packages imported through Vite aliases.
- The app shows `LAIX · ask/notify` on Home and a `LAIX decision record` after approval.

## App residue removed

`meetingId` is no longer a field of `DecisionRecord` or `CreateDecisionInput`. RECALL passes it as
`metadata.meetingId` in the app adapter.

## What is still missing for LAIX

- a named LAIX owner for the packages;
- a decision on whether LAIX or PPMA owns experience state (open question in LAIX interfaces);
- a real evaluation set for interruption precision;
- a signature/key story for the record;
- removing RECALL's own analysis, which still duplicates PPMA/LAIX.

Until those are decided, the packages are a clean extraction, not an integration.

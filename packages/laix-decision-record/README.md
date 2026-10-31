# @laix/decision-record

A storage-free, UI-free record of **one decision**:

> **what** was decided · **why** · **which evidence** · **who approved** · **what can be undone**.

Extracted from RECALL's approval/evidence/audit model so LAIX can take it later. No React, no
database, no RECALL types.

## Why

LAIX already says the reference app Max needs a **decision record** (what, why, evidence, undo) and a
**grounding and safety gate**. This package is the smallest reusable implementation of the record
half. RECALL already has the evidence and approval workflow; this makes it portable.

## Shape

```ts
interface DecisionRecord {
  id: string;
  version: 1;
  meetingId?: string;
  title: string;
  summary: string;
  decision: { text: string; confidence: number; rationale?: string };
  evidence: EvidenceRef[];
  alternatives: string[];
  approval: { required: boolean; state: "pending" | "approved" | "rejected"; by?: string; at?: string; note?: string };
  status: "draft" | "approved" | "rejected" | "executed" | "undone";
  createdAt: string;
  updatedAt: string;
  audit: AuditEvent[];
  undo: { available: boolean; how?: string; at?: string };
  metadata: Record<string, unknown>;
  hash: string;
}
```

## Lifecycle

```
draft --approve--> approved --execute--> executed --undo--> undone
  |
  +--reject--> rejected
```

Rules:

- a record cannot be created without at least one evidence ref with an `id` and a `quote`;
- only a **draft** can be approved or rejected;
- only an **approved** record can be executed;
- only approved/executed records can be undone, and only when `undo.available`;
- every transition appends an audit event and re-seals the content fingerprint.

## Fingerprint

`hash` is an FNV-1a 64-bit fingerprint of the canonical record (sorted keys, no undefined). It is a
**tamper-evident content fingerprint, not a cryptographic signature**. A LAIX deployment that needs
signatures should wrap it with its own key.

`verifyRecord(record)` returns false if any content changed without re-sealing.

## API

```ts
import { createDecisionRecord, approveRecord, markExecuted, undoRecord, verifyRecord } from "@laix/decision-record";

let record = createDecisionRecord({
  title: "Helios rollout readiness review",
  decision: "Hold the enterprise pilot on 4 November; move self-serve onboarding to 18 November.",
  confidence: 0.94,
  meetingId: "mtg_1",
  evidence: [
    { id: "ev_3", kind: "decision", quote: "Then we hold the enterprise pilot on the fourth…", speaker: "Dana Whitfield", start: 68 },
  ],
  requiresApproval: true,
});

record = approveRecord(record, { by: "owner", note: "Approved after reviewing the quote." });
record = markExecuted(record, { by: "ppma", note: "Project state updated." });
verifyRecord(record); // true
```

## Non-goals

- not a database; persist the JSON yourself;
- not a workflow engine;
- not a cryptographic signature;
- not a UI.

## RECALL as the first reference app

RECALL creates one record when a human approves the agent's findings. The record carries the
decision summary, every quote as evidence, the approver and the audit trail. The app stores the JSON
and shows the fingerprint. LAIX can take the package and the record unchanged.

## Tests

Contract tests live in `web/src/lib/laix.decisionRecord.test.ts` so they run with the app's Vitest
setup; move them next to the package when it is extracted.

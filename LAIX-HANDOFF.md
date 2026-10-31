# LAIX handoff v1

Two packages extracted from RECALL, plus the evidence needed to decide what LAIX should take.

- **Branch:** `laix/handoff-v1`
- **Tag:** `laix-handoff-v1`
- **Handoff commit:** resolve with `git rev-parse laix-handoff-v1^{commit}` (the tag points to the commit that contains this file)
- **CUE contract used for comparison:** `laix-attention` v1.1.0, CUE commit `a4c6bef885fe0d59a1885656a801c5478cc1be11`

## Packages

| Package | Path | Source lines | Test lines |
|---|---|---|---|
| `@laix/attention` | `packages/laix-attention` | 298 (`src/index.ts`) | 93 (`test/*.test.ts`) |
| `@laix/decision-record` | `packages/laix-decision-record` | 242 (`src/index.ts`) | 109 (`test/*.test.ts`) |

Both are **private**, **dependency-free** and **side-effect free**. They have no React, no browser
storage, no PPMA and no RECALL types.

## Public API

### `@laix/attention`

```ts
decide(context, candidates, options?) -> Decision[]
isQuietHours(now, quietHours) -> boolean
new OutcomeLog(initial?) -> { record, all, adjustment, acceptanceRate }
```

Actions: `wait`, `notify`, `ask`, `act`, `verify`, `escalate`.
Types: `Candidate`, `Context`, `Decision`, `Outcome`, `Feedback`, `Severity`, `OutcomeResult`.

### `@laix/decision-record`

```ts
createDecisionRecord(input, options?) -> DecisionRecord
approveRecord(record, { by, at?, note? }) -> DecisionRecord
rejectRecord(record, { by, at?, note? }) -> DecisionRecord
markExecuted(record, { by, at?, note? }) -> DecisionRecord
undoRecord(record, { by, at?, reason?, how? }) -> DecisionRecord
verifyRecord(record) -> boolean
fingerprint(value) -> string
canonical(value) -> string
evidenceFromQuotes(quotes) -> EvidenceRef[]
```

Types: `DecisionRecord`, `EvidenceRef`, `Approval`, `AuditEvent`, `Undo`, `RecordStatus`.

`meetingId` is **not** part of the public record. RECALL passes it through `metadata.meetingId`.

## Dependencies

**Runtime dependencies: none.** No `dependencies`, no `peerDependencies`. The packages are pure
TypeScript. The package-local tests use Node's built-in test runner and `--experimental-strip-types`
(Node 22+); the app compiles them through Vite/TypeScript.

## Generic vs app-specific

| Generic to LAIX | Specific to RECALL |
|---|---|
| candidate → decision policy | mapping RECALL attention items to candidates |
| quiet hours, interruption budget, min confidence | evidence routes and meeting links |
| wait / notify / ask / act / verify / escalate | UI labels (`LAIX · ask`) and Home placement |
| outcome learning interface | storing feedback in the app vault |
| record lifecycle, approval, audit, undo | when to create a record on human approval |
| content fingerprint and canonical JSON | local persistence and meeting metadata |

## Files that import the packages

- `web/src/lib/store.tsx` — `@laix/decision-record` (`createDecisionRecord`, `approveRecord`, types)
- `web/src/lib/laixAttention.ts` — `@laix/attention` (`decide`, types)
- `web/src/lib/laix.attention.test.ts` — `@laix/attention`
- `web/src/lib/laix.decisionRecord.test.ts` — `@laix/decision-record`
- package-local tests under `packages/*/test`

The app adapter that LAIX should keep is `web/src/lib/laixAttention.ts`. It owns the RECALL-specific
mapping and the `mergeAttention()` dedupe.

## Conformance with CUE

CUE contract: 23 behavioural vectors, v1.1.0, commit `a4c6bef`.

**Result: 7 pass, 16 fail.** This is a report, not a gate. The contract is not final and the two
implementations use different score scales and context extensions.

| Mismatch class | Count |
|---|---|
| threshold | 7 |
| suppression | 7 |
| verb mapping | 2 |

Notable differences:

- CUE notifies a critical at night; the TS policy escalates unless approval is required.
- CUE waits for a high item at night; the TS policy treats high as exempt from quiet hours.
- CUE suppresses `accepted` and `assigned`; the TS policy currently does not.
- CUE has `minSeverity`, `sent`, `stopped`, `learned`, `escalateAfterHours`; the TS policy does not.
- CUE `act` requires `intent`; the TS policy uses `requiresApproval`/`reversible` and `allowAct`.
- CUE quiet-hours end is inclusive; the TS policy is exclusive.

Full table: [`packages/laix-attention/CONFORMANCE.md`](packages/laix-attention/CONFORMANCE.md).

**Do not force agreement.** The differences need a product decision on the canonical LAIX contract.

## Deterministic replay fixtures

- `packages/laix-attention/fixtures/replay.json` — 4 cases (ask, quiet wait, critical escalate, snoozed wait), fixed `now`, no random IDs. Package test verifies action, score, delivery and reason.
- `packages/laix-decision-record/fixtures/replay.json` — create → approve → execute → undo, fixed `now` and `id`. Package test verifies each status and the fingerprint.

No wall-clock values or random IDs are generated in the fixtures.

## Fingerprint limitation

`hash` is **FNV-1a 64-bit over canonical JSON**. It is a content fingerprint: useful to detect
accidental or naive mutation, **not a cryptographic signature**. LAIX needs its own key/signature
story before the record can be treated as tamper-proof.

## Known gaps

1. **Signature/key story** — no signing key, no key rotation, no trust anchor.
2. **Score-scale divergence** — CUE and TS scores are not comparable; conformance reports deltas.
3. **`meetingId` removal** — moved to `metadata.meetingId`; done in the package and app.
4. **Feedback semantics** — `accepted`/`assigned` differ from CUE; needs a canonical decision.
5. **Unsupported CUE context** — `minSeverity`, `sent`, `stopped`, `learned`, `escalateAfterHours`.
6. **Quiet-hours boundary** — TS end is exclusive; CUE is inclusive.
7. **RECALL still has its own analysis** — this duplicates PPMA/LAIX and should be removed when the
   boundary is agreed. The packages do not solve that.

## Exact extraction steps

1. Copy `packages/laix-attention` and `packages/laix-decision-record` into the LAIX repository.
2. Keep the exported types and action/status enums as the public contract.
3. Keep `web/src/lib/laixAttention.ts` as the RECALL adapter (do not move it into LAIX).
4. Switch the Vite aliases in `web/vite.config.ts` and `web/tsconfig.json` to the LAIX package paths
   when the packages move:
   ```ts
   "@laix/attention": "<lAIX>/packages/laix-attention/src/index.ts",
   "@laix/decision-record": "<lAIX>/packages/laix-decision-record/src/index.ts",
   ```
5. Move the package-local tests with the packages. Keep the web adapter tests in RECALL.
6. Decide the canonical contract for CUE vs TS before changing either policy.
7. Replace the FNV fingerprint with a signature if the deployment requires it.

## Test commands

```bash
cd packages/laix-attention && npm test
cd packages/laix-decision-record && npm test
cd packages/laix-attention && npm run conformance
cd web && npm test && npm run build
cd server && npm test
```

Expected: 11 attention package tests, 6 decision-record package tests, 39 web tests, 8 server tests,
conformance report 23 cases (7 pass / 16 fail by action+suppression).

## What LAIX still has to decide

- who owns the packages;
- whether LAIX or the platform owns experience state after reconnect;
- the canonical action vocabulary and score scale;
- feedback semantics for `accepted` / `assigned`;
- the signing and key story;
- whether RECALL's duplicate transcript analysis is removed or moved behind PPMA/LAIX.

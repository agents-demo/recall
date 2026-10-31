# LAIX integration — one package, one boundary

RECALL uses the real **`laix@0.2.1`** package. The local copies of `@laix/attention` and
`@laix/decision-record` are gone.

```
RECALL attention item -> RECALL adapter -> LAIX decide -> RECALL UI
RECALL approval        -> LAIX decision record        -> RECALL UI
```

## Ownership

| Layer | Owns |
|---|---|
| **LAIX** | attention decision, verbs, timing, outcome log, decision record, approval/audit/undo contract |
| **RECALL** | capture, transcript, evidence routes, meeting links, storage, UI, PPMA integration |

LAIX does not know what a meeting is. RECALL does not implement a second decision policy.

## Dependency

- Package: `laix@0.2.1`
- Tarball: `vendor/laix-0.2.1.tgz`
- `web/package.json`: `"laix": "file:../vendor/laix-0.2.1.tgz"`
- SHA-256:

```
B5D231F513D617E0C9E48402738EA00ADB6358D5FCF68D5159B30E7C39F288ED
```

The tarball is pinned and committed. Nothing is published.

## Adapter boundary

`web/src/lib/laixAttention.ts` is the only place RECALL maps its attention model onto LAIX:

- `toSignal(item)` maps a RECALL `AttentionItem` to a LAIX `Signal`;
- `decideAttention(items, input)` maps settings to `Context`, records RECALL outcomes in
  `OutcomeLog`, passes per-kind `context.learned` adjustments, calls `decide(context, signals)`,
  then maps `Decision.signalId` back to the attention item id;
- `mergeAttention` remains the app-side dedupe between analysis items and rule items;
- the adapter sets `laix_action`, `laix_reason` and `laix_score` on the item;
- LAIX’s `guide` is shown as **`LAIX · guide`**. `notify` is no longer a LAIX action and is not shown.

The app keeps the evidence route, the attention list, the UI and the decision-record rendering.
`web/src/lib/store.tsx` imports `createDecisionRecord`, `approveRecord`, `DecisionRecord` and
`EvidenceRef` directly from `laix`.

The decision record has no `meetingId` field. RECALL passes it as `metadata.meetingId`, alongside
`metadata.evidenceDetails` (speaker/time) that the generic LAIX evidence ref does not carry.

## Type bridge

LAIX publishes TypeScript source, not a compiled `.d.ts`. The web app keeps a types-only declaration
bridge at `web/src/types/laix.d.ts` and maps `"laix"` to it in `tsconfig.json`. Vite still bundles the
real package from `node_modules/laix`; the bridge only keeps `tsc` from checking the dependency's own
source. It contains no runtime code and no second policy.

## Upgrade LAIX

1. Check out the new LAIX tag (do not move the tag).
2. Pack it into `vendor/`:
   ```powershell
   cd C:\Workspace\laix\typescript\laix
   npm pack --pack-destination C:\Workspace\openjiuwendemos\recall\vendor
   ```
3. Update `web/package.json` to the new `file:../vendor/laix-<version>.tgz`.
4. Update `vendor/README.md` with the tag, command and SHA-256.
5. Update `web/src/types/laix.d.ts` if the public types changed.
6. Run `npm install`, `npm test`, `npm run build`, `npm run lint` in `web`.
7. Run the browser checks on Home, Intelligence and the decision record.

## Known differences from the removed local package

- `Signal` replaces `Candidate`; `decision.signalId` replaces `candidateId`.
- `guide` replaces `notify`; `observe` is an additional LAIX verb.
- LAIX severity includes `medium`/`low`; the adapter maps RECALL `warning` to `medium`.
- Scores are LAIX’s scale, not the old local scale.
- `EvidenceRef` carries `id`, `kind`, `quote`, `confidence`, `source`; RECALL keeps speaker and time
  in `metadata.evidenceDetails`.
- `Context` supports `minSeverity`, `sent`, `stopped`, `escalateAfterHours` and `learned`; the adapter
  currently passes the fields RECALL has and the computed learned adjustments.

## Tests

- `web/src/lib/laix.attention.test.ts` — real `decide`, `guide`, `signalId`, quiet hours, snooze,
  budget, learning, adapter mapping and merge.
- `web/src/lib/laix.decisionRecord.test.ts` — lifecycle against the real `laix` record API.
- `web/src/lib/laix.packaging.test.ts` — local packages absent; only `laix` imported; vendored
  dependency present.

```bash
cd web
npm test
npm run build
npm run lint
```

## What is still not solved

- The fingerprint is a content hash, not a signature.
- The canonical score scale and CUE-vs-TS differences remain a LAIX product decision.
- RECALL still has its own transcript analysis; that remains a PPMA/LAIX boundary question.

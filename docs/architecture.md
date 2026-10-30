# RECALL — Architecture

**Status.** Implemented as a static, offline demo with a deterministic synthetic pack and a local PPMA
fake. This document separates what the demo actually runs from the production swap points.

## 1. Shape

```
web/                         Vite + React + TypeScript static app
  src/
    App.tsx                  hash router; /stage is a full-screen route, the rest use Shell
    lib/store.tsx            consent gate, persistence, event pipeline, PPMA fake, queue
    lib/engine.ts            search, answer policy, corrections, redaction, tombstones, payloads
    lib/engine.test.ts       12 contract/recall tests
    lib/i18n.ts              English / Simplified Chinese UI chrome
    components/             Shell, command palette, icons, waveform, primitives
    pages/                  Home, Stage, Booth, Record, Meetings, Meeting, Recall, PPMA,
                            Pilot, Admin, Health, Field, Settings, Design, About
  public/
    demo-pack.json           deterministic synthetic pack (generated)
    sw.js                    offline shell
    favicon.svg              app mark
  src/styles.css             tokens, shell, primitives, home, record, meetings, workspace
  src/styles-more.css        stage, recall, PPMA, pilot, admin, health, field, settings, design
scripts/build_demo_pack.py   deterministic pack generator (fixed seed, no network)
docs/                        concept, roadmap, contract, architecture, provenance
.github/workflows/           CI and GitHub Pages
```

No backend is required for the public surface. The same `web/dist` can be served from a USB stick, a
local folder or GitHub Pages.

## 2. The stage state machine

```
cold → recording → search → quote → trust → choice → handoff
  ↑                                                     │
  └──────────────────── reset (R) ──────────────────────┘
```

Each beat is deterministic. The recording beat reveals eight scripted transcript rows; the search beat
filters the same pack; the quote beat shows text confidence 93% and attribution confidence 71%; the trust
beat emits `capture.correction`; the choice beat optionally emits `capture.redaction.applied`; the handoff
emits `capture.meeting.completed`. `resetStage()` removes the events, memory and patches for that capture
and returns the project state to the pre-handoff text, so the next run is identical.

The stage route renders without the app shell. Space/Enter advances, R resets, Esc exits. Reset is under
five seconds.

## 3. Domain model

`Meeting` is the capture: participants, consent, utterances, extracted decisions/actions/questions,
evidence items, redactions, retention, provenance and a PPMA pointer. `Evidence` is the atomic proof:

```
quote · speaker_id · start · end · confidence · attribution_confidence
utterance_id · sensitivity · redaction_id
```

`Redaction` is a first-class object with `detected` and `applied` states. `Note` is the field capture.
`PpmaEvent` uses the contract envelope and a delivery block. `MemoryEntry` is what the local PPMA fake
stores. Everything is generated into `web/public/demo-pack.json` by the Python script.

## 4. Store and invariants

The store (`lib/store.tsx`) is the only writer. It persists:

```
corrections · redaction patches · tombstones · consent overrides · retention overrides
events · PPMA memory · commands · imported captures · field notes · audit · project state
settings (theme, language, role, reduced motion, endpoint online) · kill switch · last replay
```

Derived meetings apply patches in order: corrections → redactions → consent → retention → delivery
status → tombstone. Tombstones win last.

**Invariants enforced in code and tests**

1. **No consent, no event.** `consentGate()` blocks `capture.meeting.completed` when consent is not
   `granted`. The only exception is `capture.consent.changed`, which reports the withdrawal itself.
2. **No raw media by default.** `meetingPayload()` includes text, evidence pointers, consent, confidence
   and provenance, and `media_included: false`. The audio never enters an event.
3. **Redaction is a safe-version transform.** `safeMeeting()` replaces any detected/applied passage with
   its `safe_text` before the payload leaves the device. `safeQuote()` is the only rendering path for
   shared evidence.
4. **Corrections are new events.** A correction never silently mutates an already-delivered event. It
   carries before/after, reason and actor, and the PPMA memory records the correction.
5. **Deletion is a tombstone.** `tombstoneMeeting()` clears transcript/evidence but preserves the fact of
   deletion, reason, scope and hash-derived tombstone id. Replaying an old completion cannot resurrect
   content because the local tombstone wins and the PPMA memory is retired.
6. **Legal hold overrides deletion.** `deleteMeeting()` refuses when `retention.legal_hold` is true and
   tells the user why.
7. **Idempotency.** `event_id` is derived deterministically from the event seed. `dedupeEvent()` rejects a
   duplicate before it reaches the inbox; replay is logged and refused.
8. **Offline queue.** If the endpoint is offline or the kill switch is on, events are stored with
   `delivery.status = "queued"`. `flushQueue()` delivers in order, updates memory and audit, and reports
   the count.

## 5. PPMA event pipeline

| UI action | Event | Payload highlights |
|---|---|---|
| Start recording | `capture.recording.started` | capture id, mode, device, consent state, jurisdiction |
| Stop and send | `capture.meeting.completed` | participants, summary, decisions, actions, questions, evidence, consent, redactions, provenance, pointer |
| Field note | `capture.note.created` | text, location, OCR, evidence ref, consent |
| Correct speaker/text/item | `capture.correction` | target, field, before/after, names, reason, actor |
| Apply redaction | `capture.redaction.applied` | evidence id, reason, safe text, actor |
| Delete memory | `capture.memory.deleted` | capture id, scope, reason, actor, timestamp |
| Withdraw consent | `capture.consent.changed` | state, reason, effective time |
| PPMA command | `capture.forget` / `capture.apply_retention` | handled by the command inbox |

Delivery updates memory by type:

- completion → replace the capture's memory with derived decisions/actions/questions/promise;
- correction → annotate the affected memory and keep the audit;
- redaction → replace the affected memory text with the safe version and mark it redacted;
- deletion → retire the memory and keep a tombstone;
- consent change → suppress the memory;
- note → add a field-note memory.

The local fake implements deduplication, replay refusal, backpressure limits, dead-letter display and
per-team credentials. See `docs/integration-ppma.md`.

## 6. Search and answer policy

`searchPack()` scores evidence rows and transcript rows locally. A transcript row that is linked to
evidence is promoted to the evidence hit, so every result opens the exact timestamp. Notes are searched
by title, text and OCR.

`answerQuestion()` is deliberately not a prompt. It:

1. tokenises the question and removes stop words;
2. searches local captures and notes;
3. keeps evidence hits with provenance;
4. refuses when there are none;
5. composes an answer from the top hit with citations and confidence;
6. exposes the trace: read, search, keep, filter, answer.

No web call, no model memory, no uncited claim. Redacted text is replaced by the safe version. This is
why the demo can show a refusal for “What is the capital of France?” next to a cited answer about the
14th.

## 7. Security and privacy in the demo

| Concern | Demo | Production swap |
|---|---|---|
| Local state | `localStorage`, cleared by Reset | SQLite/SQLCipher or platform keystore, AES-256-GCM |
| Audio | not included; timeline is a visualisation | local encrypted file store, never uploaded by default |
| Auth | role selector | OIDC/Entra ID, per-device app token, SCIM groups |
| Event signing | envelope fields and hashes | device key signature, rotation and recovery |
| Audit | local append-only list + CSV export | append-only audit store + export API |
| Retention | per-meeting date + legal hold | policy engine, background expiry, deletion proof |
| Sync | single browser | encrypted device-to-device sync, conflict handling |
| Billing | reference data | subscription provider, seat counts, invoices |
| PPMA | deterministic local fake | real north contract endpoint with retries and dead letter |

The UI never claims that the demo is production-certified. The roadmap and README make the same
distinction.

## 8. Offline and deployment

- `base: "./"` so the build works under `/recall/` or any folder.
- `web/public/sw.js` precaches the shell and `demo-pack.json`; navigations fall back to `index.html`.
- All fonts are bundled; icons are in-house SVG; there are no external URLs in the runtime.
- GitHub Pages workflow type-checks, tests, builds and deploys `web/dist`.
- CI regenerates the pack and fails if the committed pack is not reproducible.

## 9. Accessibility

- Keyboard paths: ⌘K / Ctrl K, `/`, G-sequences, Space/R on stage, arrows on the waveform.
- Focus-visible rings, labelled controls, `aria-live` transcript region, `role="switch"` toggles.
- Reduced motion via the in-app toggle and `prefers-reduced-motion`.
- High-contrast theme and semantic labels that do not rely on colour alone.
- Mobile bottom navigation and large touch targets on the field surface.

## 10. Known limits (on purpose)

- The public build does not open the microphone or run a real ASR model.
- The local PPMA fake is a deterministic simulation, not a network service.
- Multi-device sync, OIDC and billing are surfaces with named swap points, not live integrations.
- Redaction is reviewable by a human; it is not advertised as safe without review.
- The pilot metrics are reference values; they are not field measurements.

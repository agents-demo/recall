# PPMA × RECALL — integration contract

**Purpose.** RECALL is the capture and evidence layer. PPMA is the living project memory and action
layer. This document defines the boundary so the two products complement each other instead of
competing.

**Status.** Implemented contract in the RECALL demo. The local PPMA fake exercises every event and command; the manifest, payloads and conformance checks below are the implementation contract. Native production wiring is described in [architecture.md](architecture.md). Aligns with PPMA North Contract v0.

**Names.** RECALL is the working product name. PPMA already has a planned memory view called `recall`.
To avoid collision:

- PPMA app id: `capture`
- Event prefix: `capture.*`
- PPMA memory view: `recall` (unchanged; a read API, not this app)

The external product name can change without changing the contract.

---

## 1. Division of labour

| Responsibility | RECALL | PPMA |
|---|---|---|
| Record audio/video/notes | **Owns** | Never |
| Transcribe, diarize, summarize | **Owns** | Consumes |
| Consent, redaction, media retention | **Owns** | Respects |
| Living project memory and state | Never | **Owns** |
| Tasks, calendar, email, missions | Never | **Owns** |
| Proactive action | Never | **Owns** |
| Evidence pack and exact quote | **Owns** | Links to it |

**Hard rule.** RECALL never creates tasks, schedules, sends messages, updates project state or runs
missions. PPMA never records, stores raw audio/video or becomes a recorder. If either crosses the line,
the products compete.

## 2. Direction of travel

```
RECALL capture
  → local transcript + consent + redaction
  → capture.meeting.completed
  → PPMA Ingestor / memory
  → project state change
  → PPMA proposes action
  → human approves
  → PPMA acts through the relevant app
```

The return path is read-only context:

```
PPMA memory updated
  → ppma.memory_updated
  → RECALL refreshes the project context around the meeting
```

## 3. App registration

RECALL registers as a north app with PPMA.

| Field | Value |
|---|---|
| `app_id` | `capture` |
| Display name | RECALL |
| Direction | events out; limited commands in |
| Event prefix | `capture.*` |
| Default sensitivity | `personal` |
| Resources | text and evidence pointers by default; encrypted media only on explicit opt-in |
| Auth | per-device app token, owner-scoped |

The manifest publishes the event types, their sensitivity labels, and whether each event reports
activity or carries a resource.

## 4. Events from RECALL to PPMA

All events use the PPMA envelope: `event_id`, `app_id`, `space`, `occurred_at`, `type`, `sensitivity`,
`payload`, optional `resources`, optional `provenance`.

### 4.1 `capture.recording.started`

Metadata only. No transcript, no audio.

```json
{
  "type": "capture.recording.started",
  "sensitivity": "personal",
  "payload": {
    "capture_id": "cap_01J...",
    "mode": "meeting",
    "device_id": "macbook-01",
    "consent_state": "granted",
    "jurisdiction": "DE",
    "participants_notified": true
  }
}
```

### 4.2 `capture.meeting.completed`

The main event.

```json
{
  "type": "capture.meeting.completed",
  "sensitivity": "personal",
  "payload": {
    "capture_id": "cap_01J...",
    "title": "Client delivery call",
    "started_at": "2026-10-30T09:00:00Z",
    "ended_at": "2026-10-30T09:42:00Z",
    "language": "en",
    "participants": [
      { "id": "p1", "name": "Anna", "role": "account lead" },
      { "id": "p2", "name": "Marek", "role": "delivery lead" }
    ],
    "summary": "Delivery date moved to the 14th; client asked for a written confirmation.",
    "decisions": [
      { "text": "Hold the 14th, not the 12th.", "evidence_id": "ev_01", "confidence": 0.91 }
    ],
    "action_items": [
      { "text": "Send written confirmation to the client.", "owner": "Anna", "due": "2026-10-31", "evidence_id": "ev_02" }
    ],
    "open_questions": ["Does the 14th include installation?"],
    "consent": {
      "state": "granted",
      "basis": "all_participants_notified",
      "evidence_ref": "consent_01"
    },
    "redactions": [
      { "range": "00:31:10-00:31:28", "reason": "internal_client_comment", "safe_text": "[redacted]" }
    ],
    "evidence": [
      { "id": "ev_01", "quote": "We can hold the 14th, but not the 12th.", "speaker_id": "p2", "start": "00:18:04", "end": "00:18:11", "confidence": 0.93 }
    ],
    "provenance": {
      "device": "macbook-01",
      "model": "asr-x.y",
      "app_version": "1.0.0",
      "audio_sha256": "…",
      "local_only": true
    }
  }
}
```

**Resources.** By default this event carries text and **evidence pointers**, not raw audio. The media
stays in RECALL. If the customer explicitly opts in, an encrypted media resource may be attached and
PPMA must respect the sensitivity label and retention policy.

### 4.3 `capture.call.completed`

Same shape as a meeting, with `mode: "call"` and optional phone-number hashes. Do not send raw phone
numbers unless the customer has opted in.

### 4.4 `capture.note.created`

A field note, photo note or observation.

```json
{
  "type": "capture.note.created",
  "sensitivity": "personal",
  "payload": {
    "note_id": "note_01J...",
    "text": "Client mentioned the 14th is tight because of the install crew.",
    "captured_at": "2026-10-30T10:12:00Z",
    "location": { "label": "Client site", "precision": "site" },
    "evidence_ref": "ev_03",
    "consent": { "state": "granted", "basis": "user_note" }
  }
}
```

### 4.5 `capture.correction`

The human corrected a speaker, quote or extracted item.

```json
{
  "type": "capture.correction",
  "sensitivity": "personal",
  "payload": {
    "capture_id": "cap_01J...",
    "target": "evidence:ev_01",
    "field": "speaker_id",
    "before": "p1",
    "after": "p2",
    "reason": "wrong speaker",
    "corrected_by": "user_01"
  }
}
```

PPMA must apply the correction to the memory entry and preserve the audit trail.

### 4.6 `capture.redaction.applied`

A passage was redacted before sharing.

```json
{
  "type": "capture.redaction.applied",
  "sensitivity": "personal",
  "payload": {
    "capture_id": "cap_01J...",
    "evidence_id": "ev_02",
    "reason": "client_confidential",
    "safe_text": "[redacted]",
    "redacted_by": "user_01"
  }
}
```

PPMA must replace any previously received unredacted text for that evidence with the safe version, or
mark it as redacted.

### 4.7 `capture.memory.deleted`

A tombstone. Deletion is not a silent drop.

```json
{
  "type": "capture.memory.deleted",
  "sensitivity": "personal",
  "payload": {
    "capture_id": "cap_01J...",
    "scope": "transcript+evidence",
    "reason": "user_request",
    "requested_by": "user_01",
    "deleted_at": "2026-10-30T12:00:00Z"
  }
}
```

PPMA must retire the memory entry and any derived summaries, and must not resurrect it from a later
replay.

### 4.8 `capture.consent.changed`

Consent is withdrawn or changed.

```json
{
  "type": "capture.consent.changed",
  "sensitivity": "personal",
  "payload": {
    "capture_id": "cap_01J...",
    "state": "withdrawn",
    "reason": "participant_request",
    "effective_at": "2026-10-30T12:00:00Z"
  }
}
```

PPMA must stop using the memory and follow its own deletion policy unless a legal hold applies.

## 5. Commands from PPMA to RECALL

Keep commands minimal. RECALL is an event source, not a task runner.

### 5.1 `capture.forget`

PPMA asks RECALL to delete a memory after a user `forget` correction or a retention decision.

```json
{
  "kind": "command",
  "target": "capture",
  "type": "capture.forget",
  "payload": {
    "capture_id": "cap_01J...",
    "scope": "all",
    "reason": "user_forget",
    "requested_by": "user_01"
  }
}
```

RECALL deletes the local transcript/evidence/media subject to legal hold, then emits
`capture.memory.deleted`.

### 5.2 `capture.apply_retention`

PPMA passes a retention policy for a capture.

```json
{
  "kind": "command",
  "target": "capture",
  "type": "capture.apply_retention",
  "payload": {
    "capture_id": "cap_01J...",
    "retain_until": "2027-10-30T00:00:00Z",
    "reason": "team_policy"
  }
}
```

RECALL applies the policy and reports the effective retention in provenance.

## 6. Sensitivity and flow policy

- Default label: `personal`.
- Explicit labels for `health`, `financial`, `legal` and `client_confidential`.
- The owner may override the label per event type; PPMA’s flow policy wins for egress.
- RECALL never sends raw media under a label that forbids egress.
- PPMA must show the source and sensitivity on every memory it derived from RECALL.

## 7. Consent

- No capture without a recorded consent state.
- Consent fields: state, basis, jurisdiction, participants notified, evidence reference.
- If consent is missing or withdrawn, RECALL must not emit a `capture.*` event.
- PPMA must suppress or delete memories whose consent is withdrawn.
- The consent UI and wording are RECALL’s responsibility; PPMA must not assume consent.

## 8. Deletion, correction and retention

- **Correction:** RECALL emits `capture.correction`; PPMA updates the memory and keeps the audit.
- **Redaction:** RECALL emits `capture.redaction.applied`; PPMA replaces or marks the unsafe text.
- **Deletion:** RECALL emits `capture.memory.deleted`; PPMA retires derived entries.
- **Forget:** PPMA sends `capture.forget`; RECALL deletes locally and confirms.
- **Retention:** both products keep separate policies; the stricter policy wins.
- **Legal hold:** overrides deletion; both products must show the hold.

## 9. Idempotency, ordering and offline

- Every event has a stable `event_id` and `occurred_at`.
- PPMA deduplicates by `event_id`.
- RECALL retries with exponential backoff; no event loss.
- PPMA down: RECALL keeps capturing and queues events locally.
- RECALL offline: local capture continues; sync when connected.
- Partial transcripts: emit `capture.meeting.completed` only after the transcript is usable, or emit a
  `capture.transcript.partial` event if both products support it.
- A correction after a completion is a new event, never a silent mutation.

## 10. Security and authentication

- Owner-scoped app token per device; rotate on uninstall.
- Local loopback by default; no inbound public exposure.
- Signed event payloads with a shared secret or device key.
- Encrypted local storage for audio, transcript and evidence.
- PPMA stores derived text, not raw media by default.
- Per-team isolation for team deployments.
- Audit of capture, share, redaction, deletion and PPMA delivery.

## 11. Joint UX

RECALL shows:

- “PPMA updated” after a successful event delivery,
- “PPMA unavailable — queued” when offline,
- the project/space a memory was sent to,
- a link to the PPMA project view.

PPMA shows:

- a “Source: RECALL” chip on every derived memory,
- a link to the evidence (opens RECALL at the exact timestamp if installed),
- the consent and redaction state,
- a correction/forget action that propagates back.

## 12. Non-goals

- RECALL does not create tasks, calendar events, emails or missions.
- RECALL does not own project state or the living memory.
- PPMA does not record, store raw media or become a recorder.
- No raw media in PPMA by default.
- No training on customer audio or transcripts.
- No automatic sharing without consent.
- No silent deletion.

## 13. Pilot metrics

- Capture-to-PPMA latency.
- Event acceptance and duplicate rate.
- Useful extraction rate judged by the team.
- Quote retrieval success.
- Consent coverage: 100% of captures have a recorded state.
- Redaction correctness and coverage.
- Deletion/correction propagation within one sync.
- PPMA action conversion: memories that led to a follow-up.

## 14. Contract change process

- Version the manifest with the app.
- Run PPMA conformance tests against the fake and real backends.
- Add event types; do not silently change payload semantics.
- Deprecate old fields with a migration window.
- Keep the `capture.*` prefix stable even if the product is renamed.

## 15. Open decisions

- Derived facts only, or encrypted media resources with explicit opt-in?
- Who owns retention: RECALL, PPMA or the customer policy?
- Is `capture.forget` enough, or does PPMA need a full legal-hold command?
- Does RECALL need to read PPMA memory views, or is `ppma.memory_updated` sufficient?
- Which consent model is the default in the first market?
- Is the external product name RECALL, or does the PPMA `recall` view force a rename?

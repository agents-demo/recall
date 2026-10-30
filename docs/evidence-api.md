# Safe evidence pack API

The demo exports evidence packs locally. This is the public API contract a production deployment would
expose for a PPMA workspace or a client portal. It never returns raw media; it returns the safe text, the
provenance and a signed pointer that resolves inside RECALL.

## `GET /v1/evidence/{evidence_id}`

Headers: `Authorization: Bearer <owner-scoped app token>`.

```json
{
  "evidence_id": "ev_01",
  "capture_id": "cap_01J9Q4M2R7X8K3N5V6B1C0D",
  "kind": "promise",
  "quote": "We can hold the 14th, but not the 12th.",
  "speaker": { "id": "p2", "name": "Marek Nowak", "role": "delivery lead" },
  "start": "00:11:24",
  "end": "00:11:29",
  "confidence": 0.93,
  "attribution_confidence": 1.0,
  "sensitivity": "client_confidential",
  "consent": { "state": "granted", "jurisdiction": "DE", "wording_version": "DE-2026-2" },
  "redactions": [{ "label": "Internal client comment", "safe_text": "[redacted]" }],
  "source": "recall://captures/cap_01J9Q4M2R7X8K3N5V6B1C0D#ev_01",
  "integrity": "sha256:…",
  "media_included": false,
  "provenance": {
    "device": "MacBook Pro 14 · M4",
    "asr_model": "parakeet-tdt-0.6b-int8",
    "diarization_model": "pyannote-3.1-mini",
    "app_version": "1.6.0",
    "local_only": true
  }
}
```

## `POST /v1/evidence/pack`

Request: `{ "evidence_ids": ["ev_01", "ev_02"], "format": "markdown" | "json" }`

Response: `200` with `pack_id`, `generated_at`, `markdown` or `json`, and `integrity`. The pack is generated
from the **safe** version only. A pack that includes a redacted passage records the redaction label, not
the original text.

## Rules

- Consent must be `granted`; otherwise `409 consent_withdrawn`.
- A tombstoned evidence id returns `410 gone` with the tombstone id and reason, never the content.
- Legal hold does not block a read of the safe pack; it blocks deletion.
- The token is owner-scoped and per-device; it cannot read another team's evidence.
- No raw audio or video endpoint exists in this contract.
- Every response includes the integrity hash; the client must not cache past a consent change.

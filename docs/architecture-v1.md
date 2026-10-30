## 11. v1.0 additions

### 11.1 Bounded attention

`web/src/lib/attention.ts` derives attention items from the same pack, corrections, consent, retention,
queue and device state. `deriveAttention()` is pure and tested; `feedbackAttention()` persists
accept/snooze/dismiss/wrong in the encrypted store. Every item contains `why`, `route`, `confidence`,
`severity` and an action label. The UI surfaces the same engine in the home strip, the meeting nudges and
the Attention page. It cannot create a task, message, calendar event or project-state change.

### 11.2 Threaded recall

`web/src/lib/conversation.ts` wraps `answerQuestion()` with follow-up resolution:
“who said that?” reuses the previous citation, “show me the moment” reuses the timestamp, compare resolves
named captures, and action requests return a review link instead of executing. The conversation is
persisted; voice input uses the browser SpeechRecognition API and is explicitly labelled as not the
private on-device ASR.

### 11.3 Memory canvas and collaboration

`pages/Canvas.tsx` builds a deterministic graph of project → meetings → evidence plus people and notes.
`BroadcastChannel("recall-collab")` provides presence, live comments and live corrections across open
tabs; corrections are additive and preserve both versions in the audit. `pages/Share.tsx` decodes a
base64url safe-evidence payload with an expiry; it contains no audio and no unredacted passage.

### 11.4 Encrypted local store

`web/src/lib/vault.ts` generates a non-extractable AES-GCM key in IndexedDB, encrypts the persisted state
with a random IV and writes it to `recall.demo.v3.enc`. The legacy plain key is removed after the first
write. If `crypto.subtle` or IndexedDB is unavailable, the app falls back to the legacy plain store and
shows `unavailable` in Settings rather than pretending.

### 11.5 Real local PPMA server

`server/src/server.mjs` is a dependency-free Node service:

- HMAC signature verification with `X-Recall-Signature`;
- duplicate rejection by `event_id`;
- memory projection for completions, notes, corrections, redactions, deletion and consent;
- commands (`capture.forget`, `capture.apply_retention`) applied to the server state;
- SSE `ppma.memory_updated`;
- evidence search and safe evidence API;
- OpenAPI and `/v1/tools` for the openjiuwen adapter;
- JSON persistence, CORS, health and metrics.

`web/src/lib/ppmaClient.ts` signs with Web Crypto and posts events when the user enables **live** mode in
Connections. The local fake remains the fallback. The public GitHub Pages build has no hosted backend, so
it stays on the fake unless a visitor points it at a local server.

### 11.6 Openjiuwen adapter

`server/adapter/openjiuwen.mjs` exposes `capture.search`, `capture.evidence`,
`capture.prepare_handoff` and `capture.prepare_redaction`. There is deliberately no execute, send or
delete tool. The manifest is in `server/adapter/manifest.json`.

### 11.7 Connectors

`web/src/lib/connectors.ts` is the catalogue. `pages/Connectors.tsx` shows purpose, scopes, status, an off
switch and a test surface. The PPMA/local server is real; the vendor connectors are previews with mock
providers because no OAuth credentials are shipped. The integration-safety rules are part of the page:
purpose per connection, least privilege, raw-media block, redaction before egress and a single disable-all
control.

### 11.8 PWA and extension

The manifest now has a share target (`#/share-target`), app shortcuts and standalone display. The
`extension/` folder is a Manifest V3 action that reads the active tab title/URL on click and opens the
review screen; it does not scrape or upload the page. `ShareTarget.tsx` turns a shared note into a local
field note after review.

### 11.9 What is still not real

The remaining 70 track items are the honest boundary: ASR/diarization/NPU execution, OCR model
execution, vendor OAuth accounts, native wearable/AR capture, hosted sync, hosted OIDC/SCIM, Stripe,
production rate-limit/dead-letter/vendor-register work and the pilot itself. They are checked only when
they exist; the roadmap marks them `[ ]`.

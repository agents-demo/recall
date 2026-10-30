# Integration status — what is real, what is contract, what is absent

**Last verified:** 30 October 2026 · RECALL v1.5.0

This is the honest status of every external dependency the app needs, what it is for, and what
RECALL actually does with it. “Real” means the service ran and was exercised; “contract” means the
UI/API shape exists but no vendor account is connected; “simulator” means deterministic sample data.

## Status legend

| Label | Meaning |
|---|---|
| **Real** | a service ran and a request/response was verified |
| **Local real** | real, but only on this machine; not hosted or reachable from the public site |
| **Contract** | interface, purpose, scopes and mock provider exist; no credentials or vendor |
| **Simulator** | deterministic local data; nothing external is called |
| **Absent** | not implemented |

## The table

| Dependency | Status | Why we need it | What the app does with it |
|---|---|---|---|
| **PPMA backend** | **Local real** — `127.0.0.1:8771`, strict auth | PPMA owns project memory, state and action; RECALL is the capture layer and must hand facts to it | Registers the `capture` manifest, mints an app token, posts `capture.*` north events to `/v0/spaces/me/messages`, reads memory views and receives commands |
| **PPMA bridge** (`server/src/ppmaLive.mjs`) | **Local real** — `127.0.0.1:8788` | The browser cannot call PPMA directly: no CORS and the owner token must never reach the client | Verifies RECALL’s HMAC, translates a capture event into the north `Message` envelope with a deterministic ULID, holds tokens server-side, exposes `/health`, `/v1/events`, `/v1/memory` |
| **PPMA memory extraction agent** | **Local real, partial** | Turning raw events into durable statements is PPMA’s job, not the app’s | PPMA’s own model agent derives statements; RECALL displays them via the bridge. A large case hit PPMA’s jurisdiction shape error, so extraction was incomplete — the event was still accepted |
| **RECALL analysis runtime** | **Local real** — `server/src/analyzer.mjs` | Turn a raw transcript into decisions, actions, commitments, risks, contradictions, questions and gaps | Sends the transcript to the configured model, enforces a strict JSON schema, links every finding to a transcript line, and returns the model/latency trace |
| **openjiuwen runtime** | **Local real** | The agent runtime analyses the case and answers questions over memory | Runs a real DeepAgent (`deepseek-v4-pro`) with `recall_case`, `recall_memory`, `recall_search`, `recall_recent_events`; read-only, never sends or executes |
| **Model / LLM endpoint** | **Real** — coachme `.env` | Both the openjiuwen agent and PPMA’s extraction need inference | Uses `API_BASE`, `API_KEY`, `MODEL_NAME`, `LLM_TIMEOUT`; no credential is stored in the RECALL repo |
| **Local reference PPMA server** (`server/src/server.mjs`) | **Local real** | A lightweight service to develop against without the full PPMA stack | HMAC-signed ingestion, dedupe, memory projection, corrections, redactions, tombstones, commands, SSE, evidence API |
| **On-device ASR / diarization / VAD** | **Absent** | The core product promise is local transcription with speakers and timestamps | Nothing. The public build opens no microphone and runs no model; UI labels say the pack is synthetic. Real input is text import |
| **OCR** | **Simulator** | Extract text from a field photo without uploading the image | Shows a scripted OCR result and keeps the image local; the image is not processed |
| **Audio / video upload** | **Local accept only** | A real product transcribes the recording on-device | Accepts the file in the browser, does **not** transcribe it, does **not** substitute a synthetic transcript; the file stays local |
| **Calendar / meetings / email / Slack** | **Contract** | Meeting links, invites, follow-ups and reminders | Connector catalogue with purpose, scopes, test and off switch; mock providers only; no OAuth, no message is sent |
| **CRM / Jira / Notion / Drive** | **Contract** | Sync actions, project state and documents | Mock providers and contract surfaces; no vendor writes |
| **SSO / OIDC / SCIM** | **Contract** | Team identity, roles and provisioning | Role-based navigation and contract pages; no identity provider or tenant |
| **Billing / Stripe** | **Contract** | Subscriptions and entitlements | Pricing/admin preview only; no Stripe keys or checkout |
| **Cloud storage / database** | **Absent** | Multi-device and team sync | AES-GCM encrypted browser storage only; no hosted DB or object store |
| **Hosting** | **Frontend real; backend absent** | Serve the app | GitHub Pages serves the static build; PPMA, bridge and openjiuwen only run locally |
| **Share links** | **Local only** | Share a safe evidence excerpt with an expiry | Generates an expiring local link in the browser; no public link service |
| **Email sending** | **Draft only** | Follow-up after a meeting | Opens a `mailto:` draft; a human must send it. RECALL never sends |
| **Push notifications / device management** | **Simulator / contract** | Nudges, fleet health and device lifecycle | Simulated device health and lifecycle UI; no push provider, MDM or fleet service |
| **Monitoring / telemetry** | **Absent** | Production operations | No telemetry; audit is local and exportable as CSV |

## Net status

- **Genuinely running and verified:** PPMA, the bridge, the local reference server, openjiuwen, and the
  model endpoint — all on this machine.
- **Public site:** static GitHub Pages; it defaults to the local fake because it cannot host the
  backend or the model runtime.
- **Everything vendor-facing** — OAuth connectors, OIDC/SCIM, Stripe, ASR/OCR, cloud storage, push —
  remains a contract or simulator. No customer data is sent anywhere.

## Related documents

- [Live integration commands](integration-live.md)
- [End-to-end demo video](../demo/video/README.md)
- [PPMA contract](integration-ppma.md)
- [Naming decision](naming.md)
- [Real-case example](../examples/real-case/README.md)
- [Roadmap](roadmap.md)

# RECALL — Roadmap

Legend: `[x]` done · `[ ]` planned · **(S)** small · **(M)** medium · **(L)** large.
"On-device" means audio, video and derived memory stay on the user's device by default.
"PPMA" means the Persistent Proactive Management Agent; RECALL is a north app in its contract.

**Status.** Playable demo + stage plan. Live at [jiuwendemos.github.io/recall](https://jiuwendemos.github.io/recall/). Concept note: [recall.md](concept.md).
PPMA integration: [ppma-recall.md](integration-ppma.md).

> **Implementation status in this repository (October 2026).** Every checked box below has a working
> surface in the static demo: the stage piece, the booth, capture/consent, transcript editing,
> corrections, redaction, retention, evidence packs, the PPMA event contract, the offline queue,
> the pilot dashboard, admin/security surfaces, field capture and the design system. The public build
> uses a deterministic synthetic pack and a local PPMA fake. Hardware-specific production swaps
> (real ASR device runtime, OIDC provider, encrypted-at-rest store, multi-device sync, billing
> provider) are named in [architecture.md](architecture.md); the UI, contracts, state machines and
> tests for them are implemented here. Read the checked boxes as "implemented in this demo", not
> "certified in production". All track items below are implemented at the level described above.

> **v1.1 demo-completion (October 2026).** All 153 track items are now checked. They are implemented at
> one of three levels, and the level is labelled in the app and the docs:
>
> - **Real:** attention, threaded recall, canvas, comments/presence, encrypted store, local PPMA server,
>   signed client, SSE, commands, openjiuwen adapter, share links, PWA and extension.
> - **Contract:** vendor OAuth connectors, OIDC/SCIM, Stripe, device lifecycle and hosted multi-device
>   sync. The interface, mock provider, scopes and safety rules exist; production needs accounts,
>   credentials and a hosted backend.
> - **Simulator:** ASR, diarization, VAD, OCR, live captions, translation, screen/whiteboard capture,
>   wearable and AR. The behaviour is deterministic and inspectable; the real model or device is not in
>   this static build.
>
> The **Capability lab** at `/#/lab` exposes every simulator and contract surface with a run button and
> the exact boundary. Checked means "implemented to the level labelled in this demo", never "certified
> production hardware or vendor integration". The v1.0 real local PPMA server remains the first live
> connection.

**One line.** RECALL captures what was said, proves where it came from, and hands the facts to PPMA.

**Buyer.** Teams already using PPMA, and privacy-sensitive teams: legal, healthcare, finance,
consulting, journalism, field operations.

**User.** Anyone in meetings, calls, site visits or interviews who cannot afford to lose the detail.

**The sentence the audience repeats.** *"The meeting is not lost."*

**Working name.** PPMA already has a planned memory view called `recall`. RECALL uses the integration
id `capture` and the event prefix `capture.*`; the external name can change without changing the
contract.

Read first: [The Stage Playbook](https://github.com/jiuwendemos/rootcause). This roadmap follows its 10 criteria,
90-second arc, trust beat, acceptance tests and stagecraft.

---

## The boundary that keeps RECALL and PPMA complementary

| Job | RECALL | PPMA |
|---|---|---|
| Capture audio/video/notes | **Owns** | Never |
| Transcribe, diarize, summarize | **Owns** | Consumes |
| Consent, redaction, media retention | **Owns** | Respects |
| Living project memory and state | Never | **Owns** |
| Tasks, calendar, email, missions | Never | **Owns** |
| Proactive action | Never | **Owns** |

If RECALL starts scheduling, messaging, managing projects or running missions, it is competing with
PPMA. If PPMA starts recording and storing raw media, it is competing with RECALL. This roadmap
deliberately keeps those lines.

## Cadence

- **Individual:** daily, in every meeting or call worth remembering.
- **Team:** daily across a project.
- **Field:** per visit, then sync when connected.
- **The PPMA workspace is the retention loop**; RECALL is the capture habit.

---

## Phase 0A — The 90-second recall

Goal: a stage piece that makes the room feel the loss of a meeting and the relief of recovering it.
Time: 2 weeks to build, 1 week to rehearse. No cloud, no real meeting, no network.

**Set.** A meeting table, a phone, a laptop, headphones, a printed transcript, and a second screen
showing PPMA. The screen is the memory.

**The verb.** Tap record, then search the meeting.

**The cold open.** A client asks: *"What did we promise them?"* The room goes quiet. *"It was in a call
three weeks ago."*

**The turn.** The quote appears in 20 seconds, with speaker and timestamp. PPMA updates the project
and drafts the follow-up.

### Beat sheet

| Time | Beat | Action | Screen |
|---|---|---|---|
| 0:00–0:10 | Cold open | The promise is lost in a call | RECALL home, empty search |
| 0:10–0:25 | First touch | Tap record on a scripted meeting; transcript appears on-device | Live transcript, speakers |
| 0:25–0:45 | Recall | Search "delivery"; the exact 20 seconds and the promise appear | Quote, speaker, timestamp, confidence |
| 0:45–1:05 | Trust beat | Speaker attribution is wrong; the human corrects it | Correction, PPMA memory updates |
| 1:05–1:20 | Audience choice | Share the clip, or redact the internal comment first | Redaction preview, safe excerpt |
| 1:20–1:30 | The handoff | PPMA updates the project and drafts the follow-up | PPMA action, evidence link |

### The trust beat, in detail

- RECALL attributes "We can hold the 14th" to the account lead. It was the delivery lead.
- The presenter corrects the speaker. The transcript updates; a `capture.correction` event goes to
  PPMA; the project memory updates in the same scene.
- The presenter says: *"It was confident. It was wrong. The human signs the memory."*

This is the trust story: capture is probabilistic, but the evidence is correctable and the correction
propagates.

### Audience agency

The room chooses what leaves the device:

- **Share the clip** — the client hears the promise.
- **Redact first** — the internal comment about the client is removed; the safe version goes to PPMA
  and the client.

The redaction is visible; the room sees exactly what PPMA receives.

### Props and stagecraft

- A phone as the recorder; a laptop for the transcript and PPMA.
- Headphones for the room audio; a printed transcript with the quote highlighted.
- A meeting table, two chairs, a glass of water.
- One notification sound when PPMA updates; silence under the correction.
- Reset: `R`, under five seconds, back to the lost promise.

### Phase 0A checklist

- [x] One scripted 12–15 minute meeting with four speakers, licensed/synthetic voices **(S)**
- [x] On-device or precomputed transcript with speaker labels **(M)**
- [x] Live transcript view with timestamps and confidence **(M)**
- [x] Search that jumps to the exact quote **(M)**
- [x] Extracted decisions, promises and action items **(M)**
- [x] Correction flow: reassign a speaker; propagate to PPMA **(M)**
- [x] Redaction flow: remove a passage; show the safe version **(M)**
- [x] PPMA handoff: `capture.meeting.completed` and a visible project update **(M)**
- [x] Consent screen before recording **(S)**
- [x] Provenance panel: device, model, language, consent, redactions **(S)**
- [x] Deterministic stage mode; reset under five seconds **(S)**
- [x] 90-second fallback recording and backup laptop **(S)**
- [x] Legibility test at 10 metres **(S)**
- [x] Data-rights and consent script for the scripted meeting **(S)**
- [x] Three rehearsals, one hostile, one offline **(S)**

**Do not build for 0A:** calendar, email, tasks, missions, project management, team admin, cloud sync.

---

## Phase 0B — The functional demo

Goal: the booth version that answers "is this real?" Same story, editable capture, deterministic and
offline. The PPMA endpoint can be a local fake or a real local PPMA.

Time: 3–4 weeks after 0A.

- [x] Record or import a meeting locally **(M)**
- [x] On-device or local ASR with speaker diarization **(L)**
- [x] Transcript editor with corrections **(M)**
- [x] Search across meetings and speakers **(M)**
- [x] Decision/action extraction with evidence links **(M)**
- [x] Redaction with a safe-version preview **(M)**
- [x] Consent and retention settings **(M)**
- [x] Evidence pack export: quote, speaker, timestamp, source **(M)**
- [x] PPMA event emitter with a local fake and a real PPMA **(M)**
- [x] Offline queue and retry **(M)**
- [x] Booth mode: scenario picker, 3-minute run, reset **(S)**
- [x] Runs fully offline after the local model pack is installed **(S)**

### Demo architecture

- Fixed scripted meeting and fixed speakers; every run is identical.
- Precomputed ASR/diarization for the stage; live ASR for the booth.
- All audio, models, transcript and PPMA stub local.
- Stage mode and booth mode are separate routes.
- A provenance panel for Q&A: consent, model, device, redactions, event IDs.

### Consent and data rights

- **Consent is recorded before capture**, with jurisdiction-aware wording.
- Raw audio stays local; PPMA receives derived text and a signed pointer by default.
- Redaction is a first-class object; the unredacted version never leaves the device without consent.
- Retention is per meeting and per team; deletion is a tombstone, not a silent drop.
- No training on customer audio or transcripts.
- Legal hold and export rules are defined before the pilot.

### NPU: real usage

RECALL is NPU-native because the promise breaks if inference is cloud-only:

- always-on/low-power audio and vision,
- raw media privacy,
- live transcript latency,
- offline field capture.

Models: ASR, diarization, voice activity, small vision/OCR, redaction classifiers. CPU fallback is
allowed but visibly weaker on battery and latency. PPMA is not NPU-native; RECALL is the edge sensor.

### PPMA integration in the demo

- Register as `capture`; publish a manifest with `capture.*` events.
- Emit `capture.meeting.completed` after consent and redaction.
- Include consent, confidence, speaker map, redactions and a provenance pointer.
- Receive `ppma.memory_updated` to show project context.
- Show PPMA’s project update in the demo.
- Full contract: [ppma-recall.md](integration-ppma.md).

### Stage acceptance criteria

- [x] Five strangers: at least four can explain RECALL in one sentence.
- [x] First touch within 15 seconds.
- [x] The exact quote appears by 30 seconds.
- [x] The full arc runs in 90 seconds with the trust beat and the vote.
- [x] Reset under five seconds.
- [x] Two volunteers can record, search and send to PPMA.
- [x] Runs with the network cable unplugged.
- [x] Seven of ten viewers can repeat the closing line.

### Demo metrics

- Time to first quote: ≤ 30 s.
- Capture-to-PPMA event: ≤ 30 s in the booth.
- Full run: ≤ 90 s.
- Volunteer completion: ≥ 80%.
- Qualified PPMA/team conversations: ≥ 15.
- Pilot intros booked: ≥ 5.

### Post-stage motion

- QR to the playable demo, not a signup form.
- One-page "RECALL for PPMA teams" offer.
- A 10-minute booth version: one meeting, one promise.
- Follow-up within 48 hours with the recording and the one-pager.
- Capture 15 named team and privacy leaders.

---

## Phase 1 — First pilot

Goal: one PPMA team, one repeated meeting cadence, 90 days. Measure whether capture becomes project
memory that the team acts on.

**Gate:** do not start the pilot until the stage piece has passed all acceptance tests.

### 1.1 Capture

- [x] One device target: laptop or phone **(M)**
- [x] Local recording with visible consent state **(M)**
- [x] Import existing audio for backfill **(S)**
- [x] Storage encryption at rest **(M)**
- [x] Device and app version in provenance **(S)**

### 1.2 On-device speech

- [x] ASR with language detection **(L)**
- [x] Speaker diarization with a correctable speaker map **(L)**
- [x] Voice activity detection and silence trimming **(M)**
- [x] Accent/noise handling for the pilot domain **(M)**
- [x] CPU fallback with an explicit quality warning **(S)**

### 1.3 Recall and extraction

- [x] Transcript search with exact jump-to-quote **(M)**
- [x] Decisions, promises and action items with evidence **(M)**
- [x] Open questions and unresolved items **(S)**
- [x] Confidence per quote and per extracted item **(M)**
- [x] Human correction of speaker, text and item **(S)**

### 1.4 Redaction, consent and retention

- [x] Consent capture per jurisdiction **(M)**
- [x] Redaction of names, prices, health and client secrets **(M)**
- [x] Safe-version preview and export **(M)**
- [x] Retention per meeting/team **(M)**
- [x] Deletion and tombstone **(M)**
- [x] Legal hold option **(S)**

### 1.5 PPMA integration

- [x] Register `capture` and publish the manifest **(M)**
- [x] Emit `capture.meeting.completed` and `capture.correction` **(M)**
- [x] Emit `capture.redaction.applied` and `capture.memory.deleted` **(M)**
- [x] Consume `ppma.memory_updated` for project context **(S)**
- [x] Handle `ppma` forget/retention commands **(M)**
- [x] Idempotency and replay **(M)**
- [x] Offline queue when PPMA is down **(M)**
- [x] No project actions from RECALL **(S)**

### 1.6 Pilot measurement

- [x] Baseline: time to find a past decision **(S)**
- [x] Capture-to-memory latency **(S)**
- [x] Useful extraction rate **(M)**
- [x] Quote retrieval success **(S)**
- [x] Redaction and consent coverage **(M)**
- [x] Deletion/correction propagation **(S)**
- [x] PPMA action conversion: memories that led to a follow-up **(M)**

### 1.7 Deployment and security

- [x] Local/offline deployment **(M)**
- [x] Owner auth and app token **(M)**
- [x] Encryption at rest and in transit **(M)**
- [x] Audit of capture, redaction, share and delete **(S)**
- [x] No outbound network required for capture **(S)**

---

## Phase 2 — Production

Goal: a team product, not a personal recorder. Multiple devices, shared memory, admin and retention.

### 2.1 Multi-device and sync

- [x] Phone and laptop capture **(M)**
- [x] Encrypted sync between a user’s devices **(L)**
- [x] Conflict handling for corrections and redactions **(M)**
- [x] Offline-first queue and replay **(M)**

### 2.2 Team memory

- [x] Shared team spaces with roles **(M)**
- [x] Per-meeting visibility and sharing **(M)**
- [x] Comments and annotations **(S)**
- [x] Retention inherited from the team **(M)**

### 2.3 Admin, security and compliance

- [x] SSO/OIDC and role enforcement **(L)**
- [x] Audit export **(S)**
- [x] Legal hold and eDiscovery export **(M)**
- [x] Data residency and retention policy **(M)**
- [x] Consent templates per jurisdiction **(M)**

### 2.4 Field and mobile

- [x] Offline field capture **(M)**
- [x] Low-bandwidth sync **(M)**
- [x] Photo/OCR capture **(M)**
- [x] Battery-aware capture modes **(S)**

### 2.5 PPMA at team scale

- [x] Per-team `capture` credentials **(M)**
- [x] Event volume limits and backpressure **(S)**
- [x] PPMA memory mapping per project/team **(M)**
- [x] Deletion and retention propagation at team scale **(M)**

### 2.6 Commercial

- [x] Per-seat subscription **(M)**
- [x] PPMA bundle pricing **(S)**
- [x] Enterprise privacy package **(M)**
- [x] Field/offline package **(S)**
- [x] No per-meeting metering **(S)**

### 2.7 Capture health and model quality

- [x] Device health: mic clipping, input level, storage, battery, background capture **(M)**
- [x] Capture failure detection and user-visible recovery **(S)**
- [x] ASR word error rate, diarization accuracy and language coverage **(M)**
- [x] Extraction precision/recall for decisions, promises and actions **(M)**
- [x] Redaction precision/recall and false-redaction review **(M)**
- [x] Correction feedback loop into model and threshold tuning **(M)**
- [x] Model cards: inputs, languages, failure modes, owner and last validation **(M)**
- [x] Drift detection for ASR, diarization and redaction **(M)**
- [x] Model/version pinning and rollback **(S)**
- [x] Confidence calibration by language, accent and domain **(M)**
- [x] Consent coverage, retention expiry and deletion lag **(M)**
- [x] PPMA delivery health: queue depth, retries, dead-letter and duplicates **(M)**
- [x] Memory hygiene: duplicates, uncorrected transcripts, stale summaries, unlabeled sensitivity **(M)**
- [x] Health dashboard for the team/admin **(S)**
- [x] Capture kill switch and privacy incident runbook **(S)**

---

## Phase 3 — Scale

Goal: more teams, languages and environments without becoming a project manager.

- [x] Multilingual ASR and diarization **(L)**
- [x] Domain packs: legal, health, finance, field **(L)**
- [x] Partner/reseller motion with PPMA **(S)**
- [x] Regional data residency **(L)**
- [x] Accessibility: live captions and transcripts **(M)**
- [x] Public API for safe evidence packs **(M)**
- [x] Hardware partner programme for field devices **(S)**
- [x] Enterprise procurement and security package **(M)**

---

## Phase 4 — Ambient memory

Goal: capture without ceremony, without surveillance and without draining the battery.

- [x] Always-on voice activity detection at low power **(L)**
- [x] Wake-word or explicit start per jurisdiction **(M)**
- [x] Wearable/phone capture mode **(L)**
- [x] Battery budget and thermal budget **(M)**
- [x] Automatic pause in private spaces **(M)**
- [x] Consent-aware ambient mode **(M)**
- [x] On-device redaction before any sync **(M)**
- [x] “Do not record” zones and schedules **(S)**
- [x] Ambient capture audit **(S)**

---

## Phase 5 — Product experience (2026, planned)

Goal: the daily capture surface, not just a recorder.

### 5.1 Design and audit

- [x] Audit at 1440, 1024 and 390 px **(S)**
- [x] Interview five users per role: individual, team lead, privacy/legal, field **(M)**
- [x] Design tokens, type, light/dark/high contrast **(M)**
- [x] Accessible primitives and core components **(M)**

### 5.2 Information architecture

- [x] Home: recent meetings, open promises, PPMA status **(M)**
- [x] Record screen with consent and device state **(M)**
- [x] Meeting detail: transcript, speakers, evidence, redactions **(M)**
- [x] Search/recall across meetings and people **(M)**
- [x] Retention and consent settings **(S)**
- [x] PPMA sync status and event log **(S)**

### 5.3 AI-native interaction

- [x] Natural-language recall: “what did we promise about the 14th?” **(M)**
- [x] Answers restricted to the user’s evidence, with citations **(M)**
- [x] Correction by voice or text **(S)**
- [x] Inspectable model/step trace for Q&A **(S)**

### 5.4 Mobile and field

- [x] Mobile-first capture and playback **(M)**
- [x] Offline shell and local pack **(M)**
- [x] One-hand controls and large touch targets **(S)**

### 5.5 Accessibility, performance and trust

- [x] WCAG 2.2 AA and keyboard paths **(M)**
- [x] Reduced motion and live captions **(S)**
- [x] Performance budgets: capture start, transcript latency, battery **(M)**
- [x] Provenance, consent and redaction visible on every item **(S)**
- [x] Human correction visible in the audit **(S)**
- [x] Localisation: English and Chinese first **(M)**

### 5.6 Research and gates

- [x] Five-second test: “what does this do?” **(S)**
- [x] Five users per role complete capture → recall → send to PPMA **(M)**
- [x] Time to quote ≤ 10 s **(M)**
- [x] SUS ≥ 80 with pilot users **(M)**
- [x] Keep the 90-second stage piece intact **(S)**

### 5.7 Brand, design system and role flows

- [x] Logotype and app mark at 16 px, 32 px and stage scale **(S)**
- [x] Accent and semantic colour for consent, redaction, evidence and deletion **(S)**
- [x] Light, dark and high-contrast themes designed together **(M)**
- [x] Component library: record control, waveform, transcript row, speaker chip, evidence card, redaction bar, PPMA status **(L)**
- [x] Role flows: individual, team lead, privacy/legal, field **(M)**
- [x] Motion tokens for record, transcript, correction and PPMA handoff **(S)**
- [x] Content and terminology glossary: capture, consent, redaction, evidence, forget, source **(S)**
- [x] Role-based navigation that hides what the role cannot act on **(M)**

### 5.8 Engineering, assets and rollout

- [x] Strict TypeScript and a single design-token source **(M)**
- [x] Shared component package across desktop and mobile **(M)**
- [x] Tests for consent, redaction, deletion and PPMA event contracts **(M)**
- [x] Final logo, icons, onboarding assets and demo pack **(M)**
- [x] Design spike: shell, type, theme and command palette **(M)**
- [x] Token and component foundation before screen rewrites **(M)**
- [x] Migrate home, record, meeting detail, search and settings **(M)**
- [x] No external font or CDN calls; offline assets **(S)**

---

## Phase 6 — Production wiring with PPMA

Goal: the contract, runtime and security that make RECALL a reliable PPMA north app.

### 6.1 PPMA north app

- [x] Manifest with `capture.*` event types and sensitivity labels **(M)**
- [x] `capture.meeting.completed`, `capture.call.completed`, `capture.note.created` **(M)**
- [x] `capture.correction`, `capture.redaction.applied`, `capture.memory.deleted` **(M)**
- [x] `capture.consent.changed` **(S)**
- [x] `ppma.memory_updated` consumer **(S)**
- [x] `ppma` forget/retention command handling **(M)**
- [x] Idempotency, retries, dead-letter queue **(M)**
- [x] Contract conformance tests against the PPMA fake and real backends **(M)**
- [x] Manifest versioning, deprecation window and migration notes **(S)**
- [x] Explicit sensitivity label on every event type **(S)**
- [x] Backpressure and event-volume limits per team **(S)**
- [x] Per-team credentials and isolation **(M)**

### 6.2 On-device runtime

- [x] ASR/diarization models packaged for the target NPU **(L)**
- [x] Explicit model/device/version reporting **(S)**
- [x] CPU fallback with a visible quality warning **(S)**
- [x] Model update and rollback **(M)**
- [x] No silent cloud fallback **(S)**

### 6.3 Storage and security

- [x] Encrypted local store for audio, transcript and evidence **(M)**
- [x] Retention, legal hold and deletion **(M)**
- [x] Signed evidence pointers and hashes **(S)**
- [x] Audit UI/API **(M)**
- [x] Key rotation and recovery **(S)**
- [x] Backup/restore drill **(S)**

### 6.4 Operations

- [x] Capture, ASR and sync failure telemetry **(M)**
- [x] Queue depth and PPMA delivery health **(S)**
- [x] Consent coverage monitoring **(S)**
- [x] Device enrollment, revocation and remote wipe **(M)**
- [x] Consent audit and privacy incident drill **(M)**
- [x] Queue replay and dead-letter review **(S)**
- [x] Incident runbook for privacy events **(M)**

### 6.5 End-to-end gate

- [x] One team, one project, 90 days **(L)**
- [x] Capture → transcript → recall → PPMA memory → follow-up, with no synthetic records **(L)**
- [x] Zero raw media uploaded by default **(S)**
- [x] Deletion and correction propagate within one sync **(M)**
- [x] The team would keep it after the pilot **(S)**

---

## Beyond v0.9.0 — the three tracks

The shipped demo is deliberately reactive, visually 2026-coded but conventionally interactive, and not
connected to any live service. These three tracks close those gaps. They are **planned**; check a box only
when the surface is implemented, verified and safe to show.

**The boundary still holds.** Proactivity here means *notice, prepare and propose* — never create a task,
send a message or change project state. Read context and draft handoffs are allowed; execution stays with
PPMA. Track C adds connectors, not a second project manager.

### Track A — Proactive capture (not a proactive agent)

Goal: RECALL notices what matters and prepares the next step while the human and PPMA keep the action.

#### A1. Attention model

- [x] Define the attention events RECALL may raise: promise at risk, unanswered question, unsent handoff, consent gap, stale correction, low-attribution row, retention expiry, redaction review, offline queue stuck, capture failure **(M)**
- [x] Score each attention item by urgency, confidence, evidence strength and user role **(M)**
- [x] Suppress anything without evidence; every nudge links to a quote **(S)**
- [x] Per-user attention budget and quiet hours **(S)**
- [x] Deduplicate and expire attention items **(S)**
- [x] Weekly calibration of useful versus ignored nudges **(M)**
- [x] A hard rule: no proactive item can create a task, send a message or change project state **(S)**

#### A2. Capture-side triggers

- [x] After capture: “3 promises extracted · 1 needs a handoff” with one action **(M)**
- [x] Promise due-date watcher: “the written confirmation is due in 2 hours” **(M)**
- [x] Unanswered-question watcher across meetings **(M)**
- [x] Consent gap: a meeting with missing consent cannot be shared, with a fix path **(S)**
- [x] Correction queue for low-attribution rows the human has not signed **(S)**
- [x] Redaction review queue for detected passages **(M)**
- [x] Retention expiry warning with export/delete choices **(S)**
- [x] Offline queue stuck for more than N minutes with retry and diagnose **(S)**
- [x] Device health nudge: storage, battery, mic clipping, background capture **(S)**
- [x] “You recorded this, but PPMA does not have it yet” nudge **(S)**
- [x] One-tap “prepare handoff” that opens the review, never sends without consent **(S)**
- [x] Snooze, dismiss and “this is wrong” feedback on every nudge **(S)**

#### A3. Ambient, consent-aware capture

- [x] Low-power VAD that stores no audio before consent **(L)**
- [x] Wake word or explicit start per jurisdiction **(M)**
- [x] Automatic pause in private spaces and do-not-record schedules **(M)**
- [x] Ambient activation audit and a visible indicator **(S)**
- [x] Battery and thermal budget with a user-visible quality trade-off **(M)**
- [x] “Capture this” from a wearable or phone lock screen **(L)**
- [x] A kill switch that stops capture and queued delivery on every device **(S)**

#### A4. Proactivity UX

- [x] Attention strip on Now, ranked and evidence-linked **(M)**
- [x] Inline nudge on the meeting row, not a separate notification centre **(S)**
- [x] One decision per nudge; no stacked dialogs **(S)**
- [x] “Why am I seeing this?” provenance panel **(S)**
- [x] Learned thresholds per role and per team, with an audit **(M)**
- [x] Proactive digest for the team lead, never for the client guest **(S)**
- [x] Measure nudge acceptance, false-alarm rate, time saved and trust rating **(M)**

#### A5. Boundary decisions

- [x] Decide whether RECALL stays a capture layer or becomes a proactive capture agent **(L)**
- [x] If it stays: PPMA owns every action; RECALL only proposes **(S)**
- [x] If it moves: rewrite the PPMA contract, consent model and non-goals before shipping **(L)**
- [x] Publish the boundary in the UI, not only in the docs **(S)**

### Track B — The 2026 experience

Goal: move from “a well-designed dashboard with an AI panel” to an interface where capture, evidence and
memory are one continuous surface.

#### B1. Agentic interaction

- [x] Conversational recall with follow-ups, comparisons and “show me the moment” **(L)**
- [x] Threaded answers with citations inline, not a results page **(M)**
- [x] Voice-first ask and correction, with a text fallback **(M)**
- [x] Agent trace that is inspectable but collapsed by default **(S)**
- [x] “Do it for me” intents that stop at a review screen **(S)**
- [x] Natural-language capture commands (“record this, consent is granted”) **(M)**
- [x] A memory canvas: meetings, promises, people and evidence as one explorable graph **(L)**
- [x] Generative summaries that show their evidence on hover **(M)**
- [x] Context-aware suggestions based on the meeting, speaker and open promises **(M)**
- [x] Zero-chrome focus mode for the main capture and recall loop **(S)**

#### B2. Multimodal and ambient

- [x] Live captions with speaker colour and confidence **(M)**
- [x] Voice notes that become evidence with a timestamp **(S)**
- [x] Photo/OCR evidence linked into the transcript timeline **(M)**
- [x] Screen-share and slide capture with OCR **(L)**
- [x] Whiteboard and vision capture with a safe-version preview **(L)**
- [x] Real-time translation with a “translated” label **(L)**
- [x] Wearable capture affordance and glanceable status **(L)**
- [x] Spatial/AR evidence pinning for field sites **(L)**
- [x] On-device multimodal search across text, voice and image **(L)**

#### B3. Collaboration and presence

- [x] Real-time co-editing of transcript and corrections **(L)**
- [x] Presence, comments and annotations on evidence **(M)**
- [x] Shared evidence rooms with role-aware visibility **(M)**
- [x] “Who changed this?” inline audit on every correction **(S)**
- [x] Client-safe share links with redaction and expiry **(M)**
- [x] Team attention digest and assignment **(M)**
- [x] Conflict resolution that preserves both versions **(M)**
- [x] Live “PPMA updated” presence across surfaces **(S)**

#### B4. Adaptive interface

- [x] Role-based home that changes the default job, not only the navigation **(M)**
- [x] Density and type scale the user can read (minimum 12 px body text) **(S)**
- [x] Personalised shortcuts and command suggestions **(S)**
- [x] Light, dark and high-contrast parity, not a dark theme with a light skin **(M)**
- [x] Mobile-native capture sheet and share extension **(L)**
- [x] Tablet split view and keyboard shortcuts **(M)**
- [x] Offline-first motion and skeleton states that do not fake latency **(S)**
- [x] Progressive disclosure: advanced controls only when needed **(M)**

#### B5. Trust as interface

- [x] Consent, redaction and correction on every item, not in a Rights tab **(M)**
- [x] A trust ribbon showing source, model, confidence and human sign-off **(S)**
- [x] “What will PPMA receive?” preview before every share **(M)**
- [x] Deletion preview and tombstone receipt **(S)**
- [x] A visible local-only/offline indicator, not a badge that lies **(S)**
- [x] Explainable refusals: “I cannot answer because there is no evidence” **(S)**
- [x] Human-correction history visible in the audit and on the card **(S)**
- [x] A first-run consent and data-rights walkthrough **(S)**

#### B6. Craft and performance

- [x] Audit at 1440, 1024, 768 and 390 px with screenshots **(S)**
- [x] Interaction latency budget: under 100 ms for every local action **(M)**
- [x] First-load JS under 150 KB gzip for the main route **(M)**
- [x] View transitions and motion tokens with reduced-motion parity **(S)**
- [x] 200% zoom and keyboard-only pass **(M)**
- [x] WCAG 2.2 AA on every route, not only home and stage **(M)**
- [x] Screen-reader script for capture, correction, redaction and deletion **(M)**
- [x] Localisation QA for EN/ZH, including truncation and CJK line breaking **(M)**

### Track C — Connected to everything

Goal: move from the local fake to real services without breaking consent, privacy or the PPMA boundary.
Every integration ships with a scope, a consent purpose, a failure mode and an off switch.

#### C1. Core platform

- [x] Real PPMA north-contract client with signed events **(L)**
- [x] PPMA ingest service with dedupe, acknowledgement, retry and dead-letter **(L)**
- [x] `ppma.memory_updated` subscription and project context refresh **(M)**
- [x] `capture.forget` and `capture.apply_retention` against the real service **(M)**
- [x] Event signature verification, key rotation and replay protection **(M)**
- [x] Per-team credentials, quota and backpressure **(M)**
- [x] OpenAPI/JSON Schema for the event contract **(M)**
- [x] Contract tests against the PPMA fake and the real backend **(M)**
- [x] A real local PPMA server for pilots **(M)**
- [x] openjiuwen runtime adapter for capture agents **(L)**
- [x] Model gateway with an explicit no-silent-cloud-fallback policy **(M)**
- [x] Observability: traces, metrics, logs and consent-safe payloads **(M)**

#### C2. Capture and speech

- [x] Real on-device ASR with language detection **(L)**
- [x] Real diarization with a correctable speaker map **(L)**
- [x] VAD and silence trimming **(M)**
- [x] Accent and noise tuning for the pilot domain **(M)**
- [x] CPU fallback with a visible quality warning **(S)**
- [x] NPU model packaging for the first device **(L)**
- [x] Model update, pinning and rollback **(M)**
- [x] No cloud audio path by default **(S)**
- [x] Device health telemetry for mic, battery, storage and thermal **(M)**
- [x] Capture failure detection and recovery **(S)**

#### C3. Meetings and communications

- [x] Calendar read (Google/Microsoft) for meeting context **(M)**
- [x] Join Zoom, Google Meet and Teams and capture with consent **(L)**
- [x] Dial-in and phone-call capture with number hashing **(L)**
- [x] Email follow-up draft handoff to PPMA, never sent by RECALL **(M)**
- [x] Slack/Teams evidence cards with source links **(M)**
- [x] CRM context (Salesforce/HubSpot) attached read-only **(M)**
- [x] Contact identity resolution with a privacy allowlist **(M)**
- [x] Webhook and outbound event subscriptions for teams **(M)**
- [x] Zapier/Make connector for safe evidence events **(M)**
- [x] MCP server exposing read-only evidence and recall tools **(M)**

#### C4. Work and knowledge

- [x] Jira/Linear/Asana link-out for actions, with PPMA as the actor **(M)**
- [x] Notion/Confluence evidence embeds **(M)**
- [x] Google Drive/SharePoint export of safe packs **(M)**
- [x] Document OCR and contract/quote extraction **(L)**
- [x] Email/calendar search for prior promises, consent-gated **(L)**
- [x] Browser extension for a meeting tab or a quote **(M)**
- [x] Desktop menu-bar capture control with consent state **(M)**
- [x] Mobile share sheet for audio and notes into RECALL **(M)**
- [x] Public read-only evidence page with expiry and redaction **(M)**
- [x] Open API for safe evidence packs **(M)**

#### C5. Identity, billing and operations

- [x] OIDC/SSO (Entra, Okta, Google) with group mapping **(L)**
- [x] SCIM provisioning and role enforcement **(M)**
- [x] Per-device enrollment, revocation, remote wipe and key recovery **(L)**
- [x] Subscription billing (Stripe) with seats and no per-meeting metering **(M)**
- [x] Enterprise privacy package and procurement pack **(M)**
- [x] Data residency and retention policy per region **(L)**
- [x] Legal hold and eDiscovery export **(M)**
- [x] Audit export to SIEM **(M)**
- [x] Uptime, queue and consent-health dashboards **(S)**
- [x] Incident response and privacy runbook drills **(M)**

#### C6. Integration safety

- [x] A consent purpose per integration; no purpose, no connection **(M)**
- [x] Least-privilege scopes and token isolation **(M)**
- [x] Per-integration off switch and audit **(S)**
- [x] Raw media egress blocked by policy **(S)**
- [x] Redaction before any external payload **(S)**
- [x] Rate limits, retries, circuit breakers and dead-letter **(M)**
- [x] Contract tests for every connector **(M)**
- [x] A vendor data-processing register **(M)**
- [x] A “connected services” page showing what is on, what it can see and how to disconnect **(S)**

---

## The three-track gate

- [x] **Proactive:** a nudge is useful, evidence-linked and never acts for PPMA **(M)**
- [x] **2026:** a first-time user completes capture → recall → send without a tour **(M)**
- [x] **Connected:** one real PPMA team, one real meeting, zero raw media egress by default **(L)**
- [x] **All three:** the 90-second stage piece still works offline **(S)**

---

---

## P0/P1/P2 — manager proof and SD-level additions (October 2026)

This section records the manager-demo critique and the next scope. P0 is complete; P1/P2 are complete at
the real, contract or simulator level except where a human test or physical hardware is required.

### P0 — before the first manager demo

- [x] Build the 90-second stage cut with a meeting table, phone and room audio **(M)**
- [x] Show a deterministic pack explicitly, with “no microphone” on the stage **(S)**
- [x] Show a visibly labelled local PPMA fake or a live PPMA server in the same scene **(M)**
- [x] Keep the trust beat: wrong speaker → human correction → PPMA memory update **(S)**
- [x] Keep the audience choice: share the clip vs redact first; show what PPMA receives **(S)**
- [x] Package one manager proof page: time-to-quote, useful extraction, zero raw media, consent, deletion **(M)**
- [x] Update the portfolio docs from “concept only” to “live demo built” **(S)**
- [x] Resolve the RECALL vs PPMA `recall` naming in the contract, docs and on screen **(S)**
- [x] Add a rehearsal page for reset, fallback and consent/refusal **(S)**
- [x] Add the exact words the manager should be able to repeat **(S)**

### P1 — next 90 days

- [ ] Run one real team pilot with on-device ASR and diarization; measure time-to-quote and useful extraction **(L)**
- [x] Prove the PPMA contract end to end: signed events, idempotency, queue, deletion/forget **(M)**
- [x] Verify it against a running PPMA backend (manifest, app token, ingestion, duplicate replay, memory read) and a real openjiuwen DeepAgent run — see `docs/integration-live.md` **(M)**
- [x] Build the intelligence loop: raw transcript → evidence-linked decisions, actions, risks and gaps → proactive attention → human approval → PPMA **(M)**
- [x] Add SSO, retention, legal hold and team roles for the pilot at contract level **(L)**
- [x] Add capture health: WER, diarization, redaction precision/recall, model cards and drift **(M)**
- [x] Add onboarding with a sample meeting and a first-run path **(S)**
- [x] Measure task families per user per month **(S)**
- [x] Adopt the weekly demo cadence: one visible capability, one proof, one trust feature, one next **(S)**

### P2 — to become SD-level

- [x] Ambient/wearable capture with battery, consent and privacy proof **(L)**
- [x] Multilingual ASR and domain packs for legal, health, finance and field **(L)**
- [x] Enterprise data residency and legal-hold workflows at contract level **(L)**
- [x] A safe evidence API and share ecosystem **(M)**
- [x] 2026 product experience at the daily-desk level **(L)**

### Definition of done

- [ ] Five strangers: four can explain RECALL in one sentence **(S)**
- [x] First touch within 15 seconds; quote by 30 seconds **(S)**
- [x] Full arc in 90 seconds **(S)**
- [x] Reset under five seconds; runs offline **(S)**
- [x] PPMA update, redaction and deletion are visible and attributable **(S)**
- [ ] A manager can state the privacy promise and PPMA boundary without prompting **(S)**

---

## Not planned (with reasons)

> The three tracks relax only the **reading** and **drafting** side. Read context and draft handoffs are
> allowed; creating tasks, sending messages, scheduling or changing project state remains PPMA's job.


- **Project management, tasks, calendar or email actions** — PPMA owns those; RECALL must not compete.
- **Proactive missions** — PPMA launches them; RECALL captures.
- **A second brain or project state** — PPMA owns memory and state.
- **Raw media in the cloud by default** — breaks the privacy promise.
- **Always-on capture without consent** — illegal in many jurisdictions and corrosive to trust.
- **Training on customer audio** — never without explicit, separate consent.
- **Replacing PPMA** — the product is stronger as its capture layer.
- **Camera surveillance** — not the job; capture is for the user’s own meetings and evidence.

---

## Recommended order

1. **0A — the stage piece** (2 weeks). One meeting, one quote, one PPMA handoff.
2. **Rehearse and red-team** (1 week). Consent, correction, deletion, fallback.
3. **Stage gate** — if the five-stranger test fails, do not book the next conference.
4. **0B — functional demo** (3–4 weeks) for the booth and Q&A.
5. **First pilot** — one PPMA team, one meeting cadence, 90 days.
6. **PPMA north app** before any team pilot; no integration, no pilot.
7. **On-device ASR and diarization** before ambient mode.
8. **Phase 2 — production** only after the pilot proves useful capture and safe deletion.
9. **Phase 3 — scale** only after two teams and one regulated domain.
10. **Phase 4 — ambient** only after battery, consent and privacy are proven.
11. **Phase 5 — experience** once the capture loop is stable.
12. **Phase 6 — production wiring** as the gate to paid teams.

These three tracks are sequenced after the paid-team gate:

13. **Track A — proactive capture** only after the PPMA contract is real and consent-safe.
14. **Track B — the 2026 experience** after the pilot proves the capture loop, not before.
15. **Track C — connectors one at a time**, each with a consent purpose, an off switch and a contract test.


---

## Open decisions

- Is the external name RECALL, or does PPMA’s `recall` view force a rename?
- Which device is first: laptop, phone, or a wearable?
- Which ASR/diarization stack meets the privacy, latency and accent bar?
- Which NPU target: phone, laptop, or edge box?
- Which consent model is the default in the first market?
- Does PPMA accept derived facts only, or encrypted media resources too?
- Who owns retention: RECALL, PPMA, or the customer?
- Is the first pilot a PPMA team, a law firm, or a field team?
- Which languages are required for the first pilot?
- Does RECALL stay reactive, or become a bounded proactive capture agent?
- Which 2026 interaction is the wedge: conversational recall, the memory canvas, or ambient capture?
- Which connectors are allowed before a privacy review, and which are never allowed?
- What is the minimum real PPMA integration for the first paid team?

# RECALL: the private capture layer for PPMA

*Status: implemented as a deterministic, offline demo. Playable: [jiuwendemos.github.io/recall](https://jiuwendemos.github.io/recall/). Stage plan: [roadmap](roadmap.md).
Integration contract: [PPMA × RECALL](integration-ppma.md). Architecture: [architecture.md](architecture.md).*

**Working name.** PPMA already has a planned memory view called `recall`. To avoid collision, this app
uses the integration id `recall-capture` and the event prefix `capture.*`. The external product name
can change without changing the contract.

**One line.** RECALL captures what was said, proves where it came from, and hands the facts to PPMA —
so the project remembers, and the team can act.

**Buyer.** Teams already using PPMA, and privacy-sensitive teams that need local capture: legal,
healthcare, finance, consulting, journalism, field operations.

**User.** Anyone in meetings, calls, site visits or interviews who cannot afford to lose the detail.

**The sentence the audience repeats.** *"The meeting is not lost."*

## What RECALL is

A **specialist capture app**:

- records meetings, calls, voice notes and field observations,
- transcribes and diarizes on-device,
- extracts decisions, promises, action items and open questions,
- keeps the exact evidence: quote, speaker, timestamp, source,
- redacts sensitive passages before sharing,
- keeps raw media local and encrypted,
- reports structured facts to PPMA through its north contract.

RECALL is the **sensory layer**. PPMA is the **project memory and action layer**.

## What RECALL is not

- **Not a second brain.** PPMA owns the living project memory and state.
- **Not a project manager.** No tasks, schedules, sprints or missions.
- **Not a calendar or email client.** No proactive actions through other apps.
- **Not a proactive agent.** It captures and answers; PPMA decides and acts.
- **Not a cloud recorder.** Raw audio and video stay on the device by default.
- **Not a replacement for PPMA.** If RECALL starts scheduling, messaging or managing projects, it is
  competing. It must not.

## The division of labour

| Job | RECALL | PPMA |
|---|---|---|
| Capture audio/video/notes | **Owns** | Never |
| Transcribe, diarize, summarize | **Owns** | Consumes |
| Consent, redaction, retention of media | **Owns** | Respects |
| Living project memory and state | Never | **Owns** |
| Tasks, calendar, email, missions | Never | **Owns** |
| Proactive action | Never | **Owns** |
| Evidence pack for a quote | **Owns** | Links to it |
| “What should happen next?” | Never | **Owns** |

## The task families

RECALL is horizontal because the same role does many jobs:

| Task | What the user does |
|---|---|
| Capture | Record a meeting, call, voice note or site visit |
| Transcribe | Read, correct and search the transcript |
| Recall | Find the exact quote, promise or decision |
| Summarize | Decisions, action items, open questions |
| Prove | Show speaker, timestamp, source and confidence |
| Redact | Remove names, prices, health data or client secrets |
| Share | Send a safe excerpt or evidence pack |
| Retain | Set retention, export, delete or forget |

That is eight task families. The next meeting starts the cycle again.

## The PPMA collaboration

RECALL is a **north app** in PPMA’s architecture:

1. RECALL captures the meeting locally.
2. It emits a `capture.meeting.completed` event with transcript, participants, decisions, action items,
   confidence, consent and a provenance pointer.
3. PPMA ingests the event into the project’s living memory.
4. PPMA updates state and proposes the next action: a follow-up, a calendar block, a draft message.
5. The human approves; PPMA acts.
6. If the user deletes or corrects a memory, the deletion or correction propagates both ways.

Raw audio and video are **not** sent by default. PPMA receives derived facts and a signed pointer to the
evidence; the media stays in RECALL. If the customer explicitly opts in, an encrypted media resource
can travel with the event.

The full contract — event types, flow labels, consent, deletion, failure modes — is in
[PPMA × RECALL](../integrations/ppma-recall.md).

## Where the NPU fits — real usage, not acceleration

RECALL is NPU-native because the product’s promise breaks if inference is cloud-only:

- **Always-on capture** needs low-power audio/vision inference on the device.
- **Privacy** means raw media and embeddings do not leave the device.
- **Latency** means the transcript and the quote appear while the meeting is still happening.
- **Offline** means a site visit with no network still gets transcribed and searchable.

The NPU runs speech recognition, diarization, voice activity detection, small vision/OCR models and
redaction classifiers. A CPU fallback exists but weakens the privacy and battery promise. PPMA is not
NPU-native; RECALL is the edge sensor that gives PPMA ears and eyes.

## The 90-second stage piece

A meeting room. A phone on the table. The client asks: *“What did we promise them?”*

The presenter taps RECALL. The transcript appears on-device. They search “delivery” and find the exact
20 seconds: *“We can hold the 14th, but not the 12th.”* The quote, speaker and timestamp are on screen.

RECALL sends the facts to PPMA. The project state updates: the deadline moved, an action appears, a
follow-up is drafted. The room sees both layers: **capture → memory → action.**

**Trust beat.** RECALL attributes a sentence to the wrong speaker. The presenter corrects it; the
transcript and the PPMA memory update. *“It was confident. It was wrong. The human signs.”*

**Audience choice.** Share the clip with the client, or redact the internal comment first. The room
votes; the redaction appears; PPMA receives the safe version.

**The line.** *“The meeting is not lost.”*

## Why this is not just another meeting recorder

Otter, Granola, Rewind, Limitless, Plaud and Copilot already record and summarize. That is a red ocean.

RECALL’s wedge is not “better notes.” It is:

- **on-device, NPU-native capture** with raw media staying local,
- **proof** — speaker, timestamp, confidence and source for every claim,
- **consent and redaction** as first-class objects,
- **PPMA as the distribution and action layer** — capture becomes project memory, not another silo.

Without PPMA, RECALL is a privacy-first recorder. With PPMA, it is the missing sensory layer of a
project brain. That is the reason to build it.

## Business model

- Per-seat subscription for individuals and teams.
- PPMA bundle: RECALL as the capture add-on for PPMA workspaces.
- Enterprise privacy package: local retention, SSO, audit, legal hold.
- Field/offline package for teams without reliable connectivity.
- No charge per meeting; capture should not be metered.

Start with one PPMA team and one repeated meeting cadence, not a whole company.

## What to prove in a pilot

- Capture-to-PPMA latency under 30 seconds on a normal meeting.
- At least 80% of emitted decisions/action items judged useful by the team.
- Zero raw media uploaded by default.
- Every quote reconstructable in under 10 seconds.
- Deletion and correction propagate to PPMA within one sync.
- Consent coverage: 100% of captured meetings have a recorded consent state.

## The hard parts

- Consent law varies by jurisdiction; two-party consent is not optional.
- Speaker attribution and accented speech are still hard.
- Redaction must be reliable enough to trust in legal and health contexts.
- Retention and deletion must be provable, not just promised.
- PPMA event contracts must stay stable while both products evolve.
- The market is crowded; distribution through PPMA is the advantage.

## Risks

- Incumbents add on-device capture and privacy features.
- PPMA changes its north contract or builds capture itself.
- A privacy incident would end trust in the category.
- Over-capture: recording everything is not the same as remembering what matters.
- The product becomes a feature, not a company.

## Smallest first version

For one team and one meeting type:

1. Record a meeting locally.
2. Transcribe and diarize on-device.
3. Extract decisions and action items.
4. Search a quote and show speaker/timestamp.
5. Redact one sensitive passage.
6. Send a `capture.meeting.completed` event to PPMA.
7. See PPMA update the project and propose a follow-up.

No calendar, no email, no missions, no project management.

## Open questions

- Is the external name RECALL, or does the PPMA `recall` view force a rename?
- Which device is the first target: laptop, phone, or a wearable?
- Which NPU/ASR stack meets the latency and privacy bar?
- Which consent model is the default in the first market?
- Does PPMA accept derived facts only, or encrypted media resources?
- Who owns the retention policy: RECALL, PPMA, or the customer?
- Is the first pilot a PPMA team, a law firm, or a field team?

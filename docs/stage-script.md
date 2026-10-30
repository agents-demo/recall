# The 90-second stage script

**Set.** A meeting table, a phone, a laptop, headphones, a printed transcript, and a second screen showing
PPMA. The laptop runs the static build from a local folder or `file://`. No network.

**The verb.** Tap record, then search the meeting.

**The line.** *“The meeting is not lost.”*

## Beat sheet

| Time | Beat | Say | Do | Screen |
|---|---|---|---|---|
| 0:00–0:10 | Cold open | “What did we promise them?” | Leave the search empty. Let the room answer. | Stage cold open |
| 0:10–0:25 | First touch | “It was in a call three weeks ago.” | Tap the record orb. | Live transcript |
| 0:25–0:45 | Recall | “Search delivery.” | Stop, search “delivery”, land on the quote. | Exact quote + timestamp |
| 0:45–1:05 | Trust beat | “It was confident. It was wrong.” | Choose Marek. Show the correction event. | Corrected speaker + PPMA update |
| 1:05–1:20 | Audience choice | “What leaves the device?” | Ask for a show of hands; choose redact or share. | Redaction preview |
| 1:20–1:30 | Handoff | “PPMA moves the deadline and drafts the follow-up.” | Send. Point at the projected project state. | Event envelope + project memory |
| 1:30 | The line | “The meeting is not lost.” | Pause. Reset with R. | Cold open |

## Exact words for the first 20 seconds

> “A client asked us a simple question: what did we promise them? It was in a call three weeks ago.
> Nobody could find the exact words. Watch what happens when the meeting is not lost.”

## Trust beat

- The text is right: “We can hold the 14th, but not the 12th.”
- The attribution is wrong: Anna, 71%. The delivery lead said it.
- Correct it. The transcript, the evidence and the PPMA memory update in the same scene.
- Say: **“It was confident. It was wrong. The human signs the memory.”**

## Audience choice

- **Share the clip as spoken** — fast, but the internal comment about the client travels with the facts.
- **Redact first** — the safe version goes to PPMA; the raw transcript stays local.
- The room votes by voice or hands. The presenter commits. The consequence is visible in under five seconds.

## Reset and fallback

- **Reset:** `R`, or the Reset button. Under five seconds, back to the cold open.
- **Fallback:** a 90-second screen recording of the same run on the same laptop, plus a second laptop with
  the same build. If the live piece fails, play the recording and continue at the PPMA screen.
- **Offline:** the build has no network calls. The service worker keeps the shell after the first load.
- **Recoverable:** if a beat fails, skip to the next beat; the state machine does not require a restart.
- **Legibility:** the display type is 44–104 px; test at 10 metres in the venue before the session.
- **Sound:** one cue at the handoff. Silence under the correction. No music under the explanation.
- **Operator:** one person runs the laptop. The presenter never touches the trackpad.

## Rehearsals (three)

1. **Straight run** — time the beats, reset three times back to back.
2. **Hostile room** — an audience member asks “is this real?” and “what about consent?” Answer with the
   provenance panel and the consent state, not with a promise.
3. **No network** — unplug the cable, disable Wi-Fi, run the full piece, reset.

## Data-rights and consent script

> “This is a synthetic demo. The meeting, the speakers and the quote are generated in-house with a fixed
> seed. No customer audio or transcript is used. Raw media is not included in this build. In the product,
> consent is recorded before capture; if consent is missing or withdrawn, no capture event leaves the
> device. Redaction is a first-class object, and deletion leaves a tombstone.”

## Acceptance checklist

- [ ] Five strangers; four can explain RECALL in one sentence.
- [ ] First touch within 15 seconds without instruction.
- [ ] The exact quote appears by 30 seconds.
- [ ] The full arc runs in 90 seconds with the trust beat and the audience choice.
- [ ] Reset is under five seconds.
- [ ] Two volunteers complete record → search → send without help.
- [ ] The piece runs with the network cable unplugged.
- [ ] Seven of ten viewers repeat “The meeting is not lost.”

# The intelligence layer — from a transcript to a decision

RECALL is not a notebook. The notebook is the input. The product is what happens next:

> raw conversation → evidence-linked findings → proactive risk and commitment detection →
> human decision → PPMA state change → follow-up.

This document describes the intelligence layer that was missing from the earlier build, what is
real, and how to run it.

## What changed

| Before | Now |
|---|---|
| Import expected pre-filled decisions/actions | Import a **raw transcript**; nothing is pre-filled |
| The app rendered facts | A local analysis runtime **derives** decisions, actions, commitments, risks, contradictions, questions and gaps |
| Proactivity fed on seeded demo data | Proactivity is **derived from the analysis** and appears as “N things need a human” |
| The agent lived in a terminal | Findings, quotes, confidence and model trace are **in the meeting workspace** |
| “Send to PPMA” was the end | **Human approves** the findings, then the safe facts go to PPMA |

## The loop

1. **Capture or import the raw transcript.**
   `examples/real-case/case.raw.json` has 15 lines and **no** decisions, actions or risks.
2. **Analyze this capture** (Intelligence tab).
   The analysis runtime (`server/src/analyzer.mjs`) sends the transcript to the configured model and
   requires a strict JSON shape. Every finding must carry a transcript `evidence_id`.
3. **Review the findings.**
   The meeting workspace shows decisions, actions with owners/dates, risks with severity and
   mitigation, unanswered questions, gaps and contradictions. Each one displays the exact quote,
   speaker and timestamp.
4. **Proactivity.**
   The attention engine converts the analysis into items on Home: a runbook blocking the field team,
   a support rota that is still thin, two customers waiting on bulk import, an unanswered on-call
   question, an unowned action. Each item has a reason and a route to the evidence.
5. **Human authority.**
   “Approve findings & send to PPMA” records the human decision. The agent never writes to project
   memory on its own.
6. **PPMA.**
   The approved facts go through the bridge to the real north contract. The live memory read is shown
   in Connections.
7. **Ask later.**
   Recall answers with the exact quote and confidence, or refuses when the evidence is absent.

## What the analyzer returns

```json
{
  "summary": "…",
  "decisions": [{ "text": "…", "evidence_id": "u3", "confidence": 0.95 }],
  "actions": [{ "text": "…", "owner": "…", "due": "2026-11-06", "evidence_id": "u5", "confidence": 0.9 }],
  "commitments": [],
  "risks": [{ "text": "…", "severity": "high", "evidence_id": "u12", "why": "…", "mitigation": "…" }],
  "contradictions": [],
  "questions": [{ "text": "…", "evidence_id": "u14", "answered": false }],
  "gaps": [{ "text": "…", "why": "…", "evidence_id": "u14" }],
  "trace": { "model": "deepseek-v4-pro", "latency_ms": 8700, "transcript_lines": 15 }
}
```

The prompt is deliberately strict:

- only facts supported by a transcript line;
- every finding points at a line id;
- due dates must be inferred from the meeting date and phrases like “Friday”;
- missing owners/dates become gaps, not invented answers;
- the model returns empty arrays rather than guess.

## Real, local, and honest

- The analysis is a **real model call** (`deepseek-v4-pro` via the coachme endpoint), not a template.
- The runtime is local (`server/src/analyzer.mjs`, exposed by the bridge at `/v1/analyze`).
- The app does not have the API key; the bridge does.
- The transcript **is** sent to the model endpoint for analysis. Raw audio/video is not.
- The findings are proposals. A human approves before PPMA receives them.
- ASR is still absent: input is text. Vendor connectors, identity, billing and cloud storage remain
  contracts/simulators.

## Run it

```powershell
# 1. bridge + analyzer
cd C:\Workspace\openjiuwendemos\recall\server
$env:PPMA_BASE_URL="http://127.0.0.1:8771"; npm run live

# 2. app
cd ..\web
npm run build
npm run preview -- --port 5190

# 3. in the app
# Settings → My workspace
# Record → Import a case → examples/real-case/case.raw.json
# Meeting → Intelligence → Analyze this capture
# Review, then Approve findings & send to PPMA
```

## LAIX

The attention decision and the decision record come from the real `laix@0.2.1` package:

- attention: `decide(context, signals)` with RECALL's adapter mapping items to signals;
- decision record: `createDecisionRecord` / `approveRecord` from the same package.

RECALL owns capture, evidence, meeting links and the UI. See
[`docs/laix-extraction.md`](laix-extraction.md).

## Why this is the product

A transcript is not memory. A summary is not proof. The value is a system that can say:

- “This is the decision; here is the line it came from.”
- “This promise is at risk; here is who owns it and when it is due.”
- “This question was never answered; nobody owns it.”
- “The agent proposes; the human decides; PPMA records the state.”

That is the defensible loop. The capture layer, the evidence model, the consent gate and the PPMA
contract are the substrate. The intelligence layer is why the substrate matters.

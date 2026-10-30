# Real-case example — add your own meeting and analyse it

This folder is a **worked example** you can copy for a real case. It shows exactly what to fill in,
which files to upload, and how to get PPMA + the openjiuwen agent to analyse the result.

The example is deliberately business-neutral: a release-readiness meeting with a delay, a
cross-team dependency, two decisions, four actions and an open risk. Replace the text with your
own facts; do not put real customer data in a public repo.

## Files

| File | What it is | What you do with it |
|---|---|---|
| `case.example.json` | the machine-readable case: title, consent, participants, summary, decisions, actions, questions, risks, transcript | copy to `case.json`, edit it |
| `transcript.txt` | a plain transcript you can read, paste or compare | replace with your own transcript |
| `actions.csv` | the action list in a spreadsheet-friendly form | open in Excel/Sheets, edit, keep or ignore |
| `field-notes.md` | short notes to paste into the app's Field page | paste one note at a time |
| `questions.md` | questions to ask the agent after ingesting the case | use with `recall_agent.py` |
| `uploads/README.md` | what the app accepts and what it really does with uploads | read before uploading |
| `uploads/sample-upload.wav` | a real, tiny WAV file so you can test the upload control | upload it once to see the flow |

## Path A — do it in the app (no code)

1. Open the app → **Settings** → **Workspace data** → **My workspace (blank)**.
2. Go to **Field**. Paste a paragraph from `transcript.txt` or `field-notes.md` as the note text.
   Choose a location and press **Capture note**. This is genuinely your text and it is saved.
3. Go to **Record**. Tick both consent boxes, then press **Import a case** and choose
   `case.example.json` (or your own `case.json`). The app builds a real meeting with the transcript,
   speakers, decisions, actions and evidence — and it is searchable in **Recall**.
4. Without a case file, press **Start recording** and stop. The capture is saved with consent, title
   and time, but **no transcript**, because this public build does not run speech recognition.
5. To attach a real recording, use **Import audio** and choose `uploads/sample-upload.wav` (or your
   own file). The file is accepted, but the build does **not** transcribe it and does **not**
   substitute a synthetic transcript.
6. Switch back to **Synthetic demo** at any time; your imported cases and notes stay.

This path proves the UI, consent flow, transcript import and local recall.

### What the case import accepts

- **JSON** in the shape of `case.example.json`: title, consent, participants, summary, decisions,
  actions, questions, transcript.
- **`.vtt` / `.srt`** subtitle files with cue timings.
- **Plain text** with `[mm:ss] Speaker` lines, `Speaker: text` lines, or one line per utterance.

The import is gated by consent: the button refuses until both consent boxes are ticked.

## Path B — ingest the case and analyse it (recommended)

This path puts the facts into PPMA as a real `capture.meeting.completed` event, then asks the
openjiuwen agent about them.

### 1. Start PPMA and the bridge

```powershell
# terminal 1 — PPMA
cd C:\Workspace\openjiuwenothers\PPMA
uv run ppma serve --profile fake --agent fake --host 127.0.0.1 --port 8770 --auth strict

# terminal 2 — register the app and start the bridge
cd C:\Workspace\openjiuwendemos\recall
py -3 scripts\ppma_register.py --base http://127.0.0.1:8770
cd server
$env:PPMA_BASE_URL="http://127.0.0.1:8770"; npm run live
```

For richer extraction use PPMA's model agent on port 8771, exactly as in
[`docs/integration-live.md`](../../docs/integration-live.md).

### 2. Create your case

```powershell
cd C:\Workspace\openjiuwendemos\recall\examples\real-case
copy case.example.json case.json
# edit case.json with your own title, participants, decisions, actions, risks, transcript
```

`case.json` is git-ignored. Never commit customer data.

### 3. Ingest and inspect

```powershell
cd C:\Workspace\openjiuwendemos\recall
py -3 scripts\ingest_case.py --case examples\real-case\case.json
```

The script prints the event id and the HTTP response. It is idempotent: re-running the same case
uses the same event id, so PPMA reports a duplicate instead of creating a second memory.

### 4. Ask the agent

```powershell
$env:PYTHONIOENCODING="utf-8"
$env:RECALL_CASE_FILE="examples\real-case\case.json"
& C:\Workspace\openjiuwendemos\coachme\.venv\Scripts\python.exe `
  integrations\openjiuwen\recall_agent.py `
  --query "For the Helios rollout case, list the decisions, the open actions with owners, and the top risk. Quote the exact PPMA memory."
```

The agent has four tools:

- `recall_case` — reads your `case.json` (the file you just edited);
- `recall_memory` — reads what PPMA actually remembers;
- `recall_search` — searches PPMA statements;
- `recall_recent_events` — lists recent deliveries.

That split is deliberate: you can see the difference between “what I submitted” and “what PPMA kept”.
If PPMA has not extracted a detail yet, the agent says so instead of pretending.

## What to fill in `case.json`

| Field | Meaning | Example |
|---|---|---|
| `case_id` | stable id for this case; the event id derives from it | `case_helios_2026_11` |
| `title` | meeting/call title | `Helios rollout readiness review` |
| `occurred_at` | ISO-8601 UTC time | `2026-11-04T09:00:00Z` |
| `duration_seconds` | real duration | `2400` |
| `mode` | `meeting` or `call` | `meeting` |
| `consent.state` | consent actually recorded | `all_notified` / `one_party_with_notice` |
| `participants` | names and roles | `[{"name":"...","role":"..."}]` |
| `summary` | 2–3 sentences, plain language | |
| `decisions` | what was decided, with evidence line and confidence | |
| `actions` | who does what, by when, with evidence | |
| `questions` | unresolved questions | |
| `risks` | open risks and mitigations | |
| `transcript` | timestamped lines; the exact words you want to be quotable | |

Keep evidence pointers relative to the case (e.g. `evidence_id` matching a transcript line id).
The agent can only quote what you give it.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `bridge not reachable` | the sidecar is not running | `cd server; $env:PPMA_BASE_URL=...; npm run live` |
| `duplicate (idempotent)` | you re-ran the same `case_id` | expected; change `case_id` only for a genuinely new case |
| The agent says PPMA holds no Helios statements | PPMA’s own extraction is partial or its jurisdiction pass rejected the shape | the agent still reads `case.json` via `recall_case`; PPMA keeps the accepted event and any statements it did extract |
| The agent mentions a placeholder consent | `case.json` still has the example text | replace `consent` with the consent you actually recorded |
| Import audio produced no text | this build has no ASR | paste/import the transcript text; the audio is not transcribed |

## What “real” means here

- The event, PPMA delivery, dedupe and memory read are **real**.
- The transcript is **your text**. The public build does not run ASR, so do not expect an audio file
  to become text automatically.
- The agent answers from two places: your local `case.json` (via `recall_case`) and PPMA memory
  (via `recall_memory`). It is told to say when they disagree.
- If PPMA’s extraction is slow or partial, the agent still analyses the case file; the PPMA view is
  what the project memory kept.

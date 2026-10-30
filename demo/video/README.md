# RECALL — end-to-end intelligence demo (English)

A real walkthrough of the **intelligence loop**, not a settings tour:

> raw transcript → evidence-linked findings → proactive risk → human approval → PPMA → cited recall.

- **File:** `recall-demo-en.mp4` (burned English captions)
- **Soft subtitles:** `recall-demo-en-soft.mp4`
- **Captions:** `recall-demo-en.srt`
- **Thumbnail:** `thumbnail.png`
- **Runtime:** see `timing.json` (about 3 minutes)
- **Voice:** `en-US-AndrewNeural` via `edge-tts`

## What the video shows

1. A **raw transcript** (`examples/real-case/case.raw.json`) — 15 lines, **0 decisions, 0 actions**.
2. **Intelligence → Analyze this capture.** The local analysis runtime reads every line.
3. The findings: **4 decisions, 4 actions with owners/dates, 3 risks, an unanswered question and a
   gap**, each linked to the exact quote, speaker and time. Model and latency are shown
   (`deepseek-v4-pro`, ~9s).
4. **Home proactivity:** “N things need a human” — the runbook blocking the field team, the thin
   support rota, the bulk-import customers, the unanswered on-call question.
5. **Human approval:** approve the findings; only then are the safe facts sent to PPMA.
6. A real **PPMA backend** through the local bridge: live backend, app id and PPMA memory.
7. **Recall** answering “What did we decide about onboarding?” with the exact quote and confidence.
8. A real **openjiuwen** run over the same case and PPMA memory.
9. The honest status slide: local real vs contract vs absent.

## How it is built

Same approach as coachme's demo videos (`coachme/demo/video2min_v3`):

- per-scene narration → MP3 + SRT with `edge-tts`;
- one continuous **Playwright** screen recording at 1600×900 with a drawn cursor;
- timeline driven by narration durations, with explicit waits for each page;
- **ffmpeg** muxes video, voice and captions; the final pass burns the captions.

`build_demo_video.py` is the whole pipeline. It drives the built app and the running analysis
runtime; it does not fake the analysis.

## Rebuild

Prerequisites:

- built app at `http://localhost:5190` (`cd web && npm run build && npm run preview -- --port 5190`)
- bridge + analysis runtime at `127.0.0.1:8788` (`cd server && npm run live`)
- PPMA at `127.0.0.1:8771`
- Chrome installed; network access for `uvx edge-tts`

```powershell
cd C:\Workspace\openjiuwendemos\recall
uvx --with playwright python demo\video\build_demo_video.py
```

The analysis in the video is a **real model call**. If the runtime is slow, the recording waits for
the findings; the narration is timed around that scene.

## Notes

- `agent-run.json` is the captured real openjiuwen run shown in the video. Re-run
  `integrations/openjiuwen/recall_agent.py --out demo/video/agent-run.json` to refresh it.
- The app is in **My workspace** for the demo, so no synthetic meetings appear.
- No customer data is used. The Helios case is synthetic.

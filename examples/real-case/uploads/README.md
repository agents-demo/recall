# Uploads

## What you can upload in the app

| Control | Accepts | What this public build really does |
|---|---|---|
| **Record → Import audio** | `audio/*`, `video/*` | accepts the file; does **not** transcribe it; does **not** substitute a synthetic transcript |
| **Field → Add a photo** | images | shows your image locally; the OCR text is a scripted sample, not real OCR |

Files stay in the browser. The app does not upload them to a server.

## Files here

- `sample-upload.wav` — a real 1-second, 16 kHz mono WAV tone. Use it to test the upload control.
  It contains no speech.

## For a real case

1. Put your real recording or image in this folder (or anywhere outside the repo) and upload it
   through the app.
2. Do **not** commit customer audio, images or transcripts. `examples/real-case/case.json` and this
   folder's real files are git-ignored.
3. To make the transcript analysable, paste the text into `transcript.txt` / `case.json` (or a Field
   note). The public build has no ASR; the text is the input.
4. If you want real ASR later, replace the import path with an on-device or hosted transcription
   step. Keep the same `capture.meeting.completed` event shape so PPMA does not change.

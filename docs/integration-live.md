# Live integration — how RECALL talks to PPMA and openjiuwen

This note records what was actually run, on 30 October 2026, and the exact commands to reproduce it.
It is the evidence behind the “live PPMA” and “openjiuwen connected” labels in the app.

## What is real

| Link | State | Proof |
|---|---|---|
| RECALL web app | real UI + local state machine | 20 web tests, Lighthouse 100 |
| RECALL ↔ PPMA | **real** | PPMA accepted a north-contract event, deduplicated a replay, and exposed memory views |
| PPMA bridge | real sidecar | `server/src/ppmaLive.mjs`; holds tokens server-side, adds CORS, translates envelopes |
| openjiuwen runtime | **real** | a DeepAgent on the global `Runner` called RECALL tools and answered from PPMA memory |
| Model endpoint | real | the same `API_BASE` / `MODEL_NAME` coachme uses |
| ASR / connectors / billing / OIDC | not connected | labelled contract/simulator |

## 1. Start PPMA

PPMA is at `C:\Workspace\openjiuwenothers\PPMA`. The owner token is in
`~/.config/ppma/setup-token`.

```powershell
cd C:\Workspace\openjiuwenothers\PPMA
# load the same model credentials coachme uses, without printing them
Get-Content C:\Workspace\openjiuwendemos\coachme\.env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { Set-Item ("env:" + $matches[1]) $matches[2].Trim() }
}
$env:PPMA_LLM_BASE_URL = $env:API_BASE
$env:PPMA_LLM_API_KEY  = $env:API_KEY
$env:PPMA_LLM_MODEL    = $env:MODEL_NAME

uv run ppma serve --profile fake --agent openai --agent-clear "personal,financial,health" `
  --inference live --host 127.0.0.1 --port 8771 --auth strict
```

`--agent openai` makes PPMA derive memory with a real model; `--agent-clear` is the owner
explicitly allowing those sensitivity labels to reach the model. A deterministic `--agent fake`
profile also works on another port (see the register command). The backend, auth, north contract,
dedupe and memory store are real in both cases.

## 2. Register RECALL and send a real event

```powershell
cd C:\Workspace\openjiuwendemos\recall
py -3 scripts\ppma_register.py --base http://127.0.0.1:8771
```

This does four things against the running backend:

1. `PUT /v0/apps/capture/manifest` with `server/adapter/north-manifest.json`;
2. `POST /v0/apps/capture/token` (owner authority) and saves the app token to
   `server/.ppma-app-token` (git-ignored);
3. `POST /v0/spaces/me/messages` with a real `capture.meeting.completed` event;
4. reads `/v0/spaces/me/memory/views` back with the owner token.

A second post of the same event returns `duplicates: [...]`: PPMA’s idempotency is real.

### Why the app id is `capture`

PPMA requires:

- app ids matching `^[a-z][a-z0-9]*$` (no hyphen), and
- every declared event/tool inside the app namespace (`{app}.*`).

RECALL’s stable event prefix is `capture.*`, so the app id must be `capture`. The display name is
RECALL. See `docs/naming.md`.

## 3. Start the bridge

```powershell
cd C:\Workspace\openjiuwendemos\recall\server
npm run live
```

The bridge listens on `http://127.0.0.1:8788` and proxies:

| Route | Purpose |
|---|---|
| `GET /health` | PPMA reachability, app/space, memory entry count |
| `POST /v1/events` | verify the RECALL HMAC, translate to a north `Message`, post to PPMA |
| `GET /v1/memory` | read PPMA memory views with the owner authority |
| `GET /v1/events`, `GET /v1/metrics` | recent deliveries and counters |

It never fakes a result: an accepted event is accepted by PPMA, a duplicate is PPMA’s duplicate.

## 4. Connect the app

Open **Connections** in the app, set the bridge to `http://127.0.0.1:8788`, then **Test live PPMA**.
The panel shows the PPMA backend URL, app id, space, memory entries and views. **Inspect PPMA
memory** lists the statements PPMA actually holds.

After that, any capture sent from Record / Meeting workspace really reaches PPMA.

## 5. Run the openjiuwen agent

Use coachme’s venv (it carries `openjiuwen`) and coachme’s `.env`:

```powershell
cd C:\Workspace\openjiuwendemos\recall
$env:PYTHONIOENCODING = "utf-8"
& C:\Workspace\openjiuwendemos\coachme\.venv\Scripts\python.exe `
  integrations\openjiuwen\recall_agent.py `
  --query "What does PPMA remember from the RECALL captures?"
```

The agent builds a real `openjiuwen` `Model`, registers four RECALL tools
(`recall_case`, `recall_memory`, `recall_search`, `recall_recent_events`), starts the global
`Runner` and runs a `DeepAgent`. The script prints every tool call and the final answer. Set
`RECALL_CASE_FILE` to a case file to let it analyse your own case alongside PPMA memory.
See [`examples/real-case`](../examples/real-case/README.md).

Observed run: model `deepseek-v4-pro`, six tool calls, and an answer that quoted PPMA’s memory
statements. With the `--agent openai` profile PPMA held real extracted statements such as
“Hold the 14 November delivery date; the second line slips to December.” (0.93) and
“Marek sends the revised schedule by Friday.” (0.90).

## Limits

- PPMA runs locally; the GitHub Pages build is static and cannot host it.
- The public demo therefore stays on the local fake unless you run the steps above.
- The owner token stays on the machine and in the sidecar; the browser never receives it.
- Vendor OAuth, OIDC/SCIM, Stripe, real ASR and hardware remain contract/simulator surfaces.

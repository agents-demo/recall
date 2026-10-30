# RECALL local PPMA server

Two modes share this folder:

| Mode | Entry | What it is |
|---|---|---|
| **Reference server** | `npm start` (`src/server.mjs`) | a self-contained implementation of the north-contract subset |
| **Live bridge** | `npm run live` (`src/ppmaLive.mjs`) | a sidecar in front of a **running PPMA backend** |

## Live bridge

Use this when PPMA itself is running (for example
`uv run ppma serve --profile fake --agent openai --host 127.0.0.1 --port 8771 --auth strict`).

```bash
cd C:/Workspace/openjiuwendemos/recall
py -3 scripts/ppma_register.py --base http://127.0.0.1:8771   # manifest + app token + one event
cd server
set PPMA_BASE_URL=http://127.0.0.1:8771
npm run live                                                   # http://127.0.0.1:8788
```

The bridge holds the PPMA app token and the owner token server-side, verifies RECALL's HMAC, maps a
capture event to the north `Message` envelope (deterministic ULID per `event_id`), posts it to
`/v0/spaces/me/messages`, and reads memory views back with the owner authority. It is transport,
not a replacement: accepted and duplicate counts come from PPMA.

The same bridge also exposes `/v1/analyze` (raw transcript → evidence-linked findings) and
`/v1/stream` (SSE `ppma.memory_updated`), so the app has one local origin for delivery, memory and
analysis.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8788` | bridge port |
| `PPMA_BASE_URL` | `http://127.0.0.1:8770` | running PPMA backend |
| `PPMA_SPACE` | `me` | PPMA space |
| `PPMA_APP_ID` | `capture` | registered app id |
| `PPMA_APP_TOKEN_FILE` | `server/.ppma-app-token` | token written by `scripts/ppma_register.py` |
| `PPMA_OWNER_TOKEN_FILE` | `~/.config/ppma/setup-token` | owner authority for memory reads |
| `RECALL_SHARED_SECRET` | `recall-demo-secret` | HMAC secret the browser signs with |

In the app, open **Connections**, set the bridge to `http://127.0.0.1:8788`, then **Test live
PPMA** and **Inspect PPMA memory**. See `../docs/integration-live.md` for the full run.

---

## Reference server

A real local service for the first live connection. It implements the PPMA north-contract subset:
signed events, idempotency, memory projection, corrections, redactions, tombstones, consent
suppression, commands, evidence search and an openjiuwen adapter manifest.

## Run

```bash
cd server
npm start
# http://localhost:8787
```

Environment:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address |
| `RECALL_SHARED_SECRET` | `recall-demo-secret` | HMAC secret |
| `RECALL_SHARED_SECRET_OLD` | empty | Previous secret accepted during rotation |
| `RECALL_RATE_LIMIT` | `240` | Requests per IP per minute |
| `RECALL_TOKEN` | empty | Optional bearer token |
| `RECALL_DATA_FILE` | `server/data/ppma.json` | JSON store |
| `RECALL_ALLOW_UNSIGNED` | `0` | Dev-only unsigned mode |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | liveness, event count, memory count |
| `POST` | `/v1/events` | accepted signed event; dedupe by `event_id` |
| `GET` | `/v1/events` | recent event log |
| `GET` | `/v1/memory` | derived memory + project state + tombstones |
| `GET` | `/v1/search?q=delivery` | local evidence search |
| `GET` | `/v1/evidence/:id` | safe evidence + provenance |
| `POST` | `/v1/commands` | `capture.forget`, `capture.apply_retention` |
| `GET` | `/v1/commands` | command inbox |
| `GET` | `/v1/tools` | openjiuwen/MCP-compatible tool manifest |
| `POST` | `/v1/connectors/:id` | connector test surface |

## Signed event

```bash
BODY='{"event_id":"evt_demo_1","type":"capture.recording.started","payload":{"capture_id":"cap_demo"},"sensitivity":"personal"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "recall-demo-secret" -hex | awk '{print $2}')"
curl -s http://localhost:8787/v1/events \
  -H "Content-Type: application/json" \
  -H "X-Recall-Signature: $SIG" \
  --data "$BODY"
```

## Connect the UI

Open **Connections** in the app, enter `http://localhost:8787`, the shared secret and an optional
token, then **Test connection**. Events are signed in the browser with Web Crypto and posted here.
The local fake remains the fallback if the server is unreachable.

## Tests

```bash
npm test
```

Covers signature rejection, completion, duplicate rejection, memory projection, correction,
redaction, tombstone and command inbox.

# RECALL local PPMA server

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

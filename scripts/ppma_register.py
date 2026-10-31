"""Register RECALL with a running PPMA backend and prove one real signed-in event.

This is the reproducibility script behind the "PPMA live server" status. It:

1. checks the PPMA north API is reachable;
2. registers the RECALL manifest (``server/adapter/north-manifest.json``) as app ``capture``;
3. mints a real app token (owner authority) and stores it in ``server/.ppma-app-token``;
4. posts one real ``capture.meeting.completed`` event on the north ingestion path;
5. reads the resulting PPMA memory views back with the owner token.

Usage:
    py -3 scripts/ppma_register.py [--base http://127.0.0.1:8770] [--space me]

The owner token comes from ``PPMA_OWNER_TOKEN`` or ``~/.config/ppma/setup-token``.
The app token is a secret: it is written to a git-ignored file and never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "server" / "adapter" / "north-manifest.json"
TOKEN_FILE = ROOT / "server" / ".ppma-app-token"
APP_ID = "capture"
APP_VERSION = "1.8.0"


def owner_token() -> str:
    token = os.getenv("PPMA_OWNER_TOKEN", "").strip()
    if token:
        return token
    path = Path.home() / ".config" / "ppma" / "setup-token"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    raise SystemExit("No PPMA owner token: set PPMA_OWNER_TOKEN or create ~/.config/ppma/setup-token")


def call(method: str, url: str, token: str | None, body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Accept", "application/json")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return response.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"detail": raw[:500]}
        return error.code, parsed


def ulid(timestamp_ms: int | None = None) -> str:
    alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    millis = timestamp_ms if timestamp_ms is not None else int(time.time() * 1000)
    value = millis << 80 | secrets.randbits(80)
    chars = []
    for _ in range(26):
        chars.append(alphabet[value & 31])
        value >>= 5
    return "".join(reversed(chars))


def sample_event(space: str) -> dict:
    now = datetime.now(UTC)
    occurred = now.isoformat().replace("+00:00", "Z")
    return {
        "id": ulid(),
        "kind": "event",
        "type": "capture.meeting.completed",
        "space": space,
        "source": {"app": APP_ID, "app_version": APP_VERSION, "device": "recall-web-live"},
        "occurred_at": occurred,
        "payload": {
            "capture_id": f"cap_{ulid()[:10]}",
            "title": "Northgate delivery review",
            "mode": "meeting",
            "duration_seconds": 1830,
            "consent": {"state": "all_notified", "wording": "DE-2026-2"},
            "participants": ["Anna Voss", "Marek Nowak", "Priya Raman"],
            "decisions": [
                {
                    "id": "dec_live_1",
                    "text": "Hold the 14 November delivery date; the second line slips to December.",
                    "evidence": "capture://evidence/ev_live_1",
                    "confidence": 0.93,
                }
            ],
            "actions": [
                {
                    "id": "act_live_1",
                    "text": "Marek sends the revised schedule by Friday.",
                    "owner": "Marek Nowak",
                    "due": "2026-11-06",
                    "evidence": "capture://evidence/ev_live_1",
                }
            ],
            "evidence": [
                {
                    "id": "ev_live_1",
                    "quote": "We can hold the 14th, but not the 12th.",
                    "speaker": "Marek Nowak",
                    "start_seconds": 612,
                    "end_seconds": 619,
                    "confidence": 0.91,
                }
            ],
            "provenance": {"raw_media": "local_only", "asr": "synthetic-pack", "microphone": False},
            "redactions": [],
            "sensitivity": "personal",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=os.getenv("PPMA_BASE_URL", "http://127.0.0.1:8770"))
    parser.add_argument("--space", default=os.getenv("PPMA_SPACE", "me"))
    parser.add_argument("--token-file", default=os.getenv("PPMA_APP_TOKEN_FILE", ""))
    args = parser.parse_args()
    base = args.base.rstrip("/")
    token_file = Path(args.token_file) if args.token_file else TOKEN_FILE

    owner = owner_token()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    status, body = call("GET", f"{base}/v0/spaces/{args.space}/dispatches", owner)
    if status != 200:
        raise SystemExit(f"PPMA is not reachable at {base}: HTTP {status} {body}")
    print(f"PPMA reachable at {base} (space {args.space})")

    status, body = call("PUT", f"{base}/v0/apps/{APP_ID}/manifest", owner, manifest)
    if status not in (200, 201):
        raise SystemExit(f"Manifest rejected: HTTP {status} {body}")
    print(f"Manifest registered: app={body.get('app')} version={body.get('version')}")

    status, body = call("POST", f"{base}/v0/apps/{APP_ID}/token", owner, {"revoke_previous": True})
    if status not in (200, 201) or not body.get("token"):
        raise SystemExit(f"Token issue failed: HTTP {status} {body}")
    token = body["token"]
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(token, encoding="utf-8")
    try:
        token_file.chmod(0o600)
    except OSError:
        pass
    print(f"App token minted for {body.get('app')} -> {token_file} (secret, not printed)")

    event = sample_event(args.space)
    status, batch = call("POST", f"{base}/v0/spaces/{args.space}/messages", token, {"messages": [event]})
    if status not in (200, 201, 202):
        raise SystemExit(f"Event rejected: HTTP {status} {batch}")
    print(f"Event accepted: id={event['id']} type={event['type']}")
    print(f"Batch response: {json.dumps(batch)[:400]}")

    # Idempotency: the same id again must not create a second entry.
    status, replay = call("POST", f"{base}/v0/spaces/{args.space}/messages", token, {"messages": [event]})
    print(f"Replay of the same id: HTTP {status} {json.dumps(replay)[:240]}")

    status, views = call("GET", f"{base}/v0/spaces/{args.space}/memory/views", owner)
    if status != 200:
        raise SystemExit(f"Memory read failed: HTTP {status} {views}")
    names = [view.get("view") or view.get("name") for view in views.get("views", [])]
    print(f"Memory views available: {names}")

    print("\nRESULT")
    print(f"  backend:      {base}")
    print(f"  app:          {APP_ID}")
    print(f"  app token:    {token_file}")
    print(f"  event id:     {event['id']}")
    print("  status:       REAL — PPMA accepted the event and exposes its memory views")


if __name__ == "__main__":
    main()

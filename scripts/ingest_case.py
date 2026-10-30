"""Ingest one real case into PPMA through the RECALL live bridge.

The case file is the source of truth. This script does not invent facts: it copies the title,
consent, participants, summary, decisions, actions, questions, risks and transcript from the JSON
into a `capture.meeting.completed` event and posts it with the same HMAC the app uses.

Usage:
    py -3 scripts/ingest_case.py --case examples/real-case/case.json
    py -3 scripts/ingest_case.py --case examples/real-case/case.json --dry-run

The event id is derived from `case_id`, so re-running the same case is idempotent: PPMA reports a
duplicate instead of creating a second memory. Nothing is sent to a hosted service; the bridge is
local by default.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CASE = ROOT / "examples" / "real-case" / "case.json"
FALLBACK_CASE = ROOT / "examples" / "real-case" / "case.example.json"

REQUIRED = ("case_id", "title", "occurred_at", "consent", "participants", "summary")


def load_case(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"case file not found: {path}")
    try:
        case = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"{path} is not valid JSON: {error}") from error
    missing = [key for key in REQUIRED if key not in case or case[key] in (None, "", [])]
    if missing:
        raise SystemExit(f"{path} is missing required fields: {', '.join(missing)}")
    if not isinstance(case.get("consent"), dict) or not case["consent"].get("state"):
        raise SystemExit("consent.state is required; never ingest a case without recorded consent")
    return case


def event_for(case: dict) -> dict:
    case_id = str(case["case_id"])
    participants = [
        person.get("name") if isinstance(person, dict) else str(person)
        for person in case.get("participants", [])
    ]
    transcript = case.get("transcript", [])
    evidence = [
        {
            "id": line.get("id", f"e{index + 1}"),
            "quote": line.get("text", ""),
            "speaker": line.get("speaker", ""),
            "start_seconds": line.get("start", 0),
            "confidence": line.get("confidence", 0.9),
        }
        for index, line in enumerate(transcript)
    ]
    actions = [
        {
            **action,
            "evidence": action.get("evidence") or action.get("evidence_id", ""),
        }
        for action in case.get("actions", [])
    ]
    decisions = [
        {
            **decision,
            "evidence": decision.get("evidence") or decision.get("evidence_id", ""),
        }
        for decision in case.get("decisions", [])
    ]
    payload = {
        "capture_id": f"cap_{case_id}",
        "case_id": case_id,
        "title": case["title"],
        "mode": case.get("mode", "meeting"),
        "duration_seconds": case.get("duration_seconds", 0),
        "language": case.get("language", "en"),
        "jurisdiction": case.get("jurisdiction", ""),
        "consent": case["consent"],
        "participants": participants,
        "summary": case["summary"],
        "decisions": decisions,
        "actions": actions,
        "action_items": actions,
        "questions": case.get("questions", []),
        "risks": case.get("risks", []),
        "evidence": evidence,
        "transcript": transcript,
        "provenance": {
            "source": "case_import",
            "imported_file": case.get("source_file") or "case.json",
            "asr": "none",
            "raw_media": "local_only",
            "note": "Text supplied by the owner; this build did not run speech recognition.",
        },
        "tags": case.get("tags", []),
    }
    return {
        "event_id": f"evt_{case_id}",
        "app_id": "capture",
        "space": os.getenv("PPMA_SPACE", "me"),
        "occurred_at": case["occurred_at"],
        "type": "capture.call.completed" if case.get("mode") == "call" else "capture.meeting.completed",
        "sensitivity": case.get("sensitivity", "personal"),
        "delivery": {"status": "queued", "attempts": 0, "delivered_at": None},
        "provenance": payload["provenance"],
        "payload": payload,
    }


def signature(secret: str, body: bytes) -> str:
    return f"sha256={hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()}"


def post(bridge: str, secret: str, event: dict) -> tuple[int, dict]:
    body = json.dumps(event, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(f"{bridge.rstrip('/')}/v1/events", data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("X-Recall-Signature", signature(secret, body))
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, {"detail": raw[:400]}
    except Exception as error:  # noqa: BLE001 - the operator needs the real reason
        return 0, {"detail": str(error)}


def health(bridge: str) -> dict:
    try:
        with urllib.request.urlopen(f"{bridge.rstrip('/')}/health", timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as error:  # noqa: BLE001
        return {"ok": False, "detail": str(error)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", default=str(DEFAULT_CASE if DEFAULT_CASE.exists() else FALLBACK_CASE))
    parser.add_argument("--bridge", default=os.getenv("RECALL_BRIDGE", "http://127.0.0.1:8788"))
    parser.add_argument("--secret", default=os.getenv("RECALL_SHARED_SECRET", "recall-demo-secret"))
    parser.add_argument("--dry-run", action="store_true", help="print the event without sending it")
    parser.add_argument("--json", action="store_true", help="print a machine-readable result")
    args = parser.parse_args()

    case = load_case(Path(args.case))
    event = event_for(case)
    result: dict = {
        "ok": False,
        "case_file": args.case,
        "case_id": case["case_id"],
        "event_id": event["event_id"],
        "bridge": args.bridge,
        "title": case["title"],
    }

    if args.dry_run:
        result["ok"] = True
        result["dry_run"] = True
        result["event"] = event
    else:
        state = health(args.bridge)
        if not state.get("ok"):
            result["detail"] = f"bridge not reachable at {args.bridge}: {state.get('detail', state)}"
        else:
            status, body = post(args.bridge, args.secret, event)
            result["status"] = status
            result["response"] = body
            result["ok"] = status in (200, 201, 202) and bool(body.get("accepted") or body.get("duplicate"))
            result["duplicate"] = bool(body.get("duplicate"))
            result["memory_entries"] = body.get("memory_entries")
            result["backend"] = body.get("backend")

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"case:     {case['title']} ({case['case_id']})")
        print(f"event:    {event['event_id']}  type={event['type']}")
        print(f"capture:  {event['payload']['capture_id']}")
        print(f"consent:  {case['consent'].get('state')}")
        print(f"facts:    {len(event['payload']['decisions'])} decisions · {len(event['payload']['actions'])} actions · {len(event['payload']['questions'])} questions · {len(event['payload']['risks'])} risks · {len(event['payload']['transcript'])} transcript rows")
        if args.dry_run:
            print("dry run:   nothing sent")
        elif result["ok"]:
            print(f"bridge:   {args.bridge} -> {result.get('backend', 'PPMA')}")
            print(f"status:   {'duplicate (idempotent)' if result.get('duplicate') else 'accepted'}")
            print(f"memory:   {result.get('memory_entries', 'unknown')} entries")
            print("\nNext: ask the agent, e.g.")
            print('  integrations\\openjiuwen\\recall_agent.py --query "List the decisions and open actions for this case."')
        else:
            print(f"failed:   {result.get('detail') or result.get('response')}")
            print("Start the bridge first: cd server && npm run live")
            sys.exit(1)

    if not args.json and not result["ok"] and not args.dry_run:
        sys.exit(1)


if __name__ == "__main__":
    main()

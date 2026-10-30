"""Run a real openjiuwen agent over RECALL's live PPMA memory.

This is the proof behind the "openjiuwen runtime connected" status. It:

1. loads the same model credentials coachme uses (``.env``);
2. builds an openjiuwen ``Model`` and a DeepAgent;
3. exposes RECALL capture tools that read the live PPMA bridge;
4. runs the agent on the global ``Runner`` and records every tool call.

It never invents a tool result: the memory comes from the running PPMA backend through
``server/src/ppmaLive.mjs``.

Usage (use coachme's venv, which carries openjiuwen):
    C:\\Workspace\\openjiuwendemos\\coachme\\.venv\\Scripts\\python.exe ^
        integrations\\openjiuwen\\recall_agent.py --query "What did PPMA remember from RECALL?"

Environment:
    COACHME_ENV   default C:\\Workspace\\openjiuwendemos\\coachme\\.env
    RECALL_BRIDGE default http://127.0.0.1:8788
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

BRIDGE = os.getenv("RECALL_BRIDGE", "http://127.0.0.1:8788").rstrip("/")
CASE_FILE = os.getenv("RECALL_CASE_FILE", r"examples\real-case\case.json")
TOOL_CALLS: list[dict] = []


def get_json(path: str) -> dict:
    request = urllib.request.Request(f"{BRIDGE}{path}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": error.code, "detail": error.read().decode("utf-8", "replace")[:400]}
    except Exception as error:  # noqa: BLE001 - the agent gets the failure, not a crash
        return {"ok": False, "detail": str(error)}


def recall_memory() -> str:
    """List every memory statement the running PPMA backend holds for the RECALL app.

    Returns JSON with the memory views, each statement's text, confidence and origin.
    """
    data = get_json("/v1/memory")
    TOOL_CALLS.append({"tool": "recall_memory", "ok": data.get("ok", True), "entries": data.get("entries", 0)})
    if not data.get("ok", True):
        return json.dumps({"error": data.get("detail", "memory read failed")})
    rows = []
    for view in data.get("views", []):
        for statement in view.get("statements", []):
            rows.append(
                {
                    "view": view.get("view"),
                    "text": statement.get("text"),
                    "confidence": statement.get("confidence"),
                    "origin": statement.get("origin"),
                }
            )
    return json.dumps({"entries": len(rows), "statements": rows}, ensure_ascii=False)


def recall_search(query: str) -> str:
    """Search PPMA memory for statements matching a free-text query.

    Use this when the user asks whether a specific fact, decision or promise is remembered.
    """
    data = json.loads(recall_memory())
    words = [word.lower() for word in query.split() if len(word) > 2]
    rows = data.get("statements", [])
    hits = [row for row in rows if any(word in (row.get("text") or "").lower() for word in words)]
    TOOL_CALLS.append({"tool": "recall_search", "query": query, "hits": len(hits)})
    return json.dumps({"query": query, "hits": hits}, ensure_ascii=False)


def recall_recent_events(limit: int = 10) -> str:
    """List the most recent RECALL events that the bridge delivered to PPMA."""
    data = get_json("/v1/metrics")
    rows = (data.get("recent") or [])[: max(1, min(limit, 20))]
    TOOL_CALLS.append({"tool": "recall_recent_events", "returned": len(rows)})
    return json.dumps({"events": rows}, ensure_ascii=False)


def recall_case() -> str:
    """Read the local case file the operator is analysing.

    Returns the case title, consent, participants, summary, decisions, actions, questions, risks and
    transcript as JSON. Use this for the operator's own case file; use recall_memory for what PPMA
    actually remembers. If the two disagree, say so.
    """
    path = Path(CASE_FILE)
    if not path.is_absolute():
        path = Path.cwd() / path
    if not path.exists():
        fallback = Path.cwd() / "examples" / "real-case" / "case.example.json"
        path = fallback if fallback.exists() else path
    try:
        case = json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:  # noqa: BLE001 - the agent gets the failure
        TOOL_CALLS.append({"tool": "recall_case", "ok": False})
        return json.dumps({"error": f"could not read {path}: {error}"})
    fields = ["case_id", "title", "occurred_at", "consent", "participants", "summary", "decisions", "actions", "questions", "risks", "transcript"]
    subset = {key: case.get(key) for key in fields if key in case}
    TOOL_CALLS.append({"tool": "recall_case", "ok": True, "case_id": case.get("case_id"), "file": str(path)})
    return json.dumps(subset, ensure_ascii=False)


def build_agent():
    from openjiuwen.core.foundation.llm import Model, ModelClientConfig, ModelRequestConfig
    from openjiuwen.core.foundation.tool import tool
    from openjiuwen.harness import create_deep_agent

    import tempfile

    workspace = Path(os.getenv("RECALL_AGENT_WORKSPACE", Path(tempfile.gettempdir()) / "recall-openjiuwen"))
    workspace.mkdir(parents=True, exist_ok=True)

    client = ModelClientConfig(
        client_provider=os.getenv("MODEL_PROVIDER", "OpenAI"),
        api_key=os.getenv("API_KEY", ""),
        api_base=os.getenv("API_BASE", ""),
        timeout=float(os.getenv("LLM_TIMEOUT", "180")),
        verify_ssl=os.getenv("LLM_SSL_VERIFY", "false").lower() in {"1", "true", "yes", "on"},
    )
    request = ModelRequestConfig(model=os.getenv("MODEL_NAME", ""), temperature=0.1, top_p=0.9)
    model = Model(model_client_config=client, model_config=request)

    tools = [tool(recall_memory), tool(recall_search), tool(recall_recent_events), tool(recall_case)]
    agent = create_deep_agent(
        model=model,
        system_prompt=(
            "You are RECALL's capture agent. RECALL captures meetings and proves provenance; PPMA owns "
            "memory, state and action. Use recall_case for the operator's local case file and recall_memory "
            "for what PPMA holds. Never invent a memory entry. If the file and PPMA disagree, say so. "
            "State plainly when a fact is absent. You never send, delete or execute project actions."
        ),
        tools=tools,
        max_iterations=4,
        workspace=str(workspace),
    )
    return agent


def load_env(path: Path) -> None:
    try:
        from dotenv import load_dotenv
    except ImportError as error:  # pragma: no cover
        raise SystemExit("python-dotenv is required; run with coachme's venv") from error
    if not path.exists():
        raise SystemExit(f"missing env file: {path}")
    load_dotenv(path, override=False)
    missing = [key for key in ("API_KEY", "API_BASE", "MODEL_NAME") if not os.getenv(key)]
    if missing:
        raise SystemExit("missing model settings: " + ", ".join(missing))


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default="What does PPMA remember from the RECALL captures? List the statements.")
    parser.add_argument("--env", default=os.getenv("COACHME_ENV", r"C:\Workspace\openjiuwendemos\coachme\.env"))
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--out", default="", help="write the JSON result to this file (UTF-8)")
    args = parser.parse_args()

    load_env(Path(args.env))
    from openjiuwen.core.runner import Runner

    agent = build_agent()
    await Runner.start()
    result = await Runner.run_agent(agent, {"query": args.query})
    text = ""
    if isinstance(result, dict):
        for key in ("output", "content", "answer", "result"):
            if isinstance(result.get(key), str):
                text = result[key]
                break
    if not text:
        text = getattr(result, "content", None) or str(result)

    payload = {
        "ok": bool(text) and bool(TOOL_CALLS),
        "query": args.query,
        "model": os.getenv("MODEL_NAME", ""),
        "provider": os.getenv("MODEL_PROVIDER", "OpenAI"),
        "bridge": BRIDGE,
        "case_file": CASE_FILE,
        "tool_calls": TOOL_CALLS,
        "answer": text,
    }
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(payload, ensure_ascii=False))
    else:
        print(f"model: {payload['model']} via {payload['provider']}")
        print(f"bridge: {payload['bridge']}")
        print("tool calls:")
        for call in TOOL_CALLS or [{"tool": "none"}]:
            print("  " + json.dumps(call, ensure_ascii=False))
        print("\nanswer:\n" + text)


if __name__ == "__main__":
    asyncio.run(main())

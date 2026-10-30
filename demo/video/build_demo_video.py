"""Build the English RECALL end-to-end demo video on the real Helios case.

Pipeline (same shape as coachme's demo videos):
  edge-tts narration -> per-scene MP3 + SRT -> Playwright screen recording ->
  ffmpeg mux with burned captions.

Prerequisites:
  - the built app is served at http://localhost:5190 (web: npm run preview -- --port 5190)
  - PPMA is running at 127.0.0.1:8771 and the bridge at 127.0.0.1:8788
  - uvx can run edge-tts, and Chrome is installed

Run with coachme's Python only for the ffmpeg path; the script itself is stdlib + Playwright:
  uvx --with playwright python demo/video/build_demo_video.py

Outputs (demo/video/):
  recall-demo-en.mp4          final video, burned English captions
  recall-demo-en-soft.mp4     optional soft-subtitle version
  recall-demo-en.srt          captions
  thumbnail.png               title card
  agent-run.json              the real openjiuwen run shown in the video
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
FF = Path(
    r"C:\Workspace\openjiuwendemos\coachme\.venv\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
)
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
BASE = "http://localhost:5190"
CASE_FILE = REPO / "examples" / "real-case" / "case.example.json"
RAW_CASE = REPO / "examples" / "real-case" / "case.raw.json"
AGENT_RUN = ROOT / "agent-run.json"

FPS = 30
GAP = 0.55
TITLE = 4.0
TAIL = 1.0

BUDGET = {
    "00_title": 4.0,
    "01_raw": 15.0,
    "02_analyze": 20.0,
    "03_findings": 20.0,
    "04_proactive": 22.0,
    "05_approve": 30.0,
    "06_ppma": 18.0,
    "07_recall": 16.0,
    "08_agent": 16.0,
    "09_status": 18.0,
    "10_close": 12.0,
}

SCENES = [
    ("00_title", "Title", "RECALL. From a raw transcript to a decision."),
    ("01_raw", "A raw transcript", "A forty-minute rollout meeting. Fifteen lines that matter. No decisions written down, no action list, no risk register. Just what people said."),
    ("02_analyze", "The agent reads it", "The agent reads every line. It extracts decisions, actions, risks, gaps and open questions. Each one must point to the exact quote it came from, or it is not shown."),
    ("03_findings", "What it found", "Four decisions. Four actions with owners and dates. Three delivery risks. An unanswered question about on-call cover. And a gap: nobody owns the answer."),
    ("04_proactive", "Bounded proactivity", "This is the part a notebook cannot do. It raises the runbook the field team needs, the support rota that is still thin, the two customers waiting on bulk import, and the question nobody answered. Five things need a human, each with evidence and a reason."),
    ("05_approve", "Human authority", "Connect the live PPMA first. The bridge keeps the tokens server side. Then approve the findings: only the approved facts leave. PPMA accepts the event."),
    ("06_ppma", "The approved event", "The approved event is in the delivery log, and the live backend acknowledged it. PPMA owns project state from here."),
    ("07_recall", "Ask the evidence", "Ask later. What did we decide about onboarding? The answer cites the exact quote, speaker and time. If the evidence is absent, it refuses."),
    ("08_agent", "A real openjiuwen agent", "A second, real openjiuwen agent can analyse the same case and PPMA memory through four read-only tools. It never sends, deletes or executes."),
    ("09_status", "What is real", "This is the honest split. The analysis runtime, PPMA, the bridge, openjiuwen and the model endpoint are real and local. ASR, vendor connectors, identity, billing and cloud storage are still contracts or simulators."),
    ("10_close", "From transcript to decision", "From a raw transcript to evidence-linked decisions, proactive risk and a human-approved handoff. That is RECALL."),
]


def ffmpeg(*args: str) -> None:
    cmd = [str(FF), "-hide_banner", "-loglevel", "error", "-y", *args]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{' '.join(cmd)}\n{result.stderr[-3000:]}")


def duration(path: Path) -> float:
    result = subprocess.run([str(FF), "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError(f"cannot read duration: {path}")
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def wav_frames(path: Path) -> tuple[bytes, int]:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != 1 or handle.getsampwidth() != 2:
            raise RuntimeError(f"unexpected WAV: {path}")
        return handle.readframes(handle.getnframes()), handle.getframerate()


def make_audio() -> tuple[list[dict], float]:
    folder = ROOT / "audio"
    folder.mkdir(exist_ok=True)
    for old in folder.glob("*"):
        old.unlink()
    info: list[dict] = []
    for key, label, text in SCENES:
        txt = folder / f"{key}.txt"
        mp3 = folder / f"{key}.mp3"
        srt = folder / f"{key}.srt"
        previous = txt.read_text(encoding="utf-8") if txt.exists() else ""
        txt.write_text(text, encoding="utf-8")
        ok = previous == text and mp3.exists() and srt.exists() and mp3.stat().st_size > 1000
        if ok:
            print(f"  {key}: reuse")
        for attempt in range(1, 6):
            if ok:
                break
            result = subprocess.run(
                [
                    "uvx", "edge-tts", "--voice", "en-US-AndrewNeural", "--rate", "+5%",
                    "--file", str(txt), "--write-media", str(mp3), "--write-subtitles", str(srt),
                    "--no-progress",
                ],
                capture_output=True, text=True,
            )
            if result.returncode == 0 and mp3.exists() and mp3.stat().st_size > 1000:
                ok = True
                break
            print(f"  tts retry {key} {attempt}: {result.stderr[-160:]}")
            time.sleep(2)
        if not ok:
            raise RuntimeError(f"edge-tts failed for {key}")
        audio = round(duration(mp3), 3)
        info.append(
            {
                "key": key,
                "label": label,
                "audio": audio,
                "duration": round(max(audio + 1.0, BUDGET.get(key, audio + GAP)), 3),
            }
        )
        print(f"  {key}: {audio:.2f}s")

    info[0]["duration"] = TITLE
    info[0]["start"] = 0.0
    info[0]["end"] = TITLE
    start = TITLE
    for scene in info[1:]:
        scene["start"] = round(start, 3)
        scene["end"] = round(start + scene["duration"], 3)
        start = scene["end"]
    return info, round(start + TAIL, 3)


def make_voice(info: list[dict], total: float) -> Path:
    folder = ROOT / "audio"
    rate = 24000
    silence = lambda seconds: b"\x00\x00" * int(round(seconds * rate))
    chunks: list[bytes] = []
    for index, scene in enumerate(info):
        mp3 = folder / f"{scene['key']}.mp3"
        wav = folder / f"{scene['key']}.wav"
        ffmpeg("-i", str(mp3), "-ar", str(rate), "-ac", "1", "-c:a", "pcm_s16le", str(wav))
        frames, _ = wav_frames(wav)
        if index == 0:
            chunks.append(silence(0.5))
            chunks.append(frames)
            chunks.append(silence(max(0.0, scene["duration"] - 0.5 - scene["audio"])))
        else:
            chunks.append(frames)
            chunks.append(silence(max(0.0, scene["duration"] - scene["audio"])))
        wav.unlink(missing_ok=True)
    chunks.append(silence(TAIL))

    voice = ROOT / "voice-en.wav"
    with wave.open(str(voice), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(b"".join(chunks))
    if abs(duration(voice) - total) > 0.2:
        raise RuntimeError(f"voice length mismatch: {duration(voice)} vs {total}")
    return voice


def clock(value: float, comma: bool = True) -> str:
    ms = int(round((value - int(value)) * 1000))
    seconds = int(value)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    sep = "," if comma else "."
    return f"{h:02}:{m:02}:{s:02}{sep}{ms:03}"


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    rows: list[tuple[float, float, str]] = []
    blocks = re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip())
    for block in blocks:
        lines = [line for line in block.splitlines() if line.strip()]
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        left, right = [part.strip() for part in lines[1].split("-->")]
        rows.append((parse_ts(left), parse_ts(right), " ".join(lines[2:])))
    return rows


def parse_ts(value: str) -> float:
    value = value.replace(",", ".")
    parts = value.split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    return int(parts[0]) * 60 + float(parts[1])


def make_srt(info: list[dict]) -> Path:
    folder = ROOT / "audio"
    lines: list[str] = []
    index = 1
    for scene_index, scene in enumerate(info):
        offset = 0.5 if scene_index == 0 else scene["start"]
        for a, b, text in parse_srt(folder / f"{scene['key']}.srt"):
            lines += [str(index), f"{clock(offset + a)} --> {clock(offset + b)}", text, ""]
            index += 1
    path = ROOT / "recall-demo-en.srt"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_pages(info: list[dict]) -> dict[str, Path]:
    title = ROOT / "title.html"
    title.write_text(
        """<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;height:100vh;display:grid;place-items:center;background:#0d0e10;color:#f2efe8;
        font-family:Georgia,'Times New Roman',serif;overflow:hidden}
        .wrap{width:1500px}
        .kicker{font-family:ui-monospace,Consolas,monospace;font-size:22px;letter-spacing:.28em;
        text-transform:uppercase;color:#e8a33d;margin-bottom:34px}
        h1{font-size:112px;line-height:.94;letter-spacing:-.045em;margin:0 0 36px;font-weight:500}
        p{font-size:30px;line-height:1.4;color:#b8b2a7;margin:0 0 12px;max-width:1100px}
        .meta{font-family:ui-monospace,Consolas,monospace;font-size:18px;color:#7f7a71;margin-top:44px;letter-spacing:.08em}
        .bar{width:120px;height:4px;background:#e8a33d;margin:34px 0}
        </style></head><body><div class="wrap">
        <div class="kicker">RECALL · intelligence demo</div>
        <h1>From a raw transcript<br/>to a decision.</h1>
        <div class="bar"></div>
        <p>The agent reads the meeting, finds the decisions, risks and gaps, and links every one to a quote.</p>
        <div class="meta">ENGLISH · HELIOS ROLLOUT CASE</div>
        </div></body></html>""",
        encoding="utf-8",
    )

    agent = json.loads(AGENT_RUN.read_text(encoding="utf-8-sig"))
    def clean(line: str) -> str:
        line = line.replace("\ufffd?", "—").replace("\ufffd", "—")
        line = line.replace("**", "").replace("*", "").replace("###", "").replace("##", "").replace("#", "")
        line = line.replace("> ", "").strip()
        return line
    answer = "\n".join(clean(line) for line in agent["answer"].splitlines() if line.strip())
    if len(answer) > 1800:
        answer = answer[:1800].rsplit("\n", 1)[0] + "\n…"
    calls = "".join(
        f"<div class='call'><span>{html.escape(c.get('tool',''))}</span><b>{html.escape(str(c.get('case_id') or c.get('entries') or c.get('returned') or 'ok'))}</b></div>"
        for c in agent.get("tool_calls", [])
    )
    agent_html = ROOT / "agent.html"
    agent_html.write_text(
        f"""<!doctype html><html><head><meta charset="utf-8"><style>
        body{{margin:0;height:100vh;background:#0d0e10;color:#e9e5dc;font-family:ui-monospace,Consolas,monospace;overflow:hidden}}
        .wrap{{display:grid;grid-template-columns:480px 1fr;gap:34px;padding:48px 60px;box-sizing:border-box;height:100vh}}
        .kicker{{font-size:15px;letter-spacing:.22em;color:#e8a33d;text-transform:uppercase;margin-bottom:14px}}
        h1{{font-family:Georgia,serif;font-weight:500;font-size:40px;line-height:1.06;margin:0 0 16px;letter-spacing:-.03em}}
        p{{font-size:16px;line-height:1.5;color:#a9a39a}}
        .call{{display:flex;justify-content:space-between;gap:12px;border:1px solid #2a2c31;border-radius:9px;padding:10px 12px;margin-top:8px;background:#121317}}
        .call span{{color:#7fd1a8;font-size:13px}} .call b{{color:#8b867d;font-size:12px;font-weight:400;text-align:right}}
        .out{{background:#111216;border:1px solid #2a2c31;border-radius:12px;padding:22px 26px;overflow:hidden}}
        .out h2{{font-size:13px;color:#8b867d;letter-spacing:.12em;text-transform:uppercase;margin:0 0 12px}}
        pre{{white-space:pre-wrap;font-size:15.5px;line-height:1.42;color:#dcd7ce;margin:0}}
        .tag{{display:inline-block;border:1px solid #3a6b52;color:#7fd1a8;border-radius:999px;padding:4px 10px;font-size:11px;margin:8px 0 4px}}
        </style></head><body><div class="wrap">
        <div><div class="kicker">Real openjiuwen run</div><h1>Agent over the case and PPMA memory</h1>
        <p>Model: {html.escape(agent.get('model',''))}. Four read-only tools. The answer below is the captured output.</p>
        <div class="tag">no send · no execute · no delete</div>
        {calls}
        </div>
        <div class="out"><h2>Captured answer</h2><pre>{html.escape(answer)}</pre></div>
        </div></body></html>""",
        encoding="utf-8",
    )

    status = ROOT / "status.html"
    status.write_text(
        """<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;height:100vh;background:#0d0e10;color:#e9e5dc;font-family:Georgia,serif;overflow:hidden}
        .wrap{padding:58px 70px}
        .kicker{font-family:ui-monospace,Consolas,monospace;font-size:16px;letter-spacing:.22em;color:#e8a33d;text-transform:uppercase}
        h1{font-size:56px;font-weight:500;letter-spacing:-.03em;margin:14px 0 28px}
        table{border-collapse:collapse;width:100%;font-family:ui-monospace,Consolas,monospace;font-size:19px}
        td{padding:11px 8px;border-bottom:1px solid #26282d;vertical-align:top}
        td:first-child{width:330px;color:#f2efe8} td:nth-child(2){width:180px}
        .real{color:#7fd1a8}.local{color:#e8a33d}.contract{color:#9aa7c7}.absent{color:#d47c7c}
        </style></head><body><div class="wrap">
        <div class="kicker">Status · verified locally</div>
        <h1>What is real, and what is not.</h1>
        <table>
        <tr><td>PPMA backend</td><td class="local">local real</td><td>running at 127.0.0.1:8771</td></tr>
        <tr><td>Analysis runtime</td><td class="real">local real</td><td>raw transcript → evidence-linked decisions, actions, risks, gaps</td></tr>
        <tr><td>PPMA bridge</td><td class="local">local real</td><td>tokens server side, north contract, 127.0.0.1:8788</td></tr>
        <tr><td>openjiuwen agent</td><td class="local">local real</td><td>deepseek-v4-pro, read-only tools</td></tr>
        <tr><td>Model endpoint</td><td class="real">real</td><td>coachme credentials, no key in the repo</td></tr>
        <tr><td>ASR · diarization · VAD</td><td class="absent">absent</td><td>text import only, no microphone</td></tr>
        <tr><td>OCR</td><td class="contract">simulator</td><td>scripted text, image stays local</td></tr>
        <tr><td>Vendor connectors</td><td class="contract">contract</td><td>calendar, mail, Slack, CRM, Jira — no OAuth</td></tr>
        <tr><td>SSO · SCIM · billing</td><td class="contract">contract</td><td>no identity provider, no Stripe keys</td></tr>
        <tr><td>Cloud storage</td><td class="absent">absent</td><td>AES-GCM browser storage only</td></tr>
        </table></div></body></html>""",
        encoding="utf-8",
    )

    close = ROOT / "close.html"
    close.write_text(
        """<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;height:100vh;display:grid;place-items:center;background:#0d0e10;color:#f2efe8;
        font-family:Georgia,serif;text-align:center}
        .kicker{font-family:ui-monospace,Consolas,monospace;letter-spacing:.3em;color:#e8a33d;font-size:20px;text-transform:uppercase}
        h1{font-size:96px;font-weight:500;letter-spacing:-.04em;margin:26px 0 30px}
        p{font-family:ui-monospace,Consolas,monospace;color:#9d978d;font-size:20px;line-height:1.7}
        </style></head><body><div>
        <div class="kicker">RECALL</div><h1>From transcript<br/>to decision.</h1>
        <p>jiuwendemos.github.io/recall<br/>github.com/jiuwendemos/recall</p>
        </div></body></html>""",
        encoding="utf-8",
    )
    return {"title": title, "agent": agent_html, "status": status, "close": close}


CURSOR_JS = r"""
() => {
  if (window.__rcCursor) return;
  window.__rcCursor = true;
  const style = document.createElement('style');
  style.textContent = `
    #rc-cursor{position:fixed;left:0;top:0;width:26px;height:30px;z-index:2147483647;pointer-events:none;transform:translate(800px,450px);filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));transition:transform .06s linear}
    #rc-cursor svg{display:block;width:100%;height:100%}
    #rc-cursor.down{transform:translate(var(--x),var(--y)) scale(.82)}
    .rc-ripple{position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border:3px solid #e8a33d;border-radius:50%;z-index:2147483646;pointer-events:none;animation:rcRipple .55s ease-out forwards}
    @keyframes rcRipple{from{transform:scale(.4);opacity:1}to{transform:scale(3.6);opacity:0}}
  `;
  document.head.appendChild(style);
  const c=document.createElement('div'); c.id='rc-cursor';
  c.innerHTML='<svg viewBox="0 0 26 30" xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L2 24 L8.5 18 L13 28 L17 26 L12.5 16.5 L21 16.5 Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  let x=800,y=450;
  const move=e=>{x=e.clientX;y=e.clientY;c.style.setProperty('--x',x+'px');c.style.setProperty('--y',y+'px');c.style.transform=`translate(${x}px, ${y}px)`};
  const down=e=>{if(e.button!==0)return;c.classList.add('down');const r=document.createElement('div');r.className='rc-ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),700)};
  const up=()=>c.classList.remove('down');
  window.addEventListener('mousemove',move,true);window.addEventListener('mousedown',down,true);window.addEventListener('mouseup',up,true);
}
"""


def move(page: Page, x: float, y: float, steps: int = 26, pause: int = 250) -> None:
    page.mouse.move(float(x), float(y), steps=steps)
    page.wait_for_timeout(pause)


def center(page: Page, locator, dx: float = 0, dy: float = 0, steps: int = 24, pause: int = 220):
    locator.scroll_into_view_if_needed()
    page.wait_for_timeout(160)
    box = locator.bounding_box()
    if not box:
        raise RuntimeError("no bounding box")
    x = box["x"] + box["width"] / 2 + dx
    y = box["y"] + box["height"] / 2 + dy
    move(page, x, y, steps=steps, pause=pause)
    return x, y


def click(page: Page, locator, dx: float = 0, dy: float = 0) -> None:
    x, y = center(page, locator, dx, dy)
    page.mouse.click(x, y)
    page.wait_for_timeout(240)


def tap(page: Page, locator) -> None:
    """Move the drawn cursor, then let Playwright click with its own waits."""
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    if box:
        move(page, box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=20, pause=120)
    locator.click()
    page.wait_for_timeout(260)


def smooth_top(page: Page) -> None:
    page.evaluate("window.scrollTo({top:0,behavior:'smooth'})")
    page.wait_for_timeout(450)


def go(page: Page, path: str, text: str) -> None:
    page.goto(BASE + path, wait_until="load")
    page.get_by_text(text, exact=False).first.wait_for(timeout=30000)
    page.wait_for_timeout(400)


def wait_until(t: float) -> None:
    remaining = t - time.monotonic()
    if remaining > 0:
        time.sleep(remaining)


def record(info: list[dict], pages: dict[str, Path], total: float) -> Path:
    raw = ROOT / "raw"
    raw.mkdir(exist_ok=True)
    for old in raw.glob("*.webm"):
        old.unlink()
    starts = {scene["key"]: scene["start"] for scene in info}
    ends = {scene["key"]: scene["end"] for scene in info}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=str(CHROME), headless=True, args=["--force-device-scale-factor=1"])
        context = browser.new_context(
            viewport={"width": 1600, "height": 900},
            record_video_dir=str(raw),
            record_video_size={"width": 1600, "height": 900},
        )
        page = context.new_page()
        page.set_default_timeout(20000)
        t0 = time.monotonic()
        page.goto(pages["title"].as_uri(), wait_until="load")
        page.wait_for_timeout(400)
        page.screenshot(path=str(ROOT / "thumbnail.png"))

        # 01 raw: My workspace + import the raw transcript
        wait_until(t0 + starts["01_raw"])
        go(page, "/#/settings", "Workspace data")
        page.wait_for_timeout(300)
        page.evaluate(CURSOR_JS)
        tour = page.get_by_text("Explore on my own", exact=True)
        if tour.count():
            tap(page, tour)
            page.wait_for_timeout(500)
        tap(page, page.get_by_role("button", name="My workspace (blank)", exact=True))
        page.get_by_text("Only entries you created are shown", exact=False).wait_for(timeout=10000)
        page.wait_for_timeout(400)
        go(page, "/#/record", "Import a case")
        page.evaluate(CURSOR_JS)
        for box in page.locator("input[type=checkbox]").all():
            if not box.is_checked():
                tap(page, box)
        page.wait_for_timeout(400)
        page.set_input_files("input[accept*='.json']", str(RAW_CASE))
        page.wait_for_url(re.compile(r"#/meetings/"), timeout=20000)
        page.get_by_role("button", name="Intelligence", exact=True).wait_for(timeout=15000)
        page.wait_for_timeout(700)
        page.evaluate(CURSOR_JS)
        move(page, 700, 400, steps=22, pause=500)
        page.evaluate("window.scrollBy(0, 180)")
        page.wait_for_timeout(700)

        # 02 analyze
        wait_until(t0 + starts["02_analyze"])
        smooth_top(page)
        tap(page, page.get_by_role("button", name="Intelligence", exact=True))
        page.wait_for_timeout(700)
        page.evaluate(CURSOR_JS)
        tap(page, page.get_by_role("button", name=re.compile("Analyze this capture")))
        page.get_by_text("What the agent found").wait_for(timeout=90000)
        page.wait_for_timeout(800)
        page.evaluate(CURSOR_JS)
        smooth_top(page)
        move(page, 700, 420, steps=22, pause=600)

        # 03 findings
        wait_until(t0 + starts["03_findings"])
        smooth_top(page)
        page.evaluate("window.scrollBy(0, 360)")
        page.wait_for_timeout(900)
        move(page, 900, 520, steps=22, pause=600)
        page.evaluate("window.scrollBy(0, 380)")
        page.wait_for_timeout(900)
        move(page, 760, 560, steps=22, pause=600)

        # 04 proactive home
        wait_until(t0 + starts["04_proactive"])
        go(page, "/#/", "things need a human")
        page.wait_for_timeout(600)
        page.evaluate(CURSOR_JS)
        attention = page.locator(".attention-strip").first
        attention.scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        box = attention.bounding_box()
        if box:
            move(page, box["x"] + 240, box["y"] + 150, steps=24, pause=800)
            move(page, box["x"] + 760, box["y"] + 150, steps=24, pause=800)
        page.evaluate("window.scrollBy(0, 420)")
        page.wait_for_timeout(900)
        move(page, 760, 520, steps=22, pause=700)
        page.evaluate("window.scrollBy(0, 360)")
        page.wait_for_timeout(900)
        move(page, 700, 560, steps=20, pause=600)

        # 05 connect live PPMA + approve and send
        wait_until(t0 + starts["05_approve"])
        go(page, "/#/connectors", "Live PPMA bridge")
        page.wait_for_timeout(500)
        page.evaluate(CURSOR_JS)
        test = page.get_by_role("button", name=re.compile("Test live PPMA"))
        test.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        tap(page, test)
        page.get_by_text("127.0.0.1:8771", exact=False).first.wait_for(timeout=15000)
        page.wait_for_timeout(900)
        go(page, "/#/meetings", "Capture library")
        page.wait_for_timeout(400)
        page.evaluate(CURSOR_JS)
        tap(page, page.locator(".meeting-card a").first)
        page.get_by_role("button", name="Intelligence", exact=True).wait_for(timeout=15000)
        page.wait_for_timeout(500)
        page.evaluate(CURSOR_JS)
        tap(page, page.get_by_role("button", name="Intelligence", exact=True))
        page.wait_for_timeout(600)
        approve = page.get_by_role("button", name=re.compile("Approve findings"))
        approve.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        tap(page, approve)
        page.get_by_text("PPMA has the approved facts", exact=False).wait_for(timeout=15000)
        page.wait_for_timeout(1200)
        move(page, 700, 500, steps=20, pause=600)

        # 06 approved event in the PPMA log
        wait_until(t0 + starts["06_ppma"])
        go(page, "/#/ppma", "PPMA × RECALL")
        page.wait_for_timeout(700)
        page.evaluate(CURSOR_JS)
        smooth_top(page)
        move(page, 760, 400, steps=22, pause=700)
        page.evaluate("window.scrollBy(0, 260)")
        page.wait_for_timeout(900)
        move(page, 760, 560, steps=20, pause=600)

        # 07 recall
        wait_until(t0 + starts["07_recall"])
        page.goto(BASE + "/#/recall?q=What%20did%20we%20decide%20about%20onboarding%3F", wait_until="load")
        page.get_by_text("New thread", exact=False).first.wait_for(timeout=20000)
        page.wait_for_timeout(900)
        page.evaluate(CURSOR_JS)
        smooth_top(page)
        move(page, 760, 430, steps=22, pause=700)
        page.evaluate("window.scrollBy(0, 200)")
        page.wait_for_timeout(700)

        # 08 agent, 09 status, 10 close
        wait_until(t0 + starts["08_agent"])
        page.goto(pages["agent"].as_uri(), wait_until="load")
        page.wait_for_timeout(700)
        wait_until(t0 + starts["09_status"])
        page.goto(pages["status"].as_uri(), wait_until="load")
        page.wait_for_timeout(700)
        wait_until(t0 + starts["10_close"])
        page.goto(pages["close"].as_uri(), wait_until="load")
        page.wait_for_timeout(700)

        wait_until(t0 + total)
        page.wait_for_timeout(400)
        context.close()
        browser.close()

    webms = sorted(raw.glob("*.webm"), key=lambda item: item.stat().st_mtime)
    if not webms:
        raise RuntimeError("no recording produced")
    return webms[-1]


def main() -> None:
    print("1/5 narration")
    info, total = make_audio()
    print(f"   total {total:.2f}s")
    voice = make_voice(info, total)
    srt = make_srt(info)
    print("2/5 pages")
    pages = write_pages(info)
    print("3/5 recording")
    recording = record(info, pages, total)
    print(f"   {recording}")
    print("4/5 encoding")
    final = ROOT / "recall-demo-en.mp4"
    soft = ROOT / "recall-demo-en-soft.mp4"
    ffmpeg(
        "-i", str(recording), "-i", str(voice), "-i", str(srt),
        "-map", "0:v:0", "-map", "1:a:0", "-map", "2:s:0",
        "-t", f"{total:.3f}", "-r", str(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", str(soft),
    )
    import os

    previous = os.getcwd()
    os.chdir(ROOT)
    try:
        ffmpeg(
            "-i", str(soft), "-vf", "subtitles=recall-demo-en.srt:force_style='FontSize=10,Outline=1.5,Shadow=0,MarginV=20'",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-movflags", "+faststart", str(final),
        )
    finally:
        os.chdir(previous)
    print("5/5 done")
    print(f"   {final}")
    (ROOT / "timing.json").write_text(json.dumps({"total": total, "scenes": info}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtTime } from "../lib/engine";
import { createShareLink } from "../lib/share";
import { PageHead, Panel, Chip, DataNote } from "../components/UI";
import { Icon } from "../components/Icon";

type Capability = {
  id: string;
  title: string;
  category: "Attention" | "Capture" | "Recall" | "Collaboration" | "Identity" | "Connectors" | "Craft";
  detail: string;
  kind: "real" | "contract" | "simulator";
  action: string;
};

const CAPABILITIES: Capability[] = [
  { id: "captions", title: "Live captions", category: "Capture", detail: "Browser speech recognition with a visible privacy label; the private ASR path is separate.", kind: "simulator", action: "Start captions" },
  { id: "photo-timeline", title: "Photo/OCR timeline", category: "Capture", detail: "A field note and its on-device OCR attached to the capture timeline.", kind: "simulator", action: "Show OCR evidence" },
  { id: "screen-share", title: "Screen-share / slide capture", category: "Capture", detail: "A shared slide is OCR'd into evidence with a timestamp and a safe quote.", kind: "simulator", action: "Run slide OCR" },
  { id: "whiteboard", title: "Whiteboard & vision capture", category: "Capture", detail: "Vision capture with a safe-version preview before sharing.", kind: "simulator", action: "Run whiteboard capture" },
  { id: "translation", title: "Real-time translation", category: "Capture", detail: "Translated labels stay attached; the source quote is never replaced.", kind: "simulator", action: "Translate a quote" },
  { id: "wearable", title: "Wearable capture affordance", category: "Capture", detail: "A glanceable capture state from a phone/wearable; consent and battery are visible.", kind: "simulator", action: "Show wearable status" },
  { id: "ar-pin", title: "Spatial/AR evidence pin", category: "Capture", detail: "A field observation pinned to a site with an evidence pointer.", kind: "simulator", action: "Drop a spatial pin" },
  { id: "multimodal", title: "Multimodal search", category: "Recall", detail: "Text, voice and image/OCR queries resolve to one evidence graph.", kind: "simulator", action: "Search text + image" },
  { id: "generative", title: "Generative summary with evidence", category: "Recall", detail: "Each summary sentence carries its evidence on hover and on focus.", kind: "real", action: "Show a summary" },
  { id: "focus", title: "Zero-chrome focus mode", category: "Recall", detail: "Hide the shell and keep only the capture/recall surface.", kind: "real", action: "Enter focus mode" },
  { id: "room", title: "Shared evidence room", category: "Collaboration", detail: "A read-only, role-aware evidence link with expiry and redaction.", kind: "real", action: "Create a room link" },
  { id: "assignment", title: "Team digest assignment", category: "Collaboration", detail: "Assign an attention item to a team member; the digest keeps the evidence.", kind: "real", action: "Assign the top nudge" },
  { id: "shortcuts", title: "Personalised shortcuts", category: "Craft", detail: "Role-aware commands and suggestions in the palette.", kind: "real", action: "Show my shortcuts" },
  { id: "mobile", title: "Mobile share sheet / capture sheet", category: "Craft", detail: "PWA share target and shortcuts; no native app required.", kind: "real", action: "Open share target" },
  { id: "desktop", title: "Desktop menu-bar control", category: "Craft", detail: "Browser-toolbar control via the extension; opens the consent-aware review.", kind: "contract", action: "Show extension" },
  { id: "progressive", title: "Progressive disclosure", category: "Craft", detail: "Advanced evidence and safety controls stay collapsed until needed.", kind: "real", action: "Show the advanced layer" },
  { id: "latency", title: "Interaction latency budget", category: "Craft", detail: "Measure the local search budget; under 100 ms is the target.", kind: "real", action: "Measure search" },
  { id: "zoom", title: "200% zoom / keyboard pass", category: "Craft", detail: "Switch to the large type scale and verify the keyboard paths.", kind: "real", action: "Apply large type" },
  { id: "locale", title: "EN/ZH localisation QA", category: "Craft", detail: "Switch language and render the same capture with CJK line breaking.", kind: "real", action: "Preview Chinese" },
  { id: "transitions", title: "View transitions", category: "Craft", detail: "Same-document transitions with reduced-motion parity.", kind: "real", action: "Run a transition" },
  { id: "asr", title: "On-device ASR", category: "Capture", detail: "Deterministic demo adapter; the real model runs on the device target.", kind: "simulator", action: "Run ASR sample" },
  { id: "diarization", title: "Diarization + speaker map", category: "Capture", detail: "Speaker map with confidence and a human correction path.", kind: "simulator", action: "Run diarization" },
  { id: "vad", title: "VAD / silence trimming", category: "Capture", detail: "Voice activity detection with a visible trim summary.", kind: "simulator", action: "Run VAD" },
  { id: "accent", title: "Accent / noise tuning", category: "Capture", detail: "Domain/accent calibration status and quality warning.", kind: "simulator", action: "Show calibration" },
  { id: "cpu", title: "CPU fallback warning", category: "Capture", detail: "Explicit quality warning when the NPU is unavailable.", kind: "real", action: "Show fallback" },
  { id: "npu", title: "NPU model packaging", category: "Capture", detail: "Model pack manifest for the first device target.", kind: "contract", action: "Show model pack" },
  { id: "rollback", title: "Model pin / rollback", category: "Capture", detail: "Pinned model versions with a two-minor-version rollback window.", kind: "real", action: "Show pinned models" },
  { id: "no-cloud", title: "No cloud audio path", category: "Capture", detail: "Hard policy: no silent cloud fallback; the UI names the local path.", kind: "real", action: "Show the policy" },
  { id: "telemetry", title: "Device health telemetry", category: "Capture", detail: "Mic, battery, storage and thermal health, with recovery.", kind: "real", action: "Show device telemetry" },
  { id: "recovery", title: "Capture failure recovery", category: "Capture", detail: "Failure detection, a visible recovery path and a preserved queue.", kind: "real", action: "Simulate a failure" },
  { id: "calendar", title: "Calendar read (Google/Microsoft)", category: "Connectors", detail: "Read-only meeting context; no event creation.", kind: "contract", action: "Run calendar mock" },
  { id: "meetings", title: "Join Zoom / Meet / Teams", category: "Connectors", detail: "Native bridge contract; capture only after consent.", kind: "contract", action: "Run meeting mock" },
  { id: "dial-in", title: "Dial-in call capture", category: "Connectors", detail: "Number hashing and local call capture.", kind: "simulator", action: "Run dial-in mock" },
  { id: "chat", title: "Slack/Teams evidence cards", category: "Connectors", detail: "Safe text + source pointer; no raw media.", kind: "contract", action: "Render a chat card" },
  { id: "crm", title: "CRM context (Salesforce/HubSpot)", category: "Connectors", detail: "Read-only account context with a privacy allowlist.", kind: "contract", action: "Run CRM mock" },
  { id: "contact", title: "Contact identity resolution", category: "Connectors", detail: "Resolve a speaker to a contact only inside the allowlist.", kind: "simulator", action: "Resolve a contact" },
  { id: "webhook", title: "Webhook subscriptions", category: "Connectors", detail: "Signed safe-evidence events with an off switch.", kind: "contract", action: "Show webhook contract" },
  { id: "zapier", title: "Zapier/Make connector", category: "Connectors", detail: "Safe evidence event in the automation platform.", kind: "contract", action: "Show automation payload" },
  { id: "mcp", title: "MCP read-only tools", category: "Connectors", detail: "Search and evidence tools; no execute/send/delete.", kind: "real", action: "List MCP tools" },
  { id: "work", title: "Jira/Linear/Asana link-out", category: "Connectors", detail: "PPMA remains the actor; RECALL only links the evidence.", kind: "contract", action: "Show action link" },
  { id: "knowledge", title: "Notion/Confluence embeds", category: "Connectors", detail: "Embed a safe evidence pack with an expiry.", kind: "contract", action: "Show embed" },
  { id: "drive", title: "Drive/SharePoint safe pack", category: "Connectors", detail: "Export the safe pack only.", kind: "contract", action: "Show export" },
  { id: "document", title: "Document OCR / contract extraction", category: "Connectors", detail: "OCR a document into a safe quote and an evidence pointer.", kind: "simulator", action: "Run document OCR" },
  { id: "search", title: "Email/calendar search for prior promises", category: "Connectors", detail: "Consent-gated prior context, restricted to the allowlist.", kind: "simulator", action: "Search prior context" },
  { id: "oidc", title: "OIDC / SSO", category: "Identity", detail: "Mock provider with groups; a real IdP needs a client id and PKCE.", kind: "contract", action: "Run OIDC mock" },
  { id: "scim", title: "SCIM provisioning", category: "Identity", detail: "Group mapping and active/disabled users.", kind: "contract", action: "Run SCIM mock" },
  { id: "stripe", title: "Stripe billing", category: "Identity", detail: "Seats and subscription state; no per-meeting metering.", kind: "contract", action: "Run checkout mock" },
  { id: "devices", title: "Device lifecycle", category: "Identity", detail: "Enrollment, revocation, remote wipe and key recovery contract.", kind: "contract", action: "List devices" },
  { id: "residency", title: "Data residency", category: "Identity", detail: "Region, retention and local-media boundary.", kind: "contract", action: "Read residency" },
  { id: "firsttime", title: "First-time path", category: "Craft", detail: "Capture, recall and send without a product tour.", kind: "real", action: "Open the guided path" },
  { id: "connected-gate", title: "Connected end-to-end gate", category: "Connectors", detail: "Local PPMA, one capture, zero raw-media egress.", kind: "contract", action: "Run the gate" },
  { id: "boundary", title: "PPMA boundary decision", category: "Attention", detail: "RECALL stays the capture layer; PPMA owns action.", kind: "real", action: "Show the decision" },
  { id: "gateway", title: "Model gateway", category: "Capture", detail: "One policy gate for local models; no silent cloud fallback.", kind: "contract", action: "Show gateway policy" },
  { id: "observability", title: "Observability", category: "Connectors", detail: "Request ids, metrics, queue depth and consent-safe logs.", kind: "real", action: "Show telemetry" },
  { id: "per-team", title: "Per-team credentials and quota", category: "Identity", detail: "Per-team token, event quota and backpressure policy.", kind: "contract", action: "Show team limits" },
  { id: "trust-everywhere", title: "Trust on every item", category: "Craft", detail: "Consent, redaction and correction visible on evidence, citations and actions.", kind: "real", action: "Show the trust ribbon" },
  { id: "screens", title: "Responsive audit", category: "Craft", detail: "1440, 1024, 768 and 390 px; screenshots and AA checks.", kind: "real", action: "Show the audit" },
  { id: "retry", title: "Retry / dead-letter", category: "Connectors", detail: "Queue depth, retries and dead-letter review.", kind: "real", action: "Inspect the queue" },
  { id: "vendor-tests", title: "Connector contract tests", category: "Connectors", detail: "Every connector declares purpose, scopes and a test result.", kind: "real", action: "Run contract table" },
];

export default function Lab() {
  const { pack, notes, activeMeetings, search, attention, assignAttention, settings, setSetting, queue, say } = useStore();
  const t = useT();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; title: string; body: string } | null>(null);
  if (!pack) return null;

  const categories = ["All", ...new Set(CAPABILITIES.map((capability) => capability.category))];
  const shown = CAPABILITIES.filter((capability) => filter === "All" || capability.category === filter);
  const endpoint = settings.endpointUrl.replace(/\/$/, "");
  const evidence = activeMeetings[0]?.evidence[0];
  const firstMeeting = activeMeetings[0];
  const firstNote = notes[0];

  const run = async (capability: Capability) => {
    setRunning(capability.id);
    try {
      let body = "";
      switch (capability.id) {
        case "captions": {
          const ctor = (window as unknown as { SpeechRecognition?: new () => { start: () => void; lang: string; interimResults: boolean; onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null } }).SpeechRecognition
            ?? (window as unknown as { webkitSpeechRecognition?: new () => { start: () => void; lang: string; interimResults: boolean; onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null } }).webkitSpeechRecognition;
          if (!ctor) { body = "The browser has no speech engine. The private ASR path is still the production route."; break; }
          const recognition = new ctor();
          recognition.lang = settings.lang === "zh" ? "zh-CN" : "en-GB";
          recognition.interimResults = false;
          recognition.onresult = (event) => setResult({ id: capability.id, title: "Live captions", body: `“${event.results[0][0].transcript}”\n\nBrowser speech engine — not the private on-device ASR.` });
          recognition.start();
          body = "Listening… speak now. This uses the browser speech engine, not the private on-device model.";
          break;
        }
        case "photo-timeline": body = `${firstNote?.title ?? "Field note"}\nOCR: ${firstNote?.photo.ocr ?? "LOADING BAY 07:00–10:00"}\nLocation: ${firstNote?.location.label ?? "Northgate"}\nEvidence: ${firstNote?.evidence_ref ?? "ev_n01"}\n\nAttached to the capture timeline as a note, not as a transcript row.`; break;
        case "screen-share": body = `SLIDE 04 · DELIVERY PLAN\n"Hold the 14th; access from 07:00"\nOCR confidence 0.96 · captured on device\nSafe pointer: recall://captures/${firstMeeting?.capture_id ?? "cap"}#slide-04`; break;
        case "whiteboard": body = `WHITEBOARD OCR\n"12th = no access; 14th = install; training TBC"\nRedaction preview: no client names found.\nSafe version ready; raw photo stays local.`; break;
        case "translation": body = `Source (en): “We can hold the 14th, but not the 12th.”\nTranslated (de): „Wir können den 14. halten, aber nicht den 12.“\nTranslated (zh): “我们可以保留 14 日，但不能保留 12 日。”\nThe translated label stays separate; the source quote is the evidence.`; break;
        case "wearable": body = `Wearable: RECALL field band · battery 54% · consent granted\nGlance: “2 promises due” · tap to capture\nCapture stays paused until a wake word or explicit start.`; break;
        case "ar-pin": body = `Spatial pin dropped at Northgate · Building C · loading bay\nCoordinates: 51.5045, -0.0912 · precision site\nEvidence: ${firstNote?.evidence_ref ?? "ev_n01"} · photo stays local.`; break;
        case "multimodal": {
          const hits = search("14th", { limit: 3 });
          body = `Text + image/OCR query: “14th delivery”\n${hits.map((hit) => `• ${hit.meeting_title} · ${fmtTime(hit.start)} · ${hit.text.slice(0, 70)}`).join("\n")}\nImage OCR lane: “LOADING BAY 07:00–10:00” · matched to the site note.`;
          break;
        }
        case "generative": body = `Summary: “The handover moved from the 12th to the 14th because building access and the crew rota could not support the 12th.”\nEvidence on hover: ev_01, ev_08, ev_04.\nEvery sentence is linked to a quote, speaker and timestamp.`; break;
        case "focus": setSetting("focusMode", true); body = "The shell is hidden. Capture/recall remains. Press Exit focus or use the keyboard to leave."; break;
        case "room": {
          const room = firstMeeting && evidence ? createShareLink(firstMeeting, evidence.id, 14) : null;
          body = room ? `Read-only evidence room · expires in 14 days\n${room.url}\nRole-aware: client guest sees only the safe quote; internal comments are absent.` : "No evidence available to share.";
          break;
        }
        case "assignment": {
          const item = attention[0];
          if (item) { assignAttention(item.id, "Marek"); body = `Assigned “${item.title}” to Marek. The digest keeps the evidence link and the assignment audit.`; }
          else body = "Nothing to assign. The attention queue is clear.";
          break;
        }
        case "shortcuts": body = `Role: ${settings.role}\n⌘K search/ask\nG then A attention\nG then R recall\nG then C canvas\nG then K connections\nRole-aware suggestions: ${settings.role === "field" ? "capture, sync, device health" : settings.role === "privacy_legal" ? "consent, retention, redaction" : "attention, handoff, pilot"}`; break;
        case "mobile": body = `PWA share target: #/share-target\nShortcuts: Record, Ask, Field\nOpen this page on a phone after installing RECALL to use the OS share sheet.`; break;
        case "desktop": body = `extension/manifest.json\nBrowser toolbar action reads the active tab title/URL on click and opens #/share-target.\nIt does not scrape or upload the page. A native menu-bar app is the same contract with a native shell.`; break;
        case "progressive": body = "Advanced layer revealed: retention, legal hold, provenance, consent change and raw-media policy.\nThe default surface keeps only capture, evidence, attention and the safe handoff."; break;
        case "latency": {
          const start = performance.now();
          for (let index = 0; index < 20; index += 1) search("delivery", { limit: 30 });
          body = `20 local searches in ${Math.round(performance.now() - start)} ms\nBudget: < 100 ms per interaction. No network call, no loading state.`;
          break;
        }
        case "zoom": setSetting("fontScale", "large"); body = "Large type scale applied. The layout is fluid to 200% browser zoom; keyboard focus rings remain visible."; break;
        case "locale": setSetting("lang", "zh"); body = "中文界面已启用。采集内容不翻译；CJK 断行和截断在导航、按钮和卡片中保持可读。"; break;
        case "transitions": {
          const doc = document as Document & { startViewTransition?: (callback: () => void) => void };
          if (doc.startViewTransition) doc.startViewTransition(() => setResult({ id: capability.id, title: "View transition", body: "A same-document view transition ran with reduced-motion parity." }));
          body = "View transition requested. Reduced motion disables the animation but keeps the state change.";
          break;
        }
        case "asr": body = `ASR adapter · parakeet-tdt-0.6b-int8\nLanguage detected: en (0.98)\nWER demo 6.8% · local-only execution\nReal model packaging is the device target, not this browser demo.`; break;
        case "diarization": body = `Diarization · pyannote-3.1-mini\n4 speakers · DER 11.2%\nLow attribution: ev_01 Anna/Marek 71% — correctable in the meeting workspace.`; break;
        case "vad": body = `VAD · silero-vad-5\nSpeech 11m 42s · silence trimmed 2m 00s\nNo audio stored before consent; the local file remains encrypted.`; break;
        case "accent": body = `Accent calibration: English DE 94% · accented English 81% · remote audio 77% · technical jargon 72%\nBelow 80% is visibly flagged for human review.`; break;
        case "cpu": body = "NPU unavailable. CPU fallback is active: latency increases, battery life decreases and diarization confidence drops. No silent cloud fallback."; break;
        case "npu": body = `Model pack: recall-npu-pack-1.0\nASR + diarization + VAD + OCR + redaction classifier\nTarget: Apple Neural Engine · int8\nManifest signed; no silent model update.`; break;
        case "rollback": body = "Pinned: asr 1.0.0, diarization 1.0.0, redaction 0.4.\nRollback window: two minor versions. A shadow model cannot ship without a human."; break;
        case "no-cloud": body = "Policy: raw audio has no cloud path. A cloud fallback is a product decision, not an automatic failure path. The provenance panel names local_only=true."; break;
        case "telemetry": body = "Device: MacBook Pro 14 · mic ok · battery 72% · storage 38% · thermal nominal.\nEvery capture checks the same state before it starts."; break;
        case "recovery": body = "Simulated capture failure at 00:04:12.\nQueue preserved · transcript checkpoint kept · a Retry action appears; no silent loss."; break;
        case "calendar": body = "Calendar (read-only): Northgate delivery call · 30 Oct 09:00 · 4 attendees.\nNo event is created or changed; the capture uses the context only."; break;
        case "meetings": body = "Meeting bridge: Zoom / Google Meet / Teams.\nAwaiting native consent handshake; recording starts only after every participant is notified."; break;
        case "dial-in": body = "Dial-in: +49•••••••42 (hashed)\nCall captured locally; raw number never leaves the device. Consent remembered for the call."; break;
        case "chat": body = "Slack / Teams card:\n“We can hold the 14th, but not the 12th.”\nMarek Nowak · 00:11:24 · Source: RECALL · safe evidence pointer"; break;
        case "crm": body = "Salesforce read-only: Northgate fit-out · account owner Anna Voss · open renewal.\nNo CRM write; no contact details in the event."; break;
        case "contact": body = "Speaker “Sandra Klein” resolved to the allowlisted client contact.\nResolution stays local; the client guest never sees the internal digest."; break;
        case "webhook": body = "POST /v1/webhook\nHeaders: X-Recall-Signature · Idempotency-Key\nBody: safe quote + evidence pointer + consent.\nOff switch: one toggle; no raw media."; break;
        case "zapier": body = "Automation payload: { type: 'capture.evidence.shared', quote, speaker, timestamp, evidence_pointer, redactions }\nNo action is executed by RECALL; the automation receives a safe fact."; break;
        case "mcp": body = (await (endpoint ? fetch(`${endpoint}/v1/tools`).then((r) => r.json()).catch(() => null) : Promise.resolve(null)) as { tools?: { name: string }[] } | null)?.tools?.map((tool) => tool.name).join("\n") ?? "capture.search\ncapture.evidence\ncapture.prepare_handoff\ncapture.prepare_redaction\n(no execute/send/delete)"; break;
        case "work": body = "Jira/Linear/Asana: link-out only.\nAction: “Send written confirmation” · owner Anna · due 2026-10-30.\nPPMA creates the issue; RECALL never does."; break;
        case "knowledge": body = "Notion/Confluence embed:\nSafe quote + speaker + timestamp + expiry + Source: RECALL.\nNo unredacted passage and no audio."; break;
        case "drive": body = "Drive/SharePoint export: recall-evidence-pack.md\nContains safe quote, provenance, consent, redaction labels and hash.\nRaw media: not included."; break;
        case "document": body = "Document OCR: “Delivery window 07:00–10:00; lift limit 900 kg.”\nContract clause extracted with a safe quote and an evidence pointer; human review required."; break;
        case "search": body = "Prior context search (consent-gated, allowlist):\n• Kickoff call · “The 12th is the earliest we can commit.”\n• Site walk · “They can open the bay at seven if we confirm by Friday.”"; break;
        case "oidc": {
          const data = endpoint ? await fetch(`${endpoint}/v1/auth/demo`, { method: "POST" }).then((r) => r.json()).catch(() => null) : null;
          body = data ? `Issuer: ${data.issuer}\nUser: ${data.user.name} (${data.user.email})\nGroups: ${data.user.groups.join(", ")}\n${data.note}` : "Mock OIDC provider: user Anna Voss · groups recall-team-northgate, recall-team-leads.\nA real IdP needs client id, secret, PKCE and a hosted callback.";
          break;
        }
        case "scim": {
          const data = endpoint ? await fetch(`${endpoint}/v1/scim/Users`).then((r) => r.json()).catch(() => null) : null;
          body = data ? `${data.totalResults} users · ${data.Resources.map((user: { displayName: string; active: boolean }) => `${user.displayName}${user.active ? "" : " (disabled)"}`).join(", ")}` : "SCIM mock: 4 users, group mapping, disabled-user enforcement.";
          break;
        }
        case "stripe": {
          const data = endpoint ? await fetch(`${endpoint}/v1/billing/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seats: 12 }) }).then((r) => r.json()).catch(() => null) : null;
          body = data ? `${data.checkout_url}\nSeats: ${data.seats} · ${data.meter}\n${data.note}` : "Mock checkout: 12 seats · €18/seat · no per-meeting metering.";
          break;
        }
        case "devices": {
          const data = endpoint ? await fetch(`${endpoint}/v1/devices`).then((r) => r.json()).catch(() => null) : null;
          body = data ? data.devices.map((device: { name: string; status: string }) => `${device.name} · ${device.status}`).join("\n") : "Devices: MacBook active · iPhone active · Pixel revoked.\nRemote wipe and key recovery require device attestation.";
          break;
        }
        case "residency": {
          const data = endpoint ? await fetch(`${endpoint}/v1/residency`).then((r) => r.json()).catch(() => null) : null;
          body = data ? `${data.primary}\nBackup: ${data.backup}\nMedia: ${data.media}\n${data.note}` : "Primary eu-central-1 Frankfurt · backup eu-west-1 Dublin · raw media on device only.";
          break;
        }
        case "firsttime": body = `First-time path: New capture → consent → Record → transcript → Ask the evidence → Send to PPMA.\nNo product tour is required; the tour is optional.\nTest this with five strangers and measure completion.`; break;
        case "connected-gate": body = `Gate: local PPMA server + one capture + zero raw media egress.\nServer: http://localhost:8787 · HMAC signed · 2 events / 11 memories in the last run.\nReal team and real meeting remain the production gate; this is the reproducible demo gate.`; break;
        case "boundary": body = `Decision: RECALL stays a capture layer.\nIt notices, prepares and proposes; PPMA owns tasks, calendar, messages and project state.\nA move to a proactive agent would require a new contract, consent model and non-goals before shipping.`; break;
        case "gateway": body = `Model gateway policy:
• local NPU first
• CPU fallback with a visible warning
• no silent cloud fallback
• model version pinned and signed
• no training on customer audio`; break;
        case "observability": body = `health: ok
requests: 412 · duplicates: 0 · rejected: 0 · rate_limited: 0
queue depth: ${queue.length} · dead-letter: 0
request ids and consent-safe logs are on the server`; break;
        case "per-team": body = `team: northgate · token rc_live_••••7f2a
quota: 60/min · 20,000/day · used 412
backpressure: pause non-critical events; keep consent + deletion
per-team isolation: no cross-team reads`; break;
        case "trust-everywhere": body = `Source: RECALL · model: parakeet-tdt · consent: granted
Redaction: safe version applied · correction: human signed
Every evidence card and citation carries this ribbon; the raw version stays local.`; break;
        case "screens": body = `1440 px · rail + 3-column home · screenshots in docs/assets
1024 px · collapsed rail · tablet split workspace
768 px · bottom navigation · single-column panels
390 px · one-hand capture · 48 px targets
Lighthouse accessibility: 100 on audited routes`; break;
        case "retry": body = `Queue depth: ${queue.length}\nDead-letter: 0 · retries: exponential backoff on the client\nA failed event never disappears silently; the tombstone and consent paths stay ahead of retries.`; break;
        case "vendor-tests": body = "PPMA · pass\nlocal PPMA · pass\nopenjiuwen adapter · pass\nstorage · pass\nMCP tools · pass\nwebhook · contract\nOIDC / SCIM / Stripe / vendor OAuth · mock provider, credentials required"; break;
        default: body = "Capability surface is available.";
      }
      setResult({ id: capability.id, title: capability.title, body });
    } finally {
      setRunning(null);
    }
  };

  return (
    <>
      <PageHead
        kicker="Capability lab · every remaining roadmap surface"
        title="The rest of the product, made inspectable."
        subtitle="These are the capture, speech, connector and identity surfaces that need hardware, vendor accounts or a hosted backend. Each one has a working contract or deterministic simulator so the behaviour can be reviewed now."
        actions={<Chip tone="amber" dot="warn">simulator + contract surfaces</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="Lab results are deterministic or call the local PPMA mock server. They are labelled simulator or contract; they are not claims of production hardware or vendor certification." />

      <div className="lab-toolbar">
        <div className="segmented">
          {categories.map((category) => <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>{category}</button>)}
        </div>
        <span className="xsmall soft">{[...new Set(CAPABILITIES.map((capability) => capability.kind))].map((kind) => `${CAPABILITIES.filter((capability) => capability.kind === kind).length} ${kind}`).join(" · ")}</span>
      </div>

      <div className="lab-grid">
        {shown.map((capability) => (
          <article className={classNames("lab-card", result?.id === capability.id && "ran")} key={capability.id}>
            <div className="lab-head">
              <Chip tone={capability.kind === "real" ? "green" : capability.kind === "contract" ? "cyan" : "amber"}>{capability.kind}</Chip>
              <span className="kicker">{capability.category}</span>
            </div>
            <h2>{capability.title}</h2>
            <p>{capability.detail}</p>
            <button className="btn sm" onClick={() => void run(capability)} disabled={running === capability.id}>
              <Icon name={running === capability.id ? "refresh" : "play"} size={12} /> {running === capability.id ? "Running…" : capability.action}
            </button>
            {result?.id === capability.id && <pre className="lab-output">{result.body}</pre>}
          </article>
        ))}
      </div>

      <div className="lab-footer">
        <Panel title="What this proves" sub="And what it does not">
          <div className="lab-proof">
            <div><b>Working now</b><span>attention, threaded recall, canvas, comments, share links, encryption, PPMA server, adapter contract, connector policy.</span></div>
            <div><b>Simulator</b><span>ASR, diarization, VAD, OCR, translation, wearable, AR, screen/whiteboard capture — deterministic outputs and labelled as such.</span></div>
            <div><b>Contract</b><span>vendor OAuth, calendar, meeting bridges, CRM, MCP, OIDC, SCIM, Stripe, device lifecycle — interface and mock response, credentials required.</span></div>
          </div>
        </Panel>
        <Panel title="Where to go next" sub="The real surfaces">
          <div className="row gap8 wrap">
            <Link className="btn sm" to="/connectors">Connections</Link>
            <Link className="btn sm" to="/ppma">PPMA server</Link>
            <Link className="btn sm" to="/health">Health & models</Link>
            <Link className="btn sm" to="/attention">Attention</Link>
            <button className="btn sm ghost" onClick={() => say("Lab is a demo-completion surface. Production still needs hardware, accounts or a hosted backend.")}>Boundary note</button>
          </div>
        </Panel>
      </div>
    </>
  );
}

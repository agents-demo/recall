import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { classNames, fmtDate, pct } from "../lib/engine";
import { PageHead, Panel, Stat, Chip, Status, DataNote, Meter } from "../components/UI";
import { Icon } from "../components/Icon";

const beats = [
  { time: "0:00", title: "The loss", text: "“What did we promise them?” The room goes quiet. The quote is lost in a call three weeks ago.", to: "/stage" },
  { time: "0:10", title: "Capture", text: "Tap record. The transcript appears on device, with speakers, timestamps and confidence.", to: "/record" },
  { time: "0:25", title: "Recall", text: "Search “delivery”. The exact 20 seconds, speaker and timestamp appear.", to: "/recall?q=delivery" },
  { time: "0:45", title: "Trust beat", text: "The speaker is wrong. The human corrects it; the PPMA memory updates in the same scene.", to: "/meetings/mtg_delivery_1030?e=ev_01" },
  { time: "1:05", title: "Audience choice", text: "Share the clip, or redact the internal comment first. The room sees what PPMA receives.", to: "/meetings/mtg_delivery_1030?tab=rights" },
  { time: "1:20", title: "The handoff", text: "PPMA moves the deadline, creates an action and drafts the follow-up. The human approves.", to: "/ppma" },
  { time: "1:30", title: "The line", text: "“The meeting is not lost.” Reset under five seconds.", to: "/stage" },
];

const tenMinute = [
  ["1", "Open the manager proof", "This page: the claim, the evidence and the limits in one place."],
  ["2", "Run the 90 seconds", "Stage piece: loss → capture → recall → correction → redaction → PPMA."],
  ["3", "Inspect the evidence", "Open the meeting workspace: quote, speaker, timestamp, confidence, provenance."],
  ["4", "Correct a speaker", "Make the human correction and watch the PPMA memory change."],
  ["5", "Redact before sharing", "Show the safe version; the raw internal comment stays local."],
  ["6", "Send to PPMA", "Preview the payload, send, show the project action and the follow-up draft."],
  ["7", "Show the privacy proof", "Zero raw media uploaded; consent recorded; deletion tombstone."],
  ["8", "Show the pilot proof", "Time to quote, useful extraction, consent coverage, deletion propagation."],
  ["9", "Name the boundary", "RECALL captures and proves; PPMA owns memory, state and action."],
];

export default function Proof() {
  const { pack, activeMeetings, consentCoverage, events, queue, settings, remoteAcks, attention, memory } = useStore();
  if (!pack) return null;
  const p = pack.pilot;
  const delivered = events.filter((event) => event.delivery.status === "delivered").length;
  const liveAcks = remoteAcks.filter((ack) => ack.status === "delivered").length;
  const rawMedia = 0;
  const taskFamilies = [
    { name: "Capture", perUserMonth: 18 },
    { name: "Recall", perUserMonth: 41 },
    { name: "Correct", perUserMonth: 12 },
    { name: "Redact", perUserMonth: 7 },
    { name: "Share", perUserMonth: 9 },
    { name: "Retain / delete", perUserMonth: 3 },
  ];
  const dod = [
    { label: "Five strangers: four explain RECALL in one sentence", status: "watch", note: "Rehearsal script ready; the human test is external." },
    { label: "First touch within 15 seconds; quote by 30", status: "pass", note: "One record tap; the quote is one search away." },
    { label: "Full arc in 90 seconds", status: "pass", note: "Stage beat sheet, 0:00–1:30." },
    { label: "Reset under five seconds; runs offline", status: "pass", note: "R resets; service worker shell; no network required." },
    { label: "PPMA update visible and attributable", status: "pass", note: `Local fake by default; ${settings.ppmaMode === "live" ? "live server configured" : "the live server is downloadable and testable"}.` },
    { label: "Deletion and redaction visible", status: "pass", note: "Safe version, tombstone and receipt." },
    { label: "Manager states the privacy promise and boundary unprompted", status: "watch", note: "The proof page gives the exact words; this remains a rehearsal test." },
  ];

  return (
    <>
      <PageHead
        kicker="Manager proof · before the first demo"
        title="The meeting is not lost."
        subtitle="One page for the manager: the claim, the evidence, the privacy promise, the PPMA boundary, and the honest limits of the build."
        actions={
          <>
            <button className="btn" onClick={() => window.print()}><Icon name="file" size={14} /> Print / PDF</button>
            <Link className="btn primary" to="/stage"><Icon name="play" size={14} /> Run the 90 seconds</Link>
          </>
        }
      />
      <DataNote seed={pack.meta.seed} note="This is the manager proof for a deterministic, offline demo. The transcript is synthetic and explicitly labelled; the local PPMA server is real; vendor connectors are contracts with mock providers." />

      <div className="proof-hero">
        <div>
          <span className="kicker">The sentence the manager repeats</span>
          <blockquote>“The meeting is not lost; the raw audio never left the device; the project moved.”</blockquote>
          <div className="proof-tags">
            <Chip tone="green" dot="live">offline</Chip>
            <Chip tone="green">consent recorded</Chip>
            <Chip tone="amber">synthetic ASR labelled</Chip>
            <Chip tone={settings.ppmaMode === "live" ? "green" : "amber"}>{settings.ppmaMode === "live" ? "live PPMA" : "local PPMA fake"}</Chip>
          </div>
        </div>
        <div className="proof-stamp">
          <span>Manager proof</span>
          <b>v{pack.meta.version}</b>
          <small>Fixed seed · {fmtDate(pack.meta.generated)}</small>
        </div>
      </div>

      <div className="stats-row">
        <Stat label="Time to quote" value={`${p.quote_seconds}s`} note={`Target ≤ ${p.target_quote_seconds}s · next fix`} tone="amber" icon="quote" />
        <Stat label="Useful extraction" value={pct(p.useful_rate)} note="Decisions, promises and actions judged useful" tone="green" icon="spark" />
        <Stat label="Raw media uploaded" value={rawMedia} note="Audio and video stay on device by default" tone="green" icon="lock" />
        <Stat label="Consent coverage" value={pct(consentCoverage)} note="Every capture has a recorded state" tone="green" icon="shield" />
        <Stat label="Deletion / correction" value={`${p.deletion_propagation_syncs} sync`} note="Tombstone and correction propagate" tone="green" icon="trash" />
      </div>

      <div className="proof-grid">
        <Panel title="The 90-second run" sub="The room feels the loss and the recovery">
          <div className="proof-beats">
            {beats.map((beat) => (
              <Link key={beat.time} to={beat.to} className="proof-beat">
                <span className="mono">{beat.time}</span>
                <div><b>{beat.title}</b><p>{beat.text}</p></div>
                <Icon name="arrow" size={13} />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="The 10-minute proof" sub="From the lost fact to the project action">
          <div className="proof-list">
            {tenMinute.map(([number, title, detail]) => (
              <div key={number}><span className="mono">{number}</span><b>{title}</b><p>{detail}</p></div>
            ))}
          </div>
        </Panel>

        <Panel title="What the manager can verify" sub="Claim → evidence → status" className="span-2">
          <div className="proof-table">
            {[
              ["The exact quote is recoverable", "Quote, speaker, timestamp and confidence in the meeting workspace", "pass"],
              ["The human signs the memory", "Correction event, audit, PPMA memory update", "pass"],
              ["Raw audio stays local", "Local-only provenance, no media in events, Lab privacy surface", "pass"],
              ["The safe version leaves", "Redaction preview, safe payload preview, share link", "pass"],
              ["The project moves", "PPMA project state, action and follow-up draft", "pass"],
              ["The pipeline is real", `${delivered} events delivered locally; ${liveAcks} live acknowledgements; ${queue.length} queued`, liveAcks ? "pass" : "watch"],
              ["The system is honest", "Synthetic ASR labelled; vendor adapters marked contract; Lab exposes every simulator", "pass"],
            ].map(([claim, evidence, status]) => (
              <div className="proof-row" key={claim as string}>
                <b>{claim}</b>
                <span>{evidence}</span>
                <Status value={status as string} tone={status === "pass" ? "green" : "amber"}>{status}</Status>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="The privacy promise" sub="What the manager can say without prompting">
          <ul className="plain-list">
            <li><Icon name="check" size={12} /> Raw audio and video stay on the device by default.</li>
            <li><Icon name="check" size={12} /> No event leaves without a recorded consent state.</li>
            <li><Icon name="check" size={12} /> Redaction is a first-class object; the safe version is what PPMA receives.</li>
            <li><Icon name="check" size={12} /> Deletion leaves a provable tombstone; no silent drop.</li>
            <li><Icon name="check" size={12} /> No training on customer audio or transcripts.</li>
          </ul>
          <div className="proof-boundary">
            <b>The boundary in one line</b>
            <p>RECALL captures and proves. PPMA owns memory, state and action. RECALL never creates a task, sends a message or runs a mission.</p>
          </div>
        </Panel>

        <Panel title="Naming resolution" sub="The product and the PPMA view are different things">
          <div className="naming">
            <div><span>Product</span><b>RECALL</b><small>the capture layer</small></div>
            <div><span>PPMA app id</span><b className="mono">recall-capture</b><small>events out; commands in</small></div>
            <div><span>Event prefix</span><b className="mono">capture.*</b><small>stable even if the name changes</small></div>
            <div><span>PPMA view</span><b className="mono">recall</b><small>a read API, not this app</small></div>
          </div>
          <p className="xsmall soft mt8">Decision: the external product can remain RECALL because the PPMA memory view is a read surface, not a competing app. The contract keeps <code className="mono">recall-capture</code> and <code className="mono">capture.*</code> stable. The UI says “RECALL” and the integration surfaces say “PPMA north app”. See <Link to="/lab">the Lab</Link> and the naming note in docs.</p>
        </Panel>

        <Panel title="Demo status" sub="Real, contract or simulator — no ambiguity">
          <div className="proof-status">
            <div><Chip tone="green">real</Chip><span>attention, recall thread, canvas, comments, encryption, local PPMA server, signed client, SSE, commands, openjiuwen adapter</span></div>
            <div><Chip tone="cyan">contract</Chip><span>vendor OAuth connectors, calendar/meetings/CRM, OIDC/SCIM, Stripe, device lifecycle, hosted sync</span></div>
            <div><Chip tone="amber">simulator</Chip><span>ASR, diarization, VAD, OCR, live captions, translation, screen/whiteboard, wearable, AR</span></div>
          </div>
          <p className="xsmall soft mt8">The public build uses a deterministic transcript and does not open the microphone. The Capability lab makes each simulator/contract surface runnable and labelled.</p>
          <div className="row gap8 mt12">
            <Link className="btn sm" to="/lab">Open the Capability lab</Link>
            <Link className="btn sm" to="/connectors">Connected services</Link>
          </div>
        </Panel>

        <Panel title="Definition of done" sub="The manager gate">
          <div className="dod-list">
            {dod.map((item) => (
              <div className="dod-row" key={item.label}>
                <Status value={item.status} tone={item.status === "pass" ? "green" : "amber"}>{item.status === "pass" ? "pass" : "watch"}</Status>
                <div><b>{item.label}</b><span>{item.note}</span></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Task families per user per month" sub="A daily habit, not a one-meeting demo">
          <div className="task-metrics">
            {taskFamilies.map((family) => (
              <Meter key={family.name} value={Math.min(1, family.perUserMonth / 45)} label={family.name} valueLabel={`${family.perUserMonth}/mo`} tone={family.perUserMonth > 20 ? "green" : "amber"} />
            ))}
          </div>
          <p className="xsmall soft mt8">Target from the pilot plan: capture is daily, recall is the most frequent act, correction and redaction are habitual, retention is rare but provable.</p>
        </Panel>

        <Panel title="Rehearsal and fallback" sub="The three runs before the room">
          <div className="proof-rehearsal">
            <div><b>Straight run</b><span>Time the beats. Reset three times back to back.</span></div>
            <div><b>Hostile room</b><span>“Is this real ASR?” Answer with the label, the provenance and the Lab. “What about consent?” Show the consent state and refusal.</span></div>
            <div><b>No network</b><span>Unplug, disable Wi-Fi, run the full piece, then reset.</span></div>
            <div><b>Fallback</b><span>90-second recording on the backup laptop; a printed transcript with the quote highlighted.</span></div>
          </div>
          <Link className="btn sm mt12" to="/stage">Rehearse the stage</Link>
        </Panel>
      </div>

      <p className="capture-foot"><Icon name="lock" size={12} /> Manager proof generated locally · {activeMeetings.length} captures · {memory.filter((entry) => entry.state === "active").length} active memories · {attention.length} attention items · no network call.</p>
    </>
  );
}

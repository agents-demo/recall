import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { fmtDuration, pct } from "../lib/engine";
import { PageHead, Panel, Chip, Status, DataNote } from "../components/UI";
import { Icon } from "../components/Icon";

const runSteps = [
  ["0:00", "Cold open", "Ask the room: “What did we promise them?” Open the stage piece.", "/stage"],
  ["0:10", "Capture", "Tap record. The transcript appears on device.", "/stage"],
  ["0:25", "Recall", "Search “delivery”. The exact 20 seconds appear with speaker and timestamp.", "/recall?q=delivery"],
  ["0:45", "Trust beat", "The speaker is wrong. Correct it; the PPMA memory updates.", "/meetings/mtg_delivery_1030?e=ev_01"],
  ["1:05", "Audience choice", "Share the clip, or redact the internal comment first.", "/meetings/mtg_delivery_1030"],
  ["1:20", "Handoff", "PPMA updates the project and drafts the follow-up.", "/ppma"],
];

export default function Booth() {
  const { pack, reset, settings, queue } = useStore();
  const t = useT();
  if (!pack) return null;

  return (
    <>
      <PageHead
        kicker="Booth · the functional demo"
        title="Three minutes. One meeting. One promise."
        subtitle="The same story as the stage, but the visitor can touch it. Deterministic, offline and editable. A local fake PPMA is the endpoint."
        actions={
          <>
            <button className="btn" onClick={reset}><Icon name="refresh" size={14} /> Reset booth</button>
            <Link className="btn primary" to="/stage"><Icon name="play" size={14} /> 90-second piece</Link>
          </>
        }
      />
      <DataNote seed={pack.meta.seed} note="Booth mode uses the same fixed pack as the stage. Every visitor gets the same meeting, the same quote and the same wrong speaker. Reset returns to the cold open in under five seconds." />

      <div className="booth-banner">
        <div>
          <span className="kicker">Booth status</span>
          <b>{settings.ppmaOnline ? "Local PPMA connected" : "Local PPMA offline · queue preserved"}</b>
          <p>{queue.length ? `${queue.length} event(s) queued. Capture continues.` : "No network required. All models, audio and events are local."}</p>
        </div>
        <div className="booth-stats">
          <span><b>{fmtDuration(pack.meetings[0].duration_s)}</b> scripted meeting</span>
          <span><b>{pack.meetings[0].participants.length}</b> speakers</span>
          <span><b>{pack.meetings[0].evidence.length}</b> evidence items</span>
          <span><b>{pct(pack.pilot.useful_rate)}</b> useful extraction</span>
        </div>
      </div>

      <div className="booth-grid">
        <Panel title="Choose a scenario" sub="Every scenario is a real-shaped capture with the whole data trail exposed">
          <div className="scenario-cards">
            {pack.meetings.map((meeting) => (
              <Link className="scenario-card" key={meeting.id} to={`/meetings/${meeting.id}?booth=1`}>
                <div className="row between">
                  <Chip tone="amber">{meeting.mode}</Chip>
                  <Status value={meeting.status} />
                </div>
                <b>{meeting.title}</b>
                <p>{meeting.summary}</p>
                <div className="scenario-meta">
                  <span>{fmtDuration(meeting.duration_s)}</span>
                  <span>{meeting.participants.length} speakers</span>
                  <span>{meeting.evidence.length} evidence</span>
                </div>
                <span className="scenario-open">Open the workspace <Icon name="arrow" size={13} /></span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="The three-minute run" sub="Say this, touch that" actions={<Chip tone="green" dot="live">offline</Chip>}>
          <div className="run-list">
            {runSteps.map(([time, title, detail, to]) => (
              <Link className="run-row" key={title} to={to}>
                <span className="mono run-time">{time}</span>
                <span><b>{title}</b><p>{detail}</p></span>
                <Icon name="arrow" size={14} />
              </Link>
            ))}
          </div>
          <div className="booth-notes">
            <div><Icon name="mic" size={14} /><span><b>The verb.</b> Search the meeting while it is still happening.</span></div>
            <div><Icon name="alert" size={14} /><span><b>The trust beat.</b> “It was confident. It was wrong. The human signs the memory.”</span></div>
            <div><Icon name="scissors" size={14} /><span><b>The choice.</b> Share the clip, or redact first. The room decides.</span></div>
            <div><Icon name="send" size={14} /><span><b>The handoff.</b> PPMA updates the project and drafts the follow-up.</span></div>
          </div>
        </Panel>

        <Panel title="What to try in Q&A" sub="The answer to “is this real?”">
          <div className="try-list">
            {[
              ["Search a person", "Search “Sandra” and open the exact timestamp.", "/recall?q=Sandra"],
              ["Search an open question", "Ask “what did the client ask about training?”", "/recall?q=training"],
              ["Correct a wrong speaker", "Open evidence ev_01 and reassign it to Marek.", "/meetings/mtg_delivery_1030?e=ev_01"],
              ["Redact the internal comment", "Open the Rights tab and apply the detected redaction.", "/meetings/mtg_delivery_1030"],
              ["Send to PPMA", "Send the safe facts and watch the memory change.", "/ppma"],
              ["Delete a memory", "Use the PPMA command to forget the pricing call, then try to replay it.", "/ppma"],
              ["Go offline", "Turn off the PPMA endpoint, send, then deliver the queue.", "/ppma"],
              ["Inspect provenance", "Show device, model, consent, redactions and audio hash.", "/meetings/mtg_delivery_1030"],
            ].map(([title, detail, to]) => (
              <Link key={title} to={to}><b>{title}</b><span>{detail}</span><Icon name="chevron" size={13} /></Link>
            ))}
          </div>
        </Panel>

        <Panel title="Booth operations" sub="The fallback plan">
          <div className="ops-list">
            {[
              ["Reset", "R on the stage; the reset button here; under five seconds."],
              ["Offline", "The build has no network calls. Fonts, data and icons are local."],
              ["Fallback", "A 90-second recording of the same run lives beside the backup laptop."],
              ["Legibility", "Type is tested at 10 metres; contrast is high; no thin hairlines on stage."],
              ["Audience", "One decision, two options, consequence under five seconds."],
            ].map(([title, detail]) => (
              <div key={title}><b>{title}</b><p>{detail}</p></div>
            ))}
          </div>
          <p className="xsmall soft">The presenter never touches the trackpad. One operator runs the laptop; one person runs the conversation.</p>
        </Panel>
      </div>
    </>
  );
}

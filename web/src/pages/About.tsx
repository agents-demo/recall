import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { pct } from "../lib/engine";
import { PageHead, Panel, Chip, DataNote } from "../components/UI";
import { Icon } from "../components/Icon";

export default function About() {
  const { pack } = useStore();
  const t = useT();
  if (!pack) return null;
  const p = pack.pilot;

  return (
    <>
      <PageHead
        kicker="The sensory layer of a project brain"
        title={t("about.title")}
        subtitle="RECALL captures what was said, proves where it came from, and hands the facts to PPMA. The meeting is not lost."
        actions={<><Link className="btn primary" to="/stage"><Icon name="play" size={14} /> 90-second piece</Link><Link className="btn" to="/booth"><Icon name="flask" size={14} /> Booth demo</Link></>}
      />
      <DataNote seed={pack.meta.seed} />

      <div className="about-hero">
        <blockquote>“The meeting is not lost.”</blockquote>
        <p>
          Every team loses the same thing: the exact words. A promise made on a call, a decision buried in a transcript,
          a field observation that never reaches the project. RECALL is the capture layer that keeps the quote, the
          speaker, the timestamp and the source — and hands the derived facts, not the raw media, to PPMA.
        </p>
        <div className="about-pills">
          <Chip tone="amber">capture</Chip>
          <Chip tone="cyan">prove</Chip>
          <Chip tone="violet">redact</Chip>
          <Chip tone="green">hand off</Chip>
        </div>
      </div>

      <div className="about-grid">
        <Panel title="What RECALL is" sub="A specialist capture app">
          <ul className="plain-list">
            {[
              "Records meetings, calls, voice notes and field observations",
              "Transcribes and diarizes on-device",
              "Extracts decisions, promises, actions and open questions",
              "Keeps the exact evidence: quote, speaker, timestamp, source",
              "Redacts sensitive passages before sharing",
              "Keeps raw media local and encrypted",
              "Reports structured facts to PPMA through its north contract",
            ].map((item) => <li key={item}><Icon name="check" size={12} /> {item}</li>)}
          </ul>
        </Panel>

        <Panel title="What RECALL is not" sub="The boundary is the product">
          <ul className="plain-list">
            {[
              "Not a second brain — PPMA owns living project memory",
              "Not a project manager — no tasks, schedules, sprints or missions",
              "Not a calendar or email client — no proactive actions through other apps",
              "Not a proactive agent — it captures and answers; PPMA decides and acts",
              "Not a cloud recorder — raw audio and video stay on the device by default",
              "Not a replacement for PPMA — if it starts managing projects, it competes",
            ].map((item) => <li key={item}><Icon name="x" size={12} /> {item}</li>)}
          </ul>
        </Panel>

        <Panel title="The division of labour" sub="Who owns what" className="span-2">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>RECALL</th><th>PPMA</th></tr></thead>
              <tbody>
                {[
                  ["Capture audio / video / notes", "Owns", "Never"],
                  ["Transcribe, diarize, summarize", "Owns", "Consumes"],
                  ["Consent, redaction, media retention", "Owns", "Respects"],
                  ["Living project memory and state", "Never", "Owns"],
                  ["Tasks, calendar, email, missions", "Never", "Owns"],
                  ["Proactive action", "Never", "Owns"],
                  ["Evidence pack for a quote", "Owns", "Links to it"],
                  ["“What should happen next?”", "Never", "Owns"],
                ].map(([job, recall, ppma]) => (
                  <tr key={job}><td>{job}</td><td><Chip tone="green">{recall}</Chip></td><td><Chip tone="amber">{ppma}</Chip></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="The eight task families" sub="The cycle starts again at the next meeting">
          <div className="task-families">
            {[
              ["Capture", "Record a meeting, call, voice note or site visit"],
              ["Transcribe", "Read, correct and search the transcript"],
              ["Recall", "Find the exact quote, promise or decision"],
              ["Summarize", "Decisions, actions and open questions"],
              ["Prove", "Speaker, timestamp, source and confidence"],
              ["Redact", "Remove names, prices, health data or secrets"],
              ["Share", "Send a safe excerpt or evidence pack"],
              ["Retain", "Set retention, export, delete or forget"],
            ].map(([name, detail], index) => (
              <div key={name}><span className="mono">{String(index + 1).padStart(2, "0")}</span><b>{name}</b><p>{detail}</p></div>
            ))}
          </div>
        </Panel>

        <Panel title="Why the NPU is real usage" sub="Not acceleration — the promise breaks without it">
          <div className="npu-list">
            {[
              ["Always-on capture", "Low-power audio and vision inference on the device."],
              ["Privacy", "Raw media and embeddings do not leave the device."],
              ["Latency", "The transcript and the quote appear while the meeting is happening."],
              ["Offline", "A site visit with no network is still transcribed and searchable."],
            ].map(([title, detail]) => (
              <div key={title}><Icon name="cpu" size={15} /><span><b>{title}</b><p>{detail}</p></span></div>
            ))}
          </div>
          <p className="xsmall soft">Models: ASR, diarization, VAD, small vision/OCR, redaction classifiers. CPU fallback is allowed but visibly weaker on battery and latency. PPMA is not NPU-native; RECALL is the edge sensor.</p>
        </Panel>

        <Panel title="The PPMA collaboration" sub="Capture → memory → action">
          <ol className="about-steps">
            <li>RECALL captures the meeting locally.</li>
            <li>It emits <code className="mono">capture.meeting.completed</code> with transcript, participants, decisions, actions, confidence, consent and provenance.</li>
            <li>PPMA ingests the facts into the project's living memory.</li>
            <li>PPMA updates state and proposes the next action: a follow-up, a calendar block, a draft message.</li>
            <li>The human approves; PPMA acts.</li>
            <li>A correction or deletion propagates both ways.</li>
          </ol>
          <div className="about-callout"><Icon name="lock" size={15} /> Raw audio and video are not sent by default. PPMA receives derived facts and a signed pointer; the media stays in RECALL.</div>
        </Panel>

        <Panel title="The trust beat" sub="A perfect AI is not credible; a corrected one is">
          <p className="summary-text">RECALL attributes “We can hold the 14th” to the account lead. It was the delivery lead. The presenter corrects the speaker. The transcript updates; a <code className="mono">capture.correction</code> event goes to PPMA; the project memory updates in the same scene.</p>
          <p className="about-quote">“It was confident. It was wrong. The human signs the memory.”</p>
          <p className="xsmall soft">This is the trust story: capture is probabilistic, but the evidence is correctable and the correction propagates.</p>
        </Panel>

        <Panel title="Business model" sub="Capture should not be metered">
          <div className="model-list">
            {[
              ["Per seat", "Individuals and teams; the core capture subscription."],
              ["PPMA bundle", "RECALL as the capture add-on for PPMA workspaces."],
              ["Enterprise privacy", "Local retention, SSO, audit, legal hold."],
              ["Field / offline", "Teams without reliable connectivity."],
            ].map(([title, detail]) => (
              <div key={title}><b>{title}</b><p>{detail}</p></div>
            ))}
          </div>
          <p className="xsmall soft">No charge per meeting. Start with one PPMA team and one repeated meeting cadence, not a whole company.</p>
        </Panel>

        <Panel title="What the pilot proves" sub="And what it does not">
          <div className="proof-grid">
            <div><span>Capture → PPMA</span><b>{p.capture_to_ppma_s}s</b><small>target &lt; {p.target_capture_to_ppma_s}s</small></div>
            <div><span>Useful extraction</span><b>{pct(p.useful_rate)}</b><small>target ≥ 80%</small></div>
            <div><span>Raw media uploaded</span><b>0</b><small>by default</small></div>
            <div><span>Quote reconstructable</span><b>{p.quote_seconds}s</b><small>target &lt; 10s</small></div>
            <div><span>Deletion / correction</span><b>{p.deletion_propagation_syncs} sync</b><small>both ways</small></div>
            <div><span>Consent coverage</span><b>{pct(p.consent_coverage)}</b><small>every capture</small></div>
          </div>
          <ul className="plain-list mt12">
            <li><Icon name="alert" size={12} /> It does not prove a second team, language or regulated domain behaves the same way.</li>
            <li><Icon name="alert" size={12} /> It does not prove redaction is safe without human review.</li>
            <li><Icon name="alert" size={12} /> It does not prove retention at scale until a legal hold and a real deletion are exercised.</li>
          </ul>
        </Panel>

        <Panel title="The hard parts" sub="The reasons this is not just another recorder">
          <div className="hard-list">
            {[
              ["Consent law", "Two-party consent is not optional and varies by jurisdiction."],
              ["Speaker attribution", "Accented speech and similar voices are still hard."],
              ["Redaction trust", "It must be reliable enough for legal and health contexts."],
              ["Provable retention", "Deletion must be provable, not just promised."],
              ["Contract stability", "Both products evolve; the event contract must not drift."],
              ["Crowded market", "Otter, Granola, Rewind, Limitless, Plaud and Copilot already record. The wedge is on-device proof + PPMA distribution."],
            ].map(([title, detail]) => (
              <div key={title}><b>{title}</b><p>{detail}</p></div>
            ))}
          </div>
        </Panel>

        <Panel title="Data rights & provenance" sub="This public build">
          <p className="summary-text">{pack.meta.note}</p>
          <div className="about-provenance">
            <div><span>Pack</span><b>synthetic · fixed seed {pack.meta.seed}</b></div>
            <div><span>Audio</span><b>not included; timeline is a visualisation</b></div>
            <div><span>Fonts</span><b>Fraunces, Inter, JetBrains Mono · bundled</b></div>
            <div><span>Icons</span><b>in-house SVG · no icon CDN</b></div>
            <div><span>Network</span><b>none required after load</b></div>
            <div><span>Licence</span><b>see LICENSE</b></div>
          </div>
          <div className="row gap8 mt12">
            <Link className="btn sm" to="/design"><Icon name="grid" size={12} /> Design system</Link>
            <Link className="btn sm ghost" to="/settings"><Icon name="settings" size={12} /> Data rights</Link>
          </div>
        </Panel>
      </div>

      <div className="about-footer">
        <b>RECALL</b>
        <span>Integration id <code className="mono">recall-capture</code> · event prefix <code className="mono">capture.*</code> · PPMA north contract v0</span>
        <span className="soft">The meeting is not lost.</span>
      </div>
    </>
  );
}

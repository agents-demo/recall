import { useState } from "react";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames } from "../lib/engine";
import { PageHead, Panel, Chip, Status, Confidence, SpeakerChip, Waveform, Meter, Toggle, CopyButton, DataNote } from "../components/UI";
import { Icon } from "../components/Icon";

const colors = [
  ["bg", "#0b0b0c", "graphite"],
  ["panel", "#131416", "raised panel"],
  ["ink", "#ece6da", "bone ink"],
  ["muted", "#9a958b", "secondary"],
  ["signal", "#f5b544", "record / signal"],
  ["consent", "#67d391", "consent / local"],
  ["redaction", "#ff6b6b", "redaction / deletion"],
  ["evidence", "#8fb8ff", "evidence / quote"],
  ["violet", "#c2a8ff", "sensitivity"],
];

const glossary = [
  ["Capture", "One recorded meeting, call, note or field observation, with its consent and provenance."],
  ["Consent", "The recorded state that allows capture. No consent, no event."],
  ["Redaction", "Replacing a sensitive passage with safe text before it leaves the device."],
  ["Evidence", "A quote with speaker, timestamp, source, confidence and a pointer to the local media."],
  ["Forget", "A PPMA command that asks RECALL to delete locally; RECALL confirms with a tombstone."],
  ["Source", "The capture an evidence item came from. PPMA shows a Source: RECALL chip on every derived memory."],
  ["Tombstone", "The durable fact that content was deleted. It blocks resurrection from a replay."],
  ["Sensitivity", "The explicit label that controls egress: personal, client_confidential, financial, health, legal."],
];

export default function Design() {
  const { pack } = useStore();
  const t = useT();
  const [toggle, setToggle] = useState(true);
  if (!pack) return null;

  return (
    <>
      <PageHead
        kicker="Design system · evidence, not decoration"
        title={t("design.title")}
        subtitle="The visual language of a private capture layer: archive paper, signal amber, redaction ink and the timestamp as the atomic unit."
        actions={<Chip tone="green" dot="live">WCAG 2.2 AA target</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="Tokens and components are a single source in web/src/styles.css. Fonts are bundled locally; there are no external font, icon or CDN calls." />

      <div className="design-grid">
        <Panel title="Logotype & app mark" sub="16 px, 32 px and stage scale" className="span-2">
          <div className="logo-row">
            <div className="logo-mark-sm"><div className="brand-mark"><i /><i /><i /><i /><i /></div><span className="xsmall soft">16 px</span></div>
            <div className="logo-mark-md"><div className="brand-mark"><i /><i /><i /><i /><i /></div><b>RECALL</b><span className="xsmall soft">32 px</span></div>
            <div className="logo-stage">
              <div className="brand-mark"><i /><i /><i /><i /><i /></div>
              <div><b>RECALL</b><span>the capture layer for PPMA</span></div>
            </div>
          </div>
          <div className="logo-notes">
            <div><b>Mark</b><span>Five bars are a waveform and a memory trace. The tallest bar is the quote you can find again.</span></div>
            <div><b>Wordmark</b><span>Letter-spaced uppercase; never lowercase in product chrome.</span></div>
            <div><b>Accent</b><span>Amber is capture and attention; green is consent; red is redaction, never decoration.</span></div>
          </div>
        </Panel>

        <Panel title="Colour" sub="Semantic before decorative">
          <div className="swatch-grid">
            {colors.map(([name, hex, use]) => (
              <div className="swatch" key={name}>
                <i style={{ background: hex }} />
                <div><b>{name}</b><span className="mono">{hex}</span><small>{use}</small></div>
                <CopyButton text={hex} label="Copy" />
              </div>
            ))}
          </div>
          <div className="contrast-note"><Icon name="eye" size={14} /> Body text is checked against its own background at AA. Redaction and consent never rely on colour alone — they carry a label and an icon.</div>
        </Panel>

        <Panel title="Type" sub="Fraunces for the human moment, Inter for work, JetBrains Mono for proof">
          <div className="type-scale">
            <div><span className="xsmall soft">Display · Fraunces</span><p className="type-display">The meeting is not lost.</p></div>
            <div><span className="xsmall soft">H1 · Fraunces</span><p className="type-h1">What did we promise them?</p></div>
            <div><span className="xsmall soft">H2 · Inter semibold</span><p className="type-h2">Client delivery call — Northgate</p></div>
            <div><span className="xsmall soft">Body · Inter</span><p className="type-body">Consent is recorded before capture. Raw audio and video stay on the device by default.</p></div>
            <div><span className="xsmall soft">Mono · JetBrains Mono</span><p className="type-mono">00:11:24 · ev_01 · 93% · capture.meeting.completed</p></div>
          </div>
        </Panel>

        <Panel title="Record control" sub="The one verb">
          <div className="component-row">
            <button className="record-orb demo-orb" aria-label="Record">
              <span className="record-ring" /><span className="record-core" /><span className="record-label">Tap record</span>
            </button>
            <div className="component-notes">
              <b>States</b>
              <span>idle · recording · paused · consent blocked · queued</span>
              <b>Motion</b>
              <span>pulse 2.4 s, reduced to a static ring under prefers-reduced-motion</span>
              <b>Rule</b>
              <span>Never start on a single accidental tap when consent is missing.</span>
            </div>
          </div>
        </Panel>

        <Panel title="Waveform & transcript" sub="The timeline is the proof">
          <div className="demo-wave"><Waveform duration={822} progress={684} seed="design" redactions={[{ start: 440, end: 470 }]} /></div>
          <div className="transcript demo-transcript">
            <div className="transcript-row sp-amber selected low-attribution">
              <span className="row-speaker">AV</span>
              <span className="row-body">
                <span className="row-head"><b>Anna Voss</b><span className="mono">00:11:24</span><span className="row-kind kind-promise">promise</span><span className="row-low"><Icon name="alert" size={11} /> low attribution</span></span>
                <p className="row-text">On delivery: we can hold the 14th, but not the 12th.</p>
                <span className="row-foot"><Confidence value={0.71} /><span className="mono xsmall soft">ev_01 · attribution 71%</span></span>
              </span>
            </div>
            <div className="transcript-row sp-violet">
              <span className="row-speaker">SK</span>
              <span className="row-body">
                <span className="row-head"><b>Sandra Klein</b><span className="mono">00:12:32</span></span>
                <div className="redaction-inline"><span className="redaction-bar-text">[redacted — internal client comment]</span><button className="btn sm ghost"><Icon name="eye" size={12} /> Reveal on this device</button></div>
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Speaker, evidence & redaction" sub="Core components">
          <div className="component-stack">
            <SpeakerChip name="Marek Nowak" initials="MN" role="Delivery lead" color="cyan" />
            <div className="evidence-demo">
              <div className="row between"><Chip tone="amber">promise</Chip><span className="mono xsmall">ev_01 · 93%</span></div>
              <p>“We can hold the 14th, but not the 12th.”</p>
              <div className="row between"><span className="xsmall soft">Marek Nowak · Northgate delivery call</span><Chip tone="green">source: RECALL</Chip></div>
            </div>
            <div className="redacted-bar"><span>[redacted — internal client comment]</span></div>
            <div className="row gap8"><Status value="sent" /><Status value="queued" /><Status value="withdrawn" /><Status value="tombstoned" /></div>
            <div className="row gap8"><Confidence value={0.93} /><Confidence value={0.71} /><Meter value={0.84} label="useful" tone="green" /></div>
            <div className="row between"><span className="small">Battery-aware capture</span><Toggle checked={toggle} onChange={setToggle} label="Battery-aware capture" /></div>
          </div>
        </Panel>

        <Panel title="PPMA status" sub="The return path, made legible">
          <div className="ppma-status-demo">
            <div><span className="kicker">PPMA</span><Status value="sent" /></div>
            <div><span className="kicker">Queue</span><b>0 events</b></div>
            <div><span className="kicker">Last event</span><b className="mono">capture.correction</b></div>
            <div><span className="kicker">Source</span><Chip tone="green">RECALL</Chip></div>
          </div>
          <div className="component-notes mt12">
            <b>“PPMA updated”</b><span>after a successful delivery</span>
            <b>“PPMA unavailable — queued”</b><span>when the endpoint is down</span>
            <b>“Legal hold”</b><span>deletion is refused and shown</span>
          </div>
        </Panel>

        <Panel title="Motion tokens" sub="Fast, quiet, reversible">
          <div className="motion-list">
            {[
              ["record", "240 ms", "pulse in, never a strobe"],
              ["transcript", "120 ms", "new row settles without layout shift"],
              ["correction", "300 ms", "the speaker chip flips, the memory updates"],
              ["handoff", "900 ms", "one envelope, one update, one line"],
              ["reset", "≤ 5 s", "back to the cold open"],
            ].map(([name, time, detail]) => (
              <div key={name}><b>{name}</b><span className="mono">{time}</span><p>{detail}</p></div>
            ))}
          </div>
          <p className="xsmall soft">Reduced motion removes pulses and long slides but keeps the state change visible. No animation hides information.</p>
        </Panel>

        <Panel title="Role flows" sub="Hide what the role cannot act on">
          <div className="role-flow">
            {pack.admin.roles.map((role) => (
              <div key={role.role}>
                <b>{role.role.replace(/_/g, " ")}</b>
                <span>{role.can}</span>
                <small>Cannot: {role.cannot}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Glossary" sub="Say the same word every time" className="span-2">
          <div className="glossary">
            {glossary.map(([term, definition]) => (
              <div key={term}><b>{term}</b><p>{definition}</p></div>
            ))}
          </div>
        </Panel>

        <Panel title="Accessibility & performance" sub="The bar for the pilot">
          <div className="a11y-list">
            {[
              ["WCAG 2.2 AA", "Contrast, focus rings, labels and keyboard paths are part of the component, not an afterthought."],
              ["Keyboard first", "⌘K, /, G-sequences, Space and R on the stage. Every control is reachable."],
              ["Live captions", "Transcript rows are announced politely; the stage has an aria-live region."],
              ["Reduced motion", "Prefers-reduced-motion and the in-app toggle remove pulses and smooth scroll."],
              ["Performance", "Capture start under 250 ms; search under 100 ms locally; no loading state on stage."],
              ["Battery", "Low-power mode trades diarization cadence, never consent or redaction."],
            ].map(([title, detail]) => (
              <div key={title}><b>{title}</b><p>{detail}</p></div>
            ))}
          </div>
        </Panel>

        <Panel title="Content rules" sub="What the interface never says">
          <ul className="plain-list">
            <li><Icon name="check" size={12} /> “The meeting is not lost.”</li>
            <li><Icon name="check" size={12} /> “Source: RECALL.”</li>
            <li><Icon name="check" size={12} /> “PPMA updated.”</li>
            <li><Icon name="x" size={12} /> “AI-powered notes” — vague and red-ocean.</li>
            <li><Icon name="x" size={12} /> “Never miss anything” — over-capture, not memory.</li>
            <li><Icon name="x" size={12} /> “We will handle compliance for you” — consent is jurisdiction-specific.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}

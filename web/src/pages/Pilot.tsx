import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { pct } from "../lib/engine";
import { PageHead, Panel, Stat, Chip, Status, Meter, DataNote } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Pilot() {
  const { pack } = useStore();
  const t = useT();
  if (!pack) return null;
  const p = pack.pilot;
  const maxLatency = Math.max(...p.weekly.map((week) => week.capture_to_ppma_s));
  const maxQuotes = Math.max(...p.weekly.map((week) => week.quotes));
  const maxFunnel = Math.max(...p.funnel.map((stage) => stage.count));

  return (
    <>
      <PageHead
        kicker="Pilot · one team · one repeated cadence · 90 days"
        title={t("pilot.title")}
        subtitle={t("pilot.subtitle")}
        actions={<Chip tone="green" dot="live">Northgate project team · {pack.team.seats} seats</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="Pilot numbers in this demo are synthetic. The baseline, gates and formulas are the real measurement plan; production would replace them with measured events." />

      <div className="stats-row">
        <Stat label="Capture → PPMA" value={`${p.capture_to_ppma_s}s`} note={`Target < ${p.target_capture_to_ppma_s}s · gate ${p.capture_to_ppma_s < p.target_capture_to_ppma_s ? "passed" : "watch"}`} tone="green" icon="send" />
        <Stat label="Useful extraction" value={pct(p.useful_rate)} note="Decisions, promises and actions judged useful" tone="green" icon="spark" />
        <Stat label="Time to quote" value={`${p.quote_seconds}s`} note={`Target ≤ ${p.target_quote_seconds}s · still a gap`} tone="amber" icon="quote" />
        <Stat label="Consent coverage" value={pct(p.consent_coverage)} note="Every capture has a recorded state" tone="green" icon="shield" />
        <Stat label="Action conversion" value={pct(p.action_conversion)} note="Memories that led to a completed follow-up" tone="amber" icon="list" />
      </div>

      <div className="pilot-grid">
        <Panel title="The six pilot gates" sub="Do not call the pilot a success until these pass">
          <div className="gate-list">
            {p.gates.map((gate) => (
              <div className={gate.status === "pass" ? "gate-row pass" : "gate-row watch"} key={gate.id}>
                <span className="gate-icon"><Icon name={gate.status === "pass" ? "check" : "alert"} size={14} /></span>
                <div><b>{gate.label}</b><small>Target {gate.target} · actual {gate.actual}</small></div>
                <Status value={gate.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Latency and usefulness by week" sub="Lower latency is better; usefulness should rise">
          <div className="chart">
            <div className="chart-legend"><span><i className="legend-dot amber" /> Capture → PPMA (s)</span><span><i className="legend-dot green" /> Useful rate</span><span><i className="legend-bar cyan" /> Quotes</span></div>
            <div className="chart-bars">
              {p.weekly.map((week) => (
                <div className="chart-group" key={week.week}>
                  <div className="chart-columns">
                    <div className="chart-bar amber" style={{ height: `${(week.capture_to_ppma_s / maxLatency) * 100}%` }} title={`${week.capture_to_ppma_s} s`} />
                    <div className="chart-bar green" style={{ height: `${week.useful_rate * 100}%` }} title={pct(week.useful_rate)} />
                    <div className="chart-bar cyan" style={{ height: `${(week.quotes / maxQuotes) * 100}%` }} title={`${week.quotes} quotes`} />
                  </div>
                  <span>{week.week}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-note"><Icon name="activity" size={13} /> Capture-to-memory falls from 28 s to 14 s while useful extraction climbs from 64% to 84%. Quote retrieval is still the weak link.</div>
        </Panel>

        <Panel title="Capture → memory → action" sub="Where the value leaks">
          <div className="funnel">
            {p.funnel.map((stage, index) => (
              <div className="funnel-row" key={stage.stage}>
                <span>{stage.stage}</span>
                <div className="funnel-bar"><i style={{ width: `${(stage.count / maxFunnel) * 100}%` }} /></div>
                <b>{stage.count}</b>
                {index > 0 && <small>{Math.round((stage.count / p.funnel[index - 1].count) * 100)}%</small>}
              </div>
            ))}
          </div>
          <p className="xsmall soft mt8">The conversion from retrieved quote to accepted memory is the pilot's real question. A recorder that cannot change a follow-up is not project memory.</p>
        </Panel>

        <Panel title="Extraction quality" sub="Every extracted item keeps its evidence">
          <div className="extraction-list">
            {p.extraction.map((row) => (
              <div className="extraction-row" key={row.kind}>
                <b>{row.kind}</b>
                <Meter value={row.precision} label="precision" valueLabel={pct(row.precision)} tone="green" />
                <Meter value={row.recall} label="recall" valueLabel={pct(row.recall)} tone="amber" />
                <Meter value={row.useful} label="useful" valueLabel={pct(row.useful)} tone="cyan" />
              </div>
            ))}
          </div>
          <div className="quality-row">
            <div><span>Redaction precision</span><b>{pct(p.redaction_precision)}</b></div>
            <div><span>Redaction recall</span><b>{pct(p.redaction_recall)}</b></div>
            <div><span>Deletion propagation</span><b>{p.deletion_propagation_syncs} sync</b></div>
            <div><span>Quote retrieval</span><b>{pct(p.quote_success)}</b></div>
          </div>
        </Panel>

        <Panel title="Baseline vs now" sub="What the team did before RECALL">
          <div className="baseline">
            <div className="baseline-row">
              <span>Find a past decision</span>
              <div className="baseline-bar"><i className="before" style={{ width: "100%" }} /><i className="after" style={{ width: `${(p.quote_seconds / 60 / p.baseline_min) * 100}%` }} /></div>
              <b>{p.baseline_min} min → {p.quote_seconds}s</b>
            </div>
            <div className="baseline-row">
              <span>Meeting-to-memory</span>
              <div className="baseline-bar"><i className="before" style={{ width: "100%" }} /><i className="after" style={{ width: "47%" }} /></div>
              <b>same day → {p.capture_to_ppma_s}s</b>
            </div>
            <div className="baseline-row">
              <span>Consent evidence</span>
              <div className="baseline-bar"><i className="before" style={{ width: "0%" }} /><i className="after" style={{ width: "100%" }} /></div>
              <b>none → {pct(p.consent_coverage)}</b>
            </div>
          </div>
        </Panel>

        <Panel title="What this proves — and what it does not" sub="The honest read">
          <ul className="plain-list">
            {p.notes.map((note) => <li key={note}><Icon name="check" size={12} /> {note}</li>)}
            <li><Icon name="x" size={12} /> It does not prove that a second team, language or regulated domain behaves the same way.</li>
            <li><Icon name="x" size={12} /> It does not prove that redaction is safe without human review.</li>
            <li><Icon name="x" size={12} /> It does not prove retention works at scale until a legal hold and a real deletion are exercised.</li>
          </ul>
        </Panel>
      </div>

      <div className="pilot-foot">
        <span><Icon name="shield" size={13} /> No synthetic records after week one. No training on customer audio or transcripts.</span>
        <span><Icon name="lock" size={13} /> Raw media never uploaded by default.</span>
        <span><Icon name="send" size={13} /> Capture-to-PPMA measured on the local loopback.</span>
      </div>
    </>
  );
}

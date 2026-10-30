import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtDateTime, fmtDuration, pct } from "../lib/engine";
import { PageHead, Panel, Stat, Chip, Status, DataNote, Meter, Toggle } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Health() {
  const { pack, queue, events, killSwitch, toggleKillSwitch, say, consentCoverage, memory, activeMeetings } = useStore();
  const t = useT();
  if (!pack) return null;
  const health = pack.admin.health;
  const metrics = health.metrics;
  const activeMemory = memory.filter((entry) => entry.state === "active");
  const uncorrected = activeMeetings.filter((meeting) => meeting.evidence.some((evidence) => evidence.attribution_confidence < 0.8) && !meeting.evidence.some((evidence) => evidence.attribution_confidence === 1));
  const duplicates = events.filter((event) => event.delivery.duplicate).length;
  const failed = events.filter((event) => event.delivery.status === "failed").length;

  return (
    <>
      <PageHead
        kicker="Capture health · model quality and device trust"
        title={t("health.title")}
        subtitle={t("health.subtitle")}
        actions={
          <Chip tone={health.status === "healthy" ? "green" : "amber"} dot="live">{health.status} · last scan {fmtDateTime(health.last_scan)}</Chip>
        }
      />
      <DataNote seed={pack.meta.seed} note="Quality metrics are reference values for the pilot domain. The thresholds, drift checks and runbook are the production plan; they are not a claim of measured field performance." />

      <div className="stats-row">
        <Stat label="Word error rate" value={pct(metrics.wer, 1)} note="Pilot set · English-first" tone="green" icon="wave" />
        <Stat label="Diarization DER" value={pct(metrics.diarization_der, 1)} note="Speaker attribution is correctable" tone="amber" icon="users" />
        <Stat label="Extraction" value={`${pct(metrics.extraction_precision)} / ${pct(metrics.extraction_recall)}`} note="Precision / recall" tone="green" icon="spark" />
        <Stat label="Redaction" value={`${pct(metrics.redaction_precision)} / ${pct(metrics.redaction_recall)}`} note="Precision / recall · human review" tone="amber" icon="scissors" />
        <Stat label="Consent coverage" value={pct(consentCoverage)} note="Capture cannot start without it" tone="green" icon="shield" />
        <Stat label="Queue depth" value={queue.length + metrics.queue_depth} note={`${metrics.dead_letter} dead letter · ${duplicates} duplicates`} tone={queue.length ? "amber" : "green"} icon="send" />
      </div>

      <div className="health-grid">
        <Panel title="Model cards" sub="Inputs, limits, failure modes, owner and last validation" className="span-2">
          <div className="model-card-grid">
            {pack.admin.model_cards.map((model) => (
              <div className="model-card" key={model.id}>
                <div className="row between">
                  <span className="kicker">{model.kind}</span>
                  <Chip tone={model.status === "champion" ? "green" : "amber"}>{model.status}</Chip>
                </div>
                <b>{model.name}</b>
                <span className="mono xsmall soft">{model.version} · {model.metric}</span>
                <p><b>Inputs</b>{model.inputs}</p>
                <p><b>Limits</b>{model.limits}</p>
                <p><b>Failure modes</b>{model.failure_modes}</p>
                <div className="model-foot">
                  <span>Owner {model.owner}</span>
                  <span>Validated {model.last_validated}</span>
                </div>
                <div className="row gap6 mt8">
                  <button className="btn sm ghost" onClick={() => say(`${model.name}: version pinned. Rollback available for two minor versions.`)}>Pin</button>
                  <button className="btn sm ghost" onClick={() => say(`${model.name}: shadow evaluation requested. No update ships without a human.`)}>Shadow</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Drift" sub="Detect it before the team loses trust">
          <div className="drift-list">
            {health.drift.map((item) => (
              <div className="drift-row" key={item.model}>
                <div className="row between"><b>{item.model}</b><Status value={item.status === "ok" ? "active" : "watch"} tone={item.status === "ok" ? "green" : "amber"}>{item.status}</Status></div>
                <span className="mono small">{item.delta}</span>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="calibration">
            <span className="kicker">Confidence calibration</span>
            {[
              ["English · DE", 0.94],
              ["English · accent", 0.81],
              ["Remote audio", 0.77],
              ["Technical jargon", 0.72],
            ].map(([label, value]) => (
              <Meter key={label as string} value={value as number} label={label as string} valueLabel={pct(value as number)} tone={(value as number) < 0.8 ? "red" : "green"} />
            ))}
          </div>
        </Panel>

        <Panel title="Device health" sub="Mic, storage, battery and background capture">
          <div className="device-list">
            {pack.team.devices.map((device) => (
              <div className={classNames("admin-device", device.status === "revoked" && "revoked")} key={device.id}>
                <span className="device-kind"><Icon name={device.kind === "laptop" ? "harddrive" : device.kind === "tablet" ? "layers" : "cpu"} size={15} /></span>
                <span><b>{device.name}</b><small>{device.owner} · {device.app_version}</small></span>
                <span className="model-health">
                  <span className="mono xsmall">mic {device.mic}</span>
                  <span className="mono xsmall">storage {device.storage_used_pct}%</span>
                  <span className="mono xsmall">battery {device.battery_pct ?? "—"}%</span>
                </span>
                <Status value={device.status === "revoked" ? "retired" : "active"} />
              </div>
            ))}
          </div>
          <div className="health-inline">
            <span><Icon name="mic" size={12} /> Mic clipping: {metrics.mic_clipping}</span>
            <span><Icon name="activity" size={12} /> Background capture: foreground only</span>
            <span><Icon name="battery" size={12} /> Low-power mode: on</span>
          </div>
        </Panel>

        <Panel title="PPMA delivery health" sub="Queue depth, retries, dead-letter and duplicates">
          <div className="health-inline-grid">
            <div><span>Queue</span><b>{queue.length}</b></div>
            <div><span>Delivered</span><b>{events.filter((event) => event.delivery.status === "delivered").length}</b></div>
            <div><span>Retries</span><b>{events.reduce((sum, event) => sum + Math.max(0, event.delivery.attempts - 1), 0)}</b></div>
            <div><span>Dead letter</span><b>{failed}</b></div>
            <div><span>Duplicates</span><b>{duplicates}</b></div>
            <div><span>Delete lag</span><b>{metrics.deletion_lag_h} h</b></div>
            <div><span>Retention expired</span><b>{metrics.retention_expired}</b></div>
            <div><span>Consent coverage</span><b>{pct(consentCoverage)}</b></div>
          </div>
          <button className="btn sm mt12" onClick={() => say("Dead-letter review: zero events. Ordering by occurred_at; exponential backoff.")}>
            <Icon name="refresh" size={12} /> Review queue and dead-letter
          </button>
        </Panel>

        <Panel title="Memory hygiene" sub="The quiet failure modes">
          <div className="hygiene-list">
            <div><span>Active memory entries</span><b>{activeMemory.length}</b></div>
            <div><span>Uncorrected low-attribution rows</span><b>{uncorrected.length}</b></div>
            <div><span>Stale summaries</span><b>0</b></div>
            <div><span>Unlabeled sensitivity</span><b>0</b></div>
            <div><span>Duplicate memories</span><b>{duplicates}</b></div>
            <div><span>Tombstones preserved</span><b>{memory.filter((entry) => entry.state === "retired").length}</b></div>
          </div>
          {uncorrected.length > 0 && <p className="xsmall soft mt8">Open a meeting and confirm the speaker map. A correction is cheaper than a wrong memory.</p>}
        </Panel>

        <Panel title="Sync, conflicts & backup" sub="Offline-first, encrypted, human-reviewable">
          <div className="health-inline-grid">
            <div><span>Last sync</span><b>2 min</b></div>
            <div><span>Open conflicts</span><b>0</b></div>
            <div><span>Pending corrections</span><b>{uncorrected.length}</b></div>
            <div><span>Encrypted queue</span><b>AES-GCM</b></div>
            <div><span>Restore drill</span><b>21 Oct</b></div>
            <div><span>Integrity hash</span><b>verified</b></div>
            <div><span>Thermal</span><b>nominal</b></div>
            <div><span>Ambient audit</span><b>on</b></div>
          </div>
          <div className="row gap8 mt12">
            <button className="btn sm" onClick={() => say("Restore drill passed: encrypted store opened, 3 captures verified, 0 conflicts.")}>
              <Icon name="harddrive" size={12} /> Restore drill
            </button>
            <button className="btn sm ghost" onClick={() => say("Conflict policy: latest human correction wins; both versions remain in the audit.")}>
              <Icon name="layers" size={12} /> Conflict policy
            </button>
          </div>
        </Panel>

        <Panel title="Incidents & runbook" sub="The worst day, rehearsed">
          <div className="incident-list">
            {health.incidents.map((incident) => (
              <div className={`incident ${incident.severity}`} key={incident.id}>
                <div className="row between"><b>{incident.title}</b><Status value={incident.status === "watching" ? "watch" : "active"} tone={incident.status === "watching" ? "amber" : "green"}>{incident.status}</Status></div>
                <span className="mono xsmall soft">{fmtDateTime(incident.at)} · {incident.kind}</span>
                <p>{incident.detail}</p>
              </div>
            ))}
          </div>
          <div className="kill-row">
            <div><b>Capture kill switch</b><p>Immediate stop, queue preserved, audit entry created.</p></div>
            <Toggle checked={killSwitch} onChange={toggleKillSwitch} label="Capture kill switch" />
          </div>
        </Panel>

        <Panel title="Privacy incident runbook" sub="Stop, preserve, notify, delete, publish" className="span-2">
          <div className="runbook-grid">
            {[
              ["1 Stop", "Halt capture on every device; keep the local queue and audit."],
              ["2 Identify", "Find the captures, consent refs and PPMA memories involved."],
              ["3 Hold", "Apply legal hold if litigation is likely; note the policy that wins."],
              ["4 Remove", "Delete or redact locally; emit the tombstone; verify PPMA retirement."],
              ["5 Publish", "Write the incident review. No silent deletion, no undeclared capture."],
            ].map(([title, detail]) => (
              <div key={title}><span className="kicker">{title}</span><p>{detail}</p></div>
            ))}
          </div>
          <div className="health-foot">
            <span><Icon name="clock" size={12} /> Model/version pinning: on</span>
            <span><Icon name="refresh" size={12} /> Rollback: two minor versions</span>
            <span><Icon name="wifiOff" size={12} /> CPU fallback warning: visible</span>
            <span><Icon name="lock" size={12} /> No silent cloud fallback</span>
            <span><Icon name="flask" size={12} /> Last validation: Oct 2026</span>
          </div>
        </Panel>
      </div>
    </>
  );
}

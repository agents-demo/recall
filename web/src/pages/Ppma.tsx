import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtDate, fmtDateTime, fmtDuration, pct } from "../lib/engine";
import { PageHead, Panel, Chip, Status, DataNote, Empty, SourceChip, Toggle, Meter } from "../components/UI";
import { Icon } from "../components/Icon";

type Tab = "events" | "inbox" | "commands" | "conformance" | "credentials";

export default function Ppma() {
  const {
    pack,
    events,
    queue,
    memory,
    commands,
    project,
    settings,
    killSwitch,
    lastReplay,
    conformanceRun,
    setSetting,
    flushQueue,
    replayEvent,
    handleCommand,
    runConformance,
    toggleKillSwitch,
    remoteAcks,
    say,
  } = useStore();
  const t = useT();
  const [tab, setTab] = useState<Tab>("events");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState<string | null>(null);

  useEffect(() => {
    if (settings.ppmaMode !== "live" || !settings.endpointUrl) return;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`${settings.endpointUrl.replace(/\/$/, "")}/v1/stream`);
      source.onopen = () => setLiveStream("connected");
      source.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; event_id?: string };
          if (message.type === "ppma.memory_updated") setLiveStream(`updated · ${message.event_id ?? "project"}`);
        } catch {
          /* ignore malformed stream frames */
        }
      };
      source.onerror = () => setLiveStream("reconnecting");
    } catch {
      setLiveStream("unavailable");
    }
    return () => source?.close();
  }, [settings.ppmaMode, settings.endpointUrl]);

  if (!pack) return null;

  const types = useMemo(() => [...new Set(events.map((event) => event.type))], [events]);
  const filtered = useMemo(
    () =>
      [...events]
        .reverse()
        .filter((event) => typeFilter === "all" || event.type === typeFilter)
        .filter((event) => statusFilter === "all" || event.delivery.status === statusFilter),
    [events, typeFilter, statusFilter],
  );
  const delivered = events.filter((event) => event.delivery.status === "delivered").length;
  const duplicates = events.filter((event) => event.delivery.duplicate).length;
  const pending = commands.filter((command) => command.status === "pending").length;
  const activeMemory = memory.filter((entry) => entry.state === "active");
  const lastEvent = events[events.length - 1];

  return (
    <>
      <PageHead
        kicker="PPMA × RECALL · integration contract"
        title={t("ppma.title")}
        subtitle={t("ppma.subtitle")}
        actions={
          <>
            <button className="btn" onClick={flushQueue} disabled={!queue.length}>
              <Icon name="send" size={14} /> Deliver queued {queue.length ? `(${queue.length})` : ""}
            </button>
            <button className="btn primary" onClick={() => { setTab("conformance"); runConformance(); }}>
              <Icon name="flask" size={14} /> Run conformance
            </button>
          </>
        }
      />
      <DataNote seed={pack.meta.seed} note="The local PPMA fake is deterministic. It deduplicates by event_id, applies corrections, replaces redacted text with the safe version, retires deleted memories and refuses to resurrect a tombstone." />

      <div className="ppma-banner">
        <div className="ppma-banner-left">
          <span className="kicker">app_id · {pack.ppma.manifest.app_id}</span>
          <h2>{pack.ppma.manifest.contract}</h2>
          <p>Events out; limited commands in. RECALL owns capture, consent, redaction and evidence. PPMA owns project memory, tasks and action.</p>
        </div>
        <div className="ppma-banner-right">
          <div className="live-toggle">
            <span><i className={classNames("dot", settings.ppmaOnline ? "live" : "warn")} /> PPMA endpoint</span>
            <Toggle checked={settings.ppmaOnline} onChange={(value) => setSetting("ppmaOnline", value)} label="Toggle PPMA availability" />
          </div>
          <div className="live-toggle">
            <span><i className={classNames("dot", killSwitch ? "bad" : "live")} /> Capture kill switch</span>
            <Toggle checked={killSwitch} onChange={toggleKillSwitch} label="Capture kill switch" />
          </div>
          <div className="ppma-banner-stats">
            <span><b>{delivered}</b> delivered</span>
            <span><b>{queue.length}</b> queued</span>
            <span><b>{duplicates}</b> duplicates</span>
            <span><b>{remoteAcks.filter((ack) => ack.status === "delivered").length}</b> live acks</span>
          </div>
          {liveStream && <Chip tone={liveStream.startsWith("updated") || liveStream === "connected" ? "green" : "amber"} dot="live">stream · {liveStream}</Chip>}
        </div>
      </div>

      <div className="ppma-overview">
        <Panel title="Project state" sub="PPMA owns this; RECALL only links to evidence" actions={<SourceChip />}>
          <div className="project-state">
            <span className="kicker">{project.last_event ? `Last event ${project.last_event}` : "No handoff yet"}</span>
            <p>{project.state || pack.ppma.project.state_before}</p>
            <div className="project-after">
              <span className="xsmall soft">After the delivery handoff</span>
              <p>{pack.ppma.project.state_after}</p>
            </div>
            {project.followup && (
              <div className="draft-box">
                <div className="row between"><span className="kicker">Follow-up drafted · not sent</span><Chip tone="amber">approval required</Chip></div>
                <p>{project.followup}</p>
              </div>
            )}
          </div>
          <div className="approval-row">
            <div><b>{pack.ppma.project.proposed_action}</b><span className="xsmall soft">The human approves in PPMA. RECALL has no action endpoint and never sends a message.</span></div>
            <button className="btn" disabled title="RECALL cannot act on project state — this button exists only to show the boundary">Approve in PPMA <Icon name="external" size={12} /></button>
          </div>
        </Panel>

        <Panel title="Manifest" sub={`v${pack.ppma.manifest.version} · ${pack.ppma.manifest.last_validated.slice(0, 10)}`} actions={<Chip tone="green">validated</Chip>}>
          <div className="manifest-grid">
            <div><span>App id</span><b className="mono">{pack.ppma.manifest.app_id}</b></div>
            <div><span>Event prefix</span><b className="mono">{pack.ppma.manifest.event_prefix}</b></div>
            <div><span>Default sensitivity</span><b>{pack.ppma.manifest.default_sensitivity}</b></div>
            <div><span>Direction</span><b>{pack.ppma.manifest.direction}</b></div>
            <div><span>Auth</span><b>{pack.ppma.manifest.auth}</b></div>
            <div><span>Resources</span><b>{pack.ppma.manifest.resources}</b></div>
          </div>
          <div className="event-type-list">
            {pack.ppma.manifest.events.map((event) => (
              <div className="event-type" key={event.type}>
                <b className="mono">{event.type}</b>
                <span>{event.description}</span>
                <Chip tone="violet">{event.sensitivity}</Chip>
                <Chip>{event.resource}</Chip>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="ppma-side-row">
        <div className="ppma-limits">
          <div><span>Per team / minute</span><b>{pack.ppma.limits.per_team_per_minute}</b></div>
          <div><span>Used today</span><b>{pack.ppma.limits.used_today.toLocaleString()} / {pack.ppma.limits.per_team_per_day.toLocaleString()}</b></div>
          <div><span>Backpressure</span><b>{pack.ppma.limits.backpressure}</b></div>
          <div><span>Dead letter after</span><b>{pack.ppma.limits.dead_letter_after} attempts</b></div>
        </div>
        <div className="ppma-limits-note">
          <Icon name="shield" size={15} />
          <span><b>Flow policy.</b> Every event carries an explicit sensitivity label. RECALL never sends raw media under a label that forbids egress. The owner may override a label; PPMA's flow policy wins for egress.</span>
        </div>
      </div>

      <div className="tabs">
        {([
          ["events", `Events (${events.length})`, "layers"],
          ["inbox", `PPMA inbox (${memory.length})`, "inbox"],
          ["commands", `Commands (${pending} pending)`, "terminal"],
          ["conformance", "Conformance", "flask"],
          ["credentials", "Credentials", "key"],
        ] as [Tab, string, string][]).map(([id, label, icon]) => (
          <button key={id} className={classNames("tab", tab === id && "active")} onClick={() => setTab(id)}>
            <Icon name={icon} size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "events" && (
        <Panel
          title="Event log"
          sub="Stable event_id · occurred_at · delivery status · no event loss"
          actions={
            <div className="row gap6">
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by event type">
                <option value="all">All types</option>
                {types.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by delivery status">
                <option value="all">All deliveries</option>
                <option value="delivered">Delivered</option>
                <option value="queued">Queued</option>
              </select>
            </div>
          }
        >
          <div className="event-table">
            <div className="event-table-head">
              <span>Event</span><span>Occurred</span><span>Sensitivity</span><span>Delivery</span><span>Attempts</span><span />
            </div>
            {filtered.map((event) => (
              <div className={classNames("event-table-row", openEvent === event.event_id && "open")} key={event.event_id}>
                <div className="event-primary">
                  <b className="mono">{event.type}</b>
                  <small className="mono">{event.event_id}</small>
                  <span className="xsmall soft">{String(event.payload.title ?? event.payload.capture_id ?? event.payload.note_id ?? "")}</span>
                </div>
                <span className="mono xsmall">{fmtDateTime(event.occurred_at)}</span>
                <Chip tone={event.sensitivity === "personal" ? "neutral" : "violet"}>{event.sensitivity.replace(/_/g, " ")}</Chip>
                <span className="event-delivery">
                  <Status value={event.delivery.status} />
                  {event.delivery.latency_ms !== null && <small className="mono">{event.delivery.latency_ms} ms</small>}
                  {event.delivery.duplicate && <Chip tone="red">duplicate</Chip>}
                  {remoteAcks.find((ack) => ack.event_id === event.event_id) && (
                    <Chip tone={remoteAcks.find((ack) => ack.event_id === event.event_id)?.status === "delivered" ? "green" : "red"}>
                      live · {remoteAcks.find((ack) => ack.event_id === event.event_id)?.detail}
                    </Chip>
                  )}
                </span>
                <span className="mono xsmall">{event.delivery.attempts}</span>
                <span className="event-actions">
                  <button className="btn sm ghost" onClick={() => setOpenEvent(openEvent === event.event_id ? null : event.event_id)}>
                    {openEvent === event.event_id ? "Hide" : "Payload"}
                  </button>
                  <button className="btn sm ghost" onClick={() => replayEvent(event.event_id)} title="Replay this event through PPMA">
                    <Icon name="refresh" size={12} /> Replay
                  </button>
                </span>
                {openEvent === event.event_id && (
                  <div className="event-payload">
                    <div className="event-payload-meta">
                      <span><b>space</b> {event.space}</span>
                      <span><b>app_id</b> {event.app_id}</span>
                      <span><b>delivered</b> {event.delivery.delivered_at ? fmtDateTime(event.delivery.delivered_at) : "—"}</span>
                      <span><b>local_only</b> {String((event.provenance as { local_only?: boolean }).local_only ?? true)}</span>
                    </div>
                    <pre>{JSON.stringify({ type: event.type, sensitivity: event.sensitivity, payload: event.payload, provenance: event.provenance }, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && <Empty title="No events match" detail="Change the filters or send a capture." icon="send" />}
          </div>
          <div className="event-table-foot">
            <span><Icon name="lock" size={12} /> Media is not attached by default. Evidence pointers resolve inside RECALL.</span>
            {lastReplay && <span className="mono xsmall">last replay · {lastReplay.event_id} · {lastReplay.result}</span>}
          </div>
        </Panel>
      )}

      {tab === "inbox" && (
        <div className="inbox-grid">
          <Panel title="PPMA memory" sub="Derived facts only · every entry links back to RECALL" actions={<Chip tone="green" dot="live">source chips on</Chip>}>
            <div className="memory-list">
              {memory.map((entry) => (
                <div className={classNames("memory-row", entry.state !== "active" && "retired")} key={entry.id}>
                  <div className="memory-top">
                    <span className="memory-kind">{entry.type}</span>
                    <SourceChip />
                    <Status value={entry.state} />
                    <span className="mono xsmall soft">{Math.round(entry.confidence * 100)}%</span>
                  </div>
                  <p>{entry.text}</p>
                  <div className="memory-meta">
                    <Chip>{entry.sensitivity.replace(/_/g, " ")}</Chip>
                    <Chip>consent {entry.consent}</Chip>
                    {entry.corrected && <Chip tone="green">corrected · {entry.corrected}</Chip>}
                    {entry.redacted && <Chip tone="red">safe version only</Chip>}
                    <span className="mono xsmall soft">{entry.evidence_id}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <aside className="inbox-side">
            <Panel title="Return path" sub="Read-only context, never a command">
              <div className="return-path">
                <div><span className="mono">ppma.memory_updated</span><p>RECALL refreshes the project context around the meeting.</p></div>
                <div><span className="mono">capture.forget</span><p>PPMA asks RECALL to delete locally; RECALL confirms with a tombstone.</p></div>
                <div><span className="mono">capture.apply_retention</span><p>PPMA passes a retention policy; the stricter policy wins.</p></div>
              </div>
              <button className="btn sm mt12" onClick={() => say("Project context refreshed from ppma.memory_updated · read-only")}>
                <Icon name="refresh" size={12} /> Refresh context
              </button>
            </Panel>
            <Panel title="Boundary check" sub="What RECALL must never do">
              <ul className="plain-list">
                <li><Icon name="x" size={12} /> Create a task or calendar event</li>
                <li><Icon name="x" size={12} /> Send an email or message</li>
                <li><Icon name="x" size={12} /> Run a mission or proactive action</li>
                <li><Icon name="x" size={12} /> Update project state directly</li>
                <li><Icon name="check" size={12} /> Capture, prove, redact, forget</li>
              </ul>
            </Panel>
          </aside>
        </div>
      )}

      {tab === "commands" && (
        <Panel title="Commands from PPMA" sub="Minimal on purpose — RECALL is an event source, not a task runner">
          <div className="command-list">
            {commands.map((command) => {
              const meeting = pack.meetings.find((m) => m.capture_id === command.payload.capture_id);
              return (
                <div className={classNames("command-card", command.status)} key={command.id}>
                  <div className="command-head">
                    <div>
                      <span className="kicker mono">{command.type}</span>
                      <b>{meeting?.title ?? command.payload.capture_id as string}</b>
                    </div>
                    <Status value={command.status} />
                  </div>
                  <p>{command.note}</p>
                  <div className="command-payload">
                    <pre>{JSON.stringify(command.payload, null, 2)}</pre>
                  </div>
                  <div className="row between">
                    <span className="xsmall soft">received {fmtDate(command.received_at)} · target {command.target}</span>
                    {command.status === "pending" && (
                      <div className="row gap6">
                        <button className="btn sm primary" onClick={() => handleCommand(command.id, "apply")}>
                          {command.type === "capture.forget" ? "Forget locally" : "Apply retention"}
                        </button>
                        <button className="btn sm danger" onClick={() => handleCommand(command.id, "reject")}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {commands.length === 0 && <Empty title="No commands" detail="PPMA can ask RECALL to forget or apply retention. Nothing else." icon="terminal" />}
          </div>
        </Panel>
      )}

      {tab === "conformance" && (
        <div className="conformance-grid">
          <Panel
            title="Contract conformance"
            sub={conformanceRun ? `Last run ${fmtDateTime(conformanceRun)}` : "Run against the local PPMA fake"}
            actions={<button className="btn sm primary" onClick={runConformance}><Icon name="play" size={12} /> Run</button>}
          >
            <div className="check-list">
              {pack.ppma.conformance.map((check) => (
                <div className="check-row" key={check.id}>
                  <span className={classNames("check-icon", check.status)}><Icon name={check.status === "pass" ? "check" : "alert"} size={12} /></span>
                  <div><b>{check.label}</b><p>{check.detail}</p></div>
                  <Status value={check.status} />
                </div>
              ))}
            </div>
            <div className="conformance-foot">
              <span><Icon name="flask" size={13} /> Manifest versioning: additive changes only · deprecation window {pack.ppma.manifest.deprecation.window}</span>
              <span>{pack.ppma.manifest.deprecation.migration}</span>
            </div>
          </Panel>

          <aside className="conformance-side">
            <Panel title="Idempotency demo" sub="Replay the same event_id">
              <p className="small muted">Replaying an event that PPMA has already delivered must be rejected. The memory is not duplicated and a tombstone is not undone.</p>
              <button className="btn mt12" onClick={() => replayEvent("evt_seed_kickoff")}><Icon name="refresh" size={13} /> Replay evt_seed_kickoff</button>
              {lastReplay && <p className="xsmall mt8"><b>{lastReplay.result}</b> · {lastReplay.event_id}</p>}
            </Panel>
            <Panel title="Sensitivity flow" sub="Explicit label on every event type">
              <div className="flow-list">
                {["personal", "client_confidential", "financial", "health", "legal"].map((label) => (
                  <div key={label}><Chip tone={label === "personal" ? "neutral" : "violet"}>{label.replace(/_/g, " ")}</Chip><span>{label === "personal" ? "default" : "egress requires policy approval"}</span></div>
                ))}
              </div>
            </Panel>
            <Panel title="Dead-letter" sub="No silent loss">
              <div className="dead-letter">
                <div><span>Depth</span><b>0</b></div>
                <div><span>Oldest</span><b>—</b></div>
                <div><span>Retries</span><b>exponential</b></div>
                <div><span>Ordering</span><b>occurred_at</b></div>
              </div>
            </Panel>
          </aside>
        </div>
      )}

      {tab === "credentials" && (
        <div className="credentials-grid">
          <Panel title="Per-team, per-device credentials" sub="Owner-scoped · rotate on uninstall">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Team</th><th>Device</th><th>Token</th><th>Created</th><th>Rotated</th><th>Status</th></tr></thead>
                <tbody>
                  {pack.ppma.credentials.map((credential) => (
                    <tr key={`${credential.team}-${credential.device}`}>
                      <td>{credential.team}</td>
                      <td>{credential.device}</td>
                      <td className="mono">{credential.token_hint}</td>
                      <td className="mono">{credential.created}</td>
                      <td className="mono">{credential.rotated}</td>
                      <td><Status value={credential.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="xsmall soft mt8">Local loopback by default; no inbound public exposure. Event payloads are signed with the device key.</p>
          </Panel>
          <Panel title="Team isolation" sub="One project memory per team">
            <div className="isolation-list">
              {pack.admin.spaces.map((space) => (
                <div key={space.id}><b>{space.name}</b><span>{space.members} members · {space.visibility} · retention {space.retention}</span><Status value={space.status} /></div>
              ))}
            </div>
            <div className="row gap8 mt12">
              <Chip tone="green">no cross-team reads</Chip>
              <Chip tone="green">per-team backpressure</Chip>
              <Chip tone="green">per-team deletion</Chip>
            </div>
          </Panel>
        </div>
      )}

      <p className="capture-foot"><Icon name="external" size={12} /> Contract: {pack.ppma.manifest.contract} · manifest v{pack.ppma.manifest.version} · events observed {events.length} · queue depth {queue.length}</p>
    </>
  );
}

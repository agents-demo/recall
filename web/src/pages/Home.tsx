import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { fmtDate, fmtDuration, fmtTime, pct, speakerName, statusLabel } from "../lib/format";
import { PageHead, Panel, Stat, Chip, Status, ConsentBadge, SpeakerChip, Meter, DataNote, SourceChip, Empty } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Home() {
  const { pack, activeMeetings, notes, memory, project, queue, events, settings, consentCoverage, attention, feedbackAttention } = useStore();
  const t = useT();
  if (!pack) return null;

  const recent = [...activeMeetings].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  const promises = activeMeetings
    .flatMap((meeting) =>
      meeting.evidence
        .filter((evidence) => evidence.kind === "promise" || evidence.kind === "decision")
        .map((evidence) => ({ meeting, evidence })),
    )
    .slice(0, 4);
  const openActions = activeMeetings.flatMap((meeting) => meeting.actions.filter((action) => action.status !== "done").map((action) => ({ meeting, action })));
  const activeMemory = memory.filter((entry) => entry.state === "active");
  const lastEvent = events[events.length - 1];
  const consentMeetings = activeMeetings.length;

  return (
    <>
      <PageHead
        kicker={t("home.kicker")}
        title={t("home.title")}
        subtitle={t("home.subtitle")}
        actions={
          <>
            <Link className="btn primary" to="/record"><Icon name="record" size={14} /> {t("home.capture")}</Link>
            <Link className="btn" to="/recall"><Icon name="search" size={14} /> {t("home.recall")}</Link>
          </>
        }
      />

      <div className="role-focus">
        <span className="kicker">Your job as {settings.role.replace(/_/g, " ")}</span>
        <div className="role-focus-actions">
          {settings.role === "field" ? (
            <>
              <Link className="btn sm primary" to="/field"><Icon name="pin" size={12} /> Capture a field note</Link>
              <Link className="btn sm" to="/field">Sync offline queue</Link>
            </>
          ) : settings.role === "privacy_legal" ? (
            <>
              <Link className="btn sm primary" to="/attention"><Icon name="shield" size={12} /> Review consent & retention</Link>
              <Link className="btn sm" to="/health">Privacy controls</Link>
            </>
          ) : settings.role === "admin" ? (
            <>
              <Link className="btn sm primary" to="/connectors"><Icon name="link" size={12} /> Connected services</Link>
              <Link className="btn sm" to="/admin">Devices & audit</Link>
            </>
          ) : settings.role === "individual" ? (
            <>
              <Link className="btn sm primary" to="/record"><Icon name="record" size={12} /> Capture a meeting</Link>
              <Link className="btn sm" to="/recall">Ask the evidence</Link>
            </>
          ) : (
            <>
              <Link className="btn sm primary" to="/attention"><Icon name="alert" size={12} /> {attention.length} attention items</Link>
              <Link className="btn sm" to="/pilot">Pilot metrics</Link>
              <Link className="btn sm" to="/connectors">Connections</Link>
            </>
          )}
        </div>
      </div>

      <DataNote seed={pack.meta.seed} />

      {attention.length > 0 && (
        <section className="attention-strip" aria-label="Attention">
          <div className="attention-strip-head">
            <div>
              <span className="kicker">Attention · bounded proactivity</span>
              <b>{attention.length} thing{attention.length === 1 ? "" : "s"} need a human</b>
            </div>
            <Link className="btn sm" to="/attention">Open all <Icon name="arrow" size={12} /></Link>
          </div>
          <div className="attention-strip-list">
            {attention.slice(0, settings.attentionBudget).map((item) => (
              <article className={`attention-mini sev-${item.severity}`} key={item.id}>
                <div className="row between">
                  <Chip tone={item.severity === "critical" || item.severity === "high" ? "red" : "amber"}>{item.severity}</Chip>
                  <span className="mono xsmall soft">{Math.round(item.score)}</span>
                </div>
                <Link to={item.route}><b>{item.title}</b></Link>
                <p>{item.detail}</p>
                <div className="attention-mini-actions">
                  <Link className="btn sm ghost" to={item.route}>{item.action_label} <Icon name="arrow" size={11} /></Link>
                  <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "accepted")} title="Mark useful and dismiss">Useful</button>
                  <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "snoozed")} title="Snooze for 24 hours">Snooze</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="home-hero">
        <section className="cold-open">
          <div className="cold-open-top">
            <span className="kicker">Cold open · a meeting three weeks ago</span>
            <Chip tone="cyan" dot="live">Offline</Chip>
          </div>
          <blockquote>“What did we promise them?”</blockquote>
          <p className="cold-sub">The room goes quiet. It was in a call three weeks ago. The detail is gone — unless someone captured it.</p>
          <div className="cold-search">
            <Icon name="search" size={17} />
            <Link to="/recall?q=delivery">
              <span>Search the evidence for</span>
              <b>“delivery”</b>
            </Link>
            <kbd>↵</kbd>
          </div>
          <div className="cold-links">
            <Link className="btn primary lg" to="/stage"><Icon name="play" size={14} /> Open the 90-second piece</Link>
            <Link className="btn lg" to="/booth"><Icon name="flask" size={14} /> Booth demo</Link>
            <span className="xsmall soft">No network. Fixed seed. Reset under five seconds.</span>
          </div>
          <div className="cold-quote">
            <span className="redaction-line" />
            <p><b>Anna Voss</b> <span className="mono">11:24</span> · “We can hold the 14th, but not the 12th.”</p>
            <span className="chip chip-amber">One click away</span>
          </div>
        </section>

        <aside className="home-status">
          <div className="status-card">
            <div className="status-card-head">
              <span className="kicker">PPMA north app</span>
              <Status value={settings.ppmaOnline ? "active" : "queued"} tone={settings.ppmaOnline ? "green" : "amber"}>
                {settings.ppmaOnline ? "Connected" : "Offline · queued"}
              </Status>
            </div>
            <div className="status-project">
              <span className="xsmall soft">Project memory</span>
              <b>{pack.ppma.project.name}</b>
              <p>{project.state || pack.ppma.project.state_before}</p>
            </div>
            <div className="status-grid">
              <div><span>Queue</span><b>{queue.length}</b></div>
              <div><span>Last event</span><b className="mono">{lastEvent ? lastEvent.type.replace("capture.", "") : "—"}</b></div>
              <div><span>Memory</span><b>{activeMemory.length}</b></div>
              <div><span>Seats</span><b>{pack.team.seats}</b></div>
            </div>
            {project.followup ? (
              <div className="followup">
                <div className="kicker">Drafted by PPMA · human approval required</div>
                <p>{project.followup}</p>
              </div>
            ) : (
              <div className="status-pending">
                <Icon name="clock" size={15} />
                <span>The delivery call is captured but not yet handed to PPMA.</span>
                <Link to={`/meetings/${pack.meta.stage_meeting_id}`}>Review the handoff</Link>
              </div>
            )}
            <div className="row gap8 mt12">
              <Link className="btn sm" to="/ppma"><Icon name="send" size={12} /> Integration</Link>
              <Link className="btn sm ghost" to="/pilot"><Icon name="chart" size={12} /> Pilot</Link>
            </div>
          </div>

          <div className="consent-card">
            <div className="row between">
              <span className="kicker">Consent coverage</span>
              <b className="mono">{pct(consentCoverage)}</b>
            </div>
            <Meter value={consentCoverage} tone="green" valueLabel={`${consentMeetings} of ${consentMeetings} captures`} />
            <p className="xsmall soft mt8">Consent is recorded before capture, per jurisdiction. No consent, no event.</p>
            <div className="consent-tags">
              <Chip tone="green" dot="live">{pack.team.jurisdiction} · {pack.team.consent_model.replace(/_/g, " ")}</Chip>
              <Chip>Two-party wording v{pack.admin.jurisdictions[0]?.wording}</Chip>
            </div>
          </div>
        </aside>
      </div>

      <div className="stats-row">
        <Stat label="Capture → PPMA" value={`${pack.pilot.capture_to_ppma_s}s`} note="Pilot median · target under 30 s" tone="green" icon="send" />
        <Stat label="Quote retrieval" value={`${pack.pilot.quote_seconds}s`} note="Every quote in under 10 s is the next gate" tone="amber" icon="quote" />
        <Stat label="Useful extraction" value={pct(pack.pilot.useful_rate)} note="Decisions, promises and actions judged useful" tone="green" icon="spark" />
        <Stat label="Raw media uploaded" value="0" note="Audio and video stay on the device" tone="green" icon="lock" />
        <Stat label="Open actions" value={openActions.length} note="PPMA owns the follow-up" tone="amber" icon="list" />
      </div>

      <div className="home-grid">
        <Panel
          className="recent-panel"
          title={t("home.recent")}
          sub={`${activeMeetings.length} captures · ${notes.length} field notes`}
          actions={<Link className="btn sm ghost" to="/meetings">All meetings <Icon name="arrow" size={12} /></Link>}
        >
          <div className="capture-list">
            {recent.map((meeting) => {
              const redactions = meeting.redactions.filter((r) => r.status === "applied").length;
              return (
                <Link key={meeting.id} className="capture-row" to={`/meetings/${meeting.id}`}>
                  <span className={`capture-mark sp-${meeting.participants[0]?.color ?? "amber"}`}><Icon name={meeting.mode === "call" ? "headphones" : meeting.mode === "import" ? "download" : "wave"} size={15} /></span>
                  <span className="capture-main">
                    <b>{meeting.title}</b>
                    <small>
                      {fmtDate(meeting.started_at, settings.lang)} · {fmtDuration(meeting.duration_s)} · {meeting.participants.length} speakers
                      {redactions > 0 && ` · ${redactions} redaction${redactions === 1 ? "" : "s"}`}
                    </small>
                  </span>
                  <span className="capture-people">
                    {meeting.participants.slice(0, 3).map((person) => (
                      <i key={person.id} className={`mini-avatar sp-${person.color}`} title={person.name}>{person.initials}</i>
                    ))}
                  </span>
                  <span className="capture-status">
                    <ConsentBadge state={meeting.consent.state} />
                    <Status value={meeting.status} />
                  </span>
                  <Icon name="chevron" size={14} />
                </Link>
              );
            })}
          </div>
          <div className="recent-foot">
            <span><Icon name="harddrive" size={13} /> {pack.team.devices.filter((d) => d.status === "active").length} active devices · AES-256-GCM at rest</span>
            <Link to="/record"><Icon name="plus" size={13} /> New capture</Link>
          </div>
        </Panel>

        <Panel title={t("home.promises")} sub="Every commitment keeps its quote">
          <div className="promise-list">
            {promises.map(({ meeting, evidence }) => (
              <Link key={`${meeting.id}-${evidence.id}`} className="promise-card" to={`/meetings/${meeting.id}?t=${Math.floor(evidence.start)}&e=${evidence.id}`}>
                <div className="promise-top">
                  <Chip tone={evidence.kind === "promise" ? "amber" : "cyan"}>{evidence.kind}</Chip>
                  <span className="mono xsmall">{fmtTime(evidence.start)}</span>
                </div>
                <p>“{evidence.quote}”</p>
                <div className="promise-meta">
                  <span>{speakerName(meeting, evidence.speaker_id)} · {meeting.title}</span>
                  <span className="mono">{pct(evidence.confidence)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title={t("home.ppma")} sub="Read-only context from the project" actions={<Link className="btn sm ghost" to="/ppma">Open PPMA <Icon name="external" size={12} /></Link>}>
          <div className="memory-list">
            {activeMemory.slice(0, 5).map((entry) => (
              <div className="memory-row" key={entry.id}>
                <div className="memory-top">
                  <span className="memory-kind">{entry.type}</span>
                  <SourceChip />
                  <span className="mono xsmall soft">{pct(entry.confidence)}</span>
                </div>
                <p>{entry.text}</p>
                <div className="memory-meta">
                  <Chip tone={entry.sensitivity === "personal" ? "neutral" : "violet"}>{entry.sensitivity.replace(/_/g, " ")}</Chip>
                  {entry.corrected && <Chip tone="green">corrected · {entry.corrected}</Chip>}
                  {entry.redacted && <Chip tone="red">redacted</Chip>}
                  {entry.state !== "active" && <Status value={entry.state} />}
                </div>
              </div>
            ))}
            {activeMemory.length === 0 && <Empty title="No memory yet" detail="Send a capture to PPMA to create the first derived facts." />}
          </div>
          <div className="memory-foot">
            <Icon name="shield" size={13} />
            <span>PPMA proposes the next action. RECALL never creates tasks, schedules or messages.</span>
          </div>
        </Panel>

        <Panel title="Open actions" sub="Owned by PPMA, with a link to the evidence">
          <div className="action-list">
            {openActions.slice(0, 5).map(({ meeting, action }) => (
              <Link key={`${meeting.id}-${action.id}`} className="action-row" to={`/meetings/${meeting.id}?t=${Math.floor(meeting.evidence.find((e) => e.id === action.evidence_id)?.start ?? 0)}&e=${action.evidence_id}`}>
                <span className="action-check" />
                <span>
                  <b>{action.text}</b>
                  <small>{action.owner} · due {action.due} · {meeting.title}</small>
                </span>
                <span className="mono xsmall">{pct(action.confidence)}</span>
              </Link>
            ))}
          </div>
          <div className="boundary-note">
            <b>Boundary:</b> RECALL captures and proves. PPMA decides and acts. The follow-up is drafted there, approved by a human, and only then sent.
          </div>
        </Panel>
      </div>

      <div className="boundary-strip">
        {[
          ["RECALL owns", ["Capture audio/video/notes", "Transcribe, diarize, summarize", "Consent, redaction, retention", "Evidence pack for a quote"]],
          ["PPMA owns", ["Living project memory and state", "Tasks, calendar, email, missions", "Proactive action", "What should happen next"]],
        ].map(([heading, items]) => (
          <div className="boundary-col" key={heading as string}>
            <span className="kicker">{heading as string}</span>
            <ul>{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        ))}
      </div>
    </>
  );
}

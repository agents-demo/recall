import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { attentionKindLabel } from "../lib/attention";
import type { AttentionKind } from "../types";
import { classNames, fmtDate } from "../lib/engine";
import { PageHead, Panel, Stat, Chip, Status, DataNote, Empty, Meter } from "../components/UI";
import { Icon } from "../components/Icon";

const severityTone: Record<string, string> = { critical: "red", high: "amber", warning: "amber", info: "neutral" };

export default function Attention() {
  const { pack, attention, attentionMetrics, attentionFeedback, feedbackAttention, activeMeetings } = useStore();
  const t = useT();
  const [kind, setKind] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [meetingFilter, setMeetingFilter] = useState("all");
  if (!pack) return null;

  const kinds = useMemo(() => [...new Set(attention.map((item) => item.kind))], [attention]);
  const filtered = attention.filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      (severity === "all" || item.severity === severity) &&
      (meetingFilter === "all" || item.meeting_id === meetingFilter),
  );
  const high = attention.filter((item) => item.severity === "high" || item.severity === "critical").length;
  const dues = attention.filter((item) => item.kind === "promise_due").length;
  const meeting = (id?: string) => activeMeetings.find((item) => item.id === id);

  return (
    <>
      <PageHead
        kicker="Bounded proactivity · notice, prepare, propose"
        title="Attention"
        subtitle="RECALL notices what matters and prepares the next step. It never creates a task, sends a message or changes PPMA state."
        actions={
          <>
            <Chip tone="green" dot="live">evidence-linked</Chip>
            <button className="btn" onClick={() => window.print()}><Icon name="file" size={14} /> Print digest</button>
          </>
        }
      />
      <DataNote seed={pack.meta.seed} note="Attention items are derived locally from the pack, your corrections, consent state, retention and the delivery queue. They are not notifications from a server, and nothing is sent." />

      <div className="stats-row">
        <Stat label="Open attention" value={attention.length} note="Every item links to evidence" tone={attention.length ? "amber" : "green"} icon="alert" />
        <Stat label="High / critical" value={high} note="Needs a human now" tone={high ? "red" : "green"} icon="activity" />
        <Stat label="Promises due" value={dues} note="Within the next seven days" tone="amber" icon="clock" />
        <Stat label="Acceptance" value={`${Math.round(attentionMetrics.acceptance * 100)}%`} note={`${attentionMetrics.accepted} accepted · ${attentionMetrics.dismissed} dismissed`} tone="green" icon="check" />
        <Stat label="Wrong / ignored" value={attentionMetrics.wrong + attentionMetrics.dismissed} note={`${attentionMetrics.wrong} marked wrong`} tone="neutral" icon="eyeOff" />
      </div>

      <div className="attention-layout">
        <div className="attention-main">
          <Panel title="Team digest" sub="What the team lead should see first" actions={<Chip tone="amber">generated locally</Chip>}>
            <div className="digest">
              <div className="digest-lead">
                <span className="kicker">{fmtDate(pack.meta.anchor)} · Northgate project team</span>
                <h2>{attention.length ? `${high} thing${high === 1 ? "" : "s"} need a human today.` : "Nothing needs a human right now."}</h2>
                <p>
                  {attention.length
                    ? attention.slice(0, 3).map((item) => item.title).join(" · ")
                    : "Capture is current, consent is covered, and the queue is empty. The next nudge will appear only when evidence supports it."}
                </p>
              </div>
              <div className="digest-items">
                {attention.slice(0, 3).map((item) => (
                  <Link key={item.id} to={item.route} className="digest-item">
                    <Chip tone={severityTone[item.severity]}>{item.severity}</Chip>
                    <span><b>{item.title}</b><small>{item.detail}</small></span>
                    <Icon name="arrow" size={13} />
                  </Link>
                ))}
              </div>
            </div>
            <div className="digest-foot">
              <span><Icon name="shield" size={12} /> No message was sent. The digest is a local view.</span>
              <span className="mono xsmall">{attentionMetrics.accepted} accepted · {attentionMetrics.snoozed} snoozed · {attentionMetrics.wrong} wrong</span>
            </div>
          </Panel>

          <div className="filter-bar">
            <label className="filter-search">
              <Icon name="search" size={15} />
              <input value="" readOnly placeholder="Attention is already ranked by urgency, evidence and role…" />
            </label>
            <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Filter attention kind">
              <option value="all">All kinds</option>
              {kinds.map((item) => <option key={item} value={item}>{attentionKindLabel(item as AttentionKind)}</option>)}
            </select>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter severity">
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select value={meetingFilter} onChange={(event) => setMeetingFilter(event.target.value)} aria-label="Filter meeting">
              <option value="all">All captures</option>
              {activeMeetings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <span className="filter-count">{filtered.length} of {attention.length}</span>
          </div>

          <div className="attention-list">
            {filtered.map((item) => {
              const related = meeting(item.meeting_id);
              return (
                <article className={classNames("attention-card", `sev-${item.severity}`)} key={item.id}>
                  <div className="attention-head">
                    <div className="attention-title">
                      <Chip tone={severityTone[item.severity]}>{item.severity}</Chip>
                      <Chip>{attentionKindLabel(item.kind)}</Chip>
                      {item.due && <span className="mono xsmall soft">due {fmtDate(item.due)}</span>}
                      <h2>{item.title}</h2>
                    </div>
                    <div className="attention-score">
                      <span className="mono">{Math.round(item.score)}</span>
                      <small>score</small>
                    </div>
                  </div>
                  <p className="attention-detail">{item.detail}</p>
                  <div className="attention-why">
                    <Icon name="eye" size={12} />
                    <span>{item.why}</span>
                  </div>
                  <div className="attention-meta">
                    {related && <span><Icon name="layers" size={11} /> {related.title}</span>}
                    {item.evidence_id && <span className="mono"><Icon name="quote" size={11} /> {item.evidence_id}</span>}
                    <span className="mono">{Math.round(item.confidence * 100)}% confidence</span>
                  </div>
                  <div className="attention-actions">
                    <Link className="btn sm primary" to={item.route}>{item.action_label} <Icon name="arrow" size={12} /></Link>
                    <button className="btn sm" onClick={() => feedbackAttention(item.id, "accepted")}><Icon name="check" size={12} /> Useful</button>
                    <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "snoozed")}><Icon name="clock" size={12} /> Snooze 24h</button>
                    <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "dismissed")}>Dismiss</button>
                    <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "wrong")}><Icon name="x" size={11} /> This is wrong</button>
                  </div>
                </article>
              );
            })}
            {filtered.length === 0 && <Empty title="Nothing needs attention" detail="Consent, delivery and promises are clear for this filter. The next nudge will be evidence-linked." icon="check" />}
          </div>
        </div>

        <aside className="attention-side">
          <Panel title="How this works" sub="The boundary, in the interface">
            <ul className="plain-list">
              <li><Icon name="check" size={12} /> Every nudge cites a quote, a due date or a consent state.</li>
              <li><Icon name="check" size={12} /> One decision per card; no stacked actions.</li>
              <li><Icon name="check" size={12} /> Snooze, dismiss and “this is wrong” are always available.</li>
              <li><Icon name="x" size={12} /> No task, message, calendar event or project-state change.</li>
              <li><Icon name="x" size={12} /> No notification leaves this browser.</li>
            </ul>
          </Panel>

          <Panel title="Feedback quality" sub="Calibration, not a vanity metric">
            <Meter value={attentionMetrics.acceptance} label="Acceptance" valueLabel={`${Math.round(attentionMetrics.acceptance * 100)}%`} tone="green" />
            <div className="attention-quality">
              <div><span>Accepted</span><b>{attentionMetrics.accepted}</b></div>
              <div><span>Dismissed</span><b>{attentionMetrics.dismissed}</b></div>
              <div><span>Wrong</span><b>{attentionMetrics.wrong}</b></div>
              <div><span>Snoozed</span><b>{attentionMetrics.snoozed}</b></div>
            </div>
            <p className="xsmall soft mt8">A nudge that is ignored is a product bug, not a user failure. Suppressed items stay suppressed in this browser.</p>
          </Panel>

          <Panel title="Role view" sub="Who sees what">
            <div className="role-attention">
              {pack.admin.roles.map((role) => (
                <div key={role.role}>
                  <b>{role.role.replace(/_/g, " ")}</b>
                  <span>{role.role === "team_lead" ? "Digest, promises due, handoffs" : role.role === "privacy_legal" ? "Consent gaps, retention, redaction" : role.role === "field" ? "Field notes, device health, offline queue" : role.role === "admin" ? "Devices, kill switch, delivery health" : "Own captures, own corrections"}</span>
                </div>
              ))}
            </div>
            <p className="xsmall soft">The client guest never sees the internal digest. The demo shows all roles in the role selector.</p>
          </Panel>

          <Panel title="Recent suppression" sub="Feedback is kept, not hidden">
            <div className="suppression-list">
              {Object.entries(attentionFeedback).slice(0, 6).map(([id, value]) => (
                <div key={id}><span className="mono">{id.split(":")[0]}</span><Chip tone="neutral">{value.state}</Chip></div>
              ))}
              {Object.keys(attentionFeedback).length === 0 && <Empty title="No feedback yet" detail="Accept, snooze or challenge a nudge to calibrate it." icon="eye" />}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

import { Link, useParams } from "react-router-dom";
import { decodeShareLink, shareStatus } from "../lib/share";
import { fmtTime, pct } from "../lib/engine";
import { Chip, SourceChip, Confidence } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Share() {
  const { token = "" } = useParams();
  const payload = decodeShareLink(token);
  if (!payload) {
    return (
      <div className="share-page">
        <div className="share-card invalid">
          <Icon name="alert" size={22} />
          <h1>This evidence link is not readable.</h1>
          <p>The link may be incomplete or from a different build. Ask the sender for a new safe pack.</p>
          <Link className="btn primary" to="/">Open RECALL</Link>
        </div>
      </div>
    );
  }
  const status = shareStatus(payload);
  return (
    <div className="share-page">
      <div className="share-card">
        <div className="share-head">
          <div className="brand"><span className="brand-mark"><i /><i /><i /><i /><i /></span><span className="brand-copy"><b>RECALL</b><small>safe evidence · read-only</small></span></div>
          <Chip tone={status.expired ? "red" : "green"} dot={status.expired ? "bad" : "live"}>{status.expired ? "expired" : `expires in ${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"}`}</Chip>
        </div>
        <span className="kicker">{payload.meeting_title} · {fmtTime(payload.start)}–{fmtTime(payload.end)}</span>
        <blockquote>“{payload.quote}”</blockquote>
        <div className="share-meta">
          <span><b>{payload.speaker}</b> speaker</span>
          <span><b>{fmtTime(payload.start)}</b> timestamp</span>
          <span><b>{pct(payload.confidence)}</b> confidence</span>
          <SourceChip />
        </div>
        <div className="share-trust">
          <div><span>Device</span><b>{payload.provenance.device}</b></div>
          <div><span>Model</span><b>{payload.provenance.model}</b></div>
          <div><span>Consent</span><b>{payload.provenance.consent} · {payload.provenance.jurisdiction}</b></div>
          <div><span>Redactions</span><b>{payload.redactions.length ? payload.redactions.join(" · ") : "none"}</b></div>
          <div><span>Raw media</span><b>not included</b></div>
          <div><span>Created</span><b>{payload.created_at.slice(0, 10)}</b></div>
        </div>
        <div className="share-actions">
          <Link className="btn primary" to={`/meetings/${payload.meeting_id}?t=${Math.floor(payload.start)}&e=${payload.evidence_id}`}>Open in RECALL <Icon name="arrow" size={13} /></Link>
          <Link className="btn ghost" to="/">RECALL home</Link>
          <span className="xsmall soft"><Icon name="lock" size={11} /> The link contains only the safe quote and provenance. No audio.</span>
        </div>
      </div>
    </div>
  );
}

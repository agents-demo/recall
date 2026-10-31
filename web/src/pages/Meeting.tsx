import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import {
  classNames,
  downloadText,
  evidencePackFor,
  fmtDate,
  fmtDuration,
  fmtTime,
  meetingPayload,
  safeQuote,
  speakerName,
  utteranceText,
} from "../lib/engine";
import type { Evidence, Meeting as MeetingType } from "../types";
import { createShareLink } from "../lib/share";
import {
  Chip,
  Confidence,
  ConsentBadge,
  CopyButton,
  DataNote,
  Empty,
  Meter,
  Modal,
  Panel,
  ProvenanceList,
  SourceChip,
  SpeakerChip,
  Status,
  Waveform,
} from "../components/UI";
import { Icon } from "../components/Icon";

type Tab = "transcript" | "intelligence" | "extracted" | "ppma" | "comments" | "rights";

export default function Meeting() {
  const { meetingId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const store = useStore();
  const t = useT();
  const {
    pack,
    meetingById,
    events,
    memory,
    project,
    audit,
    settings,
    sendMeeting,
    correctSpeaker,
    correctText,
    correctItem,
    redact,
    unredact,
    deleteMeeting,
    setRetention,
    toggleLegalHold,
    withdrawConsent,
    resetMeeting,
    attentionForMeeting,
    feedbackAttention,
    collabPeers,
    comments,
    addComment,
    resolveComment,
    corrections,
    analysisFor,
    analyzeMeeting,
    approveAnalysis,
    isAnalysisApproved,
    analysisRunning,
    decisionRecordFor,
    say,
  } = store;

  const meeting = meetingById(meetingId);
  const [tab, setTab] = useState<Tab>("transcript");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(Number(params.get("t") ?? 0) || 0);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("e"));
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editItem, setEditItem] = useState<string | null>(null);
  const [editItemText, setEditItemText] = useState("");
  const [redactOpen, setRedactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("user_request");
  const [redactReason, setRedactReason] = useState("client_confidential");
  const [retentionDate, setRetentionDate] = useState("");
  const [consentReason, setConsentReason] = useState("participant_request");
  const [sendPreviewOpen, setSendPreviewOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentTarget, setCommentTarget] = useState<"meeting" | "evidence">("meeting");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => meeting?.evidence.find((e) => e.id === selectedId) ?? meeting?.evidence[0],
    [meeting, selectedId],
  );
  const paramEvent = params.get("e");
  const paramTime = params.get("t");

  useEffect(() => {
    if (!meeting) return;
    const requestedTab = params.get("tab");
    if (requestedTab && ["transcript", "intelligence", "extracted", "ppma", "comments", "rights"].includes(requestedTab)) {
      setTab(requestedTab as Tab);
    } else {
      setTab("transcript");
    }
    if (paramEvent) setSelectedId(paramEvent);
    setProgress(Number(paramTime ?? 0) || 0);
    setRetentionDate(meeting.retention.retain_until.slice(0, 10));
    // A deep link (from search, attention or PPMA) must select the exact row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, paramEvent, paramTime, params.get("tab")]);

  useEffect(() => {
    if (!playing || !meeting) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= meeting.duration_s) {
          setPlaying(false);
          return meeting.duration_s;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, meeting]);

  useEffect(() => {
    if (tab !== "transcript" || !selected?.utterance_id) return;
    const element = document.getElementById(`row-${selected.utterance_id}`);
    const container = document.querySelector<HTMLElement>(".transcript");
    if (!element || !container) return;
    const rowRect = element.getBoundingClientRect();
    const boxRect = container.getBoundingClientRect();
    if (rowRect.top < boxRect.top + 24 || rowRect.bottom > boxRect.bottom - 24) {
      container.scrollTo({
        top: container.scrollTop + (rowRect.top - boxRect.top) - container.clientHeight / 2,
        behavior: settings.reducedMotion ? "auto" : "smooth",
      });
    }
  }, [selected?.utterance_id, tab, settings.reducedMotion]);

  if (!meeting || !pack) {
    return (
      <div className="not-found">
        <div className="kicker">Missing capture</div>
        <h1>That meeting is not in this device.</h1>
        <Link className="btn primary" to="/meetings">Back to meetings</Link>
      </div>
    );
  }

  const meetingEvents = events.filter((event) => event.payload.capture_id === meeting.capture_id);
  const meetingMemory = memory.filter((entry) => entry.capture_id === meeting.capture_id);
  const meetingAudit = audit.filter((entry) => entry.object === meeting.capture_id || entry.detail.includes(meeting.capture_id));
  const appliedRedactions = meeting.redactions.filter((r) => r.status === "applied");
  const analysis = analysisFor(meeting.id);
  const approved = isAnalysisApproved(meeting.id);
  const decisionRecord = decisionRecordFor(meeting.id);
  const quoteFor = (utteranceId: string) => meeting.utterances.find((row) => row.id === utteranceId);

  if (meeting.status === "tombstoned") {
    return (
      <>
        <div className="tombstone-hero">
          <div className="kicker">Tombstone · deletion is provable</div>
          <h1>{meeting.title}</h1>
          <p>The transcript, evidence and derived memory were deleted. A tombstone remains so PPMA and the audit trail cannot resurrect it from a replay.</p>
          <div className="tombstone-facts">
            <span><b>Reason</b>{meeting.deleted_reason?.replace(/_/g, " ")}</span>
            <span><b>Deleted</b>{fmtDate(meeting.deleted_at ?? meeting.ended_at, settings.lang)}</span>
            <span><b>Tombstone</b><code className="mono">{meeting.tombstone_id}</code></span>
            <span><b>Scope</b>transcript + evidence</span>
          </div>
          <div className="row gap8 mt16">
            <button className="btn primary" onClick={() => resetMeeting(meeting.id)}><Icon name="refresh" size={14} /> Restore for demo</button>
            <Link className="btn" to="/meetings">All meetings</Link>
            <button className="btn" onClick={() => downloadText(`recall-tombstone-${meeting.id}.json`, JSON.stringify({ tombstone_id: meeting.tombstone_id, capture_id: meeting.capture_id, title: meeting.title, reason: meeting.deleted_reason, deleted_at: meeting.deleted_at, scope: "transcript+evidence", audit: meetingAudit }, null, 2), "application/json")}><Icon name="download" size={13} /> Deletion receipt</button>
            <Link className="btn ghost" to="/ppma">PPMA event log</Link>
          </div>
        </div>
        <Panel title="Deletion audit" sub="The record of the deletion outlives the content">
          <div className="event-list">
            {meetingEvents.map((event) => (
              <div className="event-row" key={event.event_id}>
                <span className="mono">{event.type}</span>
                <span className="mono xsmall soft">{event.event_id}</span>
                <Status value={event.delivery.status} />
              </div>
            ))}
          </div>
        </Panel>
      </>
    );
  }

  const evPack = selected ? evidencePackFor(meeting, selected.id) : null;
  const currentRow = [...meeting.utterances].reverse().find((row) => row.start <= progress);
  const averageConfidence =
    meeting.evidence.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, meeting.evidence.length);
  const meetingAttention = attentionForMeeting(meeting.id);
  const meetingComments = comments.filter((comment) => comment.meeting_id === meeting.id);

  const seek = (seconds: number) => {
    setProgress(Math.max(0, Math.min(meeting.duration_s, seconds)));
    setPlaying(false);
  };

  const chooseEvidence = (evidence: Evidence) => {
    setSelectedId(evidence.id);
    setProgress(evidence.start);
    setTab("transcript");
  };

  const saveRow = (rowId: string) => {
    if (editText.trim()) correctText(meeting.id, rowId, editText.trim());
    setEditRow(null);
  };

  const saveItem = (itemId: string) => {
    if (editItemText.trim()) correctItem(meeting.id, itemId, editItemText.trim());
    setEditItem(null);
  };

  const doDelete = () => {
    const ok = deleteMeeting(meeting.id, deleteReason);
    if (ok) {
      setDeleteOpen(false);
      navigate("/meetings");
    }
  };

  return (
    <>
      <div className="meeting-head">
        <div className="meeting-head-left">
          <Link className="back-link" to="/meetings"><Icon name="chevron" size={13} /> All meetings</Link>
          <div className="kicker">{fmtDate(meeting.started_at, settings.lang)} · {meeting.mode} · {meeting.capture_id}</div>
          <h1>{meeting.title}</h1>
          <div className="meeting-meta">
            <ConsentBadge state={meeting.consent.state} />
            <Status value={meeting.status} />
            <Chip tone="violet">{meeting.sensitivity.replace(/_/g, " ")}</Chip>
            <Chip>{fmtDuration(meeting.duration_s)}</Chip>
            <Chip>{meeting.participants.length} speakers</Chip>
            <Chip>{meeting.language.toUpperCase()}</Chip>
            {appliedRedactions.length > 0 && <Chip tone="green">{appliedRedactions.length} redacted</Chip>}
            {collabPeers.length > 0 && <Chip tone="cyan" dot="live">{collabPeers.length + 1} editing</Chip>}
            {meeting.import && <Chip tone="amber">imported</Chip>}
          </div>
        </div>
        <div className="meeting-head-actions">
          <button className="btn primary" onClick={() => setSendPreviewOpen(true)} disabled={meeting.consent.state !== "granted" || meeting.ppma.status === "sent" || meeting.ppma.status === "queued"}>
            <Icon name="send" size={14} /> {meeting.ppma.status === "sent" ? "Sent to PPMA" : meeting.ppma.status === "queued" ? "Queued for PPMA" : t("common.send")}
          </button>
          <button className="btn" onClick={() => setPackOpen(true)} disabled={!evPack}>
            <Icon name="file" size={14} /> Evidence pack
          </button>
          <button className="btn ghost" onClick={() => setRetentionOpen(true)}><Icon name="clock" size={14} /> Retention</button>
        </div>
      </div>

      {meetingAttention.length > 0 && (
        <div className="meeting-nudges" aria-label="Attention for this capture">
          {meetingAttention.slice(0, 2).map((item) => (
            <div className={`meeting-nudge sev-${item.severity}`} key={item.id}>
              <Icon name={item.kind === "promise_due" ? "clock" : item.kind === "redaction_review" ? "scissors" : "alert"} size={14} />
              <div><b>{item.title}</b><span>{item.why}</span></div>
              <Link className="btn sm" to={item.route}>{item.action_label}</Link>
              <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "accepted")}>Useful</button>
              <button className="btn sm ghost" onClick={() => feedbackAttention(item.id, "snoozed")}>Snooze</button>
            </div>
          ))}
        </div>
      )}

      <div className="meeting-stats">
        <div><span>Text confidence</span><b>{Math.round(averageConfidence * 100)}%</b></div>
        <div><span>Evidence items</span><b>{meeting.evidence.length}</b></div>
        <div><span>Decisions</span><b>{meeting.decisions.length}</b></div>
        <div><span>Actions</span><b>{meeting.actions.length}</b></div>
        <div><span>Questions</span><b>{meeting.questions.length}</b></div>
        <div><span>Device</span><b className="small">{meeting.provenance.device}</b></div>
        <div><span>PPMA</span><b>{meeting.ppma.status}</b></div>
      </div>

      <div className="player">
        <button className="play-btn" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause" : "Play"}>
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <span className="player-time mono">{fmtTime(progress)}</span>
        <Waveform
          duration={meeting.duration_s}
          progress={progress}
          seed={meeting.capture_id}
          redactions={meeting.redactions
            .filter((r) => r.status === "applied")
            .map((r) => {
              const row = meeting.utterances.find((u) => u.id === r.utterance_id);
              return { start: row?.start ?? 0, end: row?.end ?? 0 };
            })}
          onSeek={seek}
        />
        <span className="player-time mono">{fmtTime(meeting.duration_s)}</span>
        <span className="player-now">
          <b>{currentRow ? speakerName(meeting, currentRow.speaker_id) : "—"}</b>
          <small>{currentRow ? currentRow.text.slice(0, 42) + (currentRow.text.length > 42 ? "…" : "") : "Start playback"}</small>
        </span>
        <span className="player-local"><Icon name="lock" size={12} /> local</span>
      </div>

      <div className="tabs">
        {([
          ["transcript", "Transcript", "wave"],
          ["intelligence", "Intelligence", "spark"],
          ["extracted", "Extracted facts", "spark"],
          ["ppma", "PPMA", "send"],
          ["comments", `Comments${meetingComments.length ? ` (${meetingComments.length})` : ""}`, "list"],
          ["rights", "Consent & rights", "shield"],
        ] as [Tab, string, string][]).map(([id, label, icon]) => (
          <button key={id} className={classNames("tab", tab === id && "active")} onClick={() => setTab(id)}>
            <Icon name={icon} size={14} /> {label}
            {id === "ppma" && meeting.ppma.status !== "sent" && <i className="tab-dot" />}
          </button>
        ))}
      </div>

      {tab === "intelligence" && (
        <div className="workspace">
          <Panel
            className="span-2"
            title={analysis ? "What the agent found" : "Understand this capture"}
            sub={analysis ? `Derived from ${analysis.trace.transcript_lines} transcript lines · every finding links to a quote` : "Raw transcript in · evidence-linked facts out"}
            actions={<Chip tone={analysis ? "green" : "amber"} dot={analysis ? "live" : "warn"}>{analysis ? "analysed" : "not analysed"}</Chip>}
          >
            {!analysis ? (
              <div className="analysis-empty">
                <p className="small muted">
                  This capture is a raw transcript. Nothing below is pre-filled. The agent reads the transcript and
                  extracts decisions, actions, risks, gaps and open questions — each one linked to the exact line it
                  came from.
                </p>
                <div className="row gap8 mt12">
                  <button className="btn primary" onClick={() => void analyzeMeeting(meeting.id)} disabled={analysisRunning === meeting.id}>
                    <Icon name="spark" size={14} /> {analysisRunning === meeting.id ? "Reading the transcript…" : "Analyze this capture"}
                  </button>
                  <Chip tone="violet">local analysis runtime</Chip>
                </div>
                <p className="xsmall soft mt8">
                  The transcript is sent to the configured model endpoint for analysis. No raw media is attached.
                  The findings are proposals until a human approves them.
                </p>
              </div>
            ) : (
              <>
                <div className="analysis-summary">
                  <b>{analysis.summary}</b>
                  <div className="analysis-trace">
                    <Chip tone="violet">{analysis.trace.model}</Chip>
                    <Chip>{Math.round(analysis.trace.latency_ms / 100) / 10}s</Chip>
                    <Chip>{analysis.trace.transcript_lines} lines</Chip>
                    <Chip tone={approved ? "green" : "amber"}>{approved ? "approved by human" : "awaiting human approval"}</Chip>
                  </div>
                </div>

                <div className="analysis-grid">
                  <section className="analysis-card">
                    <h3>Decisions <span>{analysis.decisions.length}</span></h3>
                    {analysis.decisions.length === 0 && <p className="soft xsmall">No decision found in the transcript.</p>}
                    {analysis.decisions.map((item, index) => {
                      const line = quoteFor(item.evidence_id);
                      return (
                        <div className="analysis-item" key={`d-${index}`}>
                          <b>{item.text}</b>
                          {line && <span className="analysis-quote">“{line.text}” — {speakerName(meeting, line.speaker_id)}, {fmtTime(line.start)}</span>}
                          <Chip tone="green">{Math.round(item.confidence * 100)}%</Chip>
                        </div>
                      );
                    })}
                  </section>

                  <section className="analysis-card">
                    <h3>Actions <span>{analysis.actions.length}</span></h3>
                    {analysis.actions.length === 0 && <p className="soft xsmall">No action found in the transcript.</p>}
                    {analysis.actions.map((item, index) => {
                      const line = quoteFor(item.evidence_id);
                      return (
                        <div className="analysis-item" key={`a-${index}`}>
                          <b>{item.text}</b>
                          <span className="analysis-meta">{item.owner} · {item.due || "no date"}</span>
                          {line && <span className="analysis-quote">“{line.text}” — {speakerName(meeting, line.speaker_id)}, {fmtTime(line.start)}</span>}
                        </div>
                      );
                    })}
                  </section>

                  <section className="analysis-card danger">
                    <h3>Risks <span>{analysis.risks.length}</span></h3>
                    {analysis.risks.length === 0 && <p className="soft xsmall">No delivery risk found.</p>}
                    {analysis.risks.map((item, index) => {
                      const line = quoteFor(item.evidence_id);
                      return (
                        <div className="analysis-item" key={`r-${index}`}>
                          <div className="row between"><b>{item.text}</b><Chip tone={item.severity === "high" ? "red" : "amber"}>{item.severity}</Chip></div>
                          <span className="analysis-meta">{item.why}</span>
                          <span className="analysis-meta">Mitigation: {item.mitigation || "none recorded"}</span>
                          {line && <span className="analysis-quote">“{line.text}” — {speakerName(meeting, line.speaker_id)}, {fmtTime(line.start)}</span>}
                        </div>
                      );
                    })}
                  </section>

                  <section className="analysis-card">
                    <h3>Questions & gaps <span>{analysis.questions.filter((q) => !q.answered).length + analysis.gaps.length + analysis.contradictions.length}</span></h3>
                    {analysis.contradictions.map((item, index) => (
                      <div className="analysis-item" key={`c-${index}`}>
                        <div className="row between"><b>{item.text}</b><Chip tone="red">contradiction</Chip></div>
                        <span className="analysis-meta">{item.why}</span>
                      </div>
                    ))}
                    {analysis.questions.filter((item) => !item.answered).map((item, index) => {
                      const line = quoteFor(item.evidence_id);
                      return (
                        <div className="analysis-item" key={`q-${index}`}>
                          <div className="row between"><b>{item.text}</b><Chip tone="amber">unanswered</Chip></div>
                          {line && <span className="analysis-quote">“{line.text}” — {speakerName(meeting, line.speaker_id)}, {fmtTime(line.start)}</span>}
                        </div>
                      );
                    })}
                    {analysis.gaps.map((item, index) => {
                      const line = quoteFor(item.evidence_id);
                      return (
                        <div className="analysis-item" key={`g-${index}`}>
                          <div className="row between"><b>{item.text}</b><Chip tone="amber">gap</Chip></div>
                          <span className="analysis-meta">{item.why}</span>
                          {line && <span className="analysis-quote">“{line.text}” — {speakerName(meeting, line.speaker_id)}, {fmtTime(line.start)}</span>}
                        </div>
                      );
                    })}
                    {analysis.questions.every((q) => q.answered) && analysis.gaps.length === 0 && analysis.contradictions.length === 0 && <p className="soft xsmall">No open question, gap or contradiction.</p>}
                  </section>
                </div>

                <div className="analysis-actions">
                  <button
                    className="btn primary"
                    onClick={() => {
                      approveAnalysis(meeting.id);
                      sendMeeting(meeting.id, { safe: true });
                    }}
                    disabled={meeting.ppma.status === "sent"}
                  >
                    <Icon name="send" size={14} /> {meeting.ppma.status === "sent" ? "PPMA has the approved facts" : "Approve findings & send to PPMA"}
                  </button>
                  <button className="btn" onClick={() => void analyzeMeeting(meeting.id)} disabled={analysisRunning === meeting.id}>
                    <Icon name="refresh" size={13} /> Re-run analysis
                  </button>
                  <span className="xsmall soft">The agent proposes; a human approves. No finding is written to project memory without this step.</span>
                </div>

                {decisionRecord && (
                  <div className="decision-record">
                    <div className="row between">
                      <span className="kicker">LAIX decision record</span>
                      <Chip tone="green">{decisionRecord.status}</Chip>
                    </div>
                    <p>{decisionRecord.decision.text}</p>
                    <div className="analysis-trace">
                      <Chip>{decisionRecord.evidence.length} evidence refs</Chip>
                      <Chip>{decisionRecord.approval.by ?? "pending"}</Chip>
                      <Chip tone="violet">{decisionRecord.hash}</Chip>
                    </div>
                    <span className="xsmall soft">what · why · evidence · approval · audit · undo — portable JSON for LAIX.</span>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      )}

      {tab === "transcript" && (
        <div className="workspace">
          <Panel className="transcript-panel" title="Transcript" sub={`${meeting.utterances.length} rows · on-device · correctable`} actions={<Chip tone="green" dot="live">local only</Chip>}>
            <div className="transcript" ref={scrollRef}>
              {meeting.utterances.map((row) => {
                const person = meeting.participants.find((p) => p.id === row.speaker_id);
                const linked = meeting.evidence.find((e) => e.utterance_id === row.id);
                const redaction = meeting.redactions.find((r) => r.id === row.redacted_by);
                const hidden = Boolean(redaction && redaction.status === "applied" && !reveal[row.id]);
                const low = linked ? linked.attribution_confidence < 0.8 : row.confidence < 0.8;
                return (
                  <div
                    key={row.id}
                    id={`row-${row.id}`}
                    className={classNames(
                      "transcript-row",
                      `sp-${person?.color ?? "amber"}`,
                      selected?.utterance_id === row.id && "selected",
                      low && "low-attribution",
                      progress >= row.start && progress <= row.end && "now",
                    )}
                    onClick={() => {
                      seek(row.start);
                      if (linked) setSelectedId(linked.id);
                    }}
                  >
                    <span className="row-speaker">{person?.initials ?? "?"}</span>
                    <span className="row-body">
                      <span className="row-head">
                        <b>{person?.name ?? row.speaker_id}</b>
                        <span className="mono">{fmtTime(row.start)}</span>
                        {linked && <span className={classNames("row-kind", `kind-${linked.kind}`)}>{linked.kind}</span>}
                        {low && <span className="row-low"><Icon name="alert" size={11} /> low attribution</span>}
                        {row.edited && <span className="row-edited">edited by you</span>}
                      </span>
                      {editRow === row.id ? (
                        <div className="row-edit" onClick={(event) => event.stopPropagation()}>
                          <textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={2} autoFocus />
                          <div className="row gap6">
                            <button className="btn sm primary" onClick={() => saveRow(row.id)}>Save correction</button>
                            <button className="btn sm ghost" onClick={() => setEditRow(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : hidden ? (
                        <div className="redaction-inline">
                          <span className="redaction-bar-text">{redaction?.safe_text}</span>
                          <button className="btn sm ghost" onClick={(event) => { event.stopPropagation(); setReveal((value) => ({ ...value, [row.id]: true })); }}>
                            <Icon name="eye" size={12} /> Reveal on this device
                          </button>
                        </div>
                      ) : (
                        <p className="row-text">{row.text}</p>
                      )}
                      <span className="row-foot">
                        <Confidence value={row.confidence} />
                        {redaction?.status === "applied" && <span className="chip chip-red">redacted · {redaction.reason.replace(/_/g, " ")}</span>}
                        {linked && <span className="mono xsmall soft">{linked.id} · attribution {Math.round(linked.attribution_confidence * 100)}%</span>}
                      </span>
                    </span>
                    <span className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="icon-btn" title="Edit this line" onClick={() => { setEditRow(row.id); setEditText(row.text); }}>
                        <Icon name="edit" size={13} />
                      </button>
                      <select
                        title="Reassign the speaker"
                        aria-label="Reassign speaker"
                        value={row.speaker_id}
                        onChange={(event) => {
                          if (linked) correctSpeaker(meeting.id, linked.id, event.target.value);
                          else say("This row has no evidence item. Select a linked row to correct the speaker.");
                        }}
                      >
                        {meeting.participants.map((p) => <option key={p.id} value={p.id}>{p.initials}</option>)}
                      </select>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="transcript-foot">
              <span><Icon name="cpu" size={13} /> {meeting.provenance.asr_model} · {meeting.provenance.diarization_model}</span>
              <span>Double-check low-attribution rows. A correction emits `capture.correction`.</span>
            </div>
          </Panel>

          <aside className="inspector">
            {selected ? (
              <>
                <div className="inspector-head">
                  <div>
                    <span className="kicker">Evidence · {selected.id}</span>
                    <h2>{selected.kind}</h2>
                  </div>
                  <Chip tone={selected.kind === "promise" ? "amber" : "cyan"}>{selected.sensitivity.replace(/_/g, " ")}</Chip>
                </div>
                <blockquote className="inspector-quote">“{safeQuote(meeting, selected, true)}”</blockquote>
                <div className="inspector-speaker">
                  <SpeakerChip
                    name={speakerName(meeting, selected.speaker_id)}
                    initials={meeting.participants.find((p) => p.id === selected.speaker_id)?.initials ?? "?"}
                    role={meeting.participants.find((p) => p.id === selected.speaker_id)?.role}
                    color={meeting.participants.find((p) => p.id === selected.speaker_id)?.color}
                  />
                  <span className="mono">{fmtTime(selected.start)}–{fmtTime(selected.end)}</span>
                </div>
                <div className="inspector-metrics">
                  <Meter value={selected.confidence} label="Text confidence" tone="green" />
                  <Meter value={selected.attribution_confidence} label="Speaker attribution" tone={selected.attribution_confidence < 0.8 ? "red" : "green"} />
                </div>
                <div className="inspector-actions">
                  <button className="btn sm" onClick={() => seek(selected.start)}><Icon name="play" size={12} /> Play from here</button>
                  <button className="btn sm" onClick={() => setPackOpen(true)}><Icon name="file" size={12} /> Evidence pack</button>
                  <button className="btn sm danger" onClick={() => setRedactOpen(true)}><Icon name="scissors" size={12} /> Redact</button>
                </div>
                <div className="inspector-field">
                  <span>Reassign speaker</span>
                  <select value={selected.speaker_id} onChange={(event) => correctSpeaker(meeting.id, selected.id, event.target.value)}>
                    {meeting.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </div>
                <div className="inspector-links">
                  <button onClick={() => navigate(`/recall?q=${encodeURIComponent(selected.quote.slice(0, 40))}`)}><Icon name="search" size={12} /> Find in recall</button>
                  <Link to={`/ppma`}><Icon name="send" size={12} /> Event log</Link>
                </div>
                <div className="inspector-provenance">
                  <div><span>Source</span><b>{meeting.title}</b></div>
                  <div><span>Pointer</span><b className="mono">recall://captures/{meeting.capture_id.slice(0, 12)}…#{selected.id}</b></div>
                  <div><span>Consent</span><b>{meeting.consent.state} · {meeting.consent.wording_version}</b></div>
                  <div><span>Redaction</span><b>{meeting.redactions.find((r) => r.evidence_id === selected.id)?.status ?? "none"}</b></div>
                </div>
              </>
            ) : (
              <Empty title="Select a row" detail="Click a transcript row to inspect its evidence." />
            )}
          </aside>
        </div>
      )}

      {tab === "extracted" && (
        <div className="extracted-grid">
          <Panel title="Decisions" sub="What the meeting settled">
            <div className="fact-list">
              {meeting.decisions.map((decision) => (
                <FactRow key={decision.id} {...decision} meeting={meeting} onEvidence={chooseEvidence} editing={editItem === decision.id} editText={editItemText} onEdit={() => { setEditItem(decision.id); setEditItemText(decision.text); }} onText={setEditItemText} onSave={() => saveItem(decision.id)} onCancel={() => setEditItem(null)} />
              ))}
              {meeting.decisions.length === 0 && <Empty title="No decisions extracted" />}
            </div>
          </Panel>
          <Panel title="Action items" sub="Owned by PPMA · evidence attached">
            <div className="fact-list">
              {meeting.actions.map((action) => (
                <FactRow key={action.id} {...action} meeting={meeting} onEvidence={chooseEvidence} editing={editItem === action.id} editText={editItemText} onEdit={() => { setEditItem(action.id); setEditItemText(action.text); }} onText={setEditItemText} onSave={() => saveItem(action.id)} onCancel={() => setEditItem(null)} owner={action.owner} due={action.due} />
              ))}
              {meeting.actions.length === 0 && <Empty title="No actions extracted" />}
            </div>
          </Panel>
          <Panel title="Open questions" sub="Unresolved, with the quote that raised them">
            <div className="fact-list">
              {meeting.questions.map((question) => (
                <FactRow key={question.id} {...question} meeting={meeting} onEvidence={chooseEvidence} editing={editItem === question.id} editText={editItemText} onEdit={() => { setEditItem(question.id); setEditItemText(question.text); }} onText={setEditItemText} onSave={() => saveItem(question.id)} onCancel={() => setEditItem(null)} />
              ))}
              {meeting.questions.length === 0 && <Empty title="No open questions" />}
            </div>
          </Panel>
          <Panel title="Summary" sub="Generated from the transcript; edit not applied to the source">
            <p className="summary-text">{meeting.summary}</p>
            <div className="summary-meta">
              <span><b>Extraction model</b> fact-extractor 0.7.2</span>
              <span><b>Useful rate (pilot)</b> {Math.round(pack.pilot.useful_rate * 100)}%</span>
              <span><b>Human corrections</b> {meetingAudit.filter((a) => a.action === "capture.correction").length}</span>
            </div>
          </Panel>
        </div>
      )}

      {tab === "ppma" && (
        <div className="ppma-grid">
          <Panel title="Project memory update" sub="PPMA owns the project state; RECALL links to the evidence" actions={<SourceChip meeting={meeting} />}>
            <div className="project-state">
              <span className="kicker">Northgate fit-out</span>
              <p>{project.state || pack.ppma.project.state_before}</p>
              {project.followup && (
                <div className="draft-box">
                  <div className="row between"><span className="kicker">Follow-up draft · awaiting human approval</span><Chip tone="amber">PPMA</Chip></div>
                  <p>{project.followup}</p>
                </div>
              )}
            </div>
            <div className="memory-list compact">
              {meetingMemory.map((entry) => (
                <div className="memory-row" key={entry.id}>
                  <div className="memory-top"><span className="memory-kind">{entry.type}</span><SourceChip /><span className="mono xsmall soft">{Math.round(entry.confidence * 100)}%</span></div>
                  <p>{entry.text}</p>
                  <div className="memory-meta">
                    <Status value={entry.state} />
                    <Chip>{entry.sensitivity.replace(/_/g, " ")}</Chip>
                    {entry.corrected && <Chip tone="green">corrected</Chip>}
                    {entry.redacted && <Chip tone="red">redacted</Chip>}
                  </div>
                </div>
              ))}
              {meetingMemory.length === 0 && <Empty title="Not handed to PPMA yet" detail="Send the capture to create derived memory." />}
            </div>
          </Panel>

          <Panel title="Event log for this capture" sub={`${meetingEvents.length} events · idempotent · signed pointers`} actions={<Chip tone={meeting.consent.state === "granted" ? "green" : "red"}>{meeting.consent.state}</Chip>}>
            <div className="event-list">
              {meetingEvents.map((event) => (
                <div className="event-row" key={event.event_id}>
                  <div>
                    <b className="mono">{event.type}</b>
                    <small className="mono">{event.event_id}</small>
                  </div>
                  <span className="mono xsmall soft">{fmtDate(event.occurred_at, settings.lang)}</span>
                  <Chip tone={event.sensitivity === "personal" ? "neutral" : "violet"}>{event.sensitivity.replace(/_/g, " ")}</Chip>
                  <Status value={event.delivery.status} />
                </div>
              ))}
              {meetingEvents.length === 0 && <Empty title="No events emitted" detail="Consent is recorded. Send the facts to PPMA when ready." icon="send" />}
            </div>
            <div className="ppma-send-box">
              <div>
                <b>{meeting.ppma.status === "sent" ? "PPMA has the facts" : "Ready to hand off"}</b>
                <p>Text and evidence pointers only. Raw audio stays on {meeting.provenance.device}.</p>
              </div>
              <button className="btn" onClick={() => { const citation = selected ? `\n\n“${safeQuote(meeting, selected, true)}”\n— ${speakerName(meeting, selected.speaker_id)}, ${fmtTime(selected.start)}` : ""; const subject = `RECALL follow-up — ${meeting.title}`; const body = `${meeting.summary}${citation}\n\nSafe evidence pointer: recall://captures/${meeting.capture_id}\n\nPrepared by RECALL. Review before sending; RECALL never sends email.`; window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; say("Email draft prepared. RECALL never sends it."); }}>
                <Icon name="mail" size={13} /> Email draft
              </button>
              <button className="btn primary" onClick={() => setSendPreviewOpen(true)} disabled={meeting.consent.state !== "granted" || meeting.ppma.status === "sent" || meeting.ppma.status === "queued"}>
                <Icon name="send" size={14} /> {meeting.ppma.status === "sent" ? "PPMA has the facts" : meeting.ppma.status === "queued" ? "Queued — open PPMA to deliver" : "Send to PPMA"}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "comments" && (
        <div className="comments-grid">
          <Panel title="Annotations" sub="Comments stay local until a safe pack is shared">
            <div className="comments-list">
              {meetingComments.map((comment) => (
                <div className={classNames("comment-row", comment.resolved && "resolved")} key={comment.id}>
                  <span className="comment-avatar">{comment.author.slice(0, 1)}</span>
                  <div className="comment-body">
                    <div className="comment-head">
                      <b>{comment.author}</b>
                      <Chip>{comment.role.replace(/_/g, " ")}</Chip>
                      <span className="mono xsmall soft">{fmtDate(comment.at, settings.lang)}</span>
                      <Chip tone="violet">{comment.target_type} · {comment.target_id}</Chip>
                      <button className="btn sm ghost" onClick={() => resolveComment(comment.id)}>{comment.resolved ? "Reopen" : "Resolve"}</button>
                    </div>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}
              {meetingComments.length === 0 && <Empty title="No annotations yet" detail="Comment on the meeting or on a specific evidence item. Open a second tab to see live presence." icon="list" />}
            </div>
            <div className="comment-composer">
              <div className="segmented">
                <button className={commentTarget === "meeting" ? "active" : ""} onClick={() => setCommentTarget("meeting")}>Meeting</button>
                <button className={commentTarget === "evidence" ? "active" : ""} onClick={() => setCommentTarget("evidence")} disabled={!selected}>Evidence {selected ? selected.id : ""}</button>
              </div>
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={2} placeholder="Add an annotation. It is visible to other open tabs in this demo." />
              <button className="btn primary sm" onClick={() => { addComment(commentTarget, commentTarget === "evidence" && selected ? selected.id : meeting.id, meeting.id, commentText); setCommentText(""); }} disabled={!commentText.trim()}>Add comment</button>
            </div>
          </Panel>
          <aside className="comments-side">
            <Panel title="Who changed this?" sub="Every correction keeps its actor and before/after">
              <div className="correction-history">
                {corrections.filter((correction) => correction.meeting_id === meeting.id).map((correction) => (
                  <div key={correction.id}>
                    <b>{correction.field.replace(/_/g, " ")}</b>
                    <span>{correction.before} → {correction.after}</span>
                    <small>{correction.reason} · {correction.corrected_by} · {fmtDate(correction.at, settings.lang)}</small>
                  </div>
                ))}
                {corrections.filter((correction) => correction.meeting_id === meeting.id).length === 0 && <Empty title="No corrections" detail="A correction will appear here with its before and after." icon="edit" />}
              </div>
            </Panel>
            <Panel title="Trust ribbon" sub="What every evidence item carries">
              <div className="trust-ribbon">
                <span><b>Source</b>RECALL · {meeting.capture_id.slice(0, 12)}…</span>
                <span><b>Model</b>{meeting.provenance.asr_model}</span>
                <span><b>Consent</b>{meeting.consent.state} · {meeting.consent.wording_version}</span>
                <span><b>Human sign-off</b>{corrections.some((correction) => correction.meeting_id === meeting.id) ? "correction recorded" : "not required yet"}</span>
                <span><b>Redaction</b>{meeting.redactions.some((redaction) => redaction.status === "applied") ? "safe version applied" : "none applied"}</span>
              </div>
            </Panel>
            <Panel title="Present now" sub="Live presence in this browser">
              <div className="presence-list">
                <span><i className="dot live" /> You · {settings.role.replace(/_/g, " ")}</span>
                {collabPeers.map((peer) => <span key={peer.id}><i className="dot live" /> {peer.name} · {peer.role.replace(/_/g, " ")}</span>)}
                {collabPeers.length === 0 && <p className="xsmall soft">Open this meeting in another tab to see presence and live comments.</p>}
              </div>
            </Panel>
          </aside>
        </div>
      )}

      {tab === "rights" && (
        <div className="rights-grid">
          <Panel title="Consent" sub="Recorded before capture · jurisdiction-aware">
            <div className="rights-block">
              <div className="rights-row"><span>State</span><b><ConsentBadge state={meeting.consent.state} /></b></div>
              <div className="rights-row"><span>Basis</span><b>{meeting.consent.basis.replace(/_/g, " ")}</b></div>
              <div className="rights-row"><span>Jurisdiction</span><b>{meeting.consent.jurisdiction} · {meeting.consent.wording_version}</b></div>
              <div className="rights-row"><span>Participants notified</span><b>{meeting.consent.participants_notified ? "Yes" : "No"}</b></div>
              <div className="rights-row"><span>Evidence ref</span><b className="mono">{meeting.consent.evidence_ref}</b></div>
              <div className="rights-row"><span>Recorded at</span><b>{fmtDate(meeting.consent.recorded_at, settings.lang)}</b></div>
            </div>
            <button className="btn danger mt12" onClick={() => setConsentOpen(true)} disabled={meeting.consent.state === "withdrawn"}>
              <Icon name="shieldOff" size={13} /> Withdraw consent
            </button>
            <p className="xsmall soft mt8">Withdrawal suppresses the PPMA memory and blocks further capture events.</p>
          </Panel>

          <Panel title="Retention" sub="The stricter policy wins">
            <div className="rights-block">
              <div className="rights-row"><span>Retain until</span><b>{fmtDate(meeting.retention.retain_until, settings.lang)}</b></div>
              <div className="rights-row"><span>Policy</span><b>{meeting.retention.policy.replace(/_/g, " ")}</b></div>
              <div className="rights-row"><span>Legal hold</span><b>{meeting.retention.legal_hold ? "Yes · deletion blocked" : "No"}</b></div>
              <div className="rights-row"><span>Raw media</span><b>on device · AES-256-GCM</b></div>
              <div className="rights-row"><span>Training on audio</span><b>never</b></div>
            </div>
            <div className="row gap8 mt12">
              <button className="btn sm" onClick={() => setRetentionOpen(true)}><Icon name="clock" size={12} /> Change retention</button>
              <button className={classNames("btn sm", meeting.retention.legal_hold && "primary")} onClick={() => toggleLegalHold(meeting.id)}>
                <Icon name="lock" size={12} /> {meeting.retention.legal_hold ? "Release hold" : "Apply legal hold"}
              </button>
            </div>
          </Panel>

          <Panel title="Redactions" sub="Detected passages and the safe version">
            <div className="redaction-list">
              {meeting.redactions.map((redaction) => (
                <div className={classNames("redaction-row", redaction.status)} key={redaction.id}>
                  <div className="row between">
                    <b>{redaction.label}</b>
                    <Status value={redaction.status} />
                  </div>
                  <p className="mono small">{redaction.reason.replace(/_/g, " ")} · {Math.round(redaction.confidence * 100)}% classifier</p>
                  <div className="safe-preview">{redaction.safe_text}</div>
                  <div className="row gap6">
                    {redaction.status === "detected" ? (
                      <button className="btn sm danger" onClick={() => redact(meeting.id, redaction.evidence_id, redaction.reason, redaction.label)}>Apply redaction</button>
                    ) : (
                      <button className="btn sm ghost" onClick={() => unredact(meeting.id, redaction.id)}>Remove locally</button>
                    )}
                    <Chip tone="green">safe version is what PPMA receives</Chip>
                  </div>
                </div>
              ))}
              {meeting.redactions.length === 0 && <Empty title="No sensitive passages detected" detail="The redaction classifier found nothing to review." icon="scissors" />}
            </div>
          </Panel>

          <Panel title="Provenance" sub="Every claim can be reconstructed">
            <ProvenanceList
              items={{
                device: meeting.provenance.device,
                npu: meeting.provenance.npu,
                asr: meeting.provenance.asr_model,
                diarization: meeting.provenance.diarization_model,
                vad: meeting.provenance.vad_model,
                redaction: meeting.provenance.redaction_model,
                app_version: meeting.provenance.app_version,
                language: meeting.provenance.language,
                "audio sha256": `${meeting.provenance.audio_sha256.slice(0, 24)}…`,
                "encrypted at rest": meeting.provenance.encrypted_at_rest,
                network: meeting.provenance.network,
              }}
            />
          </Panel>

          <Panel title="Audit" sub="Capture, correction, redaction, share and delete">
            <div className="audit-list">
              {meetingAudit.slice(0, 8).map((entry) => (
                <div className="audit-row" key={entry.id}>
                  <span className="mono xsmall soft">{fmtDate(entry.at, settings.lang)}</span>
                  <b>{entry.action}</b>
                  <span>{entry.detail}</span>
                </div>
              ))}
              {meetingAudit.length === 0 && <Empty title="No audit entries" />}
            </div>
          </Panel>

          <Panel title="Danger zone" sub="Deletion is a tombstone, not a silent drop">
            <p className="small muted">Deleting removes the transcript and evidence from this device and retires the PPMA memory. The tombstone keeps the fact of deletion so a replay cannot resurrect it.</p>
            <button className="btn danger mt12" onClick={() => setDeleteOpen(true)}><Icon name="trash" size={13} /> Delete this memory</button>
            {meeting.retention.legal_hold && <p className="xsmall red mt8">Legal hold is active. Deletion is blocked until the hold is released.</p>}
          </Panel>
        </div>
      )}

      <p className="capture-foot">
        <Icon name="lock" size={12} /> {meeting.provenance.local_only ? "Raw audio and video never left this device." : "Media retention is local."} Evidence pointer: <code className="mono">recall://captures/{meeting.capture_id}</code>
      </p>

      <Modal open={redactOpen} onClose={() => setRedactOpen(false)} title="Redact before sharing" kicker={selected ? `Evidence ${selected.id}` : "Evidence"} wide>
        {selected && (
          <>
            <div className="redaction-preview">
              <span className="kicker">Original · stays on this device</span>
              <p>{safeQuote(meeting, selected, false)}</p>
              <span className="kicker">Safe version · PPMA receives</span>
              <p className="redacted-bar"><span>[redacted — internal client comment]</span></p>
            </div>
            <label className="field mt12">
              <span>Reason</span>
              <select value={redactReason} onChange={(event) => setRedactReason(event.target.value)}>
                <option value="client_confidential">Client confidential</option>
                <option value="personal_name">Personal name</option>
                <option value="price_commercial">Price / commercial</option>
                <option value="health_data">Health data</option>
                <option value="legal_privilege">Legal privilege</option>
              </select>
            </label>
            <div className="row gap8 mt12">
              <button className="btn primary" onClick={() => { redact(meeting.id, selected.id, redactReason, redactReason.replace(/_/g, " ")); setRedactOpen(false); }}>
                <Icon name="scissors" size={13} /> Apply redaction
              </button>
              <button className="btn ghost" onClick={() => setRedactOpen(false)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={sendPreviewOpen} onClose={() => setSendPreviewOpen(false)} title="What will PPMA receive?" kicker="Text, evidence pointers and safe versions only" wide>
        <div className="send-preview">
          <div className="send-preview-summary">
            <div><span>Capture</span><b>{meeting.title}</b></div>
            <div><span>Decisions</span><b>{meeting.decisions.length}</b></div>
            <div><span>Actions</span><b>{meeting.actions.length}</b></div>
            <div><span>Questions</span><b>{meeting.questions.length}</b></div>
            <div><span>Redactions</span><b>{meeting.redactions.filter((redaction) => redaction.status === "applied").length}</b></div>
            <div><span>Raw media</span><b>not attached</b></div>
          </div>
          <pre className="send-preview-json">{JSON.stringify(meetingPayload(meeting, { safe: true }), null, 2)}</pre>
          <div className="row gap8 mt12">
            <button className="btn primary" onClick={() => { sendMeeting(meeting.id, { safe: true }); setSendPreviewOpen(false); }}>
              <Icon name="send" size={13} /> Send safe facts to PPMA
            </button>
            <button className="btn ghost" onClick={() => setSendPreviewOpen(false)}>Cancel</button>
          </div>
          <p className="xsmall soft mt8">The internal comment is replaced by its safe text. Audio is never attached. Consent is checked again on send.</p>
        </div>
      </Modal>

      <Modal open={packOpen} onClose={() => setPackOpen(false)} title="Evidence pack" kicker={meeting.title} wide>
        {evPack && (
          <>
            <div className="pack-head">
              <div><span className="kicker">Quote</span><b>“{evPack.quote}”</b></div>
              <div className="pack-meta">
                <span>{evPack.speaker}</span><span className="mono">{evPack.start}–{evPack.end}</span><span className="mono">{Math.round(evPack.confidence * 100)}%</span>
              </div>
            </div>
            <pre className="pack-preview">{evPack.markdown}</pre>
            <div className="row gap8 mt12">
              <CopyButton text={evPack.markdown} label="Copy pack" />
              <button className="btn" onClick={() => downloadText(`recall-evidence-${meeting.id}-${selected?.id}.md`, evPack.markdown)}><Icon name="download" size={13} /> Download .md</button>
              <button className="btn" onClick={() => downloadText(`recall-evidence-${meeting.id}.json`, JSON.stringify(meetingPayload(meeting, { safe: true }), null, 2), "application/json")}><Icon name="file" size={13} /> JSON payload</button>
              {selected && <button className="btn" onClick={() => setShareUrl(createShareLink(meeting, selected.id, 7)?.url ?? null)}><Icon name="link" size={13} /> Create 7-day link</button>}
            </div>
            {shareUrl && (
              <div className="share-link-box">
                <span className="kicker">Safe read-only link · expires in 7 days</span>
                <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
                <div className="row gap6"><CopyButton text={shareUrl} label="Copy link" /><Link className="btn sm ghost" to={shareUrl.split("#")[1] ?? "/"}>Preview</Link></div>
              </div>
            )}
            <p className="xsmall soft mt8">The pack contains the safe quote, speaker, timestamp, source, consent, provenance and a hash. Raw audio is not included.</p>
          </>
        )}
      </Modal>

      <Modal open={retentionOpen} onClose={() => setRetentionOpen(false)} title="Retention policy" kicker="The stricter of RECALL and PPMA wins">
        <label className="field">
          <span>Retain until</span>
          <input type="date" value={retentionDate} onChange={(event) => setRetentionDate(event.target.value)} />
        </label>
        <p className="xsmall soft mt8">Team default: {pack.team.retention_days} days. Legal hold overrides deletion.</p>
        <div className="row gap8 mt12">
          <button className="btn primary" onClick={() => { setRetention(meeting.id, `${retentionDate}T00:00:00Z`); setRetentionOpen(false); }}>Save retention</button>
          <button className="btn ghost" onClick={() => setRetentionOpen(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Withdraw consent" kicker="This propagates to PPMA">
        <p className="small muted">Withdrawal suppresses the project memory and blocks any further capture event for this meeting. The audit trail keeps the change.</p>
        <label className="field mt12"><span>Reason</span>
          <select value={consentReason} onChange={(event) => setConsentReason(event.target.value)}>
            <option value="participant_request">Participant request</option>
            <option value="consent_model_changed">Consent model changed</option>
            <option value="recorded_in_error">Recorded in error</option>
          </select>
        </label>
        <div className="row gap8 mt12">
          <button className="btn danger" onClick={() => { withdrawConsent(meeting.id, consentReason); setConsentOpen(false); }}>Withdraw consent</button>
          <button className="btn ghost" onClick={() => setConsentOpen(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this memory" kicker="Tombstone, not a silent drop">
        <p className="small muted">The transcript, evidence and derived memory are removed. A tombstone is sent to PPMA so a later replay cannot resurrect the record.</p>
        <label className="field mt12"><span>Reason</span>
          <select value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)}>
            <option value="user_request">User request</option>
            <option value="retention_expired">Retention expired</option>
            <option value="consent_withdrawn">Consent withdrawn</option>
            <option value="recorded_in_error">Recorded in error</option>
          </select>
        </label>
        <div className="row gap8 mt12">
          <button className="btn danger" onClick={doDelete}><Icon name="trash" size={13} /> Delete and emit tombstone</button>
          <button className="btn ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
        </div>
        {meeting.retention.legal_hold && <p className="red small mt8">Legal hold is active. Deletion will be refused.</p>}
      </Modal>
    </>
  );
}

function FactRow({
  id,
  text,
  evidence_id,
  confidence,
  status,
  meeting,
  onEvidence,
  editing,
  editText,
  onEdit,
  onText,
  onSave,
  onCancel,
  owner,
  due,
}: {
  id: string;
  text: string;
  evidence_id: string;
  confidence: number;
  status: string;
  meeting: MeetingType;
  onEvidence: (evidence: Evidence) => void;
  editing: boolean;
  editText: string;
  onEdit: () => void;
  onText: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  owner?: string;
  due?: string;
}) {
  const evidence = meeting.evidence.find((e) => e.id === evidence_id);
  return (
    <div className="fact-row">
      <div className="fact-head">
        <Chip tone={status === "accepted" || status === "done" ? "green" : status === "proposed" ? "amber" : "neutral"}>{status}</Chip>
        <span className="mono xsmall soft">{evidence_id}</span>
        <Confidence value={confidence} />
      </div>
      {editing ? (
        <div className="row-edit">
          <textarea value={editText} onChange={(event) => onText(event.target.value)} rows={2} autoFocus />
          <div className="row gap6">
            <button className="btn sm primary" onClick={onSave}>Save correction</button>
            <button className="btn sm ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <p>{text}</p>
      )}
      <div className="fact-foot">
        {owner && <span>Owner <b>{owner}</b></span>}
        {due && <span>Due <b>{due}</b></span>}
        <button className="btn sm ghost" onClick={onEdit}><Icon name="edit" size={11} /> Correct</button>
        {evidence && <button className="btn sm ghost" onClick={() => onEvidence(evidence)}><Icon name="quote" size={11} /> Evidence · {fmtTime(evidence.start)}</button>}
      </div>
    </div>
  );
}

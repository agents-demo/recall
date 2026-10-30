import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtTime, speakerName, pct } from "../lib/engine";
import type { Answer } from "../types";
import { PageHead, Panel, Chip, Confidence, DataNote, Empty } from "../components/UI";
import { Icon } from "../components/Icon";

function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  if (!term) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === term.toLowerCase() ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

const examples = [
  "What did we promise about the 14th?",
  "Who said we can hold the 14th?",
  "What are the open actions?",
  "What did the client ask about training?",
  "What is the capital of France?",
];

export default function Recall() {
  const { pack, activeMeetings, notes, search, ask, settings, meetingById } = useStore();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [mode, setMode] = useState<"ask" | "search">("ask");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [answer, setAnswer] = useState<Answer | null>(() => (initialQuery.trim() ? ask(initialQuery) : null));
  const [showTrace, setShowTrace] = useState(false);
  if (!pack) return null;

  useEffect(() => {
    const initial = params.get("q");
    if (initial !== null && initial !== submitted) {
      setQuery(initial);
      setSubmitted(initial);
      if (initial.trim()) setAnswer(ask(initial));
    }
    // Only react to a new deep-link query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const speakers = useMemo(() => {
    const map = new Map<string, string>();
    activeMeetings.forEach((meeting) => meeting.participants.forEach((person) => map.set(person.id, person.name)));
    return [...map.entries()];
  }, [activeMeetings]);

  const results = useMemo(
    () =>
      submitted.trim()
        ? search(submitted, {
            meeting_id: meetingFilter === "all" ? undefined : meetingFilter,
            speaker_id: speakerFilter === "all" ? undefined : speakerFilter,
            kind: kindFilter === "all" ? undefined : kindFilter,
            limit: 30,
          })
        : [],
    [submitted, search, meetingFilter, speakerFilter, kindFilter],
  );

  const submit = (value: string) => {
    setQuery(value);
    setSubmitted(value);
    setParams(value ? { q: value } : {});
    if (mode === "ask") setAnswer(ask(value));
  };

  return (
    <>
      <PageHead
        kicker="Recall · local, cited, correctable"
        title={t("recall.title")}
        subtitle={t("recall.subtitle")}
        actions={<Chip tone="green" dot="live">No web · no model memory</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="Answers are composed locally from this deterministic pack. The same policy applies to real captures: if no evidence matches, RECALL refuses and says so." />

      <div className="recall-search-wrap">
        <div className="recall-modes">
          <button className={classNames("mode-btn", mode === "ask" && "active")} onClick={() => { setMode("ask"); if (query) setAnswer(ask(query)); }}>
            <Icon name="spark" size={15} /> Ask the evidence
          </button>
          <button className={classNames("mode-btn", mode === "search" && "active")} onClick={() => setMode("search")}>
            <Icon name="search" size={15} /> Search every capture
          </button>
        </div>
        <form
          className="recall-search"
          onSubmit={(event) => {
            event.preventDefault();
            submit(query);
          }}
        >
          <Icon name="search" size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "ask" ? "What did we promise about the 14th?" : "delivery, 14th, Sandra, training…"}
            aria-label={mode === "ask" ? "Ask a question about the evidence" : "Search all captures"}
          />
          <button className="btn primary" type="submit">{mode === "ask" ? "Ask" : "Search"}</button>
        </form>
        <div className="example-row">
          <span>Try</span>
          {examples.map((example) => (
            <button key={example} onClick={() => submit(example)}>{example}</button>
          ))}
        </div>
      </div>

      <div className="filter-bar recall-filters">
        <select value={meetingFilter} onChange={(event) => setMeetingFilter(event.target.value)} aria-label="Filter by meeting">
          <option value="all">All captures</option>
          {activeMeetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
          <option value={pack.notes[0]?.id}>Field notes</option>
        </select>
        <select value={speakerFilter} onChange={(event) => setSpeakerFilter(event.target.value)} aria-label="Filter by speaker">
          <option value="all">All speakers</option>
          {speakers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} aria-label="Filter by evidence kind">
          <option value="all">All evidence</option>
          <option value="promise">Promises</option>
          <option value="decision">Decisions</option>
          <option value="action">Actions</option>
          <option value="question">Questions</option>
          <option value="note">Notes</option>
        </select>
        <span className="filter-count"><Icon name="lock" size={12} /> searched {activeMeetings.length} captures · {notes.length} notes locally</span>
      </div>

      {mode === "ask" && submitted.trim() && (
        <div className={classNames("answer-card", answer?.refused && "refused")}>
          <div className="answer-head">
            <div>
              <span className="kicker">Answer · {answer?.refused ? "refused" : "from your evidence"}</span>
              <h2>{submitted}</h2>
            </div>
            <div className="answer-meta">
              {answer && !answer.refused && <Chip tone="green"><i className="dot live" /> {Math.round(answer.confidence * 100)}% confidence</Chip>}
              {answer?.refused && <Chip tone="red">no evidence</Chip>}
              <span className="mono xsmall">{answer?.latency_ms ?? 0} ms · local</span>
            </div>
          </div>
          <p className="answer-text">{answer?.answer ?? "Ask a question to begin."}</p>
          {answer && answer.citations.length > 0 && (
            <div className="citation-list">
              {answer.citations.map((citation, index) => (
                <Link key={`${citation.meeting_id}-${citation.evidence_id}`} className="citation" to={`/meetings/${citation.meeting_id}?t=${Math.floor(citation.start)}&e=${citation.evidence_id}`}>
                  <span className="citation-index">{index + 1}</span>
                  <span>
                    <b>“{citation.quote}”</b>
                    <small>{citation.speaker} · {citation.meeting_title} · {fmtTime(citation.start)} · {Math.round(citation.confidence * 100)}%</small>
                  </span>
                  <Icon name="arrow" size={14} />
                </Link>
              ))}
            </div>
          )}
          <div className="answer-foot">
            <button className="btn sm ghost" onClick={() => setShowTrace((value) => !value)}>
              <Icon name="terminal" size={12} /> {showTrace ? "Hide" : "Inspect"} the answer trace
            </button>
            <span className="xsmall soft">Answers are restricted to the user's evidence, with citations. If evidence is missing, the answer is “no”.</span>
          </div>
          {showTrace && answer && (
            <div className="trace">
              {answer.trace.map((step, index) => (
                <div className="trace-step" key={step.step}>
                  <span className="trace-num">{index + 1}</span>
                  <div><b>{step.step}</b><p>{step.detail}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="results-head">
        <h2>{submitted ? `Evidence results · ${results.length}` : "Search the library"}</h2>
        {submitted && <span className="xsmall soft">Ranked locally. Every result opens the exact timestamp.</span>}
      </div>

      <div className="result-list">
        {results.map((hit) => {
          const meeting = meetingById(hit.meeting_id);
          const speaker = meeting ? speakerName(meeting, hit.speaker_id) : hit.speaker_id;
          return (
            <Link
              key={`${hit.type}-${hit.id}-${hit.start}`}
              className="result-row"
              to={`/meetings/${hit.meeting_id}?t=${Math.floor(hit.start)}&e=${hit.evidence_id}`}
            >
              <div className="result-time mono">{fmtTime(hit.start)}</div>
              <div className="result-body">
                <div className="result-meta">
                  <Chip tone={hit.kind === "promise" ? "amber" : hit.kind === "decision" ? "cyan" : "neutral"}>{hit.kind ?? hit.type}</Chip>
                  <span>{hit.meeting_title}</span>
                  <span>·</span>
                  <b>{speaker || "field note"}</b>
                  {hit.redacted && <Chip tone="red">redacted</Chip>}
                </div>
                <p><Highlight text={hit.text} query={submitted} /></p>
                <div className="result-foot">
                  <span className="mono">{hit.evidence_id}</span>
                  <Confidence value={hit.confidence} />
                  <span className="mono xsmall soft">score {hit.score}</span>
                </div>
              </div>
              <span className="result-open">Open <Icon name="arrow" size={13} /></span>
            </Link>
          );
        })}
        {submitted && results.length === 0 && (
          <Empty title="No evidence matches" detail="Try fewer words, another speaker, or search for the exact phrase you remember." icon="search" />
        )}
        {!submitted && (
          <div className="recall-blank">
            <div className="recall-blank-grid">
              {activeMeetings.slice(0, 3).map((meeting) => (
                <Link key={meeting.id} className="recall-blank-card" to={`/meetings/${meeting.id}`}>
                  <span className="kicker">{meeting.mode}</span>
                  <b>{meeting.title}</b>
                  <p>“{meeting.evidence[0]?.quote}”</p>
                  <span className="xsmall soft">{meeting.evidence.length} evidence items · {meeting.participants.length} speakers</span>
                </Link>
              ))}
            </div>
            <div className="local-policy">
              <Icon name="shield" size={18} />
              <div>
                <b>The answer policy</b>
                <p>RECALL only answers from captured evidence. Every claim carries a speaker, timestamp, source and confidence. Redacted text is replaced with the safe version. No open web, no un-cited memory.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {submitted && (
        <p className="capture-foot">
          <Icon name="clock" size={12} /> Time to quote: <b>{pack.pilot.quote_seconds}s</b> in the pilot · target ≤ {pack.pilot.target_quote_seconds}s. Local search does not call a model.
        </p>
      )}
    </>
  );
}

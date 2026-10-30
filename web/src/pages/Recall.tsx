import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtTime, pct, speakerName } from "../lib/engine";
import type { Answer } from "../types";
import { PageHead, Chip, Confidence, DataNote, Empty, Panel } from "../components/UI";
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

const followUps = ["Who said that?", "Show me the moment", "What about the training?", "Compare with kickoff"];

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export default function Recall() {
  const { pack, activeMeetings, notes, search, meetingById, settings, conversation, askThread, clearConversation, say } = useStore();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<"ask" | "search">("ask");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [submitted, setSubmitted] = useState("");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [showTrace, setShowTrace] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  if (!pack) return null;

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

  useEffect(() => {
    const initial = params.get("q");
    if (initial && !startedRef.current && conversation.length === 0) {
      startedRef.current = true;
      setQuery(initial);
      setSubmitted(initial);
      askThread(initial);
    }
    // Only react to the first deep link, not to every route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end", behavior: settings.reducedMotion ? "auto" : "smooth" });
  }, [conversation.length, settings.reducedMotion]);

  const submit = (value = query) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmitted(trimmed);
    setParams({ q: trimmed });
    if (mode === "ask") askThread(trimmed);
    setQuery("");
  };

  const startVoice = () => {
    const ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!ctor) {
      say("This browser has no speech recognition. Type the question instead.");
      return;
    }
    const recognition = new ctor();
    recognition.lang = settings.lang === "zh" ? "zh-CN" : "en-GB";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      submit(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
    say("Listening with the browser speech engine. This is not the private on-device ASR.");
  };

  const lastAssistant = [...conversation].reverse().find((turn) => turn.role === "assistant" && turn.answer);
  const lastAnswer = lastAssistant?.answer;

  return (
    <>
      <PageHead
        kicker="Recall · threaded, cited, correctable"
        title={t("recall.title")}
        subtitle={t("recall.subtitle")}
        actions={<Chip tone="green" dot="live">No web · no model memory</Chip>}
      />
      <DataNote
        seed={pack.meta.seed}
        label={settings.workspaceMode === "personal" ? "My workspace" : undefined}
        tone={settings.workspaceMode === "personal" ? "green" : "amber"}
        note={
          settings.workspaceMode === "personal"
            ? "Answers are composed locally from the cases and notes you imported. If no evidence matches, RECALL refuses. Nothing comes from the open web."
            : "Answers and follow-ups are composed locally from this deterministic pack. If no evidence matches, RECALL refuses. Voice input uses the browser speech engine; the private capture path remains on-device."
        }
      />

      <div className="recall-shell">
        <div className="recall-bar">
          <div className="recall-modes">
            <button className={classNames("mode-btn", mode === "ask" && "active")} onClick={() => setMode("ask")}><Icon name="spark" size={15} /> Ask</button>
            <button className={classNames("mode-btn", mode === "search" && "active")} onClick={() => setMode("search")}><Icon name="search" size={15} /> Search</button>
          </div>
          <div className="recall-session">
            <span className="mono xsmall soft">{conversation.length / 2} turns · local</span>
            <button className="btn sm ghost" onClick={clearConversation}><Icon name="refresh" size={12} /> New thread</button>
          </div>
        </div>

        {mode === "ask" ? (
          <div className="chat">
            <div className="chat-thread">
              {conversation.length === 0 && (
                <div className="chat-intro">
                  <span className="kicker">Ask the evidence</span>
                  <h1>What did we promise,<br />and who said it?</h1>
                  <p>Ask a question, then follow up. Every answer cites the exact quote, speaker and timestamp. If the evidence is not there, RECALL says so.</p>
                  <div className="chat-examples">
                    {examples.map((example) => <button key={example} onClick={() => submit(example)}>{example}</button>)}
                  </div>
                  <div className="chat-capabilities">
                    <div><Icon name="quote" size={16} /><b>Cited answers</b><span>Quote, speaker, time, confidence</span></div>
                    <div><Icon name="layers" size={16} /><b>Threaded follow-ups</b><span>“Who said that?” resolves against the last answer</span></div>
                    <div><Icon name="shield" size={16} /><b>Bounded actions</b><span>Prepare a review; never send or delete</span></div>
                  </div>
                </div>
              )}
              {conversation.map((turn) => {
                if (turn.role === "user") {
                  return (
                    <div className="chat-user" key={turn.id}>
                      <div className="chat-bubble">{turn.text}</div>
                    </div>
                  );
                }
                const answer = turn.answer;
                if (!answer) return null;
                return (
                  <div className="chat-assistant" key={turn.id}>
                    <div className="chat-avatar"><Icon name={answer.refused ? "alert" : "quote"} size={15} /></div>
                    <div className={classNames("chat-answer", answer.refused && "refused")}>
                      <div className="chat-answer-head">
                        <span className="kicker">{answer.refused ? "Refused · no evidence" : "Answer from evidence"}</span>
                        <div className="row gap6">
                          {!answer.refused && <Chip tone="green">{Math.round(answer.confidence * 100)}% confidence</Chip>}
                          <span className="mono xsmall soft">{answer.latency_ms} ms</span>
                        </div>
                      </div>
                      <p>{answer.answer}</p>
                      {answer.citations.length > 0 && (
                        <div className="chat-citations">
                          {answer.citations.map((citation, index) => (
                            <Link key={`${citation.meeting_id}-${citation.evidence_id}`} to={`/meetings/${citation.meeting_id}?t=${Math.floor(citation.start)}&e=${citation.evidence_id}`}>
                              <span className="citation-index">{index + 1}</span>
                              <span><b>“{citation.quote}”</b><small>{citation.speaker} · {citation.meeting_title} · {fmtTime(citation.start)}</small></span>
                              <Icon name="arrow" size={13} />
                            </Link>
                          ))}
                        </div>
                      )}
                      {answer.review && <Link className="btn sm primary" to={answer.review.route}><Icon name="edit" size={12} /> {answer.review.label}</Link>}
                      <div className="chat-actions">
                        <button className="btn sm ghost" onClick={() => setShowTrace(showTrace === turn.id ? null : turn.id)}><Icon name="terminal" size={12} /> {showTrace === turn.id ? "Hide" : "Inspect"} trace</button>
                        <span className="xsmall soft">Answers are restricted to local evidence, with citations.</span>
                      </div>
                      {showTrace === turn.id && (
                        <div className="trace">
                          {answer.trace.map((step, index) => (
                            <div className="trace-step" key={step.step}><span className="trace-num">{index + 1}</span><div><b>{step.step}</b><p>{step.detail}</p></div></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={threadEnd} />
            </div>

            {lastAnswer && !lastAnswer.refused && (
              <div className="chat-followups">
                <span>Follow up</span>
                {followUps.map((follow) => <button key={follow} onClick={() => submit(follow)}>{follow}</button>)}
              </div>
            )}

            <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
              <button type="button" className={classNames("mic-btn", listening && "listening")} onClick={startVoice} aria-label="Ask by voice">
                <Icon name={listening ? "pause" : "mic"} size={17} />
              </button>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask a follow-up, or say “show me the moment”…"
                aria-label="Ask the evidence"
              />
              <button className="btn primary" type="submit">Ask <Icon name="arrow" size={13} /></button>
            </form>
            <p className="chat-foot"><Icon name="lock" size={11} /> Local answer policy · no web · no training on your audio</p>
          </div>
        ) : (
          <>
            <div className="recall-search-wrap">
              <form className="recall-search" onSubmit={(event) => { event.preventDefault(); setSubmitted(query); setParams({ q: query }); }}>
                <Icon name="search" size={20} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="delivery, 14th, Sandra, training…" aria-label="Search all captures" />
                <button className="btn primary" type="submit">Search</button>
              </form>
            </div>
            <div className="filter-bar recall-filters">
              <select value={meetingFilter} onChange={(event) => setMeetingFilter(event.target.value)} aria-label="Filter by meeting">
                <option value="all">All captures</option>
                {activeMeetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                {notes[0] && <option value={notes[0].id}>Field notes</option>}
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
              <span className="filter-count"><Icon name="lock" size={12} /> {activeMeetings.length} captures · {notes.length} notes</span>
            </div>
            <div className="result-list">
              {results.map((hit) => {
                const meeting = meetingById(hit.meeting_id);
                const speaker = meeting ? speakerName(meeting, hit.speaker_id) : hit.speaker_id;
                return (
                  <Link key={`${hit.type}-${hit.id}-${hit.start}`} className="result-row" to={`/meetings/${hit.meeting_id}?t=${Math.floor(hit.start)}&e=${hit.evidence_id}`}>
                    <div className="result-time mono">{fmtTime(hit.start)}</div>
                    <div className="result-body">
                      <div className="result-meta">
                        <Chip tone={hit.kind === "promise" ? "amber" : hit.kind === "decision" ? "cyan" : "neutral"}>{hit.kind ?? hit.type}</Chip>
                        <span>{hit.meeting_title}</span><span>·</span><b>{speaker || "field note"}</b>
                        {hit.redacted && <Chip tone="red">redacted</Chip>}
                      </div>
                      <p><Highlight text={hit.text} query={submitted} /></p>
                      <div className="result-foot"><span className="mono">{hit.evidence_id}</span><Confidence value={hit.confidence} /><span className="mono xsmall soft">score {hit.score}</span></div>
                    </div>
                    <span className="result-open">Open <Icon name="arrow" size={13} /></span>
                  </Link>
                );
              })}
              {submitted && results.length === 0 && <Empty title="No evidence matches" detail="Try fewer words, another speaker, or the exact phrase you remember." icon="search" />}
              {!submitted && <div className="recall-blank"><div className="local-policy"><Icon name="search" size={18} /><div><b>Search every capture</b><p>Exact strings, speakers, evidence kinds and notes. Every result opens the timestamp.</p></div></div></div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

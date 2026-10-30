import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtTime, safeQuote } from "../lib/engine";
import { Icon } from "../components/Icon";

type Step = "cold" | "recording" | "search" | "quote" | "trust" | "choice" | "handoff";

const beats: { id: Step; label: string }[] = [
  { id: "cold", label: "The loss" },
  { id: "recording", label: "Capture" },
  { id: "search", label: "Recall" },
  { id: "quote", label: "Prove" },
  { id: "trust", label: "Correct" },
  { id: "choice", label: "Choose" },
  { id: "handoff", label: "Handoff" },
];

export default function Stage() {
  const { pack, meetingById, correctSpeaker, redact, sendMeeting, resetStage, project, events } = useStore();
  const t = useT();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("cold");
  const [lines, setLines] = useState(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [choice, setChoice] = useState<"share" | "redact" | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const searchTimer = useRef<number | undefined>(undefined);

  const stageId = pack?.meta.stage_meeting_id ?? "";
  const meeting = meetingById(stageId) ?? pack?.meetings[0];
  const evidence = meeting?.evidence.find((e) => e.id === "ev_01");
  const internal = meeting?.evidence.find((e) => e.id === "ev_05");
  const corrected = evidence?.speaker_id === "p2";

  useEffect(() => {
    resetStage();
  }, [resetStage]);

  useEffect(() => {
    if (step !== "recording") return;
    setLines(0);
    const timer = window.setInterval(() => {
      setLines((value) => {
        if (value >= 8) {
          window.clearInterval(timer);
          return value;
        }
        return value + 1;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "handoff" || !meeting) return;
    const id = sendMeeting(meeting.id, { safe: choice === "redact" });
    setEventId(id);
    const timer = window.setTimeout(() => setDelivered(true), 900);
    return () => window.clearTimeout(timer);
    // The handoff is a single arc; do not re-send when the store re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const reset = () => {
    window.clearTimeout(searchTimer.current);
    resetStage();
    setStep("cold");
    setLines(0);
    setQuery("");
    setSearching(false);
    setChoice(null);
    setEventId(null);
    setDelivered(false);
  };

  const runSearch = (value = query) => {
    if (!value.trim() || searching) return;
    setQuery(value);
    setSearching(true);
    searchTimer.current = window.setTimeout(() => {
      setSearching(false);
      setStep("quote");
    }, 760);
  };

  const next = () => {
    if (step === "cold") setStep("recording");
    else if (step === "recording") setStep("search");
    else if (step === "search") runSearch();
    else if (step === "quote") setStep("trust");
    else if (step === "trust" && corrected) setStep("choice");
    else if (step === "choice" && choice) setStep("handoff");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (event.key === "Escape") {
        navigate("/");
        return;
      }
      if (event.key.toLowerCase() === "r" && !typing) {
        event.preventDefault();
        reset();
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        if (typing && event.key === "Enter") {
          event.preventDefault();
          runSearch();
          return;
        }
        if (typing) return;
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const liveRows = useMemo(() => meeting?.utterances.slice(0, 8) ?? [], [meeting]);
  const beatIndex = beats.findIndex((beat) => beat.id === step);
  const event = events.find((e) => e.event_id === eventId);
  const redactionEvent = events.find((e) => e.type === "capture.redaction.applied" && e.payload.capture_id === meeting?.capture_id);
  const correctionEvent = events.find((e) => e.type === "capture.correction" && e.payload.capture_id === meeting?.capture_id);

  if (!pack || !meeting || !evidence) return <div className="boot">Loading stage…</div>;

  return (
    <div className={classNames("stage", `stage-step-${step}`)}>
      <header className="stage-top">
        <div className="stage-brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <b>RECALL</b>
          <small>the capture layer for PPMA</small>
        </div>
        <div className="stage-top-right">
          <span className="stage-live"><i className="dot live" /> on-device · offline</span>
          <span className="stage-time mono">90 seconds</span>
          <button className="stage-reset" onClick={reset} title="Reset the piece (R)">
            <Icon name="refresh" size={14} /> {t("stage.reset")} <kbd>R</kbd>
          </button>
          <Link className="stage-exit" to="/" title="Leave the stage piece">Exit</Link>
        </div>
      </header>

      <div className="stage-beats" aria-hidden="true">
        {beats.map((beat, index) => (
          <span key={beat.id} className={classNames("stage-beat", index === beatIndex && "active", index < beatIndex && "done")}>
            <i />
            <b>{beat.label}</b>
          </span>
        ))}
      </div>

      <main className="stage-main">
        {step === "cold" && (
          <section className="beat beat-cold">
            <div className="beat-kicker">A meeting room. A phone on the table.</div>
            <h1>“What did we promise them?”</h1>
            <p className="beat-sub">The room goes quiet. It was in a call three weeks ago. Nobody can find the exact words.</p>
            <button className="record-orb" onClick={() => setStep("recording")} aria-label="Tap record">
              <span className="record-ring" />
              <span className="record-core" />
              <span className="record-label">{t("stage.record")}</span>
            </button>
            <p className="beat-hint">One tap. The transcript appears while the meeting is still happening.</p>
          </section>
        )}

        {step === "recording" && (
          <section className="beat beat-record">
            <div className="record-left">
              <div className="beat-kicker">Live transcript · on device</div>
              <div className="record-timer">
                <span className="rec-dot" /> REC
                <b className="mono">00:00:{String(Math.min(59, lines * 3)).padStart(2, "0")}</b>
              </div>
              <div className="record-level" aria-hidden="true">
                {Array.from({ length: 22 }).map((_, index) => (
                  <i key={index} style={{ animationDelay: `${index * 70}ms`, height: `${18 + ((index * 37) % 62)}%` }} />
                ))}
              </div>
              <p className="record-note"><Icon name="cpu" size={14} /> Parakeet TDT · Apple Neural Engine · local only</p>
              <button className="btn primary lg" onClick={() => setStep("search")}>
                <Icon name="stop" size={12} /> {t("stage.stop")} <kbd>Space</kbd>
              </button>
            </div>
            <div className="live-transcript" aria-live="polite">
              {liveRows.slice(0, lines).map((row) => {
                const speaker = meeting.participants.find((p) => p.id === row.speaker_id);
                const highlighted = /delivery|14th|12th/i.test(row.text);
                return (
                  <div className={classNames("live-row", highlighted && "highlight")} key={row.id}>
                    <span className={`live-speaker sp-${speaker?.color ?? "amber"}`}>{speaker?.initials}</span>
                    <span className="live-body">
                      <b>{speaker?.name}</b>
                      <span className="mono">{fmtTime(row.start)}</span>
                      <p>{row.text}</p>
                    </span>
                  </div>
                );
              })}
              {lines < mergeLength(liveRows.length) && <span className="live-cursor" />}
              {lines >= 8 && <div className="live-done"><Icon name="check" size={13} /> Transcript usable · 4 speakers · confidence 95%</div>}
            </div>
          </section>
        )}

        {step === "search" && (
          <section className="beat beat-search">
            <div className="beat-kicker">The verb · search the meeting</div>
            <h1>Find the promise.</h1>
            <div className={classNames("stage-search", searching && "searching")}>
              <Icon name="search" size={26} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runSearch();
                }}
                placeholder="delivery"
                aria-label="Search the captured meeting"
              />
              <kbd>↵</kbd>
            </div>
            <div className="search-suggest">
              <span>Try</span>
              {["delivery", "14th", "Sandra", "training"].map((word) => (
                <button key={word} onClick={() => runSearch(word)}>“{word}”</button>
              ))}
              <button className="search-go" onClick={() => runSearch("delivery")}>Search “delivery”</button>
            </div>
            <div className={classNames("search-scan", searching && "on")}>
              {searching ? (
                <>
                  <div className="scan-line" />
                  <p><b>Searching locally</b> · 119 transcript rows · 8 extracted evidence items · 4 captures</p>
                </>
              ) : (
                <p className="soft">The quote, the speaker and the timestamp are on this device. Nothing leaves it.</p>
              )}
            </div>
          </section>
        )}

        {step === "quote" && (
          <section className="beat beat-quote">
            <div className="quote-main">
              <div className="beat-kicker">Evidence · exact quote</div>
              <blockquote>“We can hold the 14th, but not the 12th.”</blockquote>
              <div className="quote-meta">
                <span className={`quote-speaker sp-${meeting.participants.find((p) => p.id === evidence.speaker_id)?.color ?? "amber"}`}>
                  <b>{meeting.participants.find((p) => p.id === evidence.speaker_id)?.initials}</b>
                  <span>
                    {meeting.participants.find((p) => p.id === evidence.speaker_id)?.name}
                    <small>{meeting.participants.find((p) => p.id === evidence.speaker_id)?.role}</small>
                  </span>
                </span>
                <span className="quote-time mono">{fmtTime(evidence.start)}</span>
                <span className="quote-meeting">{meeting.title}</span>
              </div>
              <div className="quote-warning">
                <Icon name="alert" size={15} />
                <span>Text confidence <b>93%</b>. Speaker attribution <b>71%</b> — low. The voiceprint is ambiguous between Anna and Marek.</span>
              </div>
              <div className="quote-wave">
                <span className="mono">11:18</span>
                <div className="quote-wave-track">
                  {Array.from({ length: 48 }).map((_, index) => (
                    <i key={index} className={index > 8 && index < 26 ? "on" : ""} style={{ height: `${20 + ((index * 29) % 70)}%` }} />
                  ))}
                </div>
                <span className="mono">11:32</span>
              </div>
              <button className="btn primary lg" onClick={() => setStep("trust")}>
                <Icon name="user" size={14} /> Who actually said it? <kbd>Space</kbd>
              </button>
            </div>
            <aside className="quote-side">
              <div className="stage-card">
                <span className="kicker">What RECALL extracted</span>
                <div className="extract-row"><span className="extract-kind">decision</span><p>Hold the 14th, not the 12th.</p><b>91%</b></div>
                <div className="extract-row"><span className="extract-kind">action</span><p>Send written confirmation before 17:00.</p><b>94%</b></div>
                <div className="extract-row"><span className="extract-kind">question</span><p>Does the 14th include training?</p><b>95%</b></div>
              </div>
              <div className="stage-card soft-card">
                <span className="kicker">Why this matters</span>
                <p>The text is right. The attribution is not certain. A wrong speaker in a legal or client record is a real cost — so the human signs the memory.</p>
              </div>
            </aside>
          </section>
        )}

        {step === "trust" && (
          <section className="beat beat-trust">
            <div className="trust-main">
              <div className="beat-kicker">The trust beat · the human corrects</div>
              <h1>{corrected ? "Corrected. The memory follows." : "It was confident. It was wrong."}</h1>
              <p className="beat-sub">
                {corrected
                  ? "The transcript, the evidence and the PPMA memory now say Marek. The correction is a new event, never a silent mutation."
                  : "RECALL attributed the promise to Anna Voss. The delivery lead said it. Choose the right speaker."}
              </p>
              <div className="speaker-choice">
                {meeting.participants.map((person) => {
                  const isCurrent = evidence.speaker_id === person.id;
                  const isRight = person.id === "p2";
                  return (
                    <button
                      key={person.id}
                      type="button"
                      aria-label={`${person.name}, ${person.role}${isCurrent && !corrected ? ", attributed with low confidence" : ""}`}
                      className={classNames("speaker-option", `sp-${person.color}`, isCurrent && "current", corrected && isRight && "chosen")}
                      onClick={() => {
                        if (!corrected) correctSpeaker(meeting.id, "ev_01", person.id, "wrong speaker — human correction");
                      }}
                      disabled={corrected}
                    >
                      <b>{person.initials}</b>
                      <span>{person.name}<small>{person.role}</small></span>
                      {isCurrent && !corrected && <em>attributed · 71%</em>}
                      {corrected && isRight && <em><Icon name="check" size={12} /> human-verified · 100%</em>}
                      {!corrected && isRight && <em className="hint">the delivery lead</em>}
                    </button>
                  );
                })}
              </div>
              {corrected && (
                <div className="correction-strip">
                  <div>
                    <span className="kicker">capture.correction</span>
                    <p><b>speaker_id</b> p1 → p2 · reason “wrong speaker” · corrected_by team_lead</p>
                  </div>
                  <span className="chip chip-green"><i className="dot live" /> PPMA memory updated</span>
                </div>
              )}
              <button className="btn primary lg" onClick={() => setStep("choice")} disabled={!corrected}>
                Next: what leaves the device? <Icon name="arrow" size={14} />
              </button>
            </div>
            <aside className="trust-side">
              <div className="stage-card transcript-mini">
                <span className="kicker">Transcript · 11:24</span>
                <div className={`mini-speaker sp-${meeting.participants.find((p) => p.id === evidence.speaker_id)?.color ?? "amber"}`}>
                  {meeting.participants.find((p) => p.id === evidence.speaker_id)?.initials}
                </div>
                <p className="mini-quote">“{safeQuote(meeting, evidence, true)}”</p>
                <div className="mini-meta">
                  <span>{meeting.participants.find((p) => p.id === evidence.speaker_id)?.name}</span>
                  <span className="mono">{fmtTime(evidence.start)}</span>
                  {corrected ? <span className="chip chip-green">corrected</span> : <span className="chip chip-amber">71% attribution</span>}
                </div>
                {corrected && correctionEvent && <p className="xsmall soft mt8 mono">event {correctionEvent.event_id}</p>}
              </div>
              <div className="stage-card soft-card">
                <span className="kicker">The line</span>
                <p className="line-quote">“It was confident. It was wrong. The human signs the memory.”</p>
              </div>
            </aside>
          </section>
        )}

        {step === "choice" && (
          <section className="beat beat-choice">
            <div className="beat-kicker">Audience agency · one real decision</div>
            <h1>What leaves the device?</h1>
            <p className="beat-sub">The promise is safe. But at 09:12 the account lead said something about the client that should not follow the quote.</p>
            <div className="choice-grid">
              <button className={classNames("choice-card", choice === "share" && "selected")} onClick={() => setChoice("share")}>
                <span className="choice-head"><Icon name="send" size={18} /> Share the clip as spoken</span>
                <div className="choice-preview">
                  <p className="mono xsmall">PPMA payload preview</p>
                  <p>“We can hold the 14th, but not the 12th.”</p>
                  <p className="exposed">“Between us, Sandra's team is chaotic…”</p>
                </div>
                <span className="choice-foot">The internal comment travels with the facts. Faster, but the client context leaks.</span>
              </button>
              <button className={classNames("choice-card recommended", choice === "redact" && "selected")} onClick={() => { if (choice !== "redact") redact(meeting.id, "ev_05", "client_confidential", "Internal client comment"); setChoice("redact"); }}>
                <span className="choice-head"><Icon name="scissors" size={18} /> Redact first <em>Recommended</em></span>
                <div className="choice-preview">
                  <p className="mono xsmall">PPMA payload preview</p>
                  <p>“We can hold the 14th, but not the 12th.”</p>
                  <p className="redacted-bar"><span>[redacted — internal client comment]</span></p>
                </div>
                <span className="choice-foot">The safe version goes to PPMA. The raw transcript stays local. The room sees exactly what was removed.</span>
              </button>
            </div>
            <div className="choice-foot-row">
              <span className="chip chip-red"><i className="dot bad" /> 1 passage detected · redact-clf 96%</span>
              <span className="chip chip-green"><i className="dot live" /> {choice === "redact" ? "Safe version selected" : choice === "share" ? "Unredacted selected" : "Choose one"}</span>
              <button className="btn primary lg" onClick={() => setStep("handoff")} disabled={!choice}>
                {t("stage.handoff")} <Icon name="send" size={14} />
              </button>
            </div>
          </section>
        )}

        {step === "handoff" && (
          <section className="beat beat-handoff">
            <div className="handoff-main">
              <div className="beat-kicker">The handoff · capture → memory → action</div>
              <h1>{delivered ? t("stage.line") : "Sending the facts…"}</h1>
              <p className="beat-sub">
                {delivered
                  ? "RECALL emits structured facts and a signed evidence pointer. PPMA updates the project, proposes the follow-up, and waits for a human."
                  : "Derived facts, consent, confidence, corrections and redactions — not the raw audio."}
              </p>
              <div className="handoff-events">
                {[
                  { type: "capture.meeting.completed", ok: delivered, detail: "decisions · actions · questions · evidence" },
                  ...(corrected ? [{ type: "capture.correction", ok: delivered, detail: "speaker p1 → p2 · human" }] : []),
                  ...(choice === "redact" ? [{ type: "capture.redaction.applied", ok: delivered, detail: "safe text only" }] : []),
                ].map((item) => (
                  <div className="handoff-event" key={item.type}>
                    <span className={classNames("event-dot", item.ok ? "ok" : "wait")}><i /></span>
                    <div>
                      <b className="mono">{item.type}</b>
                      <small>{item.detail}</small>
                    </div>
                    <span className="mono xsmall">{item.ok ? "delivered" : "sending"}</span>
                  </div>
                ))}
              </div>
              <div className="handoff-envelope">
                <div><span>event_id</span><b className="mono">{eventId ?? "…"}</b></div>
                <div><span>capture_id</span><b className="mono">{meeting.capture_id}</b></div>
                <div><span>sensitivity</span><b>{meeting.sensitivity.replace(/_/g, " ")}</b></div>
                <div><span>media</span><b>not attached · local only</b></div>
                <div><span>evidence pointer</span><b className="mono">recall://captures/{meeting.capture_id.slice(0, 18)}…</b></div>
                <div><span>redactions</span><b>{choice === "redact" ? "1 applied before send" : "none"}</b></div>
              </div>
              <div className="stage-final-actions">
                <button className="btn primary lg" onClick={reset}><Icon name="refresh" size={14} /> Run it again <kbd>R</kbd></button>
                <Link className="btn lg" to="/">Open the product <Icon name="arrow" size={14} /></Link>
                <Link className="btn lg ghost" to="/ppma">See the event log</Link>
              </div>
            </div>
            <aside className="handoff-side">
              <div className="stage-card ppma-card">
                <div className="row between">
                  <span className="kicker">PPMA · project memory</span>
                  <span className="chip chip-green"><i className="dot live" /> updated</span>
                </div>
                <b className="ppma-project">Northgate fit-out</b>
                <p>{project.state || pack.ppma.project.state_after}</p>
                <div className="ppma-facts">
                  <span><b>Deadline</b> 14 Nov</span>
                  <span><b>Action</b> written confirmation</span>
                  <span><b>Question</b> training date</span>
                </div>
                <div className="ppma-followup">
                  <span className="kicker">Follow-up drafted · not sent</span>
                  <p>{project.followup || pack.ppma.project.followup_draft}</p>
                </div>
                <div className="ppma-source"><i /> Source: RECALL · evidence link · consent {meeting.consent.state}</div>
              </div>
              <div className="stage-card soft-card">
                <span className="kicker">The line</span>
                <p className="line-quote">“The meeting is not lost.”</p>
                <p className="xsmall soft">Seven of ten people should be able to repeat it after one run.</p>
              </div>
            </aside>
          </section>
        )}
      </main>

      <footer className="stage-foot">
        <span><kbd>Space</kbd> next</span>
        <span><kbd>R</kbd> reset</span>
        <span><kbd>Esc</kbd> exit</span>
        <span className="stage-foot-line">{t("stage.line")}</span>
        <span className="stage-foot-meta">{pack.meta.model}</span>
      </footer>
    </div>
  );
}

function mergeLength(n: number): number {
  return n;
}

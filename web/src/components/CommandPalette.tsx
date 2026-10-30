import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { fmtTime, speakerName } from "../lib/engine";
import { Icon } from "./Icon";

const pages = [
  { to: "/", label: "Now", detail: "Recent captures, open promises and PPMA state", icon: "wave" },
  { to: "/record", label: "Record", detail: "Consent, device state and a new capture", icon: "record" },
  { to: "/meetings", label: "Meetings", detail: "Transcript, evidence, redaction and retention", icon: "layers" },
  { to: "/recall", label: "Recall", detail: "Ask the evidence or search every meeting", icon: "search" },
  { to: "/ppma", label: "PPMA north app", detail: "Manifest, events, queue and conformance", icon: "send" },
  { to: "/field", label: "Field capture", detail: "Offline notes and photo OCR", icon: "pin" },
  { to: "/pilot", label: "Pilot dashboard", detail: "Latency, usefulness, consent and conversion", icon: "gauge" },
  { to: "/admin", label: "Team administration", detail: "Spaces, roles, devices, billing and residency", icon: "shield" },
  { to: "/health", label: "Capture health", detail: "Models, drift, devices and the kill switch", icon: "activity" },
  { to: "/settings", label: "Settings & data rights", detail: "Consent, retention, language and theme", icon: "settings" },
  { to: "/booth", label: "Booth demo", detail: "A three-minute guided run", icon: "play" },
  { to: "/design", label: "Design system", detail: "Tokens, components and motion", icon: "grid" },
  { to: "/about", label: "About RECALL", detail: "The boundary with PPMA and the business model", icon: "book" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { search, ask, meetingById, pack } = useStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const hits = useMemo(() => (open && query.trim() ? search(query, { limit: 6 }) : []), [open, query, search]);
  const answer = useMemo(() => (open && query.trim().length > 3 ? ask(query) : null), [open, query, ask]);
  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages.slice(0, 6);
    return pages.filter((p) => `${p.label} ${p.detail}`.toLowerCase().includes(q)).slice(0, 5);
  }, [query]);

  const rows = useMemo(() => {
    const list: { kind: "hit" | "page"; to: string; title: string; detail: string; icon: string; meta?: string }[] = [];
    for (const hit of hits) list.push({ kind: "hit", to: `/meetings/${hit.meeting_id}?t=${Math.floor(hit.start)}&e=${hit.evidence_id}`, title: hit.text, detail: hit.meeting_title, icon: hit.kind === "decision" || hit.kind === "promise" ? "quote" : "layers", meta: `${fmtTime(hit.start)} · ${Math.round(hit.confidence * 100)}%` });
    for (const page of filteredPages) list.push({ kind: "page", to: page.to, title: page.label, detail: page.detail, icon: page.icon });
    return list;
  }, [hits, filteredPages]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((value) => Math.min(rows.length - 1, value + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((value) => Math.max(0, value - 1));
      }
      if (event.key === "Enter" && rows[cursor]) {
        event.preventDefault();
        navigate(rows[cursor].to);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows, cursor, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="cmdk-back" onClick={onClose}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}>
        <div className="cmdk-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a quote, a person, a promise — or ask a question…"
            aria-label="Search or ask"
          />
          <kbd>Esc</kbd>
        </div>

        {answer && query.trim() && (
          <div className="cmdk-answer">
            <div className="cmdk-answer-head">
              <span className="kicker">Answer from your evidence</span>
              <span className={answer.refused ? "chip chip-red" : "chip chip-green"}>{answer.refused ? "No evidence" : `${Math.round(answer.confidence * 100)}% confidence`}</span>
            </div>
            <p>{answer.answer}</p>
            {answer.citations.length > 0 && (
              <div className="cmdk-cites">
                {answer.citations.slice(0, 2).map((citation) => (
                  <button
                    key={`${citation.meeting_id}-${citation.evidence_id}`}
                    className="cmdk-cite"
                    onClick={() => {
                      const meeting = meetingById(citation.meeting_id);
                      if (meeting) navigate(`/meetings/${meeting.id}?t=${Math.floor(citation.start)}&e=${citation.evidence_id}`);
                      onClose();
                    }}
                  >
                    <Icon name="quote" size={12} />
                    <span>“{citation.quote}”</span>
                    <b>{citation.speaker} · {fmtTime(citation.start)}</b>
                  </button>
                ))}
              </div>
            )}
            <div className="cmdk-trace">
              {answer.trace.map((step) => (
                <span key={step.step}><b>{step.step}</b> {step.detail}</span>
              ))}
            </div>
          </div>
        )}

        <div className="cmdk-list">
          {rows.length === 0 && <div className="cmdk-empty">No matches in local evidence. Try “14th”, “delivery”, or “Sandra”.</div>}
          {rows.map((row, index) => (
            <button
              key={`${row.kind}-${row.to}-${index}`}
              className={`cmdk-row${index === cursor ? " sel" : ""}`}
              onMouseEnter={() => setCursor(index)}
              onClick={() => {
                navigate(row.to);
                onClose();
              }}
            >
              <span className="cmdk-ico"><Icon name={row.icon} size={15} /></span>
              <span className="cmdk-copy">
                <b>{row.title}</b>
                <small>{row.detail}</small>
              </span>
              {row.kind === "hit" && <span className="cmdk-meta">{row.meta}</span>}
              {row.kind === "page" && <Icon name="chevron" size={14} />}
            </button>
          ))}
        </div>

        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>/</kbd> search</span>
          <span className="cmdk-model">{pack?.meta.model ?? "local evidence only"}</span>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { fmtDate, fmtDuration, pct } from "../lib/engine";
import { PageHead, Panel, Chip, Status, ConsentBadge, DataNote, Empty } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Meetings() {
  const { pack, activeMeetings, tombstoned, notes, settings, resetMeeting, sendNote, say } = useStore();
  const t = useT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [speaker, setSpeaker] = useState("all");
  const [sort, setSort] = useState("new");
  if (!pack) return null;

  const speakers = useMemo(() => {
    const map = new Map<string, string>();
    activeMeetings.forEach((meeting) => meeting.participants.forEach((person) => map.set(person.id, person.name)));
    return [...map.entries()];
  }, [activeMeetings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeMeetings
      .filter((meeting) => {
        if (status !== "all" && meeting.status !== status) return false;
        if (speaker !== "all" && !meeting.participants.some((p) => p.id === speaker)) return false;
        if (!q) return true;
        return `${meeting.title} ${meeting.summary} ${meeting.participants.map((p) => p.name).join(" ")} ${meeting.tags.join(" ")}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (sort === "new" ? (a.started_at < b.started_at ? 1 : -1) : a.started_at > b.started_at ? 1 : -1));
  }, [activeMeetings, query, status, speaker, sort]);

  return (
    <>
      <PageHead
        kicker="The capture library"
        title={t("meetings.title")}
        subtitle={t("meetings.subtitle")}
        actions={
          <>
            <Link className="btn primary" to="/record"><Icon name="record" size={14} /> New capture</Link>
            <Link className="btn" to="/recall"><Icon name="search" size={14} /> Search all</Link>
          </>
        }
      />
      <DataNote
        seed={pack.meta.seed}
        label={settings.workspaceMode === "personal" ? "My workspace" : undefined}
        tone={settings.workspaceMode === "personal" ? "green" : "amber"}
        note={
          settings.workspaceMode === "personal"
            ? "My workspace: the four synthetic meetings are hidden. Only captures and notes you create are listed."
            : undefined
        }
      />

      <div className="filter-bar">
        <label className="filter-search">
          <Icon name="search" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by title, person or tag…" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="captured">Captured</option>
          <option value="sent">Sent to PPMA</option>
          <option value="queued">Queued</option>
        </select>
        <select value={speaker} onChange={(event) => setSpeaker(event.target.value)} aria-label="Filter by speaker">
          <option value="all">All speakers</option>
          {speakers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
        <span className="filter-count">{filtered.length} of {activeMeetings.length}</span>
      </div>

      <div className="meeting-grid">
        {filtered.map((meeting) => {
          const redactions = meeting.redactions.filter((r) => r.status === "applied").length;
          const detected = meeting.redactions.filter((r) => r.status === "detected").length;
          const actions = meeting.actions.filter((a) => a.status !== "done").length;
          const confidence = meeting.evidence.reduce((sum, e) => sum + e.confidence, 0) / Math.max(1, meeting.evidence.length);
          return (
            <article className="meeting-card" key={meeting.id}>
              <div className="meeting-card-top">
                <span className={`meeting-icon sp-${meeting.participants[0]?.color ?? "amber"}`}>
                  <Icon name={meeting.mode === "call" ? "headphones" : meeting.mode === "import" ? "download" : "wave"} size={18} />
                </span>
                <div className="meeting-title">
                  <Link to={`/meetings/${meeting.id}`}><h2>{meeting.title}</h2></Link>
                  <span>{fmtDate(meeting.started_at, settings.lang)} · {fmtDuration(meeting.duration_s)} · {meeting.participants.length} speakers</span>
                </div>
                <Status value={meeting.status} />
              </div>
              <p className="meeting-summary">{meeting.summary}</p>
              <div className="meeting-tags">
                <ConsentBadge state={meeting.consent.state} />
                <Chip tone="violet">{meeting.sensitivity.replace(/_/g, " ")}</Chip>
                <Chip>{meeting.language.toUpperCase()}</Chip>
                {meeting.import && <Chip tone="amber">import</Chip>}
                {detected > 0 && <Chip tone="red">{detected} detected passage{detected === 1 ? "" : "s"}</Chip>}
                {redactions > 0 && <Chip tone="green">{redactions} redacted</Chip>}
              </div>
              <div className="meeting-people">
                {meeting.participants.map((person) => (
                  <span className={`person sp-${person.color}`} key={person.id}>
                    <i>{person.initials}</i>
                    <span>{person.name}<small>{person.role}</small></span>
                  </span>
                ))}
              </div>
              <footer className="meeting-foot">
                <span><b>{meeting.evidence.length}</b> evidence</span>
                <span><b>{meeting.decisions.length}</b> decisions</span>
                <span><b>{actions}</b> open actions</span>
                <span><b>{pct(confidence, 0)}</b> conf.</span>
                <Link className="btn sm" to={`/meetings/${meeting.id}`}>Open <Icon name="arrow" size={12} /></Link>
              </footer>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && <Empty title="No capture matches" detail="Try another person, status or tag." icon="layers" />}

      <div className="meetings-lower">
        <Panel title="Field notes" sub={`${notes.length} notes · photo OCR and location stay local`} actions={<Link className="btn sm" to="/field">Capture a note</Link>}>
          <div className="note-list">
            {notes.map((note) => (
              <div className="note-card" key={note.id}>
                <div className="row between">
                  <span className="kicker">{note.location.label}</span>
                  <Status value={note.ppma.event_id ? "delivered" : "pending"} />
                </div>
                <b>{note.title}</b>
                <p>{note.text}</p>
                {note.photo.ocr && <pre className="ocr-snip">{note.photo.ocr}</pre>}
                <div className="row between">
                  <span className="xsmall soft">{fmtDate(note.captured_at, settings.lang)} · {note.offline_captured ? "offline capture" : "online"}</span>
                  <button className="btn sm" onClick={() => { sendNote(note.id); say("Field note sent to PPMA with its evidence pointer"); }}>
                    <Icon name="send" size={12} /> Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Tombstones" sub="Deletion is not a silent drop">
          <div className="tombstone-list">
            {tombstoned.map((meeting) => (
              <div className="tombstone" key={meeting.id}>
                <div className="row between">
                  <b>{meeting.title}</b>
                  <Chip tone="red">tombstone</Chip>
                </div>
                <p>{meeting.deleted_reason?.replace(/_/g, " ")} · {fmtDate(meeting.deleted_at ?? meeting.ended_at, settings.lang)}</p>
                <div className="row between">
                  <span className="mono xsmall soft">{meeting.tombstone_id}</span>
                  <button className="btn sm ghost" onClick={() => resetMeeting(meeting.id)}>Restore for demo</button>
                </div>
              </div>
            ))}
            {tombstoned.length === 0 && <Empty title="No tombstones" detail="Delete a capture to prove that deletion is provable." icon="trash" />}
          </div>
        </Panel>
      </div>
    </>
  );
}

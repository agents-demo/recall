import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtTime, pct, speakerName } from "../lib/engine";
import { PageHead, Panel, Chip, DataNote, Confidence } from "../components/UI";
import { Icon } from "../components/Icon";

type NodeType = "project" | "meeting" | "evidence" | "person" | "note";

interface CanvasNode {
  id: string;
  type: NodeType;
  label: string;
  sub: string;
  x: number;
  y: number;
  r: number;
  color: string;
  meeting_id?: string;
  evidence_id?: string;
  route: string;
  detail?: string;
}

interface CanvasEdge {
  from: string;
  to: string;
  kind: string;
}

const W = 1200;
const H = 760;
const CX = 600;
const CY = 380;

export default function Canvas() {
  const { pack, activeMeetings, notes, memory } = useStore();
  const t = useT();
  const [filter, setFilter] = useState<"all" | "meetings" | "evidence" | "people">("all");
  const [selected, setSelected] = useState<string | null>(null);
  if (!pack) return null;

  const { nodes, edges } = useMemo(() => {
    const nodes: CanvasNode[] = [
      {
        id: "project",
        type: "project",
        label: pack.ppma.project.name,
        sub: "PPMA project memory",
        x: CX,
        y: CY,
        r: 42,
        color: "violet",
        route: "/ppma",
        detail: pack.ppma.project.state_after,
      },
    ];
    const edges: CanvasEdge[] = [];
    const meetings = activeMeetings.slice(0, 6);
    meetings.forEach((meeting, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, meetings.length) - Math.PI / 2;
      const mx = CX + Math.cos(angle) * 230;
      const my = CY + Math.sin(angle) * 200;
      nodes.push({
        id: `m:${meeting.id}`,
        type: "meeting",
        label: meeting.title,
        sub: `${meeting.participants.length} people · ${meeting.evidence.length} evidence`,
        x: mx,
        y: my,
        r: 24,
        color: meeting.sensitivity === "financial" ? "red" : meeting.sensitivity === "personal" ? "cyan" : "amber",
        meeting_id: meeting.id,
        route: `/meetings/${meeting.id}`,
        detail: meeting.summary,
      });
      edges.push({ from: "project", to: `m:${meeting.id}`, kind: "memory" });
      meeting.evidence.slice(0, 6).forEach((evidence, evidenceIndex) => {
        const count = Math.min(6, meeting.evidence.length);
        const spread = 1.15;
        const evidenceAngle = angle + (evidenceIndex - (count - 1) / 2) * (spread / Math.max(1, count - 1));
        const ex = mx + Math.cos(evidenceAngle) * 82;
        const ey = my + Math.sin(evidenceAngle) * 82;
        nodes.push({
          id: `e:${meeting.id}:${evidence.id}`,
          type: "evidence",
          label: evidence.quote.length > 38 ? `${evidence.quote.slice(0, 38)}…` : evidence.quote,
          sub: `${evidence.kind} · ${fmtTime(evidence.start)} · ${pct(evidence.confidence)}`,
          x: ex,
          y: ey,
          r: 8,
          color: evidence.kind === "promise" ? "amber" : evidence.kind === "decision" ? "cyan" : evidence.kind === "action" ? "green" : evidence.kind === "question" ? "violet" : "red",
          meeting_id: meeting.id,
          evidence_id: evidence.id,
          route: `/meetings/${meeting.id}?t=${Math.floor(evidence.start)}&e=${evidence.id}`,
          detail: evidence.quote,
        });
        edges.push({ from: `m:${meeting.id}`, to: `e:${meeting.id}:${evidence.id}`, kind: evidence.kind });
      });
    });

    const people = new Map<string, { id: string; name: string; role: string; color: string; meetings: string[] }>();
    activeMeetings.forEach((meeting) => {
      meeting.participants.forEach((person) => {
        const existing = people.get(person.id) ?? { id: person.id, name: person.name, role: person.role, color: person.color, meetings: [] };
        existing.meetings.push(meeting.id);
        people.set(person.id, existing);
      });
    });
    [...people.values()].slice(0, 10).forEach((person, index, all) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, all.length) + Math.PI / 8;
      const px = CX + Math.cos(angle) * 330;
      const py = CY + Math.sin(angle) * 300;
      nodes.push({
        id: `p:${person.id}`,
        type: "person",
        label: person.name,
        sub: person.role,
        x: px,
        y: py,
        r: 15,
        color: person.color,
        route: `/recall?q=${encodeURIComponent(person.name)}`,
        detail: `${person.name} appears in ${person.meetings.length} capture${person.meetings.length === 1 ? "" : "s"}.`,
      });
      person.meetings.forEach((meetingId) => edges.push({ from: `p:${person.id}`, to: `m:${meetingId}`, kind: "person" }));
    });

    notes.slice(0, 2).forEach((note, index) => {
      const nx = 120 + index * 70;
      const ny = 650 - index * 40;
      nodes.push({
        id: `n:${note.id}`,
        type: "note",
        label: note.title,
        sub: note.location.label,
        x: nx,
        y: ny,
        r: 16,
        color: "green",
        route: "/field",
        detail: note.text,
      });
      edges.push({ from: "project", to: `n:${note.id}`, kind: "note" });
    });

    return { nodes, edges };
  }, [pack, activeMeetings, notes]);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const dimmed = (node: CanvasNode) => filter === "meetings" ? node.type !== "meeting" && node.type !== "project" : filter === "evidence" ? node.type !== "evidence" : filter === "people" ? node.type !== "person" : false;
  const related = selectedNode
    ? edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).map((edge) => nodeById.get(edge.from === selectedNode.id ? edge.to : edge.from)).filter((node): node is CanvasNode => Boolean(node))
    : [];

  return (
    <>
      <PageHead
        kicker="Memory canvas · capture, evidence and people in one place"
        title="The project, as evidence."
        subtitle="Meetings, quotes, people and field notes are one explorable graph. Click a node to inspect it; every edge is a real relationship in the pack."
        actions={<Chip tone="green" dot="live">{nodes.length} nodes · {edges.length} edges</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="The graph is generated from the same deterministic pack. It is an inspectable memory view, not an inferred model of the project." />

      <div className="canvas-layout">
        <div className="canvas-main">
          <div className="canvas-toolbar">
            <div className="segmented">
              {(["all", "meetings", "evidence", "people"] as const).map((value) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>
              ))}
            </div>
            <div className="canvas-legend">
              <span><i className="legend-dot amber" /> promise/meeting</span>
              <span><i className="legend-dot cyan" /> decision</span>
              <span><i className="legend-dot green" /> action</span>
              <span><i className="legend-dot violet" /> question/person</span>
              <span><i className="legend-dot red" /> sensitive</span>
            </div>
          </div>
          <div className="canvas-stage">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Memory canvas">
              <defs>
                <radialGradient id="projectGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
              </defs>
              {edges.map((edge, index) => {
                const from = nodeById.get(edge.from);
                const to = nodeById.get(edge.to);
                if (!from || !to) return null;
                return <line key={`${edge.from}-${edge.to}-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={classNames("canvas-edge", `edge-${edge.kind}`, selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id) && "hot")} />;
              })}
              {nodes.map((node) => (
                <g
                  key={node.id}
                  className={classNames("canvas-node", `node-${node.type}`, `nc-${node.color}`, dimmed(node) && "dim", selected === node.id && "selected", selectedNode && related.some((item) => item.id === node.id) && "related")}
                  onClick={() => setSelected(node.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(node.id); } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.label} ${node.sub}`}
                >
                  {node.type === "project" && <circle cx={node.x} cy={node.y} r={110} fill="url(#projectGlow)" className="canvas-glow" />}
                  <circle cx={node.x} cy={node.y} r={node.r} />
                  <text x={node.x} y={node.y + node.r + 13} textAnchor="middle" className="canvas-label">{node.label}</text>
                  {node.type !== "evidence" && <text x={node.x} y={node.y + node.r + 25} textAnchor="middle" className="canvas-sub">{node.sub}</text>}
                </g>
              ))}
            </svg>
          </div>
          <p className="capture-foot"><Icon name="grid" size={12} /> {activeMeetings.length} captures · {nodes.filter((node) => node.type === "evidence").length} evidence nodes · {nodes.filter((node) => node.type === "person").length} people · {memory.filter((entry) => entry.state === "active").length} active memories</p>
        </div>

        <aside className="canvas-side">
          {selectedNode ? (
            <Panel title={selectedNode.type} sub={selectedNode.label}>
              <p className="canvas-detail">{selectedNode.detail ?? selectedNode.sub}</p>
              <div className="canvas-meta">
                <span><b>Type</b>{selectedNode.type}</span>
                <span><b>Evidence</b>{selectedNode.evidence_id ?? "—"}</span>
                <span><b>Meeting</b>{selectedNode.meeting_id ?? "—"}</span>
                <span><b>Source</b>RECALL</span>
              </div>
              <Link className="btn primary sm" to={selectedNode.route}>Open {selectedNode.type} <Icon name="arrow" size={12} /></Link>
              {related.length > 0 && (
                <div className="canvas-related">
                  <span className="kicker">Connected</span>
                  {related.slice(0, 6).map((node) => <button key={node.id} onClick={() => setSelected(node.id)}><i className={`legend-dot ${node.color}`} /> {node.label}</button>)}
                </div>
              )}
            </Panel>
          ) : (
            <Panel title="Inspect the graph" sub="Click any node">
              <p className="small muted">The canvas is a different way into the same evidence: start from a person, a meeting or a quote. It never invents a relationship that is not in the pack.</p>
              <div className="canvas-hints">
                <div><Icon name="user" size={15} /><span><b>People</b> appear in the captures they attended.</span></div>
                <div><Icon name="quote" size={15} /><span><b>Evidence</b> links to a meeting and a timestamp.</span></div>
                <div><Icon name="layers" size={15} /><span><b>Meetings</b> attach to the PPMA project memory.</span></div>
                <div><Icon name="pin" size={15} /><span><b>Field notes</b> attach with their location.</span></div>
              </div>
            </Panel>
          )}
          <Panel title="This is not a second brain" sub="The boundary still holds">
            <ul className="plain-list">
              <li><Icon name="check" size={12} /> Every edge is derived from a capture.</li>
              <li><Icon name="check" size={12} /> Clicking a node opens the evidence.</li>
              <li><Icon name="x" size={12} /> No inferred influence, no hidden model.</li>
              <li><Icon name="x" size={12} /> No project actions from this canvas.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}

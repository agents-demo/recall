import { useMemo, useState, type ReactNode } from "react";
import { classNames, hashString, pct } from "../lib/engine";
import { useT } from "../lib/i18n";
import { Icon } from "./Icon";
import type { ConsentState, Meeting } from "../types";

export function PageHead({ kicker, title, subtitle, actions }: { kicker?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, sub, actions, children, className, tight }: { title?: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string; tight?: boolean }) {
  return (
    <section className={classNames("panel", className)}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <span className="sub">{sub}</span>}
          </div>
          {actions && <div className="row gap6">{actions}</div>}
        </header>
      )}
      <div className={classNames("panel-body", tight && "tight")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, note, tone, icon }: { label: string; value: ReactNode; note?: string; tone?: string; icon?: string }) {
  return (
    <div className={classNames("stat", tone && `tone-${tone}`)}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <Icon name={icon} size={14} />}
      </div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

export function Chip({ children, tone, dot, title }: { children: ReactNode; tone?: string; dot?: string; title?: string }) {
  return (
    <span className={classNames("chip", tone && `chip-${tone}`)} title={title}>
      {dot && <i className={classNames("dot", dot)} />}
      {children}
    </span>
  );
}

const statusLabels: Record<string, string> = {
  captured: "Captured",
  sent: "Sent to PPMA",
  queued: "Queued",
  tombstoned: "Tombstone",
  delivered: "Delivered",
  failed: "Failed",
  duplicate: "Duplicate",
  rejected: "Rejected",
  applied: "Applied",
  detected: "Detected",
  pending: "Pending",
  granted: "Consent granted",
  withdrawn: "Consent withdrawn",
  pass: "Pass",
  watch: "Watch",
  active: "Active",
  retired: "Retired",
  suppressed: "Suppressed",
  healthy: "Healthy",
};

export function Status({ value, tone, children }: { value: string; tone?: string; children?: ReactNode }) {
  const auto: Record<string, string> = {
    captured: "amber",
    sent: "green",
    delivered: "green",
    queued: "amber",
    tombstoned: "neutral",
    withdrawn: "red",
    failed: "red",
    detected: "red",
    applied: "green",
    pending: "amber",
    pass: "green",
    watch: "amber",
    active: "green",
    retired: "neutral",
    suppressed: "red",
  };
  const cls = tone ?? auto[value] ?? "neutral";
  return (
    <span className={classNames("status", `status-${cls}`)}>
      <i className="dot" />
      {children ?? statusLabels[value] ?? value}
    </span>
  );
}

export function ConsentBadge({ state }: { state: ConsentState }) {
  return <Status value={state} tone={state === "granted" ? "green" : state === "withdrawn" ? "red" : "amber"} />;
}

export function SpeakerChip({ name, initials, color, role }: { name: string; initials: string; color?: string; role?: string }) {
  return (
    <span className={classNames("speaker-chip", `sp-${color ?? "amber"}`)}>
      <b>{initials}</b>
      <span>
        {name}
        {role && <small>{role}</small>}
      </span>
    </span>
  );
}

export function Confidence({ value, label = true }: { value: number; label?: boolean }) {
  const tone = value >= 0.9 ? "green" : value >= 0.75 ? "amber" : "red";
  return (
    <span className={classNames("confidence", `confidence-${tone}`)} title={`Confidence ${pct(value)}`}>
      <span className="confidence-track"><i style={{ width: `${Math.round(value * 100)}%` }} /></span>
      {label && <span className="confidence-value">{pct(value)}</span>}
    </span>
  );
}

export function Meter({ value, tone = "amber", label, valueLabel }: { value: number; tone?: string; label?: string; valueLabel?: string }) {
  return (
    <div className="meter-wrap">
      {(label || valueLabel) && (
        <div className="meter-head">
          <span>{label}</span>
          <b>{valueLabel ?? pct(value)}</b>
        </div>
      )}
      <div className="meter">
        <i className={`meter-fill tone-${tone}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={classNames("toggle", checked && "on")} onClick={() => onChange(!checked)} role="switch" aria-checked={checked} aria-label={label}>
      <span className="toggle-thumb" />
    </button>
  );
}

export function Waveform({
  duration,
  progress,
  seed,
  redactions = [],
  onSeek,
  big,
}: {
  duration: number;
  progress: number;
  seed: string;
  redactions?: { start: number; end: number }[];
  onSeek?: (seconds: number) => void;
  big?: boolean;
}) {
  const bars = big ? 96 : 140;
  const heights = useMemo(
    () => Array.from({ length: bars }, (_, i) => 18 + (parseInt(hashString(`${seed}:${i}`).slice(0, 2), 16) % 82)),
    [seed, bars],
  );
  const active = Math.round((progress / Math.max(1, duration)) * bars);
  return (
    <div
      className={classNames("waveform", big && "waveform-big")}
      role={onSeek ? "slider" : "img"}
      aria-label="Meeting timeline"
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? Math.round(duration) : undefined}
      aria-valuenow={onSeek ? Math.round(progress) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onClick={(event) => {
        if (!onSeek) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - rect.left) / rect.width) * duration);
      }}
      onKeyDown={(event) => {
        if (!onSeek) return;
        if (event.key === "ArrowRight") onSeek(Math.min(duration, progress + 5));
        if (event.key === "ArrowLeft") onSeek(Math.max(0, progress - 5));
      }}
    >
      {heights.map((height, i) => {
        const seconds = (i / bars) * duration;
        const redacted = redactions.some((r) => seconds >= r.start && seconds <= r.end);
        return (
          <i
            key={i}
            className={classNames("wave-bar", i <= active && "played", redacted && "redacted")}
            style={{ height: `${height}%`, animationDelay: `${i * 4}ms` }}
          />
        );
      })}
    </div>
  );
}

export function ProvenanceList({ items, note }: { items: Record<string, string>; note?: string }) {
  return (
    <div className="provenance-list">
      {Object.entries(items).map(([key, value]) => (
        <div className="prov-row" key={key}>
          <span>{key.replace(/_/g, " ")}</span>
          <b>{value}</b>
        </div>
      ))}
      {note && <p className="xsmall soft mt8">{note}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, kicker, children, wide }: { open: boolean; onClose: () => void; title: string; kicker?: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={classNames("modal", wide && "modal-wide")} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name={copied ? "check" : "file"} size={13} />
      {copied ? "Copied" : label}
    </button>
  );
}

export function Empty({ title, detail, icon = "quote" }: { title: string; detail?: string; icon?: string }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={22} />
      <b>{title}</b>
      {detail && <p>{detail}</p>}
    </div>
  );
}

export function DataNote({ seed, note }: { seed?: number; note?: string }) {
  const t = useT();
  return (
    <div className="data-note" role="note">
      <Chip tone="amber" dot="warn">{t("data.reference")}</Chip>
      <span>
        {note ??
          `Synthetic, generated in-house with a fixed seed${seed ? ` (${seed})` : ""}. No customer audio, transcript or personal data. The audio timeline is a visualisation; raw media is not in this build.`}
      </span>
    </div>
  );
}

export function SourceChip({ meeting }: { meeting?: Meeting }) {
  return (
    <span className="source-chip">
      <i className="source-dot" /> Source: RECALL
      {meeting && <small>{meeting.capture_id.slice(0, 14)}…</small>}
    </span>
  );
}

export function timelineProgress(meeting: Meeting): string {
  return `${Math.round((meeting.utterances.length / Math.max(1, meeting.duration_s / 7)) * 100)}%`;
}

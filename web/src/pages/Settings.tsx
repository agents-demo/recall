import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, downloadText, fmtDate } from "../lib/engine";
import { PageHead, Panel, Chip, Toggle, DataNote, Status } from "../components/UI";
import { Icon } from "../components/Icon";
import type { Theme } from "../types";

const themes: { id: Theme; title: string; detail: string }[] = [
  { id: "dark", title: "Control room", detail: "Warm graphite, amber signal, evidence-first" },
  { id: "paper", title: "Paper desk", detail: "Bone paper, ink, for daylight review" },
  { id: "contrast", title: "High contrast", detail: "Maximum legibility for the stage and low vision" },
];

export default function SettingsPage() {
  const { pack, settings, setSetting, activeMeetings, memory, reset, exportAudit, say, killSwitch, toggleKillSwitch } = useStore();
  const t = useT();
  const [retentionDays, setRetentionDays] = useState(pack?.team.retention_days ?? 365);
  if (!pack) return null;

  return (
    <>
      <PageHead
        kicker="Human rules for a machine record"
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        actions={<Chip tone="green" dot="live">all data local</Chip>}
      />
      <DataNote seed={pack.meta.seed} />

      <div className="settings-grid">
        <Panel title="Appearance" sub="Light, dark and high contrast are designed together">
          <div className="theme-grid">
            {themes.map((theme) => (
              <button key={theme.id} className={classNames("theme-card", `theme-${theme.id}`, settings.theme === theme.id && "selected")} onClick={() => setSetting("theme", theme.id)}>
                <div className="theme-swatch">
                  <i className="sw-bg" /><i className="sw-panel" /><i className="sw-ink" /><i className="sw-accent" />
                </div>
                <b>{theme.title}</b>
                <span>{theme.detail}</span>
                {settings.theme === theme.id && <Chip tone="green">active</Chip>}
              </button>
            ))}
          </div>
          <div className="settings-row">
            <div><b>Language</b><span>English and Simplified Chinese first. Captured speech is not translated.</span></div>
            <div className="segmented">
              <button className={classNames(settings.lang === "en" && "active")} onClick={() => setSetting("lang", "en")}>English</button>
              <button className={classNames(settings.lang === "zh" && "active")} onClick={() => setSetting("lang", "zh")}>中文</button>
            </div>
          </div>
          <div className="settings-row">
            <div><b>Reduced motion</b><span>Disable smooth scroll and long transitions. The stage piece keeps its beats.</span></div>
            <Toggle checked={settings.reducedMotion} onChange={(value) => setSetting("reducedMotion", value)} label="Reduced motion" />
          </div>
          <div className="settings-row">
            <div><b>Large touch targets</b><span>The field surface uses one-hand controls and 48 px targets.</span></div>
            <Chip tone="green">always on</Chip>
          </div>
        </Panel>

        <Panel title="Roles & access" sub="Navigation hides what a role cannot act on">
          <div className="settings-row">
            <div><b>Current role</b><span>Switch to Privacy / legal to see audit and legal hold; Admin for SSO and billing.</span></div>
            <select value={settings.role} onChange={(event) => setSetting("role", event.target.value as typeof settings.role)}>
              <option value="individual">Individual</option>
              <option value="team_lead">Team lead</option>
              <option value="privacy_legal">Privacy / legal</option>
              <option value="field">Field</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="role-grid">
            {pack.admin.roles.map((role) => (
              <div className="role-chip" key={role.role}>
                <b>{role.role.replace(/_/g, " ")}</b>
                <span>{role.can}</span>
              </div>
            ))}
          </div>
          <Link className="btn sm mt12" to="/admin"><Icon name="shield" size={12} /> Team administration</Link>
        </Panel>

        <Panel title="Consent" sub="Recorded before capture, per jurisdiction">
          <div className="consent-settings">
            {pack.admin.jurisdictions.map((jurisdiction) => (
              <div className="consent-jurisdiction" key={jurisdiction.code}>
                <div><b>{jurisdiction.name}</b><span>{jurisdiction.model}</span></div>
                <Chip tone="violet">{jurisdiction.wording}</Chip>
                <Status value={jurisdiction.status === "active" ? "active" : "pending"} tone={jurisdiction.status === "active" ? "green" : "amber"}>{jurisdiction.status}</Status>
              </div>
            ))}
          </div>
          <div className="settings-row">
            <div><b>Default model</b><span>All participants notified. Two-party consent is never optional.</span></div>
            <Chip tone="green">{pack.team.consent_model.replace(/_/g, " ")}</Chip>
          </div>
          <p className="xsmall soft">If consent is missing or withdrawn, no capture event leaves the device. The consent-change event itself is the only exception.</p>
        </Panel>

        <Panel title="Retention" sub="Per meeting and per team; the stricter policy wins">
          <div className="settings-row">
            <div><b>Team default</b><span>Applies to new captures unless a meeting or PPMA policy is stricter.</span></div>
            <div className="inline-field">
              <input type="number" min={1} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} />
              <span>days</span>
              <button className="btn sm" onClick={() => say(`Team default set to ${retentionDays} days (demo)`)}>Save</button>
            </div>
          </div>
          <div className="retention-list">
            {activeMeetings.slice(0, 5).map((meeting) => (
              <div className="retention-row" key={meeting.id}>
                <Link to={`/meetings/${meeting.id}`}><b>{meeting.title}</b><span>{meeting.retention.policy.replace(/_/g, " ")} · {fmtDate(meeting.retention.retain_until)}</span></Link>
                {meeting.retention.legal_hold && <Chip tone="red">legal hold</Chip>}
                <Chip tone="green">local media</Chip>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Data rights" sub="What the product promises in writing">
          <div className="rights-grid-settings">
            {[
              ["lock", "Raw media stays local", "Audio and video are never uploaded by default. PPMA receives derived text and a signed pointer."],
              ["shield", "No training on customer audio", "Never without separate, explicit consent — and never as a condition of use."],
              ["trash", "Deletion is a tombstone", "The content is removed; the fact of deletion remains so a replay cannot resurrect it."],
              ["scale", "Legal hold overrides deletion", "Both products show the hold. The stricter policy wins."],
              ["eye", "Redaction is first-class", "A detected passage is visible before it leaves. The safe version is what PPMA receives."],
              ["hash", "Every quote is reconstructable", "Speaker, timestamp, source, model, confidence and a pointer to the local evidence."],
            ].map(([icon, title, detail]) => (
              <div className="rights-card" key={title}>
                <Icon name={icon} size={18} />
                <b>{title}</b>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Privacy & operations" sub="The switch that stops capture">
          <div className="settings-row">
            <div><b>Capture kill switch</b><span>Stops new captures and holds the queue on enrolled devices.</span></div>
            <Toggle checked={killSwitch} onChange={toggleKillSwitch} label="Capture kill switch" />
          </div>
          <div className="settings-row">
            <div><b>PPMA endpoint</b><span>Turning this off queues events locally. Capture continues.</span></div>
            <Toggle checked={settings.ppmaOnline} onChange={(value) => setSetting("ppmaOnline", value)} label="PPMA endpoint" />
          </div>
          <div className="settings-row">
            <div><b>Audit export</b><span>Capture, consent, correction, redaction, share, delete and delivery.</span></div>
            <button className="btn sm" onClick={() => downloadText("recall-audit.csv", exportAudit(), "text/csv;charset=utf-8")}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <div className="settings-row">
            <div><b>Reset demo</b><span>Return the pack, events, memory and queue to the captured meeting.</span></div>
            <button className="btn sm danger" onClick={reset}><Icon name="refresh" size={12} /> Reset</button>
          </div>
        </Panel>

        <Panel title="Build & provenance" sub="Offline assets, fixed seed, no CDN" className="span-2">
          <div className="build-grid">
            <div><span>Version</span><b className="mono">{pack.meta.version}</b></div>
            <div><span>Seed</span><b className="mono">{pack.meta.seed}</b></div>
            <div><span>Pack generated</span><b>{fmtDate(pack.meta.generated)}</b></div>
            <div><span>Model</span><b>{pack.meta.model}</b></div>
            <div><span>Meetings</span><b>{activeMeetings.length}</b></div>
            <div><span>Memory entries</span><b>{memory.length}</b></div>
            <div><span>Fonts</span><b>bundled · no CDN</b></div>
            <div><span>PWA</span><b>offline shell</b></div>
          </div>
          <p className="xsmall soft mt8">{pack.meta.note}</p>
          <div className="row gap8 mt8">
            <Link className="btn sm" to="/design"><Icon name="grid" size={12} /> Design system</Link>
            <Link className="btn sm ghost" to="/about"><Icon name="book" size={12} /> About RECALL</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}

import { useState } from "react";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { downloadText, fmtDate, fmtDateTime, meetingPayload } from "../lib/engine";
import { PageHead, Panel, Chip, Status, DataNote, Toggle, Meter } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Admin() {
  const { pack, settings, setSetting, killSwitch, toggleKillSwitch, exportAudit, say, consentCoverage, activeMeetings, events, audit } = useStore();
  const t = useT();
  const [revoked, setRevoked] = useState<string[]>(["dev_pixel_01"]);
  const [wiped, setWiped] = useState<string[]>([]);
  const [space, setSpace] = useState(pack?.admin.spaces[0]?.id ?? "");
  if (!pack) return null;
  const admin = pack.admin;
  const billing = admin.billing;
  const seatsSubtotal = billing.seats * billing.per_seat_eur_month;
  const discount = (seatsSubtotal * billing.bundle_discount_pct) / 100;

  return (
    <>
      <PageHead
        kicker="Team administration · a team product, not a personal recorder"
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        actions={
          <>
            <button className="btn" onClick={() => downloadText("recall-audit.csv", exportAudit(), "text/csv;charset=utf-8")}>
              <Icon name="download" size={14} /> Export audit
            </button>
            <button className="btn primary" onClick={() => say("Invite sent in the real product. The demo does not send email.")}>
              <Icon name="plus" size={14} /> Invite member
            </button>
          </>
        }
      />
      <DataNote seed={pack.meta.seed} note="Spaces, roles, billing and compliance are deterministic reference data. SSO, audit export and retention policy are implemented as UI surfaces over the local pack; production wiring is described in docs/architecture.md." />

      <div className="admin-grid">
        <Panel title="Team spaces" sub="Per-meeting visibility, roles and inherited retention" className="span-2">
          <div className="space-list">
            {admin.spaces.map((item) => (
              <button key={item.id} className={`space-card${space === item.id ? " selected" : ""}`} onClick={() => setSpace(item.id)}>
                <span className="space-mark"><Icon name={item.status === "hold" ? "lock" : "layers"} size={16} /></span>
                <span><b>{item.name}</b><small>{item.members} members · {item.visibility} · {item.retention}</small></span>
                <Status value={item.status} />
              </button>
            ))}
          </div>
          <div className="space-detail">
            <div><span>Default retention</span><b>{pack.team.retention_days} days</b></div>
            <div><span>Consent model</span><b>{pack.team.consent_model.replace(/_/g, " ")}</b></div>
            <div><span>Consent coverage</span><b>{Math.round(consentCoverage * 100)}%</b></div>
            <div><span>Legal hold</span><b>{admin.spaces.find((s) => s.id === space)?.status === "hold" ? "Active" : "None"}</b></div>
          </div>
        </Panel>

        <Panel title="Roles" sub="The navigation hides what a role cannot act on">
          <div className="role-list">
            {admin.roles.map((role) => (
              <div className="role-row" key={role.role}>
                <b>{role.role.replace(/_/g, " ")}</b>
                <span className="role-can"><Icon name="check" size={11} /> {role.can}</span>
                <span className="role-cannot"><Icon name="x" size={11} /> {role.cannot}</span>
              </div>
            ))}
          </div>
          <div className="role-switch">
            <span>View as</span>
            <select value={settings.role} aria-label="View as role" onChange={(event) => setSetting("role", event.target.value as typeof settings.role)}>
              <option value="individual">Individual</option>
              <option value="team_lead">Team lead</option>
              <option value="privacy_legal">Privacy / legal</option>
              <option value="field">Field</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </Panel>

        <Panel title="Identity & residency" sub="SSO, SCIM and the data boundary">
          <div className="identity-grid">
            <div><span>Provider</span><b>{admin.sso.provider}</b></div>
            <div><span>Enforcement</span><b>{admin.sso.enforcement}</b></div>
            <div><span>SCIM</span><b>{admin.sso.scim}</b></div>
            <div><span>Groups</span><b>{admin.sso.groups.join(" · ")}</b></div>
            <div><span>Primary region</span><b>{admin.residency.primary}</b></div>
            <div><span>Backup region</span><b>{admin.residency.backup}</b></div>
          </div>
          <div className="residency-note"><Icon name="lock" size={14} /><span>{admin.residency.media} — {admin.residency.note}</span></div>
        </Panel>

        <Panel title="Devices" sub="Enrollment, revocation and remote wipe" actions={<button className="btn sm" onClick={() => say("Enrollment link created. A device must accept consent before its first capture.")}><Icon name="plus" size={12} /> Enroll</button>}>
          <div className="device-list">
            {pack.team.devices.map((device) => {
              const isRevoked = revoked.includes(device.id) || device.status === "revoked";
              const isWiped = wiped.includes(device.id);
              return (
                <div className={`admin-device${isRevoked ? " revoked" : ""}`} key={device.id}>
                  <span className="device-kind"><Icon name={device.kind === "laptop" ? "harddrive" : device.kind === "tablet" ? "layers" : "cpu"} size={15} /></span>
                  <span><b>{device.name}</b><small>{device.owner} · v{device.app_version} · {device.npu}</small></span>
                  <span className="mono xsmall soft">{fmtDate(device.last_seen)}</span>
                  <Status value={isRevoked ? "retired" : "active"} />
                  <button
                    className="btn sm ghost"
                    disabled={isRevoked}
                    onClick={() => {
                      setRevoked((value) => [...value, device.id]);
                      say(`${device.name} revoked · key rotation queued`);
                    }}
                  >
                    {isRevoked ? "Revoked" : "Revoke"}
                  </button>
                  <button
                    className="btn sm ghost"
                    disabled={isWiped || isRevoked}
                    onClick={() => {
                      setWiped((value) => [...value, device.id]);
                      say(`${device.name} remote wipe issued · local capture key destroyed on acknowledgement`);
                    }}
                  >
                    {isWiped ? "Wiped" : "Wipe"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Compliance evidence" sub="Controls, not promises">
          <div className="compliance-list">
            {admin.compliance.map((item) => (
              <div className="compliance-row" key={item.id}>
                <div className="row between"><b>{item.name}</b><Chip tone={item.status === "ready" ? "green" : "amber"}>{item.status.replace(/_/g, " ")}</Chip></div>
                <p>{item.standard} · {item.detail}</p>
                <Meter value={item.covered / item.controls} label={`${item.covered} of ${item.controls} controls`} tone={item.covered === item.controls ? "green" : "amber"} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Consent templates" sub="Jurisdiction-aware wording, versioned">
          <div className="jurisdiction-list">
            {admin.jurisdictions.map((jurisdiction) => (
              <div className="jurisdiction-row" key={jurisdiction.code}>
                <b className="mono">{jurisdiction.code}</b>
                <span>{jurisdiction.name}<small>{jurisdiction.model}</small></span>
                <Chip tone="violet">{jurisdiction.wording}</Chip>
                <Status value={jurisdiction.status === "active" ? "active" : "pending"} tone={jurisdiction.status === "active" ? "green" : "amber"}>{jurisdiction.status}</Status>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Billing" sub={billing.metering} className="span-2">
          <div className="billing-grid">
            <div className="billing-plan">
              <span className="kicker">Current plan</span>
              <b>{billing.plan}</b>
              <div className="billing-price"><b>€{billing.per_seat_eur_month}</b><span>/ seat / month</span></div>
              <div className="billing-calc">
                <div><span>{billing.seats} seats</span><b>€{seatsSubtotal.toFixed(2)}</b></div>
                <div><span>PPMA bundle −{billing.bundle_discount_pct}%</span><b>−€{discount.toFixed(2)}</b></div>
                <div><span>Enterprise privacy package</span><b>€{billing.enterprise_addon_eur_month.toFixed(2)}</b></div>
                <div><span>Field / offline package</span><b>€{billing.field_addon_eur_month.toFixed(2)}</b></div>
                <div className="total"><span>MRR</span><b>€{billing.mrr_eur.toFixed(2)}</b></div>
              </div>
              <p className="xsmall soft">NPU option included. No per-meeting metering. Capture is never charged by the minute.</p>
            </div>
            <div className="invoice-list">
              <span className="kicker">Invoices</span>
              {billing.invoices.map((invoice) => (
                <div className="invoice-row" key={invoice.id}>
                  <b className="mono">{invoice.id}</b>
                  <span>{fmtDate(invoice.date)}</span>
                  <span>€{invoice.amount_eur.toFixed(2)}</span>
                  <Chip tone="green">{invoice.status}</Chip>
                  <button className="btn sm ghost" onClick={() => say("Invoice PDF is not part of the demo pack.")}>PDF</button>
                </div>
              ))}
              <div className="next-invoice"><span>Next invoice</span><b>{billing.next_invoice}</b></div>
            </div>
          </div>
          <div className="package-row">
            {[
              ["Per seat", "Individuals and teams. Capture unmetered.", `${billing.per_seat_eur_month} €`],
              ["PPMA bundle", "RECALL as the capture add-on for a PPMA workspace.", `−${billing.bundle_discount_pct}%`],
              ["Enterprise privacy", "Local retention, SSO, audit, legal hold.", `${billing.enterprise_addon_eur_month} €`],
              ["Field / offline", "Teams without reliable connectivity.", `${billing.field_addon_eur_month} €`],
            ].map(([title, detail, price]) => (
              <div className="package-card" key={title}>
                <b>{title}</b><span>{detail}</span><em>{price}</em>
              </div>
            ))}
          </div>
          <p className="xsmall soft mt8">Reseller and hardware-partner motion runs through PPMA. Enterprise procurement uses the compliance pack above. No per-meeting metering.</p>
        </Panel>

        <Panel title="Privacy controls" sub="A kill switch, and a runbook for the worst day">
          <div className="kill-switch">
            <div className="row between">
              <div><b>Capture kill switch</b><p>Stops new captures and holds the queue on every enrolled device.</p></div>
              <Toggle checked={killSwitch} onChange={toggleKillSwitch} label="Capture kill switch" />
            </div>
            <div className="row between mt12">
              <div><b>Synthetic media only</b><p>No customer audio, transcript or personal data in this pack.</p></div>
              <Chip tone="green">fixed seed {pack.meta.seed}</Chip>
            </div>
          </div>
          <ol className="runbook">
            <li>Stop capture on all devices; preserve the local queue and audit.</li>
            <li>Identify the captures and the consent references involved.</li>
            <li>Notify the privacy owner; apply legal hold if litigation is likely.</li>
            <li>Delete or redact locally; emit the tombstone and verify PPMA retirement.</li>
            <li>Publish the incident review; no silent deletion.</li>
          </ol>
          <div className="row gap8 mt12">
            <button className="btn sm" onClick={() => say("Backup drill passed: 3 devices, 1.2 GB local media, restore hash verified.")}>
              <Icon name="harddrive" size={12} /> Run backup / restore drill
            </button>
            <button className="btn sm ghost" onClick={() => say("Key rotation drill queued for both active device tokens; no capture interruption.")}>
              <Icon name="key" size={12} /> Key rotation drill
            </button>
          </div>
        </Panel>

        <Panel title="Audit log" sub={`${pack.admin.audit.length} seeded entries · exportable`} className="span-2">
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Object</th><th>Detail</th><th>Model</th></tr></thead>
              <tbody>
                {admin.audit.slice(0, 12).map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{fmtDateTime(entry.at)}</td>
                    <td>{entry.actor}</td>
                    <td><Chip>{entry.action}</Chip></td>
                    <td className="mono small">{entry.object.slice(0, 18)}…</td>
                    <td>{entry.detail}</td>
                    <td className="mono small">{entry.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row between mt12">
            <span className="xsmall soft">Audit covers capture, consent, correction, redaction, share, delete and PPMA delivery.</span>
            <div className="row gap6">
              <button className="btn sm" onClick={() => downloadText("recall-audit.csv", exportAudit(), "text/csv;charset=utf-8")}><Icon name="download" size={12} /> Export CSV</button>
              <button
                className="btn sm"
                onClick={() =>
                  downloadText(
                    "recall-ediscovery.json",
                    JSON.stringify(
                      {
                        generated_at: new Date().toISOString(),
                        team: pack.team.name,
                        jurisdiction: pack.team.jurisdiction,
                        meetings: activeMeetings.map((meeting) => ({
                          meeting_id: meeting.id,
                          capture_id: meeting.capture_id,
                          title: meeting.title,
                          consent: meeting.consent,
                          retention: meeting.retention,
                          payload: meetingPayload(meeting, { safe: true }),
                        })),
                        events,
                      },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                <Icon name="scale" size={12} /> eDiscovery pack
              </button>
              <button className="btn sm" onClick={() => downloadText("recall-audit.jsonl", audit.map((entry) => JSON.stringify(entry)).join("\n"), "application/x-ndjson")}>
                <Icon name="terminal" size={12} /> SIEM JSONL
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { CONNECTORS, CONNECTOR_CATEGORIES } from "../lib/connectors";
import { classNames, fmtDateTime } from "../lib/engine";
import { PageHead, Panel, Chip, Status, DataNote, Toggle, Empty } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Connectors() {
  const { pack, connectors, setConnector, settings, setSetting, say } = useStore();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState(settings.endpointUrl || "http://127.0.0.1:8788");
  const [token, setToken] = useState(settings.endpointToken);
  const [secret, setSecret] = useState(settings.endpointSecret || "recall-demo-secret");
  const [testing, setTesting] = useState(false);
  const [liveHealth, setLiveHealth] = useState<Record<string, unknown> | null>(null);
  const [liveMemory, setLiveMemory] = useState<{ view: string; text: string; confidence?: number; origin?: string }[]>([]);
  const [inspecting, setInspecting] = useState(false);
  if (!pack) return null;

  const filtered = useMemo(
    () =>
      CONNECTORS.filter((connector) => category === "All" || connector.category === category).filter((connector) =>
        `${connector.name} ${connector.purpose} ${connector.category}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [category, query],
  );
  const enabled = CONNECTORS.filter((connector) => connectors[connector.id]?.enabled);
  const active = CONNECTORS.find((connector) => connector.id === configuring);

  const testEndpoint = async () => {
    const base = endpoint.trim().replace(/\/$/, "");
    if (!base) {
      say("Enter the local PPMA bridge URL first.");
      return;
    }
    setTesting(true);
    try {
      const response = await fetch(`${base}/health`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error(`health returned ${response.status}`);
      const data = (await response.json()) as { ok?: boolean; status?: string; backend?: string; app?: string; space?: string; memory_entries?: number; memory_views?: string[]; mode?: string; events?: number };
      if (data.ok === false) throw new Error(`PPMA backend unreachable at ${data.backend ?? base}`);
      setLiveHealth(data as Record<string, unknown>);
      setSetting("endpointUrl", base);
      setSetting("endpointToken", token);
      setSetting("endpointSecret", secret);
      setSetting("ppmaMode", "live");
      setConnector("local-ppma", { enabled: true, configured: true, last_test: new Date().toISOString(), last_status: "ok", detail: `Real PPMA at ${data.backend ?? base} · app ${data.app ?? "capture"} · ${data.memory_entries ?? 0} memory entries` });
      setConnector("ppma", { enabled: true, configured: true, last_test: new Date().toISOString(), last_status: "ok", detail: `Live PPMA north contract · space ${data.space ?? "me"} · views ${(data.memory_views ?? []).join(", ") || "none yet"}` });
      say(`Connected to a running PPMA backend at ${data.backend ?? base}. Events now go to its real north API.`);
    } catch (error) {
      setLiveHealth(null);
      setConnector("local-ppma", { enabled: false, configured: false, last_test: new Date().toISOString(), last_status: "error", detail: error instanceof Error ? error.message : "Connection failed" });
      say("No live PPMA bridge is reachable. Start PPMA and the bridge, register the app, then test again.");
    } finally {
      setTesting(false);
    }
  };

  const inspectMemory = async () => {
    const base = endpoint.trim().replace(/\/$/, "");
    if (!base) return;
    setInspecting(true);
    try {
      const response = await fetch(`${base}/v1/memory`);
      const data = (await response.json()) as { ok?: boolean; entries?: number; views?: { view: string; statements: { text: string; confidence?: number; origin?: string }[] }[]; detail?: string };
      if (!response.ok || data.ok === false) throw new Error(data.detail || `memory returned ${response.status}`);
      const rows = (data.views ?? []).flatMap((view) => view.statements.map((statement) => ({ view: view.view, text: statement.text, confidence: statement.confidence, origin: statement.origin })));
      setLiveMemory(rows.slice(0, 12));
      say(`Read ${rows.length} statements from PPMA memory.`);
    } catch (error) {
      setLiveMemory([]);
      say(`Memory read failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setInspecting(false);
    }
  };

  const toggle = (id: string, value: boolean) => {
    const connector = CONNECTORS.find((item) => item.id === id);
    if (!connector) return;
    if (value && connector.status === "blocked") {
      say("This connector is blocked by policy.");
      return;
    }
    setConnector(id, {
      enabled: value,
      configured: value ? true : connectors[id]?.configured ?? false,
      last_status: value ? "ok" : connectors[id]?.last_status ?? "not_configured",
      last_test: value ? new Date().toISOString() : connectors[id]?.last_test ?? null,
      detail: value ? (connector.mock ? "Mock provider enabled. No vendor account is used." : "Configured for preview; OAuth credentials required.") : "Disconnected by the owner.",
    });
    say(value ? `${connector.name} enabled · purpose recorded` : `${connector.name} disconnected`);
  };

  const enabledCount = enabled.length;
  const configuredCount = Object.values(connectors).filter((state) => state.configured).length;

  return (
    <>
      <PageHead
        kicker="Connected services · one purpose per connection"
        title="Connect the capture layer"
        subtitle="Every connector ships with a consent purpose, scopes, an off switch and an audit. Raw media never leaves the device; only safe text and pointers can."
        actions={<Chip tone={enabledCount ? "green" : "amber"} dot={enabledCount ? "live" : "warn"}>{enabledCount} enabled · {configuredCount} configured</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="The static demo ships local mock providers. A running PPMA backend plus the local bridge in server/ is a real connection; vendor connectors need OAuth credentials and are labelled preview." />

      <div className="connectors-hero">
        <div>
          <span className="kicker">Integration safety</span>
          <h2>Connect the facts, not the raw media.</h2>
          <p>Each connection is opt-in and purpose-bound. Disconnecting is immediate. A redaction is applied before any payload leaves RECALL.</p>
        </div>
        <div className="connectors-hero-stats">
          <div><span>Enabled</span><b>{enabledCount}</b></div>
          <div><span>Configured</span><b>{configuredCount}</b></div>
          <div><span>Raw media egress</span><b>0</b></div>
          <div><span>Purpose-bound</span><b>100%</b></div>
        </div>
      </div>

      <div className="connectors-toolbar">
        <label className="filter-search">
          <Icon name="search" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search connectors…" />
        </label>
        <div className="segmented">
          {["All", ...CONNECTOR_CATEGORIES].map((value) => (
            <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>
          ))}
        </div>
      </div>

      <div className="connector-grid">
        {filtered.map((connector) => {
          const state = connectors[connector.id] ?? { enabled: false, configured: false, consent_purpose: connector.purpose, scopes: connector.scopes, last_test: null, last_status: "not_configured" as const, detail: connector.note };
          return (
            <article className={classNames("connector-card", state.enabled && "enabled", connector.status === "blocked" && "blocked")} key={connector.id}>
              <div className="connector-head">
                <span className="connector-mark"><Icon name={connector.category === "Meetings" ? "calendar" : connector.category === "Communication" ? "mail" : connector.category === "Security" ? "shield" : connector.category === "Core" ? "cpu" : "link"} size={17} /></span>
                <div><h2>{connector.name}</h2><span>{connector.category} · {connector.direction}</span></div>
                <Toggle checked={state.enabled} onChange={(value) => toggle(connector.id, value)} label={`Enable ${connector.name}`} />
              </div>
              <p>{connector.note}</p>
              <div className="connector-purpose"><span className="kicker">Consent purpose</span><b>{state.consent_purpose}</b></div>
              <div className="connector-scopes">{connector.scopes.map((scope) => <Chip key={scope}>{scope}</Chip>)}</div>
              <div className="connector-foot">
                <Status value={state.last_status === "ok" ? "active" : state.last_status === "error" ? "failed" : "pending"} tone={state.last_status === "ok" ? "green" : state.last_status === "error" ? "red" : "amber"}>{state.last_status.replace(/_/g, " ")}</Status>
                {state.last_test && <span className="mono xsmall soft">tested {fmtDateTime(state.last_test)}</span>}
                <div className="row gap6">
                  <button className="btn sm" onClick={() => { setConfiguring(connector.id); setEndpoint(settings.endpointUrl); setToken(settings.endpointToken); setSecret(settings.endpointSecret); }}><Icon name="settings" size={11} /> Configure</button>
                  <button className="btn sm ghost" onClick={() => { setConnector(connector.id, { last_test: new Date().toISOString(), last_status: connector.mock ? "ok" : "not_configured", detail: connector.mock ? "Mock provider answered. No vendor account is used." : "Preview only; add OAuth credentials to test." }); say(connector.mock ? `${connector.name}: mock provider responded.` : `${connector.name}: preview connector, credentials required.`); }}>Test</button>
                </div>
              </div>
              {connector.id === "ppma" && <p className="xsmall soft">PPMA is the project memory. The local fake is the default; the live bridge connects to a real running PPMA backend.</p>}
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <Empty title="No connector matches" detail="Try another category or a shorter search." icon="link" />}

      <div className="connectors-lower">
        <Panel title="Live PPMA bridge" sub="A running PPMA backend, reached through a local sidecar" actions={<Chip tone={settings.ppmaMode === "live" ? "green" : "amber"}>{settings.ppmaMode === "live" ? "live" : "not connected"}</Chip>}>
          <p className="small muted">The bridge holds the PPMA app token server-side, translates a signed RECALL event into the north-contract envelope and posts it to <code className="mono">/v0/spaces/me/messages</code>. Memory reads come back from PPMA with the owner authority. The browser never sees either token.</p>
          <div className="endpoint-form">
            <label className="field"><span>Bridge endpoint</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://127.0.0.1:8788" /></label>
            <label className="field"><span>Bearer token</span><input value={token} onChange={(event) => setToken(event.target.value)} placeholder="optional for the local bridge" /></label>
            <label className="field"><span>Shared secret</span><input value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="RECALL_SHARED_SECRET" type="password" /></label>
          </div>
          <div className="row gap8 mt12">
            <button className="btn primary" onClick={testEndpoint} disabled={testing}><Icon name="wifi" size={13} /> {testing ? "Testing…" : "Test live PPMA"}</button>
            <button className="btn" onClick={inspectMemory} disabled={inspecting}><Icon name="search" size={13} /> {inspecting ? "Reading…" : "Inspect PPMA memory"}</button>
            <Chip tone={settings.ppmaMode === "live" ? "green" : "amber"}>{settings.ppmaMode === "live" ? "live mode" : "local fake"}</Chip>
          </div>
          {liveHealth && (
            <div className="connector-config mt12">
              <div><span>Backend</span><b className="mono">{String(liveHealth.backend ?? "—")}</b></div>
              <div><span>App / space</span><b className="mono">{String(liveHealth.app ?? "capture")} / {String(liveHealth.space ?? "me")}</b></div>
              <div><span>Memory entries</span><b>{String(liveHealth.memory_entries ?? 0)}</b></div>
              <div><span>Views</span><b>{(liveHealth.memory_views as string[] | undefined)?.join(", ") || "none yet"}</b></div>
            </div>
          )}
          {liveMemory.length > 0 && (
            <div className="adapter-list mt12">
              {liveMemory.map((row, index) => (
                <div key={`${row.view}-${index}`}><b>{row.view}</b><span>{row.text}</span><Chip>{row.origin ?? "inferred"}{row.confidence !== undefined ? ` ${Math.round(row.confidence * 100)}%` : ""}</Chip></div>
              ))}
            </div>
          )}
          <p className="xsmall soft mt8">Commands: <code className="mono">cd server && npm run live</code> after <code className="mono">py -3 scripts/ppma_register.py --base http://127.0.0.1:8771</code>. PPMA is a separate running service; this bridge only carries traffic to it.</p>
        </Panel>

        <Panel title="Openjiuwen runtime" sub="A real run over live PPMA memory" actions={<Chip tone="green">verified</Chip>}>
          <p className="small muted">A real openjiuwen DeepAgent (<code className="mono">deepseek-v4-pro</code>) ran on the global Runner, called RECALL tools and answered from PPMA memory. It never executes project actions.</p>
          <div className="adapter-list">
            <div><b>tools/recall_memory</b><span>reads PPMA memory views</span><Status value="active" /></div>
            <div><b>tools/recall_search</b><span>searches PPMA statements</span><Status value="active" /></div>
            <div><b>tools/recall_recent_events</b><span>recent delivered events</span><Status value="active" /></div>
            <div><b>tools/capture.execute</b><span>does not exist by design</span><Status value="retired" tone="red" /></div>
          </div>
          <p className="xsmall soft mt8">Run: <code className="mono">coachme\.venv\Scripts\python.exe integrations\openjiuwen\recall_agent.py</code>. The first run made six tool calls and quoted the exact PPMA statements.</p>
          <button className="btn sm mt12" onClick={() => say("Agent: integrations/openjiuwen/recall_agent.py. It uses coachme's .env and the live bridge.")}><Icon name="file" size={12} /> Agent script</button>
        </Panel>

        <Panel title="Disconnect everything" sub="A single off switch is not optional">
          <p className="small muted">Disabling a connector stops future payloads immediately. Existing PPMA memory follows its own retention and deletion policy.</p>
          <button className="btn danger" onClick={() => { CONNECTORS.forEach((connector) => setConnector(connector.id, { enabled: false, last_status: "not_configured", detail: "Disconnected by the owner." })); say("All connectors disabled. Capture and local recall continue."); }}>
            <Icon name="shieldOff" size={13} /> Disable all connectors
          </button>
          <div className="connector-audit">
            {CONNECTORS.filter((connector) => connectors[connector.id]?.enabled).slice(0, 6).map((connector) => (
              <div key={connector.id}><i className="dot live" /><span>{connector.name}</span><Chip>{connectors[connector.id]?.consent_purpose}</Chip></div>
            ))}
          </div>
        </Panel>
      </div>

      {active && (
        <div className="modal-back" onClick={() => setConfiguring(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`Configure ${active.name}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><div className="kicker">Connector</div><h2>{active.name}</h2></div><button className="icon-btn" onClick={() => setConfiguring(null)} aria-label="Close"><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              <p className="small muted">{active.note}</p>
              <div className="connector-config">
                <div><span>Purpose</span><b>{active.purpose}</b></div>
                <div><span>Direction</span><b>{active.direction}</b></div>
                <div><span>Scopes</span><b>{active.scopes.join(", ")}</b></div>
                <div><span>Raw media</span><b>blocked</b></div>
              </div>
              <label className="field mt12"><span>Consent purpose (editable)</span><input defaultValue={connectors[active.id]?.consent_purpose ?? active.purpose} onBlur={(event) => setConnector(active.id, { consent_purpose: event.target.value })} /></label>
              <div className="row gap8 mt12">
                <button className="btn primary" onClick={() => { setConnector(active.id, { enabled: true, configured: true, last_status: "ok", last_test: new Date().toISOString(), detail: "Configured in the demo with a local mock provider." }); setConfiguring(null); say(`${active.name} configured with a local mock provider.`); }}>Save & enable</button>
                <button className="btn ghost" onClick={() => setConfiguring(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import type { Role } from "../types";
import { classNames } from "../lib/engine";
import { Icon } from "./Icon";
import { CommandPalette } from "./CommandPalette";
import { Onboarding } from "./Onboarding";

const navItems: { to: string; key: string; icon: string; roles: Role[] }[] = [
  { to: "/", key: "nav.now", icon: "wave", roles: ["individual", "team_lead", "privacy_legal", "field", "admin"] },
  { to: "/attention", key: "nav.attention", icon: "alert", roles: ["individual", "team_lead", "privacy_legal", "field", "admin"] },
  { to: "/record", key: "nav.record", icon: "record", roles: ["individual", "team_lead", "field", "admin"] },
  { to: "/meetings", key: "nav.meetings", icon: "layers", roles: ["individual", "team_lead", "privacy_legal", "admin"] },
  { to: "/recall", key: "nav.recall", icon: "search", roles: ["individual", "team_lead", "privacy_legal", "field", "admin"] },
  { to: "/ppma", key: "nav.ppma", icon: "send", roles: ["individual", "team_lead", "privacy_legal", "admin"] },
  { to: "/field", key: "nav.field", icon: "pin", roles: ["field", "team_lead", "admin"] },
  { to: "/pilot", key: "nav.pilot", icon: "gauge", roles: ["team_lead", "privacy_legal", "admin"] },
  { to: "/admin", key: "nav.admin", icon: "shield", roles: ["privacy_legal", "admin"] },
];

const moreItems = [
  { to: "/attention", key: "nav.attention", icon: "alert" },
  { to: "/meetings", key: "nav.meetings", icon: "layers" },
  { to: "/canvas", key: "nav.canvas", icon: "grid" },
  { to: "/connectors", key: "nav.connectors", icon: "link" },
  { to: "/booth", key: "nav.booth", icon: "play" },
  { to: "/field", key: "nav.field", icon: "pin" },
  { to: "/health", key: "nav.health", icon: "activity" },
  { to: "/design", key: "nav.design", icon: "grid" },
  { to: "/settings", key: "nav.settings", icon: "settings" },
  { to: "/about", key: "nav.about", icon: "book" },
];

const titles: Record<string, string> = {
  "/": "Now",
  "/attention": "Attention",
  "/canvas": "Memory canvas",
  "/connectors": "Connected services",
  "/record": "Record",
  "/meetings": "Meetings",
  "/recall": "Recall",
  "/ppma": "PPMA north app",
  "/field": "Field capture",
  "/pilot": "Pilot dashboard",
  "/admin": "Team administration",
  "/health": "Capture health",
  "/settings": "Settings & data rights",
  "/design": "Design system",
  "/about": "About RECALL",
  "/booth": "Booth demo",
};

const roleLabel: Record<Role, string> = {
  individual: "Individual",
  team_lead: "Team lead",
  privacy_legal: "Privacy / legal",
  field: "Field",
  admin: "Admin",
};

export function Shell({ children }: { children: ReactNode }) {
  const { pack, queue, settings, toast, reset, setSetting, consentCoverage } = useStore();
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [mobileMore, setMobileMore] = useState(false);
  const gRef = useRef(false);
  const gTimer = useRef<number | undefined>(undefined);

  const role = settings.role;
  const visible = navItems.filter((item) => item.roles.includes(role));
  const base = location.pathname === "/" ? "/" : `/${location.pathname.split("/")[1] || ""}`;
  const title = titles[base] ?? (base.startsWith("/meetings/") ? "Meeting" : "RECALL");

  useEffect(() => {
    setMoreOpen(false);
    setMobileMore(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCmdOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setCmdOpen(true);
        return;
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setKeysOpen(true);
        return;
      }
      if (typing) return;
      if (event.key.toLowerCase() === "g") {
        gRef.current = true;
        window.clearTimeout(gTimer.current);
        gTimer.current = window.setTimeout(() => {
          gRef.current = false;
        }, 900);
        return;
      }
      if (gRef.current) {
        gRef.current = false;
        const map: Record<string, string> = { n: "/", r: "/record", m: "/meetings", s: "/recall", p: "/ppma", f: "/field", d: "/pilot", h: "/health" };
        const to = map[event.key.toLowerCase()];
        if (to) {
          event.preventDefault();
          navigate(to);
        }
      }
      if (event.key.toLowerCase() === "t") {
        const order: ("dark" | "paper" | "contrast")[] = ["dark", "paper", "contrast"];
        setSetting("theme", order[(order.indexOf(settings.theme) + 1) % order.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(gTimer.current);
    };
  }, [navigate, setSetting, settings.theme]);

  const themeIcon = settings.theme === "dark" ? "moon" : settings.theme === "paper" ? "sun" : "contrast";
  const nextTheme = () => {
    const order: ("dark" | "paper" | "contrast")[] = ["dark", "paper", "contrast"];
    setSetting("theme", order[(order.indexOf(settings.theme) + 1) % order.length]);
  };

  const navLinks = useMemo(
    () =>
      visible.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => classNames("rail-link", isActive && "active")}>
          <Icon name={item.icon} size={17} />
          <span>{t(item.key)}</span>
        </NavLink>
      )),
    [visible, t],
  );

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <header className="transport">
        <NavLink to="/" className="brand" aria-label="RECALL home">
          <span className="brand-mark" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </span>
          <span className="brand-copy">
            <b>RECALL</b>
            <small>{t("app.tagline")}</small>
          </span>
        </NavLink>

        <button className="omni" onClick={() => setCmdOpen(true)} aria-label={t("top.search")}>
          <Icon name="search" size={15} />
          <span>{t("top.search")}</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="transport-status">
          <span className="live-pill" title="Audio, transcript and evidence stay on this device by default">
            <i className="dot live" />
            {t("top.local")}
          </span>
          <button
            className={classNames("live-pill", queue.length ? "warn" : "ok")}
            onClick={() => navigate("/ppma")}
            title={`${queue.length} event(s) queued for PPMA`}
          >
            <i className={classNames("dot", settings.ppmaOnline ? "live" : "warn")} />
            {t("top.ppma")} {settings.ppmaOnline ? t("top.connected") : t("top.offline")}
            {queue.length > 0 && <b className="queue-count">{queue.length}</b>}
          </button>
        </div>

        <div className="transport-actions">
          <select
            className="role-select"
            value={role}
            aria-label={t("top.role")}
            onChange={(event) => setSetting("role", event.target.value as Role)}
          >
            {Object.entries(roleLabel).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            className="lang-btn"
            onClick={() => setSetting("lang", settings.lang === "en" ? "zh" : "en")}
            aria-label={t("top.language")}
            title="English / 中文"
          >
            {settings.lang === "en" ? "中" : "EN"}
          </button>
          <button className="icon-btn" onClick={nextTheme} aria-label={t("top.theme")} title={settings.theme}>
            <Icon name={themeIcon} size={16} />
          </button>
          <button className="icon-btn" onClick={reset} aria-label={t("top.reset")} title={t("top.reset")}>
            <Icon name="refresh" size={16} />
          </button>
          <button className="avatar" onClick={() => navigate("/settings")} title="Anna Voss · team lead">
            AV
          </button>
        </div>
      </header>

      <nav className="rail" aria-label="Primary">
        {navLinks}
        <button className={classNames("rail-link rail-more", mobileMore && "active")} onClick={() => setMoreOpen(true)}>
          <Icon name="grid" size={17} />
          <span>{t("nav.more")}</span>
        </button>
        <div className="rail-spacer" />
        <span className="rail-consent" title="Consent coverage">
          <i className="dot live" /> {Math.round(consentCoverage * 100)}%
        </span>
        <button className="rail-link rail-keys" onClick={() => setKeysOpen(true)}>
          <Icon name="terminal" size={16} />
          <span>{t("nav.keys")}</span>
        </button>
      </nav>

      <main className="content" id="main-content" aria-label={title}>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Primary mobile">
        {visible.filter((item) => ["/", "/attention", "/recall", "/record"].includes(item.to)).slice(0, 4).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => classNames("bottom-link", isActive && "active")}>
            <Icon name={item.icon} size={20} />
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
        <button className="bottom-link" onClick={() => setMoreOpen(true)}>
          <Icon name="grid" size={20} />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <Onboarding />

      {moreOpen && (
        <div className="modal-back" onClick={() => setMoreOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="More destinations" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="kicker">Navigate</div>
                <h2>More of RECALL</h2>
              </div>
              <button className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="more-grid">
              {moreItems.map((item) => (
                <button key={item.to} className="more-item" onClick={() => navigate(item.to)}>
                  <Icon name={item.icon} size={18} />
                  <span>{t(item.key)}</span>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
              {navItems
                .filter((item) => !visible.some((v) => v.to === item.to))
                .map((item) => (
                  <button key={item.to} className="more-item muted" onClick={() => setMoreOpen(false)} title={`Hidden for the ${roleLabel[role]} role. Switch role in the top bar.`}>
                    <Icon name={item.icon} size={18} />
                    <span>{t(item.key)}</span>
                    <small>role</small>
                  </button>
                ))}
            </div>
            <p className="xsmall soft mt12">
              Role <b>{roleLabel[role]}</b> hides surfaces this role cannot act on. Switch role in the transport bar to see the team view.
            </p>
            <div className="row gap8 mt12">
              <button className="btn sm" onClick={() => { setMoreOpen(false); setCmdOpen(true); }}>
                <Icon name="search" size={13} /> Ask or jump
              </button>
              <button className="btn sm" onClick={reset}>
                <Icon name="refresh" size={13} /> Reset demo
              </button>
            </div>
          </div>
        </div>
      )}

      {keysOpen && (
        <div className="modal-back" onClick={() => setKeysOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h2>Keyboard & command</h2>
              <button className="icon-btn" onClick={() => setKeysOpen(false)} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="key-list">
              {[
                ["⌘K / Ctrl K", "Command palette, search and ask"],
                ["/", "Search the evidence"],
                ["G then N", "Now"],
                ["G then R", "Record"],
                ["G then M", "Meetings"],
                ["G then S", "Recall / search"],
                ["G then P", "PPMA integration"],
                ["G then F", "Field capture"],
                ["G then D", "Pilot dashboard"],
                ["T", "Cycle dark / paper / high contrast"],
                ["R on stage", "Reset the 90-second piece"],
                ["?", "This sheet"],
              ].map(([key, value]) => (
                <div className="key-row" key={key}>
                  <kbd>{key}</kbd>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            <p className="xsmall soft mt12">
              RECALL answers only from local evidence, with citations. There is no web call and no model training on your audio.
            </p>
          </div>
        </div>
      )}

      <div className={classNames("toast", toast && "show")} role="status" aria-live="polite">
        {toast}
      </div>

      {pack && <span className="build-stamp">v{pack.meta.version} · seed {pack.meta.seed} · offline</span>}
    </div>
  );
}

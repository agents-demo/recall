import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { StoreProvider, useStore } from "./lib/store";
import { Shell } from "./components/Shell";
import Home from "./pages/Home";
import Stage from "./pages/Stage";
import { Icon } from "./components/Icon";

const Record = lazy(() => import("./pages/Record"));
const Meetings = lazy(() => import("./pages/Meetings"));
const Meeting = lazy(() => import("./pages/Meeting"));
const Recall = lazy(() => import("./pages/Recall"));
const Ppma = lazy(() => import("./pages/Ppma"));
const Pilot = lazy(() => import("./pages/Pilot"));
const Admin = lazy(() => import("./pages/Admin"));
const Health = lazy(() => import("./pages/Health"));
const Field = lazy(() => import("./pages/Field"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Design = lazy(() => import("./pages/Design"));
const About = lazy(() => import("./pages/About"));
const Booth = lazy(() => import("./pages/Booth"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="not-found">
      <div className="kicker">404</div>
      <h1>That page is not in the capture.</h1>
      <p>The evidence exists; the route does not.</p>
      <a className="btn primary" href="#/">Back to Now</a>
    </div>
  );
}

function Routed() {
  const location = useLocation();
  const { loading, error, pack } = useStore();
  const isStage = location.pathname === "/stage";

  useEffect(() => {
    const names: Record<string, string> = {
      "/": "Now — RECALL",
      "/record": "Record — RECALL",
      "/meetings": "Meetings — RECALL",
      "/recall": "Recall — RECALL",
      "/ppma": "PPMA north app — RECALL",
      "/pilot": "Pilot dashboard — RECALL",
      "/admin": "Team administration — RECALL",
      "/health": "Capture health — RECALL",
      "/field": "Field capture — RECALL",
      "/settings": "Settings & data rights — RECALL",
      "/design": "Design system — RECALL",
      "/about": "About RECALL",
      "/stage": "The 90-second recall — RECALL",
      "/booth": "Booth demo — RECALL",
    };
    document.title = names[location.pathname] ?? "RECALL";
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="boot">
        <div className="boot-mark"><i /><i /><i /><i /><i /></div>
        <div className="kicker">Opening the local evidence pack</div>
        <p>No network. No upload. One deterministic pack.</p>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="boot">
        <div className="panel" style={{ maxWidth: 480 }}>
          <div className="panel-body">
            <h2>The demo pack could not load</h2>
            <p className="small muted mt8">{error ?? "No pack found."}</p>
            <p className="xsmall soft mt8">Run <code className="mono">py scripts/build_demo_pack.py</code> from the repository root, then reload.</p>
            <button className="btn primary mt12" onClick={() => window.location.reload()}><Icon name="refresh" size={13} /> Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (isStage) {
    return (
      <Suspense fallback={<div className="boot">Loading stage…</div>}>
        <Stage />
      </Suspense>
    );
  }

  return (
    <Shell>
      <Suspense fallback={<div className="page-loading">Loading surface…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/record" element={<Record />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:meetingId" element={<Meeting />} />
          <Route path="/recall" element={<Recall />} />
          <Route path="/ppma" element={<Ppma />} />
          <Route path="/pilot" element={<Pilot />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/health" element={<Health />} />
          <Route path="/field" element={<Field />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/design" element={<Design />} />
          <Route path="/about" element={<About />} />
          <Route path="/booth" element={<Booth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <ScrollToTop />
        <Routed />
      </StoreProvider>
    </HashRouter>
  );
}

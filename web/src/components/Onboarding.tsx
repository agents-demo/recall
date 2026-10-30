import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { Modal } from "./UI";
import { Icon } from "./Icon";

export function Onboarding() {
  const { settings, setSetting, pack } = useStore();
  const t = useT();
  if (!pack || settings.onboarded) return null;
  const close = () => setSetting("onboarded", true);
  return (
    <Modal open title="The meeting is not lost." kicker="Welcome to RECALL" onClose={close} wide>
      <div className="onboarding">
        <p className="onboarding-lead">
          RECALL captures what was said, proves where it came from, and hands the facts to PPMA — so the project remembers,
          and the team can act. This build is a deterministic, offline demo; every quote is synthetic.
        </p>
        <div className="onboarding-steps">
          <div><span className="mono">01</span><b>Capture</b><p>Consent first, then a local transcript with speakers, timestamps and confidence.</p></div>
          <div><span className="mono">02</span><b>Recall</b><p>Ask a question or search. Every answer cites the evidence, or refuses.</p></div>
          <div><span className="mono">03</span><b>Prove & hand off</b><p>Correct the speaker, redact the safe version, send the facts — never the raw media.</p></div>
        </div>
        <div className="onboarding-actions">
          <Link className="btn primary" to="/stage" onClick={close}><Icon name="play" size={14} /> See the 90-second piece</Link>
          <Link className="btn" to="/attention" onClick={close}><Icon name="alert" size={14} /> See what needs attention</Link>
          <button className="btn ghost" onClick={close}>Explore on my own</button>
        </div>
        <p className="xsmall soft">No account. No upload. You can replay this tour from Settings.</p>
      </div>
    </Modal>
  );
}

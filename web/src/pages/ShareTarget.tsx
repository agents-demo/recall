import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { PageHead, Panel, Chip } from "../components/UI";
import { Icon } from "../components/Icon";

export default function ShareTarget() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addFieldNote, say } = useStore();
  const sharedTitle = params.get("title") ?? "";
  const sharedText = params.get("text") ?? "";
  const sharedUrl = params.get("url") ?? "";
  const [text, setText] = useState([sharedTitle, sharedText, sharedUrl].filter(Boolean).join("\n\n"));
  const [location, setLocation] = useState("Shared from another app");

  return (
    <>
      <PageHead kicker="Mobile share target · PWA" title="Capture this share" subtitle="Text, a link or a note shared from another app stays on this device. Nothing is uploaded." actions={<Chip tone="green" dot="live">local</Chip>} />
      <Panel title="Shared content" sub="Review before it becomes evidence">
        <div className="share-target">
          <label className="field"><span>Text</span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={6} /></label>
          <label className="field"><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <div className="row gap8 mt12">
            <button className="btn primary" onClick={() => { if (text.trim()) { addFieldNote(text.trim(), location); say("Shared content captured as a field note."); navigate("/field"); } }} disabled={!text.trim()}><Icon name="pin" size={13} /> Capture as field note</button>
            <button className="btn ghost" onClick={() => navigate("/")}>Cancel</button>
          </div>
          <p className="xsmall soft mt8">On mobile, install RECALL to the home screen to make this share target available from other apps.</p>
        </div>
      </Panel>
    </>
  );
}

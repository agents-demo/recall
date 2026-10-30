import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtDate, fmtDateTime } from "../lib/engine";
import { PageHead, Panel, Chip, Status, DataNote, Toggle, Meter, SourceChip } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Field() {
  const { pack, notes, addFieldNote, sendNote, settings, setSetting, queue, flushQueue, events, say } = useStore();
  const t = useT();
  const [text, setText] = useState("");
  const [location, setLocation] = useState("Northgate — Building C");
  const [photo, setPhoto] = useState<{ name: string; ocr: string; url: string } | null>(null);
  const [batteryMode, setBatteryMode] = useState(true);
  const [ambient, setAmbient] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo]);

  if (!pack) return null;
  const sent = (noteId: string) => events.some((event) => event.payload.note_id === noteId && event.delivery.status === "delivered");

  const capture = () => {
    if (!text.trim()) {
      say("Write the observation first.");
      return;
    }
    const id = addFieldNote(text.trim(), location, photo ? { label: photo.name, ocr: photo.ocr } : undefined);
    if (id) {
      setSaved(id);
      setText("");
      setPhoto(null);
    }
  };

  return (
    <>
      <PageHead
        kicker="Field capture · offline first"
        title={t("field.title")}
        subtitle={t("field.subtitle")}
        actions={<Chip tone={settings.ppmaOnline ? "green" : "amber"} dot={settings.ppmaOnline ? "live" : "warn"}>{settings.ppmaOnline ? "connected · sync ready" : `offline · ${queue.length} queued`}</Chip>}
      />
      <DataNote seed={pack.meta.seed} note="The field surface is mobile-first and works with the network unplugged. Photo OCR in the public build is a scripted local result; the file is never uploaded." />

      <div className="field-grid">
        <div className="field-capture">
          <div className="field-phone">
            <div className="phone-top">
              <span>RECALL field</span>
              <span className="mono">14:42</span>
            </div>
            <div className="phone-status">
              <Chip tone={settings.ppmaOnline ? "green" : "amber"} dot={settings.ppmaOnline ? "live" : "warn"}>{settings.ppmaOnline ? "online" : "offline"}</Chip>
              <Chip><Icon name="battery" size={11} /> 54%</Chip>
              <Chip tone={batteryMode ? "green" : "neutral"}>{batteryMode ? "low-power" : "full quality"}</Chip>
            </div>
            <label className="field-label">
              <span>Observation</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={5}
                placeholder="What did you see or hear? Keep the exact words if they matter."
              />
            </label>
            <label className="field-label">
              <span>Location</span>
              <select value={location} onChange={(event) => setLocation(event.target.value)}>
                <option>Northgate — Building C</option>
                <option>Northgate — loading bay</option>
                <option>Bracknell — install site</option>
                <option>No location</option>
              </select>
            </label>
            <button className={classNames("photo-drop", photo && "has-photo")} onClick={() => fileRef.current?.click()}>
              {photo ? (
                <>
                  {photo.url && <img src={photo.url} alt="Field capture" />}
                  <span><b>{photo.name}</b><small>OCR on device · 97% confidence</small></span>
                </>
              ) : (
                <>
                  <Icon name="camera" size={22} />
                  <b>Add a photo</b>
                  <span>OCR runs on the device. The image is not uploaded.</span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (photo?.url) URL.revokeObjectURL(photo.url);
                setPhoto({
                  name: file.name,
                  ocr: "LOADING BAY 07:00–10:00\nMAX HEIGHT 2.4 m\nLIFT 900 kg",
                  url: URL.createObjectURL(file),
                });
                say("Photo OCR ran on device · text extracted locally");
              }}
            />
            {photo && (
              <div className="ocr-box">
                <span className="kicker">On-device OCR</span>
                <pre>{photo.ocr}</pre>
              </div>
            )}
            <button className="capture-big" onClick={capture} disabled={!text.trim()}>
              <Icon name="pin" size={18} /> Capture note
            </button>
            <p className="xsmall soft center">One hand. Large touch targets. No account required for the field capture.</p>
          </div>

          {saved && (
            <div className="field-saved">
              <Icon name="check" size={16} />
              <div><b>Note captured on device</b><span>Evidence pointer created. Send when connected, or leave it queued.</span></div>
              <button className="btn sm" onClick={() => { sendNote(saved); setSaved(null); }}><Icon name="send" size={12} /> Send now</button>
            </div>
          )}
        </div>

        <div className="field-side">
          <Panel title="Offline queue" sub="No event loss, no silent drop" actions={<button className="btn sm primary" onClick={flushQueue} disabled={!queue.length || !settings.ppmaOnline}>Sync now</button>}>
            <div className="sync-state">
              <div className="sync-orb" data-online={settings.ppmaOnline}>
                <Icon name={settings.ppmaOnline ? "wifi" : "wifiOff"} size={22} />
              </div>
              <div>
                <b>{settings.ppmaOnline ? "Connected" : "Working offline"}</b>
                <p>{queue.length ? `${queue.length} event${queue.length === 1 ? "" : "s"} queued locally. Capture continues.` : "Everything captured has been delivered."}</p>
              </div>
            </div>
            <div className="live-toggle">
              <span>Simulate network</span>
              <Toggle checked={settings.ppmaOnline} onChange={(value) => setSetting("ppmaOnline", value)} label="Simulate network availability" />
            </div>
            <div className="sync-metrics">
              <div><span>Queued</span><b>{queue.length}</b></div>
              <div><span>Last sync</span><b>{fmtDateTime(pack.meta.generated)}</b></div>
              <div><span>Bandwidth</span><b>text only</b></div>
              <div><span>Retry</span><b>exponential</b></div>
            </div>
            <div className="live-toggle mt12">
              <span>Battery-aware capture</span>
              <Toggle checked={batteryMode} onChange={setBatteryMode} label="Battery-aware capture" />
            </div>
            <p className="xsmall soft">Low-power mode reduces diarization cadence and pauses vision models below 20% battery. Capture never becomes cloud-only.</p>
          </Panel>

          <Panel title="Captured notes" sub={`${notes.length} notes · photo, text, location`}>
            <div className="note-list">
              {notes.map((note) => (
                <div className="note-card" key={note.id}>
                  <div className="row between">
                    <span className="kicker">{note.location.label}</span>
                    <Status value={sent(note.note_id) ? "delivered" : "pending"} />
                  </div>
                  <b>{note.title}</b>
                  <p>{note.text}</p>
                  {note.photo.ocr && (
                    <div className="ocr-box small"><span className="kicker">OCR</span><pre>{note.photo.ocr}</pre></div>
                  )}
                  <div className="row between">
                    <span className="xsmall soft">{fmtDate(note.captured_at, settings.lang)} · {note.offline_captured ? "offline" : "online"} · {note.photo.ocr ? "photo" : "text"}</span>
                    <button className="btn sm" onClick={() => sendNote(note.id)} disabled={sent(note.note_id)}>
                      <Icon name="send" size={12} /> {sent(note.note_id) ? "Sent" : "Send"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Do not record zones" sub="Ambient capture needs a real off switch">
            <div className="zones">
              {[
                ["Private offices", "auto-pause", "green"],
                ["Bathrooms / changing rooms", "blocked", "red"],
                ["Client legal review", "consent required", "amber"],
                ["After 19:00", "scheduled pause", "green"],
              ].map(([zone, mode, tone]) => (
                <div key={zone}><span>{zone}</span><Chip tone={tone}>{mode}</Chip></div>
              ))}
            </div>
            <p className="xsmall soft mt8">A wearable or always-on mode must respect these zones and the jurisdiction's wake-word rule before ambient capture ships.</p>
          </Panel>

          <Panel title="Ambient capture" sub="Always-on needs consent and a kill switch">
            <div className="live-toggle">
              <span><i className={classNames("dot", ambient ? "live" : "warn")} /> Low-power VAD · wake word</span>
              <Toggle checked={ambient} onChange={(value) => { setAmbient(value); say(value ? "Ambient mode armed. It pauses in no-record zones and asks for consent before saving." : "Ambient mode off. Capture requires an explicit start."); }} label="Ambient capture" />
            </div>
            <div className="sync-metrics">
              <div><span>VAD</span><b>on device</b></div>
              <div><span>Wake word</span><b>jurisdiction</b></div>
              <div><span>Battery budget</span><b>8 h</b></div>
              <div><span>Thermal</span><b>nominal</b></div>
            </div>
            <p className="xsmall soft mt8">Ambient capture is off by default. It requires a wake word or explicit start per jurisdiction, pauses in private spaces, and writes an audit entry for every activation.</p>
            <div className="zones mt8">
              <div><span>Private offices</span><Chip tone="green">auto-pause</Chip></div>
              <div><span>“Do not record” schedule</span><Chip tone="green">19:00–07:00</Chip></div>
              <div><span>Ambient activation audit</span><Chip tone="green">on</Chip></div>
            </div>
          </Panel>

          <Panel title="Field provenance" sub="Photo and note stay local">
            <div className="source-line"><SourceChip /><span className="xsmall soft">Every note carries its capture device, OCR model, consent and evidence pointer.</span></div>
            <div className="sync-metrics">
              <div><span>Device</span><b>iPhone 16 Pro · A18</b></div>
              <div><span>OCR model</span><b>ocr-small-v3</b></div>
              <div><span>Raw photo</span><b>on device</b></div>
              <div><span>PPMA payload</span><b>text + pointer</b></div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

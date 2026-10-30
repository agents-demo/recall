import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import { classNames, fmtDuration, fmtTime } from "../lib/engine";
import { PageHead, Panel, Chip, DataNote, Toggle, ProvenanceList } from "../components/UI";
import { Icon } from "../components/Icon";
import type { Consent } from "../types";

export default function Record() {
  const { pack, recordSession, importAudio, importCaseFile, settings, say } = useStore();
  const t = useT();
  const navigate = useNavigate();
  const [jurisdiction, setJurisdiction] = useState(pack?.team.jurisdiction ?? "DE");
  const [notified, setNotified] = useState(false);
  const [readWording, setReadWording] = useState(false);
  const [mode, setMode] = useState<"meeting" | "call">("meeting");
  const [scenarioId, setScenarioId] = useState(pack?.meta.stage_meeting_id ?? "");
  const [title, setTitle] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lines, setLines] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const caseRef = useRef<HTMLInputElement>(null);
  if (!pack) return null;

  const scenario = pack.meetings.find((m) => m.id === scenarioId) ?? pack.meetings[0];
  const jurisdictionInfo = pack.admin.jurisdictions.find((j) => j.code === jurisdiction) ?? pack.admin.jurisdictions[0];
  const consentReady = notified && readWording;
  const device = pack.team.devices[0];
  const personal = settings.workspaceMode === "personal";

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
      setLines((value) => Math.min(scenario.utterances.length, value + 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [recording, scenario.utterances.length]);

  const liveRows = useMemo(() => (personal ? [] : scenario.utterances.slice(0, lines)), [scenario.utterances, lines, personal]);

  const consent: Consent = {
    state: "granted",
    basis: jurisdictionInfo.model === "all-party notification" ? "all_participants_notified" : "one_party_with_notice",
    jurisdiction,
    participants_notified: true,
    evidence_ref: `consent_${Date.now().toString(36)}`,
    wording_version: jurisdictionInfo.wording,
    recorded_at: new Date().toISOString(),
    recorded_by: settings.role,
  };

  const start = () => {
    if (!consentReady) {
      say("Consent must be recorded before capture. Both boxes are required.");
      return;
    }
    setRecording(true);
    setElapsed(0);
    setLines(0);
  };

  const stop = () => {
    const id = recordSession(mode, title.trim() || `${scenario.title} · new capture`, consent, scenario.id);
    setRecording(false);
    if (id) navigate(`/meetings/${id}?new=1`);
  };

  const onImport = (file: File | undefined) => {
    if (!file) return;
    const id = importAudio(file.name);
    if (id) navigate(`/meetings/${id}?import=1`);
  };

  const onImportCase = async (file: File | undefined) => {
    if (!file) return;
    if (!consentReady) {
      say("Record consent first. A case file contains other people's words and cannot be imported without it.");
      return;
    }
    const text = await file.text();
    const id = importCaseFile(file.name, text, consent);
    if (id) navigate(`/meetings/${id}?import=1`);
  };

  return (
    <>
      <PageHead
        kicker={t("record.consent")}
        title={t("record.title")}
        subtitle={t("record.subtitle")}
        actions={
          <>
            <button className="btn" onClick={() => caseRef.current?.click()}><Icon name="file" size={14} /> Import a case</button>
            <input ref={caseRef} type="file" accept=".json,.txt,.md,.vtt,.srt,application/json,text/plain" hidden onChange={(event) => void onImportCase(event.target.files?.[0])} />
            <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="download" size={14} /> {t("record.import")}</button>
            <input ref={fileRef} type="file" accept="audio/*,video/*" hidden onChange={(event) => onImport(event.target.files?.[0])} />
          </>
        }
      />
      <DataNote
        seed={pack.meta.seed}
        label={personal ? "My workspace" : undefined}
        tone={personal ? "green" : "amber"}
        note={
          personal
            ? "My workspace: consent and capture are real UI behaviour, but this public build does not open the microphone or run speech recognition. The capture is saved without a transcript."
            : "The public build uses a scripted meeting and does not open the microphone. Consent, device state, local transcription and the event path are real UI behaviour over a deterministic local pack."
        }
      />

      <div className="record-grid">
        <div className="record-main">
          <Panel title="1 · Consent before capture" sub="Jurisdiction-aware wording · recorded before any audio">
            <div className="consent-form">
              <label className="field">
                <span>Jurisdiction</span>
                <select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}>
                  {pack.admin.jurisdictions.map((jurisdiction) => (
                    <option key={jurisdiction.code} value={jurisdiction.code}>
                      {jurisdiction.name} · {jurisdiction.model} · {jurisdiction.wording}
                    </option>
                  ))}
                </select>
              </label>
              <div className="wording-box">
                <div className="row between">
                  <span className="kicker">Consent wording · {jurisdictionInfo.wording}</span>
                  <Chip tone={jurisdictionInfo.status === "active" ? "green" : "amber"}>{jurisdictionInfo.status}</Chip>
                </div>
                <p>
                  “This meeting is being recorded and transcribed locally for the project record. Everyone present has been
                  told, and the recording stays on this device unless a safe version is shared with the project memory.
                  You may ask for a correction or deletion at any time.”
                </p>
                <div className="row wrap gap8 mt8">
                  <Chip tone="green" dot="live">Two-party / all-party check</Chip>
                  <Chip>No cloud upload</Chip>
                  <Chip>Retention {pack.team.retention_days} days</Chip>
                </div>
              </div>
              <label className="check-row">
                <input type="checkbox" checked={notified} onChange={(event) => setNotified(event.target.checked)} />
                <span>All participants have been notified and have not objected.</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={readWording} onChange={(event) => setReadWording(event.target.checked)} />
                <span>I have read the wording above and it is accurate for this jurisdiction.</span>
              </label>
              {!consentReady && <p className="xsmall soft">Capture stays blocked until both boxes are checked. There is no override.</p>}
            </div>
          </Panel>

          <Panel title="2 · Capture" sub={recording ? "Recording · on device" : "Choose the meeting type and a scripted scenario"}>
            {!recording ? (
              <div className="capture-setup">
                <div className="mode-switch">
                  {(["meeting", "call"] as const).map((value) => (
                    <button key={value} className={classNames("mode-btn", mode === value && "active")} onClick={() => setMode(value)}>
                      <Icon name={value === "meeting" ? "users" : "headphones"} size={16} />
                      {value === "meeting" ? "Meeting" : "Call"}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={personal ? "New capture" : `${scenario.title} · new capture`} />
                </label>
                {personal ? (
                  <p className="xsmall soft">No scripted scenario. This capture starts empty; speech recognition is not part of this public build.</p>
                ) : (
                  <>
                    <label className="field">
                      <span>Scripted scenario</span>
                      <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                        {pack.meetings.map((meeting) => (
                          <option key={meeting.id} value={meeting.id}>
                            {meeting.title} · {fmtDuration(meeting.duration_s)} · {meeting.participants.length} speakers
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="scenario-strip">
                      {pack.meetings.map((meeting) => (
                        <button key={meeting.id} className={classNames("scenario-chip", meeting.id === scenarioId && "active")} onClick={() => setScenarioId(meeting.id)}>
                          <b>{meeting.title.split("—")[0].trim()}</b>
                          <small>{fmtDuration(meeting.duration_s)} · {meeting.participants.length} speakers</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button className="record-start" onClick={start} disabled={!consentReady}>
                  <span className="record-dot" />
                  {t("record.start")}
                </button>
                <p className="xsmall soft center">
                  {consentReady ? "The transcript appears while the meeting is still happening." : "Record consent first — the control is disabled."}
                </p>
              </div>
            ) : (
              <div className="recording-live">
                <div className="recording-head">
                  <div>
                    <span className="rec-live"><i className="dot bad" /> REC</span>
                    <b className="mono">{fmtDuration(elapsed)}</b>
                  </div>
                  <div className="record-level" aria-hidden="true">
                    {Array.from({ length: 28 }).map((_, index) => (
                      <i key={index} style={{ animationDelay: `${index * 60}ms`, height: `${16 + ((index * 41) % 78)}%` }} />
                    ))}
                  </div>
                  <Chip tone="green" dot="live">NPU · local</Chip>
                </div>
                <div className="live-transcript compact">
                  {personal ? (
                    <div className="live-row">
                      <span className="live-body">
                        <b>No speech recognition</b>
                        <p>This build does not open the microphone or run ASR. The timer is real; the capture will be saved empty.</p>
                      </span>
                    </div>
                  ) : (
                    <>
                      {liveRows.map((row) => {
                        const speaker = scenario.participants.find((p) => p.id === row.speaker_id);
                        return (
                          <div className="live-row" key={row.id}>
                            <span className={`live-speaker sp-${speaker?.color ?? "amber"}`}>{speaker?.initials}</span>
                            <span className="live-body">
                              <b>{speaker?.name}</b> <span className="mono">{fmtTime(row.start)}</span>
                              <p>{row.text}</p>
                            </span>
                          </div>
                        );
                      })}
                      <span className="live-cursor" />
                    </>
                  )}
                </div>
                <div className="recording-actions">
                  <button className="btn danger lg" onClick={stop}>
                    <Icon name="stop" size={12} /> {personal ? "Stop capture" : t("record.stop")}
                  </button>
                  <span className="xsmall soft">{personal ? "Stopping saves the consent record and an empty capture. No transcript is invented." : "Stopping emits `capture.meeting.completed` only after the transcript is usable."}</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="3 · Local transcription & diarization" sub={personal ? "Not available in this public build" : "Models that run on the device; CPU fallback is visibly weaker"}>
            {personal ? (
              <p className="small muted">
                This build does not ship the on-device VAD, ASR, diarization or extraction models. Your capture keeps the
                consent record, title, time and event; it has no transcript. The demo pack shows what those models do
                when the synthetic workspace is enabled.
              </p>
            ) : (
              <div className="model-run">
              {[
                ["VAD", "Silero VAD 5 · int8", "done"],
                ["ASR", "Parakeet TDT 0.6B · int8", recording ? "running" : "ready"],
                ["Diarization", "pyannote 3.1 mini · int8", recording ? "running" : "ready"],
                ["Extraction", "Fact extractor 0.7", recording ? "waiting" : "ready"],
                ["Redaction", "Redact classifier 0.4", recording ? "waiting" : "ready"],
              ].map(([name, detail, state]) => (
                <div className="model-row" key={name}>
                  <span className={`model-state ${state}`}><i /></span>
                  <b>{name}</b>
                  <span>{detail}</span>
                  <Chip tone={state === "running" ? "amber" : state === "done" ? "green" : "neutral"}>{state}</Chip>
                </div>
              ))}
              </div>
            )}
            {!personal && (
              <div className="cpu-note">
                <Icon name="alert" size={14} /> CPU fallback is allowed but shows a quality warning: higher latency, lower battery life, weaker diarization. No silent cloud fallback.
              </div>
            )}
          </Panel>
        </div>

        <aside className="record-side">
          <div className="device-card">
            <div className="row between">
              <span className="kicker">Device state</span>
              <Chip tone="green" dot="live">ready</Chip>
            </div>
            <b className="device-name">{device.name}</b>
            <span className="xsmall soft">{device.owner} · {device.npu}</span>
            <div className="device-meters">
              <div><span><Icon name="mic" size={13} /> Input</span><div className="mic-meter"><i style={{ width: recording ? "68%" : "24%" }} /></div><b>{recording ? "-12 dB" : "idle"}</b></div>
              <div><span><Icon name="battery" size={13} /> Battery</span><div className="meter"><i className="meter-fill tone-green" style={{ width: `${device.battery_pct ?? 72}%` }} /></div><b>{device.battery_pct ?? 72}%</b></div>
              <div><span><Icon name="harddrive" size={13} /> Storage</span><div className="meter"><i className="meter-fill tone-amber" style={{ width: `${device.storage_used_pct}%` }} /></div><b>{device.storage_used_pct}%</b></div>
            </div>
            <div className="device-grid">
              <span><i className="dot live" /> Mic clipping</span><b>none</b>
              <span><i className="dot live" /> Encryption</span><b>AES-256-GCM</b>
              <span><i className="dot live" /> Network</span><b>not required</b>
              <span><i className="dot warn" /> Background</span><b>foreground only</b>
            </div>
          </div>

          <Panel title="Consent state" sub="What PPMA will see">
            <div className="consent-summary">
              <div><span>State</span><b>{consentReady ? "Granted" : "Missing"}</b></div>
              <div><span>Basis</span><b>{jurisdictionInfo.model}</b></div>
              <div><span>Wording</span><b className="mono">{jurisdictionInfo.wording}</b></div>
              <div><span>Participants notified</span><b>{notified ? "Yes" : "No"}</b></div>
              <div><span>Raw media</span><b>local only</b></div>
            </div>
            <p className="xsmall soft mt8">If consent is missing or withdrawn, RECALL emits no capture event. The only exception is the consent-change event itself.</p>
          </Panel>

          <Panel title="Import for backfill" sub="Existing audio or video, transcribed locally">
            <button className="drop-zone" onClick={() => fileRef.current?.click()}>
              <Icon name="download" size={20} />
              <b>Choose an audio or video file</b>
              <span>Nothing is uploaded. The file stays on this device; the demo attaches a scripted local transcript.</span>
            </button>
          </Panel>

          <Panel title="Provenance" sub="Every capture carries its source">
            <ProvenanceList
              items={{
                app_version: pack.meta.version,
                device: device.name,
                npu: device.npu,
                asr: "parakeet-tdt-0.6b-int8",
                diarization: "pyannote-3.1-mini",
                "encryption at rest": "AES-256-GCM · device key",
                language: "en",
              }}
            />
          </Panel>
        </aside>
      </div>

      <div className="toggle-strip">
        <div>
          <b>Battery-aware capture</b>
          <span>Lower the diarization cadence and pause vision models when the battery is below 20%.</span>
        </div>
        <Toggle checked={true} onChange={() => say("Battery-aware capture stays on for the pilot.")} label="Battery-aware capture" />
      </div>
    </>
  );
}

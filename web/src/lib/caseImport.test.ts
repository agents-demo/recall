import { describe, expect, it } from "vitest";
import { buildMeeting, parseCaseFile } from "./caseImport";
import type { Consent, Meeting } from "../types";

const base = {
  id: "mtg_base",
  capture_id: "cap_base",
  title: "Base",
  mode: "meeting",
  started_at: "2026-01-01T00:00:00Z",
  ended_at: "2026-01-01T00:10:00Z",
  duration_s: 600,
  language: "en",
  jurisdiction: "DE",
  sensitivity: "personal",
  status: "captured",
  participants: [],
  consent: { state: "granted", basis: "all_participants_notified", jurisdiction: "DE", participants_notified: true, evidence_ref: "c", wording_version: "DE-2026-2", recorded_at: "2026-01-01T00:00:00Z", recorded_by: "owner" },
  summary: "",
  utterances: [],
  decisions: [],
  actions: [],
  questions: [],
  evidence: [],
  redactions: [],
  provenance: { device: "d", npu: "n", asr_model: "a", diarization_model: "d", vad_model: "v", redaction_model: "r", app_version: "1.4.0", language: "en", audio_sha256: "", local_only: true, encrypted_at_rest: "yes", retention: "365", network: "none" },
  retention: { retain_until: "2027-01-01T00:00:00Z", policy: "team_default", legal_hold: false },
  tags: [],
  baseline_lookup_min: 0,
  ppma: { status: "pending", event_id: null, completed_at: null },
  import: false,
  deleted_at: null,
  deleted_reason: null,
  tombstone_id: null,
} as Meeting;

const consent = base.consent as Consent;

describe("parseCaseFile", () => {
  it("parses the example JSON shape", () => {
    const parsed = parseCaseFile(
      "case.json",
      JSON.stringify({
        title: "Helios",
        occurred_at: "2026-11-04T09:00:00Z",
        duration_seconds: 2400,
        participants: [{ name: "Dana Whitfield", role: "Lead" }],
        summary: "A rollout decision.",
        decisions: [{ text: "Delay self-serve.", evidence_id: "e1" }],
        actions: [{ text: "Send the rota.", owner: "Ravi", due: "2026-11-06", evidence_id: "e1" }],
        transcript: [{ id: "e1", start: 12, speaker: "Dana Whitfield", text: "We delay self-serve." }],
      }),
    );
    expect(parsed?.title).toBe("Helios");
    expect(parsed?.transcript).toHaveLength(1);
    expect(parsed?.decisions[0].text).toBe("Delay self-serve.");
    expect(parsed?.actions[0].owner).toBe("Ravi");
  });

  it("parses a plain transcript with [mm:ss] speaker lines", () => {
    const parsed = parseCaseFile(
      "notes.txt",
      "[00:12] Dana Whitfield (Lead)\nWe hold the fourth.\n\n[00:40] Ravi Menon\nI will send the rota.",
    );
    expect(parsed?.transcript).toHaveLength(2);
    expect(parsed?.transcript[0].speaker).toBe("Dana Whitfield");
    expect(parsed?.transcript[1].start).toBe(40);
  });

  it("parses WebVTT cues", () => {
    const parsed = parseCaseFile(
      "case.vtt",
      "WEBVTT\n\n00:00:05.000 --> 00:00:09.000\nDana: We hold the fourth.\n\n00:00:12.000 --> 00:00:15.000\nRavi: I will send the rota.",
    );
    expect(parsed?.transcript).toHaveLength(2);
    expect(parsed?.transcript[0].start).toBe(5);
    expect(parsed?.transcript[1].speaker).toBe("Ravi");
  });

  it("returns null for a file with no transcript and no case", () => {
    expect(parseCaseFile("empty.txt", "   \n\n")).toBeNull();
    expect(parseCaseFile("bad.json", "{")).toBeNull();
  });

  it("builds a meeting with utterances and evidence from the case", () => {
    const parsed = parseCaseFile(
      "case.json",
      JSON.stringify({
        title: "Helios",
        consent: { state: "all_notified" },
        participants: [{ name: "Dana Whitfield" }, { name: "Ravi Menon" }],
        summary: "A rollout decision.",
        decisions: [{ text: "Delay self-serve.", evidence_id: "e1" }],
        actions: [{ text: "Send the rota.", owner: "Ravi", evidence_id: "e2" }],
        transcript: [
          { id: "e1", start: 12, speaker: "Dana Whitfield", text: "We delay self-serve." },
          { id: "e2", start: 40, speaker: "Ravi Menon", text: "I will send the rota." },
        ],
      }),
    );
    const meeting = buildMeeting(parsed!, base, consent);
    expect(meeting.utterances).toHaveLength(2);
    expect(meeting.decisions).toHaveLength(1);
    expect(meeting.actions[0].owner).toBe("Ravi");
    expect(meeting.evidence).toHaveLength(2);
    expect(meeting.evidence[0].quote).toBe("We delay self-serve.");
    expect(meeting.participants.map((p) => p.name)).toEqual(["Dana Whitfield", "Ravi Menon"]);
  });
});

import type { Citation, Meeting, ShareRecord } from "../types";
import { safeQuote, shaLike } from "./engine";

interface SharePayload {
  v: 1;
  meeting_id: string;
  evidence_id: string;
  meeting_title: string;
  quote: string;
  speaker: string;
  start: number;
  end: number;
  confidence: number;
  created_at: string;
  expires_at: string;
  provenance: Record<string, string>;
  redactions: string[];
}

function encode(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode<T>(token: string): T | null {
  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function createShareLink(meeting: Meeting, evidenceId: string, days = 7): { url: string; record: ShareRecord } | null {
  const evidence = meeting.evidence.find((item) => item.id === evidenceId);
  if (!evidence) return null;
  const created = new Date();
  const expires = new Date(created.getTime() + days * 86_400_000);
  const payload: SharePayload = {
    v: 1,
    meeting_id: meeting.id,
    evidence_id: evidence.id,
    meeting_title: meeting.title,
    quote: safeQuote(meeting, evidence, true),
    speaker: meeting.participants.find((person) => person.id === evidence.speaker_id)?.name ?? evidence.speaker_id,
    start: evidence.start,
    end: evidence.end,
    confidence: evidence.confidence,
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
    provenance: {
      device: meeting.provenance.device,
      model: meeting.provenance.asr_model,
      app_version: meeting.provenance.app_version,
      consent: meeting.consent.state,
      jurisdiction: meeting.consent.jurisdiction,
    },
    redactions: meeting.redactions.filter((redaction) => redaction.evidence_id === evidence.id).map((redaction) => redaction.safe_text),
  };
  const token = encode(payload);
  const base = `${location.origin}${location.pathname}`.replace(/#.*$/, "");
  return {
    url: `${base}#/share/${token}`,
    record: {
      token: `sha256:${shaLike(token)}`.slice(0, 24),
      meeting_id: meeting.id,
      evidence_id: evidence.id,
      created_at: created.toISOString(),
      expires_at: expires.toISOString(),
      redacted: payload.redactions.length > 0,
    },
  };
}

export function decodeShareLink(token: string): SharePayload | null {
  const payload = decode<SharePayload>(token);
  if (!payload || payload.v !== 1) return null;
  return payload;
}

export function shareStatus(payload: SharePayload): { expired: boolean; daysLeft: number } {
  const expires = new Date(payload.expires_at).getTime();
  const left = expires - Date.now();
  return { expired: left <= 0, daysLeft: Math.max(0, Math.ceil(left / 86_400_000)) };
}

export function shareCitation(payload: SharePayload): Citation {
  return {
    evidence_id: payload.evidence_id,
    meeting_id: payload.meeting_id,
    meeting_title: payload.meeting_title,
    quote: payload.quote,
    speaker: payload.speaker,
    start: payload.start,
    end: payload.end,
    confidence: payload.confidence,
  };
}

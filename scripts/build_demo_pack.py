#!/usr/bin/env python3
"""Build the deterministic RECALL demo pack.

Everything in web/public/demo-pack.json is synthetic and generated here with a fixed
seed. No customer audio, transcript or personal data is used. The same pack ships to
the stage build, the booth build and the public GitHub Pages site so every run is
identical and works offline.

Run from the repository root:
    py scripts/build_demo_pack.py
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "demo-pack.json"
SEED = 20261030
ANCHOR = "2026-10-30T09:00:00Z"


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def hhmmss(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def words(text: str) -> int:
    return max(1, len(text.split()))


class MeetingBuilder:
    """Collect utterances and give every line a stable id and a plausible end time."""

    def __init__(self, meeting_id: str):
        self.meeting_id = meeting_id
        self.rows: list[dict] = []

    def say(self, speaker: str, start: float, text: str, confidence: float = 0.94) -> dict:
        duration = max(2.4, words(text) * 0.42)
        row = {
            "id": f"u_{self.meeting_id[-4:]}_{len(self.rows) + 1:03d}",
            "speaker_id": speaker,
            "start": round(start, 1),
            "end": round(start + duration, 1),
            "text": text,
            "confidence": confidence,
        }
        self.rows.append(row)
        return row


def participant(pid: str, name: str, role: str, color: str) -> dict:
    initials = "".join(part[0] for part in name.split()[:2]).upper()
    return {"id": pid, "name": name, "role": role, "initials": initials, "color": color}


def consent(state="granted", jurisdiction="DE", basis="all_participants_notified", ref="consent_01") -> dict:
    return {
        "state": state,
        "basis": basis,
        "jurisdiction": jurisdiction,
        "participants_notified": state == "granted",
        "evidence_ref": ref,
        "wording_version": f"{jurisdiction}-2026-2",
        "recorded_at": "2026-10-30T08:59:12Z",
        "recorded_by": "user_anna",
    }


def provenance(device="MacBook Pro 14 · M4", local=True, model="parakeet-tdt-0.6b-int8") -> dict:
    return {
        "device": device,
        "npu": "Apple Neural Engine · 16-core",
        "asr_model": model,
        "diarization_model": "pyannote-3.1-mini · int8",
        "vad_model": "silero-vad-5 · int8",
        "redaction_model": "redact-clf-0.4 · int8",
        "app_version": "1.8.0",
        "language": "en",
        "audio_sha256": sha(f"audio::{device}::{model}"),
        "local_only": local,
        "encrypted_at_rest": "AES-256-GCM · device key",
        "retention": "team_default",
        "network": "offline" if local else "connected",
    }


def evidence(
    eid: str,
    kind: str,
    quote: str,
    speaker_id: str,
    start: float,
    confidence: float = 0.93,
    attribution: float = 0.94,
    utterance_id: str | None = None,
    sensitivity: str = "client_confidential",
    redaction_id: str | None = None,
) -> dict:
    end = start + max(2.4, words(quote) * 0.42)
    return {
        "id": eid,
        "kind": kind,
        "quote": quote,
        "speaker_id": speaker_id,
        "start": round(start, 1),
        "end": round(end, 1),
        "confidence": confidence,
        "attribution_confidence": attribution,
        "utterance_id": utterance_id,
        "sensitivity": sensitivity,
        "redaction_id": redaction_id,
    }


def link_evidence(items: list[dict], utterances: list[dict]) -> None:
    """Attach each evidence item to the utterance that starts at the same second."""
    for item in items:
        for row in utterances:
            if abs(row["start"] - item["start"]) < 0.05:
                item["utterance_id"] = row["id"]
                item["end"] = row["end"]
                break


# --------------------------------------------------------------------------- meeting 1
DELIVERY = "mtg_delivery_1030"
b = MeetingBuilder(DELIVERY)
script = [
    ("p1", 0, "Recording is on. Everyone has been told this is for the project record — Sandra, Tomás, you're both fine with that?"),
    ("p3", 8, "Fine by me. Let's keep it to the delivery question; I have another call at half past."),
    ("p2", 15, "I'll share the schedule so we're all looking at the same thing."),
    ("p1", 21, "Good. The question from the client this morning was whether we can still make the 12th."),
    ("p2", 28, "Right. The install crew is the constraint, not the hardware."),
    ("p4", 34, "The crew finishes the Bracknell job on the 10th. After that we have two vans free."),
    ("p3", 42, "And the building access? We only have the loading bay from seven until ten."),
    ("p4", 49, "That's workable if we start on the Tuesday. It is not workable on the Thursday."),
    ("p1", 57, "So the 12th is Thursday."),
    ("p4", 61, "Correct. And the 14th is Saturday — quieter building, full access."),
    ("p3", 69, "Saturday costs us overtime for our own team. I need to flag that internally."),
    ("p2", 77, "Understood. Let's be explicit about the trade-off, then."),
    ("p1", 84, "Let's walk the scope first, so the date decision is grounded."),
    ("p2", 90, "Three parts: hardware delivery, installation, and the two-hour training."),
    ("p4", 98, "Hardware is already in the warehouse. That is not the risk."),
    ("p3", 104, "The risk is our access window and the lift booking."),
    ("p4", 111, "The lift is booked for the Tuesday and the Saturday. Not the Thursday."),
    ("p1", 119, "Okay. So if we say the 12th, we are promising a day the building cannot support."),
    ("p2", 127, "That is how I read it."),
    ("p3", 131, "I would rather move the date than run a half-install."),
    ("p1", 138, "Agreed. Nobody wants a half-install."),
    ("p2", 144, "The hardware is fine. The crew is fine. The building is the constraint."),
    ("p4", 151, "And the crew needs a clear twelve-hour window. Two vans, four people."),
    ("p3", 159, "On the Saturday we can give you seven until seven."),
    ("p4", 166, "That works. On the Thursday we would lose the afternoon to the school run."),
    ("p1", 174, "Let's put the access question in writing as well."),
    ("p2", 180, "I'll add it to the confirmation."),
    ("p1", 185, "Now the training. Is that the same visit or a separate one?"),
    ("p2", 192, "It was quoted as a separate visit, but we can fold it into the Saturday if the room is free."),
    ("p3", 201, "The room is free on the Saturday. The trainer is not."),
    ("p4", 208, "Our trainer is on another site that week."),
    ("p1", 214, "So the 14th can include installation but not training, unless we move the trainer."),
    ("p3", 223, "That is my understanding."),
    ("p2", 228, "Let's not create a promise we cannot keep on training."),
    ("p1", 235, "Agreed. Installation on the 14th, training to be confirmed separately."),
    ("p4", 243, "If training is separate, I need one more van on the 17th."),
    ("p2", 251, "Noted. I'll check availability and come back tomorrow."),
    ("p3", 259, "And who covers the Saturday overtime for our team?"),
    ("p1", 266, "That is a commercial question. I'll take it offline with Sandra."),
    ("p3", 274, "Thank you. I don't want my team out of pocket."),
    ("p2", 281, "Fair."),
    ("p1", 286, "Let's look at the support window next."),
    ("p2", 292, "Thirty days from handover, remote first, one site visit included."),
    ("p3", 300, "Does the thirty days start on the 14th or on the training day?"),
    ("p2", 308, "On handover. The 14th."),
    ("p3", 314, "Then if training slips, our support is already running."),
    ("p1", 321, "That's a fair point. We should align those dates."),
    ("p2", 329, "I can start support on the training day instead. It is a small change."),
    ("p3", 337, "That would be cleaner."),
    ("p1", 342, "Let's note it as a proposed change, not agreed yet."),
    ("p2", 349, "Proposed. I'll confirm with finance."),
    ("p4", 356, "While we're on dates — the Bracknell job could slip by a day."),
    ("p1", 363, "How likely is that?"),
    ("p4", 368, "Twenty percent. If it slips, the 14th is still safe. The 12th is not."),
    ("p2", 377, "That reinforces the recommendation."),
    ("p3", 382, "Then I think we should stop pretending the 12th is possible."),
    ("p1", 390, "I agree. Let's make that the decision."),
    ("p2", 396, "For the record: the 12th is not achievable with the current access and crew."),
    ("p3", 405, "And the 14th is achievable if we confirm by Friday."),
    ("p1", 413, "Confirm by Friday. Understood."),
    ("p4", 419, "I'll hold the crew for the 14th until Friday noon."),
    ("p2", 427, "Please do. We don't want to lose the slot."),
    ("p1", 433, "Now the internal bit before we close."),
    ("p3", 439, "Should I drop off for that?"),
    ("p1", 443, "No, stay — it's only scheduling."),
    ("p1", 449, "Between us, Sandra's team is chaotic — they will not have the access list ready by the 12th anyway."),
    ("p3", 460, "I heard that."),
    ("p1", 464, "I'm sorry, that was unhelpful. Let me rephrase: the access list is the critical path."),
    ("p2", 474, "Let's keep it factual. Access list owner and date."),
    ("p3", 482, "I'll own it. Tuesday the 27th, end of day."),
    ("p4", 490, "That gives us time to plan the vans."),
    ("p1", 496, "Good. Tuesday the 27th."),
    ("p2", 502, "I'll put that in the note."),
    ("p3", 508, "And I'll copy my facilities lead."),
    ("p1", 514, "Let's go back to the client-facing summary."),
    ("p2", 520, "We need one sentence the client can forward internally."),
    ("p1", 527, "Something like: installation moves to the 14th, access confirmed, training to follow."),
    ("p3", 536, "That is accurate."),
    ("p4", 541, "And the crew is held until Friday."),
    ("p2", 547, "Good."),
    ("p1", 552, "Now the commercial framing. The client asked whether the move costs them anything."),
    ("p2", 560, "The install itself does not. The Saturday overtime is their side."),
    ("p3", 569, "And our overtime is ours to absorb. I've already flagged it."),
    ("p1", 578, "So we are not asking for more money."),
    ("p2", 584, "Not for installation. Training is separate."),
    ("p3", 591, "If training moves, that is a change order."),
    ("p1", 598, "Understood. I'll say that plainly."),
    ("p2", 604, "Do we need legal to review the confirmation?"),
    ("p1", 610, "No, it's an operational note. But keep the change-order language out of it."),
    ("p3", 619, "Agreed."),
    ("p4", 623, "One more thing — the loading bay has a 900 kilo lift limit."),
    ("p2", 631, "The racks are 780. We're fine."),
    ("p4", 637, "Fine on paper. I'll measure on the day."),
    ("p1", 643, "Good. Any other risks?"),
    ("p3", 648, "Parking for the vans. Saturday is better, but we need two permits."),
    ("p2", 656, "I'll add permits to the confirmation."),
    ("p1", 663, "So the action list is growing. Let's capture it."),
    ("p2", 670, "Confirmation, permits, schedule, crew hold."),
    ("p1", 677, "And training date."),
    ("p4", 681, "And the 17th van if training is separate."),
    # The promise. Deliberately attributed to p1 (Anna) by diarization at low confidence.
    ("p1", 684, "On delivery: we can hold the 14th, but not the 12th."),
    ("p3", 694, "Say that again for the record."),
    ("p2", 699, "We can hold the 14th, but not the 12th. The 12th is not achievable."),
    ("p3", 710, "Thank you. That is what I will tell my board."),
    ("p1", 719, "And we will put it in writing today."),
    ("p3", 726, "Before five, please. Their board meets at six."),
    ("p1", 733, "Before five. Understood."),
    ("p2", 738, "I'll update the schedule and tell the crew."),
    ("p4", 745, "I'll hold the vans until Friday noon."),
    ("p3", 752, "One open question: does the 14th include the training session, or is that a separate visit?"),
    ("p1", 762, "Installation on the 14th. Training is separate until we confirm the trainer."),
    ("p3", 772, "Then I need that in the written note, with the change-order caveat."),
    ("p1", 781, "I'll phrase it as: training date to be confirmed, commercial terms unchanged."),
    ("p3", 791, "Good."),
    ("p4", 795, "If training is separate, I need one more van on the 17th."),
    ("p2", 803, "I'll confirm the van today."),
    ("p1", 810, "Okay, we're done. Thanks everyone — I'll circulate the confirmation within the hour."),
    ("p3", 818, "Thanks. Bye."),
    ("p4", 821, "Bye."),
]
for speaker, start, text in script:
    confidence = 0.71 if "(not used)" in text else (0.9 if speaker == "p1" and start == 684 else 0.95)
    b.say(speaker, start, text, confidence=confidence)
# lower the confidence of the mis-attributed line explicitly
for row in b.rows:
    if row["start"] == 684:
        row["confidence"] = 0.71
        row["attribution_hint"] = "low confidence: voiceprint ambiguity (Anna / Marek)"

delivery_utterances = b.rows

delivery_evidence = [
    evidence(
        "ev_01",
        "promise",
        "We can hold the 14th, but not the 12th.",
        "p1",
        684,
        confidence=0.93,
        attribution=0.71,
        utterance_id="u_1030_099",
    ),
    evidence(
        "ev_02",
        "action",
        "I'll circulate the confirmation within the hour.",
        "p1",
        810,
        confidence=0.9,
        attribution=0.96,
        utterance_id="u_1030_120",
    ),
    evidence(
        "ev_03",
        "question",
        "Does the 14th include the training session, or is that a separate visit?",
        "p3",
        752,
        confidence=0.95,
        attribution=0.97,
        utterance_id="u_1030_115",
    ),
    evidence(
        "ev_04",
        "decision",
        "Saturday — quieter building, full access.",
        "p4",
        61,
        confidence=0.88,
        attribution=0.94,
        utterance_id="u_1030_010",
    ),
    evidence(
        "ev_05",
        "note",
        "Between us, Sandra's team is chaotic — they will not have the access list ready by the 12th anyway.",
        "p1",
        449,
        confidence=0.96,
        attribution=0.98,
        utterance_id="u_1030_066",
        sensitivity="client_confidential",
        redaction_id="red_01",
    ),
    evidence(
        "ev_06",
        "action",
        "I'll update the schedule and tell the crew.",
        "p2",
        738,
        confidence=0.94,
        attribution=0.95,
        utterance_id="u_1030_113",
    ),
    evidence(
        "ev_07",
        "action",
        "If training is separate, I need one more van on the 17th.",
        "p4",
        795,
        confidence=0.92,
        attribution=0.93,
        utterance_id="u_1030_118",
    ),
    evidence(
        "ev_08",
        "decision",
        "The 12th is not achievable with the current access and crew.",
        "p2",
        396,
        confidence=0.91,
        attribution=0.96,
        utterance_id="u_1030_057",
    ),
]

# The redaction exists in the pack as a *detected* passage, not yet applied. The stage
# and the meeting detail let the human apply it before the safe version leaves the device.
delivery_redactions = [
    {
        "id": "red_01",
        "evidence_id": "ev_05",
        "utterance_id": "u_1030_066",
        "reason": "client_confidential",
        "label": "Internal client comment",
        "safe_text": "[redacted — internal client comment]",
        "detected_by": "redact-clf-0.4",
        "confidence": 0.96,
        "status": "detected",
        "applied_at": None,
        "applied_by": None,
    }
]

meeting_delivery = {
    "id": DELIVERY,
    "capture_id": "cap_01J9Q4M2R7X8K3N5V6B1C0D",
    "title": "Client delivery call — Northgate",
    "mode": "meeting",
    "started_at": "2026-10-30T09:00:00Z",
    "ended_at": "2026-10-30T09:13:42Z",
    "duration_s": 822,
    "language": "en",
    "jurisdiction": "DE",
    "sensitivity": "client_confidential",
    "status": "captured",
    "participants": [
        participant("p1", "Anna Voss", "Account lead", "amber"),
        participant("p2", "Marek Nowak", "Delivery lead", "cyan"),
        participant("p3", "Sandra Klein", "Client operations", "violet"),
        participant("p4", "Tomás Rivera", "Installation lead", "green"),
    ],
    "consent": consent(),
    "summary": "Delivery date moved to the 14th; the 12th is not achievable. Installation starts at 07:00 with full building access. Written confirmation before 17:00, training date to be confirmed. The client flagged Saturday overtime internally.",
    "utterances": delivery_utterances,
    "decisions": [
        {"id": "dec_01", "text": "Hold the 14th, not the 12th.", "evidence_id": "ev_01", "confidence": 0.91, "status": "accepted"},
        {"id": "dec_02", "text": "The 12th is not achievable with the current access and crew.", "evidence_id": "ev_08", "confidence": 0.9, "status": "accepted"},
        {"id": "dec_03", "text": "Installation starts at 07:00 with full building access.", "evidence_id": "ev_04", "confidence": 0.86, "status": "accepted"},
        {"id": "dec_04", "text": "Training stays separate until the trainer is confirmed.", "evidence_id": "ev_03", "confidence": 0.84, "status": "proposed"},
    ],
    "actions": [
        {"id": "act_01", "text": "Send written confirmation to the client before 17:00.", "owner": "Anna", "due": "2026-10-30", "evidence_id": "ev_02", "confidence": 0.94, "status": "open"},
        {"id": "act_02", "text": "Update the install schedule and notify the crew.", "owner": "Marek", "due": "2026-10-30", "evidence_id": "ev_06", "confidence": 0.93, "status": "open"},
        {"id": "act_03", "text": "Confirm whether training is included on the 14th.", "owner": "Anna", "due": "2026-10-31", "evidence_id": "ev_03", "confidence": 0.88, "status": "open"},
        {"id": "act_04", "text": "Check van availability for a separate training visit.", "owner": "Tomás", "due": "2026-10-31", "evidence_id": "ev_07", "confidence": 0.9, "status": "open"},
    ],
    "questions": [
        {"id": "q_01", "text": "Does the 14th include the training session, or is that a separate visit?", "evidence_id": "ev_03", "confidence": 0.95, "status": "open"},
        {"id": "q_02", "text": "Who covers the Saturday overtime for the client's team?", "evidence_id": "ev_05", "confidence": 0.72, "status": "open"},
    ],
    "evidence": delivery_evidence,
    "redactions": delivery_redactions,
    "provenance": provenance(),
    "retention": {"retain_until": "2027-10-30T00:00:00Z", "policy": "team_default", "legal_hold": False},
    "tags": ["northgate", "delivery", "client"],
    "baseline_lookup_min": 26,
    "ppma": {"status": "pending", "event_id": None, "completed_at": None},
    "import": False,
}

# --------------------------------------------------------------------------- meeting 2
KICKOFF = "mtg_kickoff_1009"
k = MeetingBuilder(KICKOFF)
kick_script = [
    ("p1", 0, "Welcome, everyone. This is the Northgate fit-out kickoff. Recording for the project record."),
    ("p3", 9, "Thanks. I'll represent the client side."),
    ("p2", 15, "I'll run through the plan, then we can challenge the dates."),
    ("p4", 22, "I have the install plan open."),
    ("p2", 28, "The working assumption is a handover in the week of the 12th."),
    ("p3", 36, "The 12th is a board commitment. It needs to be real, not aspirational."),
    ("p4", 44, "The crew can be on site from the 8th if access is ready."),
    ("p3", 52, "Access is the thing I cannot promise until the survey is done."),
    ("p2", 60, "Then the survey is the first milestone."),
    ("p1", 67, "Who owns the access survey?"),
    ("p3", 72, "My facilities lead, but I need your checklist."),
    ("p4", 80, "I'll send the checklist today."),
    ("p2", 86, "Target the 12th for handover, with the survey complete by the 16th of October."),
    ("p3", 96, "The 16th is tight but possible."),
    ("p1", 103, "Let's write both dates down: survey by the 16th, handover on the 12th."),
    ("p2", 112, "Agreed."),
    ("p4", 116, "I need to know whether the loading bay is available on Saturdays."),
    ("p3", 124, "It normally is, but I will confirm."),
    ("p1", 131, "That could matter if the date moves."),
    ("p2", 137, "Let's not plan around a move yet."),
    ("p3", 143, "I'd rather plan around reality."),
    ("p2", 149, "Fair. The 12th is the earliest we can commit. Anything earlier is not honest."),
    ("p3", 159, "Then we commit to the 12th and protect it."),
    ("p4", 166, "And if the survey slips, we revisit immediately."),
    ("p2", 174, "Agreed. Survey slip is a trigger for a date review."),
    ("p1", 182, "Anything else before we close?"),
    ("p3", 187, "Training is still quoted separately. Keep it separate for now."),
    ("p2", 195, "Noted. Training separate."),
    ("p1", 201, "I'll circulate the plan and the trigger."),
    ("p3", 207, "Thank you. Bye."),
]
for speaker, start, text in kick_script:
    k.say(speaker, start, text, confidence=0.96)
kickoff_utterances = k.rows

kickoff_evidence = [
    evidence("ev_k01", "decision", "The 12th is the earliest we can commit. Anything earlier is not honest.", "p2", 149, confidence=0.95, attribution=0.97, utterance_id="u_1009_022"),
    evidence("ev_k02", "action", "Survey complete by the 16th of October.", "p3", 96, confidence=0.9, attribution=0.91, utterance_id="u_1009_015"),
    evidence("ev_k03", "question", "Is the loading bay available on Saturdays?", "p4", 116, confidence=0.93, attribution=0.95, utterance_id="u_1009_017"),
    evidence("ev_k04", "action", "I'll circulate the plan and the trigger.", "p1", 201, confidence=0.92, attribution=0.96, utterance_id="u_1009_029"),
]

meeting_kickoff = {
    "id": KICKOFF,
    "capture_id": "cap_01J8Z1P4T6R2M9K3L5N7Q0S",
    "title": "Kickoff call — Northgate fit-out",
    "mode": "call",
    "started_at": "2026-10-09T14:00:00Z",
    "ended_at": "2026-10-09T14:42:18Z",
    "duration_s": 2538,
    "language": "en",
    "jurisdiction": "DE",
    "sensitivity": "client_confidential",
    "status": "sent",
    "participants": [
        participant("p1", "Anna Voss", "Account lead", "amber"),
        participant("p2", "Marek Nowak", "Delivery lead", "cyan"),
        participant("p3", "Sandra Klein", "Client operations", "violet"),
        participant("p4", "Tomás Rivera", "Installation lead", "green"),
    ],
    "consent": consent(ref="consent_k01"),
    "summary": "Kickoff for the Northgate fit-out. Handover targeted for the 12th, access survey due 16 October, training kept separate. A survey slip triggers a date review.",
    "utterances": kickoff_utterances,
    "decisions": [
        {"id": "dec_k01", "text": "Target handover for the 12th with a survey review trigger.", "evidence_id": "ev_k01", "confidence": 0.93, "status": "accepted"},
        {"id": "dec_k02", "text": "Keep training as a separate visit.", "evidence_id": "ev_k03", "confidence": 0.84, "status": "accepted"},
    ],
    "actions": [
        {"id": "act_k01", "text": "Complete the access survey by 16 October.", "owner": "Sandra", "due": "2026-10-16", "evidence_id": "ev_k02", "confidence": 0.9, "status": "done"},
        {"id": "act_k02", "text": "Circulate the plan and the date-review trigger.", "owner": "Anna", "due": "2026-10-10", "evidence_id": "ev_k04", "confidence": 0.94, "status": "done"},
    ],
    "questions": [
        {"id": "q_k01", "text": "Is the loading bay available on Saturdays?", "evidence_id": "ev_k03", "confidence": 0.93, "status": "answered"},
    ],
    "evidence": kickoff_evidence,
    "redactions": [],
    "provenance": provenance(device="iPhone 16 Pro · A18", model="parakeet-tdt-0.6b-int8"),
    "retention": {"retain_until": "2027-10-09T00:00:00Z", "policy": "team_default", "legal_hold": False},
    "tags": ["northgate", "kickoff"],
    "baseline_lookup_min": 26,
    "ppma": {"status": "sent", "event_id": "evt_seed_kickoff", "completed_at": "2026-10-09T14:43:02Z"},
    "import": False,
}

# --------------------------------------------------------------------------- meeting 3
STANDUP = "mtg_standup_1023"
s = MeetingBuilder(STANDUP)
standup_script = [
    ("p2", 0, "Quick stand-up on Northgate. Recording so the crew has the same facts."),
    ("p4", 8, "Bracknell is on plan. We finish the 10th, mid-afternoon."),
    ("p2", 16, "That keeps both vans free for the 12th."),
    ("p4", 22, "One van is in for service on the 11th. It is back the same day."),
    ("p5", 31, "I have the crew rota. Four people on the 12th, three on the 14th."),
    ("p2", 40, "The client may move to the 14th. Hold the four-person rota until Friday."),
    ("p5", 50, "Holding costs us a small cancellation fee if it moves."),
    ("p2", 58, "That is cheaper than losing the slot."),
    ("p4", 65, "The 12th depends on the Bracknell job finishing on the 10th."),
    ("p2", 74, "And the access list is still outstanding."),
    ("p5", 80, "I need the list before I confirm the 14th."),
    ("p2", 87, "Sandra owns it. Due Tuesday the 27th."),
    ("p4", 94, "If it lands late, we lose the Saturday planning window."),
    ("p2", 102, "Escalate to me if it is not in by Tuesday noon."),
    ("p5", 111, "I'll put a reminder in the rota."),
    ("p4", 117, "Training is still separate, so we may need the extra van on the 17th."),
    ("p2", 126, "Confirm that with Marek by tomorrow."),
    ("p4", 132, "Will do."),
    ("p5", 136, "Anything else?"),
    ("p2", 140, "No. Keep the 14th warm and the 12th honest."),
]
for speaker, start, text in standup_script:
    s.say(speaker, start, text, confidence=0.94)
standup_utterances = s.rows

standup_evidence = [
    evidence("ev_s01", "decision", "Hold the four-person rota until Friday.", "p2", 40, confidence=0.9, attribution=0.94, utterance_id="u_1023_006"),
    evidence("ev_s02", "action", "Escalate the access list to Marek by Tuesday noon.", "p2", 102, confidence=0.92, attribution=0.95, utterance_id="u_1023_014"),
    evidence("ev_s03", "question", "Do we need the extra van on the 17th?", "p4", 117, confidence=0.88, attribution=0.93, utterance_id="u_1023_016"),
]

meeting_standup = {
    "id": STANDUP,
    "capture_id": "cap_01J9A2B3C4D5E6F7G8H9J0K",
    "title": "Install crew stand-up",
    "mode": "meeting",
    "started_at": "2026-10-23T07:30:00Z",
    "ended_at": "2026-10-23T07:48:02Z",
    "duration_s": 1082,
    "language": "en",
    "jurisdiction": "DE",
    "sensitivity": "personal",
    "status": "queued",
    "participants": [
        participant("p2", "Marek Nowak", "Delivery lead", "cyan"),
        participant("p4", "Tomás Rivera", "Installation lead", "green"),
        participant("p5", "Priya Shah", "Crew scheduler", "blue"),
    ],
    "consent": consent(ref="consent_s01"),
    "summary": "Crew and van status for Northgate. Bracknell finishes on the 10th; one van is in service on the 11th. The four-person rota is held until Friday. The access list remains the critical path.",
    "utterances": standup_utterances,
    "decisions": [
        {"id": "dec_s01", "text": "Hold the four-person rota until Friday.", "evidence_id": "ev_s01", "confidence": 0.9, "status": "accepted"},
    ],
    "actions": [
        {"id": "act_s01", "text": "Escalate the access list if it is not in by Tuesday noon.", "owner": "Marek", "due": "2026-10-27", "evidence_id": "ev_s02", "confidence": 0.92, "status": "open"},
        {"id": "act_s02", "text": "Confirm the extra van for 17 November.", "owner": "Tomás", "due": "2026-10-24", "evidence_id": "ev_s03", "confidence": 0.87, "status": "open"},
    ],
    "questions": [
        {"id": "q_s01", "text": "Do we need the extra van on the 17th?", "evidence_id": "ev_s03", "confidence": 0.88, "status": "open"},
    ],
    "evidence": standup_evidence,
    "redactions": [],
    "provenance": provenance(device="iPhone 16 Pro · A18"),
    "retention": {"retain_until": "2027-10-23T00:00:00Z", "policy": "team_default", "legal_hold": False},
    "tags": ["northgate", "crew"],
    "baseline_lookup_min": 26,
    "ppma": {"status": "queued", "event_id": "evt_seed_standup", "completed_at": None},
    "import": False,
}

# --------------------------------------------------------------------------- meeting 4 (PPMA asks to forget it)
PRICING = "mtg_pricing_1015"
p = MeetingBuilder(PRICING)
pricing_script = [
    ("p1", 0, "Internal pricing review for Northgate. Sensitive. No client on the call."),
    ("p2", 10, "The install margin is twelve percent at the current crew rate."),
    ("p1", 20, "If we absorb the Saturday overtime it drops to eight."),
    ("p2", 30, "Eight is still above the floor."),
    ("p1", 38, "Let's not put the margin in the client confirmation."),
    ("p2", 47, "Agreed. Operational note only."),
    ("p1", 55, "Okay, that's all. Keep this one internal."),
]
for speaker, start, text in pricing_script:
    p.say(speaker, start, text, confidence=0.93)
meeting_pricing = {
    "id": PRICING,
    "capture_id": "cap_01J9P1R2I3C4I5N6G7X8Y9Z",
    "title": "Internal pricing review — Northgate",
    "mode": "meeting",
    "started_at": "2026-10-15T16:00:00Z",
    "ended_at": "2026-10-15T16:08:12Z",
    "duration_s": 492,
    "language": "en",
    "jurisdiction": "DE",
    "sensitivity": "financial",
    "status": "sent",
    "participants": [
        participant("p1", "Anna Voss", "Account lead", "amber"),
        participant("p2", "Marek Nowak", "Delivery lead", "cyan"),
    ],
    "consent": consent(ref="consent_p01"),
    "summary": "Internal margin review. The install margin is 12% at the current crew rate and 8% if Saturday overtime is absorbed. Do not include margins in the client confirmation.",
    "utterances": p.rows,
    "decisions": [
        {"id": "dec_p01", "text": "Keep commercial margin out of the client confirmation.", "evidence_id": "ev_p01", "confidence": 0.91, "status": "accepted"},
    ],
    "actions": [],
    "questions": [],
    "evidence": [
        evidence("ev_p01", "decision", "Let's not put the margin in the client confirmation.", "p1", 38, confidence=0.93, attribution=0.96, utterance_id="u_1015_005"),
        evidence("ev_p02", "note", "The install margin is twelve percent at the current crew rate.", "p2", 10, confidence=0.94, attribution=0.95, utterance_id="u_1015_002", sensitivity="financial"),
    ],
    "redactions": [],
    "provenance": provenance(),
    "retention": {"retain_until": "2026-11-15T00:00:00Z", "policy": "internal_30d", "legal_hold": False},
    "tags": ["northgate", "internal", "financial"],
    "baseline_lookup_min": 26,
    "ppma": {"status": "sent", "event_id": "evt_seed_pricing", "completed_at": "2026-10-15T16:09:00Z"},
    "import": False,
}

# --------------------------------------------------------------------------- field note
notes = [
    {
        "id": "note_01",
        "note_id": "note_01J9N0R7H6G5A4T3E2",
        "title": "Northgate site walk — loading bay",
        "text": "Client mentioned the 14th is tight because of the install crew. They can open the bay at seven if we confirm by Friday. Lift limit is 900 kg — our racks are 780. Two van permits needed on Saturday.",
        "captured_at": "2026-10-28T15:42:00Z",
        "location": {"label": "Northgate — Building C", "precision": "site", "lat": 51.5045, "lon": -0.0912},
        "evidence_ref": "ev_n01",
        "consent": {"state": "granted", "basis": "user_note", "jurisdiction": "GB", "participants_notified": False, "evidence_ref": "consent_n01", "wording_version": "GB-2026-1", "recorded_at": "2026-10-28T15:40:00Z", "recorded_by": "user_tomas"},
        "sensitivity": "client_confidential",
        "photo": {"label": "Bay door and height marker", "ocr": "LOADING BAY 07:00–10:00\nMAX HEIGHT 2.4 m\nLIFT 900 kg", "ocr_confidence": 0.97, "captured_on_device": True},
        "offline_captured": True,
        "queued_seconds": 0,
        "ppma": {"status": "sent", "event_id": "evt_seed_note", "completed_at": "2026-10-28T15:42:11Z"},
        "tags": ["northgate", "site-walk", "field"],
    }
]

# --------------------------------------------------------------------------- PPMA contract
manifest = {
    "app_id": "capture",
    "display_name": "RECALL",
    "version": "1.8.0",
    "contract": "PPMA North Contract v0",
    "direction": "events out; limited commands in",
    "event_prefix": "capture.*",
    "default_sensitivity": "personal",
    "last_validated": "2026-10-30T08:00:00Z",
    "resources": "text + signed evidence pointers by default; encrypted media only on explicit opt-in",
    "auth": "per-device app token, owner-scoped; rotate on uninstall",
    "events": [
        {"type": "capture.recording.started", "sensitivity": "personal", "resource": "none", "description": "Metadata only. No transcript, no audio."},
        {"type": "capture.meeting.completed", "sensitivity": "personal", "resource": "evidence pointers", "description": "The main event: decisions, actions, questions, evidence, consent, redactions and provenance."},
        {"type": "capture.call.completed", "sensitivity": "personal", "resource": "evidence pointers", "description": "Same shape as a meeting with mode=call; phone hashes only."},
        {"type": "capture.note.created", "sensitivity": "personal", "resource": "evidence pointer", "description": "A field note, photo note or observation."},
        {"type": "capture.correction", "sensitivity": "personal", "resource": "none", "description": "A human corrected a speaker, quote or extracted item."},
        {"type": "capture.redaction.applied", "sensitivity": "personal", "resource": "safe text", "description": "A passage was redacted before sharing."},
        {"type": "capture.memory.deleted", "sensitivity": "personal", "resource": "none", "description": "A tombstone. Deletion is not a silent drop."},
        {"type": "capture.consent.changed", "sensitivity": "personal", "resource": "none", "description": "Consent was withdrawn or changed."},
    ],
    "commands": [
        {"type": "capture.forget", "direction": "in", "description": "PPMA asks RECALL to delete a memory after a forget correction or retention decision."},
        {"type": "capture.apply_retention", "direction": "in", "description": "PPMA passes a retention policy for a capture."},
    ],
    "deprecation": {"window": "two minor versions", "migration": "add fields, never silently change payload semantics; keep the capture.* prefix stable"},
}

seed_events = [
    {
        "event_id": "evt_seed_kickoff",
        "app_id": "capture",
        "space": "ppma://spaces/northgate",
        "occurred_at": "2026-10-09T14:43:02Z",
        "type": "capture.meeting.completed",
        "sensitivity": "client_confidential",
        "payload": {
            "capture_id": meeting_kickoff["capture_id"],
            "title": meeting_kickoff["title"],
            "started_at": meeting_kickoff["started_at"],
            "ended_at": meeting_kickoff["ended_at"],
            "language": "en",
            "participants": meeting_kickoff["participants"],
            "summary": meeting_kickoff["summary"],
            "decisions": meeting_kickoff["decisions"],
            "action_items": meeting_kickoff["actions"],
            "open_questions": [q["text"] for q in meeting_kickoff["questions"]],
            "consent": meeting_kickoff["consent"],
            "redactions": [],
            "evidence": meeting_kickoff["evidence"],
            "provenance": meeting_kickoff["provenance"],
        },
        "provenance": {"device": "iPhone 16 Pro · A18", "model": "parakeet-tdt-0.6b-int8", "app_version": "1.8.0", "local_only": True},
        "delivery": {"status": "delivered", "attempts": 1, "delivered_at": "2026-10-09T14:43:09Z", "duplicate": False, "latency_ms": 7000},
    },
    {
        "event_id": "evt_seed_note",
        "app_id": "capture",
        "space": "ppma://spaces/northgate",
        "occurred_at": "2026-10-28T15:42:11Z",
        "type": "capture.note.created",
        "sensitivity": "client_confidential",
        "payload": {
            "note_id": notes[0]["note_id"],
            "text": notes[0]["text"],
            "captured_at": notes[0]["captured_at"],
            "location": notes[0]["location"],
            "evidence_ref": "ev_n01",
            "consent": notes[0]["consent"],
        },
        "provenance": {"device": "iPhone 16 Pro · A18", "model": "ocr-small-v3", "app_version": "1.8.0", "local_only": True},
        "delivery": {"status": "delivered", "attempts": 1, "delivered_at": "2026-10-28T15:42:18Z", "duplicate": False, "latency_ms": 7000},
    },
    {
        "event_id": "evt_seed_standup",
        "app_id": "capture",
        "space": "ppma://spaces/northgate",
        "occurred_at": "2026-10-23T07:48:20Z",
        "type": "capture.meeting.completed",
        "sensitivity": "personal",
        "payload": {
            "capture_id": meeting_standup["capture_id"],
            "title": meeting_standup["title"],
            "started_at": meeting_standup["started_at"],
            "ended_at": meeting_standup["ended_at"],
            "language": "en",
            "participants": meeting_standup["participants"],
            "summary": meeting_standup["summary"],
            "decisions": meeting_standup["decisions"],
            "action_items": meeting_standup["actions"],
            "open_questions": [q["text"] for q in meeting_standup["questions"]],
            "consent": meeting_standup["consent"],
            "redactions": [],
            "evidence": meeting_standup["evidence"],
            "provenance": meeting_standup["provenance"],
        },
        "provenance": {"device": "iPhone 16 Pro · A18", "model": "parakeet-tdt-0.6b-int8", "app_version": "1.8.0", "local_only": True},
        "delivery": {"status": "queued", "attempts": 0, "delivered_at": None, "duplicate": False, "latency_ms": None},
    },
    {
        "event_id": "evt_seed_pricing",
        "app_id": "capture",
        "space": "ppma://spaces/northgate",
        "occurred_at": "2026-10-15T16:09:00Z",
        "type": "capture.meeting.completed",
        "sensitivity": "financial",
        "payload": {
            "capture_id": meeting_pricing["capture_id"],
            "title": meeting_pricing["title"],
            "started_at": meeting_pricing["started_at"],
            "ended_at": meeting_pricing["ended_at"],
            "language": "en",
            "participants": meeting_pricing["participants"],
            "summary": meeting_pricing["summary"],
            "decisions": meeting_pricing["decisions"],
            "action_items": [],
            "open_questions": [],
            "consent": meeting_pricing["consent"],
            "redactions": [],
            "evidence": meeting_pricing["evidence"],
            "provenance": meeting_pricing["provenance"],
        },
        "provenance": {"device": "MacBook Pro 14 · M4", "model": "parakeet-tdt-0.6b-int8", "app_version": "1.8.0", "local_only": True},
        "delivery": {"status": "delivered", "attempts": 1, "delivered_at": "2026-10-15T16:09:08Z", "duplicate": False, "latency_ms": 8000},
    },
    {
        "event_id": "evt_seed_pricing_retention",
        "app_id": "capture",
        "space": "ppma://spaces/northgate",
        "occurred_at": "2026-10-29T09:02:00Z",
        "type": "capture.consent.changed",
        "sensitivity": "financial",
        "payload": {
            "capture_id": meeting_pricing["capture_id"],
            "state": "granted",
            "reason": "retention_review",
            "effective_at": "2026-10-29T09:02:00Z",
        },
        "provenance": {"device": "MacBook Pro 14 · M4", "model": "consent-service", "app_version": "1.8.0", "local_only": True},
        "delivery": {"status": "delivered", "attempts": 1, "delivered_at": "2026-10-29T09:02:01Z", "duplicate": False, "latency_ms": 1000},
    },
]

memory = [
    {
        "id": "mem_01",
        "capture_id": meeting_kickoff["capture_id"],
        "meeting_id": KICKOFF,
        "type": "decision",
        "text": "Handover targeted for the 12th, with an access-survey review trigger.",
        "speaker_id": "p2",
        "evidence_id": "ev_k01",
        "confidence": 0.93,
        "sensitivity": "client_confidential",
        "consent": "granted",
        "redacted": False,
        "source": "RECALL",
        "created_at": "2026-10-09T14:43:09Z",
        "state": "active",
    },
    {
        "id": "mem_02",
        "capture_id": meeting_kickoff["capture_id"],
        "meeting_id": KICKOFF,
        "type": "action",
        "text": "Access survey by 16 October — owner Sandra Klein.",
        "speaker_id": "p3",
        "evidence_id": "ev_k02",
        "confidence": 0.9,
        "sensitivity": "client_confidential",
        "consent": "granted",
        "redacted": False,
        "source": "RECALL",
        "created_at": "2026-10-09T14:43:09Z",
        "state": "active",
    },
    {
        "id": "mem_03",
        "capture_id": meeting_kickoff["capture_id"],
        "meeting_id": KICKOFF,
        "type": "question",
        "text": "Is the loading bay available on Saturdays?",
        "speaker_id": "p4",
        "evidence_id": "ev_k03",
        "confidence": 0.93,
        "sensitivity": "client_confidential",
        "consent": "granted",
        "redacted": False,
        "source": "RECALL",
        "created_at": "2026-10-09T14:43:09Z",
        "state": "active",
    },
    {
        "id": "mem_04",
        "capture_id": meeting_standup["capture_id"],
        "meeting_id": STANDUP,
        "type": "decision",
        "text": "Hold the four-person rota until Friday.",
        "speaker_id": "p2",
        "evidence_id": "ev_s01",
        "confidence": 0.9,
        "sensitivity": "personal",
        "consent": "granted",
        "redacted": False,
        "source": "RECALL",
        "created_at": "2026-10-23T07:48:20Z",
        "state": "active",
    },
    {
        "id": "mem_05",
        "capture_id": notes[0]["note_id"],
        "meeting_id": notes[0]["id"],
        "type": "note",
        "text": "Loading bay opens at 07:00 if confirmed by Friday. Lift limit 900 kg; two Saturday van permits needed.",
        "speaker_id": None,
        "evidence_id": "ev_n01",
        "confidence": 0.97,
        "sensitivity": "client_confidential",
        "consent": "granted",
        "redacted": False,
        "source": "RECALL",
        "created_at": "2026-10-28T15:42:18Z",
        "state": "active",
    },
]

ppma_pack = {
    "manifest": manifest,
    "project": {
        "id": "prj_northgate",
        "name": "Northgate fit-out",
        "space": "ppma://spaces/northgate",
        "owner": "Anna Voss",
        "state_before": "Handover targeted for 12 November. Access survey complete. Training quoted separately.",
        "state_after": "Handover moved to 14 November. The 12th is not achievable. Written confirmation due today before 17:00. Training date to follow.",
        "followup_draft": "Hi Sandra — confirming installation moves to Saturday 14 November, building access from 07:00. Training remains a separate visit; I will confirm the date and commercial terms tomorrow. Two van permits are included.",
        "link": "ppma://spaces/northgate/projects/prj_northgate",
        "proposed_action": "Send the written confirmation and set a follow-up for the training date.",
        "approval_required": True,
        "updated_at": "2026-10-30T09:00:00Z",
    },
    "memory": memory,
    "events": seed_events,
    "queue": [],
    "commands": [
        {
            "id": "cmd_01",
            "kind": "command",
            "target": "capture",
            "type": "capture.apply_retention",
            "received_at": "2026-10-29T09:05:00Z",
            "payload": {
                "capture_id": meeting_pricing["capture_id"],
                "retain_until": "2026-11-15T00:00:00Z",
                "reason": "team_policy",
            },
            "status": "pending",
            "note": "PPMA applied the stricter internal 30-day policy to the pricing review.",
        },
        {
            "id": "cmd_02",
            "kind": "command",
            "target": "capture",
            "type": "capture.forget",
            "received_at": "2026-10-30T08:12:00Z",
            "payload": {
                "capture_id": meeting_pricing["capture_id"],
                "scope": "all",
                "reason": "user_forget",
                "requested_by": "user_anna",
            },
            "status": "pending",
            "note": "Anna asked PPMA to forget the internal pricing review. RECALL must delete locally and confirm with a tombstone.",
        },
    ],
    "limits": {"per_team_per_minute": 60, "per_team_per_day": 20000, "used_today": 412, "backpressure": "pause non-critical events, keep consent + deletion", "dead_letter_after": 5},
    "credentials": [
        {"team": "Northgate project team", "device": "MacBook Pro 14 · M4", "token_hint": "rc_live_••••7f2a", "created": "2026-09-12", "rotated": "2026-10-12", "status": "active"},
        {"team": "Northgate project team", "device": "iPhone 16 Pro · A18", "token_hint": "rc_live_••••b91c", "created": "2026-09-12", "rotated": "2026-10-12", "status": "active"},
        {"team": "Field team · pilot", "device": "iPad Air · M2", "token_hint": "rc_field_••••0d4e", "created": "2026-10-01", "rotated": "2026-10-01", "status": "active"},
    ],
    "conformance": [
        {"id": "c01", "label": "Manifest publishes every capture.* event with a sensitivity label", "status": "pass", "detail": "8 event types, 2 commands, versioned"},
        {"id": "c02", "label": "No event without a recorded consent state", "status": "pass", "detail": "emitter blocks captures whose consent is missing or withdrawn"},
        {"id": "c03", "label": "Event ids are stable and PPMA deduplicates", "status": "pass", "detail": "replay of evt_seed_kickoff is rejected as a duplicate"},
        {"id": "c04", "label": "Corrections are new events, never silent mutations", "status": "pass", "detail": "capture.correction carries before/after and the human actor"},
        {"id": "c05", "label": "Deletion is a tombstone and survives replay", "status": "pass", "detail": "tombstones are kept after the transcript is removed"},
        {"id": "c06", "label": "Raw media is not attached by default", "status": "pass", "detail": "payload carries evidence pointers and a local-only provenance block"},
        {"id": "c07", "label": "Offline queue preserves order and retries with backoff", "status": "pass", "detail": "queued events keep occurred_at and attempts"},
        {"id": "c08", "label": "Manifest versioning and deprecation window", "status": "pass", "detail": "additive changes only; two-minor-version window"},
    ],
}

pilot = {
    "baseline_min": 26,
    "quote_seconds": 18,
    "target_quote_seconds": 10,
    "capture_to_ppma_s": 14,
    "target_capture_to_ppma_s": 30,
    "useful_rate": 0.84,
    "quote_success": 0.96,
    "consent_coverage": 1.0,
    "redaction_precision": 0.94,
    "redaction_recall": 0.91,
    "deletion_propagation_syncs": 1,
    "action_conversion": 0.61,
    "weekly": [
        {"week": "W40", "capture_to_ppma_s": 28, "useful_rate": 0.64, "quotes": 12, "actions": 3, "deletions": 1},
        {"week": "W41", "capture_to_ppma_s": 24, "useful_rate": 0.69, "quotes": 18, "actions": 5, "deletions": 1},
        {"week": "W42", "capture_to_ppma_s": 21, "useful_rate": 0.74, "quotes": 24, "actions": 7, "deletions": 2},
        {"week": "W43", "capture_to_ppma_s": 18, "useful_rate": 0.79, "quotes": 31, "actions": 9, "deletions": 2},
        {"week": "W44", "capture_to_ppma_s": 14, "useful_rate": 0.84, "quotes": 39, "actions": 12, "deletions": 3},
    ],
    "funnel": [
        {"stage": "Captures", "count": 124},
        {"stage": "Quotes retrieved", "count": 119},
        {"stage": "Memories accepted", "count": 96},
        {"stage": "Follow-ups created", "count": 59},
        {"stage": "Follow-ups done", "count": 41},
    ],
    "extraction": [
        {"kind": "decisions", "precision": 0.93, "recall": 0.88, "useful": 0.86},
        {"kind": "promises", "precision": 0.95, "recall": 0.9, "useful": 0.91},
        {"kind": "actions", "precision": 0.9, "recall": 0.85, "useful": 0.83},
        {"kind": "questions", "precision": 0.87, "recall": 0.8, "useful": 0.76},
    ],
    "gates": [
        {"id": "g1", "label": "Capture-to-PPMA latency under 30 seconds", "target": "< 30 s", "actual": "14 s", "status": "pass"},
        {"id": "g2", "label": "At least 80% of emitted items judged useful", "target": "≥ 80%", "actual": "84%", "status": "pass"},
        {"id": "g3", "label": "Zero raw media uploaded by default", "target": "0", "actual": "0", "status": "pass"},
        {"id": "g4", "label": "Every quote reconstructable in under 10 seconds", "target": "< 10 s", "actual": "18 s (pilot), target 10 s", "status": "watch"},
        {"id": "g5", "label": "Deletion and correction propagate in one sync", "target": "1", "actual": "1", "status": "pass"},
        {"id": "g6", "label": "100% of captured meetings have a consent state", "target": "100%", "actual": "100%", "status": "pass"},
    ],
    "notes": [
        "One team, one repeated cadence: the Northgate delivery call. No synthetic records enter the pilot metric after week one.",
        "The quote retrieval target is 10 s; the pilot is at 18 s. Search ranking is the next fix, not a new feature.",
        "All latency numbers are measured capture-stop to PPMA acknowledgment on the local loopback.",
    ],
}

team = {
    "id": "team_northgate",
    "name": "Northgate project team",
    "space": "ppma://spaces/northgate",
    "plan": "PPMA bundle",
    "seats": 12,
    "jurisdiction": "DE",
    "retention_days": 365,
    "consent_model": "all_participants_notified",
    "members": [
        {"id": "user_anna", "name": "Anna Voss", "role": "team_lead", "initials": "AV", "email": "anna@example.com"},
        {"id": "user_marek", "name": "Marek Nowak", "role": "team_member", "initials": "MN", "email": "marek@example.com"},
        {"id": "user_sandra", "name": "Sandra Klein", "role": "client_guest", "initials": "SK", "email": "sandra@client.example"},
        {"id": "user_tomas", "name": "Tomás Rivera", "role": "field", "initials": "TR", "email": "tomas@example.com"},
        {"id": "user_lena", "name": "Lena Hoffmann", "role": "privacy_legal", "initials": "LH", "email": "lena@example.com"},
        {"id": "user_admin", "name": "M. Okafor", "role": "admin", "initials": "MO", "email": "admin@example.com"},
    ],
    "devices": [
        {"id": "dev_mac_01", "name": "MacBook Pro 14 · M4", "kind": "laptop", "owner": "Anna Voss", "status": "active", "last_seen": "2026-10-30T08:58:00Z", "app_version": "1.8.0", "npu": "Apple Neural Engine", "storage_used_pct": 38, "battery_pct": 72, "mic": "ok"},
        {"id": "dev_iphone_01", "name": "iPhone 16 Pro · A18", "kind": "phone", "owner": "Tomás Rivera", "status": "active", "last_seen": "2026-10-30T08:41:00Z", "app_version": "1.8.0", "npu": "Apple Neural Engine", "storage_used_pct": 61, "battery_pct": 54, "mic": "ok"},
        {"id": "dev_ipad_01", "name": "iPad Air · M2", "kind": "tablet", "owner": "Field team", "status": "field", "last_seen": "2026-10-28T15:42:00Z", "app_version": "1.8.0", "npu": "Apple Neural Engine", "storage_used_pct": 22, "battery_pct": 83, "mic": "ok"},
        {"id": "dev_pixel_01", "name": "Pixel 9 · Tensor G4", "kind": "phone", "owner": "Pilot spare", "status": "revoked", "last_seen": "2026-09-30T12:00:00Z", "app_version": "0.8.4", "npu": "Google TPU", "storage_used_pct": 9, "battery_pct": None, "mic": "unknown"},
    ],
}

admin = {
    "spaces": [
        {"id": "sp_northgate", "name": "Northgate fit-out", "members": 12, "role": "team_lead", "visibility": "project", "retention": "365 days", "status": "active"},
        {"id": "sp_field", "name": "Field operations · pilot", "members": 5, "role": "field", "visibility": "invite-only", "retention": "90 days", "status": "active"},
        {"id": "sp_legal", "name": "Legal hold · Q4", "members": 3, "role": "privacy_legal", "visibility": "restricted", "retention": "until released", "status": "hold"},
    ],
    "roles": [
        {"role": "individual", "can": "capture, recall, redact, share own evidence", "cannot": "team settings, retention, billing"},
        {"role": "team_lead", "can": "team spaces, meeting visibility, retention defaults", "cannot": "legal hold, SSO, billing"},
        {"role": "privacy_legal", "can": "consent templates, audit, legal hold, deletion review", "cannot": "capture content without a hold reason"},
        {"role": "field", "can": "offline capture, photo notes, sync when connected", "cannot": "team settings, other teams' meetings"},
        {"role": "admin", "can": "SSO, devices, billing, residency, kill switch", "cannot": "read transcript content"},
    ],
    "sso": {"provider": "OIDC · Entra ID", "status": "configured", "enforcement": "required", "scim": "enabled", "groups": ["recall-team-northgate", "recall-legal"]},
    "residency": {"primary": "eu-central-1 · Frankfurt", "backup": "eu-west-1 · Dublin", "media": "on device only", "note": "Derived text may reside in the PPMA region; raw media never leaves the device."},
    "compliance": [
        {"id": "cmp_01", "name": "GDPR record of processing", "standard": "GDPR Art. 30", "status": "ready", "controls": 14, "covered": 14, "detail": "Consent basis, retention, deletion tombstones and processor map."},
        {"id": "cmp_02", "name": "Two-party consent · DE", "standard": "§ 201 StGB", "status": "ready", "controls": 6, "covered": 6, "detail": "Wording version DE-2026-2, recorded before capture."},
        {"id": "cmp_03", "name": "Two-party consent · US-CA", "standard": "Cal. Penal Code 632", "status": "ready", "controls": 5, "covered": 5, "detail": "All-party notification template and retention note."},
        {"id": "cmp_04", "name": "Health data minimisation", "standard": "HIPAA-style", "status": "in_progress", "controls": 11, "covered": 8, "detail": "Redaction classifier needs a clinical false-negative review."},
        {"id": "cmp_05", "name": "Legal hold and eDiscovery", "standard": "Internal / pilot", "status": "ready", "controls": 7, "covered": 7, "detail": "Hold overrides deletion; both sides show the hold."},
    ],
    "jurisdictions": [
        {"code": "DE", "name": "Germany", "model": "all-party notification", "wording": "DE-2026-2", "status": "active"},
        {"code": "GB", "name": "United Kingdom", "model": "one-party + notice", "wording": "GB-2026-1", "status": "active"},
        {"code": "US-CA", "name": "California", "model": "all-party consent", "wording": "USCA-2026-1", "status": "active"},
        {"code": "FR", "name": "France", "model": "all-party notification", "wording": "FR-2026-1", "status": "draft"},
    ],
    "billing": {
        "plan": "PPMA bundle · per seat",
        "seats": 12,
        "per_seat_eur_month": 18,
        "bundle_discount_pct": 15,
        "enterprise_addon_eur_month": 240,
        "field_addon_eur_month": 90,
        "npu_included": True,
        "mrr_eur": 513.6,
        "next_invoice": "2026-11-01",
        "invoices": [
            {"id": "INV-2026-10", "date": "2026-10-01", "amount_eur": 513.6, "status": "paid"},
            {"id": "INV-2026-09", "date": "2026-09-01", "amount_eur": 513.6, "status": "paid"},
            {"id": "INV-2026-08", "date": "2026-08-01", "amount_eur": 486.0, "status": "paid"},
        ],
        "metering": "No per-meeting charge. Capture is never metered.",
    },
    "model_cards": [
        {"id": "mdl_asr", "name": "Parakeet TDT 0.6B", "version": "int8 · 0.9.0", "kind": "ASR", "inputs": "16 kHz mono audio, on device", "limits": "English-first; accented speech degrades below 0.8 confidence", "failure_modes": "overlapping speech, far-field, technical jargon", "owner": "Speech team", "last_validated": "2026-10-21", "status": "champion", "metric": "WER 6.8% (pilot set)"},
        {"id": "mdl_diar", "name": "pyannote 3.1 mini", "version": "int8 · 0.9.0", "kind": "Diarization", "inputs": "VAD segments, on device", "limits": "similar voices can swap; always correctable", "failure_modes": "crosstalk, remote audio, new speakers", "owner": "Speech team", "last_validated": "2026-10-21", "status": "champion", "metric": "DER 11.2% (pilot set)"},
        {"id": "mdl_vad", "name": "Silero VAD 5", "version": "int8 · 0.9.0", "kind": "VAD", "inputs": "audio frames", "limits": "low-energy speech can be trimmed", "failure_modes": "HVAC noise, very quiet speakers", "owner": "Speech team", "last_validated": "2026-10-20", "status": "champion", "metric": "0.4% missed speech"},
        {"id": "mdl_ocr", "name": "OCR small v3", "version": "1.8.0", "kind": "OCR", "inputs": "camera frame, on device", "limits": "handwriting and glare", "failure_modes": "rotated signage, low light", "owner": "Vision team", "last_validated": "2026-10-18", "status": "champion", "metric": "0.97 CER on field set"},
        {"id": "mdl_redact", "name": "Redact classifier 0.4", "version": "int8 · 0.4", "kind": "Redaction", "inputs": "transcript spans", "limits": "sarcasm and implied secrets; human review required", "failure_modes": "false negative on oblique references", "owner": "Trust team", "last_validated": "2026-10-22", "status": "champion", "metric": "P 0.94 / R 0.91"},
        {"id": "mdl_extract", "name": "Fact extractor 0.7", "version": "0.7.2", "kind": "Extraction", "inputs": "transcript + speakers", "limits": "decisions phrased as questions", "failure_modes": "multi-party hedged commitments", "owner": "Memory team", "last_validated": "2026-10-25", "status": "challenger", "metric": "P 0.90 / R 0.85"},
    ],
    "health": {
        "status": "healthy",
        "last_scan": "2026-10-30T08:55:00Z",
        "metrics": {
            "wer": 0.068,
            "diarization_der": 0.112,
            "extraction_precision": 0.9,
            "extraction_recall": 0.85,
            "redaction_precision": 0.94,
            "redaction_recall": 0.91,
            "consent_coverage": 1.0,
            "queue_depth": 1,
            "dead_letter": 0,
            "duplicate_rate": 0.004,
            "deletion_lag_h": 0.2,
            "retention_expired": 0,
            "mic_clipping": 0,
        },
        "drift": [
            {"model": "Diarization", "status": "watch", "delta": "+1.4 pp DER", "detail": "New remote speaker on two calls; review speaker map."},
            {"model": "ASR", "status": "ok", "delta": "-0.2 pp WER", "detail": "Within the calibration band."},
            {"model": "Redaction", "status": "ok", "delta": "+0.1 pp recall", "detail": "No false-redaction review pending."},
        ],
        "incidents": [
            {"id": "inc_01", "at": "2026-10-22T11:00:00Z", "kind": "drift", "severity": "info", "title": "Diarization drift on remote audio", "status": "watching", "detail": "Speaker swap on one call caught by the human. Correction fed back to the threshold review."},
        ],
        "kill_switch": False,
    },
    "audit": [
        {"id": "aud_01", "at": "2026-10-30T08:59:12Z", "actor": "Anna Voss", "action": "consent.recorded", "object": "cap_01J9Q4M2R7X8K3N5V6B1C0D", "detail": "DE-2026-2 · all participants notified", "model": "consent-service", "sources": ["device:dev_mac_01"]},
        {"id": "aud_02", "at": "2026-10-30T09:13:42Z", "actor": "Anna Voss", "action": "capture.completed", "object": "cap_01J9Q4M2R7X8K3N5V6B1C0D", "detail": "13:42 · 4 speakers · local only", "model": "parakeet-tdt-0.6b-int8", "sources": ["device:dev_mac_01"]},
        {"id": "aud_03", "at": "2026-10-28T15:42:11Z", "actor": "Tomás Rivera", "action": "note.shared", "object": "note_01J9N0R7H6G5A4T3E2", "detail": "Field note + OCR · queued 0 s · delivered", "model": "ocr-small-v3", "sources": ["device:dev_ipad_01"]},
        {"id": "aud_04", "at": "2026-10-27T10:22:00Z", "actor": "Lena Hoffmann", "action": "legal_hold.applied", "object": "sp_legal", "detail": "Q4 legal hold · deletion blocked", "model": "policy-engine", "sources": ["admin"]},
        {"id": "aud_05", "at": "2026-10-25T16:04:00Z", "actor": "Marek Nowak", "action": "correction.applied", "object": "ev_s01", "detail": "speaker corrected · Priya → Marek", "model": "human", "sources": ["device:dev_iphone_01"]},
    ],
}

link_evidence(delivery_evidence, delivery_utterances)
link_evidence(kickoff_evidence, kickoff_utterances)
link_evidence(standup_evidence, standup_utterances)
link_evidence(meeting_pricing["evidence"], p.rows)
delivery_redactions[0]["utterance_id"] = next(
    item["utterance_id"] for item in delivery_evidence if item["id"] == "ev_05"
)

pack = {
    "meta": {
        "version": "1.8.0",
        "generated": "2026-10-30T08:00:00Z",
        "anchor": ANCHOR,
        "seed": SEED,
        "product": "RECALL",
        "app_id": "capture",
        "model": "deterministic synthetic pack · no customer data",
        "note": "Every transcript, speaker and event in this pack is synthetic and generated in-house. Audio is not included; the player is a visualisation of the local transcript timeline.",
        "stage_meeting_id": DELIVERY,
        "scenario_ids": [DELIVERY, KICKOFF, STANDUP, PRICING],
    },
    "team": team,
    "meetings": [meeting_delivery, meeting_kickoff, meeting_standup, meeting_pricing],
    "notes": notes,
    "ppma": ppma_pack,
    "pilot": pilot,
    "admin": admin,
}


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(pack, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    size = OUT.stat().st_size
    print(f"wrote {OUT.relative_to(ROOT)} ({size / 1024:.1f} KiB)")
    print(f"meetings: {len(pack['meetings'])} · notes: {len(pack['notes'])} · events: {len(pack['ppma']['events'])}")
    print(f"delivery utterances: {len(delivery_utterances)} · evidence: {len(delivery_evidence)}")


if __name__ == "__main__":
    main()

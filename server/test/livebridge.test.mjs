import assert from "node:assert/strict";
import { test } from "node:test";
import { toNorthMessage, ulidFor } from "../src/ppmaLive.mjs";

const event = {
  event_id: "evt_live_123",
  occurred_at: "2026-10-30T10:33:00.000Z",
  type: "capture.meeting.completed",
  device: "recall-web",
  payload: { capture_id: "cap_1", decisions: [{ id: "d1", text: "Ship it." }] },
};

test("ulidFor returns a valid, deterministic 26-character ULID", () => {
  const first = ulidFor(event.event_id, event.occurred_at);
  const second = ulidFor(event.event_id, event.occurred_at);
  assert.equal(first, second);
  assert.match(first, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.notEqual(first, ulidFor("evt_live_124", event.occurred_at));
});

test("toNorthMessage maps a RECALL event to the north envelope", () => {
  const message = toNorthMessage(event, "me", "capture", "1.4.0");
  assert.equal(message.kind, "event");
  assert.equal(message.type, "capture.meeting.completed");
  assert.equal(message.space, "me");
  assert.equal(message.source.app, "capture");
  assert.equal(message.source.app_version, "1.4.0");
  assert.equal(message.source.device, "recall-web");
  assert.equal(message.id, ulidFor(event.event_id, event.occurred_at));
  assert.deepEqual(message.payload, event.payload);
  assert.equal(message.occurred_at, event.occurred_at);
});

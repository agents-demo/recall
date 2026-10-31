import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  approveRecord,
  createDecisionRecord,
  markExecuted,
  undoRecord,
  verifyRecord,
  type DecisionRecord,
} from "../src/index.ts";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/replay.json", import.meta.url), "utf8"));

describe("laix-decision-record replay", () => {
  it("create -> approve -> execute -> undo", () => {
    let record: DecisionRecord = createDecisionRecord(fixture.create.input, {
      now: fixture.create.now,
      id: fixture.create.id,
    });
    for (const step of fixture.steps) {
      if (step.action === "create") {
        // already created above
      } else if (step.action === "approve") {
        record = approveRecord(record, { by: step.by, at: step.at });
      } else if (step.action === "execute") {
        record = markExecuted(record, { by: step.by, at: step.at });
      } else if (step.action === "undo") {
        record = undoRecord(record, { by: step.by, at: step.at, reason: step.reason });
      }
      assert.equal(record.status, step.expectedStatus);
      assert.equal(verifyRecord(record), true);
    }
    assert.equal(record.evidence.length, 1);
    assert.equal(record.metadata.meetingId, "mtg_replay_1");
    assert.ok(record.audit.some((event) => event.action === "undone"));
  });
});

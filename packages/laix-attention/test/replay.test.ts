import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decide } from "../src/index.ts";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/replay.json", import.meta.url), "utf8"));

describe("laix-attention replay", () => {
  for (const testCase of fixture.cases) {
    it(testCase.id, () => {
      const decisions = decide(
        {
          ...testCase.context,
          quietHours: testCase.context.quietHours ?? null,
        },
        testCase.candidates,
      );
      const byId = new Map(decisions.map((decision) => [decision.candidateId, decision]));
      for (const expected of testCase.expected) {
        const actual = byId.get(expected.candidateId);
        assert.ok(actual, `missing ${expected.candidateId}`);
        assert.equal(actual.action, expected.action);
        assert.equal(actual.score, expected.score);
        assert.equal(actual.action !== "wait", expected.deliver);
        assert.equal(actual.reason, expected.reason);
      }
    });
  }
});

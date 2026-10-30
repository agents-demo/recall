import { describe, expect, it } from "vitest";
import packJson from "../../public/demo-pack.json";
import type { ConversationTurn, Pack } from "../types";
import { converse } from "./conversation";
import { answerQuestion } from "./engine";

const pack = packJson as unknown as Pack;
const meetings = pack.meetings;

function assistantTurn(text: string, query: string): ConversationTurn {
  return { id: "a", role: "assistant", text, answer: answerQuestion(pack, meetings, query), at: "2026-10-30T09:00:00Z" };
}

describe("threaded recall", () => {
  it("answers a first question from evidence", () => {
    const answer = converse(pack, meetings, pack.notes, [], "what did we promise about the 14th?");
    expect(answer.refused).toBe(false);
    expect(answer.citations.length).toBeGreaterThan(0);
  });

  it("resolves 'who said that' against the previous answer", () => {
    const previous = assistantTurn("The commitment is the 14th.", "what did we promise about the 14th?");
    const turns: ConversationTurn[] = [{ id: "u", role: "user", text: "what did we promise about the 14th?", at: "x" }, previous];
    const answer = converse(pack, meetings, pack.notes, turns, "who said that?");
    expect(answer.refused).toBe(false);
    expect(answer.answer).toMatch(/said:/);
    expect(answer.citations[0].evidence_id).toBe(previous.answer!.citations[0].evidence_id);
  });

  it("prepares an action for review instead of executing it", () => {
    const previous = assistantTurn("The commitment is the 14th.", "what did we promise about the 14th?");
    const turns: ConversationTurn[] = [{ id: "u", role: "user", text: "what did we promise about the 14th?", at: "x" }, previous];
    const answer = converse(pack, meetings, pack.notes, turns, "send that to the client");
    expect(answer.refused).toBe(false);
    expect(answer.review?.label).toBeTruthy();
    expect(answer.answer).toMatch(/never sends|review/i);
  });

  it("refuses without evidence even in a thread", () => {
    const previous = assistantTurn("The commitment is the 14th.", "what did we promise about the 14th?");
    const turns: ConversationTurn[] = [{ id: "u", role: "user", text: "what did we promise about the 14th?", at: "x" }, previous];
    const answer = converse(pack, meetings, pack.notes, turns, "what is the capital of France?");
    expect(answer.refused).toBe(true);
  });
});

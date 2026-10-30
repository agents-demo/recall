import type { Answer, ConversationTurn, Meeting, Note, Pack } from "../types";
import { answerQuestion, citationFor, fmtTime } from "./engine";

const FOLLOW_UP = /^(and\b|what about\b|who said\b|show me\b|that\b|the same\b|why\b|compare\b|tell me more\b|then\b)/i;

/**
 * Threaded recall. Follow-ups reuse the previous question as context; the answer still comes
 * only from local evidence and still refuses when nothing matches.
 */
export function converse(
  pack: Pack,
  meetings: Meeting[],
  notes: Note[],
  turns: ConversationTurn[],
  input: string,
): Answer {
  const question = input.trim();
  if (!question) {
    return {
      answer: "Ask about a promise, a person, a decision or a moment. I answer only from the capture.",
      citations: [],
      trace: [],
      confidence: 0,
      refused: true,
      latency_ms: 120,
    };
  }

  const priorUsers = turns.filter((turn) => turn.role === "user");
  const priorAssistant = [...turns].reverse().find((turn) => turn.role === "assistant" && turn.answer?.citations.length);
  const lastUser = priorUsers[priorUsers.length - 1];
  const isFollowUp = FOLLOW_UP.test(question) || question.split(/\s+/).length <= 3;
  const expanded = isFollowUp && lastUser ? `${lastUser.text} ${question}` : question;

  // "Who said that?" resolves against the previous answer, not a new full search.
  if (/^who said/i.test(question) && priorAssistant?.answer) {
    const citation = priorAssistant.answer.citations[0];
    if (citation) {
      return {
        answer: `${citation.speaker} said: “${citation.quote}” — ${fmtTime(citation.start)} in ${citation.meeting_title}.`,
        citations: priorAssistant.answer.citations,
        trace: [
          { step: "Context", detail: "Resolved “that” to the previous answer's top citation." },
          { step: "Cite", detail: `Kept ${priorAssistant.answer.citations.length} citation(s); no new facts.` },
        ],
        confidence: citation.confidence,
        refused: false,
        latency_ms: 240,
      };
    }
  }

  if (/^(show me|that moment|the clip|play that)/i.test(question) && priorAssistant?.answer) {
    const citation = priorAssistant.answer.citations[0];
    if (citation) {
      return {
        answer: `Here is the moment: “${citation.quote}” at ${fmtTime(citation.start)} in ${citation.meeting_title}. Open it to play from the exact timestamp.`,
        citations: priorAssistant.answer.citations,
        trace: [
          { step: "Context", detail: "Reused the previous citation instead of searching again." },
          { step: "Link", detail: "The citation carries the meeting id, evidence id and timestamp." },
        ],
        confidence: citation.confidence,
        refused: false,
        latency_ms: 180,
      };
    }
  }

  // Compare two named captures.
  if (/^compare/i.test(question)) {
    const named = meetings.filter((meeting) => {
      const words = meeting.title.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
      return words.some((word) => question.toLowerCase().includes(word));
    });
    if (named.length >= 2) {
      const citations = named
        .map((meeting) => {
          const evidence =
            meeting.evidence.find((item) => item.kind === "promise") ??
            meeting.evidence.find((item) => item.kind === "decision") ??
            meeting.evidence[0];
          return evidence ? citationFor(meeting, evidence) : null;
        })
        .filter((citation): citation is NonNullable<typeof citation> => Boolean(citation));
      return {
        answer: citations
          .map((citation) => `${citation.meeting_title}: “${citation.quote}” — ${citation.speaker}, ${fmtTime(citation.start)}.`)
          .join(" "),
        citations,
        trace: [
          { step: "Compare", detail: `Matched ${named.length} captures by title words.` },
          { step: "Keep", detail: "One top evidence item per capture; no cross-meeting inference." },
        ],
        confidence: citations.reduce((sum, citation) => sum + citation.confidence, 0) / Math.max(1, citations.length),
        refused: false,
        latency_ms: 380,
      };
    }
  }

  // Actions are prepared, never executed by RECALL.
  if (/\b(send|email|schedule|delete|forget|redact)\b/i.test(question) && !/\b(how|what|why|who|show|when)\b/i.test(question)) {
    const context = priorAssistant?.answer ?? answerQuestion(pack, meetings, expanded);
    const citation = context.citations[0];
    return {
      answer: `I can prepare that for review${citation ? ` from “${citation.quote}”` : ""}. RECALL never sends, schedules or deletes without a human — open the capture, check the safe version, then confirm the action there.`,
      citations: context.citations,
      trace: [
        { step: "Intent", detail: "An action was requested. The boundary stops it at a review screen." },
        { step: "Evidence", detail: `${context.citations.length} citation(s) attached to the review.` },
      ],
      confidence: citation?.confidence ?? 0.5,
      refused: false,
      latency_ms: 260,
      review: {
        label: "Open the review",
        route: citation ? `/meetings/${citation.meeting_id}?e=${citation.evidence_id}` : "/meetings",
      },
    };
  }

  const answer = answerQuestion(pack, meetings, expanded);
  if (isFollowUp && lastUser && !answer.refused) {
    return {
      ...answer,
      trace: [
        { step: "Context", detail: `Follow-up resolved against “${lastUser.text}”.` },
        ...answer.trace,
      ],
    };
  }

  // If the expanded answer is weaker than the literal question, prefer the literal result.
  if (isFollowUp && answer.refused) {
    const literal = answerQuestion(pack, meetings, question);
    if (!literal.refused) return literal;
  }

  return answer;
}

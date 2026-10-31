/**
 * CUE ↔ @laix/attention conformance report.
 *
 * This is intentionally non-failing: the CUE contract (v1.1.0) and the RECALL-extracted
 * policy are two implementations of the same idea with different vocabularies and score scales.
 * The deliverable is the report, not a pass.
 *
 * Run from packages/laix-attention:
 *   node --experimental-strip-types scripts/conformance.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decide } from "../src/index.ts";

const fixture = JSON.parse(readFileSync(new URL("../test/fixtures/attention.v1.json", import.meta.url), "utf8"));

const SEVERITY = {
  critical: "critical",
  high: "high",
  medium: "warning",
  low: "info",
  info: "info",
  warning: "warning",
};

function candidate(signal) {
  return {
    id: signal.id,
    kind: signal.kind,
    title: signal.title ?? signal.kind,
    detail: signal.detail,
    why: signal.why,
    severity: SEVERITY[signal.severity] ?? "info",
    confidence: signal.confidence ?? 0.8,
    due: signal.due,
    evidenceRefs: signal.evidenceRefs ?? [],
    interruptionCost: signal.interruptionCost,
    reversible: signal.reversible,
    requiresApproval: signal.requiresApproval,
  };
}

function context(cue) {
  const quiet = typeof cue.quietHours === "string" ? cue.quietHours.split("-") : null;
  return {
    now: cue.now,
    quietHours: quiet,
    interruptionBudget: cue.interruptionBudget,
    mutedKinds: cue.mutedKinds,
    minConfidence: cue.minConfidence,
    feedback: cue.feedback,
  };
}

function unsupported(cue) {
  const features = [];
  if (cue.minSeverity) features.push("minSeverity");
  if (cue.sent) features.push("sent");
  if (cue.stopped) features.push("stopped");
  if (cue.learned) features.push("learned");
  if (cue.escalateAfterHours) features.push("escalateAfterHours");
  if (cue.allowAct) features.push("allowAct");
  if (cue.feedback && Object.values(cue.feedback).some((item) => ["accepted", "assigned"].includes(item.state))) {
    features.push("feedback semantics");
  }
  return features;
}

function mismatchClass(cue, expected, actual, scoreDelta, ordering) {
  const features = unsupported(cue);
  if (expected.action === actual.action && expected.deliver === (actual.action !== "wait") && Math.abs(scoreDelta) <= 8) return "";
  if (features.length && !["act", "ask"].includes(cue.context.allowAct ? actual.action : "")) return "other";
  if (expected.action !== actual.action) {
    if (expected.action === "notify" && ["ask", "escalate"].includes(actual.action)) return "threshold";
    if (["ask", "escalate"].includes(expected.action) && actual.action === "notify") return "threshold";
    if (expected.action === "wait" || actual.action === "wait") return "suppression";
    return "verb mapping";
  }
  if (expected.deliver !== (actual.action !== "wait")) return "suppression";
  if (ordering) return "ordering";
  if (Math.abs(scoreDelta) > 8) return "score";
  if (features.length) return "other";
  return "other";
}

function actionOf(value) {
  return value?.action ?? "wait";
}

const rows = [];
let pass = 0;
let fail = 0;
const classes = {};

for (const testCase of fixture.cases) {
  const decisions = decide(context(testCase.context), testCase.signals.map(candidate), {
    allowAct: Boolean(testCase.context.allowAct),
  });
  const byId = new Map(decisions.map((decision) => [decision.candidateId, decision]));
  const expectedActions = testCase.expected.map((item) => item.action);
  const actualActions = testCase.expected.map((item) => actionOf(byId.get(item.signalId)));
  const expectedLabel = expectedActions.join(", ");
  const actualLabel = actualActions.join(", ");
  const actionPass = expectedActions.length === actualActions.length && expectedActions.every((action, index) => action === actualActions[index]);

  let suppressionPass = true;
  let scoreDelta = 0;
  let ordering = false;
  for (let index = 0; index < testCase.expected.length; index += 1) {
    const expected = testCase.expected[index];
    const actual = byId.get(expected.signalId);
    if (!actual) {
      suppressionPass = false;
      continue;
    }
    const deliver = actual.action !== "wait";
    if (expected.deliver !== undefined && expected.deliver !== deliver) suppressionPass = false;
    if (typeof expected.score === "number") scoreDelta = Math.max(scoreDelta, Math.abs(expected.score - actual.score));
    if (index > 0 && decisions[index - 1] && decisions[index - 1].score < actual.score) ordering = true;
  }

  const ok = actionPass && suppressionPass;
  if (ok) pass += 1;
  else fail += 1;
  const cls = ok ? "" : mismatchClass(testCase, { action: expectedActions[0], deliver: testCase.expected[0]?.deliver ?? true }, { action: actualActions[0] }, scoreDelta, ordering);
  if (cls) classes[cls] = (classes[cls] ?? 0) + 1;

  rows.push({
    id: testCase.id,
    expected: expectedLabel,
    actual: actualLabel,
    pass: ok,
    cls: cls || "-",
    scoreDelta: Number.isFinite(scoreDelta) ? scoreDelta : null,
    features: unsupported(testCase.context),
  });
}

const lines = [
  "# CUE ↔ @laix/attention conformance",
  "",
  "**Report, not a gate.** CUE v1.1.0 and the RECALL-extracted policy are two implementations with",
  "different action vocabularies, severity scales and context extensions. The goal is to expose the",
  "differences, not to force agreement.",
  "",
  `- CUE contract: \`${fixture.contract}\` v${fixture.version}`,
  `- CUE commit: \`${fixture._provenance?.cue_commit ?? "unknown"}\``,
  `- Source: \`${fixture._provenance?.source_path ?? "unknown"}\``,
  "- TS policy: `src/index.ts` (`decide`)",
  "- Comparison: action and delivery/suppression outcome per signal; score delta reported, not gated.",
  "",
  "## Summary",
  "",
  `- Cases: **${rows.length}**`,
  `- Pass: **${pass}**`,
  `- Fail: **${fail}**`,
  `- Mismatch classes: ${Object.entries(classes).map(([key, value]) => `**${key}** ${value}`).join(" · ") || "none"}`,
  "",
  "## Cases",
  "",
  "| case | expected action | actual action | pass | mismatch class | score delta | unsupported context |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((row) => `| ${row.id} | ${row.expected} | ${row.actual} | ${row.pass ? "pass" : "fail"} | ${row.cls} | ${row.scoreDelta ?? "-"} | ${row.features.join(", ") || "-"} |`),
  "",
  "## What this report says",
  "",
  "- **Do not force agreement.** The canonical LAIX contract is not final.",
  "- CUE uses `medium`/`low`; the TS package uses `warning`/`info`; the mapping is recorded, not hidden.",
  "- CUE scores and TS scores use different scales; the table reports the delta.",
  "- CUE has context fields the TS package does not implement (`minSeverity`, `sent`, `stopped`,",
  "  `learned`, `escalateAfterHours`). Those are reported as unsupported, not faked.",
  "- CUE suppresses `accepted` and `assigned`; the TS package currently treats them differently. This",
  "  is a product decision for the LAIX contract.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "cd packages/laix-attention",
  "npm run conformance",
  "```",
  "",
];

const report = new URL("../CONFORMANCE.md", import.meta.url);
writeFileSync(report, lines.join("\n"), "utf8");
console.log(`CUE conformance: ${pass} pass, ${fail} fail, classes: ${JSON.stringify(classes)}`);
console.log(`wrote ${report.pathname}`);
process.exitCode = 0;

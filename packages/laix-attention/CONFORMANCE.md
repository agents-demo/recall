# CUE ↔ @laix/attention conformance

**Report, not a gate.** CUE v1.1.0 and the RECALL-extracted policy are two implementations with
different action vocabularies, severity scales and context extensions. The goal is to expose the
differences, not to force agreement.

- CUE contract: `laix-attention` v1.1.0
- CUE commit: `a4c6bef885fe0d59a1885656a801c5478cc1be11`
- Source: `C:/Workspace/openjiuwendemos/cue/server/laix_attention/contract/attention.v1.json`
- TS policy: `src/index.ts` (`decide`)
- Comparison: action and delivery/suppression outcome per signal; score delta reported, not gated.

## Summary

- Cases: **23**
- Pass: **7**
- Fail: **16**
- Mismatch classes: **threshold** 7 · **suppression** 7 · **verb mapping** 2

## Cases

| case | expected action | actual action | pass | mismatch class | score delta | unsupported context |
|---|---|---|---|---|---|---|
| critical_at_night_still_reaches_a_human | notify | escalate | fail | threshold | 6 | minSeverity |
| high_waits_for_the_digest_at_night | wait | escalate | fail | suppression | 19 | minSeverity |
| medium_is_below_the_floor | wait | notify | fail | suppression | 10 | minSeverity |
| low_confidence_is_not_raised | wait | wait | pass | - | 51 | minSeverity |
| a_muted_kind_is_silent | wait | wait | pass | - | 63 | - |
| the_same_signal_is_not_repeated_the_same_day | wait | ask | fail | suppression | 16 | sent |
| the_kill_switch_wins_over_everything | wait | escalate | fail | suppression | 20.200000000000003 | stopped |
| the_interruption_budget_is_a_hard_cap | notify, wait | escalate, escalate | fail | threshold | 21 | - |
| a_critical_that_stayed_overdue_escalates | escalate | ask | fail | verb mapping | 9 | escalateAfterHours |
| quiet_hours_end_is_inclusive | wait | ask | fail | suppression | 17 | - |
| one_minute_after_quiet_hours_notifies | notify | ask | fail | threshold | 17 | - |
| learned_adjustment_is_added_to_the_score | notify | ask | fail | threshold | 8 | learned |
| a_snooze_holds_until_it_expires | wait | wait | pass | - | 61 | - |
| an_expired_snooze_releases_the_signal | notify | ask | fail | threshold | 17 | - |
| a_signal_marked_wrong_never_repeats | wait | wait | pass | - | 61 | - |
| an_assigned_signal_is_someone_elses_job | wait | ask | fail | suppression | 17 | feedback semantics |
| a_dismissed_signal_stays_dismissed | wait | wait | pass | - | 61 | - |
| an_accepted_signal_is_not_suppressed | notify | wait | fail | suppression | 61 | feedback semantics |
| a_reversible_intent_is_executed_when_act_is_allowed | act | ask | fail | verb mapping | 16 | allowAct |
| an_action_that_needs_approval_asks_first | ask | ask | pass | - | 16 | allowAct |
| an_intent_does_nothing_unless_act_is_allowed | notify | ask | fail | threshold | 16 | - |
| an_escalation_carries_its_target | escalate | escalate | pass | - | 9 | escalateAfterHours |
| no_new_context_behaves_exactly_as_before | notify | ask | fail | threshold | 16 | - |

## What this report says

- **Do not force agreement.** The canonical LAIX contract is not final.
- CUE uses `medium`/`low`; the TS package uses `warning`/`info`; the mapping is recorded, not hidden.
- CUE scores and TS scores use different scales; the table reports the delta.
- CUE has context fields the TS package does not implement (`minSeverity`, `sent`, `stopped`,
  `learned`, `escalateAfterHours`). Those are reported as unsupported, not faked.
- CUE suppresses `accepted` and `assigned`; the TS package currently treats them differently. This
  is a product decision for the LAIX contract.

## Reproduce

```bash
cd packages/laix-attention
npm run conformance
```

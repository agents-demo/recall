# Design audit and research plan

## Responsive audit

| Width | Layout | Check |
|---|---|---|
| 1440 px | Instrument bar, 68 px rail, 5-stat row, 3-column home grid, two-column workspace | Rail labels legible; transcript and inspector both visible; stage two-column |
| 1024 px | Rail hidden, bottom navigation, 2–3 column panels | Touch targets; inspector stacked above transcript on deep links |
| 390 px | Single column, bottom navigation, 56 vh transcript, one-hand field form | No horizontal scroll; 48 px controls; quote and timestamp readable |

The CSS uses three breakpoints (1320 / 1120 / 900 / 680 / 460) and container-free fluid grids. The mobile
bottom navigation replaces the rail below 900 px. The stage keeps its own dark theatre palette.

## Accessibility

- Lighthouse on the home and stage routes: **Accessibility 100, Best Practices 100, SEO 100** (Chrome,
  October 2026).
- WCAG 2.2 AA target: contrast tokens were raised to clear 4.5:1 for small text; semantic labels carry
  consent, redaction, retention and deletion states so colour is never the only signal.
- Keyboard: ⌘K / Ctrl K, `/`, G-sequences, Space and R on the stage, arrow keys on the waveform, focus
  rings on every interactive element.
- Live regions: the live transcript is `aria-live="polite"`; toasts are `role="status"`.
- Reduced motion: in-app toggle and `prefers-reduced-motion`; no state change depends on animation.
- High-contrast theme: yellow signal, green consent, red redaction, white ink, 34% hairlines.

## Performance budgets

| Interaction | Budget | Current static build |
|---|---|---|
| Capture start (UI) | 250 ms | immediate state transition |
| Local search | 100 ms | < 20 ms for 119 rows + 8 evidence items |
| Quote reconstruction | 10 s (pilot target) | 18 s pilot median; deep link already at 11:24 |
| PPMA event delivery | 30 s | 1.4 s local fake |
| Stage first touch | 15 s | one record tap |
| Reset | 5 s | `R`, immediate |
| Shell load | < 2 s on a laptop | ~270 KB JS gzip 86 KB + 126 KB CSS gzip 24 KB + local fonts |

## Content and terminology

The glossary in the [design system route](https://jiuwendemos.github.io/recall/#/design) fixes the words:
capture, consent, redaction, evidence, forget, source, tombstone, sensitivity. The UI never says
“AI-powered notes” or “never miss anything”.

## Research plan (pilot)

### Five-second test

Show the home screen for five seconds, then ask: “What does this do?” Success: mentions capture and
project memory in one sentence. Failure: describes it as a recorder or a dashboard.

### Role interviews (five per role)

| Role | Question | Signal |
|---|---|---|
| Individual | “Can you find a promise from three weeks ago?” | time to quote ≤ 10 s |
| Team lead | “Did the memory change the follow-up?” | action conversion |
| Privacy / legal | “Can you prove consent and deletion?” | consent coverage, tombstone |
| Field | “Does it work with no signal?” | offline completion |
| Admin | “Can you revoke a device and export the audit?” | control completion |

### SUS and gates

- SUS ≥ 80 with pilot users.
- Five users per role complete capture → recall → send to PPMA without help.
- Time to quote ≤ 10 s.
- Keep the 90-second stage piece intact after any UX change.
- If the five-stranger test fails, do not book the next conference.

The demo cannot conduct interviews. The plan above is the gate the pilot must pass before Phase 2.

# Accessibility — v1.0 audit

Audited with Lighthouse (Chrome, October 2026) against every first-level route:

| Route | Accessibility | Notes |
|---|---|---|
| Now | 100 | attention strip, role focus, onboarding |
| Attention | 100 | nudge cards, filters, digest |
| Record | 100 | consent form, device state |
| Meetings | 100 | list and tombstones |
| Meeting workspace | 100 | transcript, evidence, comments, rights |
| Recall | 100 | threaded chat, citations, voice button |
| Memory canvas | 100 | keyboard-selectable SVG nodes |
| PPMA | 100 | event log, commands, conformance |
| Connected services | 100 | connector cards, toggles, endpoint form |
| Field | 100 | phone form, ambient controls |
| Pilot | 100 | gates, charts with text alternatives |
| Admin | 100 | spaces, roles, devices, billing |
| Health | 100 | model cards, drift, runbook |
| Settings | 100 | themes, type size, data rights |
| Design | 100 | components and tokens |
| About | 100 | boundary and business model |
| Booth | 100 | scenario cards and run |
| Share | n/a | read-only safe evidence page; no form controls |
| Stage | 100 | full-screen 90-second piece |

The canvas regression is a `label-content-name-mismatch` warning on SVG group nodes; the accessible
name now includes both the label and the sub-label. The score remains 100.

## Keyboard paths

- `⌘K` / `Ctrl K`: command palette, search, ask.
- `/`: focus search.
- `G` then `N` / `A` / `R` / `M` / `S` / `P` / `F` / `D`: navigate.
- `T`: cycle theme.
- Stage: `Space` advance, `R` reset, `Esc` exit.
- Waveform: arrow keys seek.
- All controls have visible focus rings.

## Screen-reader script

1. “The page is RECALL. The status is consent granted, local only.”
2. “Open Attention. Nine items; first is a promise overdue; button is Open the promise.”
3. “Open the meeting. The evidence inspector says promise, speaker, timestamp, confidence.”
4. “Choose Correct speaker. The transcript and PPMA memory update.”
5. “Open Consent and rights. Apply redaction. The safe version is what PPMA receives.”
6. “Send to PPMA. A preview lists the payload; confirm. Live PPMA acknowledges.”
7. “Delete. The page becomes a tombstone with a deletion receipt.”

## Reduced motion, zoom, contrast

- `prefers-reduced-motion` and the in-app toggle remove pulses and smooth scroll.
- The high-contrast theme is a separate token set, not a filter.
- Type defaults to the **Large** scale; Settings switches back to Standard.
- Browser 200% zoom is handled by fluid grids and the mobile bottom navigation; the main routes were
  checked at 1440, 1024 and 390 CSS px.

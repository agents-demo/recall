# LAIX-ready packages

Two pure-TypeScript packages extracted from RECALL so LAIX can take them without the app:

| Package | Purpose |
|---|---|
| [`laix-attention`](laix-attention/README.md) | decide when to intervene: wait / notify / ask / act / verify / escalate |
| [`laix-decision-record`](laix-decision-record/README.md) | record what was decided, why, evidence, approval, audit and undo |

Both have no React, no browser storage and no RECALL types. RECALL imports them through Vite aliases
and acts as the first reference app.

See [`../docs/laix-extraction.md`](../docs/laix-extraction.md) for the boundary and migration path.

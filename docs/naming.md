# Naming decision — RECALL vs PPMA `recall`

**Decision (October 2026).** The external product remains **RECALL**. PPMA’s planned `recall` memory view is
a **read surface**, not this app. The contract therefore keeps:

| Thing | Value |
|---|---|
| Product | RECALL |
| PPMA app id | `recall-capture` |
| Event prefix | `capture.*` |
| PPMA memory view | `recall` (read API) |
| Default sensitivity | `personal` |
| Direction | events out; limited commands in |

## Why this works

- The app id is explicit and stable: `recall-capture`, not `recall`.
- Events use `capture.*`, so a rename never changes the wire contract.
- PPMA’s `recall` view is a read API over derived memory; it does not record, redact or own evidence.
- The UI says **RECALL** in the product and **PPMA north app** for the integration surface.
- The manager proof page states the resolution in one line.

## If the name changes

1. Change the display name in the UI and manifest.
2. Keep `app_id=recall-capture` and `capture.*` for at least two minor versions.
3. Publish a migration note and a deprecation window.
4. Do not silently change event payload semantics.

See `docs/integration-ppma.md` §3 and `docs/architecture-v1.md`.

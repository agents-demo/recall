# Naming decision — RECALL vs PPMA `recall`

**Decision (October 2026).** The external product remains **RECALL**. PPMA’s `recall` memory view is
a **read surface**, not this app. The PPMA app id is **`capture`**.

Two PPMA contract rules force this:

1. app ids match `^[a-z][a-z0-9]*$`, so `recall-capture` (with a hyphen) is invalid; and
2. every declared event and tool must sit inside the app's own namespace (`{app}.*`), so an app
   called `recallcapture` could not emit `capture.*`.

Since the wire contract keeps the stable `capture.*` event prefix, the app id must be `capture`.
The display name stays RECALL.

| Thing | Value |
|---|---|
| Product | RECALL |
| PPMA app id | `capture` |
| Event prefix | `capture.*` |
| PPMA memory view | `recall` (read API, not this app) |
| Default sensitivity | `personal` |
| Direction | events out; limited commands in |

## Why this works

- The app id is explicit, stable and valid: `capture`, not `recall` or `recall-capture`.
- App id and event namespace match, so PPMA accepts the manifest.
- PPMA’s `recall` view is a read API over derived memory; it does not record, redact or own evidence.
- The UI says **RECALL** in the product and **PPMA north app** for the integration surface.
- The manager proof page states the resolution in one line.

## If the name changes

1. Change the display name in the UI and manifest.
2. Keep `app_id=capture` and `capture.*` for at least two minor versions.
3. Publish a migration note and a deprecation window.
4. Do not silently change event payload semantics.

See `docs/integration-ppma.md` §3 and `docs/architecture-v1.md`.

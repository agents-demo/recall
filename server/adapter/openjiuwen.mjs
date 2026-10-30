/**
 * Openjiuwen adapter for RECALL.
 *
 * The adapter is deliberately read-only plus "prepare" tools. An agent runtime can search,
 * fetch evidence and prepare a handoff or redaction review, but it cannot send, delete or
 * change project state. Those remain human/PPMA actions.
 *
 *   const tools = createCaptureTools({ baseUrl: "http://localhost:8787" });
 *   const hits = await tools.search("delivery");
 */
export function createCaptureTools({ baseUrl = "http://localhost:8787", token = "" } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const base = baseUrl.replace(/\/$/, "");

  async function get(path) {
    const response = await fetch(`${base}${path}`, { headers });
    if (!response.ok) throw new Error(`RECALL adapter ${path}: HTTP ${response.status}`);
    return response.json();
  }

  return {
    async search(query) {
      return get(`/v1/search?q=${encodeURIComponent(query)}`);
    },
    async evidence(evidenceId) {
      return get(`/v1/evidence/${encodeURIComponent(evidenceId)}`);
    },
    async prepareHandoff(captureId) {
      const memory = await get("/v1/memory");
      return {
        capture_id: captureId,
        review: true,
        memory: memory.memory.filter((entry) => entry.capture_id === captureId),
        note: "This is a review payload. The agent must not send it without a human.",
      };
    },
    async prepareRedaction(captureId, evidenceId) {
      const evidence = await get(`/v1/evidence/${encodeURIComponent(evidenceId)}`);
      return {
        capture_id: captureId,
        evidence_id: evidenceId,
        before: evidence.quote,
        after: "[redacted — human confirmation required]",
        review: true,
        note: "The agent cannot apply a redaction. It can only prepare the preview.",
      };
    },
    manifest() {
      return get("/v1/tools");
    },
  };
}

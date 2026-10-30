import type { ConnectorDef } from "../types";

/**
 * The connector catalogue. `mock` means the demo has a working local provider; the real connector
 * needs OAuth/credentials. Nothing is enabled by default and every connector carries a purpose.
 */
export const CONNECTORS: ConnectorDef[] = [
  { id: "ppma", name: "PPMA north contract", category: "Core", direction: "read+write", purpose: "Project memory, facts and commands", scopes: ["events:write", "memory:read", "commands:write"], status: "available", note: "Signed events, dedupe, ack and dead-letter. The local fake is the default.", mock: true },
  { id: "openjiuwen", name: "openjiuwen runtime", category: "Core", direction: "read+write", purpose: "Agent runtime for capture tasks", scopes: ["agent:invoke", "tools:read"], status: "preview", note: "Adapter contract and local bridge; needs the runtime configured.", mock: true },
  { id: "local-ppma", name: "Local PPMA server", category: "Core", direction: "read+write", purpose: "Pilot ingest on the local network", scopes: ["events:write", "memory:read"], status: "available", note: "Runs from server/ with HMAC signatures and a JSON store.", mock: true },
  { id: "google-calendar", name: "Google Calendar", category: "Meetings", direction: "read", purpose: "Meeting context and attendees", scopes: ["calendar.readonly"], status: "preview", note: "OAuth client required. Read-only; no event creation.", mock: true },
  { id: "microsoft-calendar", name: "Microsoft 365 Calendar", category: "Meetings", direction: "read", purpose: "Meeting context and attendees", scopes: ["Calendars.Read"], status: "preview", note: "OAuth client required. Read-only; no event creation.", mock: true },
  { id: "zoom", name: "Zoom", category: "Meetings", direction: "read", purpose: "Join a meeting and capture with consent", scopes: ["meeting:read", "recording:local"], status: "preview", note: "The meeting URL is accepted; join/capture needs the native bridge.", mock: true },
  { id: "google-meet", name: "Google Meet", category: "Meetings", direction: "read", purpose: "Join a meeting and capture with consent", scopes: ["meeting:read"], status: "preview", note: "Browser tab capture path is preview only.", mock: true },
  { id: "teams", name: "Microsoft Teams", category: "Meetings", direction: "read", purpose: "Join a meeting and capture with consent", scopes: ["OnlineMeetings.Read"], status: "preview", note: "Graph permission and tenant consent required.", mock: true },
  { id: "phone", name: "Phone dial-in", category: "Meetings", direction: "read", purpose: "Capture a call with number hashing", scopes: ["call:local"], status: "preview", note: "Raw numbers are hashed; no number leaves the device.", mock: true },
  { id: "slack", name: "Slack", category: "Communication", direction: "write", purpose: "Post a safe evidence card with a source link", scopes: ["chat:write"], status: "preview", note: "Only the safe version and a pointer; never raw media.", mock: true },
  { id: "teams-chat", name: "Teams chat", category: "Communication", direction: "write", purpose: "Post a safe evidence card with a source link", scopes: ["ChatMessage.Send"], status: "preview", note: "Only the safe version and a pointer; never raw media.", mock: true },
  { id: "email", name: "Email draft", category: "Communication", direction: "write", purpose: "Prepare a follow-up draft for PPMA to send", scopes: ["draft:prepare"], status: "available", note: "Creates a local mailto draft. RECALL never sends it.", mock: true },
  { id: "salesforce", name: "Salesforce", category: "CRM", direction: "read", purpose: "Attach account and opportunity context", scopes: ["api:read"], status: "preview", note: "Read-only field mapping; no CRM writes.", mock: true },
  { id: "hubspot", name: "HubSpot", category: "CRM", direction: "read", purpose: "Attach company and deal context", scopes: ["crm.objects.read"], status: "preview", note: "Read-only field mapping; no CRM writes.", mock: true },
  { id: "jira", name: "Jira", category: "Work", direction: "write", purpose: "Link an action; PPMA creates the issue", scopes: ["issue:link"], status: "preview", note: "Link-out only. RECALL does not create tasks.", mock: true },
  { id: "linear", name: "Linear", category: "Work", direction: "write", purpose: "Link an action; PPMA creates the issue", scopes: ["issue:link"], status: "preview", note: "Link-out only. RECALL does not create tasks.", mock: true },
  { id: "asana", name: "Asana", category: "Work", direction: "write", purpose: "Link an action; PPMA creates the task", scopes: ["task:link"], status: "preview", note: "Link-out only. RECALL does not create tasks.", mock: true },
  { id: "notion", name: "Notion", category: "Knowledge", direction: "write", purpose: "Embed a safe evidence pack", scopes: ["page:embed"], status: "preview", note: "Safe text and pointer; no raw media.", mock: true },
  { id: "confluence", name: "Confluence", category: "Knowledge", direction: "write", purpose: "Embed a safe evidence pack", scopes: ["page:embed"], status: "preview", note: "Safe text and pointer; no raw media.", mock: true },
  { id: "gdrive", name: "Google Drive", category: "Knowledge", direction: "write", purpose: "Export a safe evidence pack", scopes: ["drive.file"], status: "preview", note: "Receives the safe pack only.", mock: true },
  { id: "sharepoint", name: "SharePoint", category: "Knowledge", direction: "write", purpose: "Export a safe evidence pack", scopes: ["Files.ReadWrite"], status: "preview", note: "Receives the safe pack only.", mock: true },
  { id: "webhook", name: "Outbound webhook", category: "Automation", direction: "write", purpose: "Send a signed safe evidence event", scopes: ["webhook:write"], status: "available", note: "Real HTTP POST from the local server; safe payload only.", mock: true },
  { id: "mcp", name: "MCP tools", category: "Automation", direction: "read+write", purpose: "Read-only evidence and recall tools", scopes: ["tools:read"], status: "available", note: "The server exposes an MCP-compatible tool list.", mock: true },
  { id: "storage", name: "Encrypted local store", category: "Security", direction: "read+write", purpose: "AES-GCM at rest with a device key", scopes: ["store:local"], status: "available", note: "Web Crypto, key in IndexedDB. No plaintext persistence after migration.", mock: true },
  { id: "oidc", name: "OIDC / SSO", category: "Security", direction: "read", purpose: "Owner identity and team roles", scopes: ["openid", "profile", "groups"], status: "preview", note: "PKCE client and mock provider; real IdP needs a client id.", mock: true },
  { id: "stripe", name: "Stripe billing", category: "Commercial", direction: "read", purpose: "Seats and subscription state", scopes: ["billing:read"], status: "preview", note: "Checkout mock; real keys never ship in the static build.", mock: true },
];

export const CONNECTOR_CATEGORIES = [...new Set(CONNECTORS.map((connector) => connector.category))];

export function connectorById(id: string): ConnectorDef | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}

export function defaultConnectorState(): Record<string, import("../types").ConnectorState> {
  return Object.fromEntries(
    CONNECTORS.map((connector) => [
      connector.id,
      {
        enabled: connector.id === "ppma",
        configured: connector.id === "ppma" || connector.id === "storage",
        consent_purpose: connector.purpose,
        scopes: connector.scopes,
        last_test: null,
        last_status: connector.id === "ppma" ? "ok" : "not_configured",
        detail: connector.note,
      },
    ]),
  );
}

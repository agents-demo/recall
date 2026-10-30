# Vendor and connector register — v1.0

Every connection in `web/src/lib/connectors.ts` has a purpose, a direction, a scope set and a state. This
register records the data-processing posture. A connector with no purpose does not connect.

| Connector | Category | Direction | Purpose | Raw media | Status | DPA / note |
|---|---|---|---|---|---|---|
| PPMA | Core | read+write | project memory, facts, commands | never | available | derived text + pointer only |
| openjiuwen | Core | read+write | agent runtime / tools | never | preview | adapter manifest, no execute tool |
| Local PPMA server | Core | read+write | pilot ingest | never | available | local network, HMAC, JSON store |
| Google Calendar | Meetings | read | meeting context | never | preview | OAuth client + DPA required |
| Microsoft 365 Calendar | Meetings | read | meeting context | never | preview | OAuth client + DPA required |
| Zoom | Meetings | read | join/capture with consent | local only | preview | native bridge required |
| Google Meet | Meetings | read | join/capture with consent | local only | preview | browser capture path preview |
| Microsoft Teams | Meetings | read | join/capture with consent | local only | preview | tenant consent required |
| Phone dial-in | Meetings | read | call capture | local only | preview | numbers hashed |
| Slack | Communication | write | safe evidence card | never | preview | safe text + pointer |
| Teams chat | Communication | write | safe evidence card | never | preview | safe text + pointer |
| Email draft | Communication | write | prepare a follow-up | never | available | `mailto:` draft, never sent |
| Salesforce | CRM | read | account context | never | preview | read-only field mapping |
| HubSpot | CRM | read | company/deal context | never | preview | read-only field mapping |
| Jira | Work | write | link an action | never | preview | link-out only; PPMA acts |
| Linear | Work | write | link an action | never | preview | link-out only; PPMA acts |
| Asana | Work | write | link an action | never | preview | link-out only; PPMA acts |
| Notion | Knowledge | write | embed safe evidence | never | preview | safe text + pointer |
| Confluence | Knowledge | write | embed safe evidence | never | preview | safe text + pointer |
| Google Drive | Knowledge | write | export safe pack | never | preview | safe pack only |
| SharePoint | Knowledge | write | export safe pack | never | preview | safe pack only |
| Outbound webhook | Automation | write | signed safe event | never | available | local server only in this build |
| MCP tools | Automation | read+write | read-only evidence/recall | never | available | no execute/send/delete |
| Encrypted local store | Security | read+write | AES-GCM at rest | local only | available | key in IndexedDB |
| OIDC / SSO | Security | read | identity and roles | never | preview | mock; real IdP requires client |
| Stripe billing | Commercial | read | seats/subscription | never | preview | mock; real keys never ship |

## Rules

- Consent purpose is mandatory and editable per connector.
- Raw media egress is blocked. A connector receives safe text and a pointer.
- Each connector has an off switch. Disable-all is one action.
- Vendor connectors in preview are mock providers; no account is used in the public demo.
- A vendor data-processing agreement and security review are required before a real connection.

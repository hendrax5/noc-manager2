# NOC Manager Integration API v1

Server-to-server API for tickets, schedules, meetings, and reports (AI agents / connectors).

## Auth

Send header:

```http
X-API-Key: noc_xxxxxxxx...
```

Create keys in **Settings → Integrations**. Each app has scopes and optional webhook URL.

Legacy fallback: `EXTERNAL_API_KEY` env or Settings `externalApiKey` (create + full scopes, no per-app webhooks).

## Endpoints

| Method | Path | Scope |
|--------|------|--------|
| GET | `/api/v1/tickets` | `tickets:read` |
| POST | `/api/v1/tickets` | `tickets:create` |
| GET | `/api/v1/tickets/{trackingId}` | `tickets:read` |
| PATCH | `/api/v1/tickets/{trackingId}` | `tickets:update` |
| POST | `/api/v1/tickets/{trackingId}/comments` | `tickets:comment` |
| GET | `/api/v1/schedules` | `schedules:read` |
| GET | `/api/v1/schedules/types` | `schedules:read` |
| GET | `/api/v1/meetings` | `meetings:read` |
| GET | `/api/v1/meetings/{id}` | `meetings:read` |
| GET | `/api/v1/reports/daily` | `reports:daily:read` |
| GET | `/api/v1/reports/daily/{id}` | `reports:daily:read` |
| GET | `/api/v1/reports/ops` | `reports:ops:read` |
| GET | `/api/v1/meta/departments` | `tickets:create` or `tickets:read` |
| GET | `/api/v1/openapi` | public |
| POST | `/api/external/tickets` | legacy alias of create |

Agent walkthrough: [AI_AGENT_TICKETS.md](./AI_AGENT_TICKETS.md)

### List / poll tickets (AI agent)

```http
GET /api/v1/tickets?status=Pending&hasHumanResponse=true&updatedSince=2026-09-25T00:00:00Z&limit=50&offset=0
X-API-Key: ...
```

Query params:

| Param | Description |
|-------|-------------|
| `status` | One status or comma list (`New`, `Open`, `Pending`, …) |
| `hasHumanResponse` | `true` / `false` — based on `firstRespondedAt` |
| `createdSince` | ISO-8601 — tickets created at/after |
| `updatedSince` | ISO-8601 — tickets updated at/after |
| `respondedSince` | ISO-8601 — first human response at/after |
| `departmentId` / `departmentCode` | Filter by department |
| `includeComments` | `true` to embed public comments (max 50) on each item |
| `limit` | 1–100 (default 50) |
| `offset` | Pagination offset (default 0) |

Response:

```json
{
  "tickets": [
    {
      "trackingId": "HSK-XXXX-XXXX",
      "title": "...",
      "status": "Pending",
      "firstRespondedAt": "2026-09-25T10:00:00.000Z",
      "hasHumanResponse": true,
      "publicCommentCount": 2,
      "updatedAt": "...",
      "trackUrl": "/track/HSK-XXXX-XXXX"
    }
  ],
  "pagination": { "total": 12, "limit": 50, "offset": 0, "hasMore": false }
}
```

Typical agent poll:

1. New tickets: `?status=New&createdSince=...`
2. Already answered by staff: `?hasHumanResponse=true&updatedSince=...` or `?status=Pending`
3. Full thread: `GET /api/v1/tickets/{trackingId}`

Optional realtime: set Integration App `webhookUrl` for `ticket.created` / `ticket.commented` / `ticket.status_changed`, then GET detail by `trackingId`.

### Schedules (read-only)

```http
GET /api/v1/schedules?start=2026-10-01&end=2026-10-31&departmentId=1
GET /api/v1/schedules/types
```

Query: `start`+`end` (required), optional `departmentId`, `locationId`, `userId`.

### Meetings (read-only)

```http
GET /api/v1/meetings?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z&limit=50
GET /api/v1/meetings/123
```

Query: `from`, `to`, `status`, `limit`, `offset`.

### Daily reports (read-only)

```http
GET /api/v1/reports/daily?from=2026-09-01T00:00:00Z&userId=10&limit=50
GET /api/v1/reports/daily/42
```

### Ops report (read-only)

```http
GET /api/v1/reports/ops?period=week&anchor=2026-09-25
GET /api/v1/reports/ops?period=month&anchor=2026-09-01
GET /api/v1/reports/ops?period=custom&start=2026-09-01&end=2026-09-30
```

Same shape as UI Ops Report: `counts`, `downtime`, `terminate`, `new`, `upgrade`.

### Create ticket

```http
POST /api/v1/tickets
Idempotency-Key: zabbix-alert-12345
X-API-Key: ...
Content-Type: application/json

{
  "title": "Host down: core-sw-01",
  "description": "ICMP ping failed",
  "priority": "Critical",
  "ticketType": "Incident",
  "departmentCode": "noc-core",
  "externalRef": "zabbix:12345",
  "enableSla": true,
  "customData": { "host": "core-sw-01", "severity": 12345 }
}
```

- Prefer `departmentCode` (slug of department name) or set a default department on the Integration App.
- `Idempotency-Key` / `externalRef` prevent duplicate tickets per app.

### Get / patch / comment

```bash
curl -H "X-API-Key: $KEY" https://HOST/api/v1/tickets/HSK-XXXX-XXXX
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"status":"Resolved"}' https://HOST/api/v1/tickets/HSK-XXXX-XXXX
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"text":"Acknowledged by monitoring","isPublic":true}' \
  https://HOST/api/v1/tickets/HSK-XXXX-XXXX/comments
```

Allowed PATCH statuses: `Open`, `Pending`, `On Hold`, `In Progress`, `Resolved`, `Closed`, `Finish`.

## Webhooks (outbound)

Configure `webhookUrl` on an Integration App. Events:

- `ticket.created`
- `ticket.status_changed`
- `ticket.resolved`
- `ticket.commented`
- `ticket.sla_breached`

Headers:

- `X-NOC-Event`
- `X-NOC-Signature` — HMAC-SHA256 hex of raw body using app webhook secret
- `X-NOC-App`

Verify:

```js
const crypto = require("crypto");
const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
```

Deliveries are logged in `NotificationLog` (`channel: webhook`).

## Connectors

See `docs/connectors/` for Zabbix and Grafana alert → ticket payload templates.

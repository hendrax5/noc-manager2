# NOC Manager Integration API v1

Server-to-server API for tickets, dashboard, schedules, meetings, and reports (AI agents / connectors).

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
| GET | `/api/v1/tickets` | `tickets:read` (+ `tickets:read:full` for `view=full`) |
| POST | `/api/v1/tickets` | `tickets:create` |
| GET | `/api/v1/tickets/{trackingId}` | `tickets:read` |
| GET | `/api/v1/tickets/{trackingId}/full` | `tickets:read:full` |
| PATCH | `/api/v1/tickets/{trackingId}` | `tickets:update` |
| POST | `/api/v1/tickets/{trackingId}/comments` | `tickets:comment` |
| GET | `/api/v1/dashboard` | `dashboard:read` |
| GET | `/api/v1/dashboard/live-ops` | `dashboard:read` |
| GET | `/api/v1/dashboard/sla-alerts` | `dashboard:read` |
| GET | `/api/v1/schedules` | `schedules:read` |
| GET | `/api/v1/schedules/types` | `schedules:read` |
| GET | `/api/v1/meetings` | `meetings:read` |
| GET | `/api/v1/meetings/{id}` | `meetings:read` |
| GET | `/api/v1/reports/daily` | `reports:daily:read` |
| GET | `/api/v1/reports/daily/{id}` | `reports:daily:read` |
| GET | `/api/v1/reports/ops` | `reports:ops:read` |
| GET | `/api/v1/reports/performance/{userId}` | `reports:performance:read` |
| GET | `/api/v1/reports/leaderboard` | `reports:performance:read` |
| GET | `/api/v1/reports/work-hours` | `reports:performance:read` |
| GET | `/api/v1/reports/sla` | `reports:sla:read` |
| GET | `/api/v1/reports/service-desk` | `reports:sla:read` |
| GET | `/api/v1/meta/departments` | `tickets:create` or `tickets:read` |
| GET | `/api/v1/meta/users` | any of `tickets:read`, `tickets:read:full`, `reports:performance:read`, `dashboard:read` |
| GET | `/api/v1/meta/job-categories` | any of `tickets:read`, `tickets:read:full`, `tickets:create`, `dashboard:read` |
| GET | `/api/v1/meta/queues` | any of `tickets:read`, `tickets:read:full`, `tickets:create` |
| GET | `/api/v1/meta/custom-fields` | any of `tickets:read`, `tickets:read:full`, `tickets:create` |
| GET | `/api/v1/openapi` | public |
| POST | `/api/external/tickets` | legacy alias of create |

Coverage per app menu:

| Menu | API |
|------|-----|
| Dashboard | `/dashboard`, `/dashboard/live-ops`, `/dashboard/sla-alerts` |
| Tickets | `/tickets`, `/tickets/{id}`, `/tickets/{id}/full` (read); create / PATCH / comment (write) |
| Shifts | `/schedules`, `/schedules/types` |
| Meetings | `/meetings`, `/meetings/{id}` |
| Daily Reports (leaderboard + metrics) | `/reports/leaderboard`, `/reports/service-desk` |
| Laporan harian (isi) | `/reports/daily` |
| SLA & Analytics | `/reports/sla` |
| Ops Report | `/reports/ops` |
| Poin saya / Performance | `/reports/performance/{userId}`, `/reports/work-hours` |

Not exposed via API key: Knowledge Base, Assets & Services, Shift Fairness, Team Management, System Settings.

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
| `priority` | Comma list: `Low`, `Medium`, `High`, `Critical` |
| `ticketType` | Comma list: `Incident`, `Problem`, `Change`, `Request` |
| `assigneeId` | User id, or `none` for unassigned |
| `jobCategoryId` / `queueId` | Filter by category / queue |
| `slaBreached` | `true` / `false` |
| `q` | Search title, trackingId, externalRef, description |
| `view` | `full` → adds `customData`, `jobCategory`, `queue`, `services`, `csat`, `awardedScore`, `counts` (needs `tickets:read:full`) |
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
      "createdBy": {
        "id": 12,
        "name": "Budi Santoso",
        "email": "budi@example.com",
        "source": "user"
      },
      "assignee": { "id": 3, "name": "...", "email": "..." },
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

### Full ticket (read-only)

```http
GET /api/v1/tickets/HSK-XXXX-XXXX/full
```

Everything on the ticket detail page: all comments (`isPublic` true/false) with attachments, internal `notes`, full `history`, `attachments`, `watchers`, `services` (customer, template, customData), `csat`, `jobCategory`, `queue`, `meetings`, `actionItem`, SLA and escalation fields. Scope `tickets:read:full`.

### Dashboard (read-only)

```http
GET /api/v1/dashboard?departmentId=1&assigneeId=3&categories=Downtime,Upgrade&skyView=true
GET /api/v1/dashboard/live-ops?date=today|week|all&status=Open,Pending&category=Downtime
GET /api/v1/dashboard/sla-alerts?withinMins=15
```

Global view (not tied to a user). `/dashboard` → `totals`, `ticketStats`, `avgTtrMins`, `categoryMetrics`, `categoryStats`, and sky view `picWorkloads`, `activeCustomerIncidents`, `criticalSlaTickets`. Live-ops returns max 100 tickets, SLA-breached first, personal-category tickets excluded.

### Performance / points (read-only)

```http
GET /api/v1/reports/performance/12?start=2026-09-01&end=2026-09-30
GET /api/v1/reports/leaderboard?start=2026-09-01&end=2026-09-30
GET /api/v1/reports/work-hours?date=2026-09-29&departmentId=1&locationId=2
```

Same numbers as UI Poin saya, Daily Reports leaderboard, and team work-hours. Leaderboard needs both `start` and `end` or neither.

### SLA & analytics (read-only)

```http
GET /api/v1/reports/sla?startDate=2026-09-01&endDate=2026-09-30&customer=PT%20ABC
GET /api/v1/reports/service-desk?days=30
```

SLA dates are WIB (UTC+7), default last 30 days. Response like UI SLA & Analytics: `summary`, `monthSections`, `dailyTrend`, `departmentStats`, `incidents`, `letter`.

### Meta

```http
GET /api/v1/meta/users?departmentId=1
GET /api/v1/meta/job-categories
GET /api/v1/meta/queues
GET /api/v1/meta/custom-fields
```

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

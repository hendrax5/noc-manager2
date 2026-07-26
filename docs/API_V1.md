# NOC Manager Integration API v1

Server-to-server API for creating and syncing tickets.

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
| POST | `/api/v1/tickets` | `tickets:create` |
| GET | `/api/v1/tickets/{trackingId}` | `tickets:read` |
| PATCH | `/api/v1/tickets/{trackingId}` | `tickets:update` |
| POST | `/api/v1/tickets/{trackingId}/comments` | `tickets:comment` |
| GET | `/api/v1/meta/departments` | `tickets:create` or `tickets:read` |
| GET | `/api/v1/openapi` | public |
| POST | `/api/external/tickets` | legacy alias of create |

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

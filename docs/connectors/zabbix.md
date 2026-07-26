# Zabbix → NOC Ticket

Use a Zabbix media type / webhook script that POSTs to NOC when a problem is created.

## Media type / script (curl)

```bash
#!/bin/bash
# Zabbix macros: {ALERT.SUBJECT} {ALERT.MESSAGE} {EVENT.ID} {HOST.NAME} {TRIGGER.SEVERITY}

API_URL="${NOC_API_URL}/api/v1/tickets"
API_KEY="${NOC_API_KEY}"

SEVERITY="{TRIGGER.SEVERITY}"
PRIORITY="Medium"
case "$SEVERITY" in
  Disaster|High) PRIORITY="Critical" ;;
  Average) PRIORITY="High" ;;
  Warning) PRIORITY="Medium" ;;
  *) PRIORITY="Low" ;;
esac

curl -sS -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "Idempotency-Key: zabbix-{EVENT.ID}" \
  -d "{
    \"title\": \"{ALERT.SUBJECT}\",
    \"description\": \"{ALERT.MESSAGE}\",
    \"priority\": \"$PRIORITY\",
    \"ticketType\": \"Incident\",
    \"departmentCode\": \"noc-core\",
    \"externalRef\": \"zabbix:{EVENT.ID}\",
    \"enableSla\": true,
    \"customData\": {
      \"source\": \"zabbix\",
      \"eventId\": \"{EVENT.ID}\",
      \"host\": \"{HOST.NAME}\",
      \"severity\": \"{TRIGGER.SEVERITY}\"
    }
  }"
```

## JSON body template (for webhook media type)

```json
{
  "title": "{ALERT.SUBJECT}",
  "description": "{ALERT.MESSAGE}\n\nHost: {HOST.NAME}\nSeverity: {TRIGGER.SEVERITY}",
  "priority": "High",
  "ticketType": "Incident",
  "departmentCode": "noc-core",
  "externalRef": "zabbix:{EVENT.ID}",
  "enableSla": true,
  "customData": {
    "source": "zabbix",
    "eventId": "{EVENT.ID}",
    "host": "{HOST.NAME}"
  }
}
```

Map Zabbix recovery to patch (optional second media type):

```http
PATCH /api/v1/tickets/{trackingId}
{"status":"Resolved"}
```

Or look up by storing `trackingId` from create response in your orchestration, or use `externalRef` + GET after you extend lookup (v1 GET is by `trackingId` only — store the create response).

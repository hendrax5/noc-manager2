# Grafana / Alertmanager → NOC Ticket

## Grafana contact point (webhook)

Grafana Cloud / OSS contact point type **Webhook** pointing at a thin relay, or use Alertmanager webhook receiver with a small adapter.

### Direct POST adapter (Node one-liner shape)

Map Grafana alert JSON → NOC create:

```js
// docs/connectors/grafana-adapter.example.mjs
// Usage: node grafana-adapter.example.mjs   (behind a tiny HTTP server in production)

export function mapGrafanaWebhook(body, { departmentCode = "noc-core" } = {}) {
  const alerts = body.alerts || [];
  return alerts
    .filter((a) => a.status === "firing")
    .map((a) => {
      const labels = a.labels || {};
      const ann = a.annotations || {};
      const fingerprint = a.fingerprint || labels.alertname + (labels.instance || "");
      const severity = (labels.severity || labels.priority || "warning").toLowerCase();
      const priority =
        severity === "critical" ? "Critical" : severity === "error" || severity === "high" ? "High" : "Medium";

      return {
        title: ann.summary || labels.alertname || "Grafana alert",
        description: [ann.description, ann.runbook_url, JSON.stringify(labels)].filter(Boolean).join("\n\n"),
        priority,
        ticketType: "Incident",
        departmentCode,
        externalRef: `grafana:${fingerprint}`,
        enableSla: priority === "Critical" || priority === "High",
        customData: { source: "grafana", labels, fingerprint },
        idempotencyKey: `grafana:${fingerprint}`,
      };
    });
}

export async function postToNoc(ticket, { baseUrl, apiKey }) {
  const res = await fetch(`${baseUrl}/api/v1/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "Idempotency-Key": ticket.idempotencyKey || ticket.externalRef,
    },
    body: JSON.stringify(ticket),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Alertmanager receiver snippet

```yaml
receivers:
  - name: noc-manager
    webhook_configs:
      - url: "http://your-adapter:8080/grafana-to-noc"
        send_resolved: true
```

On `resolved`, adapter should `PATCH` the ticket to `Resolved` using the `trackingId` stored when the firing alert created the ticket (keyed by `externalRef` / fingerprint in your adapter DB or cache).

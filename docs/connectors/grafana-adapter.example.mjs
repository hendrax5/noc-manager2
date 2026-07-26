/**
 * Thin Grafana/Alertmanager → NOC adapter helpers.
 * Wire behind a small HTTP server that receives Grafana webhooks.
 */
export function mapGrafanaWebhook(body, { departmentCode = "noc-core" } = {}) {
  const alerts = body.alerts || [];
  return alerts
    .filter((a) => a.status === "firing")
    .map((a) => {
      const labels = a.labels || {};
      const ann = a.annotations || {};
      const fingerprint = a.fingerprint || `${labels.alertname || "alert"}:${labels.instance || ""}`;
      const severity = (labels.severity || labels.priority || "warning").toLowerCase();
      const priority =
        severity === "critical"
          ? "Critical"
          : severity === "error" || severity === "high"
            ? "High"
            : "Medium";

      return {
        title: ann.summary || labels.alertname || "Grafana alert",
        description: [ann.description, ann.runbook_url, JSON.stringify(labels)]
          .filter(Boolean)
          .join("\n\n"),
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
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/tickets`, {
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

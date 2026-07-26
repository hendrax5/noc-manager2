import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { parseScopes } from "@/lib/integration/auth";

export function signWebhookPayload(secret, bodyString) {
  return crypto.createHmac("sha256", secret || "").update(bodyString).digest("hex");
}

export async function dispatchIntegrationWebhook(event, ticket, extra = {}) {
  try {
    const apps = await prisma.integrationApp.findMany({
      where: { active: true, webhookUrl: { not: null } },
    });

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ticket: {
        id: ticket.id,
        trackingId: ticket.trackingId,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        ticketType: ticket.ticketType,
        externalRef: ticket.externalRef || null,
        departmentId: ticket.departmentId,
        assigneeId: ticket.assigneeId || null,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt || null,
      },
      ...extra,
    };
    const bodyString = JSON.stringify(payload);

    for (const app of apps) {
      const events = parseScopes(app.webhookEvents);
      if (!events.includes(event) && !events.includes("*")) continue;
      if (!app.webhookUrl) continue;

      const signature = signWebhookPayload(app.webhookSecret || app.keyHash, bodyString);
      let status = "sent";
      let reason = null;
      try {
        const res = await fetch(app.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-NOC-Event": event,
            "X-NOC-Signature": signature,
            "X-NOC-App": app.name,
          },
          body: bodyString,
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          status = "failed";
          reason = `HTTP ${res.status}`;
        }
      } catch (err) {
        status = "failed";
        reason = err.message;
      }

      await prisma.notificationLog.create({
        data: {
          ticketId: ticket.id,
          channel: "webhook",
          event,
          recipient: app.webhookUrl,
          status,
          payload: { appId: app.id, appName: app.name, reason, body: payload },
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[webhook:dispatch]", err.message);
  }
}

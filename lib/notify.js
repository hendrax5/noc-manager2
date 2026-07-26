/**
 * Outbound notifications (P0).
 * Sends email when SMTP_* env is set; otherwise logs (never throws to callers).
 */

import { getAppConfig } from "@/lib/config";

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) return { ok: false, reason: "no_recipient" };
  if (!smtpConfigured()) {
    console.info(`[notify:skip] SMTP not configured → ${to} | ${subject}`);
    return { ok: true, skipped: true, channel: "log" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
        : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html: html || `<pre>${text}</pre>`,
    });
    return { ok: true, channel: "email" };
  } catch (err) {
    console.error("[notify:email:fail]", err.message);
    return { ok: false, reason: err.message };
  }
}

async function persistLog(prisma, entry) {
  if (!prisma?.notificationLog?.create) return;
  try {
    await prisma.notificationLog.create({
      data: {
        ticketId: entry.ticketId || null,
        channel: entry.channel || "log",
        event: entry.event,
        recipient: entry.recipient || "",
        status: entry.status || "sent",
        payload: entry.payload || undefined,
      },
    });
  } catch (err) {
    console.warn("[notify:log:fail]", err.message);
  }
}

/**
 * @param {object} opts
 * @param {import('@prisma/client').PrismaClient} [opts.prisma]
 * @param {string} opts.event - created | assigned | commented | status_changed | sla_breach | escalated | csat_request
 * @param {object} [opts.ticket]
 * @param {string[]} [opts.emails]
 * @param {string} [opts.message]
 */
export async function notifyTicketEvent({ prisma, event, ticket, emails = [], message }) {
  const config = getAppConfig();
  const appName = config.appName || "NOC Manager";
  const tracking = ticket?.trackingId || ticket?.id || "";
  const subject = `[${appName}] ${event.replace(/_/g, " ")} — ${tracking}`;
  const text =
    message ||
    [
      `Event: ${event}`,
      `Ticket: ${ticket?.title || ""}`,
      `Tracking: ${tracking}`,
      `Status: ${ticket?.status || ""}`,
      `Priority: ${ticket?.priority || ""}`,
    ].join("\n");

  const unique = [...new Set(emails.filter(Boolean))];
  if (unique.length === 0) {
    console.info(`[notify:${event}] no recipients for ticket ${tracking}`);
    await persistLog(prisma, {
      ticketId: ticket?.id,
      channel: "log",
      event,
      recipient: "",
      status: "skipped",
      payload: { text },
    });
    return { ok: true, skipped: true };
  }

  const results = [];
  for (const to of unique) {
    const res = await sendEmail({ to, subject, text });
    results.push(res);
    await persistLog(prisma, {
      ticketId: ticket?.id,
      channel: res.channel || "log",
      event,
      recipient: to,
      status: res.skipped ? "skipped" : res.ok ? "sent" : "failed",
      payload: { subject, text, reason: res.reason },
    });
  }
  return { ok: true, results };
}

export async function collectTicketNotifyEmails(prisma, ticketId) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assignee: { select: { email: true } },
      watchers: { include: { user: { select: { email: true } } } },
      department: { select: { name: true } },
    },
  });
  if (!ticket) return { ticket: null, emails: [] };

  const emails = [];
  if (ticket.assignee?.email) emails.push(ticket.assignee.email);
  for (const w of ticket.watchers || []) {
    if (w.user?.email) emails.push(w.user.email);
  }

  // Notify Managers in the same department on critical events (optional fan-out)
  return { ticket, emails: [...new Set(emails)] };
}

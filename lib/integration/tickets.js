import { prisma } from "@/lib/prisma";
import { pickLeastBusyAssignee } from "@/lib/tickets/routing";
import { buildSlaDeadlines } from "@/lib/tickets/sla";
import { TICKET_TYPES, assertValidStatus, normalizeStatus } from "@/lib/tickets/status";
import { resolveDepartment } from "@/lib/integration/auth";
import { dispatchIntegrationWebhook } from "@/lib/integration/webhooks";
import { notifyTicketEvent } from "@/lib/notify";

function generateTrackingId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "HSK-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) id += "-";
  }
  return id;
}

const PRIORITIES = ["Low", "Medium", "High", "Critical"];

export function publicTicketDto(ticket) {
  return {
    id: ticket.id,
    trackingId: ticket.trackingId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    ticketType: ticket.ticketType,
    externalRef: ticket.externalRef || null,
    departmentId: ticket.departmentId,
    department: ticket.department ? { id: ticket.department.id, name: ticket.department.name } : null,
    assignee: ticket.assignee
      ? { id: ticket.assignee.id, name: ticket.assignee.name, email: ticket.assignee.email }
      : null,
    enableSla: ticket.enableSla,
    nextSlaDeadline: ticket.nextSlaDeadline,
    responseDueAt: ticket.responseDueAt,
    resolutionDueAt: ticket.resolutionDueAt,
    slaBreaches: ticket.slaBreaches,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    trackUrl: ticket.trackingId ? `/track/${encodeURIComponent(ticket.trackingId)}` : null,
    comments: (ticket.comments || [])
      .filter((c) => c.isPublic !== false)
      .map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        author: c.author?.name || "System",
      })),
  };
}

export async function createTicketFromIntegration({ body, app, idempotencyKey }) {
  const {
    title,
    description,
    priority,
    ticketType,
    departmentId,
    departmentCode,
    assigneeId,
    jobCategoryId,
    customData,
    enableSla,
    slaTimerMins,
    serviceIds,
    externalRef,
    queueId,
  } = body || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    const err = new Error("'title' is required");
    err.status = 400;
    throw err;
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    const err = new Error("'description' is required");
    err.status = 400;
    throw err;
  }

  const finalPriority = priority || "Medium";
  if (!PRIORITIES.includes(finalPriority)) {
    const err = new Error(`Invalid priority. Allowed: ${PRIORITIES.join(", ")}`);
    err.status = 400;
    throw err;
  }

  const type = TICKET_TYPES.includes(ticketType) ? ticketType : "Incident";

  // Idempotency replay
  if (app?.id && idempotencyKey) {
    const existing = await prisma.ticket.findFirst({
      where: { integrationAppId: app.id, idempotencyKey },
      include: {
        department: true,
        assignee: { select: { id: true, name: true, email: true } },
        comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 20 },
      },
    });
    if (existing) return { ticket: existing, replayed: true };
  }

  // externalRef uniqueness per app
  if (app?.id && externalRef) {
    const existingRef = await prisma.ticket.findFirst({
      where: { integrationAppId: app.id, externalRef: String(externalRef) },
      include: {
        department: true,
        assignee: { select: { id: true, name: true, email: true } },
        comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 20 },
      },
    });
    if (existingRef) return { ticket: existingRef, replayed: true };
  }

  const dept = await resolveDepartment({
    departmentId,
    departmentCode,
    fallbackId: app?.defaultDepartmentId,
  });
  if (!dept) {
    const err = new Error("'departmentId' or 'departmentCode' is required and must exist");
    err.status = 400;
    throw err;
  }

  let finalAssigneeId = assigneeId ? parseInt(assigneeId, 10) : null;
  if (finalAssigneeId) {
    const user = await prisma.user.findUnique({ where: { id: finalAssigneeId } });
    if (!user) {
      const err = new Error(`Assignee ID ${finalAssigneeId} does not exist`);
      err.status = 400;
      throw err;
    }
  } else {
    finalAssigneeId = await pickLeastBusyAssignee(prisma, {
      departmentId: dept.id,
      queueId,
    });
  }

  const sla = buildSlaDeadlines({
    priority: finalPriority,
    enableSla: !!enableSla,
    slaTimerMins,
  });

  const ticket = await prisma.ticket.create({
    data: {
      trackingId: generateTrackingId(),
      title: title.trim(),
      description: description.trim(),
      priority: finalPriority,
      ticketType: type,
      customData: customData || {},
      departmentId: dept.id,
      queueId: queueId ? parseInt(queueId, 10) : null,
      jobCategoryId: jobCategoryId ? parseInt(jobCategoryId, 10) : null,
      assigneeId: finalAssigneeId,
      status: "New",
      externalRef: externalRef ? String(externalRef) : null,
      idempotencyKey: idempotencyKey || null,
      integrationAppId: app?.id || null,
      enableSla: sla.enableSla,
      slaTimerMins: sla.slaTimerMins,
      nextSlaDeadline: sla.nextSlaDeadline,
      responseDueAt: sla.responseDueAt,
      resolutionDueAt: sla.resolutionDueAt,
      ...(serviceIds?.length
        ? { services: { connect: serviceIds.map((id) => ({ id: parseInt(id, 10) })) } }
        : {}),
      historyLogs: {
        create: {
          action: `Ticket created via Integration API (${app?.name || "legacy"})${
            finalAssigneeId ? ` & auto-assigned to ${finalAssigneeId}` : ""
          }`,
          actorId: null,
        },
      },
    },
    include: {
      department: true,
      assignee: { select: { id: true, name: true, email: true } },
      comments: { include: { author: { select: { name: true } } }, take: 0 },
    },
  });

  await notifyTicketEvent({
    prisma,
    event: "created",
    ticket,
    emails: ticket.assignee?.email ? [ticket.assignee.email] : [],
    message: `External ticket ${ticket.trackingId}: ${ticket.title}`,
  });
  await dispatchIntegrationWebhook("ticket.created", ticket);

  return { ticket, replayed: false };
}

export async function findTicketByTrackingId(trackingId) {
  return prisma.ticket.findFirst({
    where: {
      OR: [
        { trackingId },
        ...(Number.isFinite(parseInt(trackingId, 10)) ? [{ id: parseInt(trackingId, 10) }] : []),
      ],
    },
    include: {
      department: true,
      assignee: { select: { id: true, name: true, email: true } },
      comments: {
        where: { isPublic: true },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });
}

export async function patchTicketFromIntegration(ticket, body, app) {
  const data = {};
  const logs = [];

  if (body.status != null) {
    let next;
    try {
      next = assertValidStatus(body.status);
    } catch (e) {
      const err = new Error(e.message);
      err.status = 400;
      throw err;
    }
    const allowed = ["Open", "Pending", "On Hold", "Resolved", "Closed", "In Progress", "Finish"];
    if (!allowed.includes(next)) {
      const err = new Error(`Status '${next}' not allowed via API`);
      err.status = 400;
      throw err;
    }
    if (ticket.status !== next) {
      data.status = next;
      logs.push(`Status changed via API (${app?.name || "integration"}) to [ ${next} ]`);
      if (next === "Resolved" || next === "Closed") {
        data.resolvedAt = ticket.resolvedAt || new Date();
        data.nextSlaDeadline = null;
      }
    }
  }

  if (body.priority != null) {
    if (!PRIORITIES.includes(body.priority)) {
      const err = new Error("Invalid priority");
      err.status = 400;
      throw err;
    }
    data.priority = body.priority;
    logs.push(`Priority changed via API to [ ${body.priority} ]`);
  }

  if (body.customData && typeof body.customData === "object") {
    data.customData = {
      ...(typeof ticket.customData === "object" && ticket.customData ? ticket.customData : {}),
      ...body.customData,
    };
    logs.push("Custom data updated via API");
  }

  if (Object.keys(data).length === 0) {
    return ticket;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      ...data,
      ...(logs.length
        ? { historyLogs: { create: logs.map((action) => ({ action, actorId: null })) } }
        : {}),
    },
    include: {
      department: true,
      assignee: { select: { id: true, name: true, email: true } },
      comments: {
        where: { isPublic: true },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });

  if (data.status) {
    const event =
      data.status === "Resolved" || data.status === "Closed"
        ? "ticket.resolved"
        : "ticket.status_changed";
    await dispatchIntegrationWebhook(event, updated, {
      previousStatus: ticket.status,
    });
  }

  return updated;
}

export async function addCommentFromIntegration(ticket, { text, isPublic = true }, app) {
  if (!text || !String(text).trim()) {
    const err = new Error("'text' is required");
    err.status = 400;
    throw err;
  }

  // Use first Admin as system author fallback, or create anonymous via any user
  let authorId = null;
  const admin = await prisma.user.findFirst({
    where: { role: { name: "Admin" } },
    select: { id: true },
  });
  authorId = admin?.id;
  if (!authorId) {
    const any = await prisma.user.findFirst({ select: { id: true } });
    authorId = any?.id;
  }
  if (!authorId) {
    const err = new Error("No user available to attribute API comment");
    err.status = 500;
    throw err;
  }

  const comment = await prisma.comment.create({
    data: {
      text: String(text).trim(),
      ticketId: ticket.id,
      authorId,
      isPublic: isPublic !== false,
    },
    include: { author: { select: { name: true } } },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      action: `Comment added via Integration API (${app?.name || "integration"})`,
      actorId: null,
    },
  });

  await dispatchIntegrationWebhook("ticket.commented", ticket, {
    comment: { id: comment.id, text: comment.text, isPublic: comment.isPublic },
  });

  return comment;
}

export { normalizeStatus };

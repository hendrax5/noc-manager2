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

const CREATOR_HISTORY_INCLUDE = {
  historyLogs: {
    orderBy: { createdAt: "asc" },
    take: 1,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  },
  integrationApp: { select: { id: true, name: true } },
};

function resolveCreatedBy(ticket) {
  const firstLog = ticket.historyLogs?.[0];
  const actor = firstLog?.actor;
  if (actor) {
    return {
      id: actor.id,
      name: actor.name,
      email: actor.email || null,
      source: "user",
    };
  }
  if (ticket.integrationApp) {
    return {
      id: null,
      name: ticket.integrationApp.name,
      email: null,
      source: "integration",
      integrationAppId: ticket.integrationApp.id,
    };
  }
  if (firstLog?.action?.includes("Integration API")) {
    return {
      id: null,
      name: "Integration API",
      email: null,
      source: "integration",
    };
  }
  return null;
}

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
    createdBy: resolveCreatedBy(ticket),
    assignee: ticket.assignee
      ? { id: ticket.assignee.id, name: ticket.assignee.name, email: ticket.assignee.email }
      : null,
    enableSla: ticket.enableSla,
    nextSlaDeadline: ticket.nextSlaDeadline,
    responseDueAt: ticket.responseDueAt,
    resolutionDueAt: ticket.resolutionDueAt,
    firstRespondedAt: ticket.firstRespondedAt || null,
    hasHumanResponse: Boolean(ticket.firstRespondedAt),
    publicCommentCount:
      ticket._count?.comments ??
      (ticket.comments || []).filter((c) => c.isPublic !== false).length,
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

/** List item: same fields, comments omitted unless includeComments loaded them. */
export function publicTicketListItemDto(ticket) {
  const dto = publicTicketDto(ticket);
  if (!ticket.comments) {
    delete dto.comments;
  }
  return dto;
}

const USER_BRIEF = { select: { id: true, name: true, email: true } };

const FULL_SUMMARY_INCLUDE = {
  jobCategory: { select: { id: true, name: true, score: true } },
  queue: { select: { id: true, name: true } },
  services: {
    select: {
      id: true,
      name: true,
      status: true,
      customer: { select: { id: true, name: true } },
    },
  },
  _count: {
    select: { comments: { where: { isPublic: true } }, notes: true, attachments: true, watchers: true },
  },
};

const FULL_DETAIL_INCLUDE = {
  department: true,
  assignee: USER_BRIEF,
  ...FULL_SUMMARY_INCLUDE,
  integrationApp: { select: { id: true, name: true } },
  // Full log ascending: row 0 is still the creator for resolveCreatedBy().
  historyLogs: { include: { actor: USER_BRIEF }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  services: {
    include: {
      customer: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  },
  comments: {
    include: {
      author: USER_BRIEF,
      attachments: { select: { id: true, filename: true, url: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  notes: { include: { author: USER_BRIEF }, orderBy: { createdAt: "asc" } },
  attachments: {
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
  watchers: { include: { user: USER_BRIEF }, orderBy: { createdAt: "asc" } },
  meetings: { select: { id: true, title: true, status: true, scheduledAt: true } },
  actionItem: {
    select: { id: true, task: true, status: true, dueDate: true, meetingId: true, assignee: USER_BRIEF },
  },
};

function briefUser(u) {
  return u ? { id: u.id, name: u.name, email: u.email ?? null } : null;
}

function fullSummaryFields(ticket) {
  return {
    slaTimerMins: ticket.slaTimerMins,
    escalationLevel: ticket.escalationLevel,
    approvalStatus: ticket.approvalStatus,
    awardedScore: ticket.awardedScore,
    customData: ticket.customData ?? {},
    csat: ticket.csatScore != null
      ? { score: ticket.csatScore, comment: ticket.csatComment, at: ticket.csatAt }
      : null,
    jobCategory: ticket.jobCategory
      ? { id: ticket.jobCategory.id, name: ticket.jobCategory.name, score: ticket.jobCategory.score }
      : null,
    queue: ticket.queue ? { id: ticket.queue.id, name: ticket.queue.name } : null,
    services: (ticket.services || []).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      customer: s.customer ? { id: s.customer.id, name: s.customer.name } : null,
      ...(s.template ? { template: { id: s.template.id, name: s.template.name } } : {}),
      ...(s.customData !== undefined ? { customData: s.customData ?? {} } : {}),
    })),
    counts: {
      notes: ticket._count?.notes ?? 0,
      attachments: ticket._count?.attachments ?? 0,
      watchers: ticket._count?.watchers ?? 0,
    },
  };
}

/** Complete read-only ticket incl. internal comments, notes, history, watchers, attachments. */
export function fullTicketDto(ticket) {
  const base = publicTicketDto(ticket);
  return {
    ...base,
    ...fullSummaryFields(ticket),
    comments: (ticket.comments || []).map((c) => ({
      id: c.id,
      text: c.text,
      isPublic: c.isPublic,
      createdAt: c.createdAt,
      author: briefUser(c.author),
      attachments: c.attachments || [],
    })),
    notes: (ticket.notes || []).map((n) => ({
      id: n.id,
      content: n.content,
      noteType: n.noteType,
      createdAt: n.createdAt,
      author: briefUser(n.author),
    })),
    history: (ticket.historyLogs || []).map((h) => ({
      id: h.id,
      action: h.action,
      awardedScore: h.awardedScore,
      createdAt: h.createdAt,
      actor: briefUser(h.actor),
    })),
    attachments: (ticket.attachments || []).map((a) => ({
      id: a.id,
      filename: a.filename,
      url: a.url,
      commentId: a.commentId,
      createdAt: a.createdAt,
      uploadedBy: a.uploader ? { id: a.uploader.id, name: a.uploader.name } : null,
    })),
    watchers: (ticket.watchers || []).map((w) => ({ ...briefUser(w.user), since: w.createdAt })),
    meetings: ticket.meetings || [],
    actionItem: ticket.actionItem
      ? { ...ticket.actionItem, assignee: briefUser(ticket.actionItem.assignee) }
      : null,
  };
}

export async function getFullTicketForIntegration(trackingId) {
  const numericId = /^\d+$/.test(trackingId) ? parseInt(trackingId, 10) : null;
  const ticket = await prisma.ticket.findFirst({
    where: { OR: [{ trackingId }, ...(numericId ? [{ id: numericId }] : [])] },
    include: FULL_DETAIL_INCLUDE,
  });
  return ticket ? fullTicketDto(ticket) : null;
}

function parseIntFilter(value, name) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) {
    const err = new Error(`Invalid ${name}`);
    err.status = 400;
    throw err;
  }
  return n;
}

function parseIsoDate(value, name) {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Invalid ${name}; use ISO-8601 datetime`);
    err.status = 400;
    throw err;
  }
  return d;
}

/**
 * List/poll tickets for Integration API agents.
 * @param {object} query - URL search params object
 */
export async function listTicketsForIntegration(query = {}, { full = false } = {}) {
  const limitRaw = parseInt(query.limit ?? "50", 10);
  const offsetRaw = parseInt(query.offset ?? "0", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const where = {};

  if (query.status) {
    const statuses = String(query.status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => normalizeStatus(s));
    if (statuses.length === 1) where.status = statuses[0];
    else if (statuses.length > 1) where.status = { in: statuses };
  }

  const createdSince = parseIsoDate(query.createdSince, "createdSince");
  const updatedSince = parseIsoDate(query.updatedSince, "updatedSince");
  const respondedSince = parseIsoDate(query.respondedSince, "respondedSince");
  if (createdSince) where.createdAt = { ...(where.createdAt || {}), gte: createdSince };
  if (updatedSince) where.updatedAt = { ...(where.updatedAt || {}), gte: updatedSince };
  if (respondedSince) {
    where.firstRespondedAt = { ...(where.firstRespondedAt || {}), gte: respondedSince };
  }

  if (query.hasHumanResponse === "true" || query.hasHumanResponse === "1") {
    where.firstRespondedAt = { ...(where.firstRespondedAt || {}), not: null };
  } else if (query.hasHumanResponse === "false" || query.hasHumanResponse === "0") {
    where.firstRespondedAt = null;
  }

  if (query.departmentId) {
    const id = parseInt(query.departmentId, 10);
    if (!Number.isFinite(id)) {
      const err = new Error("Invalid departmentId");
      err.status = 400;
      throw err;
    }
    where.departmentId = id;
  } else if (query.departmentCode) {
    const dept = await resolveDepartment({ departmentCode: String(query.departmentCode) });
    if (!dept) {
      const err = new Error(`Unknown departmentCode: ${query.departmentCode}`);
      err.status = 400;
      throw err;
    }
    where.departmentId = dept.id;
  }

  if (query.priority) {
    const priorities = String(query.priority).split(",").map((s) => s.trim()).filter(Boolean);
    const invalid = priorities.filter((p) => !PRIORITIES.includes(p));
    if (invalid.length) {
      const err = new Error(`Invalid priority: ${invalid.join(", ")}. Allowed: ${PRIORITIES.join(", ")}`);
      err.status = 400;
      throw err;
    }
    where.priority = { in: priorities };
  }

  if (query.ticketType) {
    where.ticketType = { in: String(query.ticketType).split(",").map((s) => s.trim()).filter(Boolean) };
  }

  if (query.assigneeId === "none") {
    where.assigneeId = null;
  } else if (query.assigneeId) {
    where.assigneeId = parseIntFilter(query.assigneeId, "assigneeId");
  }
  if (query.jobCategoryId) where.jobCategoryId = parseIntFilter(query.jobCategoryId, "jobCategoryId");
  if (query.queueId) where.queueId = parseIntFilter(query.queueId, "queueId");

  if (query.slaBreached === "true" || query.slaBreached === "1") {
    where.slaBreaches = { gt: 0 };
  } else if (query.slaBreached === "false" || query.slaBreached === "0") {
    where.slaBreaches = 0;
  }

  if (query.q && String(query.q).trim()) {
    const q = String(query.q).trim().slice(0, 200);
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { trackingId: { contains: q, mode: "insensitive" } },
      { externalRef: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const includeComments =
    query.includeComments === "true" || query.includeComments === "1";

  const include = {
    department: true,
    assignee: { select: { id: true, name: true, email: true } },
    _count: { select: { comments: { where: { isPublic: true } } } },
    ...CREATOR_HISTORY_INCLUDE,
    ...(full ? FULL_SUMMARY_INCLUDE : {}),
  };
  if (includeComments) {
    include.comments = {
      where: { isPublic: true },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    };
  }

  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      include,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    tickets: tickets.map((t) =>
      full ? { ...publicTicketListItemDto(t), ...fullSummaryFields(t) } : publicTicketListItemDto(t)
    ),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + tickets.length < total,
    },
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
        ...CREATOR_HISTORY_INCLUDE,
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
        ...CREATOR_HISTORY_INCLUDE,
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
      ...CREATOR_HISTORY_INCLUDE,
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
      ...CREATOR_HISTORY_INCLUDE,
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
      ...CREATOR_HISTORY_INCLUDE,
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { buildSlaDeadlines } from "@/lib/tickets/sla";
import { pickLeastBusyAssignee } from "@/lib/tickets/routing";
import { notifyTicketEvent } from "@/lib/notify";
import { TICKET_TYPES, TICKET_PRIORITIES, assertValidStatus } from "@/lib/tickets/status";
import { normalizeDowntimeCustomData } from "@/lib/tickets/downtime";
import { createTicketPointsLog } from "@/lib/tickets/points";

function generateTrackingId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "HSK-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) id += "-";
  }
  return id;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isCS =
      session.user.department?.includes("CS") ||
      session.user.department?.toLowerCase().includes("customer");
    const canCreate =
      session.user.role === "Admin" ||
      isCS ||
      session.user.permissions?.includes("create_tickets") ||
      session.user.permissions?.includes("manage_tickets");

    if (!canCreate) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to create tickets." },
        { status: 403 }
      );
    }

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const {
      title,
      description,
      priority,
      departmentId,
      assigneeId,
      jobCategoryId,
      customData,
      attachmentUrl,
      attachmentName,
      enableSla,
      slaTimerMins,
      serviceIds,
      ticketType,
      queueId,
      approvalRequired,
    } = body;

    if (priority !== undefined && !TICKET_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        {
          error: `Invalid priority: "${priority}". Allowed values: ${TICKET_PRIORITIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    let finalAssigneeId = assigneeId ? parseInt(assigneeId) : null;

    if (!finalAssigneeId && (departmentId || queueId)) {
      finalAssigneeId = await pickLeastBusyAssignee(prisma, {
        departmentId,
        queueId,
      });
    }

    const sla = buildSlaDeadlines({
      priority: priority || "Medium",
      enableSla: !!enableSla,
      slaTimerMins,
    });

    const type = TICKET_TYPES.includes(ticketType) ? ticketType : "Incident";
    const needsApproval = approvalRequired || type === "Change";

    const downtimeNorm = normalizeDowntimeCustomData(customData || {});
    if (!downtimeNorm.ok) {
      return NextResponse.json({ error: downtimeNorm.error }, { status: 400 });
    }

    let ticketData = {
      trackingId: generateTrackingId(),
      title,
      description,
      priority: priority || "Medium",
      ticketType: type,
      customData: downtimeNorm.customData,
      departmentId: parseInt(departmentId),
      queueId: queueId ? parseInt(queueId) : null,
      jobCategoryId: jobCategoryId ? parseInt(jobCategoryId) : null,
      assigneeId: finalAssigneeId,
      status: assertValidStatus("New"),
      approvalStatus: needsApproval ? "Pending" : null,
      enableSla: sla.enableSla,
      slaTimerMins: sla.slaTimerMins,
      nextSlaDeadline: sla.nextSlaDeadline,
      responseDueAt: sla.responseDueAt,
      resolutionDueAt: sla.resolutionDueAt,
      historyLogs: {
        create: createTicketPointsLog({
          actorId: userId,
          detail:
            (finalAssigneeId ? ` & auto-assigned to ID ${finalAssigneeId}` : "") +
            (queueId ? ` via queue ${queueId}` : ""),
        }),
      },
    };

    if (serviceIds && serviceIds.length > 0) {
      ticketData.services = {
        connect: serviceIds.map((id) => ({ id: parseInt(id) })),
      };
    }

    if (attachmentUrl && userId) {
      ticketData.attachments = {
        create: {
          filename: attachmentName || "attachment",
          url: attachmentUrl,
          uploadedBy: userId,
        },
      };
    }

    if (userId) {
      ticketData.watchers = {
        create: { userId },
      };
    }

    const ticket = await prisma.ticket.create({
      data: ticketData,
      include: {
        assignee: { select: { email: true, name: true } },
        watchers: { include: { user: { select: { email: true } } } },
      },
    });

    const emails = [];
    if (ticket.assignee?.email) emails.push(ticket.assignee.email);
    for (const w of ticket.watchers || []) {
      if (w.user?.email) emails.push(w.user.email);
    }

    await notifyTicketEvent({
      prisma,
      event: "created",
      ticket,
      emails,
      message: `New ${ticket.ticketType} ticket ${ticket.trackingId}: ${ticket.title}`,
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

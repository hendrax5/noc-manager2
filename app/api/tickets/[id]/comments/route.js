import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { normalizeStatus, isTerminalStatus } from "@/lib/tickets/status";
import { refreshFollowUpDeadline } from "@/lib/tickets/sla";
import { pickLeastBusyAssignee } from "@/lib/tickets/routing";
import { notifyTicketEvent, collectTicketNotifyEmails } from "@/lib/notify";
import { dispatchIntegrationWebhook } from "@/lib/integration/webhooks";
import { replyPointsLog } from "@/lib/tickets/points";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { text, attachmentUrl, attachmentName, replyCustomData, isPublic } = body;
    const userId = parseInt(session.user.id);

    const commentData = {
      text,
      ticketId,
      authorId: userId,
      isPublic: isPublic === false ? false : true,
    };

    if (attachmentUrl) {
      commentData.attachments = {
        create: {
          filename: attachmentName || "attached_file",
          url: attachmentUrl,
          uploadedBy: userId,
        },
      };
    }

    const comment = await prisma.comment.create({ data: commentData });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        trackingId: true,
        title: true,
        assigneeId: true,
        status: true,
        departmentId: true,
        department: true,
        customData: true,
        enableSla: true,
        slaTimerMins: true,
        priority: true,
        firstRespondedAt: true,
      },
    });

    let newStatus = normalizeStatus(ticket.status);
    let transitionReason = commentData.isPublic
      ? "Public reply appended to thread"
      : "Internal reply appended to thread";
    let newAssigneeId = ticket.assigneeId;
    let resetJobCategory = false;

    if (!isTerminalStatus(ticket.status)) {
      if (body.actionType === "finish") {
        newStatus = "Finish";
        transitionReason = "Marked as Finish, awaiting CS validation";
      } else if (commentData.isPublic) {
        const isStaffReply =
          userId === ticket.assigneeId ||
          session.user.role === "Admin" ||
          session.user.role === "Manager" ||
          session.user.permissions?.includes("manage_tickets") ||
          session.user.permissions?.includes("change_ticket_status") ||
          session.user.permissions?.includes("view_all_tickets") ||
          session.user.department?.includes("CS") ||
          session.user.department?.toLowerCase().includes("customer");
        if (isStaffReply) {
          newStatus = "Pending";
          transitionReason = "Auto-shifted to Pending (awaiting user)";
        } else {
          newStatus = "Open";
          transitionReason = "Auto-shifted to Open (awaiting staff)";

          const prev = normalizeStatus(ticket.status);
          if (prev === "Pending" || prev === "Finish") {
            const bestAssignee = await pickLeastBusyAssignee(prisma, {
              departmentId: ticket.departmentId,
            });
            if (bestAssignee && bestAssignee !== ticket.assigneeId) {
              newAssigneeId = bestAssignee;
              transitionReason = `Auto-shifted to Open & re-routed to Tech ID ${bestAssignee}`;
            }
          }
        }
      }
    } else if (normalizeStatus(ticket.status) === "Resolved") {
      newStatus = "Open";
      transitionReason = "Ticket reactivated from Resolved to Open";
      resetJobCategory = true;
    }

    let nextSlaDeadlineUpdate = undefined;
    let enableSlaUpdate = undefined;
    let slaMinsUpdate = undefined;
    let firstRespondedAtUpdate = undefined;

    if (!ticket.firstRespondedAt) {
      firstRespondedAtUpdate = new Date();
    }

    if (body.replyEnableSla !== undefined) {
      enableSlaUpdate = body.replyEnableSla;
      if (body.replyEnableSla && body.replySlaMins) {
        nextSlaDeadlineUpdate = refreshFollowUpDeadline({
          priority: ticket.priority,
          slaTimerMins: body.replySlaMins,
        });
        slaMinsUpdate = body.replySlaMins;
      } else if (!body.replyEnableSla) {
        nextSlaDeadlineUpdate = null;
      }
    } else if (ticket.enableSla && ticket.slaTimerMins) {
      nextSlaDeadlineUpdate = refreshFollowUpDeadline({
        priority: ticket.priority,
        slaTimerMins: ticket.slaTimerMins,
      });
    }

    let ticketUpdateData = {};
    if (
      newStatus !== normalizeStatus(ticket.status) ||
      newAssigneeId !== ticket.assigneeId ||
      resetJobCategory ||
      nextSlaDeadlineUpdate !== undefined ||
      enableSlaUpdate !== undefined ||
      firstRespondedAtUpdate
    ) {
      ticketUpdateData = {
        status: newStatus,
        assigneeId: newAssigneeId,
        ...(resetJobCategory && { jobCategoryId: null }),
        ...(nextSlaDeadlineUpdate !== undefined && { nextSlaDeadline: nextSlaDeadlineUpdate }),
        ...(enableSlaUpdate !== undefined && { enableSla: enableSlaUpdate }),
        ...(slaMinsUpdate !== undefined && { slaTimerMins: slaMinsUpdate }),
        ...(firstRespondedAtUpdate && { firstRespondedAt: firstRespondedAtUpdate }),
      };
    }

    let mergedCustomData =
      typeof ticket.customData === "object" && ticket.customData !== null
        ? { ...ticket.customData }
        : {};
    let customDataChanged = false;

    if (normalizeStatus(ticket.status) === "Resolved" && newStatus !== "Resolved") {
      mergedCustomData.reopenedAt = new Date().toISOString();
      customDataChanged = true;
    }

    if (replyCustomData && Object.keys(replyCustomData).length > 0) {
      Object.assign(mergedCustomData, replyCustomData);
      customDataChanged = true;
    }

    if (customDataChanged) {
      ticketUpdateData.customData = mergedCustomData;
    }

    if (Object.keys(ticketUpdateData).length > 0) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: ticketUpdateData,
      });
      if (replyCustomData && Object.keys(replyCustomData).length > 0) {
        await prisma.ticketHistory.create({
          data: {
            ticketId,
            action: `Parameters updated via reply [${Object.keys(replyCustomData).join(", ")}]`,
            actorId: userId,
          },
        });
      }
    }

    await prisma.ticketHistory.createMany({
      data: [
        { ticketId, action: transitionReason, actorId: userId },
        { ticketId, ...replyPointsLog({ actorId: userId, isPublic: commentData.isPublic }) },
      ],
    });

    if (commentData.isPublic) {
      const { emails, ticket: full } = await collectTicketNotifyEmails(prisma, ticketId);
      await notifyTicketEvent({
        prisma,
        event: "commented",
        ticket: full || ticket,
        emails: emails.filter((e) => e !== session.user.email),
        message: `New reply on ${ticket.trackingId}: ${text?.slice(0, 200) || ""}`,
      });
      await dispatchIntegrationWebhook("ticket.commented", full || ticket, {
        comment: { id: comment.id, text: comment.text, isPublic: comment.isPublic },
      });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

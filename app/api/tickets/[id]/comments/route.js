import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { text, attachmentUrl, attachmentName, replyCustomData } = body;
    const userId = parseInt(session.user.id);

    const commentData = {
      text,
      ticketId,
      authorId: userId,
    };

    if (attachmentUrl) {
      commentData.attachments = {
        create: { filename: attachmentName || "attached_file", url: attachmentUrl, uploadedBy: userId }
      };
    }

    const comment = await prisma.comment.create({ data: commentData });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { assigneeId: true, status: true, department: true, customData: true, enableSla: true, slaTimerMins: true } });
    
    let newStatus = ticket.status;
    let transitionReason = "Reply appended to thread";
    let newAssigneeId = ticket.assigneeId;
    let resetJobCategory = false;

    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      if (body.actionType === 'finish') {
        newStatus = 'Finish';
        transitionReason = "Marked as Finished, awaiting CS validation";
      } else {
        const isStaffReply = (userId === ticket.assigneeId) || session.user.role === 'Admin' || session.user.permissions?.includes('manage_tickets') || session.user.permissions?.includes('change_ticket_status') || session.user.permissions?.includes('view_all_tickets') || session.user.department?.includes('CS') || session.user.department?.toLowerCase().includes('customer');
        if (isStaffReply) {
          newStatus = 'Replied';
          transitionReason = "Auto-shifted to Replied (Awaiting User)";
        } else {
          newStatus = 'Waiting Reply';
          transitionReason = "Auto-shifted to Waiting Reply (Awaiting Staff)";
          
          // Re-route Round Robin if the ticket was previously dormant (Replied)
          if (ticket.status === 'Replied' || ticket.status === 'Finish') {
            const deptUsers = await prisma.user.findMany({ 
              where: { departmentId: ticket.departmentId, role: { name: { not: 'Admin' } } }, 
              select: { id: true } 
            });
            
            if (deptUsers.length > 0) {
              const activeTicketsCount = await prisma.ticket.groupBy({
                by: ['assigneeId'],
                where: { assigneeId: { in: deptUsers.map(u => u.id) }, status: { notIn: ['Resolved', 'Closed'] } },
                _count: { id: true }
              });
              
              const loadMap = {};
              deptUsers.forEach(u => loadMap[u.id] = 0);
              activeTicketsCount.forEach(l => { if (l.assigneeId) loadMap[l.assigneeId] = l._count.id; });
              
              let minLoad = Infinity;
              let bestAssignee = null;
              for (const [uid, count] of Object.entries(loadMap)) {
                if (count < minLoad) {
                  minLoad = count;
                  bestAssignee = parseInt(uid);
                }
              }
              if (bestAssignee && bestAssignee !== ticket.assigneeId) {
                newAssigneeId = bestAssignee;
                transitionReason = `Auto-shifted to Open & Re-routed via Round-Robin to Tech ID ${bestAssignee}`;
              }
            }
          }
        }
      }
    } else if (ticket.status === 'Resolved') {
      // Revival Logic: Ticket was Resolved, but someone replied to it
      newStatus = 'Open';
      transitionReason = "Ticket Reactivated from Resolved to Open";
      resetJobCategory = true; // Force operators to select the next Job Phase explicitly
    }

    let nextSlaDeadlineUpdate = undefined;
    let enableSlaUpdate = undefined;
    let slaMinsUpdate = undefined;

    if (body.replyEnableSla !== undefined) {
      enableSlaUpdate = body.replyEnableSla;
      if (body.replyEnableSla && body.replySlaMins) {
         nextSlaDeadlineUpdate = new Date(Date.now() + body.replySlaMins * 60000);
         slaMinsUpdate = body.replySlaMins;
      } else if (!body.replyEnableSla) {
         nextSlaDeadlineUpdate = null; // Turn off tracker completely
      }
    } else {
      // Original logic fallback if UI does not send the parameter
      if (ticket.enableSla && ticket.slaTimerMins) {
         nextSlaDeadlineUpdate = new Date(Date.now() + ticket.slaTimerMins * 60000);
      }
    }

    let ticketUpdateData = {};
    if (newStatus !== ticket.status || newAssigneeId !== ticket.assigneeId || resetJobCategory || nextSlaDeadlineUpdate !== undefined || enableSlaUpdate !== undefined) {
      ticketUpdateData = {
        status: newStatus,
        assigneeId: newAssigneeId,
        ...(resetJobCategory && { jobCategoryId: null }),
        ...(nextSlaDeadlineUpdate !== undefined && { nextSlaDeadline: nextSlaDeadlineUpdate }),
        ...(enableSlaUpdate !== undefined && { enableSla: enableSlaUpdate }),
        ...(slaMinsUpdate !== undefined && { slaTimerMins: slaMinsUpdate })
      };
    }

    let mergedCustomData = typeof ticket.customData === 'object' && ticket.customData !== null ? { ...ticket.customData } : {};
    let customDataChanged = false;

    if (ticket.status === 'Resolved' && newStatus !== 'Resolved') {
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
        data: ticketUpdateData
      });
      if (replyCustomData && Object.keys(replyCustomData).length > 0) {
        await prisma.ticketHistory.create({
          data: { ticketId, action: `Parameters augmented via Reply [Toggled Fields: ${Object.keys(replyCustomData).join(', ')}]`, actorId: userId }
        });
      }
    }

    await prisma.ticketHistory.create({
      data: { ticketId, action: transitionReason, actorId: userId }
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

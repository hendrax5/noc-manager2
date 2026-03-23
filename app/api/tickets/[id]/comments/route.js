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

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { assigneeId: true, status: true, department: true, customData: true } });
    
    let newStatus = ticket.status;
    let transitionReason = "Reply appended to thread";
    let newAssigneeId = ticket.assigneeId;
    let resetJobCategory = false;

    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      if (body.actionType === 'finish') {
        newStatus = 'Pending CS Confirmation';
        transitionReason = "Marked as Finished, awaiting CS validation";
      } else {
        const isStaffReply = (userId === ticket.assigneeId) || session.user.role === 'Admin' || session.user.role === 'Manager' || session.user.department?.includes('CS');
        if (isStaffReply) {
          newStatus = 'Pending';
          transitionReason = "Auto-shifted to Pending (Awaiting User)";
        } else {
          newStatus = 'Open';
          transitionReason = "Auto-shifted to Open (Awaiting Staff)";
          
          // Re-route Round Robin if the ticket was previously dormant (Pending)
          if (ticket.status === 'Pending' || ticket.status === 'Pending CS Confirmation') {
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

    if (newStatus !== ticket.status || newAssigneeId !== ticket.assigneeId || resetJobCategory) {
      await prisma.ticket.update({ 
        where: { id: ticketId }, 
        data: { 
          status: newStatus, 
          assigneeId: newAssigneeId,
          ...(resetJobCategory && { jobCategoryId: null })
        } 
      });
    }

    if (replyCustomData && Object.keys(replyCustomData).length > 0) {
      await prisma.ticket.update({ 
        where: { id: ticketId }, 
        data: { customData: { ...(typeof ticket.customData === 'object' && ticket.customData !== null ? ticket.customData : {}), ...replyCustomData } }
      });
      await prisma.ticketHistory.create({
        data: { ticketId, action: `Parameters augmented via Reply [Toggled Fields: ${Object.keys(replyCustomData).join(', ')}]`, actorId: userId }
      });
    }

    await prisma.ticketHistory.create({
      data: { ticketId, action: transitionReason, actorId: userId }
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

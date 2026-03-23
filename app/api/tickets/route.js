import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

function generateTrackingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'HSK-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) id += '-';
  }
  return id;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    const body = await req.json();
    const { title, description, priority, departmentId, assigneeId, jobCategoryId, customData, attachmentUrl, attachmentName, enableSla, slaTimerMins } = body;
        
    // Auto assignment routing logic (Least Busy Round-Robin)
    let finalAssigneeId = assigneeId ? parseInt(assigneeId) : null;

    if (!finalAssigneeId && departmentId) {
      const deptUsers = await prisma.user.findMany({ 
        where: { departmentId: parseInt(departmentId), role: { name: { not: 'Admin' } } }, 
        select: { id: true } 
      });
      if (deptUsers.length > 0) {
        const activeTicketsCount = await prisma.ticket.groupBy({
          by: ['assigneeId'],
          where: { assigneeId: { in: deptUsers.map(u => u.id) }, status: { not: 'Resolved' } },
          _count: { id: true }
        });
        
        const loadMap = {};
        deptUsers.forEach(u => loadMap[u.id] = 0);
        activeTicketsCount.forEach(l => { if (l.assigneeId) loadMap[l.assigneeId] = l._count.id; });
        
        let minLoad = Infinity;
        for (const [uid, count] of Object.entries(loadMap)) {
          if (count < minLoad) {
            minLoad = count;
            finalAssigneeId = parseInt(uid);
          }
        }
      }
    }

    let ticketData = {
      trackingId: generateTrackingId(),
      title,
      description,
      priority,
      customData: customData || {},
      departmentId: parseInt(departmentId),
      jobCategoryId: jobCategoryId ? parseInt(jobCategoryId) : null,
      assigneeId: finalAssigneeId,
      status: "New",
      enableSla: enableSla ? true : false,
      slaTimerMins: slaTimerMins ? parseInt(slaTimerMins) : 15,
      nextSlaDeadline: enableSla ? new Date(Date.now() + (slaTimerMins ? parseInt(slaTimerMins) : 15) * 60000) : null,
      historyLogs: {
        create: { action: "Ticket systemically instantiated" + (finalAssigneeId ? ` & auto-assigned to ID ${finalAssigneeId}` : ''), actorId: userId }
      }
    };

    // Safely nest attachments onto relational write block
    if (attachmentUrl && userId) {
      ticketData.attachments = {
        create: { filename: attachmentName || "attachment", url: attachmentUrl, uploadedBy: userId }
      };
    }

    const ticket = await prisma.ticket.create({ data: ticketData });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

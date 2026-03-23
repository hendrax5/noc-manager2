import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? parseInt(session.user.id) : null;
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();
    
    // Evaluate exact permutations requiring audit snapshots
    const oldTicket = await prisma.ticket.findUnique({ where: { id } });
    
    let logs = [];
    if (oldTicket.status !== body.status) logs.push({ action: `Status changed to [ ${body.status} ]`, actorId: userId });
    if (oldTicket.priority !== body.priority) logs.push({ action: `Priority elevated to [ ${body.priority} ]`, actorId: userId });
    if (oldTicket.departmentId != body.departmentId && body.departmentId) logs.push({ action: `Department transfer initiated`, actorId: userId });
    if (oldTicket.assigneeId != body.assigneeId && body.assigneeId) logs.push({ action: `Assignee rotation enacted`, actorId: userId });

    const ticketData = {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      departmentId: parseInt(body.departmentId),
      assigneeId: body.assigneeId ? parseInt(body.assigneeId) : null
    };

    if (body.status === 'Resolved') {
      const explicitCategoryId = body.jobCategoryId ? parseInt(body.jobCategoryId) : oldTicket.jobCategoryId;
      if (explicitCategoryId) {
        ticketData.jobCategoryId = explicitCategoryId;
        const cat = await prisma.jobCategory.findUnique({ where: { id: ticketData.jobCategoryId } });
        if (cat) ticketData.awardedScore = cat.score;
      }
      
      // Auto-resolve ActionItem if transitioned to Resolved
      if (oldTicket.status !== 'Resolved') {
        const actionItem = await prisma.actionItem.findUnique({ where: { linkedTicketId: id } });
        if (actionItem && actionItem.status !== 'Completed') {
          await prisma.actionItem.update({
            where: { id: actionItem.id },
            data: { status: 'Completed' }
          });
          logs.push({ action: `Systemic Trigger: Meeting Action Item automatically completed`, actorId: userId });
        }
      }

    } else if (body.status !== 'Resolved') {
      ticketData.awardedScore = null;
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...ticketData,
        ...(logs.length > 0 ? { historyLogs: { create: logs } } : {})
      }
    });
    
    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Manager')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    
    // Purge cascades gracefully
    await prisma.comment.deleteMany({ where: { ticketId: id } });
    await prisma.attachment.deleteMany({ where: { ticketId: id } });
    await prisma.ticketHistory.deleteMany({ where: { ticketId: id } });
    await prisma.ticket.delete({ where: { id } });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

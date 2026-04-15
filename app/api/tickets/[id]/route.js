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
    const userDept = session?.user?.department || "";
    const isAdministrasi = userDept.toLowerCase() === 'administrasi' || userDept.toLowerCase().includes('admin');
    const oldTicket = await prisma.ticket.findUnique({ where: { id } });
    
    // Prevent same-day Re-Opens from Resolved state
    if (oldTicket.status === 'Resolved' && body.status && body.status !== 'Resolved') {
      if (oldTicket.resolvedAt) {
        const dateResolved = new Date(oldTicket.resolvedAt);
        const dateNow = new Date();
        const isSameDay = dateResolved.getFullYear() === dateNow.getFullYear() &&
                          dateResolved.getMonth() === dateNow.getMonth() &&
                          dateResolved.getDate() === dateNow.getDate();
                          
        if (isSameDay) {
          return NextResponse.json({ error: "Cannot Re-Open or Modify a Ticket that was designated 'Resolved' on the exact same chronological Date. Please execute Upgrades the following day, or create a New Ticket." }, { status: 400 });
        }
      }
    }

    let logs = [];
    if (oldTicket.status !== body.status) logs.push({ action: `Status changed to [ ${body.status} ]`, actorId: userId });
    if (oldTicket.priority !== body.priority) logs.push({ action: `Priority elevated to [ ${body.priority} ]`, actorId: userId });
    if (oldTicket.departmentId != body.departmentId && body.departmentId) logs.push({ action: `Department transfer initiated`, actorId: userId });
    if (oldTicket.assigneeId != body.assigneeId && body.assigneeId) logs.push({ action: `Assignee rotation enacted`, actorId: userId });
    
    // Evaluate Due Date / Trial modifications
    if (body.customData && JSON.stringify(oldTicket.customData) !== JSON.stringify(body.customData)) {
      logs.push({ action: `Custom Fields / Operational Parameters updated`, actorId: userId });
    }

    const ticketData = {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      departmentId: parseInt(body.departmentId),
      assigneeId: body.assigneeId ? parseInt(body.assigneeId) : null,
      jobCategoryId: body.jobCategoryId ? parseInt(body.jobCategoryId) : oldTicket.jobCategoryId,
      ...(body.customData && { customData: body.customData })
    };

    if (body.rfs !== undefined) {
      const newRfs = body.rfs ? new Date(body.rfs) : null;
      const oldRfsStr = oldTicket.rfs ? new Date(oldTicket.rfs).toISOString() : null;
      const newRfsStr = newRfs ? newRfs.toISOString() : null;
      
      if (oldRfsStr !== newRfsStr) {
        if (!isAdministrasi) return NextResponse.json({ error: "Only Administrasi can modify RFS targets." }, { status: 403 });
        logs.push({ action: `RFS Target Deadline shifted to [ ${newRfs ? newRfs.toLocaleString('en-CA') : 'Cleared'} ]`, actorId: userId });
        ticketData.rfs = newRfs;
      }
    }

    if (body.status === 'Resolved') {
      const explicitCategoryId = body.jobCategoryId ? parseInt(body.jobCategoryId) : oldTicket.jobCategoryId;
      if (explicitCategoryId && oldTicket.status !== 'Resolved') {
        ticketData.jobCategoryId = explicitCategoryId;
        const cat = await prisma.jobCategory.findUnique({ where: { id: ticketData.jobCategoryId } });
        if (cat) {
          const recipientId = ticketData.assigneeId || oldTicket.assigneeId;
          if (recipientId && !logs.some(l => l.awardedScore)) {
            // Drop absolute Ledger Point assignment natively targeting the Technician
            logs.push({ 
              action: `Ticket Resolved: [+${cat.score} Pts] for [${cat.name}] automatically locked.`, 
              actorId: recipientId, 
              jobCategoryId: cat.id, 
              awardedScore: cat.score 
            });
          }
        }
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
      
      ticketData.resolvedAt = oldTicket.resolvedAt || new Date();
      ticketData.nextSlaDeadline = null; // Stops SLA Pings forever

    } else if (body.status !== 'Resolved') {
      ticketData.awardedScore = null;
      ticketData.resolvedAt = null;
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
    if (!session || !session.user?.permissions?.includes('ticket.delete')) {
      return NextResponse.json({ error: "Insufficient permissions to void/delete tickets." }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    
    // Per NOC Blueprint: Soft Deletes (Penghapusan Semu) for Tickets
    await prisma.ticket.update({
      where: { id },
      data: {
        status: 'Cancelled',
        deletedAt: new Date(),
        historyLogs: {
          create: [{ action: "Ticket Voided (Soft Deleted) manually by Administrasi", actorId: parseInt(session.user.id) }]
        }
      }
    });

    return NextResponse.json({ message: "Voided" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.id ? parseInt(session.user.id) : null;
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();
    
    const ALL_STATUSES = ['New', 'Open', 'Waiting Reply', 'Replied', 'In Progress', 'On Hold', 'Finish', 'Resolved', 'Closed'];
    const ALL_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

    if (body.status !== undefined && !ALL_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: "${body.status}". Allowed values: ${ALL_STATUSES.join(', ')}` }, { status: 400 });
    }

    if (body.priority !== undefined && !ALL_PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: `Invalid priority: "${body.priority}". Allowed values: ${ALL_PRIORITIES.join(', ')}` }, { status: 400 });
    }
    
    // Evaluate exact permutations requiring audit snapshots
    const oldTicket = await prisma.ticket.findUnique({ where: { id } });
    if (!oldTicket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const isCS = session.user.department?.includes('CS') || session.user.department?.toLowerCase().includes('customer');
    const isAuthorized = session.user.role === 'Admin' || isCS || session.user.permissions?.includes('manage_tickets');

    // Check granular permissions for specific modifications
    // 1. Changing status / priority
    if ((body.status !== undefined && oldTicket.status !== body.status) || (body.priority !== undefined && oldTicket.priority !== body.priority)) {
      const canChangeStatus = isAuthorized || session.user.permissions?.includes('change_ticket_status') || session.user.permissions?.includes('modify_tickets');
      if (!canChangeStatus) {
        return NextResponse.json({ error: "Forbidden: You do not have permission to change ticket status or priority." }, { status: 403 });
      }
    }

    // 2. Assignee / Department changes
    if ((body.assigneeId !== undefined && oldTicket.assigneeId !== (body.assigneeId ? parseInt(body.assigneeId) : null)) || 
        (body.departmentId !== undefined && oldTicket.departmentId !== parseInt(body.departmentId))) {
      const canAssign = isAuthorized || session.user.permissions?.includes('assign_tickets') || session.user.permissions?.includes('modify_tickets');
      if (!canAssign) {
        return NextResponse.json({ error: "Forbidden: You do not have permission to assign this ticket." }, { status: 403 });
      }
    }

    // 3. Job category changes
    if (body.jobCategoryId !== undefined && oldTicket.jobCategoryId !== (body.jobCategoryId ? parseInt(body.jobCategoryId) : null)) {
      const canChangeJobCategory = isAuthorized || session.user.permissions?.includes('change_job_category') || session.user.permissions?.includes('modify_tickets');
      if (!canChangeJobCategory) {
        return NextResponse.json({ error: "Forbidden: You do not have permission to change the ticket's job category." }, { status: 403 });
      }
    }

    // 4. Title / Description edits
    if ((body.title !== undefined && oldTicket.title !== body.title) || (body.description !== undefined && oldTicket.description !== body.description)) {
      const firstLog = await prisma.ticketHistory.findFirst({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' }
      });
      const isCreator = !firstLog || firstLog.actorId === userId;
      const hasEditOwn = session.user.permissions?.includes('edit_own_tickets');
      const hasEditOther = session.user.permissions?.includes('edit_other_tickets');
      const canEditGeneral = isAuthorized || 
                             session.user.permissions?.includes('modify_tickets') ||
                             (isCreator && hasEditOwn) ||
                             (!isCreator && hasEditOther);
      if (!canEditGeneral) {
        return NextResponse.json({ error: "Forbidden: You do not have permission to edit ticket details." }, { status: 403 });
      }
    }

    // 5. SLA edits
    if ((body.enableSla !== undefined && oldTicket.enableSla !== body.enableSla) || 
        (body.slaTimerMins !== undefined && oldTicket.slaTimerMins !== parseInt(body.slaTimerMins))) {
      const canManageSla = isAuthorized || session.user.permissions?.includes('manage_sla') || session.user.permissions?.includes('manage_tickets');
      if (!canManageSla) {
        return NextResponse.json({ error: "Forbidden: You do not have permission to modify SLA configurations." }, { status: 403 });
      }
    }
    
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
    if (body.status !== undefined && oldTicket.status !== body.status) logs.push({ action: `Status changed to [ ${body.status} ]`, actorId: userId });
    if (body.priority !== undefined && oldTicket.priority !== body.priority) logs.push({ action: `Priority elevated to [ ${body.priority} ]`, actorId: userId });
    if (body.departmentId !== undefined && oldTicket.departmentId != body.departmentId) logs.push({ action: `Department transfer initiated`, actorId: userId });
    if (body.assigneeId !== undefined && oldTicket.assigneeId != body.assigneeId) logs.push({ action: `Assignee rotation enacted`, actorId: userId });
    
    // Evaluate Due Date / Trial modifications
    if (body.customData && JSON.stringify(oldTicket.customData) !== JSON.stringify(body.customData)) {
      const oldCust = oldTicket.customData && typeof oldTicket.customData === 'object' ? oldTicket.customData["Customer Name"] : undefined;
      const newCust = body.customData && typeof body.customData === 'object' ? body.customData["Customer Name"] : undefined;
      if (oldCust !== newCust && !isAuthorized) {
        return NextResponse.json({ error: "Forbidden: You do not have permission to modify the Customer Name." }, { status: 403 });
      }
      logs.push({ action: `Custom Fields / Operational Parameters updated`, actorId: userId });
    }

    if (body.enableSla !== undefined && oldTicket.enableSla !== body.enableSla) {
      logs.push({ action: body.enableSla ? `SLA Timer Activated (${body.slaTimerMins || oldTicket.slaTimerMins || 15}m)` : `SLA Timer Deactivated`, actorId: userId });
    } else if (body.slaTimerMins !== undefined && oldTicket.slaTimerMins !== parseInt(body.slaTimerMins) && (body.enableSla || oldTicket.enableSla)) {
      logs.push({ action: `SLA Timer duration changed to ${body.slaTimerMins}m`, actorId: userId });
    }

    let finalCustomData = body.customData !== undefined 
      ? body.customData 
      : (oldTicket.customData && typeof oldTicket.customData === 'object' ? { ...oldTicket.customData } : {});

    if (body.status !== undefined && body.status !== 'Resolved' && oldTicket.status === 'Resolved') {
      finalCustomData = {
        ...(finalCustomData && typeof finalCustomData === 'object' ? finalCustomData : {}),
        reopenedAt: new Date().toISOString()
      };
    }

    const ticketData = {
      title: body.title !== undefined ? body.title : oldTicket.title,
      description: body.description !== undefined ? body.description : oldTicket.description,
      status: body.status !== undefined ? body.status : oldTicket.status,
      priority: body.priority !== undefined ? body.priority : oldTicket.priority,
      departmentId: body.departmentId !== undefined ? parseInt(body.departmentId) : oldTicket.departmentId,
      assigneeId: body.assigneeId !== undefined ? (body.assigneeId ? parseInt(body.assigneeId) : null) : oldTicket.assigneeId,
      jobCategoryId: body.jobCategoryId !== undefined ? (body.jobCategoryId ? parseInt(body.jobCategoryId) : null) : oldTicket.jobCategoryId,
      ...(finalCustomData !== undefined && { customData: finalCustomData }),
      ...(body.enableSla !== undefined && { enableSla: body.enableSla }),
      ...(body.slaTimerMins !== undefined && { slaTimerMins: parseInt(body.slaTimerMins) })
    };

    if (body.enableSla !== undefined) {
      if (body.enableSla) {
        const mins = body.slaTimerMins ? parseInt(body.slaTimerMins) : (oldTicket.slaTimerMins || 15);
        ticketData.nextSlaDeadline = new Date(Date.now() + mins * 60000);
      } else {
        ticketData.nextSlaDeadline = null;
      }
    } else if (body.slaTimerMins !== undefined && oldTicket.enableSla) {
      ticketData.nextSlaDeadline = new Date(Date.now() + parseInt(body.slaTimerMins) * 60000);
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isCS = session.user.department?.includes('CS') || session.user.department?.toLowerCase().includes('customer');
    const hasPermission = session.user.role === 'Admin' || isCS || session.user.permissions?.includes('delete_tickets') || session.user.permissions?.includes('manage_tickets');
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    
    // Purge cascades gracefully
    await prisma.comment.deleteMany({ where: { ticketId: id } });
    await prisma.attachment.deleteMany({ where: { ticketId: id } });
    await prisma.ticketHistory.deleteMany({ where: { ticketId: id } });
    await prisma.actionItem.updateMany({ where: { linkedTicketId: id }, data: { linkedTicketId: null } });
    await prisma.ticket.delete({ where: { id } });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

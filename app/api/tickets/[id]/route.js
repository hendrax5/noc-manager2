import {syncBodWindow} from '@/lib/tickets/bod';
import {assertTicketDeletionAllowed} from '@/lib/workflows/ticketOwnership';
import { workflowFlags } from '@/lib/workflows/flags';
import { resolveWorkflow, workflowContext, WorkflowError } from '@/lib/workflows/policy';
import { initializeTicketWorkflow, assertWorkflowResolved } from '@/lib/workflows/ticketWorkflow';
import { prepareServiceWork, applyServiceWork, serviceWorkInputChanged, ServiceWorkError } from '@/lib/tickets/serviceWork';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import {
  assertValidStatus,
  isTerminalStatus,
  normalizeStatus,
  TICKET_TYPES,
  TICKET_PRIORITIES,
} from "@/lib/tickets/status";
import { notifyTicketEvent, collectTicketNotifyEmails } from "@/lib/notify";
import { dispatchIntegrationWebhook } from "@/lib/integration/webhooks";
import {
  normalizeDowntimeCustomData,
  closeOpenDowntimeOnResolve,
} from "@/lib/tickets/downtime";
import {
  resolveJobRecipientId,
  resolveJobPointsLog,
  canAwardResolveJobPoints,
} from "@/lib/tickets/points";
import { canAccessPersonalTicket } from "@/lib/tickets/personalCategories";
import { assertServicesRecovered } from "@/lib/tickets/serviceRecovery";
import { classificationFieldsChanged, affectedServicesChanged, prepareTicketClassification, TicketClassificationError } from "@/lib/tickets/workClassification";
import { activateDueServices, syncPlannedActivation, clearPlannedActivation } from "@/lib/services/rfsActivation";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.id ? parseInt(session.user.id) : null;
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();

    if (body.priority !== undefined && !TICKET_PRIORITIES.includes(body.priority)) {
      return NextResponse.json(
        {
          error: `Invalid priority: "${body.priority}". Allowed values: ${TICKET_PRIORITIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const phasesEnabled = (await workflowFlags()).work_phase_enabled;
    const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
    const oldTicket = await tx.ticket.findUnique({
      where: { id },
      include: { jobCategory: { select: { name: true } }, services: { select: { id: true, cid: true, customData: true } } },
    });
    if (!oldTicket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!canAccessPersonalTicket(session.user, oldTicket)) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (oldTicket.purpose === "PersonalMonthlyReport") return NextResponse.json({error:"Arsip dikelola melalui Laporan Saya."},{status:403});
    const isCS =
      session.user.department?.includes("CS") ||
      session.user.department?.toLowerCase().includes("customer");
    const isAuthorized =
      session.user.role === "Admin" ||
      session.user.role === "Manager" ||
      isCS ||
      session.user.permissions?.includes("manage_tickets");

    if (
      (body.status !== undefined && oldTicket.status !== body.status) ||
      (body.priority !== undefined && oldTicket.priority !== body.priority)
    ) {
      const canChangeStatus =
        isAuthorized ||
        session.user.permissions?.includes("change_ticket_status") ||
        session.user.permissions?.includes("modify_tickets");
      if (!canChangeStatus) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to change ticket status or priority." },
          { status: 403 }
        );
      }
    }

    if (
      (body.assigneeId !== undefined &&
        oldTicket.assigneeId !== (body.assigneeId ? parseInt(body.assigneeId) : null)) ||
      (body.departmentId !== undefined &&
        oldTicket.departmentId !== parseInt(body.departmentId))
    ) {
      const canAssign =
        isAuthorized ||
        session.user.permissions?.includes("assign_tickets") ||
        session.user.permissions?.includes("modify_tickets");
      if (!canAssign) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to assign this ticket." },
          { status: 403 }
        );
      }
    }

    if (
      body.jobCategoryId !== undefined &&
      oldTicket.jobCategoryId !== (body.jobCategoryId ? parseInt(body.jobCategoryId) : null)
    ) {
      const canChangeJobCategory =
        isAuthorized ||
        session.user.permissions?.includes("change_job_category") ||
        session.user.permissions?.includes("modify_tickets");
      if (!canChangeJobCategory) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to change the ticket's job category." },
          { status: 403 }
        );
      }
    }

    if (
      (body.title !== undefined && oldTicket.title !== body.title) ||
      (body.description !== undefined && oldTicket.description !== body.description) ||
      classificationFieldsChanged(body, oldTicket) || affectedServicesChanged(body, oldTicket) || serviceWorkInputChanged(body)
    ) {
      const firstLog = await tx.ticketHistory.findFirst({
        where: { ticketId: id },
        orderBy: { createdAt: "asc" },
      });
      const isCreator = !firstLog || firstLog.actorId === userId;
      const hasEditOwn = session.user.permissions?.includes("edit_own_tickets");
      const hasEditOther = session.user.permissions?.includes("edit_other_tickets");
      const canEditGeneral =
        isAuthorized ||
        session.user.permissions?.includes("modify_tickets") ||
        (isCreator && hasEditOwn) ||
        (!isCreator && hasEditOther);
      if (!canEditGeneral) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to edit ticket details." },
          { status: 403 }
        );
      }
    }

    if (
      (body.enableSla !== undefined && oldTicket.enableSla !== body.enableSla) ||
      (body.slaTimerMins !== undefined &&
        oldTicket.slaTimerMins !== parseInt(body.slaTimerMins))
    ) {
      const canManageSla =
        isAuthorized ||
        session.user.permissions?.includes("manage_sla") ||
        session.user.permissions?.includes("manage_tickets");
      if (!canManageSla) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to modify SLA configurations." },
          { status: 403 }
        );
      }
    }

    const nextStatus =
      body.status != null ? assertValidStatus(body.status) : oldTicket.status;

    if (
      isTerminalStatus(oldTicket.status) &&
      normalizeStatus(oldTicket.status) === "Resolved" &&
      nextStatus !== "Resolved" &&
      nextStatus !== "Closed"
    ) {
      if (oldTicket.resolvedAt) {
        const dateResolved = new Date(oldTicket.resolvedAt);
        const dateNow = new Date();
        const isSameDay =
          dateResolved.getFullYear() === dateNow.getFullYear() &&
          dateResolved.getMonth() === dateNow.getMonth() &&
          dateResolved.getDate() === dateNow.getDate();

        if (isSameDay) {
          return NextResponse.json(
            {
              error:
                "Cannot re-open a ticket that was Resolved on the same day. Wait until the next day, or create a new ticket.",
            },
            { status: 400 }
          );
        }
      }
    }

    if (
      oldTicket.ticketType === "Change" &&
      nextStatus === "Resolved" &&
      oldTicket.approvalStatus === "Pending"
    ) {
      return NextResponse.json(
        { error: "Change ticket requires approval before it can be Resolved." },
        { status: 400 }
      );
    }

    let logs = [];
    if (body.status != null && oldTicket.status !== nextStatus) {
      logs.push({ action: `Status changed to [ ${nextStatus} ]`, actorId: userId });
    }
    if (body.priority != null && oldTicket.priority !== body.priority) {
      logs.push({ action: `Priority changed to [ ${body.priority} ]`, actorId: userId });
    }
    if (body.departmentId !== undefined && oldTicket.departmentId != body.departmentId) {
      logs.push({ action: `Department transfer initiated`, actorId: userId });
    }
    if (body.assigneeId !== undefined && oldTicket.assigneeId != body.assigneeId) {
      logs.push({ action: `Assignee rotation enacted`, actorId: userId });
    }
    if (body.ticketType && body.ticketType !== oldTicket.ticketType) {
      logs.push({ action: `Type changed to [ ${body.ticketType} ]`, actorId: userId });
    }
    if (body.approvalStatus && body.approvalStatus !== oldTicket.approvalStatus) {
      logs.push({ action: `Approval status: [ ${body.approvalStatus} ]`, actorId: userId });
    }

    let finalCustomData =
      body.customData !== undefined
        ? body.customData
        : oldTicket.customData && typeof oldTicket.customData === "object"
          ? { ...oldTicket.customData }
          : {};

    if (body.customData !== undefined) {
      const downtimeNorm = normalizeDowntimeCustomData(finalCustomData);
      if (!downtimeNorm.ok) {
        return NextResponse.json({ error: downtimeNorm.error }, { status: 400 });
      }
      finalCustomData = downtimeNorm.customData;
    }

    if (body.customData && JSON.stringify(oldTicket.customData) !== JSON.stringify(body.customData)) {
      const oldCust =
        oldTicket.customData && typeof oldTicket.customData === "object"
          ? oldTicket.customData["Customer Name"]
          : undefined;
      const newCust =
        body.customData && typeof body.customData === "object"
          ? body.customData["Customer Name"]
          : undefined;
      if (oldCust !== newCust && !isAuthorized) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to modify the Customer Name." },
          { status: 403 }
        );
      }
      logs.push({ action: `Custom fields / parameters updated`, actorId: userId });
    }

    if (body.enableSla !== undefined && oldTicket.enableSla !== body.enableSla) {
      logs.push({
        action: body.enableSla
          ? `SLA Timer Activated (${body.slaTimerMins || oldTicket.slaTimerMins || 15}m)`
          : `SLA Timer Deactivated`,
        actorId: userId,
      });
    } else if (
      body.slaTimerMins !== undefined &&
      oldTicket.slaTimerMins !== parseInt(body.slaTimerMins) &&
      (body.enableSla || oldTicket.enableSla)
    ) {
      logs.push({
        action: `SLA Timer duration changed to ${body.slaTimerMins}m`,
        actorId: userId,
      });
    }

    if (
      body.status !== undefined &&
      nextStatus !== "Resolved" &&
      normalizeStatus(oldTicket.status) === "Resolved"
    ) {
      finalCustomData = {
        ...(finalCustomData && typeof finalCustomData === "object" ? finalCustomData : {}),
        reopenedAt: new Date().toISOString(),
      };
    }

    // Close open outage when resolving/closing (start set, end still empty)
    if (
      (nextStatus === "Resolved" || nextStatus === "Closed") &&
      oldTicket.status !== nextStatus
    ) {
      const closed = closeOpenDowntimeOnResolve(finalCustomData);
      if (closed.changed) {
        finalCustomData = closed.customData;
        logs.push({
          action: `Outage downtime auto-closed (end set on ${nextStatus})`,
          actorId: userId,
        });
      }
    }

    // Recalc stored minutes when downtime is present (strict only if client sent customData)
    if (finalCustomData && typeof finalCustomData === "object" && finalCustomData.hasDowntime) {
      const downtimeNorm = normalizeDowntimeCustomData(finalCustomData);
      if (!downtimeNorm.ok) {
        if (body.customData !== undefined) {
          return NextResponse.json({ error: downtimeNorm.error }, { status: 400 });
        }
      } else {
        finalCustomData = downtimeNorm.customData;
      }
    }

    const ticketData = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: nextStatus }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.departmentId !== undefined && { departmentId: parseInt(body.departmentId) }),
      ...(body.assigneeId !== undefined && {
        assigneeId: body.assigneeId ? parseInt(body.assigneeId) : null,
      }),
      ...(body.jobCategoryId !== undefined && {
        jobCategoryId: body.jobCategoryId ? parseInt(body.jobCategoryId) : null,
      }),
      ...(body.queueId !== undefined && {
        queueId: body.queueId ? parseInt(body.queueId) : null,
      }),
      ...(body.ticketType &&
        TICKET_TYPES.includes(body.ticketType) && { ticketType: body.ticketType }),
      ...(body.approvalStatus !== undefined && { approvalStatus: body.approvalStatus }),
      ...(finalCustomData !== undefined && { customData: finalCustomData }),
      ...(body.enableSla !== undefined && { enableSla: body.enableSla }),
      ...(body.slaTimerMins !== undefined && { slaTimerMins: parseInt(body.slaTimerMins) }),
    };

    const previousBod=await tx.bodWindow.findUnique({where:{ticketId:id}});
    if(previousBod&&(body.serviceWorkTypeId!==undefined&&Number(body.serviceWorkTypeId)!==oldTicket.serviceWorkTypeId||body.workType!==undefined&&body.workType!=='ServiceWork'))throw new ServiceWorkError('Jenis tiket BOD tidak dapat diganti. Batalkan jadwal atau buat tiket baru.',409);
    if(previousBod&&Object.hasOwn(body,'serviceIds')&&(!Array.isArray(body.serviceIds)||body.serviceIds.length!==1||Number(body.serviceIds[0])!==previousBod.serviceId))throw new ServiceWorkError('CID BOD tidak dapat diganti. Buat tiket baru.',409);
    if(previousBod?.cancelledAt&&body.status!==undefined&&nextStatus!=='Closed')throw new ServiceWorkError('BOD dibatalkan. Buat tiket baru.',409);
    if(previousBod&&!previousBod.restoredAt&&nextStatus==='Closed')throw new ServiceWorkError('Konfirmasi pengembalian bandwidth normal sebelum menutup BOD.',409);
    const classification = await prepareTicketClassification(tx, body, oldTicket);
    Object.assign(ticketData, classification.data);
    Object.assign(ticketData, (await prepareServiceWork(tx, body, oldTicket)).data);
    const effectiveTicket = { ...oldTicket, ...ticketData, services: classification.serviceIds === null ? oldTicket.services : classification.serviceIds.map(id => ({id})) };
    const phaseCount = await tx.ticketPhaseExecution.count({where:{ticketId:id}});
    if (phaseCount && (nextStatus === 'Resolved' || nextStatus === 'Closed')) await assertWorkflowResolved(tx,id);
    if (phaseCount && body.jobCategoryId !== undefined && Number(body.jobCategoryId)!==oldTicket.jobCategoryId) {
      throw new WorkflowError('Kategori mengikuti fase. Gunakan override pada penyelesaian fase.',409);
    }
    if (phaseCount && ['workType','serviceWorkTypeId','departmentId'].some(key => body[key]!==undefined && String(body[key])!==String(oldTicket[key]))) throw new WorkflowError('Workflow aktif tidak dapat diganti. Buat tiket baru untuk pekerjaan berbeda.',409);
    if (phaseCount && body.customData && ['Order Origin','Executing Vendor'].some(key => (body.customData[key]||null)!==(oldTicket.customData?.[key]||null))) throw new WorkflowError('Routing workflow aktif tidak dapat diganti.',409);
    if (effectiveTicket.workType === "ServiceWork" && nextStatus === "Closed" && !effectiveTicket.serviceChange?.appliedAt) throw new ServiceWorkError("Resolve pekerjaan layanan sebelum menutup tiket.");
    if (effectiveTicket.workType === "ServiceWork" && nextStatus === "Resolved") {
      const application = await applyServiceWork(tx, effectiveTicket, userId, new Date(), body.completion);
      ticketData.serviceChange = application.serviceChange;
      if (application.applied) logs.push({ action: "Service Inventory applied from ticket", actorId: userId });
      if (application.applied && application.serviceChange?.completion) {
        const completion = application.serviceChange.completion;
        logs.push({ action: `Work completion confirmed (${completion.finishedAt}): ${completion.evidence.slice(0, 180)}`, actorId: userId });
      }
    }
    if (classification.serviceIds !== null) ticketData.services = { set: classification.serviceIds.map((id) => ({ id })) };
    const changedClassification = Object.entries(classification.data).some(([key, value]) => oldTicket[key] !== value);
    if (changedClassification) logs.push({
      action: `Work classification updated: ${classification.data.workType}; symptom: ${classification.data.symptomLabel || '-'}; cause: ${classification.data.causeLabel || '-'}; SAP: ${classification.data.sapReference || '-'}`,
      actorId: userId,
    });
    if (classification.serviceIds !== null && JSON.stringify([...classification.serviceIds].sort((a,b)=>a-b)) !== JSON.stringify(oldTicket.services.map((s)=>s.id).sort((a,b)=>a-b))) {
      logs.push({ action: `Affected service links updated (${classification.serviceIds.length} services)`, actorId: userId });
    }

    if (body.enableSla !== undefined) {
      if (body.enableSla) {
        const mins = body.slaTimerMins
          ? parseInt(body.slaTimerMins)
          : oldTicket.slaTimerMins || 15;
        ticketData.nextSlaDeadline = new Date(Date.now() + mins * 60000);
      } else {
        ticketData.nextSlaDeadline = null;
      }
    } else if (body.slaTimerMins !== undefined && oldTicket.enableSla) {
      ticketData.nextSlaDeadline = new Date(
        Date.now() + parseInt(body.slaTimerMins) * 60000
      );
    }

    // Multi-CID tickets are closed only after every circuit is marked recovered.
    if ((nextStatus === "Resolved" || nextStatus === "Closed") && (oldTicket.services?.length || 0) > 1) {
      const { ok, pending } = assertServicesRecovered(oldTicket.services, finalCustomData);
      if (!ok) {
        const labels = pending.map((service) => service.cid || `#${service.id}`).join(", ");
        throw new ServiceWorkError(`Tandai pemulihan CID berikut sebelum menutup tiket: ${labels}.`, 409);
      }
    }

    if (nextStatus === "Resolved") {
      const explicitCategoryId = body.jobCategoryId
        ? parseInt(body.jobCategoryId)
        : oldTicket.jobCategoryId;
      // Award on first resolve with a category, or when category is applied
      // after the ticket is already Resolved (CS picked category late).
      const newlyResolved = oldTicket.status !== "Resolved";
      const categoryAppliedWhileResolved =
        !newlyResolved &&
        Boolean(explicitCategoryId) &&
        oldTicket.jobCategoryId !== explicitCategoryId;
      if (!phaseCount && explicitCategoryId && (newlyResolved || categoryAppliedWhileResolved)) {
        ticketData.jobCategoryId = explicitCategoryId;
        const cat = await tx.jobCategory.findUnique({
          where: { id: ticketData.jobCategoryId },
        });
        if (cat) {
          const fallbackAssigneeId = ticketData.assigneeId || oldTicket.assigneeId;
          const recipientId = await resolveJobRecipientId(tx, id, fallbackAssigneeId);
          if (recipientId && (effectiveTicket.workType === "ServiceWork" ? !(await tx.ticketHistory.findFirst({where:{ticketId:id,jobCategoryId:{not:null},awardedScore:{gt:0}}})) : (await canAwardResolveJobPoints(tx, id)))) {
            logs.push(resolveJobPointsLog({ recipientId, cat }));
          }
        }
      }

      if (oldTicket.status !== "Resolved") {
        const actionItem = await tx.actionItem.findUnique({
          where: { linkedTicketId: id },
        });
        if (actionItem && actionItem.status !== "Completed") {
          await tx.actionItem.update({
            where: { id: actionItem.id },
            data: { status: "Completed" },
          });
          logs.push({
            action: `Meeting action item automatically completed`,
            actorId: userId,
          });
        }
      }

      ticketData.resolvedAt = oldTicket.resolvedAt || new Date();
      ticketData.nextSlaDeadline = null;
    } else if (nextStatus === "Closed") {
      ticketData.resolvedAt = oldTicket.resolvedAt || new Date();
      ticketData.nextSlaDeadline = null;
    } else if (body.status !== undefined) {
      ticketData.awardedScore = null;
      ticketData.resolvedAt = null;
    }

    const ticket = await tx.ticket.update({
      where: { id },
      data: {
        ...ticketData,
        ...(logs.length > 0 ? { historyLogs: { create: logs } } : {}),
      },
    });

    if (phaseCount && body.assigneeId === null) await tx.ticketPhaseExecution.updateMany({where:{ticketId:id,state:{not:'Completed'}},data:{assigneeId:null}});
    const resolvedChange = ticketData.serviceChange || effectiveTicket.serviceChange;
    // The RFS target may be corrected while the ticket is open; keep the registration's
    // activation instant in step so the sweep fires on the agreed date.
    if (ticket.workType === 'ServiceWork' && resolvedChange && !resolvedChange.appliedAt && resolvedChange.before?.serviceId && (resolvedChange.operation === 'Installation' || resolvedChange.registration === 'new')) {
      await syncPlannedActivation(tx, {serviceId: resolvedChange.before.serviceId, rfsDate: resolvedChange.effectiveDate});
    }
    if(effectiveTicket.serviceChange?.operation==='BOD' && (Object.hasOwn(body,'serviceChange')||Object.hasOwn(body,'serviceWorkTypeId')) && !effectiveTicket.serviceChange?.appliedAt) await syncBodWindow(tx,{...ticket,serviceChange:effectiveTicket.serviceChange});
    if ((phasesEnabled || phaseCount) && ticket.assigneeId && !['Resolved','Closed'].includes(nextStatus)) {
      if (phaseCount) await tx.ticketPhaseExecution.updateMany({where:{ticketId:id,state:{not:'Completed'}},data:{assigneeId:ticket.assigneeId}});
      else if (body.assigneeId !== undefined || body.workType !== undefined || body.serviceWorkTypeId !== undefined) {
        const assigned=await tx.user.findUnique({where:{id:ticket.assigneeId},select:{roleId:true}});
        const policies=await tx.workflowPolicyVersion.findMany({where:{publishedAt:{not:null}},include:{phases:{include:{category:true},orderBy:{ordinal:'asc'}}}});
        const workflow=resolveWorkflow({...workflowContext(ticket),roleId:assigned?.roleId,policies});
        if(workflow) await initializeTicketWorkflow(tx,{ticketId:id,policyVersionId:workflow.policyVersionId,actorId:userId});
      }
    }
    return { ticket, oldTicket, nextStatus };
    }, { timeout: 20000 });
    if (result instanceof Response) return result;
    const { ticket, oldTicket, nextStatus } = result;

    // RFS sweep opportunity: a registration whose RFS already passed activates now instead
    // of waiting for the next hourly tick. This never touches ticket status.
    if (ticket.workType === 'ServiceWork' && (oldTicket.services || []).length) {
      try { await activateDueServices(prisma, {serviceIds: oldTicket.services.map(service => service.id)}); }
      catch (error) { console.warn('RFS activation sweep deferred:', error.message); }
    }

    if (body.status != null && oldTicket.status !== nextStatus) {
      const { emails } = await collectTicketNotifyEmails(prisma, id);
      await notifyTicketEvent({
        prisma,
        event: "status_changed",
        ticket,
        emails,
        message: `Ticket ${ticket.trackingId} status: ${oldTicket.status} → ${nextStatus}`,
      });
      const event =
        nextStatus === "Resolved" || nextStatus === "Closed"
          ? "ticket.resolved"
          : "ticket.status_changed";
      await dispatchIntegrationWebhook(event, ticket, {
        previousStatus: oldTicket.status,
      });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof WorkflowError) return NextResponse.json({error:error.message},{status:error.status});
    if (error instanceof ServiceWorkError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof TicketClassificationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isCS =
      session.user.department?.includes("CS") ||
      session.user.department?.toLowerCase().includes("customer");
    const hasPermission =
      session.user.role === "Admin" ||
      session.user.role === "Manager" ||
      isCS ||
      session.user.permissions?.includes("delete_tickets") ||
      session.user.permissions?.includes("manage_tickets");
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const existing = await prisma.ticket.findUnique({
      where: { id },
      include: { jobCategory: { select: { name: true } }, services: { select: { id: true } } },
    });
    if (!existing || !canAccessPersonalTicket(session.user, existing)) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
    await assertTicketDeletionAllowed(tx,existing);
    // A registration whose work never completed must not self-activate after its ticket is gone.
    if (existing.serviceChange && !existing.serviceChange.appliedAt && ['Installation','DataCenter'].includes(existing.serviceChange.operation)) {
      await clearPlannedActivation(tx, (existing.services || []).map(service => service.id));
    }
    await tx.ticketWatcher.deleteMany({ where: { ticketId: id } });
    await tx.ticketNote.deleteMany({ where: { ticketId: id } });
    await tx.comment.deleteMany({ where: { ticketId: id } });
    await tx.attachment.deleteMany({ where: { ticketId: id } });
    await tx.ticketHistory.deleteMany({ where: { ticketId: id } });
    await tx.actionItem.updateMany({
      where: { linkedTicketId: id },
      data: { linkedTicketId: null },
    });
    await tx.ticket.delete({ where: { id } });

    });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    if (error instanceof WorkflowError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

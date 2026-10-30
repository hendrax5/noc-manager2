import {CidValidationError} from '@/lib/services/cid';
import {getAppConfig} from '@/lib/config';
import {automaticWorkMetadata} from '@/lib/tickets/workMetadata';
import {prepareInstallationTicket} from '@/lib/tickets/installation';
import {syncBodWindow} from '@/lib/tickets/bod';
import { workflowFlags } from '@/lib/workflows/flags';
import { resolveWorkflow, workflowContext, WorkflowError } from '@/lib/workflows/policy';
import { initializeTicketWorkflow } from '@/lib/workflows/ticketWorkflow';
import { prepareServiceWork, ServiceWorkError } from '@/lib/tickets/serviceWork';
import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { buildSlaDeadlines } from "@/lib/tickets/sla";
import { pickLeastBusyAssignee } from "@/lib/tickets/routing";
import { notifyTicketEvent } from "@/lib/notify";
import { TICKET_TYPES, TICKET_PRIORITIES, assertValidStatus } from "@/lib/tickets/status";
import { normalizeDowntimeCustomData } from "@/lib/tickets/downtime";
import { prepareTicketClassification, TicketClassificationError } from "@/lib/tickets/workClassification";
import { createTicketPointsLog } from "@/lib/tickets/points";
import { linkKnownCircuit } from '@/lib/services/circuitAssets';
import { archiveAttachments } from '@/lib/integration/driveBackground';
import { activateDueServices, syncPlannedActivation } from '@/lib/services/rfsActivation';

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
    let body = await req.json();
    const config = await getAppConfig();
    const phasesEnabled = (await workflowFlags()).work_phase_enabled;
    let registeredServiceIds = [];
    let createdChange = null;
    const ticket = await prisma.$transaction(async tx => {
    body = await prepareInstallationTicket(tx,body,userId);
    body = await automaticWorkMetadata(tx,body,config);
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

    const classification = await prepareTicketClassification(tx, body);
    Object.assign(classification.data, (await prepareServiceWork(tx, body)).data);

    if (priority !== undefined && !TICKET_PRIORITIES.includes(priority)) {
      throw new ServiceWorkError('Priority tidak valid.');
    }

    let finalAssigneeId = assigneeId ? parseInt(assigneeId) : null;

    if (!finalAssigneeId && (departmentId || queueId)) {
      finalAssigneeId = await pickLeastBusyAssignee(tx, {
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

    const routed=await automaticWorkMetadata(tx,{...body,assigneeId:finalAssigneeId},config);
    const downtimeNorm = normalizeDowntimeCustomData(routed.customData || customData || {});
    if (!downtimeNorm.ok) {
      throw new ServiceWorkError(downtimeNorm.error);
    }

    let ticketData = {
      ...classification.data,
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

    if (classification.serviceIds?.length > 0) {
      ticketData.services = {
        connect: classification.serviceIds.map((id) => ({ id })),
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

      const created = await tx.ticket.create({
      data: ticketData,
      include: {
        assignee: { select: { email: true, name: true } },
        watchers: { include: { user: { select: { email: true } } } },
        attachments: { select: { id: true } },
      },
    });

      if(body.installation&&classification.serviceIds?.[0]){const circuit=await tx.service.findUnique({where:{id:classification.serviceIds[0]},select:{customerId:true}});await tx.customerPickerUse.create({data:{userId,customerId:circuit.customerId,ticketId:created.id}});}
      await syncBodWindow(tx,created);
      if (phasesEnabled && created.assigneeId) {
        const assigned = await tx.user.findUnique({where:{id:created.assigneeId},select:{roleId:true}});
        const policies = await tx.workflowPolicyVersion.findMany({where:{publishedAt:{not:null}},include:{phases:{include:{category:true},orderBy:{ordinal:'asc'}}}});
        const workflow = resolveWorkflow({...workflowContext(created),roleId:assigned?.roleId,policies});
        if (workflow) await initializeTicketWorkflow(tx,{ticketId:created.id,policyVersionId:workflow.policyVersionId,actorId:userId});
      }
      createdChange = created.serviceChange || null;
      registeredServiceIds = classification.serviceIds || [];
      return created;
    },{timeout:20000});
    if (ticket instanceof Response) return ticket;
    const ticketAttachmentIds = (ticket.attachments || []).map((attachment) => attachment.id);
    if (ticketAttachmentIds.length) {
      after(async () => { await archiveAttachments(ticketAttachmentIds); });
    }
    try { await linkKnownCircuit(prisma,ticket.id); } catch { console.warn('Circuit CID link deferred; ticket retained for Inventory review.'); }
    // An Installation ticket always defines the RFS target for its Pending circuit, even when
    // the circuit was registered earlier through Assets. Then the sweep can activate it.
    if (createdChange?.before?.serviceId && (createdChange.operation === 'Installation' || createdChange.registration === 'new')) {
      try { await syncPlannedActivation(prisma, {serviceId: createdChange.before.serviceId, rfsDate: createdChange.effectiveDate}); }
      catch (error) { console.warn('RFS activation plan deferred:', error.message); }
    }
    // A registration whose RFS is already reached (today or a past date) activates right
    // away instead of waiting for the hourly sweep. Ticket status is untouched.
    const registrationServiceIds = createdChange?.operation === 'Installation' || createdChange?.registration === 'new' ? registeredServiceIds : [];
    if (registrationServiceIds.length) {
      try { await activateDueServices(prisma, {serviceIds: registrationServiceIds}); }
      catch (error) { console.warn('RFS activation sweep deferred:', error.message); }
    }
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
    if (error instanceof CidValidationError) return NextResponse.json({error:error.message},{status:error.status||400});
    if (error instanceof WorkflowError) return NextResponse.json({error:error.message},{status:error.status});
    if (error instanceof ServiceWorkError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof TicketClassificationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

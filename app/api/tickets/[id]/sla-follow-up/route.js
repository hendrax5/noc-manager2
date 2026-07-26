import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { refreshFollowUpDeadline } from "@/lib/tickets/sla";
import { maybeEscalateOnBreach } from "@/lib/tickets/escalation";
import { notifyTicketEvent, collectTicketNotifyEmails } from "@/lib/notify";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!ticket.enableSla) {
      return NextResponse.json({ error: "SLA is disabled for this ticket." }, { status: 400 });
    }

    const nextDeadline = refreshFollowUpDeadline({
      priority: ticket.priority,
      slaTimerMins: ticket.slaTimerMins,
    });

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        slaBreaches: { increment: 1 },
        nextSlaDeadline: nextDeadline,
        historyLogs: {
          create: {
            action: `Follow-up logged. SLA timer reset by ${ticket.slaTimerMins} mins.`,
            actorId: parseInt(session.user.id),
          },
        },
      },
    });

    const { emails } = await collectTicketNotifyEmails(prisma, ticketId);
    await notifyTicketEvent({
      prisma,
      event: "sla_breach",
      ticket: updated,
      emails,
      message: `SLA follow-up / breach on ${updated.trackingId}. Breaches: ${updated.slaBreaches}`,
    });

    await maybeEscalateOnBreach(prisma, updated, parseInt(session.user.id));

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

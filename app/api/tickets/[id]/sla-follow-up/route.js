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

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!ticket.enableSla) return NextResponse.json({ error: "SLA is disabled for this ticket." }, { status: 400 });

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        slaBreaches: { increment: 1 },
        nextSlaDeadline: new Date(Date.now() + ticket.slaTimerMins * 60000),
        historyLogs: {
          create: {
            action: `CS Logged External Follow-Up. Retriggering SLA timer by ${ticket.slaTimerMins} mins.`,
            actorId: parseInt(session.user.id)
          }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

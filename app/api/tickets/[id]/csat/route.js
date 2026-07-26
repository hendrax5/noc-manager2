import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyTicketEvent } from "@/lib/notify";

/** Public CSAT submit by trackingId (also accepts ticket id for staff). */
export async function POST(req, { params }) {
  try {
    const ticketId = parseInt((await params).id);
    const body = await req.json();
    const score = parseInt(body.score, 10);
    const comment = body.comment ? String(body.comment).slice(0, 1000) : null;

    if (!score || score < 1 || score > 5) {
      return NextResponse.json({ error: "Score must be 1–5" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ticket.status !== "Resolved" && ticket.status !== "Closed") {
      return NextResponse.json({ error: "CSAT only allowed on Resolved/Closed tickets" }, { status: 400 });
    }
    if (ticket.csatScore) {
      return NextResponse.json({ error: "CSAT already submitted" }, { status: 400 });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        csatScore: score,
        csatComment: comment,
        csatAt: new Date(),
        historyLogs: {
          create: { action: `CSAT score recorded: ${score}/5`, actorId: null },
        },
      },
    });

    await notifyTicketEvent({
      prisma,
      event: "csat_request",
      ticket: updated,
      emails: [],
      message: `CSAT ${score}/5 for ${updated.trackingId}`,
    });

    return NextResponse.json({ ok: true, csatScore: score });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

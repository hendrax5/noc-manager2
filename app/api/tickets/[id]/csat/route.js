import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { notifyTicketEvent } from "@/lib/notify";

/**
 * CSAT submit. Public callers must use the unguessable trackingId;
 * the sequential numeric id is only accepted from a logged-in session.
 */
export async function POST(req, { params }) {
  try {
    const rawId = decodeURIComponent((await params).id || "");
    const isNumericId = /^\d+$/.test(rawId);

    let where;
    if (isNumericId) {
      const session = await getServerSession(authOptions);
      if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
      where = { id: parseInt(rawId, 10) };
    } else {
      where = { trackingId: rawId };
    }

    const body = await req.json();
    const score = parseInt(body.score, 10);
    const comment = body.comment ? String(body.comment).slice(0, 1000) : null;

    if (!score || score < 1 || score > 5) {
      return NextResponse.json({ error: "Score must be 1–5" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ticket.status !== "Resolved" && ticket.status !== "Closed") {
      return NextResponse.json({ error: "CSAT only allowed on Resolved/Closed tickets" }, { status: 400 });
    }
    if (ticket.csatScore) {
      return NextResponse.json({ error: "CSAT already submitted" }, { status: 400 });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
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
    console.error("[csat]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { canEditDowntime, applyDowntimeEdit } from "@/lib/tickets/downtimeEdit";
import { canAccessPersonalTicket } from "@/lib/tickets/personalCategories";

/**
 * Downtime-only edit: CS/PIC can correct outage start/end without access to the
 * general ticket edit form (title, classification, services).
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id, 10);
    if (!Number.isInteger(ticketId)) return NextResponse.json({ error: "Tiket tidak valid." }, { status: 400 });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        jobCategory: { select: { name: true } },
        services: { select: { id: true, cid: true } },
        historyLogs: { orderBy: { createdAt: "asc" }, take: 1, select: { actorId: true } },
      },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (!canAccessPersonalTicket(session.user, ticket)) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (ticket.purpose === "PersonalMonthlyReport") {
      return NextResponse.json({ error: "Arsip personal tidak memakai downtime." }, { status: 403 });
    }

    const creatorId = ticket.historyLogs?.[0]?.actorId ?? null;
    if (!canEditDowntime(session.user, { assigneeId: ticket.assigneeId, creatorId })) {
      return NextResponse.json(
        { error: "Tidak berizin mengubah waktu downtime. Minta akses manage_sla atau hubungi Manager." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = applyDowntimeEdit(ticket.customData, { start: body.start, end: body.end });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const range = result.customData.hasDowntime
      ? `${result.customData.startDowntime || "-"} → ${result.customData.endDowntime || "berjalan"} (${result.customData.downtimeMinutes} menit)`
      : "dihapus";
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        customData: result.customData,
        historyLogs: {
          create: {
            action: `Downtime diperbarui: ${range}`,
            actorId: Number(session.user.id),
          },
        },
      },
    });

    return NextResponse.json({ customData: updated.customData });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Gagal menyimpan downtime." }, { status: 500 });
  }
}

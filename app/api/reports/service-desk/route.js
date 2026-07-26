import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { expandStatusesForQuery, OPEN_STATUSES, TERMINAL_STATUSES } from "@/lib/tickets/status";

/**
 * Service-desk reporting suite (P3): volume, SLA, TTR, CSAT.
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "Admin" && session.user.role !== "Manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const openStatuses = expandStatusesForQuery([...OPEN_STATUSES]);
    const terminal = [...TERMINAL_STATUSES];

    const [
      createdVolume,
      resolvedVolume,
      openNow,
      breached,
      withSla,
      resolvedTickets,
      csatTickets,
      byPriority,
      byType,
      byStatus,
    ] = await Promise.all([
      prisma.ticket.count({ where: { createdAt: { gte: since } } }),
      prisma.ticket.count({
        where: { status: { in: terminal }, resolvedAt: { gte: since } },
      }),
      prisma.ticket.count({ where: { status: { in: openStatuses } } }),
      prisma.ticket.count({
        where: { enableSla: true, slaBreaches: { gt: 0 }, createdAt: { gte: since } },
      }),
      prisma.ticket.count({ where: { enableSla: true, createdAt: { gte: since } } }),
      prisma.ticket.findMany({
        where: { status: { in: terminal }, resolvedAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true, firstRespondedAt: true, responseDueAt: true, resolutionDueAt: true },
      }),
      prisma.ticket.findMany({
        where: { csatScore: { not: null }, csatAt: { gte: since } },
        select: { csatScore: true },
      }),
      prisma.ticket.groupBy({
        by: ["priority"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["ticketType"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    let ttrSum = 0;
    let responseSum = 0;
    let responseCount = 0;
    let metResolution = 0;
    let metResponse = 0;

    for (const t of resolvedTickets) {
      if (t.resolvedAt) {
        ttrSum += new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        if (t.resolutionDueAt && new Date(t.resolvedAt) <= new Date(t.resolutionDueAt)) {
          metResolution += 1;
        }
      }
      if (t.firstRespondedAt) {
        responseSum += new Date(t.firstRespondedAt).getTime() - new Date(t.createdAt).getTime();
        responseCount += 1;
        if (t.responseDueAt && new Date(t.firstRespondedAt) <= new Date(t.responseDueAt)) {
          metResponse += 1;
        }
      }
    }

    const avgTtrMins =
      resolvedTickets.length > 0
        ? Math.round(ttrSum / resolvedTickets.length / 60000)
        : 0;
    const avgResponseMins =
      responseCount > 0 ? Math.round(responseSum / responseCount / 60000) : 0;
    const csatAvg =
      csatTickets.length > 0
        ? Math.round(
            (csatTickets.reduce((s, t) => s + t.csatScore, 0) / csatTickets.length) * 10
          ) / 10
        : null;

    return NextResponse.json({
      windowDays: days,
      volume: {
        created: createdVolume,
        resolved: resolvedVolume,
        openNow,
      },
      sla: {
        withSla,
        breached,
        breachRate: withSla > 0 ? Math.round((breached / withSla) * 1000) / 10 : 0,
        resolutionMetPct:
          resolvedTickets.length > 0
            ? Math.round((metResolution / resolvedTickets.length) * 1000) / 10
            : null,
        responseMetPct:
          responseCount > 0 ? Math.round((metResponse / responseCount) * 1000) / 10 : null,
      },
      ttr: {
        avgMins: avgTtrMins,
        avgResponseMins,
      },
      csat: {
        count: csatTickets.length,
        average: csatAvg,
      },
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count.id })),
      byType: byType.map((r) => ({ type: r.ticketType, count: r._count.id })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count.id })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

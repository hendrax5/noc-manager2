import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  effectiveDowntimeMinutes,
  parseDowntimeDate,
} from "@/lib/tickets/downtime";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasAccess =
      session.user.role === "Admin" || session.user.permissions?.includes("view_reports");
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");

    const startDate = startParam
      ? new Date(startParam)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = endParam ? new Date(endParam) : new Date();

    // Ensure endDate covers the whole day
    endDate.setHours(23, 59, 59, 999);
    const now = new Date();

    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        department: true,
        assignee: true,
        services: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    let totalTickets = tickets.length;
    let resolvedTickets = 0;
    let totalResolutionTimeHours = 0;
    let slaBreaches = 0;
    let totalDowntimeHours = 0;

    const dailyTrend = {};
    const departmentStats = {};
    const incidents = [];

    tickets.forEach((ticket) => {
      const dateStr = ticket.createdAt.toISOString().split("T")[0];

      if (!dailyTrend[dateStr]) {
        dailyTrend[dateStr] = { date: dateStr, total: 0, resolved: 0, breached: 0 };
      }
      dailyTrend[dateStr].total++;

      const deptName = ticket.department.name;
      if (!departmentStats[deptName]) {
        departmentStats[deptName] = {
          department: deptName,
          total: 0,
          breached: 0,
          resolved: 0,
        };
      }
      departmentStats[deptName].total++;

      if (ticket.slaBreaches > 0) {
        slaBreaches++;
        dailyTrend[dateStr].breached++;
        departmentStats[deptName].breached++;
      }

      let resolutionHours = null;
      if (ticket.resolvedAt) {
        resolvedTickets++;
        dailyTrend[dateStr].resolved++;
        departmentStats[deptName].resolved++;

        const diffMs = new Date(ticket.resolvedAt) - new Date(ticket.createdAt);
        resolutionHours = diffMs / (1000 * 60 * 60);
        totalResolutionTimeHours += resolutionHours;
      }

      // Source of truth: Catat Waktu Outage / Downtime (not ticket age)
      const cd = ticket.customData && typeof ticket.customData === "object" ? ticket.customData : {};
      const hasOutage = !!(cd.hasDowntime && cd.startDowntime);
      let downtimeHours = 0;
      let downtimeMinutes = 0;
      let downtimeOngoing = false;
      if (hasOutage) {
        // Cap "live" end at report endDate so open outages don't inflate beyond the selected window
        const startDt = parseDowntimeDate(cd.startDowntime);
        let endDt = parseDowntimeDate(cd.endDowntime);
        if (!endDt) {
          endDt = now < endDate ? now : endDate;
          downtimeOngoing = true;
        }
        if (startDt && endDt) {
          const cappedStart = startDt < startDate ? startDate : startDt;
          const cappedEnd = endDt > endDate ? endDate : endDt;
          const ms = Math.max(0, cappedEnd - cappedStart);
          downtimeMinutes = Math.floor(ms / 60000);
          downtimeHours = downtimeMinutes / 60;
          totalDowntimeHours += downtimeHours;
        } else {
          downtimeMinutes = effectiveDowntimeMinutes(cd, { now });
          downtimeHours = downtimeMinutes / 60;
          totalDowntimeHours += downtimeHours;
        }
      }

      incidents.push({
        id: ticket.trackingId,
        title: ticket.title,
        priority: ticket.priority,
        department: deptName,
        assignee: ticket.assignee?.name || "Unassigned",
        status: ticket.status,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt || "Unresolved",
        resolutionTimeHours: resolutionHours ? resolutionHours.toFixed(2) : "-",
        downtimeHours: hasOutage ? downtimeHours.toFixed(2) : "-",
        downtimeMinutes: hasOutage ? downtimeMinutes : null,
        hasOutage,
        downtimeOngoing,
        slaBreaches: ticket.slaBreaches,
        hasBreach: ticket.slaBreaches > 0 ? "Yes" : "No",
        servicesAffected: ticket.services.map((s) => s.name).join(", ") || "N/A",
      });
    });

    // Prefer real outage duration; fallback to resolution time for sorting
    incidents.sort((a, b) => {
      const valA =
        a.downtimeMinutes != null
          ? a.downtimeMinutes
          : parseFloat(a.resolutionTimeHours) || 0;
      const valB =
        b.downtimeMinutes != null
          ? b.downtimeMinutes
          : parseFloat(b.resolutionTimeHours) || 0;
      return valB - valA;
    });

    const averageResolutionTime =
      resolvedTickets > 0 ? totalResolutionTimeHours / resolvedTickets : 0;
    const slaComplianceRate =
      totalTickets > 0 ? ((totalTickets - slaBreaches) / totalTickets) * 100 : 100;

    const totalPeriodHours = (endDate - startDate) / (1000 * 60 * 60) || 24;
    const uptimePercentage = Math.max(
      0,
      ((totalPeriodHours - totalDowntimeHours) / totalPeriodHours) * 100
    );

    return NextResponse.json({
      summary: {
        totalTickets,
        resolvedTickets,
        slaBreaches,
        averageResolutionTimeHours: averageResolutionTime.toFixed(2),
        slaComplianceRate: slaComplianceRate.toFixed(1),
        totalDowntimeHours: totalDowntimeHours.toFixed(2),
        uptimePercentage: uptimePercentage.toFixed(3),
      },
      dailyTrend: Object.values(dailyTrend),
      departmentStats: Object.values(departmentStats),
      incidents: incidents,
    });
  } catch (error) {
    console.error("Error generating SLA report:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { parseDowntimeDate } from "@/lib/tickets/downtime";
import {
  SLA_TARGET_PERCENT,
  SLA_LETTER_COMPANY,
  parseRangeWib,
  formatPeriodLabel,
  monthKeyWib,
  monthLabelFromKey,
  monthWindow,
  formatDateWib,
  formatTimeWib,
  formatDurationHhMm,
  stripHtml,
  truncate,
  availabilityPercents,
  buildIntro,
  ymdWib,
} from "@/lib/reports/slaLetter";

function customerLabel(ticket) {
  const fromServices = (ticket.services || [])
    .map((s) => s.customer?.name)
    .filter(Boolean);
  if (fromServices.length) return [...new Set(fromServices)].join(", ");
  const cd = ticket.customData && typeof ticket.customData === "object" ? ticket.customData : {};
  return (
    cd["Customer Name"] ||
    cd.customerName ||
    cd.Customer ||
    cd.customer ||
    ticket.title ||
    "—"
  );
}

function matchesCustomer(ticket, q) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    customerLabel(ticket),
    ticket.title,
    ticket.trackingId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasAccess =
      session.user.role === "Admin" ||
      session.user.role === "Manager" ||
      session.user.permissions?.includes("view_reports");
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");
    const customerQ = searchParams.get("customer") || "";
    const { start: startDate, end: endDate } = parseRangeWib(startParam, endParam);
    const now = new Date();

    const tickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { resolvedAt: { gte: startDate, lte: endDate } },
          { updatedAt: { gte: startDate, lte: endDate } },
        ],
      },
      include: {
        department: true,
        assignee: true,
        services: { include: { customer: { select: { name: true } } } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { text: true, createdAt: true, isPublic: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { content: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const inScope = tickets.filter((t) => matchesCustomer(t, customerQ));

    let totalTickets = inScope.length;
    let resolvedTickets = 0;
    let totalResolutionTimeHours = 0;
    let slaBreaches = 0;
    let totalDowntimeHours = 0;

    const dailyTrend = {};
    const departmentStats = {};
    const incidents = [];
    const outageRows = [];

    inScope.forEach((ticket) => {
      const dateStr = ymdWib(ticket.createdAt);

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

      const cd =
        ticket.customData && typeof ticket.customData === "object" ? ticket.customData : {};
      const hasOutage = !!(cd.hasDowntime && cd.startDowntime);
      let downtimeHours = 0;
      let downtimeMinutes = 0;
      let downtimeOngoing = false;
      let downAt = null;
      let upAt = null;
      let cappedMs = 0;

      if (hasOutage) {
        const startDt = parseDowntimeDate(cd.startDowntime);
        let endDt = parseDowntimeDate(cd.endDowntime);
        if (!endDt) {
          endDt = now < endDate ? now : endDate;
          downtimeOngoing = true;
        }
        downAt = startDt;
        upAt = parseDowntimeDate(cd.endDowntime);
        if (startDt && endDt) {
          const overlapStart = startDt < startDate ? startDate : startDt;
          const overlapEnd = endDt > endDate ? endDate : endDt;
          cappedMs = Math.max(0, overlapEnd - overlapStart);
          downtimeMinutes = Math.floor(cappedMs / 60000);
          downtimeHours = downtimeMinutes / 60;
          totalDowntimeHours += downtimeHours;
        }
      }

      const cause = truncate(stripHtml(ticket.description), 480);
      const correctiveBits = [
        ...(ticket.notes || []).map((n) => stripHtml(n.content)),
        ...(ticket.comments || []).map((c) => stripHtml(c.text)),
      ].filter(Boolean);
      const corrective = truncate(correctiveBits[0] || "", 420);

      const row = {
        id: ticket.trackingId,
        dbId: ticket.id,
        title: ticket.title,
        customer: customerLabel(ticket),
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
        incidentDate: downAt ? formatDateWib(downAt) : formatDateWib(ticket.createdAt),
        downAt: downAt ? formatTimeWib(downAt) : "—",
        upAt: upAt ? formatTimeWib(upAt) : downtimeOngoing ? "ongoing" : "—",
        duration: hasOutage ? formatDurationHhMm(cappedMs) : "—",
        cause: cause || "—",
        corrective: corrective || "—",
        monthKey: monthKeyWib(downAt || ticket.createdAt),
      };

      incidents.push(row);
      if (hasOutage && cappedMs > 0) outageRows.push(row);
    });

    incidents.sort((a, b) => {
      const valA =
        a.downtimeMinutes != null ? a.downtimeMinutes : parseFloat(a.resolutionTimeHours) || 0;
      const valB =
        b.downtimeMinutes != null ? b.downtimeMinutes : parseFloat(b.resolutionTimeHours) || 0;
      return valB - valA;
    });

    const monthKeys = [...new Set(outageRows.map((r) => r.monthKey))].sort();
    const monthSections = monthKeys.map((key) => {
      const { start, end } = monthWindow(key, startDate, endDate);
      const rows = outageRows
        .filter((r) => r.monthKey === key)
        .sort((a, b) => String(a.incidentDate).localeCompare(String(b.incidentDate)));
      const downMs = rows.reduce((s, r) => s + (r.downtimeMinutes || 0) * 60000, 0);
      const av = availabilityPercents(end - start + 1, downMs, SLA_TARGET_PERCENT);
      return {
        monthKey: key,
        monthLabel: monthLabelFromKey(key),
        incidents: rows.map((r, i) => ({ ...r, no: i + 1 })),
        ...av,
      };
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

    const periodLabel = formatPeriodLabel(startDate, endDate);
    const letterCustomer = customerQ.trim() || "Semua pelanggan";

    return NextResponse.json({
      letter: {
        customer: letterCustomer,
        periodLabel,
        startDate: ymdWib(startDate),
        endDate: ymdWib(endDate),
        slaTarget: SLA_TARGET_PERCENT,
        intro: buildIntro(periodLabel),
        company: SLA_LETTER_COMPANY,
        signatory: {
          customerName: letterCustomer,
          nocName: session.user.name || "NOC",
          nocTitle: session.user.role === "Admin" ? "NOC Manager" : session.user.role || "NOC",
        },
      },
      summary: {
        totalTickets,
        resolvedTickets,
        slaBreaches,
        averageResolutionTimeHours: averageResolutionTime.toFixed(2),
        slaComplianceRate: slaComplianceRate.toFixed(1),
        totalDowntimeHours: totalDowntimeHours.toFixed(2),
        uptimePercentage: uptimePercentage.toFixed(3),
        outageCount: outageRows.length,
      },
      monthSections,
      dailyTrend: Object.values(dailyTrend),
      departmentStats: Object.values(departmentStats),
      incidents,
    });
  } catch (error) {
    console.error("Error generating SLA report:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

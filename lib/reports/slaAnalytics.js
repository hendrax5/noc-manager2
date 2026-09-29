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
import { ticketTtrMs } from "@/lib/reports/ttr";
import { isTerminalStatus } from "@/lib/tickets/status";

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

function mergedDurationMs(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  for (const { start, end } of sorted) {
    if (curEnd === null || start > curEnd) {
      if (curEnd !== null) total += curEnd - curStart;
      curStart = start;
      curEnd = end;
    } else if (end > curEnd) {
      curEnd = end;
    }
  }
  if (curEnd !== null) total += curEnd - curStart;
  return total;
}

/**
 * Availability is per customer: overlapping outages of one customer are merged, then the
 * downtime is averaged over affected customers (summing across customers can exceed the period).
 */
function avgCustomerDowntimeMs(intervals) {
  const byCustomer = new Map();
  for (const i of intervals) {
    if (!byCustomer.has(i.customer)) byCustomer.set(i.customer, []);
    byCustomer.get(i.customer).push(i);
  }
  if (byCustomer.size === 0) return { avgMs: 0, customers: 0 };
  let sum = 0;
  for (const list of byCustomer.values()) sum += mergedDurationMs(list);
  return { avgMs: sum / byCustomer.size, customers: byCustomer.size };
}

/**
 * SLA & Analytics report (letter, summary, monthly availability, incidents).
 * @param {{ startDate?: string, endDate?: string, customer?: string, signatory?: { nocName: string, nocTitle: string } }} opts
 */
export async function buildSlaAnalytics({ startDate: startParam, endDate: endParam, customer = "", signatory } = {}) {
  const customerQ = customer || "";
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
      assignee: { select: { id: true, name: true } },
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
  const outageIntervals = [];

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
      resolutionHours = ticketTtrMs(ticket) / (1000 * 60 * 60);
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
    let monthKey = monthKeyWib(ticket.createdAt);

    if (hasOutage) {
      const startDt = parseDowntimeDate(cd.startDowntime);
      let endDt = parseDowntimeDate(cd.endDowntime);
      upAt = endDt;
      if (!endDt && isTerminalStatus(ticket.status) && ticket.resolvedAt) {
        endDt = new Date(ticket.resolvedAt);
        upAt = endDt;
      }
      if (!endDt) {
        endDt = now < endDate ? now : endDate;
        downtimeOngoing = true;
      }
      downAt = startDt;
      if (startDt) monthKey = monthKeyWib(startDt);
      if (startDt && endDt) {
        const overlapStart = startDt < startDate ? startDate : startDt;
        const overlapEnd = endDt > endDate ? endDate : endDt;
        cappedMs = Math.max(0, overlapEnd - overlapStart);
        downtimeMinutes = Math.floor(cappedMs / 60000);
        downtimeHours = downtimeMinutes / 60;
        totalDowntimeHours += downtimeHours;
        if (cappedMs > 0) {
          monthKey = monthKeyWib(overlapStart);
          outageIntervals.push({
            customer: customerLabel(ticket),
            monthKey,
            start: overlapStart.getTime(),
            end: overlapEnd.getTime(),
          });
        }
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
      monthKey,
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
    const { avgMs: downMs } = avgCustomerDowntimeMs(
      outageIntervals.filter((i) => i.monthKey === key)
    );
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
  const periodMs = endDate - startDate || 24 * 60 * 60 * 1000;
  const { avgMs: avgCustomerDownMs, customers: affectedCustomers } =
    avgCustomerDowntimeMs(outageIntervals);
  const uptimePercentage = Math.max(0, (1 - avgCustomerDownMs / periodMs) * 100);

  const periodLabel = formatPeriodLabel(startDate, endDate);
  const letterCustomer = customerQ.trim() || "Semua pelanggan";

  return {
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
        nocName: signatory?.nocName || "NOC",
        nocTitle: signatory?.nocTitle || "NOC",
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
      affectedCustomers,
    },
    monthSections,
    dailyTrend: Object.values(dailyTrend),
    departmentStats: Object.values(departmentStats),
    incidents,
  };
}

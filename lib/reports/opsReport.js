import { prisma } from "@/lib/prisma";
import { resolveOpsPeriod } from "@/lib/reports/opsPeriod";
import {
  opsBucketFromCategory,
  DOWNTIME_THRESHOLD_MINUTES,
} from "@/lib/reports/opsCategories";
import { TERMINAL_STATUSES } from "@/lib/tickets/status";
import {
  effectiveDowntimeMinutes,
  parseDowntimeDate,
} from "@/lib/tickets/downtime";

function customerLabel(ticket) {
  const fromServices = (ticket.services || [])
    .map((s) => s.customer?.name)
    .filter(Boolean);
  if (fromServices.length) return [...new Set(fromServices)].join(", ");
  const cd = ticket.customData || {};
  return (
    cd["Customer Name"] ||
    cd.customerName ||
    cd.Customer ||
    cd.customer ||
    "—"
  );
}

function serializeTicket(t, extra = {}) {
  const mins = effectiveDowntimeMinutes(t.customData);
  return {
    id: t.id,
    ticketNumber: t.trackingId || t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    jobCategory: t.jobCategory?.name || null,
    customer: customerLabel(t),
    department: t.department?.name || null,
    assignee: t.assignee?.name || t.assignee?.email || null,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    downtimeMinutes: mins,
    downtimeHours: Math.round((mins / 60) * 10) / 10,
    downtimeOngoing: !!(
      t.customData?.hasDowntime &&
      t.customData?.startDowntime &&
      !t.customData?.endDowntime
    ),
    ...extra,
  };
}

function downtimeEventAt(t, now = new Date()) {
  const endRaw = t.customData?.endDowntime;
  if (endRaw) {
    const parsed = parseDowntimeDate(endRaw);
    if (parsed) return parsed;
  }
  if (t.resolvedAt) return new Date(t.resolvedAt);
  if (
    t.customData?.hasDowntime &&
    t.customData?.startDowntime &&
    !t.customData?.endDowntime
  ) {
    return now;
  }
  return t.updatedAt ? new Date(t.updatedAt) : now;
}

const ticketInclude = {
  jobCategory: true,
  department: { select: { name: true } },
  assignee: { select: { name: true, email: true } },
  services: { include: { customer: { select: { name: true } } } },
};

/**
 * Build Ops Report payload (shared by session UI and Integration API).
 * @param {{ period?: string, anchor?: string|null, start?: string|null, end?: string|null }} opts
 */
export async function buildOpsReport(opts = {}) {
  const periodRaw = opts.period;
  const period =
    periodRaw === "month" || periodRaw === "custom" ? periodRaw : "week";
  const anchor = opts.anchor || null;
  const startYmd = opts.start || null;
  const endYmd = opts.end || null;
  const { start, end, startDate, endDate } = resolveOpsPeriod(
    period,
    anchor,
    startYmd,
    endYmd
  );
  const now = new Date();
  const terminal = [...TERMINAL_STATUSES];

  const [lifecycleTickets, downtimeCandidates] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        status: { in: terminal },
        resolvedAt: { gte: start, lte: end },
        jobCategoryId: { not: null },
      },
      include: ticketInclude,
      orderBy: { resolvedAt: "desc" },
    }),
    prisma.ticket.findMany({
      where: {
        OR: [
          { resolvedAt: { gte: start, lte: end } },
          { updatedAt: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      include: ticketInclude,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const upgrade = [];
  const neu = [];
  const terminate = [];

  for (const t of lifecycleTickets) {
    const bucket = opsBucketFromCategory(t.jobCategory?.name);
    if (bucket === "upgrade") upgrade.push(serializeTicket(t));
    else if (bucket === "new") neu.push(serializeTicket(t));
    else if (bucket === "terminate") terminate.push(serializeTicket(t));
  }

  const downtime = [];
  const seen = new Set();
  for (const t of downtimeCandidates) {
    const cd = t.customData && typeof t.customData === "object" ? t.customData : {};
    if (!cd.hasDowntime && !cd.startDowntime) continue;

    const mins = effectiveDowntimeMinutes(cd, { now });
    if (mins <= DOWNTIME_THRESHOLD_MINUTES) continue;

    const eventAt = downtimeEventAt(t, now);
    if (eventAt < start || eventAt > end) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    downtime.push(serializeTicket(t));
  }
  downtime.sort((a, b) => b.downtimeMinutes - a.downtimeMinutes);

  return {
    period,
    startDate,
    endDate,
    thresholdHours: 10,
    counts: {
      downtime: downtime.length,
      terminate: terminate.length,
      new: neu.length,
      upgrade: upgrade.length,
    },
    downtime,
    terminate,
    new: neu,
    upgrade,
  };
}

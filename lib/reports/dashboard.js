import { prisma } from "@/lib/prisma";
import { expandStatusesForQuery } from "@/lib/tickets/status";
import {
  andWhere,
  excludePersonalFromLiveOps,
  getPersonalCategoryIds,
} from "@/lib/tickets/personalCategories";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Dashboard KPI, category monitor and (optionally) Sky View data.
 * @param {object} opts
 * @param {object} opts.scope           Prisma ticket where (visibility scope, already guarded)
 * @param {string[]|null} opts.categoryNames  restrict KPIs to these job category names
 * @param {boolean} opts.includeSkyView
 * @param {object} opts.skyTicketGuard  extra where for Sky View workload tickets
 */
export async function buildDashboardOverview({
  scope = {},
  categoryNames = null,
  includeSkyView = false,
  skyTicketGuard = {},
} = {}) {
  const hasCategoryFilter = Array.isArray(categoryNames) && categoryNames.length > 0;
  const categoryFilterClause = hasCategoryFilter ? { jobCategory: { name: { in: categoryNames } } } : {};
  const base = { ...scope, ...categoryFilterClause };
  const todayStart = startOfToday();

  // Canonical statuses; include legacy aliases until DB normalized
  const [totalNew, totalPending, totalOpen, totalInProgress] = await Promise.all([
    prisma.ticket.count({ where: { ...base, status: 'New' } }),
    prisma.ticket.count({ where: { ...base, status: { in: ['Pending', 'Waiting Reply'] } } }),
    prisma.ticket.count({ where: { ...base, status: { in: ['Open', 'Replied'] } } }),
    prisma.ticket.count({ where: { ...base, status: 'In Progress' } }),
  ]);

  const resolvedData = await prisma.ticket.findMany({
    where: { ...base, status: 'Resolved' },
    select: { createdAt: true, updatedAt: true, resolvedAt: true }
  });
  let totalTtrMs = 0;
  resolvedData.forEach(t => {
    const diff = new Date(t.resolvedAt || t.updatedAt).getTime() - new Date(t.createdAt).getTime();
    if (diff > 0) totalTtrMs += diff;
  });
  const avgTtrMins = resolvedData.length > 0 ? Math.round((totalTtrMs / resolvedData.length) / 60000) : 0;

  const todayTickets = await prisma.ticket.findMany({
    where: { ...base, updatedAt: { gte: todayStart } },
    select: { id: true, status: true }
  });

  const todayResolvedCount = await prisma.ticket.count({
    where: { ...base, status: 'Resolved', resolvedAt: { gte: todayStart } }
  });

  const jobCategories = await prisma.jobCategory.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  });
  const filteredCategories = hasCategoryFilter
    ? jobCategories.filter(cat => categoryNames.includes(cat.name))
    : jobCategories;

  const categoryMetrics = await Promise.all(
    filteredCategories.map(async (cat) => {
      const [activeCount, todayCount, resolvedTodayCount] = await Promise.all([
        prisma.ticket.count({
          where: { ...scope, jobCategoryId: cat.id, status: { notIn: ['Resolved', 'Closed'] } }
        }),
        prisma.ticket.count({
          where: { ...scope, jobCategoryId: cat.id, updatedAt: { gte: todayStart } }
        }),
        prisma.ticket.count({
          where: { ...scope, jobCategoryId: cat.id, status: 'Resolved', resolvedAt: { gte: todayStart } }
        })
      ]);
      return {
        id: cat.id,
        name: cat.name,
        score: cat.score,
        active: activeCount,
        today: todayCount,
        resolvedToday: resolvedTodayCount
      };
    })
  );

  const overview = {
    totals: {
      new: totalNew,
      open: totalOpen,
      inProgress: totalInProgress,
      pending: totalPending,
      resolvedToday: todayResolvedCount,
    },
    ticketStats: [
      { status: 'New', count: totalNew },
      { status: 'Open', count: totalOpen },
      { status: 'In Progress', count: totalInProgress },
      { status: 'Pending', count: totalPending },
      { status: 'Resolved', count: todayResolvedCount }
    ],
    avgTtrMins,
    avgTtrObj: { h: Math.floor(avgTtrMins / 60), m: avgTtrMins % 60 },
    resolvedData,
    todayTickets,
    todayResolved: todayTickets.filter(t => t.status === 'Resolved').length,
    todayResolvedCount,
    categoryMetrics,
    categoryStats: categoryMetrics
      .filter(c => c.active > 0)
      .map(c => ({ name: c.name, count: c.active })),
    picWorkloads: [],
    activeCustomerIncidents: [],
    criticalSlaTickets: [],
  };

  if (!includeSkyView) return overview;

  const skyTicketWhere = andWhere(
    { status: { notIn: ['Resolved', 'Closed'] } },
    skyTicketGuard
  );

  const picWorkloads = await prisma.user.findMany({
    where: {
      role: { name: { in: ['Staff', 'Manager', 'Admin'] } }
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { name: true } },
      tickets: {
        where: skyTicketWhere,
        select: {
          id: true,
          trackingId: true,
          title: true,
          priority: true,
          status: true,
          createdAt: true,
          jobCategory: {
            select: {
              name: true,
              score: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: {
          tickets: {
            where: skyTicketWhere
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });
  picWorkloads.sort((a, b) => b._count.tickets - a._count.tickets);

  const activeCustomerIncidents = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['Resolved', 'Closed'] },
      priority: { in: ['High', 'Critical'] }
    },
    include: {
      services: {
        include: {
          customer: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const criticalSlaTickets = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['Resolved', 'Closed'] },
      enableSla: true,
      nextSlaDeadline: { not: null }
    },
    include: {
      assignee: { select: { name: true } },
      department: { select: { name: true } },
      jobCategory: { select: { name: true } }
    },
    orderBy: { nextSlaDeadline: 'asc' },
    take: 10
  });

  return { ...overview, picWorkloads, activeCustomerIncidents, criticalSlaTickets };
}

/**
 * Live Operations Board tickets (personal-category tickets always excluded).
 * @param {object} opts
 * @param {'today'|'week'|'all'} [opts.date='today']  by updatedAt
 * @param {string} [opts.category]  job category name
 * @param {string} [opts.status]    comma list; default = everything except Closed
 * @param {string[]|null} [opts.allowedCategories]  restrict to these category names
 * @param {object} [opts.scope]     Prisma ticket where (visibility scope)
 */
export async function listLiveOpsTickets({
  date = 'today',
  category = '',
  status = '',
  allowedCategories = null,
  scope = {},
} = {}) {
  const where = {};
  if (date === 'today') {
    where.updatedAt = { gte: startOfToday() };
  } else if (date === 'week') {
    const weekAgo = startOfToday();
    weekAgo.setDate(weekAgo.getDate() - 7);
    where.updatedAt = { gte: weekAgo };
  }

  if (allowedCategories && allowedCategories.length > 0) {
    if (category) {
      where.jobCategory = { name: { in: allowedCategories.includes(category) ? [category] : [] } };
    } else {
      where.jobCategory = { name: { in: allowedCategories } };
    }
  } else if (category) {
    where.jobCategory = { name: category };
  }

  where.status = status
    ? { in: expandStatusesForQuery(status.split(',')) }
    : { notIn: ['Closed'] };

  const personalCategoryIds = await getPersonalCategoryIds(prisma);

  return prisma.ticket.findMany({
    where: andWhere(where, scope, excludePersonalFromLiveOps(personalCategoryIds)),
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
      jobCategory: { select: { id: true, name: true } },
      services: {
        include: { customer: { select: { name: true } } },
        take: 1
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          author: { select: { name: true } }
        }
      }
    },
    orderBy: [
      { slaBreaches: 'desc' },
      { updatedAt: 'desc' }
    ],
    take: 100
  });
}

/** Open SLA tickets whose next deadline is within `withinMins` from now (or already past). */
export async function listSlaAlerts({ withinMins = 2 } = {}) {
  const cutoff = new Date(Date.now() + withinMins * 60000);
  const tickets = await prisma.ticket.findMany({
    where: {
      enableSla: true,
      status: { notIn: ['Resolved', 'Closed'] },
      nextSlaDeadline: { lte: cutoff }
    },
    select: {
      id: true,
      trackingId: true,
      title: true,
      nextSlaDeadline: true
    }
  });
  return {
    triggerAlarm: tickets.length > 0,
    count: tickets.length,
    tickets
  };
}

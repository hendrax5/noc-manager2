import { prisma } from "@/lib/prisma";
import { isReplyPointsAction, isTicketCreatedAction, sumReplyAwardedScore } from "@/lib/tickets/points";
import { ticketTtrMs } from "@/lib/reports/ttr";

function isCsDepartment(name) {
  return !!name && (name.includes('CS') || name.toLowerCase().includes('customer'));
}

function scoreUser(u) {
  const legacyTaskPoints = u.tickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
  const ledgerTaskPoints = u.historyLogs.reduce((sum, h) => sum + (h.awardedScore || 0), 0);
  const taskPoints = legacyTaskPoints + ledgerTaskPoints;

  let createdCount = 0;
  let statusActionsCount = 0;
  u.historyLogs.forEach(h => {
    if (isReplyPointsAction(h.action)) return;
    if (isTicketCreatedAction(h.action)) createdCount++;
    else statusActionsCount++;
  });

  const replyPoints = sumReplyAwardedScore(u.historyLogs);
  const csEngagementScore = createdCount + replyPoints + statusActionsCount;

  return { taskPoints, createdCount, statusActionsCount, csEngagementScore };
}

/**
 * Leaderboard page data (Administration → Daily Reports).
 * @param {{ start?: string, end?: string }} opts  YYYY-MM-DD; both required to filter
 */
export async function buildLeaderboard({ start, end } = {}) {
  let dateFilter = undefined;
  if (start && end) {
    dateFilter = {
      gte: new Date(`${start}T00:00:00Z`),
      lte: new Date(`${end}T23:59:59Z`)
    };
  }

  const users = await prisma.user.findMany({
    include: {
      department: true,
      tickets: {
        where: { status: 'Resolved', awardedScore: { not: null }, ...(dateFilter && { createdAt: dateFilter }) },
        select: { awardedScore: true }
      },
      comments: {
        where: { ...(dateFilter && { createdAt: dateFilter }) },
        select: { id: true }
      },
      historyLogs: {
        where: { ...(dateFilter && { createdAt: dateFilter }) },
        select: { id: true, action: true, awardedScore: true }
      }
    }
  });

  const resolvedByAssignee = await prisma.ticket.groupBy({
    by: ["assigneeId"],
    where: {
      assigneeId: { not: null },
      status: 'Resolved',
      ...(dateFilter && { OR: [{ createdAt: dateFilter }, { updatedAt: dateFilter }] })
    },
    _count: { id: true }
  });
  const resolvedCountByUser = new Map(resolvedByAssignee.map(r => [r.assigneeId, r._count.id]));

  const techLeaderboard = [];
  const csLeaderboard = [];
  const deptPoints = {};
  let activeOperators = 0;

  users.forEach(u => {
    const isCS = isCsDepartment(u.department?.name);
    const s = scoreUser(u);

    const entry = {
      id: u.id,
      name: u.name || u.email,
      department: u.department?.name || 'General',
      taskPoints: s.taskPoints,
      resolvedCount: resolvedCountByUser.get(u.id) || 0,
      createdCount: s.createdCount,
      replyCount: u.comments.length,
      statusActionsCount: s.statusActionsCount,
      csEngagementScore: s.csEngagementScore
    };

    if (isCS) csLeaderboard.push(entry);
    else techLeaderboard.push(entry);

    const score = isCS ? s.csEngagementScore : s.taskPoints;
    if (score > 0) activeOperators++;
    const deptName = u.department?.name || "General";
    deptPoints[deptName] = (deptPoints[deptName] || 0) + score;
  });

  techLeaderboard.sort((a, b) => b.taskPoints - a.taskPoints);
  csLeaderboard.sort((a, b) => b.csEngagementScore - a.csEngagementScore);

  const resolvedTickets = await prisma.ticket.findMany({
    where: {
      status: 'Resolved',
      ...(dateFilter && { OR: [{ createdAt: dateFilter }, { updatedAt: dateFilter }] })
    },
    select: {
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      customData: true,
      jobCategory: { select: { name: true } }
    }
  });

  const categoryTTRRaw = {};
  let totalTtrMs = 0;
  let validTtrCount = 0;
  resolvedTickets.forEach(t => {
    const diff = ticketTtrMs(t, { fallbackToUpdatedAt: true });
    if (diff <= 0) return;
    totalTtrMs += diff;
    validTtrCount++;
    if (!t.jobCategory) return;
    const catName = t.jobCategory.name;
    if (!categoryTTRRaw[catName]) categoryTTRRaw[catName] = { totalMs: 0, count: 0 };
    categoryTTRRaw[catName].totalMs += diff;
    categoryTTRRaw[catName].count += 1;
  });

  const globalCategoryTtr = Object.entries(categoryTTRRaw).map(([name, data]) => {
    const avgMins = Math.round((data.totalMs / data.count) / 60000);
    return { name, avgMins, count: data.count };
  }).sort((a, b) => b.avgMins - a.avgMins); // Slower categories first

  const departments = await prisma.department.findMany({
    select: { id: true, name: true }
  });

  let leadingDept = "-";
  let maxDeptPoints = -1;
  Object.entries(deptPoints).forEach(([dept, pts]) => {
    if (pts > maxDeptPoints && pts > 0) {
      maxDeptPoints = pts;
      leadingDept = dept;
    }
  });

  return {
    techLeaderboard,
    csLeaderboard,
    globalCategoryTtr,
    departments,
    skyViewStats: {
      resolvedCount: resolvedTickets.length,
      avgTtrMins: validTtrCount > 0 ? Math.round((totalTtrMs / validTtrCount) / 60000) : 0,
      activeOperators,
      leadingDept
    }
  };
}

import { prisma } from "@/lib/prisma";
import { isTicketCreatedAction, sumReplyAwardedScore } from "@/lib/tickets/points";
import { ticketTtrMs } from "@/lib/reports/ttr";

/**
 * Per-user points & performance (same numbers as Poin saya / Performance drawer).
 * @param {{ userId: number, start?: string|null, end?: string|null }} opts  start/end = YYYY-MM-DD
 * @returns {Promise<object|null>} null when the user does not exist
 */
export async function buildUserPerformance({ userId, start, end }) {
  const startFilter = start ? new Date(start) : undefined;
  const endFilter = end ? new Date(end) : undefined;
  if (endFilter) endFilter.setHours(23, 59, 59, 999);

  const dateCondition = {};
  if (startFilter || endFilter) {
    dateCondition.createdAt = {};
    if (startFilter) dateCondition.createdAt.gte = startFilter;
    if (endFilter) dateCondition.createdAt.lte = endFilter;
  }

  const ticketDateCondition = {};
  if (startFilter || endFilter) {
    ticketDateCondition.updatedAt = {};
    if (startFilter) ticketDateCondition.updatedAt.gte = startFilter;
    if (endFilter) ticketDateCondition.updatedAt.lte = endFilter;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      meetingsAttending: { where: dateCondition, select: { id: true } },
      presentSessions: { where: dateCondition, select: { id: true } }
    }
  });

  if (!targetUser) return null;

  const isCS = targetUser.department?.name?.includes('CS') || targetUser.department?.name?.toLowerCase().includes('customer');

  const tickets = await prisma.ticket.findMany({
    where: {
      assigneeId: userId,
      ...(startFilter || endFilter ? {
        OR: [
          { createdAt: dateCondition.createdAt },
          { updatedAt: ticketDateCondition.updatedAt }
        ]
      } : {})
    },
    include: { jobCategory: true },
    orderBy: { updatedAt: 'desc' }
  });

  const totalComments = await prisma.comment.count({
    where: { authorId: userId, ...dateCondition }
  });

  // Activities ledger (exclude reply award rows; those are summed separately)
  const allActivities = await prisma.ticketHistory.findMany({
    where: {
      actorId: userId,
      action: { not: { contains: 'Reply' } },
      ...dateCondition
    },
    select: { id: true, action: true, createdAt: true, awardedScore: true, ticket: { select: { id: true, trackingId: true, title: true } } }
  });

  const replyLogs = await prisma.ticketHistory.findMany({
    where: {
      actorId: userId,
      OR: [
        { action: { startsWith: "Public reply:" } },
        { action: { startsWith: "Internal reply:" } }
      ],
      ...dateCondition
    },
    select: { action: true, awardedScore: true }
  });

  const resolvedTickets = tickets.filter(t => t.status === 'Resolved');
  const legacyTaskPoints = resolvedTickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
  const ledgerTaskPoints = allActivities.reduce((sum, h) => sum + (h.awardedScore || 0), 0);
  const taskPoints = legacyTaskPoints + ledgerTaskPoints;
  const replyPoints = sumReplyAwardedScore(replyLogs);

  let csCreatedCount = 0;
  let csStatusActionsCount = 0;
  allActivities.forEach(h => {
    if (isTicketCreatedAction(h.action)) csCreatedCount++;
    else csStatusActionsCount++;
  });

  const totalActivitiesPoints = csCreatedCount + csStatusActionsCount;
  const finalScore = taskPoints + replyPoints + (isCS ? totalActivitiesPoints : 0);

  const personalCategoryTTRRaw = {};
  resolvedTickets.forEach(t => {
    if (!t.jobCategory) return;
    const catName = t.jobCategory.name;
    const diff = ticketTtrMs(t, { fallbackToUpdatedAt: true });
    if (diff > 0) {
      if (!personalCategoryTTRRaw[catName]) {
        personalCategoryTTRRaw[catName] = { totalMs: 0, count: 0 };
      }
      personalCategoryTTRRaw[catName].totalMs += diff;
      personalCategoryTTRRaw[catName].count += 1;
    }
  });

  const personalCategoryTtr = Object.entries(personalCategoryTTRRaw).map(([name, data]) => {
    const avgMins = Math.round((data.totalMs / data.count) / 60000);
    return { name, avgMins, count: data.count };
  }).sort((a, b) => b.avgMins - a.avgMins);

  return {
    user: {
      id: targetUser.id,
      name: targetUser.name || targetUser.email,
      email: targetUser.email,
      department: targetUser.department?.name || "General",
      role: targetUser.roleId,
      avatarUrl: targetUser.avatarUrl
    },
    metrics: {
      finalScore,
      taskPoints,
      replyPoints,
      totalComments,
      resolvedCount: resolvedTickets.length,
      totalInvolvedCount: tickets.length,
      activitiesCount: allActivities.length,
      meetingsAttended: targetUser.presentSessions.length,
      meetingsScheduled: targetUser.meetingsAttending.length,
      isCS
    },
    tickets: tickets.map(t => ({
      id: t.id,
      trackingId: t.trackingId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      awardedScore: t.awardedScore || 0,
      jobCategory: t.jobCategory?.name || "Uncategorized",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
      ttrMins: t.resolvedAt ? Math.round(ticketTtrMs(t) / 60000) : null
    })),
    categoryTtr: personalCategoryTtr,
    activities: allActivities.slice(0, 15).map(h => ({
      id: h.id,
      action: h.action,
      createdAt: h.createdAt,
      awardedScore: h.awardedScore,
      ticket: h.ticket
    }))
  };
}

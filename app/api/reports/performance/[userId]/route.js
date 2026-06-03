import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const targetUserId = parseInt(resolvedParams.userId);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const startFilter = startParam ? new Date(startParam) : undefined;
    const endFilter = endParam ? new Date(endParam) : undefined;
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
      where: { id: targetUserId },
      include: {
        department: true,
        meetingsAttending: { where: dateCondition, select: { id: true } },
        presentSessions: { where: dateCondition, select: { id: true } }
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get CS/Tech indicator
    const isCS = targetUser.department?.name?.includes('CS') || targetUser.department?.name?.toLowerCase().includes('customer');

    // Fetch all tickets involving this user as assignee (regardless of status, but filtered by date)
    const tickets = await prisma.ticket.findMany({
      where: {
        assigneeId: targetUserId,
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

    // CS metrics
    const totalComments = await prisma.comment.count({
      where: { authorId: targetUserId, ...dateCondition }
    });

    // Activities ledger
    const allActivities = await prisma.ticketHistory.findMany({
      where: {
        actorId: targetUserId,
        action: { not: { contains: 'Reply' } },
        ...dateCondition
      },
      select: { id: true, action: true, createdAt: true, awardedScore: true, ticket: { select: { id: true, trackingId: true, title: true } } }
    });

    // Calculate score
    const resolvedTickets = tickets.filter(t => t.status === 'Resolved');
    const legacyTaskPoints = resolvedTickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
    const ledgerTaskPoints = allActivities.reduce((sum, h) => sum + (h.awardedScore || 0), 0);
    const taskPoints = legacyTaskPoints + ledgerTaskPoints;

    let csCreatedCount = 0;
    let csStatusActionsCount = 0;
    allActivities.forEach(h => {
      if (h.action?.includes('instantiated')) csCreatedCount++;
      else csStatusActionsCount++;
    });

    const totalActivitiesPoints = (csCreatedCount * 5) + csStatusActionsCount;
    const finalScore = taskPoints + (totalComments * 2) + (isCS ? totalActivitiesPoints : 0);

    // Compute Personal TTR per category for resolved tickets
    const personalCategoryTTRRaw = {};
    resolvedTickets.forEach(t => {
      if (!t.jobCategory) return;
      const catName = t.jobCategory.name;
      const end = t.resolvedAt || t.updatedAt;
      const diff = new Date(end).getTime() - new Date(t.createdAt).getTime();
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

    return NextResponse.json({
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
        ttrMins: t.resolvedAt ? Math.round((new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / 60000) : null
      })),
      categoryTtr: personalCategoryTtr,
      activities: allActivities.slice(0, 15).map(h => ({
        id: h.id,
        action: h.action,
        createdAt: h.createdAt,
        awardedScore: h.awardedScore,
        ticket: h.ticket
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

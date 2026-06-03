import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LeaderboardClient from "./LeaderboardClient";

export default async function ReportsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { user } = session;
  const hasPermission = user.permissions?.includes('view_reports') || user.role === 'Admin' || user.role === 'Manager';
  if (!hasPermission) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const { start, end } = params;

  let dateFilter = undefined;
  if (start && end) {
    dateFilter = {
      gte: new Date(`${start}T00:00:00Z`),
      lte: new Date(`${end}T23:59:59Z`)
    };
  }

  const userQuery = {};

  const users = await prisma.user.findMany({
    where: userQuery,
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

  const techLeaderboard = [];
  const csLeaderboard = [];

  users.forEach(u => {
    const isCS = u.department?.name?.includes('CS') || u.department?.name?.toLowerCase().includes('customer');
    
    // Tech points (Legacy resolved + New Segmented Ledger)
    const legacyTaskPoints = u.tickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
    const ledgerTaskPoints = u.historyLogs.reduce((sum, h) => sum + (h.awardedScore || 0), 0);
    const taskPoints = legacyTaskPoints + ledgerTaskPoints;
    
    // CS metrics
    let createdCount = 0;
    let statusActionsCount = 0;
    u.historyLogs.forEach(h => {
      if (h.action?.includes('instantiated')) createdCount++;
      else statusActionsCount++;
    });
    
    const replyCount = u.comments.length;
    // Base 5 pts per created ticket, 2 per reply, 1 per action
    const csEngagementScore = (createdCount * 5) + (replyCount * 2) + statusActionsCount;

    const entry = {
      id: u.id,
      name: u.name || u.email,
      department: u.department?.name || 'General',
      taskPoints,
      resolvedCount: u.tickets.length,
      createdCount,
      replyCount,
      statusActionsCount,
      csEngagementScore
    };

    if (isCS) csLeaderboard.push(entry);
    else techLeaderboard.push(entry);
  });

  techLeaderboard.sort((a, b) => b.taskPoints - a.taskPoints);
  csLeaderboard.sort((a, b) => b.csEngagementScore - a.csEngagementScore);

  // Compute Global TTR per Category
  const resolvedTickets = await prisma.ticket.findMany({
    where: { status: 'Resolved', awardedScore: { not: null }, ...(dateFilter && { createdAt: dateFilter }) },
    include: { jobCategory: true }
  });

  const categoryTTRRaw = {};
  resolvedTickets.forEach(t => {
    if (!t.jobCategory) return;
    const catName = t.jobCategory.name;
    const end = t.resolvedAt || t.updatedAt;
    const diff = new Date(end).getTime() - new Date(t.createdAt).getTime();
    if (diff > 0) {
      if (!categoryTTRRaw[catName]) categoryTTRRaw[catName] = { totalMs: 0, count: 0 };
      categoryTTRRaw[catName].totalMs += diff;
      categoryTTRRaw[catName].count += 1;
    }
  });

  const globalCategoryTtr = Object.entries(categoryTTRRaw).map(([name, data]) => {
    const avgMins = Math.round((data.totalMs / data.count) / 60000);
    return { name, avgMins, count: data.count };
  }).sort((a, b) => b.avgMins - a.avgMins); // Slower categories first

  // Fetch departments for filter
  const departments = await prisma.department.findMany({
    select: { id: true, name: true }
  });

  // Calculate Helicopter Stats
  const resolvedCount = resolvedTickets.length;
  let totalTtrMs = 0;
  let validTtrCount = 0;
  resolvedTickets.forEach(t => {
    const end = t.resolvedAt || t.updatedAt;
    const diff = new Date(end).getTime() - new Date(t.createdAt).getTime();
    if (diff > 0) {
      totalTtrMs += diff;
      validTtrCount++;
    }
  });
  const avgTtrMins = validTtrCount > 0 ? Math.round((totalTtrMs / validTtrCount) / 60000) : 0;

  const activeOperators = users.filter(u => {
    const isCS = u.department?.name?.includes('CS') || u.department?.name?.toLowerCase().includes('customer');
    if (isCS) {
      let createdCount = 0;
      let statusActionsCount = 0;
      u.historyLogs.forEach(h => {
        if (h.action?.includes('instantiated')) createdCount++;
        else statusActionsCount++;
      });
      const csScore = (createdCount * 5) + (u.comments.length * 2) + statusActionsCount;
      return csScore > 0;
    } else {
      const legacyTaskPoints = u.tickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
      const ledgerTaskPoints = u.historyLogs.reduce((sum, h) => sum + (h.awardedScore || 0), 0);
      return (legacyTaskPoints + ledgerTaskPoints) > 0;
    }
  }).length;

  const deptPoints = {};
  users.forEach(u => {
    const deptName = u.department?.name || "General";
    const isCS = u.department?.name?.includes('CS') || u.department?.name?.toLowerCase().includes('customer');
    const legacyTaskPoints = u.tickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
    const ledgerTaskPoints = u.historyLogs.reduce((sum, h) => sum + (h.awardedScore || 0), 0);
    const taskPoints = legacyTaskPoints + ledgerTaskPoints;
    let csCreatedCount = 0;
    let csStatusActionsCount = 0;
    u.historyLogs.forEach(h => {
      if (h.action?.includes('instantiated')) csCreatedCount++;
      else csStatusActionsCount++;
    });
    const csScore = (csCreatedCount * 5) + (u.comments.length * 2) + csStatusActionsCount;
    const score = isCS ? csScore : taskPoints;
    deptPoints[deptName] = (deptPoints[deptName] || 0) + score;
  });

  let leadingDept = "-";
  let maxDeptPoints = -1;
  Object.entries(deptPoints).forEach(([dept, pts]) => {
    if (pts > maxDeptPoints && pts > 0) {
      maxDeptPoints = pts;
      leadingDept = dept;
    }
  });

  const helicopterStats = {
    resolvedCount,
    avgTtrMins,
    activeOperators,
    leadingDept
  };

  return (
    <LeaderboardClient
      initialCsLeaderboard={csLeaderboard}
      initialTechLeaderboard={techLeaderboard}
      globalCategoryTtr={globalCategoryTtr}
      departments={departments}
      startDate={start || ""}
      endDate={end || ""}
      helicopterStats={helicopterStats}
    />
  );
}

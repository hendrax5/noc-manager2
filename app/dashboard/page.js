import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/config";
import DashboardClient from "./DashboardClient";
import {
  andWhere,
  getPersonalCategoryIds,
  personalTicketGuard,
} from "@/lib/tickets/personalCategories";
import { buildDashboardOverview } from "@/lib/reports/dashboard";

export default async function DashboardPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  const resolvedParams = await searchParams;

  const isAdminOrManager = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('view_reports') || session?.user?.permissions?.includes('view_all_tickets') || session?.user?.permissions?.includes('view_live_ops');
  const isCS = session?.user?.department?.includes('CS') || session?.user?.department?.toLowerCase().includes('customer');
  const hasGlobalAccess = isAdminOrManager || isCS || session?.user?.permissions?.includes('view_all_tickets');
  const hasSkyViewAccess = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('view_live_ops') || session?.user?.permissions?.includes('view_reports');

  // Retrieve department configuration
  const config = await getAppConfig();
  const userDept = session?.user?.department || "General";
  const deptConfig = config.dashboardDeptConfig?.[userDept] || {};

  // Resolve widget visibility
  const activeWidgets = deptConfig.widgets || ["kpi", "category_monitor", "live_ops", "my_followups", "shifts", "charts"];
  const showKPIs = activeWidgets.includes("kpi");
  const showCategoryMonitor = activeWidgets.includes("category_monitor");
  const showLiveOps = activeWidgets.includes("live_ops");
  const showMyFollowups = activeWidgets.includes("my_followups");
  const showShifts = activeWidgets.includes("shifts");
  const showCharts = activeWidgets.includes("charts");

  // Resolve scope overrides
  const defaultScopeOverride = deptConfig.defaultScope || (hasGlobalAccess ? 'all' : 'me');
  const selectedScope = resolvedParams?.scope || defaultScopeOverride;

  // Resolve allowed scopes for security
  const allowedScopes = ['me'];
  if (hasGlobalAccess || deptConfig.defaultScope === 'all') {
    allowedScopes.push('all');
  }
  if (hasGlobalAccess || deptConfig.defaultScope === 'dept' || session?.user?.departmentId) {
    allowedScopes.push('dept');
  }

  // Ensure selected scope is allowed, otherwise fallback
  const finalScope = allowedScopes.includes(selectedScope) ? selectedScope : defaultScopeOverride;

  // Scope Isolation (Tickets assigned to user or their department/global)
  let scope = {};
  if (finalScope === 'all') {
    scope = {};
  } else if (finalScope === 'dept') {
    scope = {
      OR: [
        { assigneeId: parseInt(session?.user?.id) },
        { departmentId: parseInt(session?.user?.departmentId) || -1 }
      ]
    };
  } else {
    scope = { assigneeId: parseInt(session?.user?.id) };
  }

  const personalCategoryIds = await getPersonalCategoryIds(prisma);
  scope = andWhere(
    scope,
    personalTicketGuard({ user: session?.user, personalCategoryIds })
  );

  const {
    totals,
    ticketStats,
    avgTtrObj,
    resolvedData,
    todayTickets,
    todayResolved,
    todayResolvedCount,
    categoryMetrics,
    categoryStats,
    picWorkloads,
    activeCustomerIncidents,
    criticalSlaTickets,
  } = await buildDashboardOverview({
    scope,
    categoryNames: deptConfig.categories || null,
    includeSkyView: hasSkyViewAccess,
    skyTicketGuard: personalTicketGuard({ user: session?.user, personalCategoryIds }),
  });
  const reportStats = [];

  // Fetch pending Open Tickets specifically allocated to them
  const myOpenTickets = await prisma.ticket.findMany({
    where: {
      assigneeId: parseInt(session?.user?.id),
      status: { notIn: ['Resolved', 'Closed'] }
    },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });

  // Fetch My Upcoming Shifts (Next 7 days)
  const today = new Date();
  today.setHours(0,0,0,0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  
  const myShifts = await prisma.shiftSchedule.findMany({
    where: { 
      userId: parseInt(session?.user?.id),
      date: { gte: today, lte: nextWeek }
    },
    include: { shiftType: true },
    orderBy: { date: 'asc' },
    take: 4
  });

  return (
    <main className="container" style={{ paddingBottom: '3rem' }}>
      <DashboardClient 
        session={session}
        hasGlobalAccess={hasGlobalAccess}
        hasSkyViewAccess={hasSkyViewAccess}
        finalScope={finalScope}
        allowedScopes={allowedScopes}
        
        // Workspace metrics
        totalNewTickets={totals.new}
        totalInProgressTickets={totals.inProgress}
        totalWaitingTickets={totals.pending}
        totalRepliedTickets={0}
        todayResolvedCount={todayResolvedCount}
        avgTtrObj={avgTtrObj}
        resolvedData={resolvedData}
        
        // Widgets config
        showKPIs={showKPIs}
        showCategoryMonitor={showCategoryMonitor}
        showLiveOps={showLiveOps}
        showMyFollowups={showMyFollowups}
        showShifts={showShifts}
        showCharts={showCharts}
        
        // Lists
        categoryMetrics={categoryMetrics}
        categoryStats={categoryStats}
        ticketStats={ticketStats}
        reportStats={reportStats}
        myOpenTickets={myOpenTickets}
        myShifts={myShifts}
        todayTickets={todayTickets}
        todayResolved={todayResolved}
        
        // Sky View data
        picWorkloads={picWorkloads}
        criticalSlaTickets={criticalSlaTickets}
        activeCustomerIncidents={activeCustomerIncidents}
      />
    </main>
  );
}

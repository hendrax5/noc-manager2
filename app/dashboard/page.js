import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/config";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  const resolvedParams = await searchParams;

  const isAdminOrManager = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('view_reports') || session?.user?.permissions?.includes('view_all_tickets') || session?.user?.permissions?.includes('view_live_ops');
  const isCS = session?.user?.department?.includes('CS') || session?.user?.department?.toLowerCase().includes('customer');
  const hasGlobalAccess = isAdminOrManager || isCS || session?.user?.permissions?.includes('view_all_tickets');
  const hasSkyViewAccess = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('view_live_ops') || session?.user?.permissions?.includes('view_reports');

  // Retrieve department configuration
  const config = getAppConfig();
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

  // Category filter based on department config
  const hasCategoryFilter = deptConfig.categories && deptConfig.categories.length > 0;
  const categoryFilterClause = hasCategoryFilter ? { jobCategory: { name: { in: deptConfig.categories } } } : {};

  // Fetch metrics
  const totalNewTickets = await prisma.ticket.count({ where: { ...scope, ...categoryFilterClause, status: 'New' } });
  const totalWaitingTickets = await prisma.ticket.count({ where: { ...scope, ...categoryFilterClause, status: 'Waiting Reply' } });
  const totalRepliedTickets = await prisma.ticket.count({ where: { ...scope, ...categoryFilterClause, status: 'Replied' } });
  const totalInProgressTickets = await prisma.ticket.count({ where: { ...scope, ...categoryFilterClause, status: 'In Progress' } });
  
  const ticketStats = [
    { status: 'New', count: totalNewTickets },
    { status: 'In Progress', count: totalInProgressTickets },
    { status: 'Wait Reply', count: totalWaitingTickets },
    { status: 'Replied', count: totalRepliedTickets },
    { status: 'Resolved', count: 0 } // Computed dynamically client-side or populated below
  ];

  // Compute Average TTR (Time to Resolution)
  const resolvedData = await prisma.ticket.findMany({
    where: { ...scope, ...categoryFilterClause, status: 'Resolved' },
    select: { createdAt: true, updatedAt: true, resolvedAt: true }
  });
  let totalTtrMs = 0;
  resolvedData.forEach(t => {
    const diff = new Date(t.resolvedAt || t.updatedAt).getTime() - new Date(t.createdAt).getTime();
    if (diff > 0) totalTtrMs += diff;
  });
  const avgTtrMins = resolvedData.length > 0 ? Math.round((totalTtrMs / resolvedData.length) / 60000) : 0;
  const avgTtrObj = {
    h: Math.floor(avgTtrMins / 60),
    m: avgTtrMins % 60
  };

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

  // Auto-Report Logic (Today's Touched & Resolved Tickets)
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const todayTickets = await prisma.ticket.findMany({
    where: { 
      ...scope,
      ...categoryFilterClause,
      updatedAt: { gte: todayStart }
    },
    select: { id: true, status: true }
  });
  const todayResolved = todayTickets.filter(t => t.status === 'Resolved').length;
  
  const reportStats = [];

  const jobCategories = await prisma.jobCategory.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  });

  // Filter job categories by department config
  const filteredCategories = hasCategoryFilter 
    ? jobCategories.filter(cat => deptConfig.categories.includes(cat.name))
    : jobCategories;

  // Count active tickets per category
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

  // Category stats for chart (only categories with active tickets)
  const categoryStats = categoryMetrics
    .filter(c => c.active > 0)
    .map(c => ({ name: c.name, count: c.active }));

  // Count today's resolved
  const todayResolvedCount = await prisma.ticket.count({
    where: { ...scope, ...categoryFilterClause, status: 'Resolved', resolvedAt: { gte: todayStart } }
  });
  ticketStats[4].count = todayResolvedCount;

  // ================================================
  // Sky View Specific Queries
  // ================================================
  let picWorkloads = [];
  let criticalSlaTickets = [];
  let activeCustomerIncidents = [];

  if (hasSkyViewAccess) {
    // 1. NOC Staff workloads (active ticket counts assigned per staff)
    picWorkloads = await prisma.user.findMany({
      where: {
        role: { name: { in: ['Staff', 'Manager', 'Admin'] } }
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
        tickets: {
          where: { status: { notIn: ['Resolved', 'Closed'] } },
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
              where: { status: { notIn: ['Resolved', 'Closed'] } }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Sort by workloads descending for better visibility
    picWorkloads.sort((a, b) => b._count.tickets - a._count.tickets);

    // 2. Active critical/high incidents grouped by customer/client
    activeCustomerIncidents = await prisma.ticket.findMany({
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

    // 3. Early warning SLA countdown list (tickets closest to breach)
    criticalSlaTickets = await prisma.ticket.findMany({
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
  }

  return (
    <main className="container" style={{ paddingBottom: '3rem' }}>
      <DashboardClient 
        session={session}
        hasGlobalAccess={hasGlobalAccess}
        hasSkyViewAccess={hasSkyViewAccess}
        finalScope={finalScope}
        allowedScopes={allowedScopes}
        
        // Workspace metrics
        totalNewTickets={totalNewTickets}
        totalInProgressTickets={totalInProgressTickets}
        totalWaitingTickets={totalWaitingTickets}
        totalRepliedTickets={totalRepliedTickets}
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

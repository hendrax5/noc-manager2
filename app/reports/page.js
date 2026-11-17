import {workflowFlags} from '@/lib/workflows/flags';
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import LeaderboardClient from "./LeaderboardClient";
import ServiceDeskMetrics from "./ServiceDeskMetrics";
import KinerjaClient from './KinerjaClient';
import {prisma} from '@/lib/prisma';
import {jakartaMonthKey,jakartaMonthRange,previousMonthKey} from '@/lib/reports/monthPeriod';
import {resolveCompareMonthKey} from '@/lib/reports/performanceComparison';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {canReadReport} from '@/lib/reports/reportScope';
import { canViewAllPerformance } from "@/lib/reports/performanceAccess";
import { buildLeaderboard } from "@/lib/reports/leaderboard";

export default async function ReportsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const params = await searchParams;
  if((await workflowFlags()).unified_performance_ui){
    const month=params.month||jakartaMonthKey();
    const range=jakartaMonthRange(month);
    let compareMonth=previousMonthKey(month);
    if(params.compareMonth){
      try{compareMonth=resolveCompareMonthKey(month,params.compareMonth);}catch{compareMonth=previousMonthKey(month);}
    }
    const {scope,users}=await loadReportScope(prisma,session.user,range.gte);
    const hasTeamAccess=users.some(u=>u.id!==Number(session.user.id)&&canReadReport(scope,u.id));
    const initialTab=
      params.tab==='activity'||params.legacy==='1'
        ?'activity'
        :params.tab==='self'
          ?'self'
          :hasTeamAccess?'team':'self';
    return (
      <main className="container">
        <KinerjaClient
          initialMonth={month}
          initialCompareMonth={compareMonth}
          initialTab={initialTab}
          hasTeamAccess={hasTeamAccess}
        />
      </main>
    );
  }
  if ((await workflowFlags()).monthly_evaluation_mode !== 'off' && params.legacy !== '1') redirect('/reports/evaluations');
  const { user } = session;
  user.reportScopeEnforced = (await workflowFlags()).privacy_enforced;
  if (user.reportScopeEnforced && user.role !== "Admin") redirect("/reports/evaluations");
  if (!canViewAllPerformance(user)) {
    redirect(`/reports/${user.id}`);
  }

  const { start, end } = params;

  const {
    techLeaderboard,
    csLeaderboard,
    globalCategoryTtr,
    departments,
    skyViewStats,
  } = await buildLeaderboard({ start, end });

  const isAdmin = user.role === 'Admin';

  return (
    <>
      <div className="container">
        <ServiceDeskMetrics days={30} />
      </div>
      <LeaderboardClient
        initialCsLeaderboard={csLeaderboard}
        initialTechLeaderboard={techLeaderboard}
        globalCategoryTtr={globalCategoryTtr}
        departments={departments}
        startDate={start || ""}
        endDate={end || ""}
        skyViewStats={skyViewStats}
        isAdmin={isAdmin}
      />
    </>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import LeaderboardClient from "./LeaderboardClient";
import ServiceDeskMetrics from "./ServiceDeskMetrics";
import { canViewAllPerformance } from "@/lib/reports/performanceAccess";
import { buildLeaderboard } from "@/lib/reports/leaderboard";

export default async function ReportsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { user } = session;
  if (!canViewAllPerformance(user)) {
    redirect(`/reports/${user.id}`);
  }

  const params = await searchParams;
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
      <div className="container" style={{ paddingBottom: 0 }}>
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

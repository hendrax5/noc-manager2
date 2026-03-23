import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";

export default async function ReportsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { user } = session;
  if (user.role !== 'Admin' && user.role !== 'Manager') {
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

  const userQuery = {}; // Admins and Managers see all

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
      else statusActionsCount++; // all other actions like status shifts, taking tickets
    });
    
    const replyCount = u.comments.length;
    // Base 5 pts per created ticket, 1 per reply, 1 per action
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

  const page = parseInt(params?.page) || 1;
  const pageSize = 5; // Hard limit to ensure zero scroll
  
  const totalCS = csLeaderboard.length;
  const paginatedCS = csLeaderboard.slice((page - 1) * pageSize, page * pageSize);
  
  const totalTech = techLeaderboard.length;
  const paginatedTech = techLeaderboard.slice((page - 1) * pageSize, page * pageSize);

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

  function formatMins(mins) {
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <main className="container">
      <header className="page-header">
        <h1>Performance Leaderboard</h1>
        <p>Automated analytical tracking of resolved tickets and accrued job category points.</p>
      </header>


      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0 }}>Global Average TTR by Category</h2>
      </div>
      
      {globalCategoryTtr.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No category resolution data available.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {globalCategoryTtr.map(cat => (
             <div key={cat.name} className="card" style={{ margin: 0, padding: '1rem', borderLeft: `4px solid ${cat.avgMins > 120 ? '#ef4444' : (cat.avgMins > 60 ? '#f59e0b' : '#10b981')}` }}>
               <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#475569' }}>{cat.name}</h3>
               <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                 <span style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1', color: '#1e293b' }}>{formatMins(cat.avgMins)}</span>
                 <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>/{cat.count}</span>
               </div>
             </div>
          ))}
        </div>
      )}

      {/* Two Columns Grid for Tables to Eliminate Vertical Scroll */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Left Column: CS */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0 }}>CS Engagement</h2>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Operator</th>
                  <th style={{ textAlign: 'center' }}>Tickets</th>
                  <th style={{ textAlign: 'center' }}>Msgs</th>
                  <th style={{ textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCS.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No CS data available for this range.</td></tr>
                )}
                {paginatedCS.map((l, index) => {
                  const rank = (page - 1) * pageSize + index + 1;
                  return (
                  <tr key={l.id}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#334155' }}>
                      #{rank}
                    </td>
                    <td style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                      <a href={`/reports/${l.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>{l.name}</a>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>{l.createdCount}</td>
                    <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>{l.replyCount}</td>
                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#3b82f6', fontSize: '1rem' }}>{l.csEngagementScore}</td>
                  </tr>
                )})}
              </tbody>
            </table>
            {totalCS > pageSize && <div style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}><Pagination totalCount={totalCS} pageSize={pageSize} /></div>}
          </div>
        </div>

        {/* Right Column: Tech */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0 }}>Tech Resolves</h2>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Technician</th>
                  <th style={{ textAlign: 'right' }}>Solved</th>
                  <th style={{ textAlign: 'right' }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTech.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No technical data.</td></tr>
                )}
                {paginatedTech.map((l, index) => {
                  const rank = (page - 1) * pageSize + index + 1;
                  return (
                  <tr key={l.id}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#334155' }}>
                      #{rank}
                    </td>
                    <td style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                      <a href={`/reports/${l.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>{l.name}</a>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.department}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '500' }}>{l.resolvedCount }</td>
                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#10b981', fontSize: '1rem' }}>{l.taskPoints}</td>
                  </tr>
                )})}
              </tbody>
            </table>
            {totalTech > pageSize && <div style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}><Pagination totalCount={totalTech} pageSize={pageSize} /></div>}
          </div>
        </div>

      </div>
    </main>
  );
}

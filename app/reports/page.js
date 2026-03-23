import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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
        select: { id: true, action: true } 
      }
    }
  });

  const techLeaderboard = [];
  const csLeaderboard = [];

  users.forEach(u => {
    const isCS = u.department?.name?.includes('CS') || u.department?.name?.toLowerCase().includes('customer');
    
    // Tech points
    const taskPoints = u.tickets.reduce((sum, t) => sum + (t.awardedScore || 0), 0);
    
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

  return (
    <main className="container">
      <header className="page-header">
        <h1>Performance Leaderboard</h1>
        <p>Automated analytical tracking of resolved tickets and accrued job category points.</p>
      </header>

      <form method="GET" action="/reports" style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>Start Date</label>
          <input type="date" name="start" defaultValue={start || ''} required style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>End Date</label>
          <input type="date" name="end" defaultValue={end || ''} required style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="primary-btn" style={{ padding: '0.85rem 1.5rem', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Filter Date</button>
          <a href="/reports" style={{ padding: '0.85rem 1.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center' }}>Clear</a>
        </div>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Customer Service (CS) Engagement</h2>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '3rem' }}>
        <table className="data-table">
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
              <th>Operator</th>
              <th style={{ textAlign: 'center' }}>Tickets Created</th>
              <th style={{ textAlign: 'center' }}>Client Replies</th>
              <th style={{ textAlign: 'center' }}>Status Actions</th>
              <th style={{ textAlign: 'right' }}>Total Engagement Score</th>
            </tr>
          </thead>
          <tbody>
            {csLeaderboard.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No CS data available for this range.</td></tr>
            )}
            {csLeaderboard.map((l, index) => (
              <tr key={l.id}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#334155' }}>
                  #{index + 1}
                </td>
                <td style={{ fontWeight: '600', fontSize: '1.05rem' }}>
                  <a href={`/reports/${l.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>{l.name}</a>
                </td>
                <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>{l.createdCount} <span style={{fontSize: '0.8rem'}}>tkts</span></td>
                <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>{l.replyCount} <span style={{fontSize: '0.8rem'}}>msgs</span></td>
                <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>{l.statusActionsCount} <span style={{fontSize: '0.8rem'}}>acts</span></td>
                <td style={{ textAlign: 'right', fontWeight: '800', color: '#3b82f6', fontSize: '1.1rem' }}>{l.csEngagementScore} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>pts</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Technical Resolution Leaderboard</h2>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
              <th>Technician / NOC Staff</th>
              <th>Department</th>
              <th style={{ textAlign: 'right' }}>Tickets Resolved</th>
              <th style={{ textAlign: 'right' }}>Total Task Score</th>
            </tr>
          </thead>
          <tbody>
            {techLeaderboard.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No technical data available for this range.</td></tr>
            )}
            {techLeaderboard.map((l, index) => (
              <tr key={l.id}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#334155' }}>
                  #{index + 1}
                </td>
                <td style={{ fontWeight: '600', fontSize: '1.05rem' }}>
                  <a href={`/reports/${l.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>{l.name}</a>
                </td>
                <td><span className="badge" style={{ backgroundColor: '#64748b' }}>{l.department}</span></td>
                <td style={{ textAlign: 'right', fontWeight: '500' }}>{l.resolvedCount }</td>
                <td style={{ textAlign: 'right', fontWeight: '800', color: '#10b981', fontSize: '1.1rem' }}>{l.taskPoints} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>pts</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

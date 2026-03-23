import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Pagination from "@/components/Pagination";

import ReportFilter from "./ReportFilter";

export default async function UserReportDetail({ params, searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const resolvedParams = await params;
  const targetUserId = parseInt(resolvedParams.userId);
  
  const resolvedSearchParams = await searchParams;
  const startFilter = resolvedSearchParams.start ? new Date(resolvedSearchParams.start) : undefined;
  const endFilter = resolvedSearchParams.end ? new Date(resolvedSearchParams.end) : undefined;
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
      comments: { 
        where: dateCondition,
        select: { id: true, createdAt: true, ticket: { select: { title: true, id: true, trackingId: true } } }, 
        orderBy: { createdAt: 'desc' }, 
        take: 10 
      },
      historyLogs: { 
        where: { action: { not: { contains: 'Reply' } }, ...dateCondition },
        select: { id: true, action: true, createdAt: true, ticket: { select: { title: true, id: true, trackingId: true } } }, 
        orderBy: { createdAt: 'desc' }, 
        take: 10 
      },
      meetingsAttending: { where: dateCondition, select: { id: true } },
      presentSessions: { where: dateCondition, select: { id: true } }
    }
  });

  if (!targetUser) return <main className="container"><h1>User Not Found</h1></main>;

  if (session.user.role !== 'Admin' && session.user.role !== 'Manager') {
    redirect("/dashboard");
  }

  const isCSTarget = targetUser.department?.name?.includes('CS') || targetUser.department?.name?.toLowerCase().includes('customer');

  const tickets = await prisma.ticket.findMany({
    where: { assigneeId: targetUserId, status: 'Resolved', awardedScore: { not: null }, ...ticketDateCondition },
    include: { jobCategory: true },
    orderBy: { updatedAt: 'desc' }
  });

  function formatDuration(start, end) {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs < 0) return '0m';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  }

  const totalComments = await prisma.comment.count({ where: { authorId: targetUserId, ...dateCondition } });
  
  const allActivities = await prisma.ticketHistory.findMany({ 
    where: { actorId: targetUserId, action: { not: { contains: 'Reply' } }, ...dateCondition },
    select: { action: true, awardedScore: true } 
  });

  const taskPoints = tickets.reduce((acc, t) => acc + (t.awardedScore || 0), 0) + allActivities.reduce((acc, h) => acc + (h.awardedScore || 0), 0);
  
  const totalActivitiesPoints = allActivities.reduce((sum, log) => {
    return sum + (log.action && log.action.includes('instantiated') ? 5 : 1);
  }, 0);

  const finalScore = taskPoints + totalComments + (isCSTarget ? totalActivitiesPoints : 0);

  // Compute Personal TTR per Category
  const personalCategoryTTRRaw = {};
  tickets.forEach(t => {
    if (!t.jobCategory) return;
    const catName = t.jobCategory.name;
    const end = t.resolvedAt || t.updatedAt;
    const diff = new Date(end).getTime() - new Date(t.createdAt).getTime();
    if (diff > 0) {
      if (!personalCategoryTTRRaw[catName]) personalCategoryTTRRaw[catName] = { totalMs: 0, count: 0 };
      personalCategoryTTRRaw[catName].totalMs += diff;
      personalCategoryTTRRaw[catName].count += 1;
    }
  });

  const personalCategoryTtr = Object.entries(personalCategoryTTRRaw).map(([name, data]) => {
    const avgMins = Math.round((data.totalMs / data.count) / 60000);
    return { name, avgMins, count: data.count };
  }).sort((a, b) => b.avgMins - a.avgMins);

  const page = parseInt(resolvedSearchParams?.page) || 1;
  const pageSize = 5; // Aggressive scale-down to avoid scroll
  const totalTicketsCount = tickets.length;
  const paginatedTickets = tickets.slice((page - 1) * pageSize, page * pageSize);

  return (
    <main className="container">
      <Link href="/reports" className="no-print" style={{ display: 'inline-block', marginBottom: '1rem', color: '#64748b', textDecoration: 'none', fontWeight: 'bold' }}>
        ← Back to Leaderboard
      </Link>
      
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Performance Report: {targetUser.name || targetUser.email}</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
            <span className="badge" style={{ backgroundColor: '#64748b' }}>{targetUser.department?.name}</span>
            <span>Cumulative Impact Score: <strong style={{color: '#10b981', fontSize: '1.2rem'}}>{finalScore} pts</strong></span>
          </p>
          {(startFilter || endFilter) && (
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
              Filtered from {startFilter ? startFilter.toLocaleDateString() : 'Beginning'} to {endFilter ? endFilter.toLocaleDateString() : 'Now'}
            </p>
          )}
        </div>
      </header>

      <ReportFilter userId={targetUserId} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Job Categories Resolved</h3>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>{taskPoints} <small style={{fontSize: '0.8rem', color: '#94a3b8'}}>pts</small></span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Ticket Responses</h3>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{totalComments} <small style={{fontSize: '0.8rem', color: '#94a3b8'}}>pts</small></span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem', opacity: isCSTarget ? 1 : 0.5 }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Administrative Actions</h3>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{isCSTarget ? totalActivitiesPoints : 0} <small style={{fontSize: '0.8rem', color: '#94a3b8'}}>{isCSTarget ? 'pts' : '(N/A)'}</small></span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Meeting Attendance</h3>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{targetUser.presentSessions.length} <small style={{fontSize: '0.8rem', color: '#94a3b8'}}>/ {targetUser.meetingsAttending.length}</small></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Personal Category TTR */}
        {personalCategoryTtr.length > 0 && (
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <h3 style={{ padding: '1rem', margin: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '1rem' }}>Personal TTR Averages</h3>
            <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {personalCategoryTtr.map(cat => {
                const isSlow = cat.avgMins > 120;
                return (
                  <div key={cat.name} style={{ padding: '0.75rem', borderRadius: '6px', border: `1px solid ${isSlow ? '#fca5a5' : '#e2e8f0'}`, background: isSlow ? '#fef2f2' : '#f8fafc', flex: '1 1 150px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>{cat.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isSlow ? '#ef4444' : '#0f172a' }}>{formatDuration(0, cat.avgMins * 60000)}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({cat.count} tkts)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-Columns Layout for Tables */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Resolved Tickets Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <h3 style={{ padding: '1rem', margin: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '1rem' }}>Technician Resolves</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.5rem 1rem' }}>TTR</th>
                  <th style={{ padding: '0.5rem 1rem' }}>Ticket</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 1rem' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No scored tickets found.</td></tr>}
                {paginatedTickets.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(t.updatedAt).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '0.85rem' }}>{formatDuration(t.createdAt, t.resolvedAt || t.updatedAt)}</td>
                    <td style={{ fontWeight: 'bold', fontSize: '0.85rem' }}><Link href={`/tickets/${t.id}`} style={{color: 'var(--primary-color)'}}>{t.trackingId}</Link></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#10b981', fontSize: '0.85rem' }}>+{t.awardedScore} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalTicketsCount > pageSize && <div style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}><Pagination totalCount={totalTicketsCount} pageSize={pageSize} /></div>}
          </div>

          {/* Recent Responses Table */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <h3 style={{ padding: '1rem', margin: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '1rem' }}>Recent Responses</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 1rem' }}>Time</th>
                  <th style={{ padding: '0.5rem 1rem' }}>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {targetUser.comments.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: '2rem' }}>No responses logged.</td></tr>}
                {targetUser.comments.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td style={{ fontSize: '0.85rem' }}><Link href={`/tickets/${c.ticket.id}`} style={{color: '#3b82f6'}}>{c.ticket.trackingId}</Link> - {c.ticket.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}

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

  if (!session.user.permissions?.includes('report.view')) {
    redirect("/dashboard");
  }

  const isCSTarget = targetUser.department?.name?.includes('CS') || targetUser.department?.name?.toLowerCase().includes('customer');

  const tickets = await prisma.ticket.findMany({
    where: { assigneeId: targetUserId, status: 'Resolved', ...ticketDateCondition },
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h3 style={{ margin: 0, color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Job Categories Resolved</h3>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{taskPoints} <small style={{fontSize: '1rem', color: '#64748b', fontWeight: 'bold'}}>pts</small></span>
        </div>
        <div className="hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.05)' }}>
          <h3 style={{ margin: 0, color: '#2563eb', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Ticket Responses</h3>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1d4ed8', lineHeight: 1 }}>{totalComments} <small style={{fontSize: '1rem', color: '#60a5fa', fontWeight: 'bold'}}>pts</small></span>
        </div>
        <div className="hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.05)', opacity: isCSTarget ? 1 : 0.6 }}>
          <h3 style={{ margin: 0, color: '#d97706', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Admin Actions</h3>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#b45309', lineHeight: 1 }}>{isCSTarget ? totalActivitiesPoints : 0} <small style={{fontSize: '1rem', color: '#fbbf24', fontWeight: 'bold'}}>{isCSTarget ? 'pts' : '(N/A)'}</small></span>
        </div>
        <div className="hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.05)' }}>
          <h3 style={{ margin: 0, color: '#7c3aed', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Meeting Attendance</h3>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#6d28d9', lineHeight: 1 }}>{targetUser.presentSessions.length} <small style={{fontSize: '1.2rem', color: '#a78bfa', fontWeight: 'bold'}}>/ {targetUser.meetingsAttending.length}</small></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Personal Category TTR - Bento Grid Style */}
        {personalCategoryTtr.length > 0 && (
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#0f172a', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{fontSize: '1.4rem'}}>⏱️</span> Average TTR per Job Category
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {personalCategoryTtr.map(cat => {
                const isSlow = cat.avgMins > 120;
                return (
                  <div key={cat.name} style={{ padding: '1rem', borderRadius: '12px', border: `1px solid ${isSlow ? '#fca5a5' : '#e2e8f0'}`, background: isSlow ? '#fef2f2' : '#f8fafc', position: 'relative' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.6rem', fontWeight: '900', color: isSlow ? '#ef4444' : '#0f172a', lineHeight: 1 }}>{formatDuration(0, cat.avgMins * 60000)}</span>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'inline-block', fontSize: '0.75rem', fontWeight: '600', padding: '0.2rem 0.5rem', borderRadius: '99px', background: '#e2e8f0', color: '#475569' }}>
                      {cat.count} tickets
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-Columns Layout for Tables */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
          {/* Resolved Tickets Table */}
          <div className="glass-panel" style={{ padding: '0', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{fontSize: '1.2rem'}}>✅</span> Technician Resolves
              </h3>
            </div>
            <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Date</th>
                  <th style={{ padding: '1rem' }}>Category</th>
                  <th style={{ padding: '1rem' }}>TTR</th>
                  <th style={{ padding: '1rem' }}>Ticket</th>
                  <th style={{ textAlign: 'right', padding: '1rem' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No scored tickets found.</td></tr>}
                {paginatedTickets.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', color: '#475569', fontSize: '0.9rem' }}>{new Date(t.updatedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.2rem 0.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '6px' }}>
                        {t.jobCategory?.name || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: '#3b82f6', fontSize: '0.9rem' }}>{formatDuration(t.createdAt, t.resolvedAt || t.updatedAt)}</td>
                    <td style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>
                      <Link href={`/tickets/${t.id}`} style={{color: '#0f172a', textDecoration: 'none'}} className="hover-link">{t.trackingId}</Link>
                    </td>
                    <td style={{ textAlign: 'right', padding: '1rem', fontWeight: '800', color: '#10b981', fontSize: '0.95rem' }}>+{t.awardedScore || 0} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalTicketsCount > pageSize && <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: '#f8fafc' }}><Pagination totalCount={totalTicketsCount} pageSize={pageSize} /></div>}
          </div>

          {/* Recent Responses Table */}
          <div className="glass-panel" style={{ padding: '0', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{fontSize: '1.2rem'}}>💬</span> Recent Responses
              </h3>
            </div>
            <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Time</th>
                  <th style={{ padding: '1rem' }}>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {targetUser.comments.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No responses logged.</td></tr>}
                {targetUser.comments.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', color: '#475569', fontSize: '0.9rem' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      <Link href={`/tickets/${c.ticket.id}`} style={{color: '#3b82f6', textDecoration: 'none', fontWeight: '600'}} className="hover-link">{c.ticket.trackingId}</Link>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                        {c.ticket.title}
                      </div>
                    </td>
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

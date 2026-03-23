import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

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
        take: 20 
      },
      historyLogs: { 
        where: { action: { not: { contains: 'Reply' } }, ...dateCondition },
        select: { id: true, action: true, createdAt: true, ticket: { select: { title: true, id: true, trackingId: true } } }, 
        orderBy: { createdAt: 'desc' }, 
        take: 20 
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

  const taskPoints = tickets.reduce((acc, t) => acc + (t.awardedScore || 0), 0);
  
  const totalComments = await prisma.comment.count({ where: { authorId: targetUserId, ...dateCondition } });
  
  const allActivities = await prisma.ticketHistory.findMany({ 
    where: { actorId: targetUserId, action: { not: { contains: 'Reply' } }, ...dateCondition },
    select: { action: true } 
  });
  
  const totalActivitiesPoints = allActivities.reduce((sum, log) => {
    return sum + (log.action && log.action.includes('instantiated') ? 5 : 1);
  }, 0);

  const finalScore = taskPoints + totalComments + (isCSTarget ? totalActivitiesPoints : 0);

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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Job Categories Resolved</h3>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>{taskPoints} <small style={{fontSize: '1rem', color: '#94a3b8'}}>pts</small></span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Ticket Responses (Comments)</h3>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{totalComments} <small style={{fontSize: '1rem', color: '#94a3b8'}}>pts</small></span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: isCSTarget ? 1 : 0.5 }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Administrative Actions</h3>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{isCSTarget ? totalActivitiesPoints : 0} <small style={{fontSize: '1rem', color: '#94a3b8'}}>{isCSTarget ? 'pts' : '(N/A for Techs)'}</small></span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Meeting Attendance</h3>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{targetUser.presentSessions.length} <small style={{fontSize: '1rem', color: '#94a3b8'}}>/ {targetUser.meetingsAttending.length}</small></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Resolved Tickets Table */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <h3 style={{ padding: '1.5rem', margin: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>Technician Resolves (Scored)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date Resolved</th>
                <th>Tracking ID</th>
                <th>Job Category</th>
                <th style={{ textAlign: 'right' }}>Score Awarded</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No scored tickets found.</td></tr>}
              {tickets.map(t => (
                <tr key={t.id}>
                  <td style={{ color: '#64748b' }}>{new Date(t.updatedAt).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 'bold' }}><Link href={`/tickets/${t.id}`} style={{color: 'var(--primary-color)'}}>{t.trackingId}</Link></td>
                  <td>{t.jobCategory?.name || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>+{t.awardedScore} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Responses Table */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <h3 style={{ padding: '1.5rem', margin: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>Recent Ticket Responses (+1 pt)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Tracking ID</th>
                <th>Ticket Subject</th>
              </tr>
            </thead>
            <tbody>
              {targetUser.comments.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No responses logged.</td></tr>}
              {targetUser.comments.map(c => (
                <tr key={c.id}>
                  <td style={{ color: '#64748b' }}>{new Date(c.createdAt).toLocaleString('id-ID')}</td>
                  <td style={{ fontWeight: 'bold' }}><Link href={`/tickets/${c.ticket.id}`} style={{color: '#3b82f6'}}>{c.ticket.trackingId}</Link></td>
                  <td>{c.ticket.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";

export default async function MeetingsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams?.page) || 1;
  const viewParam = resolvedParams?.view || "grid";
  const pageSize = 6;

  const userId = parseInt(session.user.id);
  const userDeptId = parseInt(session.user.departmentId);

  const authWhere = {
    OR: [
      { visibility: "Public" },
      { organizedById: userId },
      { attendees: { some: { id: userId } } },
      { permittedDepartments: { some: { id: userDeptId } } }
    ]
  };

  const [totalMeetings, meetings] = await Promise.all([
    prisma.meeting.count({ where: authWhere }),
    prisma.meeting.findMany({
      where: authWhere,
      include: { organizedBy: true, attendees: true },
      orderBy: { scheduledAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize
    })
  ]);

  return (
    <main className="container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Meetings & Syncs</h1>
          <p>Schedule and manage NOC hand-overs, incident post-mortems, and reviews.</p>
        </div>
        <Link href="/meetings/new" className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>Schedule Meeting</Link>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
         <Link href={`/meetings?${new URLSearchParams({...resolvedParams, view: 'grid'}).toString()}`} style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: viewParam === 'grid' ? 'var(--primary-color)' : '#64748b', fontWeight: viewParam === 'grid' ? 'bold' : '500', borderBottom: viewParam === 'grid' ? '3px solid var(--primary-color)' : 'none', marginBottom: '-9px' }}>
            ⊞ Grid View
         </Link>
         <Link href={`/meetings?${new URLSearchParams({...resolvedParams, view: 'timeline'}).toString()}`} style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: viewParam === 'timeline' ? 'var(--primary-color)' : '#64748b', fontWeight: viewParam === 'timeline' ? 'bold' : '500', borderBottom: viewParam === 'timeline' ? '3px solid var(--primary-color)' : 'none', marginBottom: '-9px' }}>
            📜 Timeline View
         </Link>
      </div>

      {viewParam === 'grid' ? (
      <div className="dashboard-grid">
        {meetings.length === 0 && <p style={{ gridColumn: '1 / -1' }}>No upcoming meetings.</p>}
        {meetings.map(m => (
          <div key={m.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>{m.title}</h3>
                <span className="badge" style={{ backgroundColor: m.status === 'Completed' ? '#10b981' : m.status === 'In Progress' ? '#3b82f6' : '#64748b' }}>
                  {m.status}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge" style={{ backgroundColor: '#f59e0b', display: 'block', marginBottom: '0.25rem' }}>
                  {new Date(m.scheduledAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Org: {m.organizedBy?.name || 'System'}</span>
              </div>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', color: '#475569', fontSize: '0.9rem', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              <strong>Agenda:</strong> {m.agenda || "No agenda attached."}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {m.attendees?.length || 0} Attendees Invoked
              </span>
              <a href={`/meetings/${m.id}`} className="primary-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', textDecoration: 'none', background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}>
                Enter Control Room →
              </a>
            </div>
          </div>
        ))}
      </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '2rem', borderLeft: '3px solid #e2e8f0', marginLeft: '1rem' }}>
        {meetings.length === 0 && <p>No upcoming meetings.</p>}
        {meetings.map(m => (
          <div key={`tl-${m.id}`} style={{ position: 'relative', background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
             <div style={{ position: 'absolute', left: '-2.65rem', top: '20px', width: '20px', height: '20px', borderRadius: '50%', background: m.status === 'Completed' ? '#10b981' : m.status === 'In Progress' ? '#3b82f6' : '#94a3b8', border: '4px solid white', boxShadow: '0 0 0 1px #cbd5e1' }}></div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>{new Date(m.scheduledAt).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' })}</span>
                <span className="badge" style={{ backgroundColor: m.status === 'Completed' ? '#10b981' : m.status === 'In Progress' ? '#3b82f6' : '#64748b' }}>{m.status}</span>
             </div>
             <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>
               <Link href={`/meetings/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{m.title}</Link>
             </h3>
             <p style={{ margin: '0 0 1rem 0', color: '#475569', fontSize: '0.9rem' }}>{m.agenda || 'No agenda attached.'}</p>
             <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>👤 Org: {m.organizedBy?.name || 'System'}</span>
                <span>👥 {m.attendees?.length || 0} Attendees</span>
             </div>
          </div>
        ))}
      </div>
      )}
      
      
      {totalMeetings > pageSize && <Pagination totalCount={totalMeetings} pageSize={pageSize} />}
    </main>
  );
}

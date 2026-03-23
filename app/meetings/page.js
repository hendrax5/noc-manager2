import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const meetings = await prisma.meeting.findMany({
    include: { organizedBy: true, attendees: true },
    orderBy: { scheduledAt: 'desc' }
  });

  return (
    <main className="container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Meetings & Syncs</h1>
          <p>Schedule and manage NOC hand-overs, incident post-mortems, and reviews.</p>
        </div>
        <Link href="/meetings/new" className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>Schedule Meeting</Link>
      </header>

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
    </main>
  );
}

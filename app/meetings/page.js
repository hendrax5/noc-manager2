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
  const pageSize = 6;

  const [totalMeetings, meetings] = await Promise.all([
    prisma.meeting.count(),
    prisma.meeting.findMany({
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
        {(session.user.permissions?.includes('manage_meetings') || session.user.role === 'Admin') && (
          <Link href="/meetings/new" className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>Schedule Meeting</Link>
        )}
      </header>

      <div className="dashboard-grid">
        {meetings.length === 0 && <p style={{ gridColumn: '1 / -1' }}>No upcoming meetings.</p>}
        {meetings.map(m => (
          <div key={m.id} className="card">
            <div className="ui-static-3e8220669e" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div className="ui-static-af81cc4264" style={{display: 'flex', alignItems: 'center'}}>
                <h3 className="ui-static-d826886008" >{m.title}</h3>
                <span className="badge" style={{ backgroundColor: m.status === 'Completed' ? "var(--ui-success)" : m.status === 'In Progress' ? "var(--ui-info)" : "var(--ui-info)" }}>
                  {m.status}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge ui-static-99a7c447a7" style={{display: 'block'}}>
                  {new Date(m.scheduledAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <span className="ui-static-f0ec965903" >Org: {m.organizedBy?.name || 'System'}</span>
              </div>
            </div>
            <p className="ui-static-540c2f76be" style={{whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
              <strong>Agenda:</strong> {m.agenda || "No agenda attached."}
            </p>
            <div className="ui-static-948cfb11c2" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span className="ui-static-bb72f3d5d6" >
                {m.attendees?.length || 0} Attendees Invoked
              </span>
              <a href={`/meetings/${m.id}`} className="primary-btn ui-static-bd3197200f" style={{textDecoration: 'none'}}>
                Enter Control Room →
              </a>
            </div>
          </div>
        ))}
      </div>
      
      {totalMeetings > pageSize && <Pagination totalCount={totalMeetings} pageSize={pageSize} />}
    </main>
  );
}

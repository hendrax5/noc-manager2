import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "./DashboardCharts";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // Role based filtering
  const isCS = session?.user?.department?.includes('CS') || session?.user?.department?.toLowerCase().includes('customer');
  const canViewAll = session?.user?.role === 'Admin' || session?.user?.role === 'Manager' || isCS;
  const scope = canViewAll ? {} : { assigneeId: session?.user?.id };

  // Fetch metrics
  const totalNewTickets = await prisma.ticket.count({ where: { ...scope, status: 'New' } });
  const totalWaitingTickets = await prisma.ticket.count({ where: { ...scope, status: 'Waiting Reply' } });
  const totalRepliedTickets = await prisma.ticket.count({ where: { ...scope, status: 'Replied' } });
  const totalResolvedTickets = await prisma.ticket.count({ where: { ...scope, status: 'Resolved' } });
  
  // Aggregate stats for charts
  const ticketStats = [
    { status: 'New', count: totalNewTickets },
    { status: 'Wait Reply', count: totalWaitingTickets },
    { status: 'Replied', count: totalRepliedTickets },
    { status: 'Resolved', count: totalResolvedTickets }
  ];

  // Fetch pending Action Items
  const pendingActionItems = await prisma.actionItem.findMany({
    where: {
      status: 'Pending',
      OR: [
        { assigneeId: parseInt(session?.user?.id) },
        { departmentId: parseInt(session?.user?.departmentId) }
      ]
    },
    include: { meeting: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  // Group reports by date (simple approach for MVP)
  const recentReports = await prisma.dailyReport.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  const reportMap = {};
  recentReports.forEach(r => {
    const d = new Date(r.createdAt).toISOString().split('T')[0];
    reportMap[d] = (reportMap[d] || 0) + 1;
  });
  const reportStats = Object.keys(reportMap).map(date => ({ date, count: reportMap[date] })).reverse();

  return (
    <main className="container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Welcome, {session?.user?.name || "User"}!</h1>
          <p>
            Role: <strong style={{ color: 'var(--secondary-color)' }}>{session?.user?.role || "Staff"}</strong> | 
            Department: <strong>{session?.user?.department || "General"}</strong>
          </p>
        </div>
        <Link href="/tickets/new" className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>+ New Ticket</Link>
      </header>

      <section className="dashboard-grid">
        <div className="card">
          <h2>New Tickets</h2>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#ef4444' }}>{totalNewTickets}</p>
        </div>
        <div className="card">
          <h2>Pending Action</h2>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#f59e0b' }}>{totalWaitingTickets + totalRepliedTickets}</p>
        </div>
        <div className="card">
          <h2>Resolved</h2>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#10b981' }}>{totalResolvedTickets}</p>
        </div>
      </section>

      {/* Action Items Widget */}
      <section style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#0f172a' }}>My Pending Follow-Ups (Action Items)</h2>
          {pendingActionItems.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>You have no pending assignments from any meetings. You're all caught up!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingActionItems.map(item => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', color: '#1e293b' }}>{item.task}</p>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From: <Link href={`/meetings/${item.meeting.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{item.meeting.title}</Link></span>
                  </div>
                  <span className="badge" style={{ backgroundColor: '#f59e0b' }}>Action Needed</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Render Dynamic Graphs */}
      <DashboardCharts ticketStats={ticketStats} reportStats={reportStats} />

    </main>
  );
}

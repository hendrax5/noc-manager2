import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import SearchInput from "./SearchInput";
import TicketQuickActions from "./TicketQuickActions";

export default async function TicketsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const { user } = session;
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || "";

  const isCS = user.department?.includes('CS') || user.department?.toLowerCase().includes('customer');
  const canViewAll = user.role === 'Admin' || user.role === 'Manager' || isCS;

  const tab = resolvedParams?.tab || 'needs_attention';

  const filters = [];
  
  if (!canViewAll) {
    filters.push({ assigneeId: user.id });
  }

  if (q) {
    filters.push({
      OR: [
        { trackingId: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } }
      ]
    });
  }

  if (tab === 'needs_attention') {
    filters.push({
      OR: [
        { status: 'New' },
        { status: 'Open' },
        { assigneeId: null }
      ]
    });
  } else if (tab === 'in_progress') {
    filters.push({ status: { notIn: ['New', 'Resolved', 'Closed'] } });
    filters.push({ assigneeId: { not: null } });
  } else if (tab === 'resolved') {
    filters.push({ status: { in: ['Resolved', 'Closed'] } });
  }

  const whereClause = filters.length > 0 ? { AND: filters } : {};

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    include: { department: true, assignee: true },
    orderBy: { createdAt: 'desc' }
  });

  function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
  }

  return (
    <main className="container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Tickets Dashboard</h1>
          <p>Triage, assign, and resolve NOC technical operations.</p>
        </div>
        <Link href="/tickets/new" className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>+ New Ticket</Link>
      </header>

      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', paddingBottom: '0.75rem', overflowX: 'auto' }}>
        <Link href="?tab=needs_attention" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'needs_attention' ? '#ef4444' : '#64748b', borderBottom: tab === 'needs_attention' ? '3px solid #ef4444' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          🔴 Needs Attention
        </Link>
        <Link href="?tab=in_progress" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'in_progress' ? '#f59e0b' : '#64748b', borderBottom: tab === 'in_progress' ? '3px solid #f59e0b' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          🟡 In Progress
        </Link>
        <Link href="?tab=resolved" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'resolved' ? '#10b981' : '#64748b', borderBottom: tab === 'resolved' ? '3px solid #10b981' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          🟢 Resolved / Complete
        </Link>
        <Link href="?tab=all" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'all' ? '#1e293b' : '#64748b', borderBottom: tab === 'all' ? '3px solid #1e293b' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          ⚪ All Tickets
        </Link>
      </div>

      <SearchInput defaultQuery={q} />

      <table className="data-table">
        <thead>
          <tr>
            <th>Tracking ID</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Age</th>
            <th>Department</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No tickets found matching your query.</td></tr>
          )}
          {tickets.map(t => {
            const isCritical = t.priority === 'Critical';
            const hoursIdle = (new Date() - new Date(t.updatedAt)) / 3600000;
            const isSLA = (t.status === 'New' && hoursIdle > 2) || (isCritical && hoursIdle > 1 && t.status !== 'Resolved');
            const rowStyle = isSLA ? { background: '#fef2f2', borderLeft: '4px solid #ef4444' } : { borderLeft: '4px solid transparent' };
            
            return (
              <tr key={t.id} style={rowStyle}>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{t.trackingId}</td>
                <td style={{ fontWeight: '600' }}><Link href={`/tickets/${t.id}`} style={{color: 'var(--primary-color)'}}>{t.title}</Link></td>
                <td>
                  <span className="badge" style={{ backgroundColor: t.status === 'Resolved' ? '#10b981' : (t.status === 'New' ? '#ef4444' : '#f59e0b') }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ fontWeight: isCritical ? 'bold' : 'normal', color: isCritical ? '#ef4444' : 'inherit' }}>{t.priority}</td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{timeAgo(t.updatedAt)}</td>
                <td>{t.department?.name}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {t.assignee?.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}
                    {canViewAll && <TicketQuickActions ticketId={t.id} isUnassigned={!t.assigneeId} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import SearchInput from "./SearchInput";
import TicketQuickActions from "./TicketQuickActions";
import Pagination from "@/components/Pagination";

export default async function TicketsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const { user } = session;
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || "";

  const isCS = user.department?.includes('CS') || user.department?.toLowerCase().includes('customer');
  const canViewAll = user.role === 'Admin' || user.role === 'Manager' || isCS;

  const tab = resolvedParams?.tab || 'needs_attention';

  const dateParam = resolvedParams?.date || "";

  const filters = [];
  
  if (dateParam === 'today') {
    const today = new Date();
    today.setHours(0,0,0,0);
    filters.push({ updatedAt: { gte: today } });
  }
  
  if (!canViewAll) {
    filters.push({ assigneeId: user.id });
  }

  if (q) {
    filters.push({
      OR: [
        { trackingId: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { assignee: { name: { contains: q, mode: 'insensitive' } } },
        { assignee: { email: { contains: q, mode: 'insensitive' } } }
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
  } else if (tab === 'expiring') {
    filters.push({ status: { notIn: ['Resolved', 'Closed'] } });
  } else if (tab === 'resolved') {
    filters.push({ status: { in: ['Resolved', 'Closed'] } });
  }

  const whereClause = filters.length > 0 ? { AND: filters } : {};

  const page = parseInt(resolvedParams?.page) || 1;
  const pageSize = 6; // Compressed zero-scroll bounds

  let [totalTickets, tickets] = await Promise.all([
    prisma.ticket.count({ where: whereClause }),
    prisma.ticket.findMany({
      where: whereClause,
      include: { department: true, assignee: true },
      take: tab === 'expiring' ? undefined : pageSize,
      skip: tab === 'expiring' ? undefined : (page - 1) * pageSize,
      orderBy: [
        { slaBreaches: 'desc' },
        { updatedAt: 'desc' }
      ]
    })
  ]);

  if (tab === 'expiring') {
    tickets = tickets.filter(t => {
      if (!t.customData || typeof t.customData !== 'object') return false;
      return Object.values(t.customData).some(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val));
    });
    
    tickets.sort((a, b) => {
      const getFirstDate = obj => Object.values(obj).find(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
      return new Date(getFirstDate(a.customData)) - new Date(getFirstDate(b.customData));
    });

    totalTickets = tickets.length;
    tickets = tickets.slice((page - 1) * pageSize, page * pageSize);
  }

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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {dateParam === 'today' && (
            <span style={{ background: '#ecfdf5', color: '#059669', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #a7f3d0', fontSize: '0.8rem', fontWeight: 'bold' }}>
              🕒 Filter Active: Today's Shift Only
            </span>
          )}
          <Link href="/tickets/new" className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>+ New Ticket</Link>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', paddingBottom: '0.75rem', overflowX: 'auto' }}>
        <Link href="?tab=needs_attention" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'needs_attention' ? '#ef4444' : 'var(--text-color)', borderBottom: tab === 'needs_attention' ? '3px solid #ef4444' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          🔴 Attention
        </Link>
        <Link href="?tab=in_progress" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'in_progress' ? '#f59e0b' : 'var(--text-color)', borderBottom: tab === 'in_progress' ? '3px solid #f59e0b' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          🟡 Progress
        </Link>
        <Link href="?tab=expiring" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'expiring' ? '#d946ef' : 'var(--text-color)', borderBottom: tab === 'expiring' ? '3px solid #d946ef' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          ⏳ Expiring
        </Link>
        <Link href="?tab=resolved" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'resolved' ? '#10b981' : 'var(--text-color)', borderBottom: tab === 'resolved' ? '3px solid #10b981' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
          🟢 Resolved
        </Link>
        <Link href="?tab=all" style={{ textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', color: tab === 'all' ? 'var(--heading-color)' : 'var(--text-color)', borderBottom: tab === 'all' ? '3px solid var(--heading-color)' : 'none', paddingBottom: '0.75rem', marginBottom: '-0.9rem' }}>
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
            const hasPings = t.slaBreaches > 0;
            
            let expiryDateStr = null;
            if (t.customData && typeof t.customData === 'object') {
              const expiryVal = Object.values(t.customData).find(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val));
              if (expiryVal) expiryDateStr = expiryVal;
            }

            let rowClass = "";
            if (isSLA) rowClass = "ticket-row-sla";
            else if (t.slaBreaches > 2 && t.status !== 'Resolved') rowClass = "ticket-row-critical";
            else if (hasPings && t.status !== 'Resolved') rowClass = "ticket-row-warning";
            else if (expiryDateStr && t.status !== 'Resolved' && new Date(expiryDateStr) < new Date()) rowClass = "ticket-row-expired";
            
            return (
              <tr key={t.id} className={rowClass}>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{t.trackingId}</td>
                <td style={{ fontWeight: '600' }}>
                  <Link href={`/tickets/${t.id}`} style={{color: 'var(--primary-color)'}}>
                    {t.title}
                  </Link>
                  {t.slaBreaches > 0 && t.status !== 'Resolved' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--danger-text, #b91c1c)', fontWeight: 'bold', background: 'var(--danger-bg, #fee2e2)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      🔥 x{t.slaBreaches} CS Pings!
                    </span>
                  )}
                  {expiryDateStr && t.status !== 'Resolved' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: new Date(expiryDateStr) < new Date() ? 'var(--danger-bg, #ef4444)' : 'var(--warning-bg, #d946ef)', color: new Date(expiryDateStr) < new Date() ? 'var(--danger-text, white)' : 'var(--warning-text, white)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                      {new Date(expiryDateStr) < new Date() ? '⚠️ EXPIRED' : `⏳ Exp: ${new Date(expiryDateStr).toLocaleDateString()}`}
                    </span>
                  )}
                </td>
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

      <Pagination totalCount={totalTickets} pageSize={pageSize} />
    </main>
  );
}

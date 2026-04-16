import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import TicketQuickActions from "./TicketQuickActions";
import TicketAdvancedFilter from "./TicketAdvancedFilter";
import Pagination from "@/components/Pagination";
import { getAppConfig } from "@/lib/config";

export default async function TicketsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const config = getAppConfig();
  const companies = config.companyNames ? config.companyNames.split(',').map(s => s.trim()) : ["ION", "SDC", "Sistercompany"];
  const deptCompanyMap = config.deptCompanyMap || {};
  
  const categories = await prisma.jobCategory.findMany({ select: { id: true, name: true } });
  console.log("====== CATEGORIES FETCHED IN TICKET PAGE ======");
  console.log(categories);

  const { user } = session;
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || "";

  const isCS = user.department?.includes('CS') || user.department?.toLowerCase().includes('customer');
  const isAdministrasi = user.department?.toLowerCase() === 'administrasi' || user.department?.toLowerCase().includes('admin');
  const canViewAll = user.permissions?.includes('ticket.view_all');

  const statusesParam = resolvedParams?.statuses;
  const assignmentsParam = resolvedParams?.assignments || "me,unassigned,others";
  const allDeptsParam = resolvedParams?.all_depts === 'true';
  const mappedDefaultCompany = deptCompanyMap[user.departmentId] || "";
  const companyParam = resolvedParams?.company !== undefined ? resolvedParams.company : mappedDefaultCompany;
  const dateParam = resolvedParams?.date || "";
  const tab = resolvedParams?.tab || "";
  const categoryParam = resolvedParams?.category || "";

  const filters = [];
  
  if (categoryParam) {
    filters.push({ jobCategoryId: parseInt(categoryParam) });
  }
  
  if (companyParam && !allDeptsParam && !q) {
    filters.push({
      customData: {
        path: ['company'],
        string_contains: companyParam
      }
    });
  }
  
  if (dateParam === 'today') {
    const today = new Date();
    today.setHours(0,0,0,0);
    filters.push({ updatedAt: { gte: today } });
  }

  const shouldIsolateDepartment = !allDeptsParam;

  if (shouldIsolateDepartment) {
    filters.push({
      OR: [
        { visibility: "Public" },
        { assigneeId: user.id }, // Explicitly assigned to user
        { departmentId: user.departmentId || -1 }, // Assigned to user's department
        { historyLogs: { some: { actorId: user.id } } }, // User interacted with it previously
        { historyLogs: { some: { action: "Created", actor: { departmentId: user.departmentId || -1 } } } } // Created by someone in user's department
      ]
    });
  }

  // Globally Enforce Privacy & Visibility Constraints
  if (!canViewAll) {
    filters.push({
      OR: [
        { visibility: "Public" },
        { departmentId: user.departmentId || -1 }, // Can ALWAYS see tickets assigned to their own department
        { assigneeId: user.id },
        { historyLogs: { some: { actorId: user.id } } },
        { historyLogs: { some: { action: "Created", actor: { departmentId: user.departmentId || -1 } } } },
        { permittedDepartments: { some: { id: user.departmentId || -1 } } }
      ]
    });
  }
  
  // Assignment Checkbox Filters
  const assignments = assignmentsParam ? assignmentsParam.split(',') : [];
  if (assignments.length > 0 && assignments.length < 3) {
    const assignFilters = [];
    if (assignments.includes('me')) assignFilters.push({ assigneeId: user.id });
    if (assignments.includes('unassigned')) assignFilters.push({ assigneeId: null });
    if (assignments.includes('others')) assignFilters.push({ assigneeId: { not: null }, NOT: { assigneeId: user.id } });
    if (assignFilters.length > 0) {
      filters.push({ OR: assignFilters });
    }
  }

  if (q) {
    filters.push({
      OR: [
        { trackingId: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { assignee: { name: { contains: q, mode: 'insensitive' } } },
        { assignee: { email: { contains: q, mode: 'insensitive' } } },
        { description: { contains: q, mode: 'insensitive' } },
        { customData: { path: ['company'], string_contains: q } },
        { comments: { some: { text: { contains: q, mode: 'insensitive' } } } }
      ]
    });
  }

  if (statusesParam) {
    const statusArray = statusesParam.split(',');
    filters.push({ status: { in: statusArray } });
  } else if (!resolvedParams?.statuses && !resolvedParams?.tab) {
    // Bug 29: Include 'Reopened' in default active statuses
    filters.push({ status: { in: ['Pending', 'New', 'Open', 'Reopened', 'Waiting Reply', 'Replied', 'In Progress', 'On Hold', 'Finish'] } });
  } else if (tab === 'needs_attention') {
    // Bug 29: Include 'Reopened' status in needs_attention tab
    filters.push({ OR: [{ status: 'Pending' }, { status: 'New' }, { status: 'Open' }, { status: 'Reopened' }, { assigneeId: null }] });
  } else if (tab === 'in_progress') {
    filters.push({ status: { notIn: ['New', 'Resolved', 'Closed'] }, assigneeId: { not: null } });
  } else if (tab === 'expiring') {
    filters.push({ status: { notIn: ['Resolved', 'Closed'] } });
  } else if (tab === 'resolved') {
    filters.push({ status: { in: ['Resolved', 'Closed'] } });
  }
  
  // Independent Tab Filters
  if (tab === 'cs_radar') {
    filters.push({ enableSla: true });
    // If user didn't explicitly check status boxes, default to active ones
    if (!statusesParam) {
      filters.push({ status: { notIn: ['Resolved', 'Closed'] } });
    }
  }

  const whereClause = filters.length > 0 ? { AND: filters } : {};

  const sortParam = resolvedParams?.sort || "";

  let orderByClause = [];
  if (sortParam === 'age_asc') {
    orderByClause = [{ updatedAt: 'asc' }];
  } else if (sortParam === 'age_desc') {
    orderByClause = [{ updatedAt: 'desc' }];
  } else if (sortParam === 'name_asc') {
    orderByClause = [{ title: 'asc' }];
  } else if (sortParam === 'name_desc') {
    orderByClause = [{ title: 'desc' }];
  } else if (sortParam === 'dept_asc') {
    orderByClause = [{ department: { name: 'asc' } }];
  } else if (sortParam === 'dept_desc') {
    orderByClause = [{ department: { name: 'desc' } }];
  } else {
    // Default sorting
    orderByClause = [
      { slaBreaches: 'desc' },
      { updatedAt: 'desc' }
    ];
  }

  const page = parseInt(resolvedParams?.page) || 1;
  const pageSize = parseInt(resolvedParams?.limit) || 6;

  let [totalTickets, tickets] = await Promise.all([
    prisma.ticket.count({ where: whereClause }),
    prisma.ticket.findMany({
      where: whereClause,
      include: { department: true, assignee: true, services: { include: { customer: true } } },
      take: tab === 'expiring' ? undefined : pageSize,
      skip: tab === 'expiring' ? undefined : (page - 1) * pageSize,
      orderBy: orderByClause
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

      {/* Dynamic Views / Status Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', overflowX: 'auto' }}>
         <Link href="/tickets" style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: !tab ? 'var(--primary-color)' : '#64748b', fontWeight: !tab ? 'bold' : '500', borderBottom: !tab ? '3px solid var(--primary-color)' : 'none', marginBottom: '-9px' }}>
            All Active View
         </Link>
         {user.permissions?.includes('ticket.sla') && (
           <Link href="/tickets?tab=cs_radar" style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: tab === 'cs_radar' ? '#ef4444' : '#64748b', fontWeight: tab === 'cs_radar' ? 'bold' : '500', borderBottom: tab === 'cs_radar' ? '3px solid #ef4444' : 'none', marginBottom: '-9px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              📡 CS SLA Radar
           </Link>
         )}
      </div>

      <Suspense fallback={<div style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>Loading filters...</div>}>
        <TicketAdvancedFilter categories={categories} companies={companies} initialCompanyParam={companyParam} />
      </Suspense>

      <table className="data-table">
        <thead>
          <tr>
            <th>Tracking ID</th>
            <th style={{ cursor: 'pointer' }}>
              <Link href={`/tickets?${new URLSearchParams({...resolvedParams, page: 1, sort: sortParam === 'name_asc' ? 'name_desc' : 'name_asc'}).toString()}`} style={{textDecoration:'none', color:'inherit', display:'flex', alignItems:'center', gap:'0.2rem'}}>
                Name {sortParam === 'name_asc' ? '▲' : sortParam === 'name_desc' ? '▼' : '↕'}
              </Link>
            </th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th style={{ cursor: 'pointer' }}>
              <Link href={`/tickets?${new URLSearchParams({...resolvedParams, page: 1, sort: sortParam === 'age_asc' ? 'age_desc' : 'age_asc'}).toString()}`} style={{textDecoration:'none', color:'inherit', display:'flex', alignItems:'center', gap:'0.2rem'}}>
                Age {sortParam === 'age_asc' ? '▲' : sortParam === 'age_desc' ? '▼' : '↕'}
              </Link>
            </th>
            <th style={{ cursor: 'pointer' }}>
              <Link href={`/tickets?${new URLSearchParams({...resolvedParams, page: 1, sort: sortParam === 'dept_asc' ? 'dept_desc' : 'dept_asc'}).toString()}`} style={{textDecoration:'none', color:'inherit', display:'flex', alignItems:'center', gap:'0.2rem'}}>
                Department {sortParam === 'dept_asc' ? '▲' : sortParam === 'dept_desc' ? '▼' : '↕'}
              </Link>
            </th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No tickets found matching your filters.</td></tr>
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
            
            let extractedName = "-";
            const reporterMatch = t.description?.match(/\[Original Reporter: (.*?) -/);
            if (reporterMatch) {
              extractedName = reporterMatch[1];
            } else if (t.services && t.services.length > 0 && t.services[0].customer) {
              extractedName = t.services[0].customer.name;
            } else if (t.customData && typeof t.customData === 'object' && t.customData["Customer Name"]) {
               extractedName = t.customData["Customer Name"];
            }

            return (
              <tr key={t.id} className={rowClass}>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{t.trackingId}</td>
                <td>
                  <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem', display: 'block' }}>{extractedName}</span>
                  {t.customData && t.customData["Order Origin"] && (
                    <span style={{ display: 'inline-block', fontSize: '0.7rem', color: '#991b1b', background: '#fef2f2', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: 'bold', marginTop: '0.2rem', marginRight: '0.2rem' }} title="Order Origin">
                      🏢 {t.customData["Order Origin"]}
                    </span>
                  )}
                  {t.customData && t.customData["Executing Vendor"] && (
                    <span style={{ display: 'inline-block', fontSize: '0.7rem', color: '#1e40af', background: '#eff6ff', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #bfdbfe', fontWeight: 'bold', marginTop: '0.2rem' }} title="Executing Vendor">
                      🛠️ {t.customData["Executing Vendor"]}
                    </span>
                  )}
                </td>
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

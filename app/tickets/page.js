import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import TicketQuickActions from "./TicketQuickActions";
import TicketAdvancedFilter from "./TicketAdvancedFilter";
import TicketTableClient from "./TicketTableClient";
import Pagination from "@/components/Pagination";
import { getAppConfig } from "@/lib/config";

export default async function TicketsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const config = getAppConfig();
  const companies = config.companyNames ? config.companyNames.split(',').map(s => s.trim()) : ["ION", "SDC", "Sistercompany"];
  const deptCompanyMap = config.deptCompanyMap || {};
  
  const categories = await prisma.jobCategory.findMany({ select: { id: true, name: true } });
  
  // Dynamically fetch all unique statuses from the database so the filter UI adapts
  const dbStatusesRes = await prisma.ticket.groupBy({ by: ['status'] });
  const dbStatuses = dbStatusesRes.map(s => s.status).filter(Boolean);

  console.log("====== CATEGORIES FETCHED IN TICKET PAGE ======");
  console.log(categories);

  const { user } = session;
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || "";

  const isCS = user.department?.includes('CS') || user.department?.toLowerCase().includes('customer');
  const isAdministrasi = user.department?.toLowerCase() === 'administrasi' || user.department?.toLowerCase().includes('admin');
  const isAdministrasiOrTeknis = user.department?.toLowerCase() === 'administrasi' || user.department?.toLowerCase() === 'admin-teknis' || user.department?.toLowerCase().includes('admin');
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
  
  if (companyParam) {
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
    const isolateOr = [
      { assigneeId: user.id }, // Explicitly assigned to user
      { departmentId: user.departmentId || -1 }, // Assigned to user's department
      { historyLogs: { some: { actorId: user.id } } }, // User interacted with it previously
      { historyLogs: { some: { action: "Created", actor: { departmentId: user.departmentId || -1 } } } } // Created by someone in user's department
    ];
    
    // Only Administrasi and Admin-Teknis want to hide Public tickets from other teams.
    if (!isAdministrasiOrTeknis) {
      isolateOr.push({ visibility: "Public" });
    }

    filters.push({ OR: isolateOr });
  }

  // Globally Enforce Privacy & Visibility Constraints
  if (!canViewAll) {
    const globalOr = [
      { departmentId: user.departmentId || -1 }, // Can ALWAYS see tickets assigned to their own department
      { assigneeId: user.id },
      { historyLogs: { some: { actorId: user.id } } },
      { historyLogs: { some: { action: "Created", actor: { departmentId: user.departmentId || -1 } } } },
      { permittedDepartments: { some: { id: user.departmentId || -1 } } }
    ];

    if (!isAdministrasiOrTeknis) {
      globalOr.push({ visibility: "Public" });
    }

    filters.push({ OR: globalOr });
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
        { comments: { some: { text: { contains: q, mode: 'insensitive' } } } }
      ]
    });
  }

  if (statusesParam) {
    const statusArray = statusesParam.split(',');
    filters.push({ status: { in: statusArray } });
  } else if (!resolvedParams?.statuses && !resolvedParams?.tab) {
    // Show ALL active tickets (except Resolved and Closed) so unknown/new statuses don't go missing
    filters.push({ status: { notIn: ['Resolved', 'Closed'] } });
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

  let totalTickets = 0;
  let tickets = [];

  try {
    const results = await Promise.all([
      prisma.ticket.count({ where: whereClause }),
      prisma.ticket.findMany({
        where: whereClause,
        include: { department: true, assignee: true, services: { include: { customer: true } } },
        take: tab === 'expiring' ? undefined : pageSize,
        skip: tab === 'expiring' ? undefined : (page - 1) * pageSize,
        orderBy: orderByClause
      })
    ]);
    totalTickets = results[0];
    tickets = results[1];

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
  } catch (error) {
    console.error("====== PRISMA FILTER ERROR ======");
    console.error(error);
    // Return empty state or ignore the customData filter if it failed
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
        <TicketAdvancedFilter categories={categories} companies={companies} initialCompanyParam={companyParam} dbStatuses={dbStatuses} />
      </Suspense>

      <TicketTableClient 
        tickets={tickets} 
        resolvedParams={resolvedParams} 
        sortParam={sortParam} 
        canViewAll={user.permissions?.includes('ticket.all')} 
      />

      <Pagination totalCount={totalTickets} pageSize={pageSize} />
    </main>
  );
}

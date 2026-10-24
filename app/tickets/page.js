import { WORK_TYPE_LABELS, workTypeWhere } from "@/lib/tickets/workClassification";
import { ticketPresentation } from "@/lib/tickets/presentation";
import styles from "./ticket-list.module.css";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { findServiceIdsByCid } from "@/lib/services/cidLookup";
import Link from "next/link";
import { redirect } from "next/navigation";
import TicketQuickActions from "./TicketQuickActions";
import TicketAdvancedFilter from "./TicketAdvancedFilter";
import Pagination from "@/components/Pagination";
import { getAppConfig } from "@/lib/config";
import { DEFAULT_FILTER_STATUSES, expandStatusesForQuery, statusStyle } from "@/lib/tickets/status";
import {
  getPersonalCategoryIds,
  personalTicketGuard,
} from "@/lib/tickets/personalCategories";

export default async function TicketsPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const config = await getAppConfig();
  const companies = config.companyNames ? config.companyNames.split(',').map(s => s.trim()) : ["ION", "SDC", "Sistercompany"];
  const deptCompanyMap = config.deptCompanyMap || {};

  const { user } = session;
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || "";

  const isCS = user.department?.includes('CS') || user.department?.toLowerCase().includes('customer');
  const canViewAll = user.role === 'Admin' || isCS || user.permissions?.includes('view_all_tickets') || user.permissions?.includes('manage_tickets');
  const canCreate = user.role === 'Admin' || isCS || user.permissions?.includes('create_tickets') || user.permissions?.includes('manage_tickets');

  const statusesParam = resolvedParams?.statuses;
  const assignmentsParam = resolvedParams?.assignments || "me,unassigned,others";
  const allDeptsParam = resolvedParams?.all_depts === 'true';
  const mappedDefaultCompany = deptCompanyMap[user.departmentId] || "";
  const companyParam = resolvedParams?.company !== undefined ? resolvedParams.company : mappedDefaultCompany;
  const dateParam = resolvedParams?.date || "";
  const tab = resolvedParams?.tab || "";
  const jobCategoryParam = resolvedParams?.jobCategory || "";

  const installationView = resolvedParams?.view === 'installation';
  const installationTypes = installationView ? await prisma.serviceWorkType.findMany({ where: { operation: 'Installation' }, select: { id: true } }) : [];
  const workFilter = installationView ? { OR: [{ workType: 'Installation' }, { workType: 'ServiceWork', serviceWorkTypeId: { in: installationTypes.map(type => type.id) } }] } : workTypeWhere(resolvedParams?.workType);
  const workType = workFilter.workType || "";
  const filters = [workFilter];
  const serviceWorkTypeId = /^\d+$/.test(String(resolvedParams?.serviceWorkTypeId || '')) ? Number(resolvedParams.serviceWorkTypeId) : null;
  if (serviceWorkTypeId) filters.push({ workType: 'ServiceWork', serviceWorkTypeId });
  const serviceWorkTypes = workType === 'ServiceWork' ? await prisma.serviceWorkType.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }) : [];
  
  if (companyParam && !allDeptsParam && !q) {
    filters.push({
      customData: {
        string_contains: companyParam
      }
    });
  }
  
  if (dateParam === 'today') {
    const today = new Date();
    today.setHours(0,0,0,0);
    filters.push({ updatedAt: { gte: today } });
  }

  // Determine if we should isolate by Department
  // Applying isolation to everyone by default, regardless of role, as requested
  const shouldIsolateDepartment = !allDeptsParam;

  if (shouldIsolateDepartment) {
    filters.push({
      OR: [
        { assigneeId: user.id }, // Explicitly assigned
        { departmentId: user.departmentId || -1 }, // Belongs to user's department (Admin fallback)
        { historyLogs: { some: { actorId: user.id } } } // User interacted with it previously
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
    const cidServiceIds = await findServiceIdsByCid(prisma, q);
    filters.push({
      OR: [
        { trackingId: { contains: q, mode: 'insensitive' } },
        { sapReference: { contains: q, mode: 'insensitive' } },
        { services: { some: { OR: [
          { cid: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { id: { in: cidServiceIds } },
        ] } } },
        { title: { contains: q, mode: 'insensitive' } },
        { assignee: { name: { contains: q, mode: 'insensitive' } } },
        { assignee: { email: { contains: q, mode: 'insensitive' } } },
        { description: { contains: q, mode: 'insensitive' } },
        { customData: { path: ['Customer Name'], string_contains: q } }
      ]
    });
  }

  if (statusesParam) {
    const statusArray = expandStatusesForQuery(statusesParam.split(','));
    filters.push({ status: { in: statusArray } });
  } else if (!resolvedParams?.statuses && !resolvedParams?.tab) {
    filters.push({ status: { in: expandStatusesForQuery([...DEFAULT_FILTER_STATUSES]) } });
  } else if (tab === 'needs_attention') {
    filters.push({ OR: [{ status: 'New' }, { status: 'Open' }, { assigneeId: null }] });
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

  // Job Category Filter (Phase 5)
  if (jobCategoryParam) {
    filters.push({ jobCategory: { name: jobCategoryParam } });
  }

  const personalCategoryIds = await getPersonalCategoryIds(prisma);
  const personalGuard = personalTicketGuard({ user, personalCategoryIds });
  if (Object.keys(personalGuard).length > 0) {
    filters.push(personalGuard);
  }

  const whereClause = filters.length > 0 ? { AND: filters } : {};

  const page = parseInt(resolvedParams?.page) || 1;
  const pageSize = parseInt(resolvedParams?.limit) || 6;

  let [totalTickets, tickets] = await Promise.all([
    prisma.ticket.count({ where: whereClause }),
    prisma.ticket.findMany({
      where: whereClause,
      include: { department: true, assignee: true, jobCategory: true, services: { include: { customer: true } } },
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
          <h1>{installationView ? 'Instalasi' : workType ? WORK_TYPE_LABELS[workType] : "Semua Tiket"}</h1>
          <p>Kelola gangguan dan pekerjaan layanan.</p>
        </div>
        <div className="ui-static-af81cc4264" style={{display: 'flex', alignItems: 'center'}}>
          {dateParam === 'today' && (
            <span className="ui-static-ede1c204d7" >
               Filter Active: Today's Shift Only
            </span>
          )}
          {canCreate && (
            <Link href={installationView ? '/tickets/new?workType=ServiceWork&operation=Installation' : workType ? `/tickets/new?workType=${workType}` : "/tickets/new"} className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>+ Buat tiket</Link>
          )}
        </div>
      </header>

      {/* Dynamic Views / Status Tabs */}
      <div className="ui-static-8f3fb50de8" style={{display: 'flex', overflowX: 'auto'}}>
         <Link href={installationView ? '/tickets?view=installation' : workType ? `/tickets?workType=${workType}` : "/tickets"} className="ui-static-be2cd19cf4" style={{textDecoration: 'none', color: !tab ? 'var(--primary-color)' : "var(--ui-info)", fontWeight: !tab ? 'bold' : '500', borderBottom: !tab ? '3px solid var(--primary-color)' : 'none'}}>
            All Active View
         </Link>
         {(isCS || user.role === 'Admin' || user.permissions?.includes('manage_sla') || user.permissions?.includes('view_all_tickets')) && (
           <Link href={`/tickets?tab=cs_radar${installationView ? '&view=installation' : workType ? `&workType=${workType}` : ""}`} className="ui-static-9c11788788" style={{textDecoration: 'none', color: tab === 'cs_radar' ? "var(--ui-danger)" : "var(--ui-info)", fontWeight: tab === 'cs_radar' ? 'bold' : '500', borderBottom: tab === 'cs_radar' ? '3px solid #ef4444' : 'none', display: 'flex', alignItems: 'center'}}>
               CS SLA Radar
           </Link>
         )}
      </div>

      <Suspense fallback={<div className="ui-static-595f5f4cf6" >Loading filters...</div>}>
        <TicketAdvancedFilter companies={companies} initialCompanyParam={companyParam} />
      </Suspense>

      {workType === 'ServiceWork' && <nav aria-label="Filter jenis pekerjaan" className="ui-static-d099538e24" style={{display:'flex', flexWrap:'wrap'}}>
        <Link href="/tickets?workType=ServiceWork" aria-current={!serviceWorkTypeId ? 'page' : undefined}>Semua pekerjaan</Link>
        <Link href="/tickets?workType=Installation">Instalasi (format lama)</Link>
        {serviceWorkTypes.map(type => <Link key={type.id} href={`/tickets?workType=ServiceWork&serviceWorkTypeId=${type.id}`} aria-current={serviceWorkTypeId === type.id ? 'page' : undefined} className="ui-static-3d6ac67643" >{type.name}{type.active ? '' : ' (nonaktif)'}</Link>)}
      </nav>}
      <div className={styles.tableScroll} role="region" aria-label="Daftar tiket" tabIndex={0}><table className="data-table">
        <caption className="sr-only">Daftar tiket: tracking ID, detail, kategori, status, prioritas, umur, departemen, dan penanggung jawab</caption>
        <thead>
          <tr>
            <th scope="col">Tracking ID</th>
            <th scope="col">Tiket / Detail</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Age</th>
            <th scope="col">Department</th>
            <th scope="col">Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <tr><td colSpan="8" className="ui-static-39c1d6c828" style={{textAlign: 'center'}}>Tidak ada tiket yang cocok dengan filter ini. <Link href="/tickets">Reset filter</Link></td></tr>
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
            
            const presentation = ticketPresentation(t);

            return (
              <tr key={t.id} className={rowClass}>
                <td className="ui-static-a03c8f3240" >{t.trackingId}</td>
                <td className={styles.ticketDetail}>
                  <Link href={`/tickets/${t.id}`} className={styles.ticketTitle} title={presentation.title}>{presentation.title}</Link>
                  {presentation.subtitle && <div className={styles.secondary}>{presentation.subtitle}</div>}
                  {presentation.cids.length > 0 && <div className={`${styles.secondary} ${styles.circuit}`}>CID: {presentation.cids.join(', ')}</div>}
                  <div className={styles.secondary}>{t.serviceWorkTypeLabel || WORK_TYPE_LABELS[t.workType] || WORK_TYPE_LABELS.Unclassified}{t.sapReference && ![presentation.title, presentation.subtitle, ...presentation.cids].includes(t.sapReference) && <span> · SAP: {t.sapReference}</span>}</div>
                  <div className={styles.routing}>
                    {t.customData?.['Order Origin'] && <span>Penerima order: {t.customData['Order Origin']}</span>}
                    {t.customData?.['Executing Vendor'] && <span>Pelaksana: {t.customData['Executing Vendor']}</span>}
                  </div>
                  <details className={styles.original}><summary>Data asal</summary><dl><dt>Name</dt><dd>{presentation.originalName || 'Tidak diisi'}</dd><dt>Subject</dt><dd>{presentation.originalSubject || 'Tidak diisi'}</dd></dl></details>
                  {t.slaBreaches > 0 && t.status !== 'Resolved' && (
                    <span className="ui-static-a7e19d1696" >
                       x{t.slaBreaches} CS Pings!
                    </span>
                  )}
                  {expiryDateStr && t.status !== 'Resolved' && (
                    <span className="ui-static-2270ccd56e" style={{background: new Date(expiryDateStr) < new Date() ? 'var(--danger-bg, #ef4444)' : 'var(--warning-bg, #d946ef)', color: new Date(expiryDateStr) < new Date() ? 'var(--danger-text, white)' : 'var(--warning-text, white)'}}>
                      {new Date(expiryDateStr) < new Date() ? '⚠️ EXPIRED' : `⏳ Exp: ${new Date(expiryDateStr).toLocaleDateString()}`}
                    </span>
                  )}
                </td>
                <td>
                  {t.jobCategory ? (
                    <span className="ui-static-4e3ab66524" style={{whiteSpace: 'nowrap'}}>
                      {t.jobCategory.name}
                    </span>
                  ) : (
                    <span className="ui-static-60700bd225" style={{fontStyle: 'italic'}}>-</span>
                  )}
                </td>
                <td>
                  <span className="badge" style={statusStyle(t.status)}>
                    {t.status}
                  </span>
                </td>
                <td style={{ fontWeight: isCritical ? 'bold' : 'normal', color: isCritical ? "var(--ui-danger)" : 'inherit' }}>{t.priority}</td>
                <td className="ui-static-9d7e95f546" >{timeAgo(t.updatedAt)}</td>
                <td>{t.department?.name}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {t.assignee?.name || <span className="ui-static-b9010af219" style={{fontStyle: 'italic'}}>Unassigned</span>}
                    {canViewAll && <TicketQuickActions ticketId={t.id} isUnassigned={!t.assigneeId} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>

      <Pagination totalCount={totalTickets} pageSize={pageSize} />
    </main>
  );
}

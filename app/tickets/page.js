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
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {installationView ? "Instalasi" : workType ? WORK_TYPE_LABELS[workType] : "Semua Tiket"}
          </h1>
          <p className={styles.pageSubtitle}>Kelola gangguan dan pekerjaan layanan.</p>
        </div>
        <div className={styles.headerActions}>
          {dateParam === "today" && (
            <span className={styles.todayBadge}>Filter Active: Today&apos;s Shift Only</span>
          )}
          {canCreate && (
            <Link
              href={
                installationView
                  ? "/tickets/new?workType=ServiceWork&operation=Installation"
                  : workType
                    ? `/tickets/new?workType=${workType}`
                    : "/tickets/new"
              }
              className={`primary-btn ${styles.createBtn}`}
            >
              + Buat tiket
            </Link>
          )}
        </div>
      </header>

      {/* Dynamic Views / Status Tabs */}
      <nav className={styles.viewTabs} aria-label="Tampilan daftar tiket">
        <Link
          href={
            installationView
              ? "/tickets?view=installation"
              : workType
                ? `/tickets?workType=${workType}`
                : "/tickets"
          }
          className={`${styles.viewTab} ${!tab ? styles.viewTabActive : ""}`}
        >
          All Active View
        </Link>
        {(isCS ||
          user.role === "Admin" ||
          user.permissions?.includes("manage_sla") ||
          user.permissions?.includes("view_all_tickets")) && (
          <Link
            href={`/tickets?tab=cs_radar${
              installationView ? "&view=installation" : workType ? `&workType=${workType}` : ""
            }`}
            className={`${styles.viewTab} ${tab === "cs_radar" ? styles.viewTabDangerActive : ""}`}
          >
            CS SLA Radar
          </Link>
        )}
      </nav>

      <Suspense fallback={<div className={styles.toolbarCard}>Loading filters...</div>}>
        <TicketAdvancedFilter companies={companies} initialCompanyParam={companyParam} />
      </Suspense>

      {workType === "ServiceWork" && (
        <nav aria-label="Filter jenis pekerjaan" className={styles.serviceSubNav}>
          <Link
            href="/tickets?workType=ServiceWork"
            aria-current={!serviceWorkTypeId ? "page" : undefined}
            className={styles.serviceSubLink}
          >
            Semua pekerjaan
          </Link>
          <Link href="/tickets?workType=Installation" className={styles.serviceSubLink}>
            Instalasi (format lama)
          </Link>
          {serviceWorkTypes.map((type) => (
            <Link
              key={type.id}
              href={`/tickets?workType=ServiceWork&serviceWorkTypeId=${type.id}`}
              aria-current={serviceWorkTypeId === type.id ? "page" : undefined}
              className={styles.serviceSubLink}
            >
              {type.name}
              {type.active ? "" : " (nonaktif)"}
            </Link>
          ))}
        </nav>
      )}

      <div className={styles.tableScroll} role="region" aria-label="Daftar tiket" tabIndex={0}>
        <table className="data-table">
          <caption className="sr-only">
            Daftar tiket: tracking ID, detail, kategori, status, prioritas, umur, departemen, dan
            penanggung jawab
          </caption>
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
              <tr>
                <td colSpan="8" className={styles.emptyRow}>
                  Tidak ada tiket yang cocok dengan filter ini.{" "}
                  <Link href="/tickets">Reset filter</Link>
                </td>
              </tr>
            )}
            {tickets.map((t) => {
              const isCritical = t.priority === "Critical";
              const hoursIdle = (new Date() - new Date(t.updatedAt)) / 3600000;
              const isSLA =
                (t.status === "New" && hoursIdle > 2) ||
                (isCritical && hoursIdle > 1 && t.status !== "Resolved");
              const hasPings = t.slaBreaches > 0;

              let expiryDateStr = null;
              if (t.customData && typeof t.customData === "object") {
                const expiryVal = Object.values(t.customData).find(
                  (val) => typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)
                );
                if (expiryVal) expiryDateStr = expiryVal;
              }

              let rowClass = "";
              if (isSLA) rowClass = "ticket-row-sla";
              else if (t.slaBreaches > 2 && t.status !== "Resolved") rowClass = "ticket-row-critical";
              else if (hasPings && t.status !== "Resolved") rowClass = "ticket-row-warning";
              else if (expiryDateStr && t.status !== "Resolved" && new Date(expiryDateStr) < new Date())
                rowClass = "ticket-row-expired";

              const presentation = ticketPresentation(t);
              const isExpired = expiryDateStr ? new Date(expiryDateStr) < new Date() : false;

              return (
                <tr key={t.id} className={rowClass}>
                  <td className={styles.trackingCell}>{t.trackingId}</td>
                  <td className={styles.ticketDetail}>
                    <Link
                      href={`/tickets/${t.id}`}
                      className={styles.ticketTitle}
                      title={presentation.title}
                    >
                      {presentation.title}
                    </Link>
                    {presentation.subtitle && (
                      <div className={styles.secondary}>{presentation.subtitle}</div>
                    )}
                    <div className={styles.secondary}>
                      {t.serviceWorkTypeLabel ||
                        WORK_TYPE_LABELS[t.workType] ||
                        WORK_TYPE_LABELS.Unclassified}
                    </div>
                    {(presentation.cids.length > 0 ||
                      (t.sapReference &&
                        ![presentation.title, presentation.subtitle, ...presentation.cids].includes(
                          t.sapReference
                        )) ||
                      (t.slaBreaches > 0 && t.status !== "Resolved") ||
                      (expiryDateStr && t.status !== "Resolved")) && (
                      <div className={styles.metaBadgeRow}>
                        {presentation.cids.map((cid) => (
                          <span key={cid} className={styles.circuit}>
                            CID: {cid}
                          </span>
                        ))}
                        {t.sapReference &&
                          ![presentation.title, presentation.subtitle, ...presentation.cids].includes(
                            t.sapReference
                          ) && <span className={styles.circuit}>SAP: {t.sapReference}</span>}
                        {t.slaBreaches > 0 && t.status !== "Resolved" && (
                          <span className={styles.pingBadge}>x{t.slaBreaches} CS Pings!</span>
                        )}
                        {expiryDateStr && t.status !== "Resolved" && (
                          <span
                            className={`${styles.expiryBadge} ${
                              isExpired ? styles.expiryBadgeExpired : ""
                            }`}
                          >
                            {isExpired
                              ? "EXPIRED"
                              : `Exp: ${new Date(expiryDateStr).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    )}
                    {(t.customData?.["Order Origin"] || t.customData?.["Executing Vendor"]) && (
                      <div className={styles.routing}>
                        {t.customData?.["Order Origin"] && (
                          <span>Penerima order: {t.customData["Order Origin"]}</span>
                        )}
                        {t.customData?.["Executing Vendor"] && (
                          <span>Pelaksana: {t.customData["Executing Vendor"]}</span>
                        )}
                      </div>
                    )}
                    <details className={styles.original}>
                      <summary>Data asal</summary>
                      <dl>
                        <dt>Name</dt>
                        <dd>{presentation.originalName || "Tidak diisi"}</dd>
                        <dt>Subject</dt>
                        <dd>{presentation.originalSubject || "Tidak diisi"}</dd>
                      </dl>
                    </details>
                  </td>
                  <td>
                    {t.jobCategory ? (
                      <span className={styles.categoryPill}>{t.jobCategory.name}</span>
                    ) : (
                      <span className={styles.mutedItalic}>-</span>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={statusStyle(t.status)}>
                      {t.status}
                    </span>
                  </td>
                  <td
                    style={{
                      fontWeight: isCritical ? 700 : 400,
                      color: isCritical ? "var(--ui-danger)" : "inherit",
                    }}
                  >
                    {t.priority}
                  </td>
                  <td className={styles.ageCell}>{timeAgo(t.updatedAt)}</td>
                  <td>{t.department?.name}</td>
                  <td>
                    <div className={styles.assigneeCell}>
                      {t.assignee?.name || (
                        <span className={styles.mutedItalic}>Unassigned</span>
                      )}
                      {canViewAll && (
                        <TicketQuickActions ticketId={t.id} isUnassigned={!t.assigneeId} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination totalCount={totalTickets} pageSize={pageSize} />
    </main>
  );
}

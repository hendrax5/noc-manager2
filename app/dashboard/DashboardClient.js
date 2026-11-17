"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { WORK_TYPES, WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import { useEffect, useState } from "react";
import Link from "next/link";
import LiveOpsBoard from "./LiveOpsBoard";
import DashboardCharts from "./DashboardCharts";
import MyPointsCard from "@/components/MyPointsCard";
import { isPersonalCategoryName } from "@/lib/tickets/personalCategories";
import { normalizeStatus } from "@/lib/tickets/status";
import styles from "./dashboard.module.css";

const CATEGORY_ACCENTS = [
  "var(--ui-info)",
  "var(--ui-danger)",
  "var(--ui-accent)",
  "var(--ui-success)",
  "var(--ui-warning)",
  "var(--ui-orange)",
  "var(--ui-violet)",
];

function getCustomerName(t) {
  if (t.services && t.services.length > 0 && t.services[0].customer) {
    return t.services[0].customer.name;
  }
  if (t.customData && typeof t.customData === "object" && t.customData["Customer Name"]) {
    return t.customData["Customer Name"];
  }
  const match = t.description?.match(/\[Original Reporter: (.*?) -/);
  if (match) return match[1];
  return "-";
}

function getDuration(start, end, nowMs) {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : nowMs;
  if (!startTime || !endTime) return "-";
  const diffMs = Math.max(0, endTime - startTime);
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
}

function statusPillClass(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "New") return styles.pillDanger;
  if (normalized === "In Progress" || normalized === "Open") return styles.pillInfo;
  if (normalized === "Pending") return styles.pillWarning;
  if (normalized === "Resolved") return styles.pillSuccess;
  return "";
}

function priorityBadgeStyle(priority) {
  if (priority === "Critical") return { pill: styles.pillDanger, dot: "var(--ui-danger)" };
  if (priority === "High") return { pill: styles.pillWarning, dot: "var(--ui-warning)" };
  if (priority === "Medium") return { pill: styles.pillInfo, dot: "var(--ui-info)" };
  return { pill: styles.pillSuccess, dot: "var(--ui-success)" };
}

export default function DashboardClient({
  session,
  hasSkyViewAccess,
  finalScope,
  workType = "",
  allowedScopes = ["me"],

  // Workspace / KPI metrics
  totalNewTickets = 0,
  totalInProgressTickets = 0,
  totalWaitingTickets = 0,
  totalRepliedTickets = 0,
  todayResolvedCount = 0,
  avgTtrObj = { h: 0, m: 0 },
  resolvedData = [],

  // Custom Widgets
  showKPIs = true,
  showCategoryMonitor = true,
  showLiveOps = true,
  showMyFollowups = true,
  showShifts = true,
  showCharts = true,

  // Data lists
  categoryMetrics = [],
  categoryStats = [],
  ticketStats = [],
  reportStats = [],
  myOpenTickets = [],
  myShifts = [],
  todayTickets = [],
  todayResolved = 0,

  // Sky View specific data
  picWorkloads = [],
  criticalSlaTickets = [],
  activeCustomerIncidents = [],
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [expandedPics, setExpandedPics] = useState({});
  const [expandedSlas, setExpandedSlas] = useState({});

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
  }, []);

  const showQueueTab = showKPIs || showMyFollowups || showShifts;
  const showAnalyticsTab = showCategoryMonitor || showCharts;

  const availableTabs = [
    ...(showQueueTab ? [{ id: "queue", label: "Antrean & Shift", count: myOpenTickets.length }] : []),
    ...(showLiveOps ? [{ id: "liveops", label: "Live Operations", count: null }] : []),
    ...(showAnalyticsTab ? [{ id: "analytics", label: "Kategori & Analitik", count: null }] : []),
    ...(hasSkyViewAccess ? [{ id: "skyview", label: "Sky View Radar", count: criticalSlaTickets.length }] : []),
  ];

  const requestedTab = searchParams.get("tab");
  const defaultTab =
    availableTabs.find((t) => t.id === requestedTab)?.id ||
    availableTabs[0]?.id ||
    "queue";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (requestedTab && availableTabs.some((t) => t.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTab = availableTabs.some((t) => t.id === activeTab)
    ? activeTab
    : defaultTab;

  const dashboardHref = (scope) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("scope", scope);
    return `/dashboard?${params.toString()}`;
  };

  const classificationQuery = workType ? `&workType=${encodeURIComponent(workType)}` : "";
  const scopeTicketsQuery =
    finalScope === "all"
      ? "&all_depts=true&assignments=me,unassigned,others"
      : finalScope === "dept"
        ? "&assignments=me,unassigned,others"
        : "&assignments=me";

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Staff";
  const userRole = session?.user?.role || "Staff";
  const userDept = session?.user?.department || "General";

  const isCS =
    userDept.includes("CS") ||
    userDept.toLowerCase().includes("customer");
  const canCreate =
    userRole === "Admin" ||
    isCS ||
    session?.user?.permissions?.includes("create_tickets") ||
    session?.user?.permissions?.includes("manage_tickets");

  const activeCategories = categoryMetrics.filter((cat) => cat.active > 0);
  const totalActiveTicketsCount = categoryMetrics.reduce((acc, c) => acc + c.active, 0);
  const totalActiveOutages = activeCustomerIncidents.filter((t) => t.priority === "Critical").length;

  // Find today's shift for calm header context
  const todayShift = mounted
    ? myShifts.find((s) => new Date(s.date).toDateString() === new Date(nowMs).toDateString())
    : null;
  const todayLabel = mounted
    ? new Date(nowMs).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  // Group active incidents by Customer/Client for Sky View
  const clientImpactMap = {};
  activeCustomerIncidents.forEach((t) => {
    const clientName = getCustomerName(t);
    if (clientName === "-") return;
    if (!clientImpactMap[clientName]) {
      clientImpactMap[clientName] = {
        name: clientName,
        criticalCount: 0,
        highCount: 0,
        tickets: [],
      };
    }
    if (t.priority === "Critical") {
      clientImpactMap[clientName].criticalCount += 1;
    } else {
      clientImpactMap[clientName].highCount += 1;
    }
    clientImpactMap[clientName].tickets.push(t);
  });
  const clientImpacts = Object.values(clientImpactMap).sort(
    (a, b) => b.criticalCount * 2 + b.highCount - (a.criticalCount * 2 + a.highCount)
  );

  const togglePicExpand = (id) => {
    setExpandedPics((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSlaExpand = (id) => {
    setExpandedSlas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={styles.workspace}>
      {/* Calm Shift Header */}
      <header className={styles.shiftHeader}>
        <div className={styles.identity}>
          {session?.user?.avatarUrl ? (
            <img src={session.user.avatarUrl} alt={userName} className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback} aria-hidden="true">
              {userName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            {mounted && (
              <div className={styles.shiftContext}>
                {todayLabel}
                {todayShift
                  ? todayShift.shiftTypeId === null
                    ? " · Day Off"
                    : ` · ${todayShift.shiftType?.name || "Shift"} (${todayShift.shiftType?.startTime || "-"})`
                  : ""}
              </div>
            )}
            <h1 className={styles.greeting}>Selamat bertugas, {userName}</h1>
            <div className={styles.badgeRow}>
              <span className={styles.pill}>{userRole}</span>
              <span className={`${styles.pill} ${styles.pillAccent}`}>{userDept}</span>
              <span className={`${styles.pill} ${myOpenTickets.length > 0 ? styles.pillWarning : styles.pillSuccess}`}>
                {myOpenTickets.length} follow-up aktif
              </span>
            </div>
          </div>
        </div>

        <div className={styles.headerControls}>
          <label className={styles.controlField}>
            <span>Klasifikasi pekerjaan</span>
            <select
              value={workType}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams.toString());
                if (e.target.value) params.set("workType", e.target.value);
                else params.delete("workType");
                router.push(`/dashboard?${params.toString()}`);
              }}
              className={styles.controlSelect}
            >
              <option value="">Semua</option>
              {WORK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {WORK_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          {allowedScopes.length > 1 && (
            <div className={styles.scopeSwitch} role="group" aria-label="Cakupan data dashboard">
              {allowedScopes.includes("all") && (
                <Link
                  href={dashboardHref("all")}
                  className={`${styles.scopeLink} ${finalScope === "all" ? styles.scopeLinkActive : ""}`}
                >
                  Global
                </Link>
              )}
              {allowedScopes.includes("dept") && (
                <Link
                  href={dashboardHref("dept")}
                  className={`${styles.scopeLink} ${finalScope === "dept" ? styles.scopeLinkActive : ""}`}
                >
                  Dept
                </Link>
              )}
              {allowedScopes.includes("me") && (
                <Link
                  href={dashboardHref("me")}
                  className={`${styles.scopeLink} ${finalScope === "me" ? styles.scopeLinkActive : ""}`}
                >
                  Me
                </Link>
              )}
            </div>
          )}

          {canCreate && (
            <Link
              href={workType ? `/tickets/new?workType=${workType}` : "/tickets/new"}
              className={`primary-btn btn-fit ${styles.createBtn}`}
            >
              <span aria-hidden="true">+</span> Create Ticket
            </Link>
          )}
        </div>
      </header>

      {/* Fallback MyPointsCard when Queue tab is disabled by dept config */}
      {!showQueueTab && session?.user?.id && <MyPointsCard userId={session.user.id} />}

      {/* Clean Segmented Sub-Navigation */}
      {availableTabs.length > 1 && (
        <nav className={styles.subNav} role="tablist" aria-label="Tampilan dashboard">
          {availableTabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.subNavBtn} ${isActive ? styles.subNavBtnActive : ""}`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && <span className={styles.tabCount}>{tab.count}</span>}
              </button>
            );
          })}
        </nav>
      )}

      {/* =================================================================== */}
      {/* TAB 1: ANTREAN & SHIFT (FOCUS-FIRST WORKSPACE)                      */}
      {/* =================================================================== */}
      {currentTab === "queue" && (
        <>
          {showKPIs && (
            <section className={styles.kpiStrip} aria-label="Ringkasan tiket">
              <Link
                href={`/tickets?statuses=New${classificationQuery}${scopeTicketsQuery}`}
                className={styles.kpiLink}
              >
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>New</div>
                  <div className={`${styles.kpiValue} ${styles.kpiDanger}`}>{totalNewTickets}</div>
                </div>
              </Link>

              <Link
                href={`/tickets?statuses=In+Progress${classificationQuery}${scopeTicketsQuery}`}
                className={styles.kpiLink}
              >
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>In Progress</div>
                  <div className={`${styles.kpiValue} ${styles.kpiAccent}`}>{totalInProgressTickets}</div>
                </div>
              </Link>

              <Link
                href={`/tickets?statuses=Waiting+Reply,Replied${classificationQuery}${scopeTicketsQuery}`}
                className={styles.kpiLink}
              >
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>Pending</div>
                  <div className={`${styles.kpiValue} ${styles.kpiWarning}`}>
                    {totalWaitingTickets + totalRepliedTickets}
                  </div>
                </div>
              </Link>

              <Link
                href={`/tickets?statuses=Resolved&date=today${classificationQuery}${scopeTicketsQuery}`}
                className={styles.kpiLink}
              >
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>Resolved Today</div>
                  <div className={`${styles.kpiValue} ${styles.kpiSuccess}`}>{todayResolvedCount}</div>
                </div>
              </Link>

              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Avg TTR</div>
                <div className={styles.kpiValue}>
                  {resolvedData.length === 0 ? (
                    "N/A"
                  ) : (
                    <>
                      {avgTtrObj.h > 0 && (
                        <>
                          {avgTtrObj.h}
                          <span className={styles.kpiUnit}>h</span>
                        </>
                      )}
                      {avgTtrObj.m}
                      <span className={styles.kpiUnit}>m</span>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          <div className={styles.queueGrid}>
            {/* Left: My Follow-Ups Focus Queue */}
            {showMyFollowups && (
              <section className={styles.panel} aria-label="Fokus tindak lanjut saya">
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>My Follow-Ups</h2>
                    <p className={styles.panelDesc}>
                      Tiket terbuka yang saat ini di-assign ke Anda untuk segera ditindaklanjuti.
                    </p>
                  </div>
                  {showLiveOps && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("liveops")}
                      className={styles.textActionBtn}
                    >
                      Lihat semua di Live Ops →
                    </button>
                  )}
                </div>

                {myOpenTickets.length === 0 ? (
                  <div className={styles.emptyState}>
                    Anda tidak memiliki tiket terbuka yang sedang menunggu tindak lanjut.
                  </div>
                ) : (
                  <ul className={styles.queueList}>
                    {myOpenTickets.map((ticket) => {
                      const customerName = getCustomerName(ticket);
                      const lastNote = ticket.notes?.[0]?.content;
                      return (
                        <li key={ticket.id} className={styles.queueItem}>
                          <div className={styles.queueMain}>
                            <div className={styles.queueMetaTop}>
                              {ticket.trackingId && (
                                <Link href={`/tickets/${ticket.id}`} className={styles.trackingCode}>
                                  {ticket.trackingId}
                                </Link>
                              )}
                              <span className={`${styles.pill} ${statusPillClass(ticket.status)}`}>
                                {normalizeStatus(ticket.status)}
                              </span>
                              {ticket.jobCategory?.name && (
                                <span className={styles.pill}>{ticket.jobCategory.name}</span>
                              )}
                            </div>

                            <Link href={`/tickets/${ticket.id}`} className={styles.queueTitle}>
                              {customerName !== "-" ? `${customerName} — ` : ""}
                              {ticket.title}
                            </Link>

                            <div className={styles.queueSub}>
                              {lastNote
                                ? `Catatan terakhir: ${lastNote.length > 90 ? `${lastNote.slice(0, 90)}...` : lastNote}`
                                : `Diperbarui ${mounted ? new Date(ticket.updatedAt).toLocaleDateString("id-ID") : "..."}`}
                            </div>
                          </div>

                          <div className={styles.queueActions}>
                            <Link href={`/tickets/${ticket.id}`} className={styles.detailBtn}>
                              Buka Tiket →
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* Right: My Points + Today's Pulse + Weekly Shifts */}
            <aside className={styles.sideColumn}>
              {session?.user?.id && <MyPointsCard userId={session.user.id} />}

              <section className={styles.panel} aria-label="Ringkasan shift dan jadwal">
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Today&apos;s Pulse</h2>
                    <p className={styles.panelDesc}>Aktivitas operasional hari ini</p>
                  </div>
                  <Link
                    href={`/tickets?tab=all&date=today${classificationQuery}`}
                    className={styles.textActionBtn}
                  >
                    Log Matrix →
                  </Link>
                </div>

                <div className={styles.pulseGrid}>
                  <div className={styles.pulseCell}>
                    <div className={styles.pulseNum}>{todayTickets.length}</div>
                    <div className={styles.pulseLabel}>Touched</div>
                  </div>
                  <div className={styles.pulseCell}>
                    <div className={`${styles.pulseNum} ${styles.kpiSuccess}`}>{todayResolved}</div>
                    <div className={styles.pulseLabel}>Resolved</div>
                  </div>
                  <div className={styles.pulseCell}>
                    <div className={`${styles.pulseNum} ${styles.kpiAccent}`}>{totalActiveTicketsCount}</div>
                    <div className={styles.pulseLabel}>Active Jobs</div>
                  </div>
                </div>

                {showShifts && (
                  <>
                    <h3 className={styles.shiftHeading}>Weekly Shifts</h3>
                    {myShifts.length === 0 ? (
                      <div className={styles.emptyState}>Belum ada jadwal shift untuk 7 hari ke depan.</div>
                    ) : (
                      <ul className={styles.shiftList}>
                        {myShifts.map((shift) => {
                          const isOff = shift.shiftTypeId === null;
                          const d = new Date(shift.date);
                          return (
                            <li key={shift.id} className={styles.shiftRow}>
                              <div className={styles.shiftDate}>
                                <span className={styles.dayTag}>
                                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                                </span>
                                <span>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              </div>
                              {isOff ? (
                                <span className={styles.shiftOff}>Day Off</span>
                              ) : (
                                <span>
                                  {shift.shiftType?.name}{" "}
                                  <small>({shift.shiftType?.startTime})</small>
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LIVE OPERATIONS BOARD                                        */}
      {/* =================================================================== */}
      {currentTab === "liveops" && showLiveOps && (
        <section aria-label="Live Operations Board">
          <LiveOpsBoard
            jobCategories={categoryMetrics.filter((c) => !isPersonalCategoryName(c.name))}
            defaultScope={finalScope}
            workType={workType}
          />
        </section>
      )}

      {/* =================================================================== */}
      {/* TAB 3: KATEGORI & ANALITIK                                          */}
      {/* =================================================================== */}
      {currentTab === "analytics" && (
        <div className={styles.analyticsStack}>
          {showCategoryMonitor && (
            <section className={styles.panel} aria-label="Job Category Monitor">
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Job Category Monitor</h2>
                  <p className={styles.panelDesc}>Distribusi beban aktif dan penyelesaian harian per kategori.</p>
                </div>
                <Link
                  href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish${classificationQuery}${scopeTicketsQuery}`}
                  className={styles.textActionBtn}
                >
                  View All Tickets →
                </Link>
              </div>

              {activeCategories.length === 0 ? (
                <div className={styles.emptyState}>Tidak ada tiket aktif pada kategori pekerjaan saat ini.</div>
              ) : (
                <div className={styles.categoryList}>
                  {activeCategories.map((cat, idx) => {
                    const color = CATEGORY_ACCENTS[idx % CATEGORY_ACCENTS.length];
                    const total = cat.active + cat.resolvedToday;
                    const progress = total > 0 ? Math.round((cat.resolvedToday / total) * 100) : 0;
                    return (
                      <Link
                        key={cat.id}
                        href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish&jobCategory=${encodeURIComponent(cat.name)}${classificationQuery}${scopeTicketsQuery}`}
                        className={styles.categoryCard}
                      >
                        <div className={styles.categoryTop}>
                          <span>{cat.name}</span>
                          <span className={`${styles.pill} ${cat.active > 5 ? styles.pillDanger : styles.pillAccent}`}>
                            {cat.active} aktif
                          </span>
                        </div>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${progress}%`, background: color }}
                          />
                        </div>
                        <div className={styles.categoryMeta}>
                          <span>{cat.today} hari ini</span>
                          <span>{cat.resolvedToday} resolved ({progress}%)</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {showCharts && (
            <section className={styles.panel} aria-label="Grafik operasional">
              <DashboardCharts
                ticketStats={ticketStats}
                reportStats={reportStats}
                categoryStats={categoryStats}
              />
            </section>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SKY VIEW RADAR (EXECUTIVE OVERVIEW)                          */}
      {/* =================================================================== */}
      {currentTab === "skyview" && hasSkyViewAccess && (
        <div className={styles.skyStack}>
          {/* Executive Global KPI Stats */}
          <section className={styles.skyKpiGrid} aria-label="Ringkasan eksekutif Sky View">
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Critical Outages</div>
              <div className={`${styles.kpiValue} ${styles.kpiDanger}`}>{totalActiveOutages}</div>
              <p className={styles.skyDesc}>Tiket prioritas tinggi yang membutuhkan intervensi.</p>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>SLA Alerts</div>
              <div className={`${styles.kpiValue} ${styles.kpiWarning}`}>{criticalSlaTickets.length}</div>
              <p className={styles.skyDesc}>Tiket aktif dengan batas SLA yang terus berjalan.</p>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Global Active Tickets</div>
              <div className={`${styles.kpiValue} ${styles.kpiAccent}`}>{totalActiveTicketsCount}</div>
              <p className={styles.skyDesc}>Beban tiket aktif keseluruhan lintas departemen.</p>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>MTTR Global</div>
              <div className={`${styles.kpiValue} ${styles.kpiSuccess}`}>
                {resolvedData.length === 0 ? "N/A" : `${avgTtrObj.h}h ${avgTtrObj.m}m`}
              </div>
              <p className={styles.skyDesc}>Rerata durasi penyelesaian tiket saat ini.</p>
            </div>
          </section>

          {/* Workload Capacity & SLA Escalation Radar */}
          <section className={styles.skyTwoCol}>
            <div className={styles.skyPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>NOC Staff Workload Capacity</h2>
                  <p className={styles.panelDesc}>
                    Monitoring beban aktif per tim teknis untuk penyeimbangan tugas.
                  </p>
                </div>
              </div>

              <div className={styles.skyScroll}>
                {picWorkloads.length === 0 ? (
                  <div className={styles.emptyState}>Tidak ada user NOC terdaftar.</div>
                ) : (
                  picWorkloads.map((u) => {
                    const count = u._count?.tickets || 0;
                    const name = u.name || u.email.split("@")[0];
                    const dept = u.department?.name || "General";
                    const percent = Math.min(Math.round((count / 8) * 100), 100);
                    let barColor = "var(--ui-success)";
                    let loadPill = styles.pillSuccess;
                    let loadText = "Ringan";
                    if (count >= 6) {
                      barColor = "var(--ui-danger)";
                      loadPill = styles.pillDanger;
                      loadText = "Overload";
                    } else if (count >= 3) {
                      barColor = "var(--ui-warning)";
                      loadPill = styles.pillWarning;
                      loadText = "Sedang";
                    }
                    const totalWeight = (u.tickets || []).reduce(
                      (sum, t) => sum + (t.jobCategory?.score || 0),
                      0
                    );
                    const isExpanded = !!expandedPics[u.id];

                    return (
                      <div key={u.id} className={styles.accordionCard}>
                        <button
                          type="button"
                          onClick={() => togglePicExpand(u.id)}
                          aria-expanded={isExpanded}
                          className={styles.accordionTrigger}
                        >
                          <span className={styles.picName}>
                            {isExpanded ? "▼" : "▶"} {name}{" "}
                            <span className={styles.picDept}>({dept})</span>
                          </span>
                          <span className={styles.loadMeta}>
                            {totalWeight > 0 && (
                              <span className={styles.weightText}>Bobot: {totalWeight} pt</span>
                            )}
                            <span className={`${styles.pill} ${loadPill}`}>
                              {count} Tiket · {loadText}
                            </span>
                          </span>
                        </button>

                        <div className={styles.progressTrack} style={{ marginTop: "var(--ui-space-2)" }}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${percent}%`, background: barColor }}
                          />
                        </div>

                        {isExpanded && (
                          <div className={styles.accordionBody}>
                            {!u.tickets || u.tickets.length === 0 ? (
                              <div className={styles.queueSub}>Tidak ada tiket aktif saat ini.</div>
                            ) : (
                              u.tickets.map((t) => {
                                const prio = priorityBadgeStyle(t.priority);
                                const hasDt =
                                  t.customData &&
                                  typeof t.customData === "object" &&
                                  t.customData.hasDowntime;
                                const dur = mounted
                                  ? hasDt && t.customData.startDowntime
                                    ? getDuration(t.customData.startDowntime, t.customData.endDowntime, nowMs)
                                    : getDuration(t.customData?.reopenedAt || t.createdAt, null, nowMs)
                                  : "...";
                                return (
                                  <div key={t.id} className={styles.miniTicketRow}>
                                    <div className={styles.miniTicketLeft}>
                                      <span
                                        className={styles.priorityDot}
                                        style={{ background: prio.dot }}
                                        title={t.priority}
                                      />
                                      <Link href={`/tickets/${t.id}`} className={styles.trackingCode}>
                                        [{t.trackingId}]
                                      </Link>
                                      <span className={styles.miniTicketTitle} title={t.title}>
                                        {t.title}
                                      </span>
                                    </div>
                                    <span className={styles.weightText}>{dur}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className={styles.skyPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>SLA Escalation Radar &amp; Warnings</h2>
                  <p className={styles.panelDesc}>
                    Tiket aktif yang mendekati batas waktu SLA (diurutkan berdasarkan urgensi).
                  </p>
                </div>
              </div>

              <div className={styles.skyScroll}>
                {criticalSlaTickets.length === 0 ? (
                  <div className={styles.emptyState}>Seluruh tiket aktif memiliki SLA yang aman.</div>
                ) : (
                  criticalSlaTickets.map((t) => {
                    const timeLeftMs = mounted
                      ? new Date(t.nextSlaDeadline).getTime() - nowMs
                      : 0;
                    const isOverdue = mounted && timeLeftMs < 0;
                    const timeLeftMin = Math.round(timeLeftMs / 60000);

                    let borderColor = "var(--ui-success)";
                    let urgencyPill = styles.pillSuccess;
                    let statusLabel = mounted ? `Sisa ${timeLeftMin} menit` : "Memuat...";

                    if (isOverdue) {
                      borderColor = "var(--ui-danger)";
                      urgencyPill = styles.pillDanger;
                      statusLabel = "SLA BREACHED";
                    } else if (mounted && timeLeftMin < 30) {
                      borderColor = "var(--ui-warning)";
                      urgencyPill = styles.pillWarning;
                      statusLabel = `Kritis (${timeLeftMin}m)`;
                    }

                    const prio = priorityBadgeStyle(t.priority);
                    const isExpanded = !!expandedSlas[t.id];

                    return (
                      <div
                        key={t.id}
                        className={styles.slaCard}
                        style={{ borderLeftColor: borderColor }}
                      >
                        <div className={styles.slaHeader}>
                          <div className={styles.slaLeft}>
                            <button
                              type="button"
                              onClick={() => toggleSlaExpand(t.id)}
                              aria-expanded={isExpanded}
                              className={styles.accordionTrigger}
                            >
                              <span className={styles.trackingCode}>
                                {isExpanded ? "▼" : "▶"} {t.trackingId}
                              </span>
                            </button>
                            <Link href={`/tickets/${t.id}`} className={styles.queueTitle}>
                              {t.title}
                            </Link>
                            <div className={styles.queueSub}>
                              PIC: {t.assignee?.name || "Unassigned"} · {t.department?.name}
                            </div>
                          </div>

                          <div className={styles.slaRight}>
                            <span className={`${styles.pill} ${urgencyPill}`}>{statusLabel}</span>
                            <div className={styles.badgeRow} style={{ marginTop: 0 }}>
                              <span className={`${styles.pill} ${prio.pill}`}>{t.priority}</span>
                              {t.jobCategory?.name && (
                                <span className={styles.pill}>{t.jobCategory.name}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className={styles.accordionBody}>
                            <div className={styles.queueSub}>
                              <strong>Deskripsi:</strong>{" "}
                              {t.description
                                ? t.description.length > 150
                                  ? `${t.description.slice(0, 150)}...`
                                  : t.description
                                : "Tidak ada deskripsi."}
                            </div>
                            <div className={styles.miniTicketRow}>
                              <span className={styles.queueSub}>
                                Dibuat: {mounted ? new Date(t.createdAt).toLocaleString("en-CA") : "..."} (
                                {mounted ? getDuration(t.createdAt, null, nowMs) : "..."} lalu)
                              </span>
                              <Link href={`/tickets/${t.id}`} className={styles.textActionBtn}>
                                Buka Tiket →
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Customer Outage Impact Matrix & Global Charts */}
          <section className={styles.panel} aria-label="Customer Outage Impact Matrix">
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Customer Outage Impact Matrix</h2>
                <p className={styles.panelDesc}>
                  Daftar pelanggan komersial dengan gangguan Critical (Outage) / High yang sedang aktif.
                </p>
              </div>
            </div>

            {clientImpacts.length === 0 ? (
              <div className={styles.emptyState}>
                Tidak ada pelanggan terdampak outage saat ini. Seluruh jaringan terpantau stabil.
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.impactTable}>
                  <thead>
                    <tr>
                      <th scope="col">Customer Name</th>
                      <th scope="col">Critical Outages</th>
                      <th scope="col">High Incidents</th>
                      <th scope="col">Active Impacted Tickets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientImpacts.map((client) => (
                      <tr key={client.name}>
                        <td>
                          <strong>{client.name}</strong>
                        </td>
                        <td>
                          {client.criticalCount > 0 ? (
                            <span className={`${styles.pill} ${styles.pillDanger}`}>
                              {client.criticalCount} Outage
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {client.highCount > 0 ? (
                            <span className={`${styles.pill} ${styles.pillWarning}`}>
                              {client.highCount} Tiket
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <div className={styles.impactTickets}>
                            {client.tickets.map((t) => {
                              const hasDt =
                                t.customData &&
                                typeof t.customData === "object" &&
                                t.customData.hasDowntime;
                              const dur = mounted
                                ? hasDt && t.customData.startDowntime
                                  ? getDuration(t.customData.startDowntime, t.customData.endDowntime, nowMs)
                                  : getDuration(t.customData?.reopenedAt || t.createdAt, null, nowMs)
                                : "...";
                              return (
                                <div key={t.id} className={styles.impactTicketRow}>
                                  <Link href={`/tickets/${t.id}`} className={styles.trackingCode}>
                                    [{t.trackingId}]
                                  </Link>
                                  <span>{t.title}</span>
                                  <span className={styles.weightText}>Down: {dur}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {showCharts && (
            <section className={styles.panel} aria-label="Analitik tiket global">
              <DashboardCharts
                ticketStats={ticketStats}
                reportStats={reportStats}
                categoryStats={categoryStats}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

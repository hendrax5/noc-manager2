import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { canViewAllPerformance, canViewUserPerformance } from "@/lib/reports/performanceAccess";
import { sumReplyAwardedScore } from "@/lib/tickets/points";

import ReportFilter from "./ReportFilter";

function formatDuration(start, end) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs < 0) return "0m";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}

function formatPeriodLabel(startFilter, endFilter) {
  if (!startFilter && !endFilter) return "Semua waktu";
  const fmt = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const from = startFilter ? fmt(startFilter) : "Awal";
  const to = endFilter ? fmt(endFilter) : "Sekarang";
  return `${from} – ${to}`;
}

export default async function UserReportDetail({ params, searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const resolvedParams = await params;
  const targetUserId = parseInt(resolvedParams.userId, 10);
  if (!Number.isInteger(targetUserId)) {
    return (
      <main className="container">
        <h1>User not found</h1>
      </main>
    );
  }

  if (!canViewUserPerformance(session.user, targetUserId)) {
    redirect(`/reports/${session.user.id}`);
  }

  const canSeeLeaderboard = canViewAllPerformance(session.user);
  const isOwnReport = parseInt(session.user.id, 10) === targetUserId;

  const resolvedSearchParams = await searchParams;
  const startFilter = resolvedSearchParams.start ? new Date(resolvedSearchParams.start) : undefined;
  const endFilter = resolvedSearchParams.end ? new Date(resolvedSearchParams.end) : undefined;
  if (endFilter) endFilter.setHours(23, 59, 59, 999);

  const dateCondition = {};
  if (startFilter || endFilter) {
    dateCondition.createdAt = {};
    if (startFilter) dateCondition.createdAt.gte = startFilter;
    if (endFilter) dateCondition.createdAt.lte = endFilter;
  }

  const ticketDateCondition = {};
  if (startFilter || endFilter) {
    ticketDateCondition.updatedAt = {};
    if (startFilter) ticketDateCondition.updatedAt.gte = startFilter;
    if (endFilter) ticketDateCondition.updatedAt.lte = endFilter;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      department: true,
      comments: {
        where: dateCondition,
        select: { id: true, createdAt: true, ticket: { select: { title: true, id: true, trackingId: true } } },
        orderBy: { createdAt: "desc" },
        take: 12
      },
      historyLogs: {
        where: { action: { not: { contains: "Reply" } }, ...dateCondition },
        select: { id: true, action: true, createdAt: true, awardedScore: true, ticket: { select: { title: true, id: true, trackingId: true } } },
        orderBy: { createdAt: "desc" },
        take: 12
      },
      meetingsAttending: { where: dateCondition, select: { id: true } },
      presentSessions: { where: dateCondition, select: { id: true } }
    }
  });

  if (!targetUser) {
    return (
      <main className="container">
        <h1>User not found</h1>
      </main>
    );
  }

  const isCSTarget = targetUser.department?.name?.includes("CS") || targetUser.department?.name?.toLowerCase().includes("customer");

  const tickets = await prisma.ticket.findMany({
    where: { assigneeId: targetUserId, status: "Resolved", awardedScore: { not: null }, ...ticketDateCondition },
    include: { jobCategory: true },
    orderBy: { updatedAt: "desc" }
  });

  const totalComments = await prisma.comment.count({ where: { authorId: targetUserId, ...dateCondition } });

  const allActivities = await prisma.ticketHistory.findMany({
    where: { actorId: targetUserId, action: { not: { contains: "Reply" } }, ...dateCondition },
    select: { action: true, awardedScore: true }
  });

  const replyLogs = await prisma.ticketHistory.findMany({
    where: {
      actorId: targetUserId,
      OR: [
        { action: { startsWith: "Public reply:" } },
        { action: { startsWith: "Internal reply:" } }
      ],
      ...dateCondition
    },
    select: { action: true, awardedScore: true }
  });

  const jobPoints = tickets.reduce((acc, t) => acc + (t.awardedScore || 0), 0) + allActivities.reduce((acc, h) => acc + (h.awardedScore || 0), 0);
  const replyPoints = sumReplyAwardedScore(replyLogs);

  let createdCount = 0;
  let statusActionsCount = 0;
  allActivities.forEach((h) => {
    if (h.action?.includes("instantiated")) createdCount++;
    else statusActionsCount++;
  });
  const adminActionPoints = isCSTarget ? (createdCount * 5) + statusActionsCount : 0;
  const headlineScore = isCSTarget ? jobPoints + replyPoints + adminActionPoints : jobPoints;

  const personalCategoryTTRRaw = {};
  tickets.forEach((t) => {
    if (!t.jobCategory) return;
    const catName = t.jobCategory.name;
    const end = t.resolvedAt || t.updatedAt;
    const diff = new Date(end).getTime() - new Date(t.customData?.reopenedAt || t.createdAt).getTime();
    if (diff > 0) {
      if (!personalCategoryTTRRaw[catName]) personalCategoryTTRRaw[catName] = { totalMs: 0, count: 0 };
      personalCategoryTTRRaw[catName].totalMs += diff;
      personalCategoryTTRRaw[catName].count += 1;
    }
  });

  const personalCategoryTtr = Object.entries(personalCategoryTTRRaw).map(([name, data]) => {
    const avgMins = Math.round((data.totalMs / data.count) / 60000);
    return { name, avgMins, count: data.count };
  }).sort((a, b) => b.avgMins - a.avgMins);

  const page = parseInt(resolvedSearchParams?.page, 10) || 1;
  const pageSize = parseInt(resolvedSearchParams?.limit, 10) || 10;
  const totalTicketsCount = tickets.length;
  const paginatedTickets = tickets.slice((page - 1) * pageSize, page * pageSize);
  const periodLabel = formatPeriodLabel(startFilter, endFilter);
  const querySuffix = (() => {
    const p = new URLSearchParams();
    if (resolvedSearchParams.start) p.set("start", resolvedSearchParams.start);
    if (resolvedSearchParams.end) p.set("end", resolvedSearchParams.end);
    const q = p.toString();
    return q ? `?${q}` : "";
  })();

  const backHref = canSeeLeaderboard ? `/reports${querySuffix}` : "/dashboard";
  const backLabel = canSeeLeaderboard ? "Kembali ke leaderboard" : "Kembali ke dashboard";

  return (
    <main className="container report-detail">
      <Link href={backHref} className="no-print report-back">
        {backLabel}
      </Link>

      <header className="page-header" style={{ marginBottom: "1.25rem" }}>
        <p className="report-kicker">{targetUser.department?.name || "General"}</p>
        <h1 style={{ marginBottom: "0.35rem" }}>
          {isOwnReport ? "Poin saya" : (targetUser.name || targetUser.email)}
        </h1>
        <p style={{ margin: 0, color: "var(--muted-text)" }}>
          {isOwnReport ? (targetUser.name || targetUser.email) + " · " : null}
          Periode {periodLabel}
        </p>
      </header>

      <ReportFilter userId={targetUserId} />

      <section className="card report-score-block">
        <div className="report-score-main">
          <span className="report-score-label">Total poin</span>
          <span className="report-score-value kpi-value">{headlineScore}</span>
        </div>
        <dl className="report-score-breakdown">
          <div>
            <dt>Job</dt>
            <dd className="kpi-value">{jobPoints}</dd>
          </div>
          <div>
            <dt>Balasan</dt>
            <dd className="kpi-value">{replyPoints}</dd>
          </div>
          {isCSTarget && (
            <div>
              <dt>Aksi CS</dt>
              <dd className="kpi-value">{adminActionPoints}</dd>
            </div>
          )}
          <div>
            <dt>Meeting</dt>
            <dd className="kpi-value">{targetUser.presentSessions.length}<span className="report-score-sub">/{targetUser.meetingsAttending.length}</span></dd>
          </div>
        </dl>
      </section>

      {personalCategoryTtr.length > 0 && (
        <section className="card" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Rata-rata TTR per kategori</h2>
          <ul className="report-ttr-list">
            {personalCategoryTtr.map((cat) => {
              const pct = Math.min(100, (cat.avgMins / 240) * 100);
              return (
                <li key={cat.name}>
                  <div className="report-ttr-meta">
                    <span>{cat.name}</span>
                    <span className="kpi-value">{formatDuration(0, cat.avgMins * 60000)} <small>({cat.count})</small></span>
                  </div>
                  <div className="ttr-bar-container">
                    <div className="ttr-bar" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card" style={{ marginTop: "1.25rem", padding: 0, overflow: "hidden" }}>
        <div className="report-section-head">
          <h2>Tiket terselesaikan</h2>
          <span>{totalTicketsCount} tiket</span>
        </div>
        {paginatedTickets.length === 0 ? (
          <p className="report-empty">Tidak ada tiket terskor pada periode ini.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>TTR</th>
                <th>Tiket</th>
                <th style={{ textAlign: "right" }}>Poin</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTickets.map((t) => (
                <tr key={t.id}>
                  <td style={{ color: "var(--muted-text)" }}>{new Date(t.updatedAt).toLocaleDateString("id-ID")}</td>
                  <td className="kpi-value">{formatDuration(t.customData?.reopenedAt || t.createdAt, t.resolvedAt || t.updatedAt)}</td>
                  <td>
                    <Link href={`/tickets/${t.id}`}>{t.trackingId}</Link>
                    {t.jobCategory?.name ? (
                      <div style={{ fontSize: "0.8rem", color: "var(--muted-text)", fontWeight: 400 }}>{t.jobCategory.name}</div>
                    ) : null}
                  </td>
                  <td className="kpi-value" style={{ textAlign: "right" }}>+{t.awardedScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalTicketsCount > pageSize && (
          <div style={{ borderTop: "1px solid var(--border-color)" }}>
            <Pagination totalCount={totalTicketsCount} pageSize={pageSize} />
          </div>
        )}
      </section>

      <div className="report-split">
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="report-section-head">
            <h2>Balasan terbaru</h2>
            <span>{totalComments} balasan</span>
          </div>
          {targetUser.comments.length === 0 ? (
            <p className="report-empty">Belum ada balasan pada periode ini.</p>
          ) : (
            <ul className="report-activity">
              {targetUser.comments.map((c) => (
                <li key={c.id}>
                  <Link href={`/tickets/${c.ticket.id}`}>{c.ticket.trackingId}</Link>
                  <span>{c.ticket.title}</span>
                  <time>{new Date(c.createdAt).toLocaleDateString("id-ID")}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="report-section-head">
            <h2>Aktivitas</h2>
            <span>{allActivities.length} aksi</span>
          </div>
          {targetUser.historyLogs.length === 0 ? (
            <p className="report-empty">Belum ada aktivitas pada periode ini.</p>
          ) : (
            <ul className="report-activity">
              {targetUser.historyLogs.map((h) => (
                <li key={h.id}>
                  <span className="report-activity-action">{h.action}</span>
                  {h.ticket && (
                    <Link href={`/tickets/${h.ticket.id}`}>{h.ticket.trackingId}</Link>
                  )}
                  <time>
                    {new Date(h.createdAt).toLocaleDateString("id-ID")}
                    {h.awardedScore ? ` · +${h.awardedScore}` : ""}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function PerformanceDrawer({ userId, onClose, startDate = "", endDate = "", reportHref = "" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const query = new URLSearchParams();
        if (startDate) query.set("start", startDate);
        if (endDate) query.set("end", endDate);

        const res = await fetch(`/api/reports/performance/${userId}?${query.toString()}`);
        if (!res.ok) {
          throw new Error(res.status === 403 ? "Tidak ada akses ke laporan ini." : "Gagal memuat data performa.");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (userId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userId, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!userId) return null;

  function formatDuration(mins) {
    if (mins === null || mins === undefined) return "—";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  const periodLabel = startDate || endDate
    ? `${startDate || "Awal"} – ${endDate || "Sekarang"}`
    : "Semua waktu";

  const jobPoints = data?.metrics?.taskPoints ?? 0;
  const replyPoints = data?.metrics?.replyPoints ?? 0;
  const headline = data?.metrics?.isCS ? data.metrics.finalScore : jobPoints;

  return (
    <div className="drawer-overlay">
      <div className="drawer-container" ref={drawerRef} role="dialog" aria-modal="true">
        <header className="drawer-header">
          <div>
            <h2>{loading ? "Memuat…" : (data?.user?.name || "—")}</h2>
            <p>
              {data?.user?.department || "Operator"} · {periodLabel}
            </p>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Tutup">
            Tutup
          </button>
        </header>

        <div className="drawer-body">
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="skeleton" style={{ height: 72 }} />
              <div className="skeleton" style={{ height: 160 }} />
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          )}

          {error && (
            <p className="error-text" style={{ margin: 0 }}>{error}</p>
          )}

          {!loading && !error && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <section className="report-score-block" style={{ boxShadow: "none" }}>
                <div className="report-score-main">
                  <span className="report-score-label">Total poin</span>
                  <span className="report-score-value kpi-value">{headline}</span>
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
                  <div>
                    <dt>Selesai</dt>
                    <dd className="kpi-value">{data.metrics.resolvedCount}</dd>
                  </div>
                </dl>
              </section>

              {reportHref && (
                <Link href={reportHref} className="primary-btn" style={{ textAlign: "center", textDecoration: "none" }}>
                  Laporan lengkap
                </Link>
              )}

              {data.categoryTtr.length > 0 && (
                <section>
                  <h3 className="report-section-title">TTR per kategori</h3>
                  <ul className="report-ttr-list">
                    {data.categoryTtr.map((cat) => {
                      const pct = Math.min(100, (cat.avgMins / 240) * 100);
                      return (
                        <li key={cat.name}>
                          <div className="report-ttr-meta">
                            <span>{cat.name}</span>
                            <span className="kpi-value">{formatDuration(cat.avgMins)} <small>({cat.count})</small></span>
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

              <section>
                <h3 className="report-section-title">Tiket</h3>
                {data.tickets.length === 0 ? (
                  <p className="report-empty">Tidak ada tiket pada periode ini.</p>
                ) : (
                  <ul className="report-activity">
                    {data.tickets.slice(0, 8).map((ticket) => (
                      <li key={ticket.id}>
                        <Link href={`/tickets/${ticket.id}`} target="_blank">{ticket.trackingId}</Link>
                        <span>{ticket.title}</span>
                        <time>
                          {ticket.status}
                          {ticket.ttrMins != null ? ` · ${formatDuration(ticket.ttrMins)}` : ""}
                          {ticket.awardedScore ? ` · +${ticket.awardedScore}` : ""}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {data.activities.length > 0 && (
                <section>
                  <h3 className="report-section-title">Aktivitas</h3>
                  <ul className="report-activity">
                    {data.activities.slice(0, 8).map((act) => (
                      <li key={act.id}>
                        <span className="report-activity-action">{act.action}</span>
                        {act.ticket && (
                          <Link href={`/tickets/${act.ticket.id}`} target="_blank">{act.ticket.trackingId}</Link>
                        )}
                        <time>
                          {new Date(act.createdAt).toLocaleDateString("id-ID")}
                          {act.awardedScore ? ` · +${act.awardedScore}` : ""}
                        </time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

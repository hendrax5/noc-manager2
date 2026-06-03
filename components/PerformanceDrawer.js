"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function PerformanceDrawer({ userId, onClose, startDate = "", endDate = "" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        if (startDate) query.set("start", startDate);
        if (endDate) query.set("end", endDate);
        
        const res = await fetch(`/api/reports/performance/${userId}?${query.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch performance data");
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

  // Close drawer on clicking outside
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

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!userId) return null;

  function formatDuration(mins) {
    if (mins === null || mins === undefined) return "-";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="drawer-overlay">
      <div className="drawer-container" ref={drawerRef}>
        <header className="drawer-header">
          <div className="drawer-title-group">
            <div className="podium-avatar" style={{ 
              margin: 0, 
              background: data?.metrics?.isCS ? "#3b82f6" : "#10b981", 
              width: "40px", 
              height: "40px",
              fontSize: "0.95rem"
            }}>
              {data?.user?.avatarUrl ? (
                <img src={data.user.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                getInitials(data?.user?.name)
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--heading-color)" }}>
                {loading ? "Memuat Data..." : data?.user?.name}
              </h2>
              <span className="badge" style={{ backgroundColor: "#64748b", marginTop: "0.15rem" }}>
                {data?.user?.department || "Operator"}
              </span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} title="Tutup">✖</button>
        </header>

        <div className="drawer-body">
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "1rem" }}>
              <div style={{ width: "35px", height: "35px", border: "4px solid #cbd5e1", borderTopColor: "var(--secondary-color)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <span style={{ color: "#64748b", fontSize: "0.9rem" }}>Mengambil riwayat performa...</span>
            </div>
          )}

          {error && (
            <div className="card" style={{ borderLeft: "4px solid #ef4444", padding: "1rem", color: "#ef4444" }}>
              Gagal memuat data: {error}
            </div>
          )}

          {!loading && !error && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Score and Activity Summary Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="card" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem", margin: 0 }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Skor Kumulatif</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#10b981" }}>
                    {data.metrics.finalScore} <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>pts</span>
                  </span>
                </div>
                <div className="card" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem", margin: 0 }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Tiket Diselesaikan</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#3b82f6" }}>
                    {data.metrics.resolvedCount} <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>/ {data.metrics.totalInvolvedCount} total</span>
                  </span>
                </div>
                <div className="card" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem", margin: 0 }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Pertemuan Dihadiri</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#8b5cf6" }}>
                    {data.metrics.meetingsAttended} <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>/ {data.metrics.meetingsScheduled}</span>
                  </span>
                </div>
                <div className="card" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem", margin: 0 }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Aktivitas / Balasan</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f59e0b" }}>
                    {data.metrics.activitiesCount} <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>act / {data.metrics.totalComments} msg</span>
                  </span>
                </div>
              </div>

              {/* Personal TTR by Category */}
              {data.categoryTtr.length > 0 && (
                <div className="card" style={{ padding: "0.85rem", margin: 0 }}>
                  <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", color: "var(--heading-color)" }}>Rata-rata TTR per Kategori</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {data.categoryTtr.map(cat => {
                      const maxVal = 240; // Max visual reference in mins (4 hours)
                      const pct = Math.min(100, (cat.avgMins / maxVal) * 100);
                      const barColor = cat.avgMins > 120 ? "#ef4444" : cat.avgMins > 60 ? "#f59e0b" : "#10b981";
                      return (
                        <div key={cat.name} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                            <span style={{ fontWeight: "600", color: "var(--text-color)" }}>{cat.name} <span style={{ color: "#94a3b8", fontWeight: "normal" }}>({cat.count} tiket)</span></span>
                            <span style={{ fontWeight: "bold", color: barColor }}>{formatDuration(cat.avgMins)}</span>
                          </div>
                          <div className="ttr-bar-container">
                            <div className="ttr-bar" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Handled Tickets (Tracking Per Ticket & Status) */}
              <div className="card" style={{ padding: "0", overflow: "hidden", margin: 0 }}>
                <h3 style={{ padding: "0.85rem 1rem", margin: 0, background: "var(--table-header-bg)", borderBottom: "1px solid var(--border-color)", fontSize: "0.9rem", color: "var(--heading-color)" }}>
                  Tiket yang Ditangani
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0, boxShadow: "none", borderRadius: 0, width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: "0.75rem", padding: "0.5rem 0.75rem" }}>Tiket</th>
                        <th style={{ fontSize: "0.75rem", padding: "0.5rem 0.75rem" }}>Kategori</th>
                        <th style={{ fontSize: "0.75rem", padding: "0.5rem 0.75rem", textAlign: "center" }}>TTR</th>
                        <th style={{ fontSize: "0.75rem", padding: "0.5rem 0.75rem", textAlign: "right" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tickets.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontSize: "0.8rem" }}>
                            Tidak ada tiket yang ditangani dalam periode ini.
                          </td>
                        </tr>
                      ) : (
                        data.tickets.map(ticket => (
                          <tr key={ticket.id} style={{ fontSize: "0.8rem" }}>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <Link 
                                href={`/tickets/${ticket.id}`} 
                                target="_blank" 
                                style={{ color: "var(--secondary-color)", fontWeight: "600", textDecoration: "none" }}
                              >
                                {ticket.trackingId}
                              </Link>
                              <div style={{ color: "#64748b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "160px", fontSize: "0.75rem" }} title={ticket.title}>
                                {ticket.title}
                              </div>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>
                              {ticket.jobCategory}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: "bold", color: "#64748b" }}>
                              {ticket.ttrMins !== null ? formatDuration(ticket.ttrMins) : "-"}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                              <span className={`status-badge status-${ticket.status.toLowerCase()}`}>
                                {ticket.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              {data.activities.length > 0 && (
                <div className="card" style={{ padding: "0.85rem", margin: 0 }}>
                  <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", color: "var(--heading-color)" }}>Timeline Aktivitas</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderLeft: "2px solid var(--border-color)", paddingLeft: "1rem", marginLeft: "0.5rem" }}>
                    {data.activities.map(act => (
                      <div key={act.id} style={{ position: "relative" }}>
                        <div style={{ 
                          position: "absolute", 
                          left: "-1.35rem", 
                          top: "0.25rem", 
                          width: "8px", 
                          height: "8px", 
                          borderRadius: "50%", 
                          backgroundColor: act.awardedScore ? "#10b981" : "var(--secondary-color)",
                          boxShadow: "0 0 0 4px var(--card-bg)"
                        }} />
                        <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--heading-color)" }}>
                          {act.action}
                        </div>
                        {act.ticket && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                            Tiket: <Link href={`/tickets/${act.ticket.id}`} target="_blank" style={{ color: "var(--secondary-color)", textDecoration: "none" }}>{act.ticket.trackingId}</Link> - {act.ticket.title}
                          </div>
                        )}
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                          {new Date(act.createdAt).toLocaleString()} {act.awardedScore ? `(+${act.awardedScore} pts)` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function TeamWorkHours({ departments = [], isAdmin = false }) {
  const todayStr = new Date().toLocaleDateString("sv-SE"); // Swedish format YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedDept, setSelectedDept] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    const fetchWorkHours = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("date", selectedDate);
        if (selectedDept) params.set("departmentId", selectedDept);

        const res = await fetch(`/api/reports/work-hours?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Gagal mengambil data jam kerja tim.");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkHours();
  }, [selectedDate, selectedDept]);

  const toggleExpandUser = (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}j`;
    return `${h}j ${m}m`;
  };

  // 1. Calculate Summary KPIs
  const teamStats = {
    avgEfficiency: 0,
    activeCount: 0,
    totalEffectiveHours: 0,
    overtimeCases: 0
  };

  if (data && data.users.length > 0) {
    let totalEffRate = 0;
    let usersWithShifts = 0;
    data.users.forEach(u => {
      teamStats.totalEffectiveHours += u.stats.totalEffectiveHours;
      if (u.activities.length > 0) {
        teamStats.activeCount++;
      }
      if (u.stats.overtimeHours > 0) {
        teamStats.overtimeCases++;
      }
      if (u.shift.hasScheduledShift) {
        totalEffRate += u.stats.efficiencyRate;
        usersWithShifts++;
      }
    });
    teamStats.avgEfficiency = usersWithShifts > 0 ? Math.round(totalEffRate / usersWithShifts) : 0;
  }

  // 2. Generate Timeline Scale Ticks
  const timelineTicks = [];
  if (data && data.globalRange) {
    const startMs = new Date(data.globalRange.start).getTime();
    const endMs = new Date(data.globalRange.end).getTime();
    const durationMs = endMs - startMs;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const startHour = startDate.getHours();
    // Round end hour up
    const endHour = endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);

    for (let h = startHour; h <= endHour; h++) {
      const tickTime = new Date(startMs);
      tickTime.setHours(h, 0, 0, 0);
      const tickMs = tickTime.getTime();

      if (tickMs >= startMs && tickMs <= endMs) {
        const pct = ((tickMs - startMs) / durationMs) * 100;
        timelineTicks.push({
          label: `${String(h).padStart(2, "0")}:00`,
          pct
        });
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Date & Department Filters */}
      <div className="card" style={{ padding: "1.25rem", margin: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#64748b" }}>Tanggal:</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--input-text)",
                fontSize: "0.9rem",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#64748b" }}>Departemen:</label>
            <select 
              value={selectedDept} 
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--input-text)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
                minWidth: "150px"
              }}
            >
              <option value="">Semua Departemen</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

        </div>

        <button 
          onClick={() => {
            setSelectedDate(todayStr);
            setSelectedDept("");
          }}
          className="logout-btn"
          style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", margin: 0, height: "36px" }}
        >
          Reset Filter
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", flexDirection: "column", gap: "1rem" }}>
          <div style={{ width: "35px", height: "35px", border: "4px solid #cbd5e1", borderTopColor: "var(--secondary-color)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
          <span style={{ color: "#64748b", fontSize: "0.9rem" }}>Memproses lini masa aktivitas tim...</span>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderLeft: "4px solid #ef4444", padding: "1rem", color: "#ef4444", margin: 0 }}>
          Terjadi kesalahan: {error}
        </div>
      )}

      {/* Stats Cards */}
      {!loading && !error && data && (
        <>
          <div className="sky-view-grid">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>🕒</div>
              <div className="kpi-content">
                <span className="kpi-value">{teamStats.avgEfficiency}%</span>
                <span className="kpi-label">Efisiensi Rata-rata Tim</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "#dcfce7", color: "#15803d" }}>👤</div>
              <div className="kpi-content">
                <span className="kpi-value">{teamStats.activeCount} <span style={{ fontSize: "0.85rem", fontWeight: "normal", color: "#64748b" }}>/ {data.users.length}</span></span>
                <span className="kpi-label">Operator Aktif Hari Ini</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "#f3e8ff", color: "#6b21a8" }}>⚡</div>
              <div className="kpi-content">
                <span className="kpi-value">{formatDuration(teamStats.totalEffectiveHours)}</span>
                <span className="kpi-label">Total Jam Kerja Efektif</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>🔥</div>
              <div className="kpi-content">
                <span className="kpi-value">{teamStats.overtimeCases}</span>
                <span className="kpi-label">Staf Mengambil Lembur</span>
              </div>
            </div>
          </div>

          {/* Timeline Table Grid */}
          <div className="card" style={{ padding: "1.25rem", margin: 0, overflowX: "auto" }}>
            <h3 style={{ margin: "0 0 1.5rem 0", fontSize: "1.1rem", fontWeight: "700", color: "var(--heading-color)" }}>
              Visualisasi Lini Masa Waktu Bekerja Tim
            </h3>

            {data.users.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                Tidak ada data tim ditemukan untuk tanggal/filter departemen ini.
              </div>
            ) : (
              <div style={{ minWidth: "800px" }}>
                
                {/* Timeline Axis Ticks Ruler */}
                <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem", marginBottom: "0.5rem" }}>
                  <div></div> {/* Empty for alignment with avatar column */}
                  <div style={{ position: "relative", height: "20px", borderBottom: "1px solid var(--border-color)" }}>
                    {timelineTicks.map(tick => (
                      <span 
                        key={tick.label} 
                        style={{ 
                          position: "absolute", 
                          left: `${tick.pct}%`, 
                          transform: "translateX(-50%)", 
                          fontSize: "0.75rem", 
                          color: "#64748b",
                          fontWeight: "500"
                        }}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Team Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {data.users.map(u => {
                    const startMs = new Date(data.globalRange.start).getTime();
                    const endMs = new Date(data.globalRange.end).getTime();
                    const globalDurationMs = endMs - startMs;
                    
                    const isExpanded = expandedUser === u.user.id;

                    return (
                      <div key={u.user.id} style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
                        
                        {/* User Row Header and Timeline Bar */}
                        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem", alignItems: "center" }}>
                          
                          {/* Left Column: User details */}
                          <div 
                            onClick={() => toggleExpandUser(u.user.id)}
                            style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}
                          >
                            <div className="podium-avatar" style={{ 
                              margin: 0, 
                              background: u.stats.efficiencyRate >= 60 ? "#10b981" : u.stats.efficiencyRate >= 30 ? "#f59e0b" : "#ef4444", 
                              width: "36px", 
                              height: "36px",
                              fontSize: "0.85rem",
                              flexShrink: 0
                            }}>
                              {u.user.avatarUrl ? (
                                <img src={u.user.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                              ) : (
                                getInitials(u.user.name)
                              )}
                            </div>
                            <div style={{ overflow: "hidden" }}>
                              <div style={{ fontWeight: "700", fontSize: "0.875rem", color: "var(--heading-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={u.user.name}>
                                {u.user.name}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span>{u.user.department}</span>
                                <span>•</span>
                                <span style={{ fontWeight: "bold" }}>{u.stats.efficiencyRate}% Efisien</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Visual timeline bar */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            
                            {/* Shift window limits labels */}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#94a3b8" }}>
                              <span>Shift: {u.shift.name} ({u.shift.startTime} - {u.shift.endTime})</span>
                              {u.stats.overtimeHours > 0 && (
                                <span style={{ color: "#f97316", fontWeight: "bold" }}>⚡ Lembur: {formatDuration(u.stats.overtimeHours)}</span>
                              )}
                            </div>

                            {/* Timeline Bar */}
                            <div style={{ 
                              display: "flex", 
                              height: "28px", 
                              width: "100%", 
                              borderRadius: "6px", 
                              overflow: "hidden", 
                              background: "rgba(148, 163, 184, 0.08)",
                              border: "1px solid var(--border-color)",
                              position: "relative"
                            }}>
                              {u.segments.map((seg, idx) => {
                                const segStartMs = new Date(seg.start).getTime();
                                const segEndMs = new Date(seg.end).getTime();
                                const segDurationMs = segEndMs - segStartMs;
                                const widthPct = (segDurationMs / globalDurationMs) * 100;

                                // Resolve styling based on type
                                let bg = "transparent";
                                let title = "";
                                if (seg.type === "active") {
                                  bg = "linear-gradient(135deg, #10b981, #059669)";
                                  title = `Kerja Efektif: ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)}), Aktivitas: ${seg.activityCount}`;
                                } else if (seg.type === "overtime") {
                                  bg = "linear-gradient(135deg, #f97316, #ea580c)";
                                  title = `Lembur/Ekstra: ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)}), Aktivitas: ${seg.activityCount}`;
                                } else if (seg.type === "idle") {
                                  bg = "rgba(148, 163, 184, 0.15)";
                                  title = `Waktu Kosong: ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)})`;
                                }

                                return (
                                  <div 
                                    key={idx} 
                                    title={title}
                                    style={{
                                      width: `${widthPct}%`,
                                      background: bg,
                                      height: "100%",
                                      cursor: "help",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "white",
                                      fontSize: "0.65rem",
                                      fontWeight: "bold",
                                      transition: "filter 0.1s",
                                      borderRight: "1px solid rgba(255, 255, 255, 0.1)"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                                    onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                                  >
                                    {(seg.type === "active" || seg.type === "overtime") && seg.durationMins >= 30 && (
                                      <span>{seg.activityCount}a</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                          </div>

                        </div>

                        {/* Collapsible Details Row */}
                        {isExpanded && (
                          <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1.5rem", animation: "fadeIn 0.2s ease-out" }}>
                            
                            {/* Summary Statistics & Loyalty Analysis */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              {/* Statistics Card */}
                              <div className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", background: "var(--hover-bg)", margin: 0 }}>
                                <h4 style={{ margin: 0, color: "var(--heading-color)", fontSize: "0.85rem", fontWeight: "700" }}>Statistik Harian: {u.user.name}</h4>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.8rem" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Durasi Shift:</span>
                                    <span style={{ fontWeight: "600", color: "var(--heading-color)" }}>{formatDuration(u.stats.shiftHours)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#10b981", fontWeight: "500" }}>Kerja Efektif Shift:</span>
                                    <span style={{ fontWeight: "600", color: "var(--heading-color)" }}>{formatDuration(u.stats.activeHours)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#f97316", fontWeight: "500" }}>Kerja Lembur:</span>
                                    <span style={{ fontWeight: "600", color: "var(--heading-color)" }}>{formatDuration(u.stats.overtimeHours)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Waktu Kosong (Shift):</span>
                                    <span style={{ fontWeight: "600", color: "var(--heading-color)" }}>{formatDuration(u.stats.idleHours)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                                    <span style={{ fontWeight: "bold", color: "var(--heading-color)" }}>Rasio Efisiensi Shift:</span>
                                    <span style={{ fontWeight: "bold", color: u.stats.efficiencyRate >= 60 ? "#10b981" : u.stats.efficiencyRate >= 30 ? "#f59e0b" : "#ef4444" }}>
                                      {u.stats.efficiencyRate}%
                                    </span>
                                  </div>
                                </div>

                                {/* Progress bar representing shift efficiency */}
                                <div className="ttr-bar-container" style={{ margin: "0.25rem 0 0 0" }}>
                                  <div 
                                    className="ttr-bar" 
                                    style={{ 
                                      width: `${u.stats.efficiencyRate}%`, 
                                      backgroundColor: u.stats.efficiencyRate >= 60 ? "#10b981" : u.stats.efficiencyRate >= 30 ? "#f59e0b" : "#ef4444" 
                                    }} 
                                  />
                                </div>
                              </div>

                              {/* Loyalty/Diligence Analysis Card */}
                              {u.diligence && (
                                <div className="card" style={{ 
                                  padding: "1rem", 
                                  display: "flex", 
                                  flexDirection: "column", 
                                  gap: "0.75rem", 
                                  background: u.diligence.score >= 75 ? "rgba(16, 185, 129, 0.04)" : u.diligence.score >= 50 ? "rgba(59, 130, 246, 0.04)" : u.diligence.score >= 25 ? "var(--hover-bg)" : "rgba(239, 68, 68, 0.04)",
                                  borderLeft: `4px solid ${u.diligence.score >= 75 ? "#10b981" : u.diligence.score >= 50 ? "#3b82f6" : u.diligence.score >= 25 ? "#64748b" : "#ef4444"}`,
                                  margin: 0 
                                }}>
                                  <h4 style={{ margin: 0, color: "var(--heading-color)", fontSize: "0.85rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    🧠 Analisis Kualitas Kerja & Loyalitas
                                  </h4>
                                  
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: u.diligence.score >= 75 ? "#10b981" : u.diligence.score >= 50 ? "#3b82f6" : u.diligence.score >= 25 ? "var(--heading-color)" : "#ef4444" }}>
                                      {u.diligence.level}
                                    </span>
                                    <span style={{ fontSize: "0.7rem", fontWeight: "bold", background: "var(--border-color)", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>
                                      Indeks: {u.diligence.score}/100
                                    </span>
                                  </div>

                                  <p style={{ fontSize: "0.75rem", color: "var(--text-color)", margin: 0, lineHeight: "1.4" }}>
                                    {u.diligence.feedbackText}
                                  </p>

                                  {u.diligence.keywordsDetected.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
                                      {u.diligence.keywordsDetected.map(kw => (
                                        <span key={kw} style={{ fontSize: "0.65rem", background: "rgba(148, 163, 184, 0.15)", padding: "0.1rem 0.35rem", borderRadius: "3px", color: "var(--text-color)" }}>
                                          #{kw}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Activities Log Timeline */}
                            <div className="card" style={{ padding: "1rem", overflow: "hidden", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                              <h4 style={{ margin: 0, color: "var(--heading-color)", fontSize: "0.85rem", fontWeight: "700" }}>Rincian Aktivitas Tiket</h4>
                              
                              <div style={{ overflowY: "auto", maxHeight: "250px", display: "flex", flexDirection: "column", gap: "0.75rem", paddingRight: "0.25rem" }}>
                                {u.activities.length === 0 ? (
                                  <div style={{ textAlign: "center", color: "#64748b", padding: "1.5rem", fontSize: "0.8rem" }}>
                                    Tidak ada aktivitas tiket yang tercatat hari ini.
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderLeft: "2px solid var(--border-color)", paddingLeft: "1rem", marginLeft: "0.5rem" }}>
                                    {u.activities.map(act => {
                                      const timeStr = new Date(act.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                      const isComment = act.action?.includes("Reply") || act.id?.startsWith("comment");
                                      const isOvertime = new Date(act.timestamp) < new Date(u.shift.start) || new Date(act.timestamp) > new Date(u.shift.end);

                                      return (
                                        <div key={act.id} style={{ position: "relative", fontSize: "0.8rem" }}>
                                          {/* Circle timeline dot */}
                                          <div style={{ 
                                            position: "absolute", 
                                            left: "-1.35rem", 
                                            top: "0.25rem", 
                                            width: "7px", 
                                            height: "7px", 
                                            borderRadius: "50%", 
                                            backgroundColor: isOvertime ? "#f97316" : isComment ? "var(--secondary-color)" : "#10b981",
                                            boxShadow: "0 0 0 3px var(--card-bg)"
                                          }} />
                                          
                                          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                            <span style={{ fontWeight: "700", color: "var(--heading-color)" }}>{act.action}</span>
                                            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                                              {timeStr} {isOvertime && <span style={{ color: "#f97316", fontWeight: "bold" }}>(Lembur)</span>}
                                            </span>
                                          </div>
                                          
                                          {act.ticketId && (
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                                              Tiket: <Link href={`/tickets/${act.ticketId}`} target="_blank" style={{ color: "var(--secondary-color)", textDecoration: "none", fontWeight: "600" }}>[{act.ticketTrackingId}]</Link> - {act.ticketTitle}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

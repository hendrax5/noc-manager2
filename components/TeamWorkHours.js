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
    <div className="ui-static-92254f43e7" style={{display: "flex", flexDirection: "column"}}>
      
      {/* Date & Department Filters */}
      <div className="card ui-static-6e298e325f" style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap"}}>
        <div className="ui-static-92254f43e7" style={{display: "flex", alignItems: "center", flexWrap: "wrap"}}>
          
          <div className="ui-static-30f523173e" style={{display: "flex", alignItems: "center"}}>
            <label className="ui-static-fcde453bb3" >Tanggal:</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="ui-static-419193b796"
            />
          </div>

          <div className="ui-static-30f523173e" style={{display: "flex", alignItems: "center"}}>
            <label className="ui-static-fcde453bb3" >Departemen:</label>
            <select 
              value={selectedDept} 
              onChange={(e) => setSelectedDept(e.target.value)}
              className="ui-static-419193b796" style={{minWidth: "150px"}}
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
          className="logout-btn ui-static-d2ab73263b"
          style={{height: "36px"}}
        >
          Reset Filter
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="ui-static-af81cc4264" style={{display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", flexDirection: "column"}}>
          <div className="ui-static-be074adbd1" style={{width: "35px", height: "35px", animation: "spin 1s linear infinite"}}></div>
          <span className="ui-static-9d7e95f546" >Memproses lini masa aktivitas tim...</span>
        </div>
      )}

      {error && (
        <div className="card ui-static-91b770bb63" >
          Terjadi kesalahan: {error}
        </div>
      )}

      {/* Stats Cards */}
      {!loading && !error && data && (
        <>
          <div className="sky-view-grid">
            <div className="kpi-card">
              <div className="kpi-icon ui-static-6b3235db06" ></div>
              <div className="kpi-content">
                <span className="kpi-value">{teamStats.avgEfficiency}%</span>
                <span className="kpi-label">Efisiensi Rata-rata Tim</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon ui-static-7c914a6a61" ></div>
              <div className="kpi-content">
                <span className="kpi-value">{teamStats.activeCount} <span className="ui-static-90d3402874" >/ {data.users.length}</span></span>
                <span className="kpi-label">Operator Aktif Hari Ini</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon ui-static-6b3235db06" ></div>
              <div className="kpi-content">
                <span className="kpi-value">{formatDuration(teamStats.totalEffectiveHours)}</span>
                <span className="kpi-label">Total Jam Kerja Efektif</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon ui-static-b0deb02a07" ></div>
              <div className="kpi-content">
                <span className="kpi-value">{teamStats.overtimeCases}</span>
                <span className="kpi-label">Staf Mengambil Lembur</span>
              </div>
            </div>
          </div>

          {/* Timeline Table Grid */}
          <div className="card ui-static-77923e1f2b" style={{overflowX: "auto"}}>
            <h3 className="ui-static-18be4c6b3d" >
              Visualisasi Lini Masa Waktu Bekerja Tim
            </h3>

            {data.users.length === 0 ? (
              <div className="ui-static-bee680cf02" style={{textAlign: "center"}}>
                Tidak ada data tim ditemukan untuk tanggal/filter departemen ini.
              </div>
            ) : (
              <div style={{ minWidth: "800px" }}>
                
                {/* Timeline Axis Ticks Ruler */}
                <div className="ui-static-7b301f66c7" style={{display: "grid", gridTemplateColumns: "240px 1fr"}}>
                  <div></div> {/* Empty for alignment with avatar column */}
                  <div className="ui-static-31df06b618" style={{position: "relative", height: "20px"}}>
                    {timelineTicks.map(tick => (
                      <span 
                        key={tick.label} 
                        className="ui-static-a6c74a3341" style={{position: "absolute", left: `${tick.pct}%`, transform: "translateX(-50%)"}}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Team Rows */}
                <div className="ui-static-af81cc4264" style={{display: "flex", flexDirection: "column"}}>
                  {data.users.map(u => {
                    const startMs = new Date(data.globalRange.start).getTime();
                    const endMs = new Date(data.globalRange.end).getTime();
                    const globalDurationMs = endMs - startMs;
                    
                    const isExpanded = expandedUser === u.user.id;

                    return (
                      <div key={u.user.id} className="ui-static-1e82d9362c" >
                        
                        {/* User Row Header and Timeline Bar */}
                        <div className="ui-static-92254f43e7" style={{display: "grid", gridTemplateColumns: "240px 1fr", alignItems: "center"}}>
                          
                          {/* Left Column: User details */}
                          <div 
                            onClick={() => toggleExpandUser(u.user.id)}
                            className="ui-static-e59a73fd03" style={{display: "flex", alignItems: "center", cursor: "pointer"}}
                          >
                            <div className="podium-avatar ui-static-d929e0b517" style={{background: u.stats.efficiencyRate >= 60 ? "#10b981" : u.stats.efficiencyRate >= 30 ? "#f59e0b" : "#ef4444", width: "36px", height: "36px", flexShrink: 0}}>
                              {u.user.avatarUrl ? (
                                <img src={u.user.avatarUrl} alt="Avatar" className="ui-static-30e89704d0" style={{width: "100%", height: "100%", objectFit: "cover"}} />
                              ) : (
                                getInitials(u.user.name)
                              )}
                            </div>
                            <div style={{ overflow: "hidden" }}>
                              <div className="ui-static-e82100d373" style={{whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}} title={u.user.name}>
                                {u.user.name}
                              </div>
                              <div className="ui-static-edd773fc7f" style={{display: "flex", alignItems: "center"}}>
                                <span>{u.user.department}</span>
                                <span>•</span>
                                <span className="ui-static-78d7af8b7e" >{u.stats.efficiencyRate}% Efisien</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Visual timeline bar */}
                          <div className="ui-static-0f8796a915" style={{display: "flex", flexDirection: "column"}}>
                            
                            {/* Shift window limits labels */}
                            <div className="ui-static-3fb49e1cf0" style={{display: "flex", justifyContent: "space-between"}}>
                              <span>
                                Shift: {u.shift.name} ({u.shift.startTime} - {u.shift.endTime})
                                {u.shift.onCall && ` • On-call ${u.shift.onCall.startTime} - ${u.shift.onCall.endTime}`}
                                {u.shift.workMode === "wfh" && (
                                  <span className="ui-static-e6e8123f1c" >WFH</span>
                                )}
                              </span>
                              <span className="ui-static-30f523173e" style={{display: "flex"}}>
                                {u.stats.onCallHours > 0 && (
                                  <span className="ui-static-b674ec9d7d" > On-call: {formatDuration(u.stats.onCallHours)}</span>
                                )}
                                {u.stats.overtimeHours > 0 && (
                                  <span className="ui-static-1b3b267cb2" > Lembur: {formatDuration(u.stats.overtimeHours)}</span>
                                )}
                              </span>
                            </div>

                            {/* Timeline Bar */}
                            <div className="ui-static-54076a6659" style={{display: "flex", height: "28px", width: "100%", overflow: "hidden", position: "relative"}}>
                              {u.segments.map((seg, idx) => {
                                const segStartMs = new Date(seg.start).getTime();
                                const segEndMs = new Date(seg.end).getTime();
                                const segDurationMs = segEndMs - segStartMs;
                                const widthPct = (segDurationMs / globalDurationMs) * 100;
                                const leftPct = ((segStartMs - startMs) / globalDurationMs) * 100;

                                // Resolve styling based on type
                                let bg = "transparent";
                                let title = "";
                                if (seg.type === "active") {
                                  bg = "linear-gradient(135deg, #10b981, #059669)";
                                  title = `Kerja Efektif: ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)}), Aktivitas: ${seg.activityCount}`;
                                } else if (seg.type === "overtime") {
                                  bg = "linear-gradient(135deg, #f97316, #ea580c)";
                                  title = `Lembur/Ekstra: ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)}), Aktivitas: ${seg.activityCount}`;
                                } else if (seg.type === "oncall") {
                                  bg = "linear-gradient(135deg, #8b5cf6, #6d28d9)";
                                  title = `On-call (WFH): ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)}), Aktivitas: ${seg.activityCount}`;
                                } else if (seg.type === "idle") {
                                  bg = "rgba(148, 163, 184, 0.15)";
                                  title = `Waktu Kosong: ${new Date(seg.start).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} - ${new Date(seg.end).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} (${formatDuration(seg.durationMins / 60)})`;
                                }

                                return (
                                  <div 
                                    key={idx} 
                                    title={title}
                                    className="ui-static-00d3d47706" style={{position: "absolute", top: 0, left: `${leftPct}%`, width: `${widthPct}%`, background: bg, height: "100%", cursor: "help", display: "flex", alignItems: "center", justifyContent: "center", transition: "filter 0.1s"}}
                                    onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                                    onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                                  >
                                    {(seg.type === "active" || seg.type === "overtime" || seg.type === "oncall") && seg.durationMins >= 30 && (
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
                          <div className="ui-static-9857071992" style={{display: "grid", gridTemplateColumns: "1fr 1.5fr", animation: "fadeIn 0.2s ease-out"}}>
                            
                            {/* Summary Statistics & Loyalty Analysis */}
                            <div className="ui-static-af81cc4264" style={{display: "flex", flexDirection: "column"}}>
                              {/* Statistics Card */}
                              <div className="card ui-static-f4e990dd94" style={{display: "flex", flexDirection: "column"}}>
                                <h4 className="ui-static-d27798b3be" >Statistik Harian: {u.user.name}</h4>
                                
                                <div className="ui-static-90022612d6" style={{display: "flex", flexDirection: "column"}}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="ui-static-b9010af219" >Durasi Shift:</span>
                                    <span className="ui-static-832fde8c1f" >{formatDuration(u.stats.shiftHours)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="ui-static-98076d77c2" >Kerja Efektif Shift:</span>
                                    <span className="ui-static-832fde8c1f" >{formatDuration(u.stats.activeHours)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="ui-static-d00d74db66" >Kerja Lembur:</span>
                                    <span className="ui-static-832fde8c1f" >{formatDuration(u.stats.overtimeHours)}</span>
                                  </div>
                                  {u.shift.onCall && (
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span className="ui-static-6f1a5c2e7a" >Kerja On-call (WFH):</span>
                                      <span className="ui-static-832fde8c1f" >{formatDuration(u.stats.onCallHours || 0)}</span>
                                    </div>
                                  )}
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span className="ui-static-b9010af219" >Waktu Kosong (Shift):</span>
                                    <span className="ui-static-832fde8c1f" >{formatDuration(u.stats.idleHours)}</span>
                                  </div>
                                  <div className="ui-static-0664cbeecc" style={{display: "flex", justifyContent: "space-between"}}>
                                    <span className="ui-static-8356576a3b" >Rasio Efisiensi Shift:</span>
                                    <span className="ui-static-78d7af8b7e" style={{color: u.stats.efficiencyRate >= 60 ? "#10b981" : u.stats.efficiencyRate >= 30 ? "#f59e0b" : "#ef4444"}}>
                                      {u.stats.efficiencyRate}%
                                    </span>
                                  </div>
                                </div>

                                {/* Progress bar representing shift efficiency */}
                                <div className="ttr-bar-container ui-static-8351b97388" >
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
                                <div className="card ui-static-f64eae4332" style={{display: "flex", flexDirection: "column", background: u.diligence.score >= 75 ? "rgba(16, 185, 129, 0.04)" : u.diligence.score >= 50 ? "rgba(59, 130, 246, 0.04)" : u.diligence.score >= 25 ? "var(--hover-bg)" : "rgba(239, 68, 68, 0.04)", borderLeft: `4px solid ${u.diligence.score >= 75 ? "#10b981" : u.diligence.score >= 50 ? "#3b82f6" : u.diligence.score >= 25 ? "#64748b" : "#ef4444"}`}}>
                                  <h4 className="ui-static-2d58ea64ff" style={{display: "flex", alignItems: "center"}}>
                                     Analisis Kualitas Kerja & Loyalitas
                                  </h4>
                                  
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span className="ui-static-7e5eaaca0d" style={{color: u.diligence.score >= 75 ? "#10b981" : u.diligence.score >= 50 ? "#3b82f6" : u.diligence.score >= 25 ? "var(--heading-color)" : "#ef4444"}}>
                                      {u.diligence.level}
                                    </span>
                                    <span className="ui-static-aa1bd4b4bf" >
                                      Indeks: {u.diligence.score}/100
                                    </span>
                                  </div>

                                  <p className="ui-static-3f677735b2" >
                                    {u.diligence.feedbackText}
                                  </p>

                                  {u.diligence.keywordsDetected.length > 0 && (
                                    <div className="ui-static-950dea6c48" style={{display: "flex", flexWrap: "wrap"}}>
                                      {u.diligence.keywordsDetected.map(kw => (
                                        <span key={kw} className="ui-static-ab271ad4d4" >
                                          #{kw}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Activities Log Timeline */}
                            <div className="card ui-static-e418acdc7c" style={{overflow: "hidden", display: "flex", flexDirection: "column"}}>
                              <h4 className="ui-static-d27798b3be" >Rincian Aktivitas Tiket</h4>
                              
                              <div className="ui-static-73db728ca8" style={{overflowY: "auto", maxHeight: "250px", display: "flex", flexDirection: "column"}}>
                                {u.activities.length === 0 ? (
                                  <div className="ui-static-c8e85162f1" style={{textAlign: "center"}}>
                                    Tidak ada aktivitas tiket yang tercatat hari ini.
                                  </div>
                                ) : (
                                  <div className="ui-static-c5899cfb2e" style={{display: "flex", flexDirection: "column"}}>
                                    {u.activities.map(act => {
                                      const timeStr = new Date(act.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                      const isComment = act.action?.includes("Reply") || act.id?.startsWith("comment");
                                      const isOvertime = new Date(act.timestamp) < new Date(u.shift.start) || new Date(act.timestamp) > new Date(u.shift.end);

                                      return (
                                        <div key={act.id} className="ui-static-fc155e091a" style={{position: "relative"}}>
                                          {/* Circle timeline dot */}
                                          <div className="ui-static-489db56d2d" style={{position: "absolute", left: "-1.35rem", top: "0.25rem", width: "7px", height: "7px", backgroundColor: isOvertime ? "#f97316" : isComment ? "var(--secondary-color)" : "#10b981"}} />
                                          
                                          <div className="ui-static-30f523173e" style={{display: "flex", justifyContent: "space-between", flexWrap: "wrap"}}>
                                            <span className="ui-static-b8f3c0ff5c" >{act.action}</span>
                                            <span className="ui-static-3fb49e1cf0" >
                                              {timeStr} {isOvertime && <span className="ui-static-1b3b267cb2" >(Lembur)</span>}
                                            </span>
                                          </div>
                                          
                                          {act.ticketId && (
                                            <div className="ui-static-0cb42f860f" >
                                              Tiket: <Link href={`/tickets/${act.ticketId}`} target="_blank" className="ui-static-1f56a9dcfa" style={{textDecoration: "none"}}>[{act.ticketTrackingId}]</Link> - {act.ticketTitle}
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

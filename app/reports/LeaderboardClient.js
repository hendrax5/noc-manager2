"use client";
import { useState, useEffect } from "react";
import LeaderboardFilter from "@/components/LeaderboardFilter";
import PerformanceDrawer from "@/components/PerformanceDrawer";
import ComparisonModal from "@/components/ComparisonModal";

export default function LeaderboardClient({
  initialCsLeaderboard = [],
  initialTechLeaderboard = [],
  globalCategoryTtr = [],
  departments = [],
  startDate = "",
  endDate = "",
  helicopterStats = {}
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");

  const [compareMode, setCompareMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const [drawerUserId, setDrawerUserId] = useState(null);

  const [csPage, setCsPage] = useState(1);
  const [techPage, setTechPage] = useState(1);

  const pageSize = 5;

  // Filter lists based on search name and department select
  const filteredCs = initialCsLeaderboard.filter(u => {
    const matchesName = u.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = department ? u.department === department : true;
    return matchesName && matchesDept;
  });

  const filteredTech = initialTechLeaderboard.filter(u => {
    const matchesName = u.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = department ? u.department === department : true;
    return matchesName && matchesDept;
  });

  // Extract Top 3 for Podium
  const csPodium = filteredCs.slice(0, 3);
  const csTableList = filteredCs.slice(3);

  const techPodium = filteredTech.slice(0, 3);
  const techTableList = filteredTech.slice(3);

  // Paginated lists for tables
  const paginatedCsTable = csTableList.slice((csPage - 1) * pageSize, csPage * pageSize);
  const paginatedTechTable = techTableList.slice((techPage - 1) * pageSize, techPage * pageSize);

  const totalCsPages = Math.ceil(csTableList.length / pageSize);
  const totalTechPages = Math.ceil(techTableList.length / pageSize);

  // Reset pagination pages when filters change
  useEffect(() => {
    setCsPage(1);
    setTechPage(1);
  }, [search, department]);

  const handleSelectUserForCompare = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      if (selectedUsers.length >= 4) {
        alert("Anda hanya dapat membandingkan maksimal 4 orang sekaligus.");
        return;
      }
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleStartCompare = () => {
    if (selectedUsers.length < 2) {
      alert("Pilih minimal 2 orang untuk dibandingkan.");
      return;
    }
    setIsComparisonOpen(true);
  };

  const formatMins = (mins) => {
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Reusable podium renderer
  const renderPodium = (podiumList, isCSLeaderboard) => {
    if (podiumList.length === 0) return null;
    
    // Sort podium specifically to order: 2nd, 1st, 3rd for correct layout display
    const orderedPodium = [];
    if (podiumList[1]) orderedPodium.push({ ...podiumList[1], position: "second", badge: "🥈" });
    if (podiumList[0]) orderedPodium.push({ ...podiumList[0], position: "first", badge: "👑" });
    if (podiumList[2]) orderedPodium.push({ ...podiumList[2], position: "third", badge: "🥉" });

    return (
      <div className="podium-container">
        {orderedPodium.map((user) => (
          <div key={user.id} className={`podium-card ${user.position}`}>
            <span className="podium-badge">{user.badge}</span>
            
            {compareMode && (
              <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                <input 
                  type="checkbox" 
                  className="compare-checkbox"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => handleSelectUserForCompare(user.id)}
                />
              </div>
            )}

            <div className="podium-avatar">
              {getInitials(user.name)}
            </div>
            
            <a 
              onClick={() => !compareMode && setDrawerUserId(user.id)}
              className="podium-name"
              style={{ pointerEvents: compareMode ? "none" : "auto" }}
            >
              {user.name}
            </a>
            <div className="podium-dept">{user.department}</div>
            
            <div className="podium-points">
              {isCSLeaderboard ? user.csEngagementScore : user.taskPoints}
              <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: "0.2rem" }}>pts</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="container">
      <header className="page-header" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "800", color: "var(--heading-color)", margin: "0 0 0.35rem 0" }}>
          📊 Performance Leaderboard & Report Analytics
        </h1>
        <p style={{ color: "#64748b", margin: 0 }}>
          Helicopter view pemantauan aktivitas, kecepatan penyelesaian (TTR), dan skor performa operator.
        </p>
      </header>

      {/* Leaderboard Filters Component */}
      <LeaderboardFilter 
        departments={departments}
        initialSearch={search}
        initialDepartment={department}
        onSearchChange={setSearch}
        onDepartmentChange={setDepartment}
      />

      {/* Helicopter View Dashboard */}
      <section style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--heading-color)", margin: 0 }}>
            🛸 Helicopter View: Ringkasan Performa Tim
          </h2>
          {startDate || endDate ? (
            <span style={{ fontSize: "0.8rem", color: "#64748b", background: "var(--border-color)", padding: "0.25rem 0.6rem", borderRadius: "12px" }}>
              Filter: {startDate || "Awal"} s/d {endDate || "Sekarang"}
            </span>
          ) : null}
        </div>

        <div className="helicopter-grid">
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#dcfce7", color: "#15803d" }}>✔️</div>
            <div className="kpi-content">
              <span className="kpi-value">{helicopterStats.resolvedCount}</span>
              <span className="kpi-label">Tiket Resolved</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>⚡</div>
            <div className="kpi-content">
              <span className="kpi-value">{formatMins(helicopterStats.avgTtrMins)}</span>
              <span className="kpi-label">Rata-rata TTR Global</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>👥</div>
            <div className="kpi-content">
              <span className="kpi-value">{helicopterStats.activeOperators}</span>
              <span className="kpi-label">Operator Aktif</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#f3e8ff", color: "#6b21a8" }}>🏆</div>
            <div className="kpi-content">
              <span className="kpi-value" style={{ fontSize: "1.1rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "150px" }} title={helicopterStats.leadingDept}>
                {helicopterStats.leadingDept}
              </span>
              <span className="kpi-label">Departemen Unggul</span>
            </div>
          </div>
        </div>

        {/* Global Average TTR by Category breakdown */}
        <div className="card" style={{ margin: 0, padding: "1.25rem" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: "700", color: "var(--heading-color)" }}>
            Breakdown Waktu Resolusi (TTR) Rata-rata per Kategori Tiket
          </h3>
          {globalCategoryTtr.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>Tidak ada data resolusi tiket kategori.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {globalCategoryTtr.map(cat => {
                const isSlow = cat.avgMins > 120;
                const isMedium = cat.avgMins > 60 && cat.avgMins <= 120;
                const barColor = isSlow ? "#ef4444" : isMedium ? "#f59e0b" : "#10b981";
                const maxVal = 240; // Reference for 100% width (4 hours)
                const pct = Math.min(100, (cat.avgMins / maxVal) * 100);

                return (
                  <div key={cat.name} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", padding: "0.75rem", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--heading-color)" }}>{cat.name}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: "700", color: barColor }}>{formatMins(cat.avgMins)}</span>
                    </div>
                    <div className="ttr-bar-container" style={{ margin: "0.25rem 0 0 0" }}>
                      <div className="ttr-bar" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "right" }}>Jumlah tiket: {cat.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Comparison Mode Float Bar / Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          {compareMode ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "var(--secondary-color)", background: "rgba(59, 130, 246, 0.1)", padding: "0.4rem 0.8rem", borderRadius: "6px" }}>
                Mode Bandingkan Aktif: Pilih 2-4 orang
              </span>
              <button 
                onClick={handleStartCompare} 
                className="primary-btn" 
                style={{ width: "auto", padding: "0.45rem 1.25rem", fontSize: "0.85rem", background: "#10b981" }}
                disabled={selectedUsers.length < 2}
              >
                Bandingkan Sekarang ({selectedUsers.length})
              </button>
              <button 
                onClick={() => { setCompareMode(false); setSelectedUsers([]); }}
                className="logout-btn" 
                style={{ margin: 0, padding: "0.4rem 1rem", fontSize: "0.85rem", height: "36px" }}
              >
                Batal
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setCompareMode(true)}
              className="primary-btn"
              style={{ width: "auto", padding: "0.5rem 1.5rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span>📊</span> Aktifkan Mode Perbandingan
            </button>
          )}
        </div>
      </div>

      {/* Two Columns Grid for Tables & Podiums */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        
        {/* CS Engagement Column */}
        <div>
          <h2 style={{ fontSize: "1.25rem", color: "var(--heading-color)", marginBottom: "0.75rem", borderBottom: "2px solid #3b82f6", paddingBottom: "0.35rem" }}>
            💬 CS Engagement
          </h2>
          
          {/* Render top 3 CS Podium */}
          {renderPodium(csPodium, true)}

          {/* Render rest CS operators */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr style={{ background: "var(--table-header-bg)" }}>
                  {compareMode && <th style={{ width: "40px", textAlign: "center" }}>Pilih</th>}
                  <th style={{ width: "60px", textAlign: "center" }}>Rank</th>
                  <th>Operator</th>
                  <th style={{ textAlign: "center" }}>Tickets</th>
                  <th style={{ textAlign: "center" }}>Msgs</th>
                  <th style={{ textAlign: "right" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredCs.length === 0 ? (
                  <tr>
                    <td colSpan={compareMode ? "6" : "5"} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                      Tidak ada operator CS ditemukan.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Render table list */}
                    {csTableList.length === 0 && filteredCs.length <= 3 && (
                      <tr>
                        <td colSpan={compareMode ? "6" : "5"} style={{ textAlign: "center", padding: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
                          Semua peringkat teratas sudah ditampilkan pada podium di atas.
                        </td>
                      </tr>
                    )}
                    {paginatedCsTable.map((l, index) => {
                      const rank = 4 + (csPage - 1) * pageSize + index;
                      return (
                        <tr key={l.id}>
                          {compareMode && (
                            <td style={{ textAlign: "center" }}>
                              <input 
                                type="checkbox" 
                                className="compare-checkbox"
                                checked={selectedUsers.includes(l.id)}
                                onChange={() => handleSelectUserForCompare(l.id)}
                              />
                            </td>
                          )}
                          <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "0.9rem", color: "#64748b" }}>
                            #{rank}
                          </td>
                          <td style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                            <a 
                              onClick={() => !compareMode && setDrawerUserId(l.id)} 
                              style={{ color: "var(--primary-color)", textDecoration: "none", cursor: compareMode ? "default" : "pointer" }}
                            >
                              {l.name}
                            </a>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: "500", color: "#64748b" }}>{l.createdCount}</td>
                          <td style={{ textAlign: "center", fontWeight: "500", color: "#64748b" }}>{l.replyCount}</td>
                          <td style={{ textAlign: "right", fontWeight: "800", color: "#3b82f6", fontSize: "0.95rem" }}>{l.csEngagementScore}</td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>

            {/* Pagination for CS Table */}
            {totalCsPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderTop: "1px solid var(--border-color)", background: "var(--card-bg)" }}>
                <button 
                  onClick={() => setCsPage(prev => Math.max(1, prev - 1))}
                  disabled={csPage === 1}
                  style={{ padding: "0.35rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", cursor: csPage === 1 ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: csPage === 1 ? 0.5 : 1 }}
                >
                  Sebelumnya
                </button>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Halaman {csPage} dari {totalCsPages}</span>
                <button 
                  onClick={() => setCsPage(prev => Math.min(totalCsPages, prev + 1))}
                  disabled={csPage === totalCsPages}
                  style={{ padding: "0.35rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", cursor: csPage === totalCsPages ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: csPage === totalCsPages ? 0.5 : 1 }}
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Technical Resolves Column */}
        <div>
          <h2 style={{ fontSize: "1.25rem", color: "var(--heading-color)", marginBottom: "0.75rem", borderBottom: "2px solid #10b981", paddingBottom: "0.35rem" }}>
            🔧 Tech Resolves
          </h2>
          
          {/* Render top 3 Tech Podium */}
          {renderPodium(techPodium, false)}

          {/* Render rest Tech operators */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr style={{ background: "var(--table-header-bg)" }}>
                  {compareMode && <th style={{ width: "40px", textAlign: "center" }}>Pilih</th>}
                  <th style={{ width: "60px", textAlign: "center" }}>Rank</th>
                  <th>Technician</th>
                  <th style={{ textAlign: "right" }}>Solved</th>
                  <th style={{ textAlign: "right" }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {filteredTech.length === 0 ? (
                  <tr>
                    <td colSpan={compareMode ? "5" : "4"} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                      Tidak ada teknisi ditemukan.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Render table list */}
                    {techTableList.length === 0 && filteredTech.length <= 3 && (
                      <tr>
                        <td colSpan={compareMode ? "5" : "4"} style={{ textAlign: "center", padding: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
                          Semua peringkat teratas sudah ditampilkan pada podium di atas.
                        </td>
                      </tr>
                    )}
                    {paginatedTechTable.map((l, index) => {
                      const rank = 4 + (techPage - 1) * pageSize + index;
                      return (
                        <tr key={l.id}>
                          {compareMode && (
                            <td style={{ textAlign: "center" }}>
                              <input 
                                type="checkbox" 
                                className="compare-checkbox"
                                checked={selectedUsers.includes(l.id)}
                                onChange={() => handleSelectUserForCompare(l.id)}
                              />
                            </td>
                          )}
                          <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "0.9rem", color: "#64748b" }}>
                            #{rank}
                          </td>
                          <td style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                            <a 
                              onClick={() => !compareMode && setDrawerUserId(l.id)} 
                              style={{ color: "var(--primary-color)", textDecoration: "none", cursor: compareMode ? "default" : "pointer" }}
                            >
                              {l.name}
                            </a>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "normal" }}>{l.department}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "500", color: "#64748b" }}>{l.resolvedCount}</td>
                          <td style={{ textAlign: "right", fontWeight: "800", color: "#10b981", fontSize: "0.95rem" }}>{l.taskPoints}</td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>

            {/* Pagination for Tech Table */}
            {totalTechPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderTop: "1px solid var(--border-color)", background: "var(--card-bg)" }}>
                <button 
                  onClick={() => setTechPage(prev => Math.max(1, prev - 1))}
                  disabled={techPage === 1}
                  style={{ padding: "0.35rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", cursor: techPage === 1 ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: techPage === 1 ? 0.5 : 1 }}
                >
                  Sebelumnya
                </button>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Halaman {techPage} dari {totalTechPages}</span>
                <button 
                  onClick={() => setTechPage(prev => Math.min(totalTechPages, prev + 1))}
                  disabled={techPage === totalTechPages}
                  style={{ padding: "0.35rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", cursor: techPage === totalTechPages ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: techPage === totalTechPages ? 0.5 : 1 }}
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Performance sliding drawer */}
      <PerformanceDrawer 
        userId={drawerUserId}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setDrawerUserId(null)}
      />

      {/* Performance comparison side-by-side modal */}
      {isComparisonOpen && (
        <ComparisonModal 
          selectedUserIds={selectedUsers}
          startDate={startDate}
          endDate={endDate}
          onClose={() => { setIsComparisonOpen(false); setSelectedUsers([]); setCompareMode(false); }}
        />
      )}
    </main>
  );
}

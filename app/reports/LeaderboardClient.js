"use client";
import { useState, useEffect } from "react";
import LeaderboardFilter from "@/components/LeaderboardFilter";
import PerformanceDrawer from "@/components/PerformanceDrawer";
import ComparisonModal from "@/components/ComparisonModal";
import TeamWorkHours from "@/components/TeamWorkHours";

export default function LeaderboardClient({
  initialCsLeaderboard = [],
  initialTechLeaderboard = [],
  globalCategoryTtr = [],
  departments = [],
  startDate = "",
  endDate = "",
  skyViewStats = {},
  isAdmin = false
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");

  const [compareMode, setCompareMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const [drawerUserId, setDrawerUserId] = useState(null);

  const [csPage, setCsPage] = useState(1);
  const [techPage, setTechPage] = useState(1);
  const [activeTab, setActiveTab] = useState("leaderboard");

  const pageSize = 10;

  const filteredCs = initialCsLeaderboard.filter((u) => {
    const matchesName = u.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = department ? u.department === department : true;
    return matchesName && matchesDept;
  });

  const filteredTech = initialTechLeaderboard.filter((u) => {
    const matchesName = u.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = department ? u.department === department : true;
    return matchesName && matchesDept;
  });

  const paginatedCs = filteredCs.slice((csPage - 1) * pageSize, csPage * pageSize);
  const paginatedTech = filteredTech.slice((techPage - 1) * pageSize, techPage * pageSize);
  const totalCsPages = Math.ceil(filteredCs.length / pageSize);
  const totalTechPages = Math.ceil(filteredTech.length / pageSize);

  useEffect(() => {
    setCsPage(1);
    setTechPage(1);
  }, [search, department]);

  const periodQuery = (() => {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    const q = params.toString();
    return q ? `?${q}` : "";
  })();

  const personHref = (id) => `/reports/${id}${periodQuery}`;

  const periodLabel = startDate || endDate
    ? `${startDate || "Awal"} – ${endDate || "Sekarang"}`
    : "Semua waktu";

  const handleSelectUserForCompare = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
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

  const openPerson = (userId) => {
    if (compareMode) return;
    setDrawerUserId(userId);
  };

  const renderTable = ({ rows, page, totalPages, setPage, emptyLabel, columns }) => (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            {compareMode && <th style={{ width: 44, textAlign: "center" }}>Pilih</th>}
            <th style={{ width: 52 }}>#</th>
            <th>Nama</th>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align || "right" }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={(compareMode ? 3 : 2) + columns.length} className="report-empty-cell">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((l, index) => {
              const rank = (page - 1) * pageSize + index + 1;
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
                  <td className="kpi-value" style={{ color: "var(--muted-text)", fontWeight: rank <= 3 ? 700 : 500 }}>
                    {rank}
                  </td>
                  <td>
                    {compareMode ? (
                      <span style={{ fontWeight: 600, color: "var(--heading-color)" }}>{l.name}</span>
                    ) : (
                      <button type="button" className="report-name-btn" onClick={() => openPerson(l.id)}>
                        {l.name}
                      </button>
                    )}
                    <div style={{ fontSize: "0.8rem", color: "var(--muted-text)" }}>{l.department}</div>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="kpi-value" style={{ textAlign: col.align || "right" }}>
                      {col.value(l)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="report-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Sebelumnya
          </button>
          <span>Halaman {page} dari {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );

  return (
    <main className="container">
      <header className="page-header" style={{ marginBottom: "1.25rem" }}>
        <h1>Performance</h1>
        <p style={{ color: "var(--muted-text)", margin: 0 }}>
          Skor operator dan waktu resolusi. Periode: {periodLabel}.
        </p>
      </header>

      <div className="report-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "leaderboard"}
          className={activeTab === "leaderboard" ? "is-active" : ""}
          onClick={() => setActiveTab("leaderboard")}
        >
          Leaderboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "workhours"}
          className={activeTab === "workhours" ? "is-active" : ""}
          onClick={() => setActiveTab("workhours")}
        >
          Waktu kerja
        </button>
      </div>

      {activeTab === "workhours" ? (
        <TeamWorkHours departments={departments} isAdmin={isAdmin} />
      ) : (
        <>
          <LeaderboardFilter
            departments={departments}
            initialSearch={search}
            initialDepartment={department}
            onSearchChange={setSearch}
            onDepartmentChange={setDepartment}
          />

          {isAdmin && (
            <section style={{ marginBottom: "1.75rem" }}>
              <h2 className="report-section-title">Ringkasan tim</h2>
              <div className="report-stat-row">
                <div>
                  <span>Tiket resolved</span>
                  <strong className="kpi-value">{skyViewStats.resolvedCount ?? 0}</strong>
                </div>
                <div>
                  <span>Rata-rata TTR</span>
                  <strong className="kpi-value">{formatMins(skyViewStats.avgTtrMins || 0)}</strong>
                </div>
                <div>
                  <span>Operator aktif</span>
                  <strong className="kpi-value">{skyViewStats.activeOperators ?? 0}</strong>
                </div>
                <div>
                  <span>Departemen teratas</span>
                  <strong title={skyViewStats.leadingDept}>{skyViewStats.leadingDept || "—"}</strong>
                </div>
              </div>

              <div className="card" style={{ marginTop: "1rem" }}>
                <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 600, color: "var(--heading-color)" }}>
                  TTR rata-rata per kategori
                </h3>
                {globalCategoryTtr.length === 0 ? (
                  <p className="report-empty" style={{ padding: "0.5rem 0" }}>Tidak ada data resolusi pada periode ini.</p>
                ) : (
                  <ul className="report-ttr-list">
                    {globalCategoryTtr.map((cat) => {
                      const pct = Math.min(100, (cat.avgMins / 240) * 100);
                      return (
                        <li key={cat.name}>
                          <div className="report-ttr-meta">
                            <span>{cat.name}</span>
                            <span className="kpi-value">
                              {formatMins(cat.avgMins)} <small>({cat.count})</small>
                            </span>
                          </div>
                          <div className="ttr-bar-container">
                            <div className="ttr-bar" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}

          <div className="report-toolbar">
            {compareMode ? (
              <div className="report-compare-active">
                <span>Pilih 2–4 orang</span>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ width: "auto", padding: "0.45rem 1rem", minHeight: 36, fontSize: "0.85rem" }}
                  onClick={handleStartCompare}
                  disabled={selectedUsers.length < 2}
                >
                  Bandingkan ({selectedUsers.length})
                </button>
                <button
                  type="button"
                  className="logout-btn"
                  style={{ margin: 0, padding: "0.4rem 0.9rem", height: 36, fontSize: "0.85rem" }}
                  onClick={() => { setCompareMode(false); setSelectedUsers([]); }}
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="logout-btn"
                style={{ margin: 0, padding: "0.45rem 1rem", height: 36, fontSize: "0.85rem" }}
                onClick={() => setCompareMode(true)}
              >
                Bandingkan orang
              </button>
            )}
          </div>

          <div className="report-split">
            <div>
              <h2 className="report-section-title">CS engagement</h2>
              {renderTable({
                rows: paginatedCs,
                page: csPage,
                totalPages: totalCsPages,
                setPage: setCsPage,
                emptyLabel: "Tidak ada operator CS pada filter ini.",
                columns: [
                  { key: "tickets", label: "Tiket", value: (l) => l.createdCount },
                  { key: "msgs", label: "Balasan", value: (l) => l.replyCount },
                  { key: "score", label: "Skor", value: (l) => l.csEngagementScore }
                ]
              })}
            </div>
            <div>
              <h2 className="report-section-title">Tech resolves</h2>
              {renderTable({
                rows: paginatedTech,
                page: techPage,
                totalPages: totalTechPages,
                setPage: setTechPage,
                emptyLabel: "Tidak ada teknisi pada filter ini.",
                columns: [
                  { key: "solved", label: "Selesai", value: (l) => l.resolvedCount },
                  { key: "pts", label: "Poin", value: (l) => l.taskPoints }
                ]
              })}
            </div>
          </div>
        </>
      )}

      <PerformanceDrawer
        userId={drawerUserId}
        startDate={startDate}
        endDate={endDate}
        reportHref={drawerUserId ? personHref(drawerUserId) : ""}
        onClose={() => setDrawerUserId(null)}
      />

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

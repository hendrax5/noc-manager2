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
    <div className="card ui-static-bcb0a0d8bd" style={{overflow: "hidden"}}>
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
                  <td className="kpi-value ui-static-a64efbfeda" style={{fontWeight: rank <= 3 ? 700 : 500}}>
                    {rank}
                  </td>
                  <td>
                    {compareMode ? (
                      <span className="ui-static-832fde8c1f" >{l.name}</span>
                    ) : (
                      <button type="button" className="report-name-btn" onClick={() => openPerson(l.id)}>
                        {l.name}
                      </button>
                    )}
                    <div className="ui-static-2188c20d97" >{l.department}</div>
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
      <header className="page-header ui-static-f23443a9ea" >
        <h1>Performance</h1>
        <p className="ui-static-054e197f0f" >
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
            <section className="ui-static-8bd9dc7312" >
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

              <div className="card ui-static-14b98d08ef" >
                <h3 className="ui-static-e5f2db7c32" >
                  TTR rata-rata per kategori
                </h3>
                {globalCategoryTtr.length === 0 ? (
                  <p className="report-empty ui-static-fd5975142e" >Tidak ada data resolusi pada periode ini.</p>
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
                  className="primary-btn ui-static-7f44db8657"
                  style={{width: "auto", minHeight: 36}}
                  onClick={handleStartCompare}
                  disabled={selectedUsers.length < 2}
                >
                  Bandingkan ({selectedUsers.length})
                </button>
                <button
                  type="button"
                  className="logout-btn ui-static-f163cd8592"
                  style={{height: 36}}
                  onClick={() => { setCompareMode(false); setSelectedUsers([]); }}
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="secondary-btn"
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

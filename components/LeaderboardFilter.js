"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LeaderboardFilter({ 
  departments = [], 
  onSearchChange, 
  onDepartmentChange,
  initialSearch = "",
  initialDepartment = ""
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [dateRange, setDateRange] = useState({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || ""
  });

  const [search, setSearch] = useState(initialSearch);
  const [selectedDept, setSelectedDept] = useState(initialDepartment);

  // Sync internal search and department states with props
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setSelectedDept(initialDepartment);
  }, [initialDepartment]);

  const handleApplyDates = (start, end) => {
    const params = new URLSearchParams(window.location.search);
    if (start) params.set("start", start);
    else params.delete("start");
    
    if (end) params.set("end", end);
    else params.delete("end");

    // Keep page 1 when dates change
    params.delete("page");

    router.push(`/reports?${params.toString()}`);
  };

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    handleApplyDates(dateRange.start, dateRange.end);
  };

  const setPreset = (presetType) => {
    const today = new Date();
    let start = "";
    let end = "";

    const formatDate = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    switch (presetType) {
      case "today":
        start = formatDate(today);
        end = formatDate(today);
        break;
      case "week": {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(today.setDate(diff));
        start = formatDate(monday);
        end = formatDate(new Date());
        break;
      }
      case "month": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        start = formatDate(firstDay);
        end = formatDate(new Date());
        break;
      }
      case "30days": {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        start = formatDate(thirtyDaysAgo);
        end = formatDate(new Date());
        break;
      }
      case "all":
      default:
        start = "";
        end = "";
        break;
    }

    setDateRange({ start, end });
    handleApplyDates(start, end);
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    if (onSearchChange) onSearchChange(val);
  };

  const handleDeptChange = (val) => {
    setSelectedDept(val);
    if (onDepartmentChange) onDepartmentChange(val);
  };

  const clearAllFilters = () => {
    setSearch("");
    setSelectedDept("");
    setDateRange({ start: "", end: "" });
    if (onSearchChange) onSearchChange("");
    if (onDepartmentChange) onDepartmentChange("");
    router.push("/reports");
  };

  return (
    <div className="card no-print" style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", padding: "1.25rem" }}>
      {/* Row 1: Search & Department Filter */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 250px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.4rem", color: "#64748b" }}>Cari Operator / Teknisi</label>
          <input 
            type="text" 
            placeholder="Ketik nama untuk mencari..." 
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ 
              width: "100%",
              padding: "0.6rem 0.8rem", 
              borderRadius: "6px", 
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--input-text)"
            }}
          />
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.4rem", color: "#64748b" }}>Departemen</label>
          <select 
            value={selectedDept}
            onChange={(e) => handleDeptChange(e.target.value)}
            style={{ 
              width: "100%",
              padding: "0.6rem 0.8rem", 
              borderRadius: "6px", 
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--input-text)"
            }}
          >
            <option value="">Semua Departemen</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.name}>{dept.name}</option>
            ))}
          </select>
        </div>

        {(search || selectedDept || dateRange.start || dateRange.end) && (
          <button 
            onClick={clearAllFilters}
            className="logout-btn"
            style={{ 
              padding: "0.6rem 1rem", 
              margin: 0,
              height: "40px",
              borderColor: "#ef4444",
              color: "#ef4444",
              background: "transparent",
              fontWeight: "600",
              fontSize: "0.85rem"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Reset Filter
          </button>
        )}
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: 0 }} />

      {/* Row 2: Date Filters & Presets */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        
        {/* Presets */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>Rentang Waktu Cepat</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button 
              onClick={() => setPreset("today")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                border: "1px solid var(--border-color)",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: searchParams.get("start") === formatDateForPreset(new Date()) ? "var(--secondary-color)" : "var(--card-bg)",
                color: searchParams.get("start") === formatDateForPreset(new Date()) ? "white" : "var(--text-color)",
                fontWeight: "500"
              }}
            >
              Hari Ini
            </button>
            <button 
              onClick={() => setPreset("week")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                border: "1px solid var(--border-color)",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: (searchParams.get("start") && searchParams.get("start") !== formatDateForPreset(new Date()) && searchParams.get("start") !== getMonthStartPreset()) ? "var(--secondary-color)" : "var(--card-bg)",
                color: (searchParams.get("start") && searchParams.get("start") !== formatDateForPreset(new Date()) && searchParams.get("start") !== getMonthStartPreset()) ? "white" : "var(--text-color)",
                fontWeight: "500"
              }}
            >
              Minggu Ini
            </button>
            <button 
              onClick={() => setPreset("month")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                border: "1px solid var(--border-color)",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: searchParams.get("start") === getMonthStartPreset() ? "var(--secondary-color)" : "var(--card-bg)",
                color: searchParams.get("start") === getMonthStartPreset() ? "white" : "var(--text-color)",
                fontWeight: "500"
              }}
            >
              Bulan Ini
            </button>
            <button 
              onClick={() => setPreset("30days")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                border: "1px solid var(--border-color)",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: "var(--card-bg)",
                color: "var(--text-color)",
                fontWeight: "500"
              }}
            >
              30 Hari Terakhir
            </button>
            <button 
              onClick={() => setPreset("all")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                border: "1px solid var(--border-color)",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: !searchParams.get("start") ? "var(--secondary-color)" : "var(--card-bg)",
                color: !searchParams.get("start") ? "white" : "var(--text-color)",
                fontWeight: "500"
              }}
            >
              Semua Waktu
            </button>
          </div>
        </div>

        {/* Custom Date Form */}
        <form onSubmit={handleCustomDateSubmit} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem", color: "#64748b" }}>Mulai</label>
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})} 
              style={{ padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--input-bg)", color: "var(--input-text)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem", color: "#64748b" }}>Sampai</label>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})} 
              style={{ padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--input-bg)", color: "var(--input-text)" }}
            />
          </div>
          <button 
            type="submit" 
            className="primary-btn" 
            style={{ 
              padding: "0.5rem 1rem", 
              width: "auto", 
              height: "36px", 
              fontSize: "0.85rem",
              background: "var(--secondary-color)",
              display: "flex",
              alignItems: "center"
            }}
          >
            Terapkan Tanggal
          </button>
        </form>
      </div>
    </div>
  );
}

// Helper functions for preset state check
function formatDateForPreset(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthStartPreset() {
  const d = new Date();
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return formatDateForPreset(firstDay);
}

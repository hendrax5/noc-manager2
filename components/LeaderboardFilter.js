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
    <div className="card no-print ui-static-d2904cf742" style={{display: "flex", flexDirection: "column"}}>
      {/* Row 1: Search & Department Filter */}
      <div className="ui-static-af81cc4264" style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end"}}>
        <div style={{ flex: "1 1 250px" }}>
          <label className="ui-static-702bf4227e" style={{display: "block"}}>Cari Operator / Teknisi</label>
          <input 
            type="text" 
            placeholder="Ketik nama untuk mencari..." 
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="ui-static-f699dddc93" style={{width: "100%"}}
          />
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label className="ui-static-702bf4227e" style={{display: "block"}}>Departemen</label>
          <select 
            value={selectedDept}
            onChange={(e) => handleDeptChange(e.target.value)}
            className="ui-static-f699dddc93" style={{width: "100%"}}
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
            className="logout-btn ui-static-18204160ee"
            style={{height: "40px"}}
            onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Reset Filter
          </button>
        )}
      </div>

      <hr className="ui-static-e58a035eaf"  />

      {/* Row 2: Date Filters & Presets */}
      <div className="ui-static-af81cc4264" style={{display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap"}}>
        
        {/* Presets */}
        <div className="ui-static-30f523173e" style={{display: "flex", flexDirection: "column"}}>
          <span className="ui-static-fcde453bb3" >Rentang Waktu Cepat</span>
          <div className="ui-static-30f523173e" style={{display: "flex", flexWrap: "wrap"}}>
            <button 
              onClick={() => setPreset("today")}
              className="ui-static-01bf21d4c0" style={{cursor: "pointer", background: searchParams.get("start") === formatDateForPreset(new Date()) ? "var(--secondary-color)" : "var(--card-bg)", color: searchParams.get("start") === formatDateForPreset(new Date()) ? "white" : "var(--text-color)"}}
            >
              Hari Ini
            </button>
            <button 
              onClick={() => setPreset("week")}
              className="ui-static-01bf21d4c0" style={{cursor: "pointer", background: (searchParams.get("start") && searchParams.get("start") !== formatDateForPreset(new Date()) && searchParams.get("start") !== getMonthStartPreset()) ? "var(--secondary-color)" : "var(--card-bg)", color: (searchParams.get("start") && searchParams.get("start") !== formatDateForPreset(new Date()) && searchParams.get("start") !== getMonthStartPreset()) ? "white" : "var(--text-color)"}}
            >
              Minggu Ini
            </button>
            <button 
              onClick={() => setPreset("month")}
              className="ui-static-01bf21d4c0" style={{cursor: "pointer", background: searchParams.get("start") === getMonthStartPreset() ? "var(--secondary-color)" : "var(--card-bg)", color: searchParams.get("start") === getMonthStartPreset() ? "white" : "var(--text-color)"}}
            >
              Bulan Ini
            </button>
            <button 
              onClick={() => setPreset("30days")}
              className="ui-static-e28f409028" style={{cursor: "pointer"}}
            >
              30 Hari Terakhir
            </button>
            <button 
              onClick={() => setPreset("all")}
              className="ui-static-01bf21d4c0" style={{cursor: "pointer", background: !searchParams.get("start") ? "var(--secondary-color)" : "var(--card-bg)", color: !searchParams.get("start") ? "white" : "var(--text-color)"}}
            >
              Semua Waktu
            </button>
          </div>
        </div>

        {/* Custom Date Form */}
        <form onSubmit={handleCustomDateSubmit} className="ui-static-e59a73fd03" style={{display: "flex", alignItems: "flex-end", flexWrap: "wrap"}}>
          <div>
            <label className="ui-static-d3cc39924a" style={{display: "block"}}>Mulai</label>
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})} 
              className="ui-static-e61ca57d3a"
            />
          </div>
          <div>
            <label className="ui-static-d3cc39924a" style={{display: "block"}}>Sampai</label>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})} 
              className="ui-static-e61ca57d3a"
            />
          </div>
          <button 
            type="submit" 
            className="primary-btn ui-static-72f9169d7e"
            style={{width: "auto", height: "36px", display: "flex", alignItems: "center"}}
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

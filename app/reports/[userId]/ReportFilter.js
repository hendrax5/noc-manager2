"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekStart() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return formatDate(new Date(today.getFullYear(), today.getMonth(), diff));
}

function monthStart() {
  const d = new Date();
  return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function ReportFilter({ userId }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [dateRange, setDateRange] = useState({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || ""
  });

  const applyDates = (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const q = params.toString();
    router.push(`/reports/${userId}${q ? `?${q}` : ""}`);
  };

  const handleApply = (e) => {
    e.preventDefault();
    applyDates(dateRange.start, dateRange.end);
  };

  const setPreset = (type) => {
    const today = new Date();
    let start = "";
    let end = formatDate(today);

    if (type === "week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      start = formatDate(new Date(today.getFullYear(), today.getMonth(), diff));
    } else if (type === "month") {
      start = monthStart();
    } else if (type === "all") {
      start = "";
      end = "";
    }

    setDateRange({ start, end });
    applyDates(start, end);
  };

  const currentStart = searchParams.get("start") || "";
  const isMonth = currentStart === monthStart();
  const isWeek = currentStart === weekStart();
  const isAll = !currentStart;

  return (
    <div className="card no-print report-filter">
      <div className="report-filter-presets">
        <button type="button" className={isMonth ? "is-active" : ""} onClick={() => setPreset("month")}>
          Bulan ini
        </button>
        <button type="button" className={isWeek ? "is-active" : ""} onClick={() => setPreset("week")}>
          Minggu ini
        </button>
        <button type="button" className={isAll ? "is-active" : ""} onClick={() => setPreset("all")}>
          Semua waktu
        </button>
      </div>

      <form onSubmit={handleApply} className="report-filter-form">
        <label>
          Dari
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </label>
        <label>
          Sampai
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </label>
        <button type="submit" className="primary-btn" style={{ width: "auto", padding: "0.5rem 1rem", minHeight: 40 }}>
          Terapkan
        </button>
        <button type="button" className="logout-btn" style={{ margin: 0, padding: "0.5rem 1rem", height: 40 }} onClick={() => window.print()}>
          Cetak
        </button>
      </form>
    </div>
  );
}

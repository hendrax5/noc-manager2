"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ReportFilter({ userId }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [dateRange, setDateRange] = useState({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || ""
  });

  const handleApply = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (dateRange.start) params.set("start", dateRange.start);
    if (dateRange.end) params.set("end", dateRange.end);
    router.push(`/reports/${userId}?${params.toString()}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="card no-print" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
      <form onSubmit={handleApply} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem", color: "#64748b" }}>Date From</label>
          <input 
            type="date" 
            value={dateRange.start} 
            onChange={e => setDateRange({...dateRange, start: e.target.value})} 
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem", color: "#64748b" }}>Date To</label>
          <input 
            type="date" 
            value={dateRange.end} 
            onChange={e => setDateRange({...dateRange, end: e.target.value})} 
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="submit" className="primary-btn" style={{ padding: "0.5rem 1rem", width: "auto" }}>Apply Filter</button>
      </form>

      <button onClick={handlePrint} className="primary-btn" style={{ padding: "0.5rem 1.5rem", width: "auto", background: "#10b981", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
        </svg>
        Export PDF
      </button>
    </div>
  );
}

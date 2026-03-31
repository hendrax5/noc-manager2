"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LeaderboardFilter({ initialSearch, initialRange, departments, initialDept }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(initialSearch || "");
  const [range, setRange] = useState(initialRange || "all");
  const [dept, setDept] = useState(initialDept || "all");
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (searchTerm) params.set("q", searchTerm);
      else params.delete("q");
      
      if (range && range !== 'all') params.set("range", range);
      else params.delete("range");
      
      if (dept && dept !== 'all') params.set("dept", dept);
      else params.delete("dept");

      // Reset page when filtering
      params.set("page", "1");
      
      router.push(`/reports?${params.toString()}`);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm, range, dept, router, searchParams]);
  
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
      
      <div style={{ flex: '1 1 300px' }}>
        <input 
          type="text" 
          placeholder="🔎 Search Leaderboard by Operator Name..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', fontSize: '0.9rem' }}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>🗓️ Timeframe:</label>
        <select 
          value={range} 
          onChange={(e) => setRange(e.target.value)}
          style={{ padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          <option value="all">All Time</option>
          <option value="daily">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>🏢 Dept:</label>
        <select 
          value={dept} 
          onChange={(e) => setDept(e.target.value)}
          style={{ padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          <option value="all">All Departments</option>
          {departments?.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      
    </div>
  );
}

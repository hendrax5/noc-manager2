"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SearchInput({ defaultQuery }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const [q, setQ] = useState(defaultQuery || "");

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (currentTab) params.set('tab', currentTab);
    router.push(`/tickets?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <input 
        type="text" 
        placeholder="🔍  Search by Tracking ID (e.g., HSK-...) or Ticket Subject" 
        value={q} 
        onChange={e => setQ(e.target.value)}
        style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '400px', fontSize: '0.95rem' }}
      />
      <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>Search Tickets</button>
      {q && (
        <button 
          type="button" 
          onClick={() => { 
            setQ(''); 
            const params = new URLSearchParams();
            if (currentTab) params.set('tab', currentTab);
            router.push(`/tickets?${params.toString()}`); 
          }} 
          style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.75rem 1.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Clear
        </button>
      )}
    </form>
  )
}

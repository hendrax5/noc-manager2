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
    <form onSubmit={handleSearch} className="ui-static-93bb8864d9" style={{display: 'flex'}}>
      <input 
        type="text" 
        placeholder="🔍  Search by Tracking ID (e.g., HSK-...) or Ticket Subject" 
        value={q} 
        onChange={e => setQ(e.target.value)}
        className="ui-static-691aae7aa0" style={{width: '100%', maxWidth: '400px'}}
      />
      <button type="submit" className="primary-btn ui-static-4577864700" style={{width: 'auto'}}>Search Tickets</button>
      {q && (
        <button 
          type="button" 
          onClick={() => { 
            setQ(''); 
            const params = new URLSearchParams();
            if (currentTab) params.set('tab', currentTab);
            router.push(`/tickets?${params.toString()}`); 
          }} 
          className="ui-static-0fea4c91dd" style={{cursor: 'pointer'}}
        >
          Clear
        </button>
      )}
    </form>
  )
}

"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function TicketAdvancedFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || "");
  const [statuses, setStatuses] = useState(searchParams.get('statuses') ? searchParams.get('statuses').split(',') : ['New', 'Open', 'Waiting Reply', 'Replied', 'In Progress', 'On Hold']); // default
  const [assignment, setAssignment] = useState(searchParams.get('assignment') || "all"); // me, others, unassigned, all
  const [allDepts, setAllDepts] = useState(searchParams.get('all_depts') === 'true'); // Show all departments toggle

  const ALL_STATUSES = ['New', 'Open', 'Waiting Reply', 'Replied', 'In Progress', 'On Hold', 'Resolved', 'Closed'];

  const toggleStatus = (st) => {
    if (statuses.includes(st)) {
      setStatuses(statuses.filter(s => s !== st));
    } else {
      setStatuses([...statuses, st]);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statuses.length > 0) params.set('statuses', statuses.join(','));
    if (assignment !== 'all') params.set('assignment', assignment);
    if (allDepts) params.set('all_depts', 'true');
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    
    // Maintain page logic if possible or reset to 1
    router.push(`/tickets?${params.toString()}`);
  };

  const clearAll = () => {
    setQ("");
    setStatuses(['New', 'Open', 'Waiting Reply', 'Replied', 'In Progress', 'On Hold']);
    setAssignment('all');
    setAllDepts(false);
    
    // Keep the limit if active
    const params = new URLSearchParams();
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    
    router.push(params.toString() ? `/tickets?${params.toString()}` : `/tickets`);
  };

  return (
    <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '1.5rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '1.5rem' }}>
        
        {/* Status Filter */}
        <div>
          <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Show tickets with status:</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {ALL_STATUSES.map(st => (
              <label key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input 
                  type="checkbox" 
                  checked={statuses.includes(st)} 
                  onChange={() => toggleStatus(st)}
                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: statuses.includes(st) ? 'bold' : 'normal', color: st === 'Resolved' || st === 'Closed' ? '#10b981' : (st === 'New' ? '#ef4444' : '#f59e0b') }}>
                  {st}
                </span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setStatuses(ALL_STATUSES)} style={{ fontSize: '0.8rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Select All</button>
            <button type="button" onClick={() => setStatuses([])} style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear All</button>
          </div>
        </div>

        {/* Assignment Filter */}
        <div>
           <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Assignment:</h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="radio" name="assignment" checked={assignment === 'all'} onChange={() => setAssignment('all')} />
                Any
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="radio" name="assignment" checked={assignment === 'me'} onChange={() => setAssignment('me')} />
                Assigned to me
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="radio" name="assignment" checked={assignment === 'unassigned'} onChange={() => setAssignment('unassigned')} />
                Unassigned
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="radio" name="assignment" checked={assignment === 'others'} onChange={() => setAssignment('others')} />
                Assigned to others
              </label>
           </div>
        </div>

        {/* Visibility Filter */}
        <div>
           <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Department Visibility:</h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="radio" name="visibility" checked={!allDepts} onChange={() => setAllDepts(false)} />
                My Department Only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="radio" name="visibility" checked={allDepts} onChange={() => setAllDepts(true)} />
                Show All Departments
              </label>
           </div>
        </div>

      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Find a ticket:</h4>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search by Tracking ID (e.g., HSK-...), Subject, or Name..." 
            value={q} 
            onChange={e => setQ(e.target.value)}
            style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '500px', fontSize: '0.95rem' }}
          />
          <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.75rem 2rem' }}>Apply Filters / Search</button>
          
          <button 
             type="button" 
             onClick={clearAll} 
             style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.75rem 1.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
             Reset
          </button>
        </form>
      </div>
    </div>
  );
}

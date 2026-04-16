"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function TicketAdvancedFilter({ categories = [], companies = ["ION", "SDC", "Sistercompany"], initialCompanyParam = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || "");
  const [categoryId, setCategoryId] = useState(searchParams.get('category') || "");
  const [statuses, setStatuses] = useState(searchParams.get('statuses') ? searchParams.get('statuses').split(',') : ['New', 'Open', 'Reopen', 'Pending', 'Finish']); // default
  const [assignments, setAssignments] = useState(searchParams.get('assignments') ? searchParams.get('assignments').split(',') : ['me', 'unassigned', 'others']); // me, others, unassigned
  const [allDepts, setAllDepts] = useState(searchParams.get('all_depts') === 'true'); // Show all departments toggle
  const [companyParam, setCompanyParam] = useState(searchParams.get('company') !== null ? searchParams.get('company') : initialCompanyParam); // Company Routing Filter

  const ALL_STATUSES = ['New', 'Open', 'Reopen', 'Pending', 'Finish', 'Resolved'];

  const toggleAssignment = (val) => {
    setAssignments(prev => 
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };

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
    if (assignments.length > 0 && assignments.length < 3) params.set('assignments', assignments.join(','));
    if (allDepts) params.set('all_depts', 'true');
    if (companyParam) params.set('company', companyParam);
    if (categoryId) params.set('category', categoryId);
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
    // Maintain page logic if possible or reset to 1
    router.push(`/tickets?${params.toString()}`);
  };

  const handleCompanyChange = (val) => {
    setCompanyParam(val);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statuses.length > 0) params.set('statuses', statuses.join(','));
    if (assignments.length > 0 && assignments.length < 3) params.set('assignments', assignments.join(','));
    if (allDepts) params.set('all_depts', 'true');
    if (val) params.set('company', val);
    if (categoryId) params.set('category', categoryId);
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
    router.push(`/tickets?${params.toString()}`);
  };

  const clearAll = () => {
    setQ("");
    setStatuses(['New', 'Open', 'Reopen', 'Pending', 'Finish']);
    setAssignments(['me', 'unassigned']);
    setAllDepts(false);
    setCompanyParam("");
    setCategoryId("");
    
    // Keep the limit and tab if active
    const params = new URLSearchParams();
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
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
                <input type="checkbox" checked={assignments.includes('me')} onChange={() => toggleAssignment('me')} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#3b82f6' }} />
                Assigned to me
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="checkbox" checked={assignments.includes('unassigned')} onChange={() => toggleAssignment('unassigned')} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#3b82f6' }} />
                Unassigned in queue
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input type="checkbox" checked={assignments.includes('others')} onChange={() => toggleAssignment('others')} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#3b82f6' }} />
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

        {/* Company Identity Filter */}
        <div>
           <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Company Routing:</h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select 
                value={companyParam} 
                onChange={(e) => handleCompanyChange(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#334155', outline: 'none' }}
              >
                <option value="">-- All Companies --</option>
                {companies.map((c, i) => <option key={`filter-${i}`} value={c}>{c}</option>)}
              </select>
           </div>
        </div>

        {/* Category Filter */}
        <div>
           <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Job Category:</h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select 
                value={categoryId} 
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#334155', outline: 'none' }}
              >
                <option value="">-- All Categories --</option>
                {categories?.map(c => <option key={`cat-${c.id}`} value={c.id}>{c.name}</option>)}
              </select>
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

"use client";
import { WORK_TYPES, WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { TICKET_STATUSES, DEFAULT_FILTER_STATUSES } from "@/lib/tickets/status";

export default function TicketAdvancedFilter({ companies = ["ION", "SDC", "Sistercompany"], initialCompanyParam = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || "");
  const [statuses, setStatuses] = useState(searchParams.get('statuses') ? searchParams.get('statuses').split(',') : [...DEFAULT_FILTER_STATUSES]);
  const [assignments, setAssignments] = useState(searchParams.get('assignments') ? searchParams.get('assignments').split(',') : ['me', 'unassigned', 'others']);
  const [allDepts, setAllDepts] = useState(searchParams.get('all_depts') === 'true');
  const [companyParam, setCompanyParam] = useState(searchParams.get('company') !== null ? searchParams.get('company') : initialCompanyParam);
  const [jobCategoryParam, setJobCategoryParam] = useState(searchParams.get('jobCategory') || "");
  const [workType, setWorkType] = useState(searchParams.get("workType") || "");
  const [jobCategories, setJobCategories] = useState([]);

  const ALL_STATUSES = [...TICKET_STATUSES];

  // Fetch job categories on mount
  useEffect(() => {
    fetch('/api/settings/job-categories')
      .then(r => r.ok ? r.json() : [])
      .then(data => setJobCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Sync state with URL search params when they change client-side
  useEffect(() => {
    setWorkType(searchParams.get("workType") || "");
    setQ(searchParams.get('q') || "");
    setStatuses(searchParams.get('statuses') ? searchParams.get('statuses').split(',') : [...DEFAULT_FILTER_STATUSES]);
    setAssignments(searchParams.get('assignments') ? searchParams.get('assignments').split(',') : ['me', 'unassigned', 'others']);
    setAllDepts(searchParams.get('all_depts') === 'true');
    setCompanyParam(searchParams.get('company') !== null ? searchParams.get('company') : initialCompanyParam);
    setJobCategoryParam(searchParams.get('jobCategory') || "");
  }, [searchParams, initialCompanyParam]);

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
    if (workType) params.set('workType', workType);
    if (searchParams.get('serviceWorkTypeId')) params.set('serviceWorkTypeId', searchParams.get('serviceWorkTypeId'));
    if (searchParams.get('date')) params.set('date', searchParams.get('date'));
    if (q) params.set('q', q);
    if (statuses.length > 0) params.set('statuses', statuses.join(','));
    if (assignments.length > 0 && assignments.length < 3) params.set('assignments', assignments.join(','));
    if (allDepts) params.set('all_depts', 'true');
    if (companyParam) params.set('company', companyParam);
    if (jobCategoryParam) params.set('jobCategory', jobCategoryParam);
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
    // Maintain page logic if possible or reset to 1
    router.push(`/tickets?${params.toString()}`);
  };

  const handleCompanyChange = (val) => {
    setCompanyParam(val);
    const params = new URLSearchParams();
    if (workType) params.set('workType', workType);
    if (searchParams.get('date')) params.set('date', searchParams.get('date'));
    if (q) params.set('q', q);
    if (statuses.length > 0) params.set('statuses', statuses.join(','));
    if (assignments.length > 0 && assignments.length < 3) params.set('assignments', assignments.join(','));
    if (allDepts) params.set('all_depts', 'true');
    if (val) params.set('company', val);
    if (jobCategoryParam) params.set('jobCategory', jobCategoryParam);
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
    router.push(`/tickets?${params.toString()}`);
  };

  const handleJobCategoryChange = (val) => {
    setJobCategoryParam(val);
    const params = new URLSearchParams();
    if (workType) params.set('workType', workType);
    if (searchParams.get('date')) params.set('date', searchParams.get('date'));
    if (q) params.set('q', q);
    if (statuses.length > 0) params.set('statuses', statuses.join(','));
    if (assignments.length > 0 && assignments.length < 3) params.set('assignments', assignments.join(','));
    if (allDepts) params.set('all_depts', 'true');
    if (companyParam) params.set('company', companyParam);
    if (val) params.set('jobCategory', val);
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
    router.push(`/tickets?${params.toString()}`);
  };

  const clearAll = () => {
    setWorkType("");
    setQ("");
    setStatuses([...DEFAULT_FILTER_STATUSES]);
    setAssignments(['me', 'unassigned']);
    setAllDepts(false);
    setCompanyParam("");
    setJobCategoryParam("");
    
    // Keep the limit and tab if active
    const params = new URLSearchParams();
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit'));
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab'));
    
    router.push(params.toString() ? `/tickets?${params.toString()}` : `/tickets`);
  };

  return (
    <div className="ui-static-9636402e6b" >
      
      <div className="ui-static-e2a2ec95b6" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
        
        <div>
          <label htmlFor="ticket-work-type">Klasifikasi pekerjaan</label>
          <select id="ticket-work-type" value={workType} onChange={e => setWorkType(e.target.value)} className="ui-static-ce5f724e09" style={{width: '100%'}}>
            <option value="">Semua</option>
            {WORK_TYPES.map(value => <option key={value} value={value}>{WORK_TYPE_LABELS[value]}</option>)}
          </select>
        </div>
        {/* Status Filter */}
        <div>
          <h4 className="ui-static-95873f622d" >Show tickets with status:</h4>
          <div className="ui-static-30f523173e" style={{display: 'grid', gridTemplateColumns: '1fr 1fr'}}>
            {ALL_STATUSES.map(st => (
              <label key={st} className="ui-static-9c57d61e16" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input 
                  type="checkbox" 
                  checked={statuses.includes(st)} 
                  onChange={() => toggleStatus(st)}
                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: statuses.includes(st) ? 'bold' : 'normal', color: st === 'Resolved' || st === 'Closed' ? "var(--ui-success)" : (st === 'New' ? "var(--ui-danger)" : "var(--ui-warning)") }}>
                  {st}
                </span>
              </label>
            ))}
          </div>
          <div className="ui-static-6d6be9d056" style={{display: 'flex'}}>
            <button type="button" onClick={() => setStatuses(ALL_STATUSES)} className="ui-static-e611f886f0" style={{cursor: 'pointer', textDecoration: 'underline'}}>Select All</button>
            <button type="button" onClick={() => setStatuses([])} className="ui-static-e611f886f0" style={{cursor: 'pointer', textDecoration: 'underline'}}>Clear All</button>
          </div>
        </div>

        {/* Assignment Filter */}
        <div>
           <h4 className="ui-static-95873f622d" >Assignment:</h4>
           <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column'}}>
              <label className="ui-static-9c57d61e16" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input type="checkbox" checked={assignments.includes('me')} onChange={() => toggleAssignment('me')} style={{ width: '1.2rem', height: '1.2rem', accentColor: "var(--ui-info)" }} />
                Assigned to me
              </label>
              <label className="ui-static-9c57d61e16" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input type="checkbox" checked={assignments.includes('unassigned')} onChange={() => toggleAssignment('unassigned')} style={{ width: '1.2rem', height: '1.2rem', accentColor: "var(--ui-info)" }} />
                Unassigned in queue
              </label>
              <label className="ui-static-9c57d61e16" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input type="checkbox" checked={assignments.includes('others')} onChange={() => toggleAssignment('others')} style={{ width: '1.2rem', height: '1.2rem', accentColor: "var(--ui-info)" }} />
                Assigned to others
              </label>
           </div>
        </div>

        {/* Visibility Filter */}
        <div>
           <h4 className="ui-static-95873f622d" >Department Visibility:</h4>
           <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column'}}>
              <label className="ui-static-9c57d61e16" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input type="radio" name="visibility" checked={!allDepts} onChange={() => setAllDepts(false)} />
                My Department Only
              </label>
              <label className="ui-static-9c57d61e16" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input type="radio" name="visibility" checked={allDepts} onChange={() => setAllDepts(true)} />
                Show All Departments
              </label>
           </div>
        </div>

        {/* Company Identity Filter */}
        <div>
           <h4 className="ui-static-95873f622d" >Company Routing:</h4>
           <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column'}}>
              <select 
                value={companyParam} 
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="ui-static-884e42a85b" style={{width: '100%', outline: 'none'}}
              >
                <option value="">-- All Companies --</option>
                {companies.map((c, i) => <option key={`filter-${i}`} value={c}>{c}</option>)}
              </select>
           </div>
        </div>

        {/* Job Category Filter */}
        <div>
           <h4 className="ui-static-95873f622d" >Job Category:</h4>
           <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column'}}>
              <select 
                value={jobCategoryParam} 
                onChange={(e) => handleJobCategoryChange(e.target.value)}
                className="ui-static-884e42a85b" style={{width: '100%', outline: 'none'}}
              >
                <option value="">-- All Categories --</option>
                {jobCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
           </div>
        </div>

      </div>

      <div className="ui-static-a6cdd4c86a" >
        <h4 className="ui-static-95873f622d" >Find a ticket:</h4>
        <form onSubmit={handleSearch} className="ui-static-e59a73fd03" style={{display: 'flex', alignItems: 'center'}}>
          <input 
            type="text" 
            placeholder="Search by Tracking ID, Subject, Name, SAP, or CID..."
            value={q} 
            onChange={e => setQ(e.target.value)}
            className="ui-static-691aae7aa0" style={{width: '100%', maxWidth: '500px'}}
          />
          <button type="submit" className="primary-btn ui-static-6ed4299010" style={{width: 'auto'}}>Apply Filters / Search</button>
          
          <button 
             type="button" 
             onClick={clearAll} 
             className="ui-static-0fea4c91dd" style={{cursor: 'pointer'}}
          >
             Reset
          </button>
        </form>
      </div>
    </div>
  );
}

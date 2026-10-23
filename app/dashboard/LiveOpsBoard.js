"use client";
import { useState, useEffect, useCallback } from "react";
import { STATUS_COLORS as CANONICAL_STATUS_COLORS, TICKET_STATUSES, normalizeStatus } from "@/lib/tickets/status";

const STATUS_COLORS = {
  ...CANONICAL_STATUS_COLORS,
  'Waiting Reply': CANONICAL_STATUS_COLORS.Pending,
  'Replied': CANONICAL_STATUS_COLORS.Open,
};

const CATEGORY_COLORS = {
  'Installasi': '#3b82f6',
  'Trouble Ticket': '#ef4444',
  'BOD': '#8b5cf6',
  'Trial': '#10b981',
  'Upgrade': '#f59e0b',
  'Downgrade': '#f97316',
  'Relokasi': '#06b6d4',
  'Dismantle': '#64748b',
};

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDuration(start, end) {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = endTime - startTime;
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
}

function getDurationMs(t) {
  const hasDt = t.customData && typeof t.customData === "object" && t.customData.hasDowntime;
  const start = hasDt && t.customData.startDowntime
    ? t.customData.startDowntime
    : (t.customData?.reopenedAt || t.createdAt);
  const end = hasDt && t.customData.startDowntime
    ? (t.customData.endDowntime || null)
    : (t.resolvedAt && t.status === "Resolved" ? t.resolvedAt : null);
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.max(0, endTime - startTime);
}

export default function LiveOpsBoard({ initialData = [], jobCategories = [], defaultScope = "all", workType = "" }) {
  const [tickets, setTickets] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [inlineNoteId, setInlineNoteId] = useState(null);
  const [inlineNoteText, setInlineNoteText] = useState('');
  const [inlineNoteLoading, setInlineNoteLoading] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [showResolved, setShowResolved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date', dateRange);
      params.set('scope', defaultScope);
      if (workType) params.set('workType', workType);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/dashboard/live-ops?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {}
    setLoading(false);
  }, [dateRange, filterCategory, filterStatus, defaultScope, workType]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // auto-refresh 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    let valA, valB;
    switch (sortField) {
      case 'trackingId': valA = a.trackingId || ''; valB = b.trackingId || ''; break;
      case 'status': valA = a.status; valB = b.status; break;
      case 'category': valA = a.jobCategory?.name || ''; valB = b.jobCategory?.name || ''; break;
      case 'assignee': valA = a.assignee?.name || ''; valB = b.assignee?.name || ''; break;
      case 'updatedAt': valA = new Date(a.updatedAt).getTime(); valB = new Date(b.updatedAt).getTime(); break;
      case 'createdAt': valA = new Date(a.customData?.reopenedAt || a.createdAt).getTime(); valB = new Date(b.customData?.reopenedAt || b.createdAt).getTime(); break;
      case 'duration': valA = getDurationMs(a); valB = getDurationMs(b); break;
      case 'slaBreaches': valA = a.slaBreaches || 0; valB = b.slaBreaches || 0; break;
      default: valA = new Date(a.updatedAt).getTime(); valB = new Date(b.updatedAt).getTime();
    }
    if (typeof valA === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  const filteredTickets = sortedTickets.filter(t => {
    // Hide resolved by default unless showResolved is checked or filterStatus is explicitly set to Resolved
    if (t.status === 'Resolved' && !showResolved && filterStatus !== 'Resolved') {
      return false;
    }

    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const customerName = getCustomerName(t);
    return (
      (t.trackingId || '').toLowerCase().includes(s) ||
      (t.title || '').toLowerCase().includes(s) ||
      (t.assignee?.name || '').toLowerCase().includes(s) ||
      customerName.toLowerCase().includes(s)
    );
  });

  function getCustomerName(t) {
    if (t.services && t.services.length > 0 && t.services[0].customer) {
      return t.services[0].customer.name;
    }
    if (t.customData && typeof t.customData === 'object' && t.customData["Customer Name"]) {
      return t.customData["Customer Name"];
    }
    const match = t.description?.match(/\[Original Reporter: (.*?) -/);
    if (match) return match[1];
    return '-';
  }

  const handleInlineNote = async (ticketId) => {
    if (!inlineNoteText.trim()) return;
    setInlineNoteLoading(true);
    try {
      await fetch(`/api/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inlineNoteText, noteType: 'follow_up' })
      });
      setInlineNoteId(null);
      setInlineNoteText('');
      fetchData(); // refresh
    } catch (err) {}
    setInlineNoteLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Tracking ID', 'Customer', 'Subject', 'Category', 'Status', 'Time Down', 'Duration', 'PIC', 'Last Note', 'SLA Pings'];
    const rows = filteredTickets.map(t => {
      const hasDt = t.customData && typeof t.customData === 'object' && t.customData.hasDowntime;
      const timeDownVal = hasDt && t.customData.startDowntime
        ? new Date(t.customData.startDowntime).toLocaleString('en-CA')
        : new Date(t.customData?.reopenedAt || t.createdAt).toLocaleString('en-CA');
      const durationVal = hasDt && t.customData.startDowntime
        ? getDuration(t.customData.startDowntime, t.customData.endDowntime)
        : getDuration(t.customData?.reopenedAt || t.createdAt, t.resolvedAt);

      return [
        t.trackingId || '',
        getCustomerName(t),
        t.title,
        t.jobCategory?.name || '-',
        t.status,
        timeDownVal,
        durationVal,
        t.assignee?.name || 'Unassigned',
        t.notes?.[0]?.content?.substring(0, 50) || '-',
        t.slaBreaches || 0
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-ops-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      className="ui-static-e17edd45ee" style={{cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'left', textTransform: 'uppercase'}}
    >
      {children} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="ui-static-48c0e01ac7" style={{overflow: 'hidden'}}>
      {/* Header Bar */}
      <div className="ui-static-4c5eed3b4c" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
        <div className="ui-static-e59a73fd03" style={{display: 'flex', alignItems: 'center'}}>
          <h2 className="ui-static-9c15ba00ea" style={{display: 'flex', alignItems: 'center'}}>
            <span className="ui-static-7f8da12489" ></span> Live Operations Board
          </h2>
          {loading && <span className="ui-static-61b6d2c8fb" style={{animation: 'pulse 1.5s infinite'}}>⟳ Updating...</span>}
          <span className="ui-static-6a219f4627" >{filteredTickets.length} tiket</span>
        </div>
        <div className="ui-static-30f523173e" style={{display: 'flex', flexWrap: 'wrap'}}>
          <button onClick={exportCSV} className="ui-static-ec8b0dffc1" style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
             Export CSV
          </button>
          <button onClick={fetchData} className="ui-static-99856dbbc3" style={{cursor: 'pointer'}}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ui-static-208f9b605e" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center'}}>
        <input
          type="text"
          placeholder="🔍 Cari tiket, customer, PIC..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="ui-static-d9806e42a1" style={{minWidth: '200px', flex: '1', maxWidth: '300px'}}
        />
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="ui-static-893b2f04a7" style={{cursor: 'pointer'}}>
          <option value="today"> Hari Ini</option>
          <option value="week"> 7 Hari Terakhir</option>
          <option value="all"> Semua</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="ui-static-893b2f04a7" style={{cursor: 'pointer'}}>
          <option value=""> Semua Kategori</option>
          {jobCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ui-static-893b2f04a7" style={{cursor: 'pointer'}}>
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <label className="ui-static-b4bf3f29ba" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
          <input 
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
          />
          Tampilkan Resolved
        </label>
      </div>

      {/* Table */}
      <div className={`live-ops-body${loading ? " is-refreshing" : ""}`} style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
        <table className="ui-static-581d169cdc" style={{width: '100%'}}>
          <thead className="ui-static-11d9ca5a15" style={{position: 'sticky', top: 0, zIndex: 5}}>
            <tr>
              <SortHeader field="trackingId">ID</SortHeader>
              <th className="ui-static-e17edd45ee" style={{textAlign: 'left', textTransform: 'uppercase'}}>Customer/Site</th>
              <th className="ui-static-e17edd45ee" style={{textAlign: 'left', textTransform: 'uppercase'}}>Subject</th>
              <SortHeader field="category">Category</SortHeader>
              <SortHeader field="status">Status</SortHeader>
              <SortHeader field="createdAt">Time Down</SortHeader>
              <SortHeader field="duration">Duration</SortHeader>
              <SortHeader field="assignee">PIC</SortHeader>
              <th className="ui-static-e17edd45ee" style={{textAlign: 'left', textTransform: 'uppercase'}}>Last Note</th>
              <SortHeader field="slaBreaches">SLA</SortHeader>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length === 0 && (
              <tr><td colSpan="10" className="ui-static-3bdb82cc13" style={{textAlign: 'center', fontStyle: 'italic'}}>Tidak ada tiket yang ditemukan untuk filter ini.</td></tr>
            )}
            {filteredTickets.map(t => {
              const customerName = getCustomerName(t);
              const displayStatus = normalizeStatus(t.status);
              const stColor = STATUS_COLORS[displayStatus] || STATUS_COLORS[t.status] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
              const catColor = CATEGORY_COLORS[t.jobCategory?.name] || '#94a3b8';
              const isOverdue = t.slaBreaches > 0 && t.status !== 'Resolved';
              
              const hasDt = t.customData && typeof t.customData === 'object' && t.customData.hasDowntime;
              const dtStart = hasDt ? t.customData.startDowntime : null;
              const dtEnd = hasDt ? t.customData.endDowntime : null;

              const hoursIdle = (Date.now() - new Date(t.updatedAt).getTime()) / 3600000;
              
              let hoursActive = hoursIdle;
              if (hasDt && dtStart) {
                const startMs = new Date(dtStart).getTime();
                const endMs = dtEnd ? new Date(dtEnd).getTime() : Date.now();
                hoursActive = (endMs - startMs) / 3600000;
              }

              const rowBg = isOverdue ? 'rgba(239, 68, 68, 0.04)' : (t.status === 'New' && hoursIdle > 2 ? 'rgba(245, 158, 11, 0.04)' : 'transparent');
              const durationColor = hoursActive > 4 ? '#ef4444' : (hoursActive > 2 ? '#f59e0b' : 'var(--text-color)');

              return (
                <tr key={t.id} style={{background: rowBg, transition: 'background 0.15s'}} className="hover-bg ui-static-31df06b618">
                  <td className="ui-static-9210427316" style={{whiteSpace: 'nowrap'}}>
                    <a href={`/tickets/${t.id}`} className="ui-static-b9010af219" style={{textDecoration: 'none'}}>{t.trackingId?.substring(0, 12) || `#${t.id}`}</a>
                  </td>
                  <td className="ui-static-457d06ea92" style={{maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {customerName}
                  </td>
                  <td className="ui-static-ff5c5a0df3" style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    <a href={`/tickets/${t.id}`} className="ui-static-bffd53f399" style={{textDecoration: 'none'}}>{t.title}</a>
                  </td>
                  <td className="ui-static-ce5f724e09" >
                    {t.jobCategory ? (
                      <span className="ui-static-5745689772" style={{background: `${catColor}15`, color: catColor, whiteSpace: 'nowrap', border: `1px solid ${catColor}30`}}>
                        {t.jobCategory.name}
                      </span>
                    ) : (
                      <span className="ui-static-4a0a218c1e" style={{fontStyle: 'italic'}}>-</span>
                    )}
                  </td>
                  <td className="ui-static-ce5f724e09" >
                    <span className="ui-static-5745689772" style={{background: stColor.bg, color: stColor.color, whiteSpace: 'nowrap', border: `1px solid ${stColor.border}`}}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="ui-static-7f9453e354" style={{color: hasDt ? '#f59e0b' : 'var(--text-color)', fontWeight: hasDt ? 'bold' : 'normal', whiteSpace: 'nowrap'}}>
                    {mounted ? (
                      hasDt && dtStart ? (
                        <div>
                          <span title={`Downtime Mulai: ${new Date(dtStart).toLocaleString('id-ID')}`}>
                             {new Date(dtStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="ui-static-c424da7186" >
                            Created: {new Date(t.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ({getTimeAgo(t.createdAt)})
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>{new Date(t.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="ui-static-c424da7186" >
                            ({getTimeAgo(t.createdAt)})
                          </div>
                        </div>
                      )
                    ) : '...'}
                  </td>
                  <td className="ui-static-b0de371098" style={{color: durationColor, whiteSpace: 'nowrap'}}>
                    {hasDt && dtStart ? (
                      <div>
                        <div>{getDuration(dtStart, dtEnd)}</div>
                        <div className="ui-static-c424da7186" >
                          Real Age: {getDuration(t.createdAt, t.resolvedAt && t.status === 'Resolved' ? t.resolvedAt : null)}
                        </div>
                        {t.status !== 'Resolved' && (
                          <div className="ui-static-fcc3bd24cb" style={{color: hoursIdle > 2 ? '#ef4444' : '#64748b', fontWeight: hoursIdle > 2 ? 'bold' : 'normal'}}>
                            Idle: {getTimeAgo(t.updatedAt)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div>{getDuration(t.customData?.reopenedAt || t.createdAt, t.resolvedAt && t.status === 'Resolved' ? t.resolvedAt : null)}</div>
                        {t.status !== 'Resolved' && (
                          <div className="ui-static-fcc3bd24cb" style={{color: hoursIdle > 2 ? '#ef4444' : '#64748b', fontWeight: hoursIdle > 2 ? 'bold' : 'normal'}}>
                            Idle: {getTimeAgo(t.updatedAt)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="ui-static-4b7193c251" style={{color: t.assignee ? 'var(--heading-color)' : '#94a3b8', fontWeight: t.assignee ? '600' : 'normal', fontStyle: t.assignee ? 'normal' : 'italic', whiteSpace: 'nowrap'}}>
                    {t.assignee?.name || 'Unassigned'}
                  </td>
                  <td className="ui-static-ce5f724e09" style={{maxWidth: '160px'}}>
                    {inlineNoteId === t.id ? (
                      <div className="ui-static-0f8796a915" style={{display: 'flex'}}>
                        <input
                          type="text"
                          value={inlineNoteText}
                          onChange={e => setInlineNoteText(e.target.value)}
                          placeholder="Quick note..."
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleInlineNote(t.id)}
                          className="ui-static-e2caedb32c" style={{flex: 1, minWidth: '80px'}}
                        />
                        <button onClick={() => handleInlineNote(t.id)} disabled={inlineNoteLoading} className="ui-static-27f9036d0a" style={{cursor: 'pointer'}}>
                          {inlineNoteLoading ? '...' : '✓'}
                        </button>
                        <button onClick={() => { setInlineNoteId(null); setInlineNoteText(''); }} className="ui-static-993e88a533" style={{cursor: 'pointer'}}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="ui-static-0f8796a915" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}} onClick={() => setInlineNoteId(t.id)}>
                        {t.notes && t.notes.length > 0 ? (
                          <span className="ui-static-6d93d6f90d" style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px', display: 'block'}} title={t.notes[0].content}>
                            {t.notes[0].content.substring(0, 40)}{t.notes[0].content.length > 40 ? '...' : ''}
                          </span>
                        ) : (
                          <span className="ui-static-3fb49e1cf0" style={{fontStyle: 'italic'}}>+ add note</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="ui-static-ce5f724e09" style={{textAlign: 'center'}}>
                    {t.slaBreaches > 0 && t.status !== 'Resolved' ? (
                      <span className="ui-static-30fa22db78" >
                         x{t.slaBreaches}
                      </span>
                    ) : t.enableSla ? (
                      <span className="ui-static-79401780ef" >✓</span>
                    ) : (
                      <span className="ui-static-4a0a218c1e" >-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}} />
    </div>
  );
}

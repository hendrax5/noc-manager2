"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  'New': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  'Open': { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  'Waiting Reply': { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  'Replied': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  'In Progress': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'On Hold': { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  'Finish': { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  'Resolved': { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
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

export default function LiveOpsBoard({ initialData = [], jobCategories = [], defaultScope = "all" }) {
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date', dateRange);
      params.set('scope', defaultScope);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/dashboard/live-ops?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {}
    setLoading(false);
  }, [dateRange, filterCategory, filterStatus, defaultScope]);

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
      case 'createdAt': valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
      case 'slaBreaches': valA = a.slaBreaches || 0; valB = b.slaBreaches || 0; break;
      default: valA = new Date(a.updatedAt).getTime(); valB = new Date(b.updatedAt).getTime();
    }
    if (typeof valA === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  const filteredTickets = sortedTickets.filter(t => {
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
    const rows = filteredTickets.map(t => [
      t.trackingId || '',
      getCustomerName(t),
      t.title,
      t.jobCategory?.name || '-',
      t.status,
      new Date(t.createdAt).toLocaleString('en-CA'),
      getDuration(t.createdAt, t.resolvedAt),
      t.assignee?.name || 'Unassigned',
      t.notes?.[0]?.content?.substring(0, 50) || '-',
      t.slaBreaches || 0
    ]);
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
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.6rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)' }}
    >
      {children} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {/* Header Bar */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📋</span> Live Operations Board
          </h2>
          {loading && <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>⟳ Updating...</span>}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-color)', background: 'var(--hover-bg)', padding: '0.2rem 0.6rem', borderRadius: '10px', fontWeight: 'bold' }}>{filteredTickets.length} tiket</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={exportCSV} style={{ padding: '0.4rem 0.8rem', background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            📥 Export CSV
          </button>
          <button onClick={fetchData} style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--hover-bg)' }}>
        <input
          type="text"
          placeholder="🔍 Cari tiket, customer, PIC..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: '0.8rem', minWidth: '200px', flex: '1', maxWidth: '300px' }}
        />
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: '0.8rem', cursor: 'pointer' }}>
          <option value="today">📅 Hari Ini</option>
          <option value="week">📅 7 Hari Terakhir</option>
          <option value="all">📅 Semua</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: '0.8rem', cursor: 'pointer' }}>
          <option value="">🏷️ Semua Kategori</option>
          {jobCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: '0.8rem', cursor: 'pointer' }}>
          <option value="">📊 Semua Status</option>
          <option value="New">New</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Waiting Reply">Waiting Reply</option>
          <option value="Replied">Replied</option>
          <option value="Finish">Finish</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--card-bg)' }}>
            <tr>
              <SortHeader field="trackingId">ID</SortHeader>
              <th style={{ fontSize: '0.75rem', padding: '0.6rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)' }}>Customer/Site</th>
              <th style={{ fontSize: '0.75rem', padding: '0.6rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)' }}>Subject</th>
              <SortHeader field="category">Category</SortHeader>
              <SortHeader field="status">Status</SortHeader>
              <SortHeader field="createdAt">Time Down</SortHeader>
              <th style={{ fontSize: '0.75rem', padding: '0.6rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)' }}>Duration</th>
              <SortHeader field="assignee">PIC</SortHeader>
              <th style={{ fontSize: '0.75rem', padding: '0.6rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)' }}>Last Note</th>
              <SortHeader field="slaBreaches">SLA</SortHeader>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length === 0 && (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-color)', fontStyle: 'italic' }}>Tidak ada tiket yang ditemukan untuk filter ini.</td></tr>
            )}
            {filteredTickets.map(t => {
              const customerName = getCustomerName(t);
              const stColor = STATUS_COLORS[t.status] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
              const catColor = CATEGORY_COLORS[t.jobCategory?.name] || '#94a3b8';
              const isOverdue = t.slaBreaches > 0 && t.status !== 'Resolved';
              const hoursIdle = (Date.now() - new Date(t.updatedAt).getTime()) / 3600000;
              const rowBg = isOverdue ? 'rgba(239, 68, 68, 0.04)' : (t.status === 'New' && hoursIdle > 2 ? 'rgba(245, 158, 11, 0.04)' : 'transparent');

              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', background: rowBg, transition: 'background 0.15s' }} className="hover-bg">
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.75rem', color: 'var(--heading-color)', whiteSpace: 'nowrap' }}>
                    <a href={`/tickets/${t.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{t.trackingId?.substring(0, 12) || `#${t.id}`}</a>
                  </td>
                  <td style={{ padding: '0.5rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--heading-color)', fontWeight: '600' }}>
                    {customerName}
                  </td>
                  <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--heading-color)' }}>
                    <a href={`/tickets/${t.id}`} style={{ color: 'var(--heading-color)', textDecoration: 'none' }}>{t.title}</a>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {t.jobCategory ? (
                      <span style={{ background: `${catColor}15`, color: catColor, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap', border: `1px solid ${catColor}30` }}>
                        {t.jobCategory.name}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{ background: stColor.bg, color: stColor.color, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap', border: `1px solid ${stColor.border}` }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>
                    {mounted ? new Date(t.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '600', color: hoursIdle > 4 ? '#ef4444' : (hoursIdle > 2 ? '#f59e0b' : 'var(--text-color)'), whiteSpace: 'nowrap' }}>
                    {getDuration(t.createdAt, t.resolvedAt && t.status === 'Resolved' ? t.resolvedAt : null)}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: t.assignee ? 'var(--heading-color)' : '#94a3b8', fontWeight: t.assignee ? '600' : 'normal', fontStyle: t.assignee ? 'normal' : 'italic', whiteSpace: 'nowrap' }}>
                    {t.assignee?.name || 'Unassigned'}
                  </td>
                  <td style={{ padding: '0.5rem', maxWidth: '160px' }}>
                    {inlineNoteId === t.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                          type="text"
                          value={inlineNoteText}
                          onChange={e => setInlineNoteText(e.target.value)}
                          placeholder="Quick note..."
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleInlineNote(t.id)}
                          style={{ padding: '0.25rem 0.4rem', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '0.75rem', flex: 1, minWidth: '80px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                        />
                        <button onClick={() => handleInlineNote(t.id)} disabled={inlineNoteLoading} style={{ padding: '0.2rem 0.4rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {inlineNoteLoading ? '...' : '✓'}
                        </button>
                        <button onClick={() => { setInlineNoteId(null); setInlineNoteText(''); }} style={{ padding: '0.2rem 0.4rem', background: 'var(--hover-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }} onClick={() => setInlineNoteId(t.id)}>
                        {t.notes && t.notes.length > 0 ? (
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px', display: 'block' }} title={t.notes[0].content}>
                            {t.notes[0].content.substring(0, 40)}{t.notes[0].content.length > 40 ? '...' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>+ add note</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    {t.slaBreaches > 0 && t.status !== 'Resolved' ? (
                      <span style={{ background: '#fef2f2', color: '#dc2626', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid #fecaca' }}>
                        🔥 x{t.slaBreaches}
                      </span>
                    ) : t.enableSla ? (
                      <span style={{ color: '#10b981', fontSize: '0.8rem' }}>✓</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</span>
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

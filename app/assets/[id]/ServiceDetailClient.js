'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { downtimeMinutesInRange, parseDowntimeDate } from '@/lib/tickets/downtime';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayStart(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function dayEndExclusive(ymd) {
  const start = dayStart(ymd);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

function monthBounds(yrMonth) {
  const [year, month] = yrMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end, daysInMonth: new Date(year, month, 0).getDate() };
}

function monthLastYmd(yrMonth) {
  const [year, month] = yrMonth.split('-').map(Number);
  return toYmd(new Date(year, month, 0));
}

function periodBounds(startYmd, endYmd) {
  const start = dayStart(startYmd);
  const end = dayEndExclusive(endYmd);
  return { start, end, periodMinutes: Math.max(0, Math.round((end - start) / 60000)) };
}

/** Ticket overlaps range via outage window or createdAt. `end` is exclusive. */
function ticketOverlapsRange(t, start, end) {
  const cd = t.customData && typeof t.customData === 'object' ? t.customData : {};
  if (cd.hasDowntime && cd.startDowntime) {
    const s = parseDowntimeDate(cd.startDowntime);
    let e = parseDowntimeDate(cd.endDowntime) || new Date();
    if (s && e && s < end && e > start) return true;
  }
  const created = new Date(t.createdAt);
  return created >= start && created < end;
}

function ticketOverlapsMonth(t, yrMonth) {
  const { start, end } = monthBounds(yrMonth);
  return ticketOverlapsRange(t, start, end);
}

function formatIdDate(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function periodLabel(startYmd, endYmd) {
  const a = dayStart(startYmd);
  const b = dayStart(endYmd);
  if (a.getTime() === b.getTime()) return formatIdDate(a);
  return `${formatIdDate(a)} – ${formatIdDate(b)}`;
}

function formatDurationMins(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} menit`;
  return `${h} jam ${m} menit`;
}

function serviceSid(service) {
  const cd = service.customData && typeof service.customData === 'object' ? service.customData : {};
  const hit = Object.keys(cd).find((k) =>
    /^(sid|cid|id layanan|service id|circuit(\s*id)?)$/i.test(k.trim())
  );
  return hit && cd[hit] ? String(cd[hit]) : '';
}

function serviceReportLogoUrl(service) {
  const cd = service.customData && typeof service.customData === 'object' ? service.customData : {};
  return cd.slaReportLogoUrl || cd.reportLogoUrl || '';
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function monthLabelLong(yrMonth) {
  const [year, month] = yrMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
}

function monthLabelUpper(yrMonth) {
  return monthLabelLong(yrMonth).toUpperCase();
}

function listMonthsInRange(startYmd, endYmd) {
  const months = [];
  const start = dayStart(startYmd);
  const end = dayStart(endYmd);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push(monthKeyFromDate(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function companyFooterLines() {
  return [
    'Head Office: Graha PGD - Jl. Taman Marga Satwa No. 3, Pasar Minggu Jakarta Selatan 12550',
    'Network Operation Center: JL. Kelapa Dua Wetan No. 30 Jakarta Timur 13730 - Indonesia',
    '021-3000-1555  support@ionnetwork.co.id',
  ];
}

const SLA_TARGET_PCT = 99.9;

export default function ServiceDetailClient({ service, session }) {
  const router = useRouter();
  const isAdmin = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('manage_assets');
  const [activeTab, setActiveTab] = useState('parameters');
  const [isEditingHops, setIsEditingHops] = useState(false);
  const [editableHops, setEditableHops] = useState(service.hops || []);
  const [isSaving, setIsSaving] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: service.name,
    status: service.status,
    customData: service.customData || {}
  });

  const [mounted, setMounted] = useState(false);
  const [hints, setHints] = useState({ locations: [], devices: [], ports: [] });
  const [logoUploading, setLogoUploading] = useState(false);
  
  useEffect(() => { 
    setMounted(true); 
    fetch('/api/assets/topology-hints')
      .then(res => res.json())
      .then(data => { if (data.locations) setHints(data); })
      .catch(e => console.error(e));
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  });
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
  });
  const [endDate, setEndDate] = useState(() => monthLastYmd(
    `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}`
  ));

  const applyMonth = (yrMonth) => {
    setSelectedMonth(yrMonth);
    setStartDate(`${yrMonth}-01`);
    setEndDate(monthLastYmd(yrMonth));
  };

  const ymdOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const validStart = ymdOk(startDate) ? startDate : `${selectedMonth}-01`;
  const validEnd = ymdOk(endDate) ? endDate : monthLastYmd(selectedMonth);
  const rangeStartYmd = validStart <= validEnd ? validStart : validEnd;
  const rangeEndYmd = validStart <= validEnd ? validEnd : validStart;
  const { start: rangeStart, end: rangeEnd, periodMinutes } = periodBounds(rangeStartYmd, rangeEndYmd);

  const periodTickets = (service.tickets || []).filter((t) => ticketOverlapsRange(t, rangeStart, rangeEnd));
  const outageTickets = periodTickets
    .filter((t) => t.customData?.hasDowntime && t.customData?.startDowntime)
    .sort((a, b) => {
      const as = parseDowntimeDate(a.customData.startDowntime)?.getTime() || 0;
      const bs = parseDowntimeDate(b.customData.startDowntime)?.getTime() || 0;
      return as - bs;
    });

  const totalDowntimeMins = outageTickets.reduce((acc, t) => {
    return acc + downtimeMinutesInRange(t.customData, rangeStart, rangeEnd);
  }, 0);

  const slaPercentage = periodMinutes > 0
    ? Math.max(0, ((periodMinutes - totalDowntimeMins) / periodMinutes) * 100)
    : 100;
  const slaMet = slaPercentage >= SLA_TARGET_PCT;
  const allowedDowntimeMins = Math.floor(periodMinutes * (1 - SLA_TARGET_PCT / 100));
  const sid = serviceSid(service);
  const reportLogoUrl = serviceReportLogoUrl(service);
  const reportMonths = listMonthsInRange(rangeStartYmd, rangeEndYmd);
  const outageTicketsByMonth = reportMonths.map((yrMonth) => {
    const { start: mStart, end: mEnd } = monthBounds(yrMonth);
    const monthOutages = outageTickets
      .filter((t) => downtimeMinutesInRange(t.customData, mStart, mEnd) > 0)
      .map((t) => {
        const monthDowntimeMins = downtimeMinutesInRange(t.customData, mStart, mEnd);
        const { daysInMonth } = monthBounds(yrMonth);
        const monthMinutes = daysInMonth * 24 * 60;
        const uptimePct = monthMinutes > 0 ? ((monthMinutes - monthDowntimeMins) / monthMinutes) * 100 : 100;
        const tdownPct = monthMinutes > 0 ? (monthDowntimeMins / monthMinutes) * 100 : 0;
        return { ticket: t, monthDowntimeMins, uptimePct, tdownPct };
      });
    return { yrMonth, monthOutages };
  });

  // Calculate 12-month trend
  const yearlyTrend = [];
  const nowForTrend = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nowForTrend.getFullYear(), nowForTrend.getMonth() - i, 1);
    const yrMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('id-ID', { month: 'short' });
    const { start: mStart, end: mEnd, daysInMonth: daysInM } = monthBounds(yrMonth);

    const mTickets = (service.tickets || []).filter(t => ticketOverlapsMonth(t, yrMonth));
    const mDowntimeMins = mTickets.reduce(
      (acc, t) => acc + downtimeMinutesInRange(t.customData, mStart, mEnd),
      0
    );

    const mMins = daysInM * 24 * 60;
    const mUptime = mMins > 0 ? Math.max(0, ((mMins - mDowntimeMins) / mMins) * 100) : 100;
    
    yearlyTrend.push({
      month: label,
      fullMonth: yrMonth,
      uptime: parseFloat(mUptime.toFixed(3)),
      downtimeMins: mDowntimeMins
    });
  }

  const handlePrint = () => {
    window.print();
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson.error || 'Upload logo gagal');

      const currentCustomData =
        service.customData && typeof service.customData === 'object' ? service.customData : {};
      const patchRes = await fetch(`/api/assets/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customData: {
            ...currentCustomData,
            slaReportLogoUrl: uploadJson.url,
          },
        }),
      });
      const patchJson = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) throw new Error(patchJson.error || 'Simpan logo gagal');
      router.refresh();
    } catch (err) {
      alert(err.message || 'Upload logo gagal');
    } finally {
      setLogoUploading(false);
    }
  };

  const templateFields = service.template?.fields ? (typeof service.template.fields === 'string' ? JSON.parse(service.template.fields) : service.template.fields) : [];

  const handleDelete = async () => {
    if (!confirm('Are you absolutely sure you want to delete this service and clear all topology records?')) return;
    try {
      const res = await fetch(`/api/assets/services/${service.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/assets');
        router.refresh();
      }
    } catch (e) { console.error(e); }
  };

  const handleHopChange = (index, field, value) => {
    const newHops = [...editableHops];
    newHops[index][field] = value;
    setEditableHops(newHops);
  };
  
  const addHop = () => setEditableHops([...editableHops, { location: '', deviceName: '', portName: '', description: '' }]);
  const removeHop = (i) => setEditableHops(editableHops.filter((_, idx) => idx !== i));

  const saveHops = async () => {
    setIsSaving(true);
    try {
      const validHops = editableHops.filter(h => h.location || h.deviceName);
      const res = await fetch(`/api/assets/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hops: validHops })
      });
      if (res.ok) {
        setIsEditingHops(false);
        router.refresh(); // Fetch new server data
      } else {
        alert('Failed to save topology');
      }
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleSaveCore = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assets/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        setShowEditModal(false);
        router.refresh();
      } else {
        alert('Failed to update service details');
      }
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  return (
    <main className="container" style={{ maxWidth: '1100px' }}>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <Link href="/assets" style={{ color: 'var(--text-color)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>← Back to Inventory</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
               <h1 style={{ margin: 0 }}>{service.name}</h1>
               <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: service.status === 'Active' ? '#10b981' : '#ef4444', background: service.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '0.3rem 0.8rem', borderRadius: '12px' }}>
                  {service.status}
               </span>
             </div>
             <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.1rem' }}>
               <strong style={{ color: 'var(--heading-color)' }}>{service.customer?.name}</strong> • {service.template?.name}
             </p>
             <div style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: '0.5rem' }}>
                Provisioned: {mounted ? new Date(service.createdAt).toLocaleString() : ''}
             </div>
          </div>
          
          {isAdmin && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowEditModal(true)} className="secondary-btn">✏️ Edit Details</button>
              <button onClick={handleDelete} className="secondary-btn" style={{ color: '#ef4444', borderColor: '#fca5a5' }}>Delete Service</button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Col: Params & SLA Tabs */}
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Tabs Navigation */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('parameters')} 
              style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'parameters' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'parameters' ? 'var(--primary-color)' : 'var(--text-color)', transition: 'all 0.2s' }}
            >
              Technical Parameters
            </button>
            <button 
              onClick={() => setActiveTab('sla')} 
              style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'sla' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'sla' ? 'var(--primary-color)' : 'var(--text-color)', transition: 'all 0.2s' }}
            >
              SLA & Analytics
            </button>
            <button 
              onClick={() => setActiveTab('tickets')} 
              style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'tickets' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'tickets' ? 'var(--primary-color)' : 'var(--text-color)', transition: 'all 0.2s' }}
            >
              Linked Tickets
            </button>
          </div>

          {activeTab === 'parameters' && (
            <div className="bg-white-card scale-in" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              {service.customData && Object.keys(service.customData).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   {Object.entries(service.customData).map(([key, val]) => (
                      <div key={key}>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{key}</div>
                         <div style={{ fontSize: '1.05rem', color: 'var(--heading-color)', background: 'var(--hover-bg)', padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>{val || '-'}</div>
                      </div>
                   ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>No custom network parameters defined.</p>
              )}
            </div>
          )}

          {activeTab === 'sla' && (
            <div className="bg-white-card scale-in" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, color: 'var(--heading-color)' }}>Analisis SLA & Downtime</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-color)', textTransform: 'uppercase' }}>
                    Preset bulan
                    <select
                      value={selectedMonth}
                      onChange={(e) => applyMonth(e.target.value)}
                      style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {(() => {
                        const options = [];
                        const now = new Date();
                        for (let i = 0; i < 12; i++) {
                          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                          const val = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
                          const label = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                          options.push(<option key={val} value={val}>{label}</option>);
                        }
                        return options;
                      })()}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-color)', textTransform: 'uppercase' }}>
                    Dari
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-color)', textTransform: 'uppercase' }}>
                    Sampai
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                    />
                  </label>
                  <button onClick={handlePrint} style={{ background: '#18181b', color: 'white', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>Export PDF klien</button>
                </div>
              </div>

              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-color)' }}>
                Periode {periodLabel(rangeStartYmd, rangeEndYmd)}
              </p>

              {isAdmin && (
                <div style={{ margin: '0 0 1rem', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--hover-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--heading-color)' }}>Logo PDF klien</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-color)', marginTop: '0.2rem' }}>
                      Upload logo agar cover laporan sesuai dokumen resmi.
                    </div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#18181b', color: 'white', borderRadius: '6px', padding: '0.5rem 0.8rem', cursor: logoUploading ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      style={{ display: 'none' }}
                      disabled={logoUploading}
                      onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                    />
                    {logoUploading ? 'Uploading...' : (reportLogoUrl ? 'Ganti logo' : 'Upload logo')}
                  </label>
                </div>
              )}

              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'var(--hover-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Tiket gangguan</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--heading-color)', marginTop: '0.25rem' }}>{periodTickets.length}</div>
                </div>

                <div style={{ background: 'var(--hover-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total downtime</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--heading-color)', marginTop: '0.4rem' }}>
                    {formatDurationMins(totalDowntimeMins)}
                  </div>
                </div>

                <div style={{
                  background: slaMet ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${slaMet ? '#10b981' : '#ef4444'}`,
                  padding: '1rem', borderRadius: '8px', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: slaMet ? '#065f46' : '#991b1b', fontWeight: 'bold', textTransform: 'uppercase' }}>SLA uptime</div>
                  <div style={{
                    fontSize: '1.8rem', fontWeight: 'bold',
                    color: slaMet ? '#10b981' : '#ef4444',
                    marginTop: '0.3rem'
                  }}>
                    {slaPercentage.toFixed(3)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-color)', marginTop: '0.25rem' }}>
                    Target {SLA_TARGET_PCT}% · {slaMet ? 'Memenuhi' : 'Tidak memenuhi'}
                  </div>
                </div>
              </div>

              {/* 12-Month Trend Chart */}
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--heading-color)', textTransform: 'uppercase' }}>Tren Uptime 12 Bulan Terakhir</h4>
              <div style={{ height: '200px', marginBottom: '2rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis domain={[90, 100]} fontSize={10} />
                    <RechartsTooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="uptime" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Uptime %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* List of Outages in selectedMonth */}
              {outageTickets.length > 0 ? (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase' }}>Kronologi outage</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {outageTickets.map(t => {
                      const dStart = t.customData.startDowntime ? new Date(t.customData.startDowntime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                      const dEnd = t.customData.endDowntime ? new Date(t.customData.endDowntime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum selesai';
                      const dtMins = downtimeMinutesInRange(t.customData, rangeStart, rangeEnd);
                      return (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--hover-bg)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                            <Link href={`/tickets/${t.id}`} style={{ fontWeight: 'bold', color: 'var(--primary-color)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.trackingId ? `#${t.trackingId}` : `#${t.id}`} — {t.title}
                            </Link>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{dStart} s/d {dEnd}</span>
                          </div>
                          <span style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.3rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDurationMins(dtMins)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', padding: '2rem', background: 'var(--hover-bg)', borderRadius: '8px' }}>
                  Tidak ada riwayat downtime pada periode ini.
                </div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="bg-white-card scale-in" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              {service.tickets && service.tickets.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                   {service.tickets.map(t => (
                      <li key={t.id} style={{ padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                         <Link href={`/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'var(--heading-color)', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>
                           {t.trackingId ? `#${t.trackingId.split('-')[0]}` : `Ticket #${t.id}`} - {t.title}
                         </Link>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-color)' }}>
                           <span style={{ color: t.status === 'Resolved' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>{t.status}</span>
                           <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                         </div>
                      </li>
                   ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>Clean record. No networking incidents found.</p>
              )}
            </div>
          )}

        </div>

        {/* Right Col: Circuit Hop Topology */}
        <div>
          <div className="bg-white-card" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--heading-color)' }}>Circuit Topology (Hops)</h3>
              {isAdmin && !isEditingHops && (
                <button onClick={() => { setEditableHops(service.hops || []); setIsEditingHops(true); }} className="secondary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>✏️ Edit Route</button>
              )}
              {isEditingHops && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button onClick={() => setIsEditingHops(false)} className="secondary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Cancel</button>
                   <button onClick={saveHops} disabled={isSaving} className="primary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: '#10b981' }}>{isSaving ? '...' : 'Save Hops'}</button>
                </div>
              )}
            </div>
            
            {isEditingHops ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <button type="button" onClick={addHop} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', alignSelf: 'flex-start' }}>+ Add Network Node</button>
                {editableHops.map((hop, i) => (
                  <div key={i} style={{ position: 'relative', background: 'var(--hover-bg)', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                       <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>Node #{i + 1}</span>
                       <button onClick={() => removeHop(i)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.5rem', fontWeight: 'bold' }}>Delete</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Location</label>
                         <input type="text" list="service-locations" className="input-field" value={hop.location} onChange={e => handleHopChange(i, 'location', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Device Name</label>
                         <input type="text" list="service-devices" className="input-field" value={hop.deviceName} onChange={e => handleHopChange(i, 'deviceName', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Port Name</label>
                         <input type="text" list="service-ports" className="input-field" value={hop.portName} onChange={e => handleHopChange(i, 'portName', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Description (XC)</label>
                         <input type="text" className="input-field" value={hop.description || ''} onChange={e => handleHopChange(i, 'description', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : service.hops && service.hops.length > 0 ? (
              <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                {/* Vertical Line Connector */}
                <div style={{ position: 'absolute', top: '10px', bottom: '20px', left: '11px', width: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 1 }}>
                  {service.hops.map((hop, i) => (
                    <div key={hop.id} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-33px', top: '0', background: 'var(--primary-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 0 0 4px var(--card-bg)' }}>
                        {i + 1}
                      </div>
                      
                      <div style={{ background: 'var(--hover-bg)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1.1rem', color: 'var(--heading-color)' }}>{hop.location}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold', background: 'rgba(59,130,246,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>Hop #{i+1}</span>
                         </div>
                         
                         <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginTop: '1rem', fontSize: '0.9rem' }}>
                           <div>
                             <div style={{ color: 'var(--text-color)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Device / Router</div>
                             <div style={{ color: 'var(--heading-color)', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '0.2rem' }}>{hop.deviceName || '-'}</div>
                           </div>
                           <div>
                             <div style={{ color: 'var(--text-color)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Port Intf</div>
                             <div style={{ color: 'var(--heading-color)', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '0.2rem' }}>{hop.portName || '-'}</div>
                           </div>
                         </div>
                         
                         {hop.description && (
                           <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-color)', fontSize: '0.85rem' }}>
                             <strong style={{ color: 'var(--heading-color)' }}>Patch Notes:</strong> {hop.description}
                           </div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '2rem' }}>🪢</span>
                <p style={{ color: 'var(--text-color)', marginTop: '1rem' }}>No topological nodes bounded strictly measuring this subscription flow.</p>
              </div>
            )}
            
          </div>
        </div>

      </div>

      {/* EDIT CORE MODAL */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="bg-white-card scale-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--heading-color)' }}>Edit Asset Details</h2>
            <form onSubmit={handleSaveCore}>
               <div style={{ marginBottom: '1rem' }}>
                 <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Service Name / Alias</label>
                 <input type="text" required className="input-field" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{ width: '100%', padding: '0.8rem' }} />
               </div>
               
               <div style={{ marginBottom: '1.5rem' }}>
                 <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(-- heading-color)', fontSize: '0.9rem' }}>Operational Status</label>
                 <select className="input-field" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} style={{ width: '100%', padding: '0.8rem' }}>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
                 </select>
               </div>

               {templateFields.length > 0 && (
                 <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                   <h4 style={{ margin: '0 0 1rem 0', color: 'var(--heading-color)' }}>Technical Parameters</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {templateFields.map((f, i) => (
                       <div key={i}>
                         <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--text-color)', fontSize: '0.85rem' }}>{f.name}</label>
                         <input 
                           type={f.type === 'number' ? 'number' : 'text'} 
                           className="input-field" 
                           value={editData.customData[f.name] || ''} 
                           onChange={e => setEditData({ ...editData, customData: { ...editData.customData, [f.name]: e.target.value } })} 
                           style={{ width: '100%', padding: '0.6rem' }} 
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                 <button type="button" onClick={() => setShowEditModal(false)} className="secondary-btn">Cancel</button>
                 <button type="submit" disabled={isSaving} className="primary-btn">{isSaving ? 'Updating...' : 'Save Changes'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Datalists for Autocomplete */}
      <datalist id="service-locations">
         {hints.locations.map((loc, i) => <option key={i} value={loc} />)}
      </datalist>
      <datalist id="service-devices">
         {hints.devices.map((dev, i) => <option key={i} value={dev} />)}
      </datalist>
      {/* PRINT REPORT - HIDDEN FROM UI */}
      <div id="client-formal-report" style={{ display: 'none' }}>
        <div className="sla-print-page">
          {reportLogoUrl ? (
            <img src={reportLogoUrl} alt="Company logo" className="sla-print-company-logo" />
          ) : (
            <div className="sla-print-company-logo-slot">LOGO PERUSAHAAN</div>
          )}
          <div className="sla-print-cover-title">LAPORAN</div>
          <div className="sla-print-cover-title">PENGGUNAAN</div>
          <div className="sla-print-cover-title">BANDWIDTH</div>
          <div className="sla-print-cover-customer">{service.customer?.name || service.name}</div>
          <div className="sla-print-cover-period">Periode :</div>
          <div className="sla-print-cover-range">{monthLabelUpper(reportMonths[0])}{reportMonths.length > 1 ? ` – ${monthLabelUpper(reportMonths[reportMonths.length - 1])}` : ''}</div>
          <div className="sla-print-footer">
            {companyFooterLines().map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>

        <div className="sla-print-page">
          <div className="sla-print-footer-spacer" />
          <h2 className="sla-print-section-title">PENDAHULUAN</h2>
          <p className="sla-print-paragraph">
            ION Network memberikan laporan ketersediaan jaringan untuk periode {monthLabelUpper(reportMonths[0])}
            {reportMonths.length > 1 ? ` – ${monthLabelUpper(reportMonths[reportMonths.length - 1])}` : ''}. Laporan ini berisi
            durasi gangguan, penyebab gangguan, dan tindakan perbaikan yang dilakukan pada layanan {service.name}.
          </p>
          <p className="sla-print-paragraph">
            Laporan dibuat sebagai data teknis untuk menilai kesesuaian layanan terhadap SLA (Service Level Agreement).
            Jika terdapat gangguan yang menyebabkan SLA tidak terpenuhi, laporan ini dapat menjadi dasar evaluasi teknis
            dan tindak lanjut layanan.
          </p>
          <p className="sla-print-paragraph">
            ION Network selalu berupaya menjaga kualitas layanan melalui perawatan berkala, prioritas perbaikan pada jalur backbone
            dan local loop, serta penyampaian informasi gangguan kepada pelanggan. Detail laporan kami sampaikan sebagai berikut.
          </p>
          <div className="sla-print-footer">
            {companyFooterLines().map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>

        {outageTicketsByMonth.map(({ yrMonth, monthOutages }) => (
          <div key={yrMonth} className="sla-print-page">
            <div className="sla-print-footer-spacer" />
            <h2 className="sla-print-section-title">Detail Outage Information</h2>
            <div className="sla-print-meta">Customer {service.customer?.name || '-'}</div>
            <div className="sla-print-meta">Periode {monthLabelUpper(yrMonth)}</div>
            <div className="sla-print-meta">Service {service.template?.name || service.name}</div>
            <div className="sla-print-meta" style={{ marginBottom: '0.75rem' }}>Problem side ION Network</div>

            <table className="sla-print-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>Customer</th>
                  <th>Incident Date</th>
                  <th>Incident Timelines (GMT +7)</th>
                  <th>Problem Cause</th>
                  <th>Corrective Actions</th>
                  <th>SLA Avail (%)</th>
                  <th>Tdown (%)</th>
                </tr>
              </thead>
              <tbody>
                {monthOutages.length > 0 ? monthOutages.map(({ ticket, monthDowntimeMins, uptimePct, tdownPct }, i) => {
                  const startDt = ticket.customData?.startDowntime ? new Date(ticket.customData.startDowntime) : null;
                  const endDt = ticket.customData?.endDowntime ? new Date(ticket.customData.endDowntime) : null;
                  const notes = String(ticket.description || '').split(/\r?\n+/).filter(Boolean);
                  const cause = notes[0] || ticket.title || '-';
                  const action = notes.slice(1).join(' ') || 'Dilakukan penanganan oleh tim NOC';
                  return (
                    <tr key={ticket.id}>
                      <td>{i + 1}</td>
                      <td>{service.customer?.name || '-'}</td>
                      <td>{startDt ? startDt.toLocaleDateString('id-ID') : '-'}</td>
                      <td>
                        {startDt ? startDt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        {' - '}
                        {endDt ? endDt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Berjalan'}
                        <div>{formatDurationMins(monthDowntimeMins)}</div>
                      </td>
                      <td>{cause}</td>
                      <td>{action}</td>
                      <td>{uptimePct.toFixed(1)}%</td>
                      <td>{tdownPct.toFixed(1)}%</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center' }}>Tidak ada outage pada periode ini.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="sla-print-footer">
              {companyFooterLines().map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ))}

        <div className="sla-print-page">
          <div className="sla-print-footer-spacer" />
          <p className="sla-print-paragraph">
            Demikian laporan performasi jaringan kami sampaikan sesuai dengan data yang terdapat pada sistem monitoring ION Network.
            Atas perhatiannya kami mengucapkan terima kasih.
          </p>
          <table className="sla-print-sign-table">
            <tbody>
              <tr>
                <td>{service.customer?.name || 'Pelanggan'}</td>
                <td>PT. PARSAORAN GLOBAL DATATRANS (ION NETWORK)</td>
              </tr>
              <tr>
                <td className="sla-print-sign-space">Nama :</td>
                <td className="sla-print-sign-space">Nama : Hendra Utomo</td>
              </tr>
              <tr>
                <td>NIP :</td>
                <td>Jabatan : NOC Manager</td>
              </tr>
            </tbody>
          </table>
          <div className="sla-print-footer">
            {companyFooterLines().map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        @media print {
          body * {
            visibility: hidden;
          }
          #client-formal-report, #client-formal-report * {
            visibility: visible;
          }
          #client-formal-report {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: #111;
            font-size: 12px;
            line-height: 1.4;
          }
          .sla-print-page {
            position: relative;
            min-height: 100vh;
            padding: 24px 28px 88px;
            page-break-after: always;
            break-after: page;
          }
          .sla-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .sla-print-company-logo-slot {
            width: 180px;
            height: 58px;
            border: 1px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: #64748b;
            margin-bottom: 42px;
          }
          .sla-print-company-logo {
            width: 180px;
            max-height: 64px;
            object-fit: contain;
            margin-bottom: 42px;
          }
          .sla-print-cover-title {
            font-size: 30px;
            font-weight: 700;
            letter-spacing: 0.08em;
            line-height: 1.1;
          }
          .sla-print-cover-customer {
            margin-top: 18px;
            font-size: 24px;
            font-weight: 700;
          }
          .sla-print-cover-period {
            margin-top: 48px;
            font-size: 16px;
          }
          .sla-print-cover-range {
            font-size: 24px;
            font-weight: 700;
            margin-top: 4px;
          }
          .sla-print-section-title {
            margin: 0 0 12px;
            font-size: 20px;
            font-weight: 700;
          }
          .sla-print-paragraph {
            margin: 0 0 12px;
            text-align: justify;
          }
          .sla-print-meta {
            margin-bottom: 2px;
            font-size: 13px;
          }
          .sla-print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .sla-print-table th,
          .sla-print-table td {
            border: 1px solid #a1a1aa;
            padding: 6px;
            vertical-align: top;
          }
          .sla-print-table th {
            background: #f4f4f5;
            font-weight: 700;
            text-align: left;
          }
          .sla-print-sign-table {
            width: 100%;
            margin-top: 40px;
            border-collapse: collapse;
          }
          .sla-print-sign-table td {
            width: 50%;
            vertical-align: top;
            padding-right: 20px;
          }
          .sla-print-sign-space {
            padding-top: 72px;
          }
          .sla-print-footer-spacer {
            height: 10px;
          }
          .sla-print-footer {
            position: absolute;
            left: 28px;
            right: 28px;
            bottom: 20px;
            text-align: center;
            font-size: 10px;
            line-height: 1.35;
          }
        }
      `}} />

    </main>
  );
}

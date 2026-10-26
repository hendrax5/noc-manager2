'use client';
import CapacityInput from '@/components/CapacityInput';
import {isBandwidthField,isPlaceholderField} from '@/lib/services/fields';
import {isDarkFiber,isPairField,readPairCount} from '@/lib/services/productUnits';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCustomerId } from '@/lib/customers/identity';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { downtimeMinutesInRange, parseDowntimeDate } from '@/lib/tickets/downtime';
import { WORK_TYPES, WORK_TYPE_LABELS } from '@/lib/tickets/workClassification';
import { getServiceCid } from '@/lib/services/cid';
import { readServiceBandwidthMbps } from '@/lib/services/capacity';
import { formatCustomValue } from '@/lib/ui/customDataView';

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
  return getServiceCid(service);
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
  const isCS = session?.user?.department?.includes('CS') || session?.user?.department?.toLowerCase().includes('customer');
  const canCreateTicket = session?.user?.role === 'Admin' || isCS || session?.user?.permissions?.includes('create_tickets') || session?.user?.permissions?.includes('manage_tickets');
  const [historyWorkType, setHistoryWorkType] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const historyTickets = [...(service.tickets || [])].filter(ticket => (!historyWorkType || (ticket.workType || 'Unclassified') === historyWorkType) && (!historyStatus || ticket.status === historyStatus)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [activeTab, setActiveTab] = useState('parameters');
  const [isEditingHops, setIsEditingHops] = useState(false);
  const [editableHops, setEditableHops] = useState(service.hops || []);
  const [isSaving, setIsSaving] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: service.name,
    cid: getServiceCid(service),
    status: service.status,
    company: service.company || '',
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
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Failed to update service details');
      }
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  return (
    <main className="container" style={{ maxWidth: '1100px' }}>
      <header className="page-header ui-static-a5e927dc66" >
        <Link href="/assets" className="ui-static-37b8c17cf4" style={{textDecoration: 'none', display: 'inline-block'}}>← Back to Inventory</Link>
        <div className="ui-static-af81cc4264" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', overflowWrap: 'anywhere'}}>
          <div>
             <div className="ui-static-c8def3163d" style={{display: 'flex', alignItems: 'center'}}>
               <h1 className="ui-static-ff227d0632" >{service.name}</h1>
               <span className="ui-static-c0f9521575" style={{color: service.status === 'Active' ? "var(--ui-success)" : "var(--ui-danger)", background: service.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}}>
                  {service.status}
               </span>
             </div>
             <p className="ui-static-15f3dacdde" >
               <strong className="ui-static-bffd53f399" >{service.customer?.name}</strong> • {service.template?.name}
             </p>
             <div className="ui-static-20195eee1a" >
                Provisioned: {mounted ? new Date(service.createdAt).toLocaleString() : ''}
             </div>
          </div>
          
          <span>Customer ID: {formatCustomerId({id:service.customerId??service.customer?.id})}</span>
          {(service.identifiers||[]).filter(item=>item.code!==getServiceCid(service)).map(item=><span key={item.code}>Kode lama: {item.code}</span>)}
          {canCreateTicket && <Link href={`/tickets/new?serviceId=${service.id}&workType=ServiceWork`} className="primary-btn" style={{ width: 'auto', textDecoration: 'none' }}>Buat Tiket</Link>}
          {canCreateTicket && <Link href={`/tickets/new?serviceId=${service.id}&workType=Trouble`} className="secondary-btn" style={{ width: 'auto', textDecoration: 'none' }}>Buat Trouble</Link>}
          {isAdmin && (
            <div className="ui-static-af81cc4264" style={{display: 'flex', flexWrap: 'wrap'}}>
              <button onClick={() => setShowEditModal(true)} className="secondary-btn"> Edit Details</button>
              <button onClick={handleDelete} className="secondary-btn ui-static-f9a371332a" >Delete Service</button>
            </div>
          )}
        </div>
      </header>

      <div className="ui-static-0410aac9fd" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))'}}>
        
        {/* Left Col: Params & SLA Tabs */}
        <div className="no-print ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column'}}>
          
          {/* Tabs Navigation */}
          <div className="ui-static-cca6147c33" style={{display: 'flex'}}>
            <button 
              onClick={() => setActiveTab('parameters')} 
              className="ui-static-14cdf42bd4" style={{cursor: 'pointer', borderBottom: activeTab === 'parameters' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'parameters' ? 'var(--primary-color)' : 'var(--text-color)', transition: 'all 0.2s'}}
            >
              Technical Parameters
            </button>
            <button 
              onClick={() => setActiveTab('sla')} 
              className="ui-static-14cdf42bd4" style={{cursor: 'pointer', borderBottom: activeTab === 'sla' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'sla' ? 'var(--primary-color)' : 'var(--text-color)', transition: 'all 0.2s'}}
            >
              SLA & Analytics
            </button>
            <button 
              onClick={() => setActiveTab('tickets')} 
              className="ui-static-14cdf42bd4" style={{cursor: 'pointer', borderBottom: activeTab === 'tickets' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'tickets' ? 'var(--primary-color)' : 'var(--text-color)', transition: 'all 0.2s'}}
            >
              Linked Tickets
            </button>
          </div>

          {activeTab === 'parameters' && (
            <div className="bg-white-card scale-in ui-static-239a0228f6" >
              {service.customData && Object.keys(service.customData).length > 0 ? (
                <div className="ui-static-af81cc4264" style={{display: 'flex', flexDirection: 'column'}}>
                   {Object.entries(service.customData).filter(([key])=>!isDarkFiber(service.template)||!isBandwidthField(key)).map(([key, val]) => (
                      <div key={key}>
                         <div className="ui-static-ecd350dcb3" style={{textTransform: 'uppercase'}}>{isPairField(key)?'Jumlah pair':key}</div>
                         <div className="ui-static-1d732f7131" >{isDarkFiber(service.template)&&isPairField(key)?`${formatCustomValue(val)} pair`:formatCustomValue(val) || '-'}</div>
                      </div>
                   ))}
                </div>
              ) : (
                <p className="ui-static-1602df5bc5" >No custom network parameters defined.</p>
              )}
            </div>
          )}

          {activeTab === 'sla' && (
            <div className="bg-white-card scale-in ui-static-239a0228f6" >
              <div className="ui-static-877675b836" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap'}}>
                <h3 className="ui-static-ee96dc83fb" >Analisis SLA & Downtime</h3>
                <div className="ui-static-30f523173e" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end'}}>
                  <label className="ui-static-fe7eeb1944" style={{display: 'flex', flexDirection: 'column', textTransform: 'uppercase'}}>
                    Preset bulan
                    <select
                      value={selectedMonth}
                      onChange={(e) => applyMonth(e.target.value)}
                      className="ui-static-ad76914dac" style={{cursor: 'pointer'}}
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
                  <label className="ui-static-fe7eeb1944" style={{display: 'flex', flexDirection: 'column', textTransform: 'uppercase'}}>
                    Dari
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="ui-static-e1cf8ab780"
                    />
                  </label>
                  <label className="ui-static-fe7eeb1944" style={{display: 'flex', flexDirection: 'column', textTransform: 'uppercase'}}>
                    Sampai
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="ui-static-e1cf8ab780"
                    />
                  </label>
                  <button onClick={handlePrint} className="ui-static-af57253ec1" style={{cursor: 'pointer'}}>Export PDF klien</button>
                </div>
              </div>

              <p className="ui-static-0845ea31a1" >
                Periode {periodLabel(rangeStartYmd, rangeEndYmd)}
              </p>

              {isAdmin && (
                <div className="ui-static-4dfe3c7144" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                  <div>
                    <div className="ui-static-a849bc9536" >Logo PDF klien</div>
                    <div className="ui-static-bfa4405942" >
                      Upload logo agar cover laporan sesuai dokumen resmi.
                    </div>
                  </div>
                  <label className="ui-static-ec53a2420e" style={{display: 'inline-flex', alignItems: 'center', cursor: logoUploading ? 'wait' : 'pointer'}}>
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
              <div className="ui-static-7b101c5d25" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'}}>
                <div className="ui-static-8ac40da837" style={{textAlign: 'center'}}>
                  <div className="ui-static-61b6d2c8fb" style={{textTransform: 'uppercase'}}>Tiket gangguan</div>
                  <div className="ui-static-b34bf2a93b" >{periodTickets.length}</div>
                </div>

                <div className="ui-static-8ac40da837" style={{textAlign: 'center'}}>
                  <div className="ui-static-61b6d2c8fb" style={{textTransform: 'uppercase'}}>Total downtime</div>
                  <div className="ui-static-452f5439a3" >
                    {formatDurationMins(totalDowntimeMins)}
                  </div>
                </div>

                <div className="ui-static-8efc41f990" style={{background: slaMet ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${slaMet ? "var(--ui-success)" : "var(--ui-danger)"}`, textAlign: 'center'}}>
                  <div className="ui-static-96b9d77a63" style={{color: slaMet ? "var(--ui-success)" : "var(--ui-danger)", textTransform: 'uppercase'}}>SLA uptime</div>
                  <div className="ui-static-af4000f520" style={{color: slaMet ? "var(--ui-success)" : "var(--ui-danger)"}}>
                    {slaPercentage.toFixed(3)}%
                  </div>
                  <div className="ui-static-1393e97943" >
                    Target {SLA_TARGET_PCT}% · {slaMet ? 'Memenuhi' : 'Tidak memenuhi'}
                  </div>
                </div>
              </div>

              {/* 12-Month Trend Chart */}
              <h4 className="ui-static-7a3778a9c4" style={{textTransform: 'uppercase'}}>Tren Uptime 12 Bulan Terakhir</h4>
              <div className="ui-static-a5e927dc66" style={{height: '200px'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis domain={[90, 100]} fontSize={10} />
                    <RechartsTooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="uptime" fill="var(--ui-info)" radius={[4, 4, 0, 0]} name="Uptime %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* List of Outages in selectedMonth */}
              {outageTickets.length > 0 ? (
                <div>
                  <h4 className="ui-static-8358d83cb3" style={{textTransform: 'uppercase'}}>Kronologi outage</h4>
                  <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column', maxHeight: '300px', overflowY: 'auto'}}>
                    {outageTickets.map(t => {
                      const dStart = t.customData.startDowntime ? new Date(t.customData.startDowntime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                      const dEnd = t.customData.endDowntime ? new Date(t.customData.endDowntime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum selesai';
                      const dtMins = downtimeMinutesInRange(t.customData, rangeStart, rangeEnd);
                      return (
                        <div key={t.id} className="ui-static-dd10036014" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div className="ui-static-5ed417d1fb" style={{flex: 1, minWidth: 0}}>
                            <Link href={`/tickets/${t.id}`} className="ui-static-233d64da35" style={{textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                              {t.trackingId ? `#${t.trackingId}` : `#${t.id}`} — {t.title}
                            </Link>
                            <span className="ui-static-f0ec965903" >{dStart} s/d {dEnd}</span>
                          </div>
                          <span className="ui-static-d64a11387c" style={{whiteSpace: 'nowrap'}}>
                            {formatDurationMins(dtMins)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="ui-static-2626b9e03b" style={{textAlign: 'center'}}>
                  Tidak ada riwayat downtime pada periode ini.
                </div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="bg-white-card scale-in ui-static-239a0228f6" >
              <div className="ui-static-2a0b357ce7" style={{display: 'flex', flexWrap: 'wrap'}}>
                <label>Jenis pekerjaan <select aria-label="Filter riwayat jenis pekerjaan" value={historyWorkType} onChange={event => setHistoryWorkType(event.target.value)}><option value="">Semua jenis</option>{WORK_TYPES.map(type => <option key={type} value={type}>{WORK_TYPE_LABELS[type]}</option>)}</select></label>
                <label>Status <select aria-label="Filter riwayat status" value={historyStatus} onChange={event => setHistoryStatus(event.target.value)}><option value="">Semua status</option>{[...new Set((service.tickets || []).map(ticket => ticket.status))].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
              </div>
              {historyTickets.length > 0 ? (
                <ul className="ui-static-9a8354becc" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
                   {historyTickets.map(t => (
                      <li key={t.id} className="ui-static-df8e4860f8" >
                         <Link href={`/tickets/${t.id}`} className="ui-static-e879263bc6" style={{textDecoration: 'none', display: 'block'}}>
                           {t.trackingId ? `#${t.trackingId}` : `Ticket #${t.id}`} - {t.title}
                         </Link>
                         <div className="ui-static-2748f1debd" style={{display: 'flex', justifyContent: 'space-between'}}>
                           <span>{t.serviceWorkTypeLabel || WORK_TYPE_LABELS[t.workType] || WORK_TYPE_LABELS.Unclassified}</span>
                           <span className="ui-static-78d7af8b7e" style={{color: t.status === 'Resolved' ? "var(--ui-success)" : "var(--ui-warning)"}}>{t.status}</span>
                           <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                         </div>
                      </li>
                   ))}
                </ul>
              ) : (
                <p className="ui-static-1602df5bc5" >Tidak ada tiket yang cocok dengan filter riwayat.</p>
              )}
            </div>
          )}

        </div>

        {/* Right Col: Circuit Hop Topology */}
        <div>
          <div className="bg-white-card ui-static-239a0228f6" style={{minHeight: '100%'}}>
            <div className="ui-static-3a05f9c755" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3 className="ui-static-ee96dc83fb" >Circuit Topology (Hops)</h3>
              {isAdmin && !isEditingHops && (
                <button onClick={() => { setEditableHops(service.hops || []); setIsEditingHops(true); }} className="secondary-btn ui-static-98c47ac18d" > Edit Route</button>
              )}
              {isEditingHops && (
                <div className="ui-static-30f523173e" style={{display: 'flex'}}>
                   <button onClick={() => setIsEditingHops(false)} className="secondary-btn ui-static-98c47ac18d" >Cancel</button>
                   <button onClick={saveHops} disabled={isSaving} className="primary-btn ui-static-3d998e9216" >{isSaving ? '...' : 'Save Hops'}</button>
                </div>
              )}
            </div>
            
            {isEditingHops ? (
              <div className="ui-static-92254f43e7" style={{display: 'flex', flexDirection: 'column'}}>
                <button type="button" onClick={addHop} className="ui-static-ba722cc2cf" style={{cursor: 'pointer', alignSelf: 'flex-start'}}>+ Add Network Node</button>
                {editableHops.map((hop, i) => (
                  <div key={i} className="ui-static-af61258d71" style={{position: 'relative'}}>
                    <div className="ui-static-3e8220669e" style={{display: 'flex', justifyContent: 'space-between'}}>
                       <span className="ui-static-233d64da35" >Node #{i + 1}</span>
                       <button onClick={() => removeHop(i)} className="ui-static-df346c4cbe" style={{cursor: 'pointer'}}>Delete</button>
                    </div>
                    <div className="ui-static-af81cc4264" style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)'}}>
                      <div>
                         <label className="ui-static-7e5eaaca0d" >Location</label>
                         <input type="text" list="service-locations" className="input-field ui-static-ce5f724e09" value={hop.location} onChange={e => handleHopChange(i, 'location', e.target.value)} style={{width: '100%'}} />
                      </div>
                      <div>
                         <label className="ui-static-7e5eaaca0d" >Device Name</label>
                         <input type="text" list="service-devices" className="input-field ui-static-ce5f724e09" value={hop.deviceName} onChange={e => handleHopChange(i, 'deviceName', e.target.value)} style={{width: '100%'}} />
                      </div>
                      <div>
                         <label className="ui-static-7e5eaaca0d" >Port Name</label>
                         <input type="text" list="service-ports" className="input-field ui-static-ce5f724e09" value={hop.portName} onChange={e => handleHopChange(i, 'portName', e.target.value)} style={{width: '100%'}} />
                      </div>
                      <div>
                         <label className="ui-static-7e5eaaca0d" >Description (XC)</label>
                         <input type="text" className="input-field ui-static-ce5f724e09" value={hop.description || ''} onChange={e => handleHopChange(i, 'description', e.target.value)} style={{width: '100%'}} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : service.hops && service.hops.length > 0 ? (
              <div className="ui-static-19ec31c049" style={{position: 'relative'}}>
                {/* Vertical Line Connector */}
                <div className="ui-static-b3d82d4be4" style={{position: 'absolute', top: '10px', bottom: '20px', left: '11px', width: '2px', zIndex: 0}}></div>
                
                <div className="ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1}}>
                  {service.hops.map((hop, i) => (
                    <div key={hop.id} style={{ position: 'relative' }}>
                      <div className="ui-static-6f23525f4e" style={{position: 'absolute', left: '-33px', top: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {i + 1}
                      </div>
                      
                      <div className="ui-static-74c31552a0" >
                         <div className="ui-static-fc11fc4f62" style={{display: 'flex', justifyContent: 'space-between'}}>
                            <strong className="ui-static-863045cba0" >{hop.location}</strong>
                            <span className="ui-static-c51713bd7c" >Hop #{i+1}</span>
                         </div>
                         
                         <div className="ui-static-3e62d99b33" style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)'}}>
                           <div>
                             <div className="ui-static-55926e004f" style={{textTransform: 'uppercase'}}>Device / Router</div>
                             <div className="ui-static-58b8fdb785" >{hop.deviceName || '-'}</div>
                           </div>
                           <div>
                             <div className="ui-static-55926e004f" style={{textTransform: 'uppercase'}}>Port Intf</div>
                             <div className="ui-static-58b8fdb785" >{hop.portName || '-'}</div>
                           </div>
                         </div>
                         
                         {hop.description && (
                           <div className="ui-static-f6bff94344" >
                             <strong className="ui-static-bffd53f399" >Patch Notes:</strong> {hop.description}
                           </div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ui-static-e55bfb3591" style={{textAlign: 'center'}}>
                <span className="ui-static-12dae84fc3" ></span>
                <p className="ui-static-d9a4c20251" >No topological nodes bounded strictly measuring this subscription flow.</p>
              </div>
            )}
            
          </div>
        </div>

      </div>

      {/* EDIT CORE MODAL */}
      {showEditModal && (
        <div className="ui-static-a809d66476" style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'}}>
          <div className="bg-white-card scale-in ui-static-239a0228f6" style={{width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h2 className="ui-static-1c88149a3f" >Edit Asset Details</h2>
            <form onSubmit={handleSaveCore}>
               <div className="ui-static-3e8220669e" >
                 <label htmlFor="edit-service-cid" className="ui-static-ffdc3ed5d1" style={{display: 'block'}}>CID layanan / link</label>
                 <input id="edit-service-cid" type="text" maxLength={100} className="input-field ui-static-b52e2fe28a" value={editData.cid} onChange={e => setEditData({ ...editData, cid: e.target.value })} style={{width: '100%'}} />
               </div>
               <div className="ui-static-3e8220669e" >
                 <label className="ui-static-abe0244be5" style={{display: 'block'}}>Service Name / Alias</label>
                 <input type="text" required className="input-field ui-static-b52e2fe28a" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{width: '100%'}} />
               </div>
               
               <div className="ui-static-8bd9dc7312" >
                 <label htmlFor="edit-service-company" className="ui-static-eea8f0a130" style={{display: 'block'}}>Perusahaan layanan</label>
                 <select id="edit-service-company" required className="input-field ui-static-b52e2fe28a" value={editData.company} onChange={e=>setEditData({...editData,company:e.target.value})} style={{width:'100%'}}><option value="">Pilih perusahaan</option><option value="ION">ION</option><option value="SDC">SDC</option></select>
               </div>
               <div className="ui-static-8bd9dc7312" >
                 <label className="ui-static-eea8f0a130" style={{display: 'block'}}>Operational Status</label>
                 <select className="input-field ui-static-b52e2fe28a" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} style={{width: '100%'}}>
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Terminated">Terminated</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
                 </select>
               </div>

               <div className="ui-static-3e8220669e" >
                 <CapacityInput id="edit-service-capacity" unit={isDarkFiber(service.template)?'pair':'Gbps'} value={isDarkFiber(service.template)?editData.customData.pairCount??readPairCount(service)??1:(Object.hasOwn(editData.customData,'bandwidthMbps')?editData.customData.bandwidthMbps:readServiceBandwidthMbps(service))==null?'':(Object.hasOwn(editData.customData,'bandwidthMbps')?editData.customData.bandwidthMbps:readServiceBandwidthMbps(service))/1000} onChange={e=>setEditData({...editData,customData:{...editData.customData,...(isDarkFiber(service.template)?{pairCount:e.target.value===''?'':Number(e.target.value)}:{bandwidthMbps:e.target.value===''?null:Number(e.target.value)*1000})}})}/>

                 <small>Isi kapasitas saat ini sebelum membuat tiket Upgrade/Downgrade jika data lama belum memiliki satuan yang jelas.</small>
               </div>
               {templateFields.length > 0 && (
                 <div className="ui-static-d6cf051c1a" >
                   <h4 className="ui-static-980d0fe234" >Technical Parameters</h4>
                   <div className="ui-static-af81cc4264" style={{display: 'flex', flexDirection: 'column'}}>
                     {templateFields.filter(f=>!isPlaceholderField(f.name)&&!isPairField(f.name)&&(!isDarkFiber(service.template)||!isBandwidthField(f.name))).map((f, i) => (
                       <div key={i}>
                         <label className="ui-static-5828b8b2e5" style={{display: 'block'}}>{f.name}</label>
                         <input 
                           type={f.type === 'number' ? 'number' : 'text'} 
                           className="input-field ui-static-ce5f724e09"
                           value={editData.customData[f.name] || ''} 
                           onChange={e => setEditData({ ...editData, customData: { ...editData.customData, [f.name]: e.target.value } })} 
                           style={{width: '100%'}}
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               <div className="ui-static-af81cc4264" style={{display: 'flex', justifyContent: 'flex-end'}}>
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
            <div className="sla-print-meta ui-static-3bfe860463" >Problem side ION Network</div>

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

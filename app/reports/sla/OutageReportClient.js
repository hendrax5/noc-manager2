'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { outageCsv, outageDate, outageDuration, parseOutageFilters } from '@/lib/reports/outageReport';
import styles from './OutageReport.module.css';

const operators = [['all', 'Semua durasi'], ['gt', 'Lebih dari (>)'], ['gte', 'Minimal (≥)'], ['lt', 'Kurang dari (<)'], ['lte', 'Maksimal (≤)']];
const statuses = [['all', 'Semua'], ['ongoing', 'Berjalan'], ['finished', 'Selesai']];

function Criteria({ filters }) {
  return <>{filters.startDate} s/d {filters.endDate} · {filters.customer || 'Semua customer'} · {filters.cid ? `CID: ${filters.cid}` : 'Semua CID'} · Penyebab: {filters.cause || 'Semua'} · Gejala: {filters.symptom || 'Semua'} · {filters.durationOperator === 'all' ? 'Semua durasi' : `${operators.find(([value]) => value === filters.durationOperator)?.[1]} ${filters.durationHours} jam per tiket`} · Status gangguan: {statuses.find(([value]) => value === filters.outageStatus)?.[1]}{filters.search && ` · Cari: ${filters.search}`}</>;
}

function OutageTable({ rows, print = false }) {
  return <div className={styles.tableWrap}><table className={styles.table}>
    <caption className={styles.srOnly}>Daftar gangguan, satu baris untuk setiap tiket. Semua waktu dalam WIB.</caption>
    <thead><tr><th scope="col">Tiket / Customer</th><th scope="col">Layanan / CID</th><th scope="col">Mulai / Selesai (WIB)</th><th scope="col">Durasi per tiket</th><th scope="col">Gejala / Penyebab</th><th scope="col">Tindakan / Status</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.dbId}>
      <td>{print ? <strong>{row.trackingId}</strong> : <Link href={`/tickets/${row.dbId}`}>{row.trackingId}</Link>}<strong>{row.customer}</strong><span className={styles.secondary}>{row.title}</span></td>
      <td>{row.services}</td>
      <td className={styles.dates}>{outageDate(row.startAt)}<span className={styles.secondary}>{row.endAt ? outageDate(row.endAt) : 'Masih berjalan *'}</span></td>
      <td className={styles.duration}>{outageDuration(row.downtimeMinutes)}{row.ongoing && ' *'}</td>
      <td><div className={print ? undefined : styles.longText}>{row.cause}</div><small className={styles.secondary}>{row.symptom}</small><small className={styles.secondary}>{row.causeSource}</small></td>
      <td><div className={print ? undefined : styles.longText}>{row.action}</div><span className={styles.badge}>{row.ongoing ? 'Gangguan berjalan' : 'Gangguan selesai'}</span><small className={styles.secondary}>Status tiket: {row.status}</small></td>
    </tr>)}</tbody>
  </table></div>;
}

export default function OutageReportClient() {
  const [draft, setDraft] = useState(() => parseOutageFilters({}));
  const [applied, setApplied] = useState(draft);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const previewRef = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!preview) return;
    const section = previewRef.current;
    if (!section) return;
    section.scrollIntoView({ block: 'start' });
    section.focus();
  }, [preview]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setReport(null);
      try {
        const response = await fetch(`/api/reports/outages?${new URLSearchParams(applied)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Gagal memuat laporan gangguan.');
        if (!controller.signal.aborted) setReport(body);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [applied]);

  function apply(event) {
    event.preventDefault();
    try {
      const next = parseOutageFilters(draft);
      setDraft(next);
      setApplied(next);
      setPreview(false);
      setNotice('');
    } catch (err) { setError(err.message); }
  }

  function reset() {
    const next = parseOutageFilters({});
    setDraft(next);
    setApplied(next);
    setPreview(false);
    setNotice('');
  }

  function exportCsv() {
    if (!report?.rows.length || loading) return;
    const url = URL.createObjectURL(new Blob([outageCsv(report.rows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Gangguan_per_tiket_${report.filters.startDate}_${report.filters.endDate}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('CSV berhasil diekspor sesuai kriteria hasil yang ditampilkan.');
  }

  return <div className={styles.root}>
    <section className={`card no-print ${styles.filterPanel}`} aria-labelledby="outage-filter-title">
      <div className={styles.sectionHeading}><div><h2 id="outage-filter-title">Kriteria laporan gangguan</h2><p>Satu baris = satu tiket. Durasi antar tiket tidak digabung.</p></div><span className={styles.badge}>Sumber: downtime tiket</span></div>
      <form onSubmit={apply}>
        <div className={styles.fields}>
          <label>Mulai gangguan dari<input required type="date" value={draft.startDate} onChange={(e) => update('startDate', e.target.value)} /></label>
          <label>Sampai tanggal<input required type="date" min={draft.startDate} value={draft.endDate} onChange={(e) => update('endDate', e.target.value)} /></label>
          <label>Customer<input type="search" maxLength={200} value={draft.customer} placeholder="Semua customer / ketik nama" onChange={(e) => update('customer', e.target.value)} /><small>Dicocokkan dengan customer layanan atau field customer tiket lama.</small></label>
          <label>CID / layanan<input type="search" maxLength={100} value={draft.cid || ''} placeholder="Semua CID / SAP-C-…" onChange={(e) => update('cid', e.target.value)} /><small>Jika diisi, laporan menampilkan satu baris per CID tersebut saja.</small></label>
          <label>Penyebab / jenis masalah<input type="search" maxLength={200} value={draft.cause} placeholder="Semua / FO CUT / listrik" onChange={(e) => update('cause', e.target.value)} /><small>Tiket lama: pencarian juga memakai judul/deskripsi.</small></label>
          <label>Gejala<input type="search" maxLength={200} value={draft.symptom || ''} placeholder="Semua / Down / Packet Loss" onChange={(e) => update('symptom', e.target.value)} /></label>
          <label>Cari tiket / CID / link<input type="search" maxLength={200} value={draft.search} placeholder="Nomor tiket, CID, atau nama link" onChange={(e) => update('search', e.target.value)} /></label>
        </div>
        <div className={styles.ruleGrid}>
          <fieldset><legend>Durasi downtime per tiket</legend><div className={styles.choices}>{operators.map(([value, label]) => <label key={value}><input type="radio" name="outage-duration" value={value} checked={draft.durationOperator === value} onChange={() => update('durationOperator', value)} />{label}</label>)}</div><label className={styles.hours}>Durasi <input type="number" min="0" step="any" required={draft.durationOperator !== 'all'} disabled={draft.durationOperator === 'all'} value={draft.durationHours} onChange={(e) => update('durationHours', e.target.value)} /> jam</label></fieldset>
          <fieldset><legend>Status gangguan</legend><div className={styles.choices}>{statuses.map(([value, label]) => <label key={value}><input type="radio" name="outage-status" value={value} checked={draft.outageStatus === value} onChange={() => update('outageStatus', value)} />{label}</label>)}</div><p>Status berdasarkan ada/tidaknya waktu selesai downtime, terpisah dari status alur tiket.</p></fieldset>
        </div>
        <div className={styles.filterFooter}><div className={styles.actions}><button type="button" className="secondary-btn" onClick={() => setDraft((current) => ({ ...current, cause: 'FO CUT', durationOperator: 'gt', durationHours: 10 }))}>Isi kriteria FO CUT &gt;10 jam</button><small>Periode mengikuti waktu mulai gangguan. Durasi penuh tiket tetap dipakai meski melewati periode.</small></div><div className={styles.actions}><button className="secondary-btn" type="button" onClick={reset} disabled={loading}>Reset</button><button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Memuat…' : 'Terapkan filter'}</button></div></div>
      </form>
    </section>
    {dirty && <p className={`no-print ${styles.message}`} role="status">Kriteria berubah. Tekan Terapkan filter untuk memperbarui hasil dan laporan.</p>}
    {error && <p className={`no-print ${styles.error}`} role="alert">{error}</p>}
    {notice && <p className={`no-print ${styles.message}`} role="status">{notice}</p>}
    {loading && <p className={`no-print ${styles.message}`} role="status">Memuat data gangguan per tiket…</p>}
    {report && !loading && <>
      <div className={`no-print ${styles.metrics}`} aria-label="Ringkasan hasil pencarian"><div><strong>{report.summary.tickets}</strong><span>Tiket sesuai kriteria</span></div><div><strong>{report.summary.customers}</strong><span>Customer tercatat terdampak</span></div><div><strong>{outageDuration(report.summary.longestMinutes)}</strong><span>Gangguan terlama per tiket</span></div><div><strong>{report.summary.ongoing}</strong><span>Masih berjalan</span></div></div>
      {report.summary.invalidDowntime > 0 && <p className={`no-print ${styles.message}`}>{report.summary.invalidDowntime} catatan downtime tidak valid dilewati. Periksa waktu mulai/selesai pada tiket.</p>}
      <section className={`card no-print ${styles.results}`} aria-labelledby="outage-results-title">
        <div className={styles.sectionHeading}><div><h2 id="outage-results-title">Hasil pencarian gangguan</h2><p>{report.rows.length} tiket · diurutkan berdasarkan durasi terlama</p></div><div className={styles.actions}><button type="button" className="secondary-btn" onClick={exportCsv} disabled={!report.rows.length}>Ekspor CSV</button><button type="button" className="primary-btn" onClick={() => setPreview(!preview)}>{preview ? 'Tutup pratinjau' : 'Pratinjau laporan'}</button></div></div>
        <p className={styles.criteria}><Criteria filters={report.filters} /></p>
        {report.rows.length ? <OutageTable rows={report.rows} /> : <p className={styles.empty}>Tidak ada tiket yang sesuai. Ubah customer, penyebab, periode, atau batas durasi.</p>}
        <p className={styles.footnote}>Waktu WIB. * Gangguan berjalan dihitung sampai {outageDate(report.generatedAt)}. Penyebab dan tindakan dapat diperiksa melalui tautan tiket.</p>
      </section>
      <p className={`no-print ${styles.footnote}`}>Laporan ini menyeleksi gangguan per tiket. Availability dan target SLA periodik tetap tersedia di tab SLA periodik.</p>
      {preview && <section ref={previewRef} tabIndex={-1} className={styles.preview} aria-labelledby="outage-preview-title">
        <div className={`no-print ${styles.sectionHeading}`}><h2 id="outage-preview-title">Pratinjau laporan cetak</h2><button type="button" className="primary-btn" onClick={() => window.print()}>Cetak / Simpan PDF</button></div>
        <article className={`sla-letter ${styles.letter}`}>
          <header><div className={styles.ionHeader}><img src="/ion-logo.png" alt="Logo ION Network" width="110" height="54" /><div><strong>ION NETWORK</strong><p>PT PARSAORAN GLOBAL DATATRANS</p></div></div><h2>Laporan penanganan gangguan</h2><p><Criteria filters={report.filters} /></p><p className={styles.footnote}>Dibuat {outageDate(report.generatedAt)} WIB</p></header>
          <h3>1. Ringkasan</h3><p>Terdapat {report.summary.tickets} tiket sesuai kriteria, dengan {report.summary.customers} customer tercatat terdampak dan {report.summary.ongoing} gangguan masih berjalan. Gangguan terlama per tiket: {outageDuration(report.summary.longestMinutes)}.</p><p>Durasi dihitung terpisah pada setiap tiket berdasarkan waktu mulai dan selesai downtime, tanpa akumulasi beberapa kejadian.</p>
          <h3>2. Daftar gangguan</h3>{report.rows.length ? <OutageTable rows={report.rows} print /> : <p>Tidak ada tiket sesuai kriteria.</p>}
          <p className={styles.footnote}>Seluruh waktu dalam WIB. * Gangguan berjalan dihitung sampai waktu pembuatan laporan. Periode memilih waktu mulai gangguan; durasi yang ditampilkan adalah durasi penuh tiket. Penyebab dari judul/deskripsi tiket lama perlu dikonfirmasi pada tiket sumber.</p>
          {report.summary.invalidDowntime > 0 && <p className={styles.footnote}>{report.summary.invalidDowntime} catatan downtime tidak valid dilewati.</p>}
          <h3>3. Pengesahan</h3><div className={styles.signatures}><div>Disusun oleh<span>NOC / Tim Teknis</span></div><div>Disetujui oleh<span>Manajemen</span></div></div>
        </article>
      </section>}
    </>}
  </div>;
}

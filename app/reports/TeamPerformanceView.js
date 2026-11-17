'use client';
import {useMemo, useState} from 'react';
import styles from './kinerja.module.css';
import {
  fmtEvalStatus,
  fmtMinutes,
  fmtMonthShort,
  fmtNumber,
  fmtPercent,
  fmtSigned,
  formatDeltaBadge,
  polarityClass,
  trendDirectionMeta,
} from './kinerjaFormat';
import {TrendSeriesPanel, TrendSparkline} from './TrendCharts';

function sortIndicator(activeKey, key, dir) {
  if (activeKey !== key) return '';
  return dir === 'asc' ? ' ▲' : ' ▼';
}

function nextAriaSort(activeKey, key, dir) {
  if (activeKey !== key) return 'none';
  return dir === 'asc' ? 'ascending' : 'descending';
}

export default function TeamPerformanceView({
  overview,
  month,
  compareMonth,
  trendMonths,
  department,
  company,
  onDepartmentChange,
  onCompanyChange,
  onSelectMember,
  onReload,
}) {
  const [search, setSearch] = useState('');
  const [trendFilter, setTrendFilter] = useState('all');
  const [sparkMetric, setSparkMetric] = useState('resolved');
  const [sortBy, setSortBy] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  const baseRows = useMemo(
    () =>
      (overview?.rows || []).filter(
        r =>
          (!department || String(r.departmentId) === department) &&
          (!company || r.company === company),
      ),
    [overview?.rows, department, company],
  );

  const highlights = overview?.highlights || {topImprovers: [], needsAttention: []};
  const attentionIdSet = useMemo(
    () => new Set((highlights.needsAttention || []).map(item => item.userId)),
    [highlights.needsAttention],
  );

  const counts = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const r of baseRows) {
      if (r.trendDirection === 'up') up += 1;
      if (r.trendDirection === 'down') down += 1;
    }
    return {all: baseRows.length, up, down, attention: attentionIdSet.size};
  }, [baseRows, attentionIdSet]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = baseRows.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q) && !(r.department || '').toLowerCase().includes(q)) {
        return false;
      }
      if (trendFilter === 'up') return r.trendDirection === 'up';
      if (trendFilter === 'down') return r.trendDirection === 'down';
      if (trendFilter === 'attention') return attentionIdSet.has(r.userId);
      return true;
    });

    const dirMul = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'name':
          diff = (a.name || '').localeCompare(b.name || '');
          break;
        case 'resolved':
          diff = (a.resolved || 0) - (b.resolved || 0);
          break;
        case 'response': {
          const av = a.medianResponseMinutes ?? (sortDir === 'asc' ? Number.MAX_SAFE_INTEGER : -1);
          const bv = b.medianResponseMinutes ?? (sortDir === 'asc' ? Number.MAX_SAFE_INTEGER : -1);
          diff = av - bv;
          break;
        }
        case 'sla':
          diff = (a.slaCleanPct ?? -1) - (b.slaCleanPct ?? -1);
          break;
        case 'score':
          diff = (a.score || 0) - (b.score || 0);
          break;
        case 'trend': {
          const order = {up: 4, new: 3, flat: 2, inactive: 1, down: 0};
          diff = (order[a.trendDirection] ?? 1) - (order[b.trendDirection] ?? 1);
          break;
        }
        case 'points':
        default:
          diff = (a.points || 0) - (b.points || 0);
          break;
      }
      if (diff !== 0) return diff * dirMul;
      return (b.points || 0) - (a.points || 0) || (a.userId || 0) - (b.userId || 0);
    });
  }, [baseRows, search, trendFilter, attentionIdSet, sortBy, sortDir]);

  function toggleSort(key) {
    if (sortBy === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'name' || key === 'response' ? 'asc' : 'desc');
    }
  }

  const teamSummary = overview?.teamSummary;
  const resolvedDelta = formatDeltaBadge(teamSummary?.resolved?.delta, {kind: 'count'});
  const pointsDelta = formatDeltaBadge(teamSummary?.points?.delta, {kind: 'count'});
  const respDelta = formatDeltaBadge(teamSummary?.medianResponseMinutes?.delta, {kind: 'minutes'});
  const slaDelta = formatDeltaBadge(teamSummary?.slaCleanPct?.delta, {kind: 'pp'});

  const readiness = overview?.readiness;
  const cmpLabel = fmtMonthShort(compareMonth || overview?.previousMonth);
  const curLabel = fmtMonthShort(month);

  return (
    <section aria-labelledby="team-perf-heading">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="team-perf-heading">Performa Tim ({curLabel})</h2>
          <p className={styles.sectionNote}>
            Perbandingan operasional terhadap {cmpLabel} serta tren {trendMonths} bulan terakhir.
          </p>
        </div>
      </div>

      {readiness && readiness.ready === 0 && (
        <details className={styles.readinessBar}>
          <summary>
            <span className={styles.readinessSummaryText}>
              <strong>Nilai formal belum dapat dihitung</strong>
              <span className={styles.sectionNote}>
                Penempatan penuh {readiness.assigned}/{readiness.users} anggota · Kebijakan {readiness.withPolicy}/{readiness.users}
              </span>
            </span>
            <span className={styles.readinessSummaryToggle}>Lihat detail kalibrasi</span>
          </summary>
          <div className={styles.readinessDetail}>
            <p className={styles.sectionNote}>
              Evaluasi formal membutuhkan penempatan sebulan penuh, kebijakan yang dipublikasikan, konteks jadwal, dan bukti yang direview. Data operasional di bawah tetap dihitung dari tiket, respons, poin, dan SLA nyata.
            </p>
            <dl className={styles.setupCounts}>
              <div>
                <dt>Penempatan</dt>
                <dd>{readiness.assigned}/{readiness.users}</dd>
              </div>
              <div>
                <dt>Kebijakan</dt>
                <dd>{readiness.withPolicy}/{readiness.users}</dd>
              </div>
              <div>
                <dt>Konteks jadwal</dt>
                <dd>{readiness.withContext}/{readiness.users}</dd>
              </div>
              <div>
                <dt>Bukti direview</dt>
                <dd>{readiness.reviewedActivities}</dd>
              </div>
            </dl>
            {readiness.topReasons?.length > 0 && (
              <ul>
                {readiness.topReasons.map(reason => (
                  <li key={reason.text}>
                    {reason.text} <small>({reason.count} anggota)</small>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.setupActions}>
              <a href="/settings/evaluation">Atur aturan evaluasi</a>
              <a href={`/reports/evaluations?month=${month}`}>Review bukti</a>
              <a href="/reports/daily">Isi laporan harian</a>
            </p>
          </div>
        </details>
      )}

      {/* 4 Executive Team KPI Cards */}
      <div className={styles.kpiGrid} role="region" aria-label="Ringkasan KPI operasional tim">
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Tiket selesai</span>
          <strong className={styles.kpiValue}>
            {fmtNumber(teamSummary?.resolved?.current ?? overview?.activitySummary?.resolved ?? 0, 0)}
          </strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, resolvedDelta.polarity)}`}>
            {resolvedDelta.text}
          </span>
          <span className={styles.kpiSub}>
            Rata-rata {fmtNumber(teamSummary?.resolved?.perMember ?? 0)} per anggota vs {cmpLabel}
          </span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Poin kontribusi</span>
          <strong className={styles.kpiValue}>
            {fmtNumber(teamSummary?.points?.current ?? overview?.activitySummary?.points ?? 0, 0)}
          </strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, pointsDelta.polarity)}`}>
            {pointsDelta.text}
          </span>
          <span className={styles.kpiSub}>
            Rata-rata {fmtNumber(teamSummary?.points?.perMember ?? 0)} poin per anggota
          </span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Median respons pertama</span>
          <strong className={styles.kpiValue}>
            {fmtMinutes(teamSummary?.medianResponseMinutes?.current)}
          </strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, respDelta.polarity)}`}>
            {respDelta.text}
          </span>
          <span className={styles.kpiSub}>
            {teamSummary?.medianResponseMinutes?.sampleCount
              ? `Dari ${teamSummary.medianResponseMinutes.sampleCount} tiket selesai`
              : 'Menunggu sampel respons tiket'}
          </span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Kepatuhan SLA</span>
          <strong className={styles.kpiValue}>
            {fmtPercent(teamSummary?.slaCleanPct?.current)}
          </strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, slaDelta.polarity)}`}>
            {slaDelta.text}
          </span>
          <span className={styles.kpiSub}>
            {teamSummary?.slaCleanPct?.totalCount
              ? `${teamSummary.slaCleanPct.cleanCount}/${teamSummary.slaCleanPct.totalCount} tiket bebas pelanggaran`
              : 'Belum ada tiket selesai'}
          </span>
        </article>
      </div>

      {/* Automatic Team Highlights Strip */}
      <div className={styles.highlightsGrid}>
        <section className={styles.highlightPanel} aria-labelledby="highlight-improvers-title">
          <div className={styles.highlightHeader}>
            <h3 id="highlight-improvers-title">Paling Meningkat</h3>
            <span className={`${styles.deltaBadge} ${styles.polarityImproved}`}>
              {highlights.topImprovers?.length || 0} anggota
            </span>
          </div>
          {!highlights.topImprovers?.length ? (
            <p className={styles.sectionNote}>
              Belum ada kenaikan signifikan yang memenuhi ambang sampel minimum pada filter ini.
            </p>
          ) : (
            <ul className={styles.highlightList}>
              {highlights.topImprovers.map(item => (
                <li className={styles.highlightItem} key={item.userId}>
                  <div className={styles.highlightMeta}>
                    <strong>{item.name}</strong>
                    <small>{item.department || '—'} · {item.reasons.join(' · ')}</small>
                  </div>
                  <button
                    type="button"
                    className={styles.highlightBtn}
                    onClick={() => onSelectMember(item.userId)}
                  >
                    Rincian
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.highlightPanel} aria-labelledby="highlight-attention-title">
          <div className={styles.highlightHeader}>
            <h3 id="highlight-attention-title">Perlu Perhatian</h3>
            <span className={`${styles.deltaBadge} ${highlights.needsAttention?.length ? styles.polarityWarning : styles.polarityNeutral}`}>
              {highlights.needsAttention?.length || 0} anggota
            </span>
          </div>
          {!highlights.needsAttention?.length ? (
            <p className={styles.sectionNote}>
              Tidak ditemukan penurunan volume tajam, pelambatan respons, atau pelanggaran SLA signifikan.
            </p>
          ) : (
            <ul className={styles.highlightList}>
              {highlights.needsAttention.map(item => (
                <li className={styles.highlightItem} key={item.userId}>
                  <div className={styles.highlightMeta}>
                    <strong>{item.name}</strong>
                    <small>{item.department || '—'} · {item.reasons.join(' · ')}</small>
                  </div>
                  <button
                    type="button"
                    className={styles.highlightBtn}
                    onClick={() => onSelectMember(item.userId)}
                  >
                    Periksa
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Filters & Quick Direction Pills */}
      <div className={styles.toolbar}>
        <label>
          Departemen
          <select aria-label="Departemen" value={department} onChange={e => onDepartmentChange(e.target.value)}>
            <option value="">Semua dalam akses saya</option>
            {(overview?.departments || []).map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Perusahaan penempatan
          <select aria-label="Perusahaan penempatan" value={company} onChange={e => onCompanyChange(e.target.value)}>
            <option value="">Semua dalam akses saya</option>
            {(overview?.companies || []).map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cari anggota
          <input
            aria-label="Cari anggota"
            type="search"
            placeholder="Nama atau departemen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <label>
          Metrik sparkline
          <select aria-label="Metrik sparkline" value={sparkMetric} onChange={e => setSparkMetric(e.target.value)}>
            <option value="resolved">Tiket selesai</option>
            <option value="points">Poin kontribusi</option>
            <option value="medianResponseMinutes">Median respons</option>
            <option value="slaCleanPct">Tepat SLA %</option>
          </select>
        </label>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.pillGroup} role="group" aria-label="Filter arah performa anggota">
          <button type="button" className={styles.pillBtn} aria-pressed={trendFilter === 'all'} onClick={() => setTrendFilter('all')}>
            Semua ({counts.all})
          </button>
          <button type="button" className={styles.pillBtn} aria-pressed={trendFilter === 'up'} onClick={() => setTrendFilter('up')}>
            Naik ({counts.up})
          </button>
          <button type="button" className={styles.pillBtn} aria-pressed={trendFilter === 'down'} onClick={() => setTrendFilter('down')}>
            Turun ({counts.down})
          </button>
          <button type="button" className={styles.pillBtn} aria-pressed={trendFilter === 'attention'} onClick={() => setTrendFilter('attention')}>
            Perlu Perhatian ({counts.attention})
          </button>
        </div>
        <span className={styles.sectionNote}>
          Menampilkan {visibleRows.length} dari {baseRows.length} anggota
        </span>
      </div>

      {/* Member Performance Table */}
      <div className={styles.tableWrap} role="region" aria-label="Tabel performa anggota tim" tabIndex={0}>
        <table>
          <caption>
            Performa operasional anggota ({curLabel} vs {cmpLabel})
          </caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'name', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('name')}>
                  Anggota & Tim{sortIndicator(sortBy, 'name', sortDir)}
                </button>
              </th>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'trend', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('trend')}>
                  Arah{sortIndicator(sortBy, 'trend', sortDir)}
                </button>
              </th>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'resolved', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('resolved')}>
                  Tiket Selesai{sortIndicator(sortBy, 'resolved', sortDir)}
                </button>
              </th>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'points', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('points')}>
                  Poin{sortIndicator(sortBy, 'points', sortDir)}
                </button>
              </th>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'response', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('response')}>
                  Median Respons{sortIndicator(sortBy, 'response', sortDir)}
                </button>
              </th>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'sla', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('sla')}>
                  Tepat SLA{sortIndicator(sortBy, 'sla', sortDir)}
                </button>
              </th>
              <th scope="col">Tren {trendMonths} Bln</th>
              <th scope="col" aria-sort={nextAriaSort(sortBy, 'score', sortDir)}>
                <button type="button" className={styles.sortBtn} onClick={() => toggleSort('score')}>
                  {readiness?.ready > 0 ? 'Nilai / Skor' : 'Skor Cohort'}{sortIndicator(sortBy, 'score', sortDir)}
                </button>
              </th>
              <th scope="col">Rincian</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => {
              const dirMeta = trendDirectionMeta(row.trendDirection);
              const dRes = formatDeltaBadge(row.deltas?.resolved, {kind: 'count'});
              const dPts = formatDeltaBadge(row.deltas?.points, {kind: 'count'});
              const dResp = formatDeltaBadge(row.deltas?.medianResponseMinutes, {kind: 'minutes'});
              const dSla = formatDeltaBadge(row.deltas?.slaCleanPct, {kind: 'pp'});

              return (
                <tr key={row.userId}>
                  <th scope="row">
                    <span className={styles.cellMain}>{row.name}</span>
                    <span className={styles.cellSub}>
                      {row.department || '—'} · {row.company || 'Belum dipetakan'}
                    </span>
                  </th>
                  <td>
                    <span className={`${styles.deltaBadge} ${polarityClass(styles, dirMeta.polarity)}`}>
                      {dirMeta.label}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellMain}>{fmtNumber(row.resolved ?? 0, 0)}</span>
                    <span
                      className={`${styles.cellSub} ${
                        dRes.polarity === 'improved'
                          ? styles.cellSubImproved
                          : dRes.polarity === 'declined'
                            ? styles.cellSubDeclined
                            : ''
                      }`}
                    >
                      {row.deltas ? dRes.text : `Respons: ${fmtNumber(row.responses ?? 0, 0)}`}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellMain}>{fmtNumber(row.points ?? 0, 0)}</span>
                    <span
                      className={`${styles.cellSub} ${
                        dPts.polarity === 'improved'
                          ? styles.cellSubImproved
                          : dPts.polarity === 'declined'
                            ? styles.cellSubDeclined
                            : ''
                      }`}
                    >
                      {row.deltas ? dPts.text : 'Poin periode ini'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellMain}>{fmtMinutes(row.medianResponseMinutes)}</span>
                    <span
                      className={`${styles.cellSub} ${
                        dResp.polarity === 'improved'
                          ? styles.cellSubImproved
                          : dResp.polarity === 'declined'
                            ? styles.cellSubDeclined
                            : ''
                      }`}
                    >
                      {row.deltas ? dResp.text : 'Belum ada pembanding'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cellMain}>{fmtPercent(row.slaCleanPct)}</span>
                    <span
                      className={`${styles.cellSub} ${
                        dSla.polarity === 'improved'
                          ? styles.cellSubImproved
                          : dSla.polarity === 'declined'
                            ? styles.cellSubDeclined
                            : ''
                      }`}
                    >
                      {row.deltas ? dSla.text : '—'}
                    </span>
                  </td>
                  <td>
                    <TrendSparkline
                      series={row.trend || []}
                      metricKey={sparkMetric}
                      direction={row.trendDirection}
                      memberName={row.name}
                    />
                  </td>
                  <td>
                    {readiness?.ready > 0 ? (
                      <>
                        <span className={styles.cellMain}>{fmtNumber(row.total)}</span>
                        <span className={styles.cellSub}>
                          {fmtEvalStatus(row.reviewState || row.status)} · Skor {fmtNumber(row.score ?? 0)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.cellMain}>{fmtNumber(row.score ?? 0)}</span>
                        <span className={styles.cellSub}>Peringkat #{row.rank ?? '—'}</span>
                      </>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => onSelectMember(row.userId)}
                    >
                      Lihat kinerja {row.name}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!visibleRows.length && <p className={styles.sectionNote}>Belum ada anggota dalam filter ini.</p>}

      {overview?.trendSeries?.length > 0 && (
        <div className={styles.sectionBlock}>
          <TrendSeriesPanel
            series={overview.trendSeries}
            title={`Tren agregat tim (${trendMonths} bulan terakhir)`}
          />
        </div>
      )}

      {overview?.comparison?.length > 0 && (
        <section className={styles.sectionBlock} aria-labelledby="kinerja-comparison-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="kinerja-comparison-title">Perbandingan antar departemen ({curLabel} vs {cmpLabel})</h3>
              <p className={styles.sectionNote}>
                Skor relatif dihitung ulang per kelompok tiap bulan; utamakan selisih tiket, poin per anggota, dan kecepatan respons.
              </p>
            </div>
          </div>
          <div className={styles.tableWrap} role="region" aria-label="Perbandingan aktivitas dengan periode pembanding" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Tim</th>
                  <th scope="col">Anggota</th>
                  <th scope="col">Tiket/anggota ({curLabel})</th>
                  <th scope="col">Δ tiket</th>
                  <th scope="col">Poin/anggota ({curLabel})</th>
                  <th scope="col">Δ poin</th>
                  <th scope="col">Skor {cmpLabel} → {curLabel}</th>
                  <th scope="col">Δ skor</th>
                </tr>
              </thead>
              <tbody>
                {overview.comparison.map(row => (
                  <tr key={row.departmentId + ':' + (row.company || '')}>
                    <th scope="row">
                      <span className={styles.cellMain}>{row.department}</span>
                      <span className={styles.cellSub}>{row.company || 'Belum dipetakan'}</span>
                    </th>
                    <td>{row.members}</td>
                    <td>{fmtNumber(row.currentResolved)}</td>
                    <td>{row.previousActive ? fmtSigned(row.resolvedDelta) : '—'}</td>
                    <td>{fmtNumber(row.currentPoints)}</td>
                    <td>{row.previousActive ? fmtSigned(row.pointsDelta) : '—'}</td>
                    <td>
                      {row.previousActive ? fmtNumber(row.previousScore) : 'Belum ada'} → {fmtNumber(row.currentScore)}
                    </td>
                    <td>{row.previousActive ? fmtSigned(row.scoreDelta) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {readiness?.ready > 0 && (
        <p className={styles.sectionNote}>
          {baseRows.filter(r => r.total != null).length} dari {baseRows.filter(r => r.status !== 'excluded').length} anggota memiliki nilai formal.
        </p>
      )}

      {overview?.canPublish && department && company && (
        <PublishCohort
          month={month}
          departmentId={Number(department)}
          company={company}
          expectedVersion={
            overview.groups?.find(g => String(g.departmentId) === department && g.company === company)?.publicationVersion || 0
          }
          onSaved={onReload}
        />
      )}
    </section>
  );
}

function PublishCohort({month, departmentId, company, expectedVersion, onSaved}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className={styles.review}
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const r = await fetch('/api/reports/kinerja/publications?month=' + month, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({departmentId, company, expectedVersion}),
          });
          const b = await r.json();
          if (!r.ok) throw Error(b.error);
          onSaved();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <input type="checkbox" required checked={confirm} onChange={e => setConfirm(e.target.checked)} /> Seluruh anggota dalam kelompok ini telah direview dan hasilnya siap dipublikasikan.
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Mempublikasikan…' : 'Publikasikan peringkat resmi'}
      </button>
    </form>
  );
}

'use client';
import {useMemo, useState} from 'react';
import styles from './kinerja.module.css';
import {
  fmtEvalStatus,
  fmtMinutes,
  fmtMonthShort,
  fmtNumber,
  fmtPercent,
  formatDeltaBadge,
  polarityClass,
  trendDirectionMeta,
} from './kinerjaFormat';
import {TrendSeriesPanel} from './TrendCharts';

const PILLAR_DEFS = [
  {
    id: 'speed',
    label: 'Kecepatan & SLA',
    keys: new Set(['first_response', 'accountable_time', 'resolution_total', 'followup', 'ticket_ontime', 'ticket_no_breach']),
  },
  {
    id: 'output',
    label: 'Output & Penyelesaian',
    keys: new Set(['tickets_resolved', 'completed_phases', 'phase_elapsed', 'rfs', 'bod_restoration', 'internal_responses']),
  },
  {
    id: 'discipline',
    label: 'Laporan & Kontribusi Data',
    keys: new Set(['submitted_reports', 'report_ontime', 'data_contribution', 'data_pending']),
  },
  {
    id: 'review',
    label: 'Review & Kualitas',
    keys: new Set(['quality', 'timeliness', 'report_content', 'rework']),
  },
];

function classifyPillar(key) {
  for (const pillar of PILLAR_DEFS) {
    if (pillar.keys.has(key)) return pillar.id;
  }
  return 'review';
}

function metricValueLabel(m) {
  if (m.value == null) return 'Belum tersedia';
  if (m.unit === 'menit') return fmtMinutes(m.value);
  if (m.unit === '%') return fmtPercent(m.value);
  return `${fmtNumber(m.value)}${m.unit ? ' ' + m.unit : ''}`;
}

export default function MemberDetailView({
  detail,
  month,
  compareMonth,
  trendMonths,
  canBackToTeam = false,
  onBackToTeam,
  onReload,
}) {
  const [pillarFilter, setPillarFilter] = useState('all');

  const curOp = detail.kpiHeadline?.current;
  const deltas = detail.kpiHeadline?.deltas;
  const dirMeta = trendDirectionMeta(detail.kpiHeadline?.trendDirection);

  const metricByKey = useMemo(
    () => new Map((detail.metrics || []).map(m => [m.key, m])),
    [detail.metrics],
  );

  const resolvedCount = curOp?.resolved ?? metricByKey.get('tickets_resolved')?.value ?? 0;
  const totalPoints = (detail.points?.ledger || 0) + (detail.points?.legacy || 0);
  const medianResp = curOp?.medianResponseMinutes ?? metricByKey.get('first_response')?.value ?? null;
  const slaPct = curOp?.slaCleanPct ?? metricByKey.get('ticket_no_breach')?.value ?? null;

  const dResolved = formatDeltaBadge(deltas?.resolved, {kind: 'count'});
  const dPoints = formatDeltaBadge(deltas?.points, {kind: 'count'});
  const dResp = formatDeltaBadge(deltas?.medianResponseMinutes, {kind: 'minutes'});
  const dSla = formatDeltaBadge(deltas?.slaCleanPct, {kind: 'pp'});

  const cmpLabel = fmtMonthShort(compareMonth || detail.compareMonth);
  const curLabel = fmtMonthShort(month || detail.month);

  const groupedMetrics = useMemo(() => {
    const groups = new Map(PILLAR_DEFS.map(p => [p.id, []]));
    for (const m of detail.metrics || []) {
      groups.get(classifyPillar(m.key)).push(m);
    }
    return PILLAR_DEFS.filter(p => (pillarFilter === 'all' || pillarFilter === p.id) && (groups.get(p.id)?.length || 0) > 0).map(
      p => ({...p, rows: groups.get(p.id)}),
    );
  }, [detail.metrics, pillarFilter]);

  return (
    <>
      {canBackToTeam && (
        <div className={styles.backRow}>
          <button type="button" className="secondary-btn" onClick={onBackToTeam}>
            ← Kembali ke Performa Tim
          </button>
        </div>
      )}

      <header className={styles.person}>
        <div>
          <h2>{detail.user.name}</h2>
          <p>
            {detail.user.department || 'Tanpa departemen'} · {detail.user.company || 'Perusahaan penempatan belum tervalidasi'}
          </p>
        </div>
        {detail.kpiHeadline && (
          <span className={`${styles.deltaBadge} ${polarityClass(styles, dirMeta.polarity)}`}>
            {dirMeta.label} vs {cmpLabel}
          </span>
        )}
      </header>

      {/* 4 Operational KPI Cards + Cohort & Evaluation Context Card */}
      <div className={styles.kpiGridFive} role="region" aria-label="Ringkasan KPI anggota">
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Tiket selesai ({curLabel})</span>
          <strong className={styles.kpiValue}>{fmtNumber(resolvedCount, 0)}</strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, dResolved.polarity)}`}>
            {dResolved.text}
          </span>
          <span className={styles.kpiSub}>vs {cmpLabel}: {fmtNumber(deltas?.resolved?.previous, 0)}</span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Poin kegiatan</span>
          <strong className={styles.kpiValue}>{fmtNumber(totalPoints, 0)}</strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, dPoints.polarity)}`}>
            {dPoints.text}
          </span>
          <span className={styles.kpiSub}>Bukti kontribusi, bukan nilai akhir</span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Median respons pertama</span>
          <strong className={styles.kpiValue}>{fmtMinutes(medianResp)}</strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, dResp.polarity)}`}>
            {dResp.text}
          </span>
          <span className={styles.kpiSub}>
            {metricByKey.get('first_response')?.p90 != null
              ? `P90: ${fmtMinutes(metricByKey.get('first_response').p90)}`
              : `vs ${cmpLabel}: ${fmtMinutes(deltas?.medianResponseMinutes?.previous)}`}
          </span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Kepatuhan SLA</span>
          <strong className={styles.kpiValue}>{fmtPercent(slaPct)}</strong>
          <span className={`${styles.deltaBadge} ${polarityClass(styles, dSla.polarity)}`}>
            {dSla.text}
          </span>
          <span className={styles.kpiSub}>
            {curOp?.onTimePct != null ? `Tepat tenggat: ${fmtPercent(curOp.onTimePct)}` : 'Bebas pelanggaran SLA'}
          </span>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Peringkat & nilai formal</span>
          <strong className={styles.kpiValue}>
            {detail.ranking.rank ? `${detail.ranking.rank} dari ${detail.ranking.rankedCount}` : fmtNumber(detail.evaluation.total)}
          </strong>
          <span className={`${styles.deltaBadge} ${styles.polarityNeutral}`}>
            {detail.ranking.score != null ? `Skor aktivitas ${fmtNumber(detail.ranking.score)}` : fmtEvalStatus(detail.evaluation.status)}
          </span>
          <span className={styles.kpiSub}>
            {detail.evaluation.total != null
              ? `Nilai evaluasi: ${fmtNumber(detail.evaluation.total)} (${fmtEvalStatus(detail.evaluation.status)})`
              : detail.ranking.reason || `${detail.ranking.tied ? 'Nilai seri. ' : ''}${detail.ranking.unratedCount || 0} anggota belum dinilai.`}
          </span>
        </article>
      </div>

      {detail.evaluation.explanations?.length > 0 && (
        <details className={styles.readinessBar}>
          <summary>
            <span>Dasar dan kelengkapan penilaian formal</span>
            <span className={styles.readinessSummaryToggle}>{fmtEvalStatus(detail.evaluation.status)}</span>
          </summary>
          <div className={styles.readinessDetail}>
            {detail.evaluation.explanations.map((x, i) => (
              <p key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</p>
            ))}
          </div>
        </details>
      )}

      {detail.trend?.length > 0 && (
        <TrendSeriesPanel
          series={detail.trend}
          title={`Tren ${detail.user.name} (${trendMonths || detail.trend.length} bulan terakhir)`}
        />
      )}

      {/* Structured 4-Pillar Performance Breakdown */}
      <section className={styles.sectionBlock} aria-labelledby="detail-metrics-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="detail-metrics-heading">Rincian ukuran kinerja</h2>
            <p className={styles.sectionNote}>
              Dikelompokkan dalam 4 pilar dengan perbandingan langsung terhadap {cmpLabel}.
            </p>
          </div>
          <div className={styles.pillGroup} role="group" aria-label="Filter pilar ukuran kinerja">
            <button
              type="button"
              className={styles.pillBtn}
              aria-pressed={pillarFilter === 'all'}
              onClick={() => setPillarFilter('all')}
            >
              Semua Pilar
            </button>
            {PILLAR_DEFS.map(p => (
              <button
                key={p.id}
                type="button"
                className={styles.pillBtn}
                aria-pressed={pillarFilter === p.id}
                onClick={() => setPillarFilter(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!detail.metrics?.length && (
          <p className={styles.sectionNote}>Belum ada rincian metrik tercatat untuk periode ini.</p>
        )}

        {groupedMetrics.map(group => (
          <div className={styles.sectionBlock} key={group.id}>
            <div className={styles.tableWrap} role="region" aria-label={`Metrik ${group.label}`} tabIndex={0}>
              <table>
                <caption>{group.label}</caption>
                <thead>
                  <tr>
                    <th scope="col">Ukuran</th>
                    <th scope="col">Hasil ({curLabel})</th>
                    <th scope="col">vs {cmpLabel}</th>
                    <th scope="col">Cakupan / konteks</th>
                    <th scope="col">Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(m => {
                    const comp = detail.comparison?.[m.key];
                    const badge = formatDeltaBadge(comp, {
                      kind: m.unit === '%' ? 'pp' : m.unit === 'menit' ? 'minutes' : 'count',
                    });
                    return (
                      <tr key={m.key}>
                        <th scope="row">{m.label}</th>
                        <td>
                          <span className={styles.cellMain}>{metricValueLabel(m)}</span>
                          {m.p90 != null && <span className={styles.cellSub}>P90: {fmtMinutes(m.p90)}</span>}
                        </td>
                        <td>
                          {comp ? (
                            <span className={`${styles.deltaBadge} ${polarityClass(styles, badge.polarity)}`}>
                              {badge.text}
                            </span>
                          ) : (
                            <span className={styles.cellSub}>—</span>
                          )}
                        </td>
                        <td>
                          {m.denominator != null && <span className={styles.cellSub}>{m.denominator} sampel</span>}
                          {m.note}
                        </td>
                        <td>
                          {m.evidenceRefs?.length ? (
                            <details>
                              <summary>Lihat {m.evidenceRefs.length} bukti</summary>
                              <ul>
                                {m.evidenceRefs.slice(0, 50).map((r, i) => (
                                  <li key={i}>
                                    {r.ticketId ? (
                                      <a href={'/tickets/' + r.ticketId}>Tiket #{r.ticketId}</a>
                                    ) : (
                                      <span>
                                        {r.source} #{r.sourceId}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {m.evidenceRefs.length > 50 && <p>Menampilkan 50 bukti pertama.</p>}
                            </details>
                          ) : (
                            'Belum tersedia'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* Monthly Qualitative & Coverage Analysis */}
      <section className={styles.sectionBlock} aria-labelledby="monthly-analysis-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="monthly-analysis-heading">Analisis bulanan</h2>
            <p className={styles.sectionNote}>
              Ringkasan berdasarkan fakta tercatat, tetap memerlukan pemeriksaan konteks oleh manager.
            </p>
          </div>
        </div>
        <div className={styles.analysisGrid}>
          {[
            ['strengths', 'Kontribusi tercatat'],
            ['improvements', 'Perlu tindak lanjut'],
            ['context', 'Konteks'],
            ['coverage', 'Bukti yang belum cukup'],
          ].map(([key, label]) => (
            <div className={styles.analysis} key={key}>
              <h3>{label}</h3>
              {detail.analysis?.[key]?.length ? (
                <ul>
                  {detail.analysis[key].map((a, i) => (
                    <li key={i}>{a.text}</li>
                  ))}
                </ul>
              ) : (
                <p>Belum ada kesimpulan dari bukti yang tersedia.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {detail.tickets?.length > 0 && (
        <section className={styles.sectionBlock} aria-labelledby="tickets-worked-heading">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="tickets-worked-heading">Tiket yang dikerjakan</h2>
              <p className={styles.sectionNote}>
                Daftar tiket tempat anggota ini menjadi PIC atau memberi respons pada bulan ini.
              </p>
            </div>
          </div>
          <div className={styles.tableWrap} role="region" aria-label="Tiket yang dikerjakan" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Judul</th>
                  <th scope="col">Peran</th>
                  <th scope="col">Status</th>
                  <th scope="col">Selesai</th>
                  <th scope="col">Respons</th>
                  <th scope="col">Poin</th>
                </tr>
              </thead>
              <tbody>
                {detail.tickets.slice(0, 100).map(ticket => (
                  <tr key={ticket.id}>
                    <td>
                      <a href={'/tickets/' + ticket.id}>{ticket.trackingId || '#' + ticket.id}</a>
                    </td>
                    <td>{ticket.title}</td>
                    <td>{ticket.role}</td>
                    <td>{ticket.status}</td>
                    <td>
                      {ticket.resolvedAt
                        ? new Date(ticket.resolvedAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>{ticket.responseMinutes != null ? `${ticket.responseMinutes} mnt` : '—'}</td>
                    <td>{fmtNumber(ticket.points, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.tickets.length > 100 && <p className={styles.sectionNote}>Menampilkan 100 tiket pertama.</p>}
        </section>
      )}

      <section className={styles.sectionBlock} aria-labelledby="review-section-heading">
        <h2 id="review-section-heading">Peninjauan</h2>
        <p className={styles.sectionNote}>
          Nilai akhir mengikuti rubrik dan review yang tercatat, bukan jumlah klik atau balasan.
        </p>
        {detail.canReview && (
          <a href={'/reports/evaluations?review=1&month=' + month}>Buka review evaluasi periode ini</a>
        )}
        {detail.canReview && <DataReview rows={detail.dataChanges} month={month} onSaved={onReload} />}
      </section>
    </>
  );
}

function DataReview({rows = [], month, onSaved}) {
  const [id, setId] = useState('');
  const [decision, setDecision] = useState('accepted');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pending = rows.filter(r => r.validationState === 'pending');
  if (!pending.length) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/reports/kinerja/activity-review?month=' + month, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: Number(id), decision, reason}),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.review} onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Validasi kontribusi data</legend>
        <label>
          Perubahan
          <select aria-label="Perubahan" required value={id} onChange={e => setId(e.target.value)}>
            <option value="">Pilih bukti</option>
            {pending.map(r => (
              <option key={r.id} value={r.id}>
                {r.type} #{r.entityId}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hasil
          <select aria-label="Hasil validasi" value={decision} onChange={e => setDecision(e.target.value)}>
            <option value="accepted">Valid</option>
            <option value="rejected">Perlu koreksi</option>
          </select>
        </label>
        <label>
          Bukti dan alasan
          <textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">
          Simpan validasi
        </button>
      </fieldset>
    </form>
  );
}

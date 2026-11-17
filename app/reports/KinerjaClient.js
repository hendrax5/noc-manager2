'use client';
import {useEffect,useMemo,useState} from 'react';
import styles from './kinerja.module.css';
import {buildCompareMonthOptions, fmtNumber} from './kinerjaFormat';
import TeamPerformanceView from './TeamPerformanceView';
import MemberDetailView from './MemberDetailView';

const prevMonthOf = monthKey => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return '';
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

export default function KinerjaClient({
  initialMonth,
  initialCompareMonth = null,
  initialTab = 'self',
  initialUserId = null,
  hasTeamAccess = false,
}) {
  const [month, setMonth] = useState(initialMonth);
  const [compareMonth, setCompareMonth] = useState(initialCompareMonth || prevMonthOf(initialMonth));
  const [trendMonths, setTrendMonths] = useState(6);
  const [tab, setTab] = useState(initialTab);
  const [userId, setUserId] = useState(initialUserId);
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const compareOptions = useMemo(() => buildCompareMonthOptions(month, 6), [month]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDetailError('');
    setDetail(null);

    const fetchJson = async url => {
      const r = await fetch(url, {signal: controller.signal, cache: 'no-store'});
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Kinerja gagal dimuat.');
      return b;
    };

    const qs = `month=${encodeURIComponent(month)}&compareMonth=${encodeURIComponent(compareMonth)}&trendMonths=${trendMonths}`;
    const deptFilter = department ? `&departmentId=${encodeURIComponent(department)}` : '';
    const compFilter = company ? `&company=${encodeURIComponent(company)}` : '';

    Promise.allSettled([
      fetchJson(`/api/reports/kinerja/overview?${qs}${deptFilter}${compFilter}`),
      fetchJson(`/api/reports/kinerja/${userId ? 'users/' + userId : 'me'}?${qs}`),
    ])
      .then(([overviewRes, detailRes]) => {
        if (controller.signal.aborted) return;
        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value);
        } else if (overviewRes.reason?.name !== 'AbortError') {
          setError(overviewRes.reason?.message || 'Kinerja gagal dimuat.');
          return;
        }

        if (detailRes.status === 'fulfilled') {
          setDetail(detailRes.value);
        } else if (detailRes.reason?.name !== 'AbortError') {
          setDetailError(detailRes.reason?.message || 'Rincian anggota gagal dimuat.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [month, compareMonth, trendMonths, userId, department, company, reload]);

  const canShowTeam = Boolean(overview ? overview.canViewTeam : hasTeamAccess);
  const effectiveTab = tab === 'team' && !canShowTeam ? 'self' : tab;
  const activeMode = detail?.mode || overview?.mode || 'simulation';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Kinerja</h1>
          <p>Performa operasional, perbandingan periode, dan kontribusi yang dapat ditelusuri.</p>
        </div>
        <a href="/reports/daily">Isi laporan harian</a>
      </header>

      <div className={styles.toolbar}>
        <label>
          Bulan
          <input
            aria-label="Bulan"
            type="month"
            value={month}
            onChange={e => {
              if (e.target.value) {
                const next = e.target.value;
                setMonth(next);
                setCompareMonth(prevMonthOf(next));
              }
            }}
          />
        </label>

        <label>
          Bandingkan dengan
          <select
            aria-label="Bandingkan dengan"
            value={compareMonth}
            onChange={e => setCompareMonth(e.target.value)}
          >
            {compareOptions.map(opt => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Jendela tren
          <select
            aria-label="Jendela tren"
            value={trendMonths}
            onChange={e => setTrendMonths(Number(e.target.value))}
          >
            <option value={3}>3 bulan terakhir</option>
            <option value={6}>6 bulan terakhir</option>
          </select>
        </label>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => setReload(r => r + 1)}
          disabled={loading}
        >
          Aktualkan data
        </button>
      </div>

      <nav className={styles.tabs} aria-label="Tampilan kinerja">
        {canShowTeam && (
          <button
            type="button"
            aria-pressed={effectiveTab === 'team'}
            onClick={() => setTab('team')}
          >
            Performa Tim
          </button>
        )}
        <button
          type="button"
          aria-pressed={effectiveTab === 'self'}
          onClick={() => {
            setTab('self');
            setUserId(null);
          }}
        >
          Kinerja saya
        </button>
        <button
          type="button"
          aria-pressed={effectiveTab === 'activity'}
          onClick={() => setTab('activity')}
        >
          Aktivitas & Poin
        </button>
      </nav>

      {loading && <p role="status">Memuat kinerja dan bukti kegiatan...</p>}

      {!loading && error && (
        <div role="alert" className={styles.inlineAlert}>
          <p>{error}</p>
          <button type="button" className="secondary-btn" onClick={() => setReload(r => r + 1)}>
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && (overview || detail) && (
        <>
          <div className={styles.modeBar}>
            <span className={styles.modePill}>
              {activeMode === 'official' ? 'Periode resmi' : 'Mode simulasi'}
            </span>
            <span>
              {activeMode === 'official'
                ? 'Peringkat formal mengikuti publikasi hasil yang terkunci.'
                : 'KPI operasional dihitung dari data nyata; nilai formal masih dalam simulasi.'}
            </span>
          </div>

          {effectiveTab === 'team' && canShowTeam && overview && (
            <TeamPerformanceView
              overview={overview}
              month={month}
              compareMonth={compareMonth}
              trendMonths={trendMonths}
              department={department}
              company={company}
              onDepartmentChange={setDepartment}
              onCompanyChange={setCompany}
              onSelectMember={selectedId => {
                setUserId(selectedId === overview.currentUserId ? null : selectedId);
                setTab('self');
              }}
              onReload={() => setReload(r => r + 1)}
            />
          )}

          {effectiveTab !== 'team' && detailError && !detail && (
            <div role="alert" className={styles.inlineAlert}>
              <p>{detailError}</p>
              <div className={styles.pillGroup}>
                <button type="button" className="secondary-btn" onClick={() => setReload(r => r + 1)}>
                  Coba lagi
                </button>
                {userId != null && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setUserId(null);
                      if (canShowTeam) setTab('team');
                    }}
                  >
                    {canShowTeam ? 'Kembali ke Performa Tim' : 'Kembali ke Kinerja saya'}
                  </button>
                )}
              </div>
            </div>
          )}

          {effectiveTab === 'activity' && detail && <ActivityPanel detail={detail} />}

          {effectiveTab === 'self' && detail && (
            <MemberDetailView
              detail={detail}
              month={month}
              compareMonth={compareMonth}
              trendMonths={trendMonths}
              canBackToTeam={canShowTeam && userId != null}
              onBackToTeam={() => {
                setUserId(null);
                setTab('team');
              }}
              onReload={() => setReload(r => r + 1)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ActivityPanel({detail}) {
  return (
    <section className={styles.sectionBlock}>
      <h2>Aktivitas & Poin</h2>
      <p className={styles.sectionNote}>
        Ledger: {fmtNumber(detail.points.ledger, 0)} poin. Poin tiket lama: {fmtNumber(detail.points.legacy, 0)}. Tidak mengubah histori perolehan poin.
      </p>
      {!detail.activities.length && <p>Belum ada aktivitas pada periode ini.</p>}
      <ol>
        {detail.activities.map(a => (
          <li key={a.id}>
            <a href={'/tickets/' + a.ticketId}>Tiket #{a.ticketId}</a>: {a.action} ({a.awardedScore || 0} poin)
          </li>
        ))}
      </ol>
      <h3>Kontribusi data</h3>
      {!detail.dataChanges.length ? (
        <p>Belum ada perubahan data tercatat. Pencatatan tidak berlaku surut.</p>
      ) : (
        <ul>
          {detail.dataChanges.map(e => (
            <li key={e.id}>
              {e.entityType} #{e.entityId}: {e.type}.{' '}
              {e.validationState === 'accepted'
                ? 'Tervalidasi'
                : e.validationState === 'rejected'
                  ? 'Perlu koreksi'
                  : 'Menunggu review'}
              <details>
                <summary>Field yang berubah</summary>
                <ul>
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      {c.field}: {String(c.before ?? 'Kosong')} menjadi {String(c.after ?? 'Kosong')}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
      <h3>Pengetahuan dan tugas rapat</h3>
      <p>
        {detail.articles.length} artikel tercatat dan {detail.actions.length} tugas rapat diperbarui. Jumlah ini belum menjadi ukuran kualitas.
      </p>
    </section>
  );
}

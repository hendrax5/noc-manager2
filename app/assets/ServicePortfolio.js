'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCustomerId } from '@/lib/customers/identity';
import styles from './service-portfolio.module.css';
import cleanup from './assets-cleanup.module.css';

const gbps = (v) => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 9 }) + ' Gbps';

export default function ServicePortfolio({
  duplicateCount = 0,
  unlinkedCidCount = null,
  pendingServiceCount = null,
  onOpenDuplicates,
  onOpenUnlinkedCids,
  onOpenMissingCidServices,
  onOpenPendingServices,
} = {}) {
  const id = useId();
  const detailRef = useRef(null);
  const [filters, setFilters] = useState({
    query: '',
    status: 'Active',
    company: '',
    detailTemplateId: '',
    onlyUnknown: false,
    page: 1,
  });
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page || 1 }));

  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const p = new URLSearchParams({
          q: filters.query,
          status: filters.status,
          company: filters.company,
          detailTemplateId: filters.detailTemplateId,
          page: String(filters.onlyUnknown ? 1 : filters.page),
        });
        const r = await fetch('/api/assets/portfolio?' + p, { signal: c.signal });
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        if (!c.signal.aborted) setView(b);
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message);
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [filters.query, filters.status, filters.company, filters.detailTemplateId, filters.page, filters.onlyUnknown, retry]);

  const unknownPairTotal = view ? view.groups.reduce((n, g) => n + (g.unknownPairCount || 0), 0) : 0;
  const unknownCapacityTotal = view ? (view.unknownBandwidthCount || 0) + unknownPairTotal : 0;
  const hasAnyHygieneIssue =
    duplicateCount > 0 ||
    (unlinkedCidCount ?? 0) > 0 ||
    (pendingServiceCount ?? 0) > 0 ||
    (view?.missingCidCount || 0) > 0 ||
    unknownCapacityTotal > 0 ||
    (view?.duplicateCidCount || 0) > 0;

  const displayedDetails = view
    ? filters.onlyUnknown
      ? view.details.filter((s) => (s.unit === 'pair' ? s.pairCount === null : s.bandwidthGbps === null))
      : view.details
    : [];

  return (
    <section className={styles.portfolio} aria-label="Ringkasan layanan">
      <div className={styles.filters}>
        <div>
          <label htmlFor={id + '-search'}>Cari layanan, customer, atau CID</label>
          <input
            id={id + '-search'}
            type="search"
            maxLength={160}
            value={filters.query}
            placeholder="IPT, Metro-E, nama PT, SAP-C-…"
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={id + '-company'}>Perusahaan penerima order</label>
          <select id={id + '-company'} value={filters.company} onChange={(e) => update({ company: e.target.value })}>
            <option value="">Semua penerima order</option>
            {(view?.companies || []).map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option value="unmapped">Belum tercatat</option>
          </select>
        </div>
        <div>
          <label htmlFor={id + '-status'}>Status circuit</label>
          <select id={id + '-status'} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="Active">Aktif</option>
            <option value="">Semua status</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Ditangguhkan</option>
            <option value="Terminated">Terminasi</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() =>
            setFilters({ query: '', status: 'Active', company: '', detailTemplateId: '', onlyUnknown: false, page: 1 })
          }
        >
          Reset
        </button>
      </div>

      {loading && <p role="status">Memuat ringkasan…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Coba lagi
          </button>
        </div>
      )}

      {view && !loading && !error && (
        <>
          <p className={styles.total} role="status">
            <strong>
              {view.circuitCount} CID /{' '}
              {view.bandwidthCircuitCount === 0 && view.circuitCount > 0 ? (
                view.totalPairs + ' pair'
              ) : (
                <>
                  {view.circuitCount > 0 &&
                  view.unknownBandwidthCount === (view.bandwidthCircuitCount ?? view.circuitCount) &&
                  view.unknownBandwidthCount > 0
                    ? 'BW belum tersedia'
                    : gbps(view.knownBandwidthGbps)}
                  {view.totalPairs > 0 ? ' + ' + view.totalPairs + ' pair' : ''}
                </>
              )}
            </strong>{' '}
            · {view.customerCount} customer unik · kapasitas berlangganan diketahui
          </p>

          <div className={cleanup.hygienePanel} aria-label="Antrean perapihan data">
            <div className={cleanup.hygieneHead}>
              <h2>Antrean Perapihan Data</h2>
              {filters.onlyUnknown && (
                <button
                  type="button"
                  className={cleanup.compactAction}
                  onClick={() => update({ onlyUnknown: false })}
                >
                  Tampilkan semua kapasitas
                </button>
              )}
            </div>
            {!hasAnyHygieneIssue ? (
              <p className={cleanup.hygieneClean}>
                Seluruh data customer, CID, dan kapasitas pada filter ini dalam kondisi rapi.
              </p>
            ) : (
              <div className={cleanup.hygieneGrid}>
                {duplicateCount > 0 && onOpenDuplicates && (
                  <button
                    type="button"
                    className={`${cleanup.hygieneCard} ${cleanup.hygieneWarn}`}
                    onClick={onOpenDuplicates}
                  >
                    <span className={cleanup.hygieneValue}>{duplicateCount}</span>
                    <span className={cleanup.hygieneLabel}>Kandidat duplikat customer</span>
                    <span className={cleanup.hygieneHint}>Tinjau & gabungkan →</span>
                  </button>
                )}
                {(unlinkedCidCount ?? 0) > 0 && onOpenUnlinkedCids && (
                  <button
                    type="button"
                    className={`${cleanup.hygieneCard} ${cleanup.hygieneInfo}`}
                    onClick={onOpenUnlinkedCids}
                  >
                    <span className={cleanup.hygieneValue}>{unlinkedCidCount}</span>
                    <span className={cleanup.hygieneLabel}>CID tiket belum tertaut</span>
                    <span className={cleanup.hygieneHint}>Buka Penautan CID →</span>
                  </button>
                )}
                {view.missingCidCount > 0 && (
                  <button
                    type="button"
                    className={cleanup.hygieneCard}
                    onClick={() => onOpenMissingCidServices?.()}
                    disabled={!onOpenMissingCidServices}
                  >
                    <span className={cleanup.hygieneValue}>{view.missingCidCount}</span>
                    <span className={cleanup.hygieneLabel}>Layanan belum memiliki CID</span>
                    <span className={cleanup.hygieneHint}>Lihat di Customer & Circuit →</span>
                  </button>
                )}
                {unknownCapacityTotal > 0 && (
                  <button
                    type="button"
                    className={cleanup.hygieneCard}
                    aria-pressed={filters.onlyUnknown}
                    onClick={() => {
                      update({ onlyUnknown: !filters.onlyUnknown });
                      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <span className={cleanup.hygieneValue}>{unknownCapacityTotal}</span>
                    <span className={cleanup.hygieneLabel}>Kapasitas / pair belum lengkap</span>
                    <span className={cleanup.hygieneHint}>
                      {filters.onlyUnknown ? 'Filter aktif — klik untuk reset' : 'Filter daftar detail ↓'}
                    </span>
                  </button>
                )}
                {(pendingServiceCount ?? 0) > 0 && onOpenPendingServices && (
                  <button
                    type="button"
                    className={cleanup.hygieneCard}
                    onClick={onOpenPendingServices}
                  >
                    <span className={cleanup.hygieneValue}>{pendingServiceCount}</span>
                    <span className={cleanup.hygieneLabel}>Layanan berstatus Pending</span>
                    <span className={cleanup.hygieneHint}>Periksa & aktifkan →</span>
                  </button>
                )}
              </div>
            )}
            {(view.unknownBandwidthCount > 0 || view.missingCidCount > 0 || view.duplicateCidCount > 0) && (
              <p className={styles.notice}>
                {view.unknownBandwidthCount} CID belum memiliki bandwidth yang jelas · {view.missingCidCount} layanan belum memiliki CID ·{' '}
                {view.duplicateCidCount} duplikasi CID dikecualikan.
              </p>
            )}
          </div>

          <div className={styles.table}>
            <table>
              <caption>Jumlah circuit dan bandwidth per produk</caption>
              <thead>
                <tr>
                  {['Produk / Layanan', 'Customer unik', 'CID unik', 'Total kapasitas diketahui', 'Kapasitas belum lengkap', 'Aksi'].map((t) => (
                    <th key={t} scope="col">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.groups.map((g) => (
                  <tr key={g.templateId}>
                    <th scope="row">{g.name}</th>
                    <td>{g.customerCount}</td>
                    <td>{g.circuitCount}</td>
                    <td>
                      {g.unit === 'pair'
                        ? g.unknownPairCount === g.circuitCount
                          ? 'Belum diketahui'
                          : g.totalPairs + ' pair'
                        : g.unknownBandwidthCount === g.circuitCount
                          ? 'Belum diketahui'
                          : gbps(g.knownBandwidthGbps)}
                    </td>
                    <td>{g.unit === 'pair' ? g.unknownPairCount : g.unknownBandwidthCount}</td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={String(filters.detailTemplateId) === String(g.templateId)}
                        onClick={() => update({ detailTemplateId: String(g.templateId) })}
                      >
                        Lihat circuit
                      </button>
                    </td>
                  </tr>
                ))}
                {!view.groups.length && (
                  <tr>
                    <td colSpan={6}>Tidak ada circuit yang sesuai filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className={styles.note}>
            Satu circuit dihitung satu kali. BOD sementara memakai bandwidth normal. Produk dengan master berbeda tidak digabung otomatis. DARKFIBER dihitung dalam pair, terpisah dari Gbps. Nilai tanpa unit tidak ditebak.
          </p>

          <div className={styles.detailTitle} ref={detailRef}>
            <h2>
              {filters.detailTemplateId
                ? view.groups.find((g) => String(g.templateId) === filters.detailTemplateId)?.name || 'Produk terpilih'
                : 'Semua circuit'}{' '}
              · {filters.onlyUnknown ? `${displayedDetails.length} kapasitas belum lengkap (halaman ini)` : `${view.detailCount} CID`}
            </h2>
            {(filters.detailTemplateId || filters.onlyUnknown) && (
              <button
                type="button"
                onClick={() => update({ detailTemplateId: '', onlyUnknown: false })}
              >
                Semua produk
              </button>
            )}
          </div>

          <div className={styles.table}>
            <table>
              <caption>Detail circuit sesuai filter</caption>
              <thead>
                <tr>
                  {['Circuit ID', 'Customer / Site', 'Produk', 'Kapasitas berlangganan', 'Status'].map((t) => (
                    <th key={t} scope="col">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedDetails.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={'/assets/' + s.id}>{s.cid}</Link>
                    </td>
                    <td>
                      <strong>{s.customerName}</strong>
                      <small>
                        {formatCustomerId({ id: s.customerId })} · {s.name}
                      </small>
                    </td>
                    <td>{s.productName}</td>
                    <td>
                      {s.unit === 'pair'
                        ? s.pairCount === null
                          ? 'Belum diketahui'
                          : s.pairCount + ' pair'
                        : s.bandwidthGbps === null
                          ? 'Belum diketahui'
                          : gbps(s.bandwidthGbps)}
                    </td>
                    <td>{s.status}</td>
                  </tr>
                ))}
                {!displayedDetails.length && (
                  <tr>
                    <td colSpan={5}>Tidak ada circuit pada halaman ini yang cocok dengan filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav className={styles.pagination} aria-label="Halaman circuit">
            <button type="button" disabled={view.page <= 1} onClick={() => update({ page: view.page - 1 })}>
              Sebelumnya
            </button>
            <span>
              Halaman {view.page} / {view.pageCount} · total {view.detailCount} CID
            </span>
            <button type="button" disabled={view.page >= view.pageCount} onClick={() => update({ page: view.page + 1 })}>
              Berikutnya
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

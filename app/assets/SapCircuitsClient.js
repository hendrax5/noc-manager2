'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCustomerId } from '@/lib/customers/identity';
import { suggestCustomerForCircuitSource } from '@/lib/customers/duplicateDetection';
import { getServiceCid } from '@/lib/services/cid';
import AssetCombobox from './AssetCombobox';
import styles from './sap-circuits.module.css';
import ui from './assets-ui.module.css';
import cleanup from './assets-cleanup.module.css';

const labels = {
  needs_mapping: 'Belum tertaut ke layanan',
  ready_to_link: 'Asset tersedia — tautkan tiket',
  linked: 'Sudah tertaut',
  conflict: 'Perlu diperiksa',
};

export default function SapCircuitsClient({
  customers = [],
  templates = [],
  services = [],
  onMapped,
  onCreateCustomer,
  onCustomerCreated,
  onManageProducts,
  onSummaryLoaded,
  initialStatus = 'pending',
  layout = 'dialog',
}) {
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checkedCids, setCheckedCids] = useState([]);
  const [batchNames, setBatchNames] = useState({});
  const [batchDraft, setBatchDraft] = useState({
    customerId: '',
    templateId: '',
    status: 'Pending',
    confirmReview: false,
  });
  const [draft, setDraft] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mapped, setMapped] = useState(null);
  const [family, setFamily] = useState('all');

  // Inline customer creation inside CID linking flow
  const [showInlineCustomer, setShowInlineCustomer] = useState(false);
  const [inlineCustomer, setInlineCustomer] = useState({ name: '', contactEmail: '', contactPhone: '' });
  const [inlinePending, setInlinePending] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const mappingRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    setStatus(initialStatus);
    setPage(1);
  }, [initialStatus]);

  useEffect(() => {
    if (layout === 'split' || !selected || !dialogRef.current) return;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    (dialog.querySelector('[role="combobox"]') || mappingRef.current)?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [layout, selected]);

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [
      ...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]'),
    ].filter((e) => e.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const target = services.find((service) => String(service.id) === String(draft.existingServiceId));
  const differentCid = !!(target && getServiceCid(target) && getServiceCid(target).toUpperCase() !== selected?.cid);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(
      `/api/assets/circuit-candidates?q=${encodeURIComponent(q)}&page=${page}&status=${status}&family=${encodeURIComponent(family)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'CID gagal dimuat.');
        setData(body);
        onSummaryLoaded?.(body.summary);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, page, status, family, reload, onSummaryLoaded]);

  const itemsByCid = useMemo(() => new Map((data?.items || []).map((item) => [item.cid, item])), [data]);
  const checkedRows = useMemo(
    () => checkedCids.map((cid) => itemsByCid.get(cid)).filter(Boolean),
    [checkedCids, itemsByCid],
  );
  const eligibleOnPage = useMemo(
    () => (data?.items || []).filter((row) => row.status !== 'conflict' && row.status !== 'linked'),
    [data],
  );

  const isBatchMode = layout === 'split' && checkedRows.length >= 2;
  const activeSingleRow =
    layout === 'split'
      ? checkedRows.length === 1
        ? checkedRows[0]
        : selected
      : selected;

  const singleSuggestions = useMemo(
    () =>
      activeSingleRow
        ? suggestCustomerForCircuitSource(activeSingleRow.sourceNames || [activeSingleRow.sourceName], customers)
        : [],
    [activeSingleRow, customers],
  );

  const batchSuggestions = useMemo(() => {
    if (!isBatchMode) return [];
    const allNames = checkedRows.flatMap((r) => r.sourceNames || [r.sourceName]).filter(Boolean);
    return suggestCustomerForCircuitSource(allNames, customers);
  }, [isBatchMode, checkedRows, customers]);

  function openRowForMapping(row) {
    setSelected(row);
    setDraft({
      name: (row.sourceName || row.cid).slice(0, 500),
      customerId: '',
      confirmAlias: false,
      confirmReview: false,
      templateId: '',
      status: 'Pending',
      existingServiceId: '',
    });
    setShowInlineCustomer(false);
    setInlineError('');
    setError('');
    setNotice('');
  }

  function toggleRowChecked(row, checked) {
    setError('');
    setNotice('');
    setCheckedCids((prev) => {
      const next = checked ? [...new Set([...prev, row.cid])] : prev.filter((c) => c !== row.cid);
      if (next.length === 1) {
        const onlyRow = itemsByCid.get(next[0]);
        if (onlyRow) openRowForMapping(onlyRow);
      }
      return next;
    });
    if (checked) {
      setBatchNames((prev) => ({
        ...prev,
        [row.cid]: prev[row.cid] || (row.sourceName || row.cid).slice(0, 500),
      }));
    }
  }

  function selectAllEligibleOnPage() {
    if (!eligibleOnPage.length) return;
    const allChecked = eligibleOnPage.every((r) => checkedCids.includes(r.cid));
    if (allChecked) {
      setCheckedCids([]);
      return;
    }
    const nextCids = eligibleOnPage.slice(0, 50).map((r) => r.cid);
    setCheckedCids(nextCids);
    const nextNames = { ...batchNames };
    for (const r of eligibleOnPage.slice(0, 50)) {
      if (!nextNames[r.cid]) nextNames[r.cid] = (r.sourceName || r.cid).slice(0, 500);
    }
    setBatchNames(nextNames);
    if (nextCids.length === 1) openRowForMapping(eligibleOnPage[0]);
  }

  async function saveInlineCustomer(event) {
    event.preventDefault();
    if (!inlineCustomer.name.trim()) {
      setInlineError('Nama customer wajib diisi.');
      return;
    }
    setInlinePending(true);
    setInlineError('');
    try {
      const response = await fetch('/api/assets/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineCustomer),
      });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || 'Customer gagal didaftarkan.');
      onCustomerCreated?.(created);
      if (isBatchMode) {
        setBatchDraft((b) => ({ ...b, customerId: created.id }));
      } else {
        setDraft((d) => ({ ...d, customerId: created.id, existingServiceId: '', confirmAlias: false }));
      }
      setInlineCustomer({ name: '', contactEmail: '', contactPhone: '' });
      setShowInlineCustomer(false);
    } catch (e) {
      setInlineError(e.message);
    } finally {
      setInlinePending(false);
    }
  }

  async function saveSingle(event) {
    event.preventDefault();
    const row = activeSingleRow;
    if (!row) return;
    if (
      !row.serviceId &&
      (!draft.customerId || !draft.existingServiceId || (draft.existingServiceId === 'new' && !draft.templateId))
    ) {
      setError('Pilih customer dan layanan dari daftar terlebih dahulu.');
      return;
    }
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/assets/circuit-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: row.cid,
          confirmReview: draft.confirmReview,
          ...(row.serviceId
            ? {}
            : draft.existingServiceId === 'new'
              ? { ...draft, existingServiceId: undefined }
              : {
                  customerId: draft.customerId,
                  existingServiceId: draft.existingServiceId,
                  confirmAlias: draft.confirmAlias,
                }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'CID gagal disimpan.');
      setNotice(`${result.cid}: ${result.created ? 'Asset dibuat; ' : ''}${result.linkedTickets} tiket ditautkan.`);
      setMapped(result);
      setSelected(null);
      setCheckedCids((prev) => prev.filter((c) => c !== row.cid));
      setReload((value) => value + 1);
      await onMapped?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }

  async function saveBatch(event) {
    event.preventDefault();
    const needsNewService = checkedRows.some((r) => !r.serviceId);
    if (needsNewService && (!batchDraft.customerId || !batchDraft.templateId)) {
      setError('Pilih customer dan produk layanan terlebih dahulu untuk CID baru.');
      return;
    }
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/assets/circuit-candidates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: batchDraft.customerId || undefined,
          templateId: batchDraft.templateId || undefined,
          status: batchDraft.status,
          confirmReview: batchDraft.confirmReview,
          items: checkedRows.map((row) => ({
            cid: row.cid,
            name: (batchNames[row.cid] || row.sourceName || row.cid).trim(),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Batch CID gagal disimpan.');
      setNotice(
        `Batch berhasil: ${result.count} CID diproses (${result.createdCount} Asset dibuat, ${result.linkedTicketsCount} tiket ditautkan).`,
      );
      setCheckedCids([]);
      setSelected(null);
      setBatchDraft((b) => ({ ...b, confirmReview: false }));
      setReload((value) => value + 1);
      await onMapped?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${formatCustomerId(c)} — ${c.name}`,
  }));
  const activeTemplateOptions = templates.filter((t) => t.active !== false).map((t) => ({ value: t.id, label: t.name }));

  function renderInlineCustomerCreator(suggestedDefaultName = '') {
    if (!onCustomerCreated) return null;
    if (!showInlineCustomer) {
      return (
        <button
          type="button"
          className={cleanup.compactAction}
          onClick={() => {
            setInlineCustomer({
              name: suggestedDefaultName.split(/\s*[-–|\/]\s*/)[0]?.trim() || '',
              contactEmail: '',
              contactPhone: '',
            });
            setInlineError('');
            setShowInlineCustomer(true);
          }}
        >
          + Buat customer baru di sini
        </button>
      );
    }
    return (
      <div className={cleanup.inlineCreateBox} aria-label="Buat customer baru inline">
        <strong>Daftarkan Customer Baru (tetap di layar ini)</strong>
        {inlineError && (
          <p role="alert" className={cleanup.alertError}>
            {inlineError}
          </p>
        )}
        <label>
          Nama Customer *
          <input
            type="text"
            value={inlineCustomer.name}
            onChange={(e) => setInlineCustomer((c) => ({ ...c, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                saveInlineCustomer(e);
              }
            }}
            placeholder="Contoh: PT Nusantara Digital"
          />
        </label>
        <label>
          Email NOC / Kontak
          <input
            type="email"
            value={inlineCustomer.contactEmail}
            onChange={(e) => setInlineCustomer((c) => ({ ...c, contactEmail: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                saveInlineCustomer(e);
              }
            }}
          />
        </label>
        <label>
          No. Telepon / NOC
          <input
            type="text"
            value={inlineCustomer.contactPhone}
            onChange={(e) => setInlineCustomer((c) => ({ ...c, contactPhone: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                saveInlineCustomer(e);
              }
            }}
          />
        </label>
        <div className={ui.footer}>
          <button type="button" disabled={inlinePending} onClick={() => setShowInlineCustomer(false)}>
            Batal
          </button>
          <button
            type="button"
            className={cleanup.primaryAction}
            disabled={inlinePending}
            onClick={saveInlineCustomer}
          >
            {inlinePending ? 'Menyimpan…' : 'Simpan & Pilih Customer'}
          </button>
        </div>
      </div>
    );
  }

  function renderSingleForm(row, insideDialog = false) {
    return (
      <form
        ref={insideDialog ? mappingRef : undefined}
        tabIndex={insideDialog ? -1 : undefined}
        className={styles.mapping}
        onSubmit={saveSingle}
        aria-label={`Tautkan ${row.cid}`}
      >
        <div className={ui.source}>
          <h3>{row.cid}</h3>
          <p>{row.sourceName}</p>
          {row.tickets.map((ticket) => (
            <p key={ticket.id}>
              <Link href={`/tickets/${ticket.id}`}>Tiket sumber {ticket.trackingId}</Link>
            </p>
          ))}
          <small>Order Origin dan Executing Vendor pada tiket sumber tetap dipertahankan.</small>
        </div>

        {error && (
          <p role="alert" className={ui.message}>
            {error}
          </p>
        )}

        <p>CID sudah terisi dari Subject tiket. Yang dipilih di bawah adalah customer pemilik dan layanan circuit ini.</p>
        <p>{row.ticketCount} tiket sumber akan ditautkan tanpa mengubah status atau poin tiket.</p>

        {!row.serviceId && singleSuggestions.length > 0 && (
          <div className={cleanup.suggestBox}>
            <small>Saran customer berdasar nama sumber tiket (wajib klik untuk memilih):</small>
            <div className={cleanup.suggestChips}>
              {singleSuggestions.map((s) => (
                <button
                  key={s.customerId}
                  type="button"
                  className={cleanup.suggestChip}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      customerId: s.customerId,
                      existingServiceId: '',
                      confirmAlias: false,
                    }))
                  }
                >
                  Pilih: {s.name}
                  {s.matchedViaAlias ? ` (via alias ${s.matchedViaAlias})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <fieldset disabled={pending}>
          {!row.serviceId && (
            <div className={ui.fields}>
              <AssetCombobox
                label="Customer *"
                required
                value={draft.customerId}
                options={customerOptions}
                placeholder="Cari nama atau Customer ID"
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    customerId: value ? Number(value) : '',
                    existingServiceId: '',
                    confirmAlias: false,
                  })
                }
              />
              <AssetCombobox
                label="Layanan milik customer *"
                required
                disabled={!draft.customerId}
                value={draft.existingServiceId}
                options={[
                  ...services
                    .filter((s) => (s.customerId ?? s.customer?.id) === Number(draft.customerId))
                    .map((s) => ({
                      value: String(s.id),
                      label: `${s.name} — ${s.template?.name || 'Tanpa tipe'}${getServiceCid(s) ? ` (${getServiceCid(s)})` : ''}`,
                    })),
                  { value: 'new', label: 'Buat layanan baru untuk CID ini' },
                ]}
                onChange={(value) => setDraft({ ...draft, existingServiceId: value, confirmAlias: false })}
              />
              {draft.existingServiceId === 'new' && (
                <>
                  <AssetCombobox
                    label="Produk/Layanan *"
                    required
                    value={draft.templateId}
                    options={activeTemplateOptions}
                    onChange={(value) => setDraft({ ...draft, templateId: value ? Number(value) : '' })}
                  />
                  <label>
                    Nama layanan *
                    <input
                      required
                      maxLength={500}
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </label>
                  <AssetCombobox
                    label="Status layanan"
                    value={draft.status}
                    options={[
                      { value: 'Pending', label: 'Perlu diperiksa (Pending)' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Suspended', label: 'Suspended' },
                      { value: 'Terminated', label: 'Terminated' },
                    ]}
                    onChange={(value) => setDraft({ ...draft, status: value })}
                  />
                </>
              )}
              {draft.existingServiceId && draft.existingServiceId !== 'new' && (
                <p>Nama, tipe, kapasitas dan status layanan yang dipilih tetap digunakan. CID akan ditautkan ke layanan ini.</p>
              )}
            </div>
          )}

          {!row.serviceId && (
            <div>
              <p>
                Customer tidak disimpulkan dari angka CID atau nama tiket. Pilih layanan yang sudah ada; buat baru hanya jika belum terdaftar.{' '}
                {!onCustomerCreated && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      onCreateCustomer?.();
                    }}
                  >
                    Daftarkan customer
                  </button>
                )}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    onManageProducts?.();
                  }}
                >
                  Kelola produk
                </button>
              </p>
              {renderInlineCustomerCreator(row.sourceName || '')}
            </div>
          )}

          {row.needsConfirmation && (
            <label className={cleanup.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={!!draft.confirmReview}
                onChange={(e) => setDraft({ ...draft, confirmReview: e.target.checked })}
              />
              <span>Saya sudah memeriksa sumber dan mengonfirmasi tiket ini adalah pekerjaan layanan.</span>
            </label>
          )}
          {differentCid && (
            <label className={cleanup.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={!!draft.confirmAlias}
                onChange={(e) => setDraft({ ...draft, confirmAlias: e.target.checked })}
              />
              <span>
                Saya mengonfirmasi {row.cid} dan CID utama {getServiceCid(target)} adalah circuit yang sama. Simpan sebagai kode lama/alias.
              </span>
            </label>
          )}

          <div className={ui.footer}>
            <button type="submit">
              {pending ? 'Menyimpan…' : row.serviceId ? 'Tautkan tiket ke Asset' : 'Simpan CID & tautkan tiket'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setCheckedCids((prev) => prev.filter((c) => c !== row.cid));
              }}
            >
              Batal
            </button>
          </div>
        </fieldset>
      </form>
    );
  }

  function renderBatchForm() {
    const needsNewService = checkedRows.some((r) => !r.serviceId);
    const hasNeedsConfirmation = checkedRows.some((r) => r.needsConfirmation);
    return (
      <form className={styles.mapping} onSubmit={saveBatch} aria-label="Tautkan batch CID">
        <div className={cleanup.inspectorHead}>
          <h3>Penautan Batch ({checkedRows.length} CID)</h3>
          <button type="button" className={cleanup.compactAction} onClick={() => setCheckedCids([])}>
            Bersihkan pilihan
          </button>
        </div>

        <div className={cleanup.batchChipList}>
          {checkedRows.map((r) => (
            <span key={r.cid} className={cleanup.batchChip}>
              {r.cid}
              <button
                type="button"
                aria-label={`Hapus ${r.cid} dari batch`}
                onClick={() => toggleRowChecked(r, false)}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {error && (
          <p role="alert" className={ui.message}>
            {error}
          </p>
        )}

        {needsNewService && batchSuggestions.length > 0 && (
          <div className={cleanup.suggestBox}>
            <small>Saran customer dari nama tiket terpilih:</small>
            <div className={cleanup.suggestChips}>
              {batchSuggestions.map((s) => (
                <button
                  key={s.customerId}
                  type="button"
                  className={cleanup.suggestChip}
                  onClick={() => setBatchDraft((b) => ({ ...b, customerId: s.customerId }))}
                >
                  Pilih: {s.name}
                  {s.matchedViaAlias ? ` (via alias ${s.matchedViaAlias})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <fieldset disabled={pending}>
          {needsNewService ? (
            <div className={cleanup.dialogStack}>
              <AssetCombobox
                label="Customer resmi *"
                required
                value={batchDraft.customerId}
                options={customerOptions}
                placeholder="Cari nama atau Customer ID"
                onChange={(val) => setBatchDraft((b) => ({ ...b, customerId: val ? Number(val) : '' }))}
              />
              {renderInlineCustomerCreator(checkedRows[0]?.sourceName || '')}
              <AssetCombobox
                label="Produk/Layanan *"
                required
                value={batchDraft.templateId}
                options={activeTemplateOptions}
                onChange={(val) => setBatchDraft((b) => ({ ...b, templateId: val ? Number(val) : '' }))}
              />
              <AssetCombobox
                label="Status awal layanan"
                value={batchDraft.status}
                options={[
                  { value: 'Pending', label: 'Perlu diperiksa (Pending)' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Suspended', label: 'Suspended' },
                ]}
                onChange={(val) => setBatchDraft((b) => ({ ...b, status: val || 'Pending' }))}
              />
              <div>
                <strong>Nama layanan per CID:</strong>
                <div className={cleanup.batchNames}>
                  {checkedRows
                    .filter((r) => !r.serviceId)
                    .map((r) => (
                      <label key={r.cid} className={cleanup.batchNameRow}>
                        <span>{r.cid}</span>
                        <input
                          required
                          maxLength={500}
                          value={batchNames[r.cid] ?? r.sourceName ?? r.cid}
                          onChange={(e) => setBatchNames((prev) => ({ ...prev, [r.cid]: e.target.value }))}
                        />
                      </label>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <p>Semua CID terpilih sudah memiliki Asset terdaftar; tiket sumber akan ditautkan dalam satu transaksi.</p>
          )}

          {hasNeedsConfirmation && (
            <label className={cleanup.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={!!batchDraft.confirmReview}
                onChange={(e) => setBatchDraft((b) => ({ ...b, confirmReview: e.target.checked }))}
              />
              <span>Saya sudah memeriksa seluruh tiket bertanda butuh konfirmasi dan mengonfirmasi sebagai pekerjaan layanan.</span>
            </label>
          )}

          <div className={ui.footer}>
            <button type="submit" className={cleanup.primaryAction}>
              {pending ? 'Menyimpan Batch…' : `Simpan ${checkedRows.length} CID (Batch)`}
            </button>
          </div>
        </fieldset>
      </form>
    );
  }

  const tableSection = (
    <div className={layout === 'split' ? cleanup.splitMain : undefined}>
      <h2>CID dari tiket</h2>
      <p>
        Kode SAP, I, C dan kode lama terdeteksi dari Subject lengkap pekerjaan layanan. Angka kode tidak menentukan customer. CID sudah tersedia. Tautkan CID ke customer dan layanan yang tepat agar dapat dipilih pada tiket berikutnya. Tipe layanan adalah milik layanan/CID, bukan customer.
      </p>
      {data && (
        <p>
          {data.summary.circuits} circuit · {data.summary.needsMapping} belum tertaut ke layanan · {data.summary.linked} sudah tertaut ·{' '}
          {data.summary.conflicts} perlu diperiksa
        </p>
      )}
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          setQ(query);
          setPage(1);
          setReload((value) => value + 1);
        }}
      >
        <label>
          Cari CID atau nama pada tiket
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Contoh: SAP-C-1243-0003"
          />
        </label>
        <AssetCombobox
          label="Format kode"
          value={family}
          options={['all', 'SAP', 'I', 'C', 'I2', 'C2', 'C4', 'BH', 'R', 'P', 'L', 'DCLAND-C', 'DCLAND-I'].map((code) => ({
            value: code,
            label: code === 'all' ? 'Semua format' : code,
          }))}
          onChange={(value) => {
            setFamily(value || 'all');
            setPage(1);
          }}
        />
        <AssetCombobox
          label="Tampilkan"
          value={status}
          options={[
            { value: 'pending', label: 'Belum selesai ditautkan' },
            { value: 'needs_mapping', label: 'Belum tertaut ke layanan' },
            { value: 'ready_to_link', label: 'Asset tersedia' },
            { value: 'linked', label: 'Sudah tertaut' },
            { value: 'conflict', label: 'Perlu diperiksa' },
            { value: 'all', label: 'Semua kode layanan' },
          ]}
          onChange={(value) => {
            setStatus(value || 'pending');
            setPage(1);
          }}
        />
        <button type="submit" disabled={loading}>
          Cari
        </button>
      </form>

      {layout === 'split' && eligibleOnPage.length > 0 && (
        <div className={cleanup.inventoryActions}>
          <button type="button" className={cleanup.secondaryAction} onClick={selectAllEligibleOnPage}>
            {eligibleOnPage.every((r) => checkedCids.includes(r.cid))
              ? 'Batalkan pilih halaman ini'
              : `Pilih semua siap-taut di halaman ini (${Math.min(eligibleOnPage.length, 50)})`}
          </button>
          {checkedCids.length > 0 && (
            <span className={cleanup.dupMeta}>{checkedCids.length} CID dipilih untuk batch/pemetaan</span>
          )}
        </div>
      )}

      {error && (layout === 'split' || !selected) && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Muat ulang
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {mapped && (
        <p>
          <Link href={`/assets/${mapped.serviceId}`}>Buka Asset {mapped.cid}</Link> ·{' '}
          <Link href={`/tickets/new?workType=Trouble&serviceId=${mapped.serviceId}`}>Buat Trouble untuk CID ini</Link>
        </p>
      )}

      {loading ? (
        <p role="status">Memuat CID…</p>
      ) : (
        <>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  {layout === 'split' && <th scope="col">Pilih</th>}
                  <th scope="col">CID</th>
                  <th scope="col">Nama pada tiket sumber</th>
                  <th scope="col">Tiket</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => {
                  const isEligible = row.status !== 'conflict' && row.status !== 'linked';
                  const isChecked = checkedCids.includes(row.cid);
                  const isFocused = activeSingleRow?.cid === row.cid || isChecked;
                  return (
                    <tr key={row.cid} className={isFocused ? cleanup.rowSelected : undefined}>
                      {layout === 'split' && (
                        <td>
                          {isEligible && (
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${row.cid}`}
                              checked={isChecked}
                              onChange={(e) => toggleRowChecked(row, e.target.checked)}
                            />
                          )}
                        </td>
                      )}
                      <th scope="row">{row.cid}</th>
                      <td>
                        {row.sourceName || 'Belum tersedia'}
                        {row.sourceNames.length > 1 && (
                          <details>
                            <summary>Nama lain pada tiket</summary>
                            {row.sourceNames.slice(1).map((name) => (
                              <p key={name}>{name}</p>
                            ))}
                          </details>
                        )}
                      </td>
                      <td>
                        {row.ticketCount}
                        <details>
                          <summary>Lihat sumber</summary>
                          {row.tickets.map((ticket) => (
                            <p key={ticket.id}>
                              <Link href={`/tickets/${ticket.id}`}>{ticket.trackingId}</Link>{' '}
                              {ticket.category || 'Tanpa kategori'}
                            </p>
                          ))}
                        </details>
                      </td>
                      <td>
                        {labels[row.status]}
                        {row.needsConfirmation && <small style={{ display: 'block' }}>Perlu konfirmasi sumber/format</small>}
                        {row.reasons?.map((reason) => (
                          <small key={reason} style={{ display: 'block' }}>
                            {reason}
                          </small>
                        ))}
                      </td>
                      <td>
                        {row.serviceId && <Link href={`/assets/${row.serviceId}`}>Buka Asset</Link>}
                        {isEligible && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setCheckedCids([]);
                              openRowForMapping(row);
                            }}
                          >
                            {row.serviceId ? 'Tautkan tiket' : 'Tautkan customer & layanan'}
                          </button>
                        )}
                        {row.status === 'conflict' && (
                          <span>Periksa CID duplikat atau tautan pada tiket sumber.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && !data.items.length && (
            <p>Tidak ada kode layanan yang cocok. Subject Trouble dan teks bebas tidak menjadi sumber CID baru.</p>
          )}
          {data && (
            <div className={styles.pagination}>
              <button type="button" disabled={page <= 1 || pending} onClick={() => setPage((value) => value - 1)}>
                Sebelumnya
              </button>
              <span>
                Halaman {page} · {data.total} hasil
              </span>
              <button
                type="button"
                disabled={page * data.pageSize >= data.total || pending}
                onClick={() => setPage((value) => value + 1)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <section id="sap-circuits" className={styles.panel} aria-label="CID dari tiket">
      {layout === 'split' ? (
        <div className={cleanup.splitLayout}>
          {tableSection}
          <aside className={cleanup.splitInspector} aria-label="Panel pemetaan CID">
            {isBatchMode ? (
              renderBatchForm()
            ) : activeSingleRow ? (
              <>
                <div className={cleanup.inspectorHead}>
                  <h3>Tautkan Customer & Layanan</h3>
                  <button
                    type="button"
                    className={cleanup.compactAction}
                    onClick={() => {
                      setSelected(null);
                      setCheckedCids([]);
                    }}
                  >
                    Tutup
                  </button>
                </div>
                {renderSingleForm(activeSingleRow, false)}
              </>
            ) : (
              <div>
                <div className={cleanup.inspectorHead}>
                  <h3>Inspector Penautan CID</h3>
                </div>
                <p>
                  Pilih satu CID di sebelah kiri untuk menautkan ke Customer dan Produk, atau centang beberapa CID sekaligus untuk pemetaan <strong>Batch</strong> ke satu Customer resmi.
                </p>
                {onCustomerCreated && renderInlineCustomerCreator('')}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <>
          {tableSection}
          {selected && (
            <dialog
              ref={dialogRef}
              className={ui.dialog}
              aria-label={`Tautkan ${selected.cid}`}
              onKeyDown={trapFocus}
              onCancel={(event) => {
                event.preventDefault();
                if (!pending) setSelected(null);
              }}
            >
              <div className={ui.dialogHead}>
                <h2>Tautkan customer & layanan</h2>
                <button type="button" disabled={pending} onClick={() => setSelected(null)}>
                  Tutup
                </button>
              </div>
              {renderSingleForm(selected, true)}
            </dialog>
          )}
        </>
      )}
    </section>
  );
}

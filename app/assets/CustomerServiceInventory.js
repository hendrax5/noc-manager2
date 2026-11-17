'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import CustomerServiceList from './CustomerServiceList';
import { selectServiceInventory } from '@/lib/customers/serviceInventoryView';
import { findCustomerDuplicateSuggestions } from '@/lib/customers/duplicateDetection';
import { formatCustomerId } from '@/lib/customers/identity';
import AssetCombobox from './AssetCombobox';
import CustomerInventoryRow from './CustomerInventoryRow';
import styles from './customer-services.module.css';
import cleanup from './assets-cleanup.module.css';
import ui from './assets-ui.module.css';

export default function CustomerServiceInventory({
  customers = [],
  services = [],
  templates = [],
  archivedCustomers = [],
  canManage = false,
  initialFilterPatch = null,
  openDuplicatesSignal = 0,
  onOpenCustomerModal,
  onCustomerMerged,
  onServiceUpdated,
}) {
  const [filters, setFilters] = useState({ query: '', templateId: '', status: '', missingCidOnly: false });
  const resetRef = useRef(null);
  const [page, setPage] = useState(1);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Merge customer modal state
  const [mergeState, setMergeState] = useState(null);
  const [mergePending, setMergePending] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const mergeDialogRef = useRef(null);

  // Reassign service modal state
  const [editingService, setEditingService] = useState(null);
  const [serviceDraft, setServiceDraft] = useState(null);
  const [servicePending, setServicePending] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const serviceDialogRef = useRef(null);

  useEffect(() => {
    if (!initialFilterPatch) return;
    setFilters((prev) => ({
      query: '',
      templateId: '',
      status: '',
      missingCidOnly: false,
      ...initialFilterPatch,
    }));
    setPage(1);
    setExpandedCustomerId(null);
  }, [initialFilterPatch]);

  useEffect(() => {
    if (openDuplicatesSignal > 0) setShowDuplicates(true);
  }, [openDuplicatesSignal]);

  useEffect(() => {
    const dialog = mergeDialogRef.current;
    if (!mergeState || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [mergeState]);

  useEffect(() => {
    const dialog = serviceDialogRef.current;
    if (!editingService || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [editingService]);

  const serviceCounts = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const cid = Number(s.customerId ?? s.customer?.id);
      if (cid > 0) map.set(cid, (map.get(cid) || 0) + 1);
    }
    return map;
  }, [services]);

  const duplicateSuggestions = useMemo(
    () => findCustomerDuplicateSuggestions(customers, { serviceCounts }),
    [customers, serviceCounts],
  );

  const view = selectServiceInventory({ customers, services, ...filters, page });
  if (page !== view.page) setPage(view.page);
  if (expandedCustomerId !== null && !view.groups.some((g) => g.customer.id === expandedCustomerId)) {
    setExpandedCustomerId(null);
  }

  const products = [
    ...new Map(
      services
        .filter((s) => s.templateId ?? s.template?.id)
        .map((s) => [
          String(s.templateId ?? s.template.id),
          { value: String(s.templateId ?? s.template.id), label: s.template?.name || 'Produk ' + s.templateId },
        ]),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));

  function updateFilters(patch) {
    const next = { ...filters, ...patch };
    const result = selectServiceInventory({ customers, services, ...next });
    setFilters(next);
    setPage(1);
    setExpandedCustomerId(result.customerCount === 1 ? result.groups[0].customer.id : null);
  }

  function reset() {
    setFilters({ query: '', templateId: '', status: '', missingCidOnly: false });
    setPage(1);
    setExpandedCustomerId(null);
    resetRef.current?.focus();
  }

  function openMergeModal({ sourceId = '', targetId = '' } = {}) {
    setMergeError('');
    setMergeState({
      sourceCustomerId: sourceId ? Number(sourceId) : '',
      targetCustomerId: targetId ? Number(targetId) : '',
      copyMissingContact: true,
      confirmMerge: false,
    });
  }

  function openEditService(service) {
    setServiceError('');
    setEditingService(service);
    setServiceDraft({
      customerId: Number(service.customerId ?? service.customer?.id ?? ''),
      templateId: Number(service.templateId ?? service.template?.id ?? ''),
      name: service.name || '',
      status: service.status || 'Active',
    });
  }

  async function submitMerge(event) {
    event.preventDefault();
    if (!mergeState?.sourceCustomerId || !mergeState?.targetCustomerId) {
      setMergeError('Pilih customer sumber dan customer tujuan terlebih dahulu.');
      return;
    }
    setMergePending(true);
    setMergeError('');
    try {
      const response = await fetch('/api/assets/customers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergeState),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Customer gagal digabungkan.');
      setFeedback(
        `${result.sourceName} berhasil digabung ke ${result.targetName} (${result.movedServices} layanan dipindahkan, sumber diarsipkan).`,
      );
      setMergeState(null);
      setExpandedCustomerId(result.targetId);
      await onCustomerMerged?.(result);
    } catch (e) {
      setMergeError(e.message);
    } finally {
      setMergePending(false);
    }
  }

  async function submitServiceEdit(event) {
    event.preventDefault();
    if (!editingService || !serviceDraft) return;
    setServicePending(true);
    setServiceError('');
    try {
      const response = await fetch(`/api/assets/services/${editingService.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(serviceDraft.customerId),
          templateId: Number(serviceDraft.templateId),
          name: serviceDraft.name.trim(),
          status: serviceDraft.status,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Layanan gagal diperbarui.');
      setFeedback(`Layanan "${serviceDraft.name.trim()}" berhasil diperbarui.`);
      setEditingService(null);
      setServiceDraft(null);
      await onServiceUpdated?.(result.service);
    } catch (e) {
      setServiceError(e.message);
    } finally {
      setServicePending(false);
    }
  }

  const hasManagementTools = Boolean(onOpenCustomerModal || onCustomerMerged || onServiceUpdated);
  const mergeSourceCustomer = customers.find((c) => c.id === Number(mergeState?.sourceCustomerId));
  const mergeTargetCustomer = customers.find((c) => c.id === Number(mergeState?.targetCustomerId));
  const mergeMoveCount = mergeSourceCustomer ? serviceCounts.get(mergeSourceCustomer.id) || 0 : 0;

  return (
    <section className={styles.inventory} aria-label="Layanan per customer">
      <div className={styles.toolbar}>
        <label htmlFor="inventory-search">
          Cari customer, Customer ID, atau CID
          <input
            id="inventory-search"
            type="search"
            value={filters.query}
            onChange={(e) => updateFilters({ query: e.target.value })}
            placeholder="Nama customer atau kode circuit"
          />
        </label>
        <AssetCombobox
          label="Tipe layanan"
          value={filters.templateId}
          options={[{ value: '', label: 'Semua tipe' }, ...products]}
          onChange={(value) => updateFilters({ templateId: value })}
        />
        <AssetCombobox
          label="Status layanan"
          value={filters.status}
          options={[
            { value: '', label: 'Semua status' },
            { value: 'Active', label: 'Aktif' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Suspended', label: 'Ditangguhkan' },
            { value: 'Terminated', label: 'Terminasi' },
          ]}
          onChange={(value) => updateFilters({ status: value })}
        />
        <button ref={resetRef} type="button" onClick={reset}>
          Reset filter
        </button>
      </div>

      {hasManagementTools && (
        <div className={cleanup.inventoryActions}>
          {canManage && onOpenCustomerModal && (
            <button type="button" className={cleanup.primaryAction} onClick={() => onOpenCustomerModal(null)}>
              + Tambah customer
            </button>
          )}
          <button
            type="button"
            className={cleanup.secondaryAction}
            aria-pressed={filters.missingCidOnly}
            onClick={() => updateFilters({ missingCidOnly: !filters.missingCidOnly })}
          >
            Hanya tanpa CID
          </button>
          {canManage && onCustomerMerged && duplicateSuggestions.length > 0 && (
            <button
              type="button"
              className={cleanup.secondaryAction}
              aria-pressed={showDuplicates}
              onClick={() => setShowDuplicates((v) => !v)}
            >
              Saran duplikat ({duplicateSuggestions.length})
            </button>
          )}
          {canManage && onCustomerMerged && (
            <button type="button" className={cleanup.secondaryAction} onClick={() => openMergeModal()}>
              Gabungkan customer (Merge)
            </button>
          )}
          {archivedCustomers.length > 0 && (
            <button
              type="button"
              className={cleanup.secondaryAction}
              aria-pressed={showArchives}
              onClick={() => setShowArchives((v) => !v)}
            >
              Arsip merge ({archivedCustomers.length})
            </button>
          )}
        </div>
      )}

      {feedback && (
        <p role="status" className={cleanup.alertSuccess}>
          {feedback}
        </p>
      )}

      {showDuplicates && duplicateSuggestions.length > 0 && canManage && onCustomerMerged && (
        <div className={cleanup.dupBanner} aria-label="Kandidat duplikat customer">
          <div className={cleanup.dupBannerHead}>
            <strong>{duplicateSuggestions.length} kandidat duplikat customer ditemukan</strong>
            <button type="button" className={cleanup.compactAction} onClick={() => setShowDuplicates(false)}>
              Tutup daftar
            </button>
          </div>
          <div className={cleanup.dupList}>
            {duplicateSuggestions.slice(0, 8).map((pair) => (
              <div key={`${pair.sourceId}-${pair.targetId}`} className={cleanup.dupItem}>
                <div>
                  <strong>{pair.sourceName}</strong> ({pair.sourceServiceCount} layanan) →{' '}
                  <strong>{pair.targetName}</strong> ({pair.targetServiceCount} layanan)
                  <div className={cleanup.dupMeta}>
                    {pair.reason} · Skor kemiripan {Math.round(pair.score * 100)}%
                  </div>
                </div>
                <button
                  type="button"
                  className={cleanup.compactAction}
                  onClick={() => openMergeModal({ sourceId: pair.sourceId, targetId: pair.targetId })}
                >
                  Tinjau Merge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p role="status" className={styles.summary}>
        {view.customerCount} customer · {view.serviceCount} layanan
      </p>

      <div className={styles.customerList}>
        {view.groups.map((group) => {
          const c = group.customer;
          const aliases = c.mergedAliases || [];
          return (
            <CustomerInventoryRow
              key={c.id}
              customer={c}
              serviceCount={group.services.length}
              totalServiceCount={group.totalServiceCount}
              pendingCount={group.pendingCount}
              expanded={expandedCustomerId === c.id}
              onToggle={() => setExpandedCustomerId(expandedCustomerId === c.id ? null : c.id)}
            >
              {hasManagementTools && (
                <div className={cleanup.custBar}>
                  <div className={cleanup.custMeta}>
                    <span>{c.contactEmail || 'Email belum diisi'}</span>
                    <span>{c.contactPhone || 'Telp/NOC belum diisi'}</span>
                    {aliases.map((alias) => (
                      <span key={alias.id} className={cleanup.aliasBadge}>
                        Alias merge: {alias.name}
                      </span>
                    ))}
                  </div>
                  {canManage && (
                    <div className={cleanup.custBtnGroup}>
                      {onOpenCustomerModal && (
                        <button type="button" className={cleanup.compactAction} onClick={() => onOpenCustomerModal(c)}>
                          Edit profil
                        </button>
                      )}
                      {onCustomerMerged && (
                        <button
                          type="button"
                          className={cleanup.compactAction}
                          onClick={() => openMergeModal({ sourceId: c.id })}
                        >
                          Gabungkan ke customer lain
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <CustomerServiceList
                customer={c}
                services={group.services}
                canManage={canManage}
                onEditService={onServiceUpdated ? openEditService : undefined}
              />
            </CustomerInventoryRow>
          );
        })}
      </div>

      {!view.customerCount && (
        <div className={styles.empty}>
          <p>Tidak ada customer atau layanan yang cocok.</p>
          <button type="button" onClick={reset}>
            Reset filter
          </button>
        </div>
      )}

      {view.pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Halaman customer">
          <span>
            Menampilkan {(view.page - 1) * 25 + 1}–{Math.min(view.page * 25, view.customerCount)} dari{' '}
            {view.customerCount} customer
          </span>
          <div>
            <button
              type="button"
              disabled={view.page <= 1}
              onClick={() => {
                setPage(view.page - 1);
                setExpandedCustomerId(null);
              }}
            >
              Sebelumnya
            </button>
            <span>
              {' '}
              {view.page}/{view.pageCount}{' '}
            </span>
            <button
              type="button"
              disabled={view.page >= view.pageCount}
              onClick={() => {
                setPage(view.page + 1);
                setExpandedCustomerId(null);
              }}
            >
              Berikutnya
            </button>
          </div>
        </nav>
      )}

      {showArchives && archivedCustomers.length > 0 && (
        <div className={cleanup.archiveCard} aria-label="Riwayat arsip merge customer">
          <h3>Customer Terarsip Hasil Merge ({archivedCustomers.length})</h3>
          <ul className={cleanup.archiveList}>
            {archivedCustomers.map((arc) => (
              <li key={arc.id}>
                <span>
                  <strong>{arc.name}</strong> ({formatCustomerId(arc)})
                </span>
                <span>
                  Digabung ke: <strong>{arc.mergedInto?.name || `#${arc.mergedIntoId}`}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mergeState && (
        <dialog
          ref={mergeDialogRef}
          className={ui.dialog}
          aria-label="Gabungkan duplikat customer"
          onCancel={(e) => {
            e.preventDefault();
            if (!mergePending) setMergeState(null);
          }}
        >
          <div className={ui.dialogHead}>
            <h2>Gabungkan Duplikat Customer</h2>
            <button type="button" disabled={mergePending} onClick={() => setMergeState(null)}>
              Tutup
            </button>
          </div>
          <form className={cleanup.dialogStack} onSubmit={submitMerge}>
            {mergeError && (
              <p role="alert" className={cleanup.alertError}>
                {mergeError}
              </p>
            )}
            <AssetCombobox
              label="Customer sumber (akan diarsipkan) *"
              required
              value={mergeState.sourceCustomerId}
              options={customers
                .filter((c) => c.id !== Number(mergeState.targetCustomerId))
                .map((c) => ({
                  value: c.id,
                  label: `${formatCustomerId(c)} — ${c.name} (${serviceCounts.get(c.id) || 0} layanan)`,
                }))}
              onChange={(val) => setMergeState((s) => ({ ...s, sourceCustomerId: val ? Number(val) : '' }))}
            />
            <AssetCombobox
              label="Customer resmi tujuan (tetap aktif) *"
              required
              value={mergeState.targetCustomerId}
              options={customers
                .filter((c) => c.id !== Number(mergeState.sourceCustomerId))
                .map((c) => ({
                  value: c.id,
                  label: `${formatCustomerId(c)} — ${c.name} (${serviceCounts.get(c.id) || 0} layanan)`,
                }))}
              onChange={(val) => setMergeState((s) => ({ ...s, targetCustomerId: val ? Number(val) : '' }))}
            />
            {mergeSourceCustomer && mergeTargetCustomer && (
              <div>
                <button
                  type="button"
                  className={cleanup.compactAction}
                  onClick={() =>
                    setMergeState((s) => ({
                      ...s,
                      sourceCustomerId: s.targetCustomerId,
                      targetCustomerId: s.sourceCustomerId,
                    }))
                  }
                >
                  Tukar arah (sumber ↔ tujuan)
                </button>
              </div>
            )}
            {mergeSourceCustomer && mergeTargetCustomer && (
              <div className={cleanup.previewBox}>
                <strong>Ringkasan dampak:</strong> {mergeMoveCount} layanan milik{' '}
                <strong>{mergeSourceCustomer.name}</strong> akan dipindahkan ke{' '}
                <strong>{mergeTargetCustomer.name}</strong>. Customer sumber tidak dihapus permanen melainkan diarsipkan
                dan dicatat sebagai alias riwayat.
              </div>
            )}
            <label className={cleanup.checkboxRow}>
              <input
                type="checkbox"
                checked={!!mergeState.copyMissingContact}
                onChange={(e) => setMergeState((s) => ({ ...s, copyMissingContact: e.target.checked }))}
              />
              <span>Salin email/telepon dari customer sumber jika customer tujuan masih kosong</span>
            </label>
            <label className={cleanup.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={!!mergeState.confirmMerge}
                onChange={(e) => setMergeState((s) => ({ ...s, confirmMerge: e.target.checked }))}
              />
              <span>Saya mengonfirmasi penggabungan ini dan memahami aksi akan dicatat di log audit.</span>
            </label>
            <div className={ui.footer}>
              <button type="button" disabled={mergePending} onClick={() => setMergeState(null)}>
                Batal
              </button>
              <button type="submit" disabled={mergePending}>
                {mergePending ? 'Menggabungkan…' : 'Gabungkan & Arsipkan'}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {editingService && serviceDraft && (
        <dialog
          ref={serviceDialogRef}
          className={ui.dialog}
          aria-label={`Ubah layanan ${editingService.name}`}
          onCancel={(e) => {
            e.preventDefault();
            if (!servicePending) setEditingService(null);
          }}
        >
          <div className={ui.dialogHead}>
            <h2>Ubah Pemilik / Produk Layanan</h2>
            <button type="button" disabled={servicePending} onClick={() => setEditingService(null)}>
              Tutup
            </button>
          </div>
          <form className={cleanup.dialogStack} onSubmit={submitServiceEdit}>
            {serviceError && (
              <p role="alert" className={cleanup.alertError}>
                {serviceError}
              </p>
            )}
            <AssetCombobox
              label="Customer pemilik *"
              required
              value={serviceDraft.customerId}
              options={customers.map((c) => ({ value: c.id, label: `${formatCustomerId(c)} — ${c.name}` }))}
              onChange={(val) => setServiceDraft((d) => ({ ...d, customerId: val ? Number(val) : '' }))}
            />
            <AssetCombobox
              label="Produk layanan *"
              required
              value={serviceDraft.templateId}
              options={templates
                .filter((t) => t.active !== false || t.id === serviceDraft.templateId)
                .map((t) => ({ value: t.id, label: t.name }))}
              onChange={(val) => setServiceDraft((d) => ({ ...d, templateId: val ? Number(val) : '' }))}
            />
            <label>
              Nama site / layanan *
              <input
                required
                maxLength={500}
                value={serviceDraft.name}
                onChange={(e) => setServiceDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <AssetCombobox
              label="Status layanan"
              value={serviceDraft.status}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Suspended', label: 'Suspended' },
                { value: 'Terminated', label: 'Terminated' },
              ]}
              onChange={(val) => setServiceDraft((d) => ({ ...d, status: val || 'Active' }))}
            />
            <div className={ui.footer}>
              <button type="button" disabled={servicePending} onClick={() => setEditingService(null)}>
                Batal
              </button>
              <button type="submit" disabled={servicePending}>
                {servicePending ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}

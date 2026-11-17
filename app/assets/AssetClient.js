'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { findCustomerDuplicateSuggestions } from '@/lib/customers/duplicateDetection';
import { getServiceCid } from '@/lib/services/cid';
import SapCircuitsClient from './SapCircuitsClient';
import ServicePortfolio from './ServicePortfolio';
import CustomerServiceInventory from './CustomerServiceInventory';
import AssetMasterList from './AssetMasterList';
import ui from './assets-ui.module.css';
import cleanup from './assets-cleanup.module.css';

function readTemplateFields(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((f) => f && typeof f.name === 'string') : [];
  } catch {
    return [];
  }
}

export default function AssetClient({
  session,
  initialCustomers = [],
  initialArchivedCustomers = [],
  initialTemplates = [],
  initialServices = [],
}) {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [productSubTab, setProductSubTab] = useState('templates');

  const [customers, setCustomers] = useState(initialCustomers || []);
  const [archivedCustomers, setArchivedCustomers] = useState(initialArchivedCustomers || []);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [services, setServices] = useState(initialServices || []);

  const [inventoryFilterPatch, setInventoryFilterPatch] = useState(null);
  const [openDuplicatesSignal, setOpenDuplicatesSignal] = useState(0);
  const [sapInitialStatus, setSapInitialStatus] = useState('pending');
  const [unlinkedCidCount, setUnlinkedCidCount] = useState(null);
  const [blastQuery, setBlastQuery] = useState('');

  // Customer Dialog
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [customerData, setCustomerData] = useState({ name: '', contactEmail: '', contactPhone: '' });
  const [customerError, setCustomerError] = useState('');
  const customerDialogRef = useRef(null);

  // Template Dialog
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState(null);
  const [templateData, setTemplateData] = useState({ name: '' });
  const [templateFields, setTemplateFields] = useState([{ name: '', type: 'text', required: true }]);
  const [templateError, setTemplateError] = useState('');
  const templateDialogRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('manage_assets');

  useEffect(() => {
    const syncHash = () => {
      const h = window.location.hash;
      if (['#sap-circuits', '#circuit-candidates'].includes(h)) {
        setActiveTab('sap');
      } else if (['#inventory', '#customers'].includes(h)) {
        setActiveTab('inventory');
      } else if (h === '#blast') {
        setActiveTab('products');
        setProductSubTab('blast');
      } else if (h === '#products') {
        setActiveTab('products');
        setProductSubTab('templates');
      } else {
        setActiveTab('portfolio');
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    fetch('/api/assets/circuit-candidates?status=pending&page=1', { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        if (!controller.signal.aborted && body?.summary) {
          setUnlinkedCidCount(body.summary.needsMapping ?? null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    const dialog = customerDialogRef.current;
    if (!showCustomerModal || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [showCustomerModal]);

  useEffect(() => {
    const dialog = templateDialogRef.current;
    if (!showTemplateModal || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [showTemplateModal]);

  const serviceCounts = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const cid = Number(s.customerId ?? s.customer?.id);
      if (cid > 0) map.set(cid, (map.get(cid) || 0) + 1);
    }
    return map;
  }, [services]);

  const duplicateCount = useMemo(
    () => findCustomerDuplicateSuggestions(customers, { serviceCounts }).length,
    [customers, serviceCounts],
  );
  const pendingServiceCount = useMemo(
    () => services.filter((s) => s.status === 'Pending').length,
    [services],
  );

  function switchTab(tabKey, subTab = null) {
    setActiveTab(tabKey);
    if (subTab) setProductSubTab(subTab);
    const hash =
      tabKey === 'sap'
        ? '#sap-circuits'
        : tabKey === 'inventory'
          ? '#inventory'
          : tabKey === 'products'
            ? subTab === 'blast'
              ? '#blast'
              : '#products'
            : window.location.pathname;
    window.history.replaceState(null, '', hash);
  }

  function openCustomerModal(customer = null) {
    setCustomerError('');
    if (customer) {
      setEditCustomerId(customer.id);
      setCustomerData({
        name: customer.name || '',
        contactEmail: customer.contactEmail || '',
        contactPhone: customer.contactPhone || '',
      });
    } else {
      setEditCustomerId(null);
      setCustomerData({ name: '', contactEmail: '', contactPhone: '' });
    }
    setShowCustomerModal(true);
  }

  async function refreshCustomersAndServices() {
    const [custRes, srvRes] = await Promise.all([
      fetch('/api/assets/customers?includeArchived=true', { cache: 'no-store' }),
      fetch('/api/assets/services', { cache: 'no-store' }),
    ]);
    if (custRes.ok) {
      const all = await custRes.json();
      setCustomers(all.filter((c) => c.active !== false));
      setArchivedCustomers(all.filter((c) => c.active === false));
    }
    if (srvRes.ok) {
      setServices(await srvRes.json());
    }
  }

  const blastMatches = useMemo(() => {
    const q = blastQuery.trim().toLowerCase();
    if (q.length <= 1) return [];
    return services
      .map((srv) => {
        const matchedHops = (srv.hops || []).filter(
          (h) =>
            h.location?.toLowerCase().includes(q) ||
            h.deviceName?.toLowerCase().includes(q) ||
            h.portName?.toLowerCase().includes(q),
        );
        return matchedHops.length ? { srv, matchedHops } : null;
      })
      .filter(Boolean);
  }, [blastQuery, services]);

  const tabs = [
    ['portfolio', 'Ringkasan & Perapihan'],
    ['inventory', `Customer & Circuit (${customers.length})`],
    ...(isAdmin ? [['sap', unlinkedCidCount ? `Penautan CID (${unlinkedCidCount})` : 'Penautan CID']] : []),
    ['products', `Produk & Dampak (${templates.length})`],
  ];

  return (
    <main className={`container ${ui.page}`}>
      <header className={ui.header}>
        <h1>Customer & layanan</h1>
        {isAdmin && (
          <Link href="/assets/new" className="primary-btn btn-fit">
            Tambah layanan
          </Link>
        )}
      </header>

      <nav className={ui.tabs} aria-label="Pengelolaan Assets">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            onClick={() => switchTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'portfolio' && (
        <ServicePortfolio
          duplicateCount={duplicateCount}
          unlinkedCidCount={unlinkedCidCount}
          pendingServiceCount={pendingServiceCount}
          onOpenDuplicates={() => {
            setInventoryFilterPatch({ query: '', templateId: '', status: '', missingCidOnly: false });
            setOpenDuplicatesSignal((n) => n + 1);
            switchTab('inventory');
          }}
          onOpenUnlinkedCids={() => {
            setSapInitialStatus('needs_mapping');
            switchTab('sap');
          }}
          onOpenMissingCidServices={() => {
            setInventoryFilterPatch({ missingCidOnly: true });
            switchTab('inventory');
          }}
          onOpenPendingServices={() => {
            setInventoryFilterPatch({ status: 'Pending' });
            switchTab('inventory');
          }}
        />
      )}

      {activeTab === 'inventory' && (
        <CustomerServiceInventory
          customers={customers}
          services={services}
          templates={templates}
          archivedCustomers={archivedCustomers}
          canManage={isAdmin}
          initialFilterPatch={inventoryFilterPatch}
          openDuplicatesSignal={openDuplicatesSignal}
          onOpenCustomerModal={isAdmin ? openCustomerModal : undefined}
          onCustomerMerged={refreshCustomersAndServices}
          onServiceUpdated={async () => {
            const response = await fetch('/api/assets/services', { cache: 'no-store' });
            if (response.ok) setServices(await response.json());
          }}
        />
      )}

      {activeTab === 'sap' && isAdmin && (
        <SapCircuitsClient
          layout="split"
          initialStatus={sapInitialStatus}
          customers={customers}
          templates={templates}
          services={services}
          onSummaryLoaded={(summary) => {
            if (summary && typeof summary.needsMapping === 'number') {
              setUnlinkedCidCount(summary.needsMapping);
            }
          }}
          onMapped={async () => {
            const response = await fetch('/api/assets/services', { cache: 'no-store' });
            if (response.ok) setServices(await response.json());
          }}
          onCustomerCreated={(newCustomer) => {
            setCustomers((prev) =>
              [...prev, { ...newCustomer, mergedAliases: newCustomer.mergedAliases || [] }].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            );
          }}
          onCreateCustomer={() => openCustomerModal(null)}
          onManageProducts={() => switchTab('products', 'templates')}
        />
      )}

      {activeTab === 'products' && (
        <section aria-label="Katalog Produk dan Analisis Dampak">
          <div className={cleanup.subTabs} role="group" aria-label="Sub-menu Produk dan Dampak">
            <button
              type="button"
              className={cleanup.secondaryAction}
              aria-pressed={productSubTab === 'templates'}
              onClick={() => switchTab('products', 'templates')}
            >
              Produk layanan ({templates.length})
            </button>
            <button
              type="button"
              className={cleanup.secondaryAction}
              aria-pressed={productSubTab === 'blast'}
              onClick={() => switchTab('products', 'blast')}
            >
              Analisis dampak jaringan
            </button>
          </div>

          {productSubTab === 'templates' && (
            <AssetMasterList
              title="Produk layanan"
              columns={['Produk', 'Status', 'Layanan', 'Field tambahan', ...(isAdmin ? ['Aksi'] : [])]}
              addLabel="Tambah produk"
              onAdd={
                isAdmin
                  ? () => {
                      setEditTemplateId(null);
                      setTemplateData({ name: '' });
                      setTemplateFields([{ name: '', type: 'text', required: true }]);
                      setTemplateError('');
                      setShowTemplateModal(true);
                    }
                  : undefined
              }
              rows={templates.map((t) => {
                const fields = readTemplateFields(t.fields);
                return {
                  id: t.id,
                  search: `${t.name} ${t.active ? 'Aktif' : 'Arsip'}`,
                  cells: [
                    <strong key="name">{t.name}</strong>,
                    t.active ? 'Aktif' : 'Arsip',
                    services.filter((service) => (service.templateId ?? service.template?.id) === t.id).length,
                    <details key="fields">
                      <summary>{fields.length} field</summary>
                      {fields.length > 0 ? (
                        <ul>
                          {fields.map((field, i) => (
                            <li key={i}>
                              {field.name} <small>{String(field.type || 'text')}</small>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <small>Tidak ada field tambahan.</small>
                      )}
                    </details>,
                    ...(isAdmin
                      ? [
                          <div key="actions">
                            <button
                              type="button"
                              onClick={() => {
                                setEditTemplateId(t.id);
                                setTemplateData({ name: t.name });
                                setTemplateFields(fields.length ? fields : [{ name: '', type: 'text', required: true }]);
                                setTemplateError('');
                                setShowTemplateModal(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              data-danger="true"
                              onClick={async () => {
                                if (!confirm(`Hapus produk ${t.name}?`)) return;
                                try {
                                  const res = await fetch(`/api/assets/templates/${t.id}`, { method: 'DELETE' });
                                  if (res.ok) setTemplates((prev) => prev.filter((x) => x.id !== t.id));
                                  else alert((await res.json()).error);
                                } catch {
                                  alert('Produk gagal dihapus. Coba lagi.');
                                }
                              }}
                            >
                              Hapus
                            </button>
                          </div>,
                        ]
                      : []),
                  ],
                };
              })}
            />
          )}

          {productSubTab === 'blast' && (
            <div>
              <div className={cleanup.blastPanel}>
                <h2>Lacak Dampak Upstream (Blast Radius)</h2>
                <p>
                  Cari nama Datacenter, perangkat Router, atau port interface untuk melihat layanan customer mana saja yang melewati node tersebut saat terjadi gangguan.
                </p>
                <label htmlFor="blast-query-input" className="sr-only">
                  Cari node, device, atau port
                </label>
                <input
                  id="blast-query-input"
                  type="search"
                  placeholder="Contoh: Cyber-1, xe-0/0/0, MKT-ROUTER…"
                  value={blastQuery}
                  onChange={(e) => setBlastQuery(e.target.value)}
                  className={cleanup.blastInput}
                />
              </div>

              {blastQuery.trim().length > 1 && (
                <div className={cleanup.blastGrid}>
                  {blastMatches.map(({ srv, matchedHops }) => (
                    <article key={srv.id} className={cleanup.blastCard}>
                      <div>
                        <span className={ui.badge}>Customer Terdampak</span>
                        <h3>{srv.customer?.name || 'Customer tidak tercatat'}</h3>
                        <Link href={`/assets/${srv.id}`}>
                          {srv.name} {getServiceCid(srv) ? `(${getServiceCid(srv)})` : ''}
                        </Link>
                      </div>
                      <ul className={cleanup.blastNodes}>
                        {matchedHops.map((h, i) => (
                          <li key={i}>
                            <strong>{h.location}</strong> — {h.deviceName} · {h.portName}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                  {!blastMatches.length && (
                    <div className={cleanup.blastPanel}>
                      Tidak ada layanan customer yang melewati node tersebut.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* CUSTOMER DIALOG */}
      {showCustomerModal && (
        <dialog
          ref={customerDialogRef}
          className={ui.dialog}
          aria-label={editCustomerId ? 'Edit Customer' : 'Register Customer'}
          onCancel={(e) => {
            e.preventDefault();
            if (!isSubmitting) setShowCustomerModal(false);
          }}
        >
          <div className={ui.dialogHead}>
            <h2>{editCustomerId ? 'Edit Customer' : 'Register Customer'}</h2>
            <button type="button" disabled={isSubmitting} onClick={() => setShowCustomerModal(false)}>
              Tutup
            </button>
          </div>
          <form
            className={cleanup.dialogStack}
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              setCustomerError('');
              try {
                const isEdit = !!editCustomerId;
                const url = isEdit ? `/api/assets/customers/${editCustomerId}` : '/api/assets/customers';
                const method = isEdit ? 'PATCH' : 'POST';
                const res = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(customerData),
                });
                const body = await res.json();
                if (res.ok) {
                  if (isEdit) {
                    setCustomers((prev) =>
                      prev
                        .map((c) => (c.id === editCustomerId ? body : c))
                        .sort((a, b) => a.name.localeCompare(b.name)),
                    );
                  } else {
                    setCustomers((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name)));
                  }
                  setShowCustomerModal(false);
                } else {
                  setCustomerError(body.error || 'Customer gagal disimpan.');
                }
              } catch {
                setCustomerError('Gagal menyimpan data customer.');
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {customerError && (
              <p role="alert" className={cleanup.alertError}>
                {customerError}
              </p>
            )}
            <label htmlFor="cust-name-input">
              Nama Perusahaan / Customer *
              <input
                id="cust-name-input"
                type="text"
                required
                value={customerData.name}
                onChange={(e) => setCustomerData((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label htmlFor="cust-email-input">
              Email Kontak
              <input
                id="cust-email-input"
                type="email"
                value={customerData.contactEmail}
                onChange={(e) => setCustomerData((p) => ({ ...p, contactEmail: e.target.value }))}
              />
            </label>
            <label htmlFor="cust-phone-input">
              Telepon / NOC
              <input
                id="cust-phone-input"
                type="text"
                value={customerData.contactPhone}
                onChange={(e) => setCustomerData((p) => ({ ...p, contactPhone: e.target.value }))}
              />
            </label>
            <div className={ui.footer}>
              <button type="button" disabled={isSubmitting} onClick={() => setShowCustomerModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editCustomerId ? 'Simpan' : 'Register'}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {/* TEMPLATE DIALOG */}
      {showTemplateModal && (
        <dialog
          ref={templateDialogRef}
          className={ui.dialog}
          aria-label={editTemplateId ? 'Edit Template' : 'Define Service Template'}
          onCancel={(e) => {
            e.preventDefault();
            if (!isSubmitting) setShowTemplateModal(false);
          }}
        >
          <div className={ui.dialogHead}>
            <h2>{editTemplateId ? 'Edit Template' : 'Define Service Template'}</h2>
            <button type="button" disabled={isSubmitting} onClick={() => setShowTemplateModal(false)}>
              Tutup
            </button>
          </div>
          <form
            className={cleanup.dialogStack}
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              setTemplateError('');
              try {
                const isEdit = !!editTemplateId;
                const url = isEdit ? `/api/assets/templates/${editTemplateId}` : '/api/assets/templates';
                const method = isEdit ? 'PATCH' : 'POST';
                const payload = {
                  name: templateData.name,
                  fields: templateFields.filter((f) => f.name.trim() !== ''),
                };
                const res = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                const body = await res.json();
                if (res.ok) {
                  if (isEdit) {
                    setTemplates((prev) =>
                      prev
                        .map((t) => (t.id === editTemplateId ? body : t))
                        .sort((a, b) => a.name.localeCompare(b.name)),
                    );
                  } else {
                    setTemplates((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name)));
                  }
                  setShowTemplateModal(false);
                } else {
                  setTemplateError(body.error || 'Produk gagal disimpan.');
                }
              } catch {
                setTemplateError('Gagal menyimpan produk.');
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {templateError && (
              <p role="alert" className={cleanup.alertError}>
                {templateError}
              </p>
            )}
            <label htmlFor="tmpl-name-input">
              Template Name *
              <input
                id="tmpl-name-input"
                type="text"
                required
                placeholder="Contoh: IPLC DWDM"
                value={templateData.name}
                onChange={(e) => setTemplateData((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <div className={cleanup.dialogStack}>
              <div className={ui.dialogHead}>
                <strong>Parameter Tambahan</strong>
                <button
                  type="button"
                  className={cleanup.compactAction}
                  onClick={() => setTemplateFields([...templateFields, { name: '', type: 'text', required: false }])}
                >
                  + Add Field
                </button>
              </div>
              {templateFields.map((f, i) => (
                <div key={i} className={cleanup.fieldRow}>
                  <input
                    type="text"
                    aria-label={`Nama field ${i + 1}`}
                    placeholder="Nama field (mis. Bandwidth)"
                    required
                    value={f.name}
                    onChange={(e) => {
                      const arr = [...templateFields];
                      arr[i] = { ...arr[i], name: e.target.value };
                      setTemplateFields(arr);
                    }}
                  />
                  <select
                    aria-label={`Tipe field ${i + 1}`}
                    value={f.type}
                    onChange={(e) => {
                      const arr = [...templateFields];
                      arr[i] = { ...arr[i], type: e.target.value };
                      setTemplateFields(arr);
                    }}
                  >
                    <option value="text">Text / String</option>
                    <option value="number">Number</option>
                  </select>
                  {templateFields.length > 1 && (
                    <button
                      type="button"
                      className={cleanup.compactAction}
                      aria-label={`Hapus field ${i + 1}`}
                      onClick={() => setTemplateFields(templateFields.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className={ui.footer}>
              <button type="button" disabled={isSubmitting} onClick={() => setShowTemplateModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  );
}

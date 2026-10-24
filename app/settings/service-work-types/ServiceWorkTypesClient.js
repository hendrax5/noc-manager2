'use client';

import { useEffect, useId, useRef, useState } from 'react';
import MasterPicker from '@/components/MasterPicker';
import styles from './masters.module.css';

const operations = { Installation: 'Instalasi Baru', Upgrade: 'Upgrade', Downgrade: 'Downgrade', Change: 'Perubahan Layanan', Terminate: 'Terminasi', BOD: 'BOD', DataCenter: 'Pekerjaan Data Center' };
const label = 'Jenis pekerjaan';
const hint = 'Jenis pekerjaan menentukan perubahan circuit. Job Category hanya disarankan dan menentukan poin.';
const emptyDraft = { name: '', operation: 'Installation', defaultJobCategoryId: '', sortOrder: '0' };

const icons = {
  plus: <path d="M8 3v10M3 8h10" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>,
  edit: <><path d="M11.25 2.5 13.5 4.75 5.25 13H3v-2.25z" /></>,
  trash: <><path d="M2.75 4.25h10.5M6.25 4.25v-2h3.5v2M4.5 4.25l.6 9h5.8l.6-9" /></>,
  alert: <><path d="M8 1.75 15 14.25H1z" /><path d="M8 6v3.75M8 11.75v.5" /></>,
  close: <path d="m4.25 4.25 7.5 7.5M11.75 4.25l-7.5 7.5" />,
};

function Icon({ name, className }) {
  return <svg className={className} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

function normalizeName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function Skeleton() {
  return <div className={styles.skeleton} aria-hidden="true">{['a', 'b', 'c', 'd'].map(row => <div key={row} className={styles.skeletonRow}><span className={styles.skeletonBar} /><span className={styles.skeletonBar} /><span className={styles.skeletonBar} /></div>)}</div>;
}

export default function ServiceWorkTypesClient({ categories = [] }) {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [pendingId, setPendingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const nameRef = useRef(null);
  const confirmCloseRef = useRef(null);
  const createRef = useRef(null);
  const returnFocusRef = useRef(null);
  const nameInputId = useId();
  const operationInputId = useId();
  const categoryInputId = useId();
  const orderInputId = useId();
  const titleId = useId();
  const confirmTitleId = useId();

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/service-work-types?includeInactive=true', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `${label} gagal dimuat.`);
      setEntries(Array.isArray(body) ? body : []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), 2600);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  useEffect(() => {
    if (!formOpen && !deleteTarget) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [formOpen, deleteTarget]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (formOpen && !dialog.open) {
      returnFocusRef.current = document.activeElement;
      dialog.showModal();
      nameRef.current?.focus();
    } else if (!formOpen && dialog.open) {
      dialog.close();
    }
  }, [formOpen]);

  useEffect(() => {
    const dialog = confirmRef.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) {
      returnFocusRef.current = document.activeElement;
      dialog.showModal();
      confirmCloseRef.current?.focus();
    } else if (!deleteTarget && dialog.open) {
      dialog.close();
    }
  }, [deleteTarget]);

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft);
    setErrors({});
  }

  function openCreate() {
    resetForm();
    const nextOrder = entries.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), -1) + 1;
    setDraft({ ...emptyDraft, sortOrder: String(nextOrder) });
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setDraft({ name: row.name, operation: row.operation, defaultJobCategoryId: row.defaultJobCategoryId === null || row.defaultJobCategoryId === undefined ? '' : String(row.defaultJobCategoryId), sortOrder: String(row.sortOrder ?? 0) });
    setErrors({});
    setFormOpen(true);
  }

  function handleFormClosed() {
    setFormOpen(false);
    resetForm();
    const target = returnFocusRef.current;
    if (target?.isConnected) target.focus();
  }

  function handleConfirmClosed() {
    setDeleteTarget(null);
    setDeleteError('');
    const target = returnFocusRef.current;
    if (target?.isConnected) target.focus();
    else createRef.current?.focus();
  }

  async function save(event) {
    event.preventDefault();
    const name = String(draft.name || '').normalize('NFKC').trim().replace(/\s+/gu, ' ');
    const sortOrder = Number(String(draft.sortOrder ?? '').trim() === '' ? 0 : draft.sortOrder);
    const categoryMissing = draft.defaultJobCategoryId !== '' && !categories.some(category => String(category.id) === String(draft.defaultJobCategoryId));
    const found = {};
    if (!name) found.name = 'Nama wajib diisi.';
    else if (entries.some(row => row.id !== editingId && normalizeName(row.name) === normalizeName(name))) found.name = `Nama ini sudah dipakai pada daftar ${label.toLowerCase()}.`;
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) found.sortOrder = 'Urutan harus bilangan bulat antara -100000 dan 100000.';
    if (categoryMissing) found.category = 'Pilih Job Category aktif atau kosongkan saran.';
    if (Object.keys(found).length) {
      setErrors(found);
      if (found.name) nameRef.current?.focus();
      return;
    }
    setSaving(true); setErrors({});
    try {
      const payload = { name, sortOrder, defaultJobCategoryId: draft.defaultJobCategoryId === '' ? null : Number(draft.defaultJobCategoryId), ...(editingId ? {} : { operation: draft.operation, active: true }) };
      const response = await fetch(editingId ? `/api/service-work-types/${editingId}` : '/api/service-work-types', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setErrors({ name: body.error || 'Nama sudah dipakai.' }); nameRef.current?.focus(); return; }
        throw new Error(body.error || `${label} gagal disimpan.`);
      }
      setEntries(previous => {
        const existing = previous.find(row => row.id === body.id);
        return [...previous.filter(row => row.id !== body.id), { usageCount: existing?.usageCount ?? 0, ...body }];
      });
      setNotice(editingId ? `${label} “${body.name}” diperbarui.` : `${label} “${body.name}” ditambahkan.`);
      setHighlightedId(body.id);
      setFormOpen(false);
    } catch (e) { setErrors({ form: e.message }); } finally { setSaving(false); }
  }

  async function toggleActive(row) {
    const next = !row.active;
    setPendingId(row.id); setError('');
    setEntries(previous => previous.map(item => item.id === row.id ? { ...item, active: next } : item));
    try {
      const response = await fetch(`/api/service-work-types/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Status master gagal diubah.');
      setEntries(previous => previous.map(item => item.id === row.id ? { ...item, ...body } : item));
      setNotice(`${label} “${row.name}” ${next ? 'diaktifkan' : 'dinonaktifkan'}.`);
      setHighlightedId(row.id);
      return true;
    } catch (e) {
      setEntries(previous => previous.map(item => item.id === row.id ? { ...item, active: row.active } : item));
      setError(e.message);
      return false;
    } finally { setPendingId(null); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteError('');
    try {
      const response = await fetch(`/api/service-work-types/${deleteTarget.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${label} gagal dihapus.`);
      setEntries(previous => previous.filter(row => row.id !== deleteTarget.id));
      setNotice(`${label} “${deleteTarget.name}” dihapus.`);
      setDeleteTarget(null);
    } catch (e) { setDeleteError(e.message); } finally { setDeleteBusy(false); }
  }

  const term = query.trim().toLowerCase();
  const visible = entries
    .filter(row => `${row.name} ${operations[row.operation] || row.operation} ${categories.find(category => category.id === row.defaultJobCategoryId)?.name || ''}`.toLowerCase().includes(term))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || String(a.name).localeCompare(String(b.name)));
  const activeCount = entries.filter(row => row.active).length;
  const categoryName = row => row.defaultJobCategoryId ? categories.find(category => category.id === row.defaultJobCategoryId)?.name || 'Nonaktif/tidak tersedia' : 'Tanpa saran';
  const operationOptions = Object.entries(operations).map(([value, name]) => ({ value, label: name }));
  const categoryMissingValue = draft.defaultJobCategoryId !== '' && !categories.some(category => String(category.id) === String(draft.defaultJobCategoryId));
  const categoryOptions = [
    { value: '', label: 'Tanpa saran' },
    ...categories.map(category => ({ value: String(category.id), label: category.name })),
    ...(categoryMissingValue ? [{ value: String(draft.defaultJobCategoryId), label: 'Kategori nonaktif/tidak tersedia — pilih ulang', disabled: true }] : []),
  ];

  return <section className={styles.layout} aria-label="Pengelolaan jenis pekerjaan layanan">
    <div className={styles.toolbar}>
      <div className={styles.toolbarActions}>
        <label className={styles.search}>
          <Icon name="search" className={styles.searchIcon} />
          <span className={styles.srOnly}>Cari jenis pekerjaan</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari jenis pekerjaan, operasi, atau job category" />
        </label>
        <button ref={createRef} type="button" className={styles.primary} disabled={loading} onClick={openCreate}><Icon name="plus" />Tambah jenis pekerjaan</button>
      </div>
    </div>

    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <div className={styles.alert} role="alert"><Icon name="alert" /><span>{error}</span><button type="button" className={styles.alertAction} onClick={load}>Muat ulang</button></div>}

    <section className={styles.panel} aria-label="Daftar jenis pekerjaan" aria-busy={loading}>
      <div className={styles.panelHead}>
        <p className={styles.summary} role="status">{loading ? `Memuat ${label.toLowerCase()}…` : `${term ? `${visible.length} dari ${entries.length}` : entries.length} ${label.toLowerCase()} · ${activeCount} aktif`}</p>
        <p className={styles.sortNote}>Diurutkan dari urutan terkecil</p>
      </div>

      {loading ? <Skeleton /> : visible.length ? <div className={styles.tableWrap}>
        <table className={styles.table} role="table">
          <caption className={styles.srOnly}>Daftar {label.toLowerCase()} beserta operasi, saran job category, status, urutan, dan tindakan</caption>
          <thead><tr role="row">
            <th scope="col" role="columnheader">{label}</th>
            <th scope="col" role="columnheader">Operasi</th>
            <th scope="col" role="columnheader">Saran Job Category</th>
            <th scope="col" role="columnheader">Status</th>
            <th scope="col" role="columnheader" className={styles.orderHead}>Urutan</th>
            <th scope="col" role="columnheader" className={styles.actionsHead}>Tindakan</th>
          </tr></thead>
          <tbody>{visible.map(row => <tr key={row.id} role="row" className={styles.row} data-active={row.active} data-highlight={highlightedId === row.id ? 'true' : undefined}>
            <th scope="row" role="rowheader" className={styles.nameCell}>
              <span className={styles.name}>{row.name}</span>
              {row.usageCount > 0 && <span className={styles.usage}>Dipakai {row.usageCount} tiket</span>}
            </th>
            <td role="cell" className={styles.operationCell}>{operations[row.operation] || row.operation}</td>
            <td role="cell" className={styles.categoryCell}>{categoryName(row)}</td>
            <td role="cell" className={styles.statusCell}>
              <button type="button" role="switch" aria-checked={row.active} className={styles.switch} disabled={pendingId === row.id} onClick={() => toggleActive(row)}>
                <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>
                <span>{row.active ? 'Aktif' : 'Nonaktif'}</span>
                <span className={styles.srOnly}>{` — ${row.name}`}</span>
              </button>
            </td>
            <td role="cell" className={styles.orderCell}>{row.sortOrder}</td>
            <td role="cell" className={styles.actionsCell}>
              <div className={styles.rowActions}>
                <button type="button" className={styles.secondary} aria-label={`Edit ${row.name}`} onClick={() => openEdit(row)}><Icon name="edit" />Edit</button>
                <button type="button" className={styles.dangerGhost} aria-label={`Hapus ${row.name}`} onClick={() => { setDeleteError(''); setDeleteTarget(row); }}><Icon name="trash" />Hapus</button>
              </div>
            </td>
          </tr>)}</tbody>
        </table>
      </div> : <div className={styles.empty}>
        <h2>{entries.length ? `Tidak ada ${label.toLowerCase()} yang cocok` : `Belum ada ${label.toLowerCase()}`}</h2>
        <p>{entries.length ? <>Tidak ada nama, operasi, atau job category yang memuat “{query.trim()}”. Coba kata kunci lain atau tampilkan semua.</> : hint}</p>
        {entries.length
          ? <button type="button" className={styles.secondary} onClick={() => setQuery('')}>Bersihkan pencarian</button>
          : <button type="button" className={styles.primary} onClick={openCreate}><Icon name="plus" />Tambah jenis pekerjaan</button>}
      </div>}
    </section>

    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onClose={handleFormClosed}>
      <form className={styles.form} onSubmit={save} noValidate>
        <div className={styles.dialogHead}>
          <div>
            <h2 id={titleId}>{editingId ? <>Edit {label.toLowerCase()}</> : <>Tambah {label.toLowerCase()}</>}</h2>
            <p>{editingId ? 'Nama dan saran Job Category dapat diubah. Operasi layanan tidak dapat diubah setelah dibuat.' : hint}</p>
          </div>
          <button type="button" className={styles.iconButton} onClick={() => setFormOpen(false)} aria-label="Tutup formulir"><Icon name="close" /></button>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor={nameInputId}>Nama jenis pekerjaan</label>
            <input ref={nameRef} id={nameInputId} required maxLength={80} autoComplete="off" value={draft.name}
              aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? `${nameInputId}-error` : `${nameInputId}-hint`}
              onChange={event => { setDraft({ ...draft, name: event.target.value }); if (errors.name) setErrors(previous => ({ ...previous, name: '' })); }} />
            {errors.name
              ? <p id={`${nameInputId}-error`} className={styles.fieldError} role="alert">{errors.name}</p>
              : <p id={`${nameInputId}-hint`} className={styles.hint}>Tampil di form tiket. Maksimal 80 karakter.</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor={operationInputId}>Operasi layanan</label>
            <MasterPicker id={operationInputId} value={draft.operation} options={operationOptions} disabled={Boolean(editingId)}
              onChange={operation => setDraft({ ...draft, operation })} describedBy={`${operationInputId}-hint`} />
            <p id={`${operationInputId}-hint`} className={styles.hint}>{editingId ? 'Operasi tidak dapat diubah setelah jenis pekerjaan dibuat.' : 'Menentukan perubahan circuit yang dijalankan tiket.'}</p>
          </div>
          <div className={styles.field}>
            <label htmlFor={categoryInputId}>Saran Job Category</label>
            <MasterPicker id={categoryInputId} value={draft.defaultJobCategoryId} options={categoryOptions} invalid={Boolean(errors.category)}
              onChange={defaultJobCategoryId => { setDraft({ ...draft, defaultJobCategoryId }); if (errors.category) setErrors(previous => ({ ...previous, category: '' })); }}
              describedBy={errors.category ? `${categoryInputId}-error` : `${categoryInputId}-hint`} />
            {errors.category
              ? <p id={`${categoryInputId}-error`} className={styles.fieldError} role="alert">{errors.category}</p>
              : <p id={`${categoryInputId}-hint`} className={styles.hint}>Saran dapat diganti operator berizin pada tiket.</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor={orderInputId}>Urutan tampil</label>
            <input id={orderInputId} type="number" min={-100000} max={100000} step={1} required value={draft.sortOrder}
              aria-invalid={errors.sortOrder ? 'true' : undefined} aria-describedby={errors.sortOrder ? `${orderInputId}-error` : `${orderInputId}-hint`}
              onChange={event => { setDraft({ ...draft, sortOrder: event.target.value }); if (errors.sortOrder) setErrors(previous => ({ ...previous, sortOrder: '' })); }} />
            {errors.sortOrder
              ? <p id={`${orderInputId}-error`} className={styles.fieldError} role="alert">{errors.sortOrder}</p>
              : <p id={`${orderInputId}-hint`} className={styles.hint}>Angka lebih kecil tampil lebih dulu di form tiket.</p>}
          </div>
        </div>

        {errors.form && <p className={styles.formError} role="alert">{errors.form}</p>}

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.secondary} disabled={saving} onClick={() => setFormOpen(false)}>Batal</button>
          <button type="submit" className={styles.primary} disabled={saving}>{saving && <span className={styles.spinner} aria-hidden="true" />}{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </dialog>

    <dialog ref={confirmRef} className={styles.dialog} aria-labelledby={confirmTitleId} onClose={handleConfirmClosed}>
      {deleteTarget && <div className={styles.form}>
        <div className={styles.dialogHead}>
          <div>
            <h2 id={confirmTitleId}>{deleteTarget.usageCount > 0 ? 'Tidak bisa dihapus' : `Hapus ${label.toLowerCase()} ini?`}</h2>
            <p>{deleteTarget.usageCount > 0
              ? `“${deleteTarget.name}” sudah dipakai ${deleteTarget.usageCount} tiket. Riwayat tiket harus tetap utuh, jadi master ini hanya bisa dinonaktifkan.`
              : `“${deleteTarget.name}” tidak dipakai tiket mana pun. Menghapusnya permanen dan tidak bisa dibatalkan.`}</p>
          </div>
        </div>
        {deleteError && <p className={styles.formError} role="alert">{deleteError}</p>}
        <div className={styles.dialogFooter}>
          <button ref={confirmCloseRef} type="button" className={styles.secondary} disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>Tutup</button>
          {deleteTarget.usageCount > 0
            ? deleteTarget.active && <button type="button" className={styles.primary} disabled={deleteBusy} onClick={async () => { const ok = await toggleActive(deleteTarget); if (ok) setDeleteTarget(null); }}>Nonaktifkan</button>
            : <button type="button" className={styles.danger} disabled={deleteBusy} onClick={remove}>{deleteBusy ? 'Menghapus…' : 'Hapus permanen'}</button>}
        </div>
      </div>}
    </dialog>
  </section>;
}

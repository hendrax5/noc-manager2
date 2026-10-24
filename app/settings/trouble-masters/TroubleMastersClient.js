'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './masters.module.css';

const labels = { symptom: 'Gejala', cause: 'Penyebab' };
const hints = {
  symptom: 'Gejala yang terlihat operator, misalnya Down atau Packet Loss.',
  cause: 'Penyebab gangguan. Sediakan “Belum diketahui” selama investigasi.',
};
const emptyDraft = { name: '', description: '', sortOrder: '0' };

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

export default function TroubleMastersClient() {
  const [kind, setKind] = useState('symptom');
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
  const descriptionInputId = useId();
  const orderInputId = useId();
  const titleId = useId();
  const confirmTitleId = useId();

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/trouble-masters?includeInactive=true', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Master gagal dimuat.');
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
    const nextOrder = entries.filter(row => row.kind === kind).reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), -1) + 1;
    setDraft({ ...emptyDraft, sortOrder: String(nextOrder) });
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setDraft({ name: row.name, description: row.description || '', sortOrder: String(row.sortOrder ?? 0) });
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
    const found = {};
    if (!name) found.name = 'Nama wajib diisi.';
    else if (entries.some(row => row.id !== editingId && row.kind === kind && normalizeName(row.name) === normalizeName(name))) {
      found.name = `Nama ini sudah dipakai pada daftar ${labels[kind].toLowerCase()}.`;
    }
    if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) found.sortOrder = 'Urutan harus bilangan bulat antara -100000 dan 100000.';
    if (Object.keys(found).length) {
      setErrors(found);
      if (found.name) nameRef.current?.focus();
      return;
    }
    setSaving(true); setErrors({});
    try {
      const payload = { name, description: draft.description.trim(), sortOrder, ...(editingId ? {} : { kind, active: true }) };
      const response = await fetch(editingId ? `/api/trouble-masters/${editingId}` : '/api/trouble-masters', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setErrors({ name: body.error || 'Nama sudah dipakai.' }); nameRef.current?.focus(); return; }
        throw new Error(body.error || 'Master gagal disimpan.');
      }
      setEntries(previous => {
        const existing = previous.find(row => row.id === body.id);
        return [...previous.filter(row => row.id !== body.id), { usageCount: existing?.usageCount ?? 0, ...body }];
      });
      setNotice(editingId ? `${labels[kind]} “${body.name}” diperbarui.` : `${labels[kind]} “${body.name}” ditambahkan.`);
      setHighlightedId(body.id);
      setFormOpen(false);
    } catch (e) { setErrors({ form: e.message }); } finally { setSaving(false); }
  }

  async function toggleActive(row) {
    const next = !row.active;
    setPendingId(row.id); setError('');
    setEntries(previous => previous.map(item => item.id === row.id ? { ...item, active: next } : item));
    try {
      const response = await fetch(`/api/trouble-masters/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Status master gagal diubah.');
      setEntries(previous => previous.map(item => item.id === row.id ? { ...item, ...body } : item));
      setNotice(`${labels[row.kind]} “${row.name}” ${next ? 'diaktifkan' : 'dinonaktifkan'}.`);
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
      const response = await fetch(`/api/trouble-masters/${deleteTarget.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Master gagal dihapus.');
      setEntries(previous => previous.filter(row => row.id !== deleteTarget.id));
      setNotice(`${labels[deleteTarget.kind]} “${deleteTarget.name}” dihapus.`);
      setDeleteTarget(null);
    } catch (e) { setDeleteError(e.message); } finally { setDeleteBusy(false); }
  }

  const kindEntries = entries.filter(row => row.kind === kind);
  const term = query.trim().toLowerCase();
  const visible = kindEntries
    .filter(row => `${row.name} ${row.description || ''}`.toLowerCase().includes(term))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || String(a.name).localeCompare(String(b.name)));
  const activeCount = kindEntries.filter(row => row.active).length;
  const label = labels[kind];

  return <section className={styles.layout} aria-label="Pengelolaan master trouble">
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="group" aria-label="Jenis master">
        {Object.entries(labels).map(([value, name]) => <button key={value} type="button" className={styles.tab} aria-pressed={kind === value} disabled={saving}
          onClick={() => { setKind(value); setQuery(''); setError(''); setNotice(''); }}>{name}<span className={styles.tabCount}>{entries.filter(row => row.kind === value).length}</span></button>)}
      </div>
      <div className={styles.toolbarActions}>
        <label className={styles.search}>
          <Icon name="search" className={styles.searchIcon} />
          <span className={styles.srOnly}>Cari {label}</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Cari ${label.toLowerCase()} atau deskripsi`} />
        </label>
        <button ref={createRef} type="button" className={styles.primary} disabled={loading} onClick={openCreate}><Icon name="plus" />Tambah {label}</button>
      </div>
    </div>

    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <div className={styles.alert} role="alert"><Icon name="alert" /><span>{error}</span><button type="button" className={styles.alertAction} onClick={load}>Muat ulang</button></div>}

    <section className={styles.panel} aria-label={`Daftar ${label.toLowerCase()}`} aria-busy={loading}>
      <div className={styles.panelHead}>
        <p className={styles.summary} role="status">{loading ? `Memuat ${label.toLowerCase()}…` : `${term ? `${visible.length} dari ${kindEntries.length}` : kindEntries.length} ${label.toLowerCase()} · ${activeCount} aktif`}</p>
        <p className={styles.sortNote}>Diurutkan dari urutan terkecil</p>
      </div>

      {loading ? <Skeleton /> : visible.length ? <div className={styles.tableWrap}>
        <table className={styles.table} role="table">
          <caption className={styles.srOnly}>Daftar {label.toLowerCase()} beserta deskripsi, status, urutan, dan tindakan</caption>
          <thead><tr role="row">
            <th scope="col" role="columnheader">Nama</th>
            <th scope="col" role="columnheader">Deskripsi</th>
            <th scope="col" role="columnheader">Status</th>
            <th scope="col" role="columnheader" className={styles.orderHead}>Urutan</th>
            <th scope="col" role="columnheader" className={styles.actionsHead}>Tindakan</th>
          </tr></thead>
          <tbody>{visible.map(row => <tr key={row.id} role="row" className={styles.row} data-active={row.active} data-highlight={highlightedId === row.id ? 'true' : undefined}>
            <th scope="row" role="rowheader" className={styles.nameCell}>
              <span className={styles.name}>{row.name}</span>
              {row.usageCount > 0 && <span className={styles.usage}>Dipakai {row.usageCount} tiket</span>}
            </th>
            <td role="cell" className={styles.description}>{row.description || <span className={styles.muted}>Tanpa deskripsi</span>}</td>
            <td role="cell" className={styles.statusCell}>
              <button type="button" role="switch" aria-checked={row.active} className={styles.switch} disabled={pendingId === row.id}
                onClick={() => toggleActive(row)}>
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
        <h2>{kindEntries.length ? `Tidak ada ${label.toLowerCase()} yang cocok` : `Belum ada ${label.toLowerCase()}`}</h2>
        <p>{kindEntries.length ? <>Tidak ada nama atau deskripsi yang memuat “{query.trim()}”. Coba kata kunci lain atau tampilkan semua.</> : hints[kind]}</p>
        {kindEntries.length
          ? <button type="button" className={styles.secondary} onClick={() => setQuery('')}>Bersihkan pencarian</button>
          : <button type="button" className={styles.primary} onClick={openCreate}><Icon name="plus" />Tambah {label}</button>}
      </div>}
    </section>

    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onClose={handleFormClosed}>
      <form className={styles.form} onSubmit={save} noValidate>
        <div className={styles.dialogHead}>
          <div>
            <h2 id={titleId}>{editingId ? `Edit ${label}` : `Tambah ${label}`}</h2>
            <p>{editingId ? 'Perubahan nama tidak mengubah riwayat tiket yang sudah ada.' : hints[kind]}</p>
          </div>
          <button type="button" className={styles.iconButton} onClick={() => setFormOpen(false)} aria-label="Tutup formulir"><Icon name="close" /></button>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor={nameInputId}>Nama</label>
            <input ref={nameRef} id={nameInputId} required maxLength={80} autoComplete="off" value={draft.name}
              aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? `${nameInputId}-error` : `${nameInputId}-hint`}
              onChange={event => { setDraft({ ...draft, name: event.target.value }); if (errors.name) setErrors(previous => ({ ...previous, name: '' })); }} />
            {errors.name
              ? <p id={`${nameInputId}-error`} className={styles.fieldError} role="alert">{errors.name}</p>
              : <p id={`${nameInputId}-hint`} className={styles.hint}>Tampil di pilihan tiket. Maksimal 80 karakter.</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor={descriptionInputId}>Deskripsi <span className={styles.optional}>(opsional)</span></label>
            <textarea id={descriptionInputId} rows={3} maxLength={300} value={draft.description}
              onChange={event => setDraft({ ...draft, description: event.target.value })} />
            <span className={styles.counter}>{draft.description.length}/300</span>
          </div>
          <div className={styles.field}>
            <label htmlFor={orderInputId}>Urutan tampil</label>
            <input id={orderInputId} type="number" min={-100000} max={100000} step={1} required value={draft.sortOrder}
              aria-invalid={errors.sortOrder ? 'true' : undefined} aria-describedby={errors.sortOrder ? `${orderInputId}-error` : `${orderInputId}-hint`}
              onChange={event => { setDraft({ ...draft, sortOrder: event.target.value }); if (errors.sortOrder) setErrors(previous => ({ ...previous, sortOrder: '' })); }} />
            {errors.sortOrder
              ? <p id={`${orderInputId}-error`} className={styles.fieldError} role="alert">{errors.sortOrder}</p>
              : <p id={`${orderInputId}-hint`} className={styles.hint}>Angka lebih kecil tampil lebih dulu di pilihan tiket.</p>}
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
            <h2 id={confirmTitleId}>{deleteTarget.usageCount > 0 ? 'Tidak bisa dihapus' : `Hapus ${labels[deleteTarget.kind].toLowerCase()} ini?`}</h2>
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

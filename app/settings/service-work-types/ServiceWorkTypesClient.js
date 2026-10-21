'use client';

import { useEffect, useState } from 'react';
import styles from './masters.module.css';

const operations = { Installation: 'Instalasi Baru', Upgrade: 'Upgrade', Downgrade: 'Downgrade', Change: 'Perubahan Layanan', Terminate: 'Terminasi' };
const blank = { name: '', operation: 'Installation', defaultJobCategoryId: '', active: true, sortOrder: 0 };

export default function ServiceWorkTypesClient({ categories = [] }) {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/service-work-types?includeInactive=true', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Jenis pekerjaan gagal dimuat.');
      setEntries(body);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function reset() { setDraft(blank); setEditing(null); }
  async function save(event) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const payload = { name: draft.name, active: draft.active, sortOrder: Number(draft.sortOrder), defaultJobCategoryId: draft.defaultJobCategoryId === '' ? null : Number(draft.defaultJobCategoryId) };
      if (!editing) payload.operation = draft.operation;
      const response = await fetch(editing ? `/api/service-work-types/${editing}` : '/api/service-work-types', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Jenis pekerjaan gagal disimpan.');
      setEntries(previous => [...previous.filter(row => row.id !== body.id), body]);
      reset(); setNotice('Jenis pekerjaan berhasil disimpan.');
    } catch (e) { setError(e.message); } finally { setPending(false); }
  }
  const visible = entries.filter(row => `${row.name} ${operations[row.operation] || row.operation}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const missingCategory = draft.defaultJobCategoryId !== '' && !categories.some(category => String(category.id) === String(draft.defaultJobCategoryId));
  return <section className={styles.layout} aria-label="Pengelolaan jenis pekerjaan layanan">
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={save} className={styles.panel}>
      <h2>{editing ? 'Edit' : 'Tambah'} jenis pekerjaan</h2>
      <fieldset disabled={pending || loading} className={styles.fields}>
        <label>Nama jenis pekerjaan<input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Operasi layanan<select disabled={Boolean(editing)} value={draft.operation} onChange={e => setDraft({ ...draft, operation: e.target.value })}>{Object.entries(operations).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><small>Operasi tidak dapat diubah setelah jenis pekerjaan dibuat.</small></label>
        <label>Saran Job Category<select value={draft.defaultJobCategoryId} onChange={e => setDraft({ ...draft, defaultJobCategoryId: e.target.value })}><option value="">Tanpa saran</option>{missingCategory && <option value={draft.defaultJobCategoryId} disabled>Kategori nonaktif/tidak tersedia — pilih ulang</option>}{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small>Saran dapat diganti operator berizin pada tiket. Poin tetap mengikuti Job Category.</small></label>
        <label>Urutan<input type="number" min={-100000} max={100000} step={1} required value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: e.target.value })} /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />Aktif (tersedia untuk tiket baru)</label>
        <p>Nonaktifkan untuk menghentikan pilihan pada tiket baru. Riwayat tiket tetap tersimpan; aktifkan kembali melalui Edit.</p>
        <div className={styles.actions}><button type="submit" disabled={missingCategory} className="btn btn-primary">{pending ? 'Menyimpan…' : 'Simpan'}</button>{editing && <button type="button" onClick={reset}>Batal</button>}</div>
      </fieldset>
    </form>
    <section className={styles.panel} aria-label="Daftar jenis pekerjaan">
      <label className={styles.search}>Cari jenis pekerjaan<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      {loading ? <p role="status">Memuat jenis pekerjaan…</p> : <><p>{visible.length} hasil · {entries.filter(row => row.active).length} aktif</p><div className={styles.scroll}><table><thead><tr><th scope="col">Jenis pekerjaan</th><th scope="col">Operasi</th><th scope="col">Saran Job Category</th><th scope="col">Status</th><th scope="col">Urutan</th><th scope="col">Aksi</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{operations[row.operation] || row.operation}</td><td>{row.defaultJobCategoryId ? categories.find(category => category.id === row.defaultJobCategoryId)?.name || 'Nonaktif/tidak tersedia' : 'Tanpa saran'}</td><td>{row.active ? 'Aktif' : 'Nonaktif'}</td><td>{row.sortOrder}</td><td><button type="button" disabled={pending} aria-label={`Edit ${row.name}`} onClick={() => { setEditing(row.id); setDraft({ name: row.name, operation: row.operation, defaultJobCategoryId: row.defaultJobCategoryId ?? '', active: row.active, sortOrder: row.sortOrder }); setNotice(''); setError(''); }}>Edit</button></td></tr>)}</tbody></table></div>{!visible.length && <p>Belum ada jenis pekerjaan yang cocok.</p>}</>}
      {!loading && error && <button type="button" disabled={pending} onClick={load}>Muat ulang</button>}
    </section>
  </section>;
}

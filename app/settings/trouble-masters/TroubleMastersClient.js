'use client';

import { useEffect, useState } from 'react';
import styles from './masters.module.css';

const labels = { symptom: 'Gejala', cause: 'Penyebab' };
const blank = { name: '', description: '', active: true, sortOrder: 0 };

export default function TroubleMastersClient() {
  const [kind, setKind] = useState('symptom');
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm,setShowForm]=useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/trouble-masters?includeInactive=true', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Master gagal dimuat.');
      setEntries(body);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(editing ? `/api/trouble-masters/${editing}` : '/api/trouble-masters', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, kind, sortOrder: Number(draft.sortOrder) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Master gagal disimpan.');
      setEntries(previous => [...previous.filter(row => row.id !== body.id), body]);
      setDraft(blank); setEditing(null); setShowForm(false); setNotice('Master berhasil disimpan.');
    } catch (e) { setError(e.message); } finally { setPending(false); }
  }
  const visible = entries.filter(row => row.kind === kind && `${row.name} ${row.description || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return <section className={styles.layout} aria-label="Pengelolaan master trouble">
    <div className={styles.tabs} aria-label="Jenis master">{Object.entries(labels).map(([value,label]) => <button key={value} type="button" aria-pressed={kind === value} disabled={pending} onClick={() => { setKind(value); setEditing(null); setDraft(blank); setError(''); setNotice(''); }}>{label} ({entries.filter(row => row.kind === value).length})</button>)}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className={styles.panel} aria-label={`Daftar ${labels[kind]}`}>
      <div className={styles.actions}><label className={styles.search}>Cari {labels[kind]}<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" onClick={()=>{setEditing(null);setDraft(blank);setShowForm(true);}}>Tambah {labels[kind]}</button></div>
      {loading ? <p role="status">Memuat master…</p> : <><p>{visible.length} hasil · {entries.filter(row => row.kind === kind && row.active).length} aktif</p><div className={styles.scroll}><table><thead><tr><th scope="col">Nama</th><th scope="col">Deskripsi</th><th scope="col">Status</th><th scope="col">Urutan</th><th scope="col">Aksi</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.description || '—'}</td><td>{row.active ? 'Aktif' : 'Nonaktif'}</td><td>{row.sortOrder}</td><td><button type="button" disabled={pending} aria-label={`Edit ${row.name}`} onClick={() => { setEditing(row.id); setDraft({ name: row.name, description: row.description || '', active: row.active, sortOrder: row.sortOrder }); setNotice('');setShowForm(true); }}>Edit</button></td></tr>)}</tbody></table></div>{!visible.length && <p>Belum ada master yang cocok.</p>}</>}
      {!loading && error && <button type="button" disabled={pending} onClick={load}>Muat ulang</button>}
    </section>
    {showForm&&<form onSubmit={save} className={styles.panel}>
      <h2>{editing ? 'Edit' : 'Tambah'} {labels[kind]}</h2>
      <fieldset disabled={pending || loading} className={styles.fields}>
        <label>Nama<input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Deskripsi<textarea maxLength={300} rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
        <label>Urutan<input type="number" min={-100000} max={100000} step={1} required value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: e.target.value })} /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />Aktif (tersedia untuk tiket baru)</label>
        <div className={styles.actions}><button type="submit" className="btn btn-primary">{pending ? 'Menyimpan…' : 'Simpan'}</button><button type="button" onClick={() => { setEditing(null); setDraft(blank);setShowForm(false); }}>Batal</button></div>
      </fieldset>
    </form>}
  </section>;
}

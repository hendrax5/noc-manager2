'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './sap-circuits.module.css';
import { getServiceCid } from '@/lib/services/cid';

const labels={needs_mapping:'Belum tertaut ke layanan',ready_to_link:'Asset tersedia — tautkan tiket',linked:'Sudah tertaut',conflict:'Perlu diperiksa'};
export default function SapCircuitsClient({customers=[],templates=[],services=[],onMapped,onCreateCustomer,onManageProducts}) {
  const [query,setQuery]=useState(''),[q,setQ]=useState(''),[page,setPage]=useState(1),[status,setStatus]=useState('pending');
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  const [selected,setSelected]=useState(null),[draft,setDraft]=useState({}),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [mapped,setMapped]=useState(null);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch(`/api/assets/sap-circuits?q=${encodeURIComponent(q)}&page=${page}&status=${status}`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'CID SAP gagal dimuat.');setData(body);})
      .catch(e=>{if(e.name!=='AbortError')setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[q,page,status,reload]);
  async function save(event) {
    event.preventDefault();setPending(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/assets/sap-circuits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cid:selected.cid,...(selected.serviceId?{}:draft.existingServiceId==='new'?{...draft,existingServiceId:undefined}:{customerId:draft.customerId,existingServiceId:draft.existingServiceId})})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'CID gagal disimpan.');
      setNotice(`${result.cid}: ${result.created?'Asset dibuat; ':''}${result.linkedTickets} tiket ditautkan.`);
      setMapped(result);
      setSelected(null);setReload(value=>value+1);await onMapped?.(result);
    } catch(e) {setError(e.message);} finally {setPending(false);}
  }
  return <section id="sap-circuits" className={styles.panel} aria-label="CID SAP dari tiket">
    <h2>CID SAP dari tiket</h2>
    <p>CID terdeteksi otomatis dari Subject SAP lengkap. Angka SAP tidak menentukan customer. CID sudah tersedia. Tautkan CID ke customer dan layanan yang tepat agar dapat dipilih pada tiket berikutnya. Tipe layanan adalah milik layanan/CID, bukan customer.</p>
    {data&&<p>{data.summary.circuits} circuit · {data.summary.needsMapping} belum tertaut ke layanan · {data.summary.linked} sudah tertaut · {data.summary.conflicts} perlu diperiksa</p>}
    <form className={styles.filters} onSubmit={event=>{event.preventDefault();setQ(query);setPage(1);setReload(value=>value+1);}}>
      <label>Cari CID SAP atau nama pada tiket<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Contoh: SAP-C-1243-0003" /></label>
      <label>Tampilkan<select aria-label="Tampilkan" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="pending">Belum selesai ditautkan</option><option value="needs_mapping">Belum tertaut ke layanan</option><option value="ready_to_link">Asset tersedia</option><option value="linked">Sudah tertaut</option><option value="conflict">Perlu diperiksa</option><option value="all">Semua CID SAP</option></select></label>
      <button type="submit" disabled={loading}>Cari</button>
    </form>
    {error&&<p role="alert">{error} <button type="button" onClick={()=>setReload(value=>value+1)}>Muat ulang</button></p>}
    {notice&&<p role="status">{notice}</p>}
    {mapped&&<p><Link href={`/assets/${mapped.serviceId}`}>Buka Asset {mapped.cid}</Link> · <Link href={`/tickets/new?workType=Trouble&serviceId=${mapped.serviceId}`}>Buat Trouble untuk CID ini</Link></p>}
    {loading?<p role="status">Memuat CID SAP…</p>:<>
      <div className={styles.scroll}><table><thead><tr><th scope="col">CID</th><th scope="col">Nama pada tiket sumber</th><th scope="col">Tiket</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead><tbody>{data?.items.map(row=><tr key={row.cid}><th scope="row">{row.cid}</th><td>{row.sourceName||'Belum tersedia'}{row.sourceNames.length>1&&<details><summary>Nama lain pada tiket</summary>{row.sourceNames.slice(1).map(name=><p key={name}>{name}</p>)}</details>}</td><td>{row.ticketCount}<details><summary>Lihat sumber</summary>{row.tickets.map(ticket=><p key={ticket.id}><Link href={`/tickets/${ticket.id}`}>{ticket.trackingId}</Link></p>)}</details></td><td>{labels[row.status]}</td><td>{row.serviceId&&<Link href={`/assets/${row.serviceId}`}>Buka Asset</Link>}{row.status!=='conflict'&&row.status!=='linked'&&<button type="button" disabled={pending} onClick={()=>{setSelected(row);setDraft({name:(row.sourceName||row.cid).slice(0,500),customerId:'',templateId:'',status:'Pending',existingServiceId:''});setError('');setNotice('');}}>{row.serviceId?'Tautkan tiket':'Tautkan customer & layanan'}</button>}{row.status==='conflict'&&<span>Periksa CID duplikat atau tautan pada tiket sumber.</span>}</td></tr>)}</tbody></table></div>
      {data&&!data.items.length&&<p>Tidak ada CID SAP yang cocok. Subject non-SAP dan Subject dengan keterangan tambahan tidak dimasukkan otomatis.</p>}
      {data&&<div className={styles.pagination}><button type="button" disabled={page<=1||pending} onClick={()=>setPage(value=>value-1)}>Sebelumnya</button><span>Halaman {page} · {data.total} hasil</span><button type="button" disabled={page*data.pageSize>=data.total||pending} onClick={()=>setPage(value=>value+1)}>Berikutnya</button></div>}
    </>}
    {selected&&<form className={styles.mapping} onSubmit={save} aria-label={`Tautkan ${selected.cid}`}>
      <h3>{selected.cid}</h3><p>CID sudah terisi dari Subject tiket. Yang dipilih di bawah adalah customer pemilik dan layanan circuit ini.</p>
      <p>{selected.ticketCount} tiket sumber akan ditautkan tanpa mengubah status atau poin tiket.</p>
      <fieldset disabled={pending}>
        {!selected.serviceId&&<div className={styles.fields}>
          <label>Customer *<select aria-label="Customer *" required value={draft.customerId} onChange={e=>setDraft({...draft,customerId:e.target.value ? Number(e.target.value) : '',existingServiceId:''})}><option value="">Pilih customer yang memiliki circuit ini</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>Layanan milik customer *<select aria-label="Layanan milik customer *" required disabled={!draft.customerId} value={draft.existingServiceId} onChange={e=>setDraft({...draft,existingServiceId:e.target.value})}><option value="">Pilih layanan</option>{services.filter(service=>(service.customerId??service.customer?.id)===Number(draft.customerId)&&(!getServiceCid(service)||getServiceCid(service).toUpperCase()===selected.cid)).map(service=><option key={service.id} value={service.id}>{service.name} — {service.template?.name || 'Tanpa tipe'}</option>)}<option value="new">Buat layanan baru untuk CID ini</option></select></label>
          {draft.existingServiceId==='new'&&<>
          <label>Produk/Layanan *<select aria-label="Produk/Layanan *" required value={draft.templateId} onChange={e=>setDraft({...draft,templateId:Number(e.target.value)})}><option value="">Pilih produk</option>{templates.filter(template=>template.active!==false).map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          <label>Nama layanan *<input required maxLength={500} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></label>
          <label>Status layanan<select aria-label="Status layanan" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="Pending">Perlu diperiksa (Pending)</option><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Terminated">Terminated</option></select></label>
          </>}
          {draft.existingServiceId&&draft.existingServiceId!=='new'&&<p>Nama, tipe, kapasitas dan status layanan yang dipilih tetap digunakan. CID akan ditautkan ke layanan ini.</p>}
        </div>}
        {!selected.serviceId&&<p>Customer tidak disimpulkan dari angka CID atau nama tiket. Pilih layanan yang sudah ada; buat baru hanya jika belum terdaftar. <button type="button" onClick={onCreateCustomer}>Daftarkan customer</button> <button type="button" onClick={onManageProducts}>Kelola produk</button></p>}
        <div className={styles.pagination}><button type="submit">{pending?'Menyimpan…':selected.serviceId?'Tautkan tiket ke Asset':'Simpan CID & tautkan tiket'}</button><button type="button" onClick={()=>setSelected(null)}>Batal</button></div>
      </fieldset>
    </form>}
  </section>;
}

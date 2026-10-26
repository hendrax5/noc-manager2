'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCustomerId } from '@/lib/customers/identity';
import styles from './sap-circuits.module.css';
import { getServiceCid } from '@/lib/services/cid';
import AssetCombobox from './AssetCombobox';
import ui from './assets-ui.module.css';

const labels={needs_mapping:'Belum tertaut ke layanan',ready_to_link:'Asset tersedia — tautkan tiket',linked:'Sudah tertaut',conflict:'Perlu diperiksa'};
export default function SapCircuitsClient({customers=[],templates=[],services=[],onMapped,onCreateCustomer,onManageProducts}) {
  const [query,setQuery]=useState(''),[q,setQ]=useState(''),[page,setPage]=useState(1),[status,setStatus]=useState('pending');
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  const [selected,setSelected]=useState(null),[draft,setDraft]=useState({}),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [mapped,setMapped]=useState(null);
  const [family,setFamily]=useState('all');
  const mappingRef=useRef(null),dialogRef=useRef(null);
  useEffect(()=>{
    if(!selected||!dialogRef.current)return;
    const previous=document.activeElement,dialog=dialogRef.current;
    dialog.showModal();
    (dialog.querySelector('[role="combobox"]')||mappingRef.current)?.focus();
    return ()=>{dialog.close();if(previous?.isConnected)previous.focus();};
  },[selected]);
  function trapFocus(event){
    if(event.key!=='Tab')return;
    const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(e=>e.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  const target=services.find(service=>String(service.id)===String(draft.existingServiceId));
  const differentCid=!!(target&&getServiceCid(target)&&getServiceCid(target).toUpperCase()!==selected?.cid);
  function openMapping(row) {
    setSelected(row);
    setDraft({name:(row.sourceName||row.cid).slice(0,500),customerId:'',confirmAlias:false,confirmReview:false,confirmConflict:false,templateId:'',status:'Pending',existingServiceId:''});
    setError('');setNotice('');
  }
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch(`/api/assets/circuit-candidates?q=${encodeURIComponent(q)}&page=${page}&status=${status}&family=${encodeURIComponent(family)}`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'CID gagal dimuat.');setData(body);})
      .catch(e=>{if(e.name!=='AbortError')setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[q,page,status,family,reload]);
  async function save(event) {
    event.preventDefault();if(!selected.serviceId&&(!draft.customerId||!draft.existingServiceId||(draft.existingServiceId==='new'&&!draft.templateId))){setError('Pilih customer dan layanan dari daftar terlebih dahulu.');return;}setPending(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/assets/circuit-candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cid:selected.cid,confirmReview:draft.confirmReview,confirmConflict:draft.confirmConflict,...(selected.serviceId?{}:draft.existingServiceId==='new'?{...draft,existingServiceId:undefined}:{customerId:draft.customerId,existingServiceId:draft.existingServiceId,confirmAlias:draft.confirmAlias})})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'CID gagal disimpan.');
      setNotice(`${result.cid}: ${result.created?'Asset dibuat; ':''}${result.linkedTickets} tiket ditautkan.`);
      setMapped(result);
      setSelected(null);setReload(value=>value+1);await onMapped?.(result);
    } catch(e) {setError(e.message);} finally {setPending(false);}
  }
  return <section id="sap-circuits" className={styles.panel} aria-label="CID dari tiket">
    <h2>CID dari tiket</h2>
    <p>Kode SAP, I, C dan kode lama terdeteksi dari Subject lengkap pekerjaan layanan. Angka kode tidak menentukan customer. CID sudah tersedia. Tautkan CID ke customer dan layanan yang tepat agar dapat dipilih pada tiket berikutnya. Tipe layanan adalah milik layanan/CID, bukan customer.</p>
    {data&&<p>{data.summary.circuits} circuit · {data.summary.needsMapping} belum tertaut ke layanan · {data.summary.linked} sudah tertaut · {data.summary.conflicts} perlu diperiksa</p>}
    <form className={styles.filters} onSubmit={event=>{event.preventDefault();setQ(query);setPage(1);setReload(value=>value+1);}}>
      <label>Cari CID, nomor tiket, atau nama<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Contoh: SAP-C-1243-0003 atau HSK-N4VW-BS8S" /></label>
      <AssetCombobox label="Format kode" value={family} options={['all','SAP','I','C','I2','C2','C4','BH','R','P','L','DCLAND-C','DCLAND-I'].map(code=>({value:code,label:code==='all'?'Semua format':code}))} onChange={value=>{setFamily(value||'all');setPage(1);}}/>
      <AssetCombobox label="Tampilkan" value={status} options={[{value:'pending',label:'Belum selesai ditautkan'},{value:'needs_mapping',label:'Belum tertaut ke layanan'},{value:'ready_to_link',label:'Asset tersedia'},{value:'linked',label:'Sudah tertaut'},{value:'conflict',label:'Perlu diperiksa'},{value:'all',label:'Semua kode layanan'}]} onChange={value=>{setStatus(value||'pending');setPage(1);}}/>
      <button type="submit" disabled={loading}>Cari</button>
    </form>
    {error&&!selected&&<p role="alert">{error} <button type="button" onClick={()=>setReload(value=>value+1)}>Muat ulang</button></p>}
    {notice&&<p role="status">{notice}</p>}
    {mapped&&<p><Link href={`/assets/${mapped.serviceId}`}>Buka Asset {mapped.cid}</Link> · <Link href={`/tickets/new?workType=Trouble&serviceId=${mapped.serviceId}`}>Buat Trouble untuk CID ini</Link></p>}
    {loading?<p role="status">Memuat CID…</p>:<>
      <div className={styles.scroll}><table><thead><tr><th scope="col">CID</th><th scope="col">Nama pada tiket sumber</th><th scope="col">Tiket</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead><tbody>{data?.items.map(row=><tr key={row.cid}><th scope="row">{row.cid}</th><td>{row.sourceName||'Belum tersedia'}{row.sourceNames.length>1&&<details><summary>Nama lain pada tiket</summary>{row.sourceNames.slice(1).map(name=><p key={name}>{name}</p>)}</details>}</td><td>{row.ticketCount}{row.tickets?.[0]&&<> · <Link href={`/tickets/${row.tickets[0].id}`}>{row.tickets[0].trackingId}</Link></>}<details><summary>Lihat sumber</summary>{row.tickets.map(ticket=><p key={ticket.id}><Link href={`/tickets/${ticket.id}`}>{ticket.trackingId}</Link> {ticket.category||"Tanpa kategori"}</p>)}</details></td><td>{labels[row.status]}{row.needsConfirmation&&<small style={{display:'block'}}>Perlu konfirmasi sumber/format</small>}{row.reasons?.map(reason=><small key={reason} style={{display:'block'}}>{reason}</small>)}</td><td>{row.serviceId&&<Link href={`/assets/${row.serviceId}`}>Buka Asset</Link>}{row.status!=='linked'&&<button type="button" disabled={pending} onClick={()=>openMapping(row)}>{row.status==='conflict'?'Tautkan dengan konfirmasi':row.serviceId?'Tautkan tiket':'Tautkan customer & layanan'}</button>}{row.status==='conflict'&&<span>Nama/site pada tiket sumber berbeda. Buka konfirmasi bila kode ini memang milik customer yang sama.</span>}</td></tr>)}</tbody></table></div>
      {data&&!data.items.length&&<p>Tidak ada kode layanan yang cocok. Pencarian mencakup CID, nomor tiket sumber, dan nama pada tiket. Subject Trouble dan teks bebas tidak menjadi sumber CID baru.</p>}
      {data&&<div className={styles.pagination}><button type="button" disabled={page<=1||pending} onClick={()=>setPage(value=>value-1)}>Sebelumnya</button><span>Halaman {page} · {data.total} hasil</span><button type="button" disabled={page*data.pageSize>=data.total||pending} onClick={()=>setPage(value=>value+1)}>Berikutnya</button></div>}
    </>}
    {selected&&<dialog ref={dialogRef} className={ui.dialog} aria-label={`Tautkan ${selected.cid}`} onKeyDown={trapFocus} onCancel={event=>{event.preventDefault();if(!pending)setSelected(null);}}><div className={ui.dialogHead}><h2>Tautkan customer & layanan</h2><button type="button" disabled={pending} onClick={()=>setSelected(null)}>Tutup</button></div><form ref={mappingRef} tabIndex={-1} className={styles.mapping} onSubmit={save} aria-label={`Tautkan ${selected.cid}`}>
      <div className={ui.source}><h3>{selected.cid}</h3><p>{selected.sourceName}</p>{selected.tickets.map(ticket=><p key={ticket.id}><Link href={`/tickets/${ticket.id}`}>Tiket sumber {ticket.trackingId}</Link></p>)}<small>Order Origin dan Executing Vendor pada tiket sumber tetap dipertahankan.</small></div>{error&&<p role="alert" className={ui.message}>{error}</p>}<p>CID sudah terisi dari Subject tiket. Yang dipilih di bawah adalah customer pemilik dan layanan circuit ini.</p>
      <p>{selected.ticketCount} tiket sumber akan ditautkan tanpa mengubah status atau poin tiket.</p>
      <fieldset disabled={pending}>
        {!selected.serviceId&&<div className={ui.fields}>
          <AssetCombobox label="Customer *" required value={draft.customerId} options={customers.map(c=>({value:c.id,label:`${formatCustomerId(c)} — ${c.name}`}))} placeholder="Cari nama atau Customer ID" onChange={value=>setDraft({...draft,customerId:value?Number(value):'',existingServiceId:'',confirmAlias:false})}/>
          <AssetCombobox label="Layanan milik customer *" required disabled={!draft.customerId} value={draft.existingServiceId} options={[...services.filter(s=>(s.customerId??s.customer?.id)===Number(draft.customerId)).map(s=>({value:String(s.id),label:`${s.name} — ${s.template?.name||'Tanpa tipe'}${getServiceCid(s)?` (${getServiceCid(s)})`:''}`})),{value:'new',label:'Buat layanan baru untuk CID ini'}]} onChange={value=>setDraft({...draft,existingServiceId:value,confirmAlias:false})}/>
          {draft.existingServiceId==='new'&&<>
          <AssetCombobox label="Produk/Layanan *" required value={draft.templateId} options={templates.filter(t=>t.active!==false).map(t=>({value:t.id,label:t.name}))} onChange={value=>setDraft({...draft,templateId:value?Number(value):''})}/>
          <label>Nama layanan *<input required maxLength={500} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></label>
          <AssetCombobox label="Status layanan" value={draft.status} options={[{value:'Pending',label:'Perlu diperiksa (Pending)'},{value:'Active',label:'Active'},{value:'Suspended',label:'Suspended'},{value:'Terminated',label:'Terminated'}]} onChange={value=>setDraft({...draft,status:value})}/>
          </>}
          {draft.existingServiceId&&draft.existingServiceId!=='new'&&<p>Nama, tipe, kapasitas dan status layanan yang dipilih tetap digunakan. CID akan ditautkan ke layanan ini.</p>}
        </div>}
        {!selected.serviceId&&<p>Customer tidak disimpulkan dari angka CID atau nama tiket. Pilih layanan yang sudah ada; buat baru hanya jika belum terdaftar. <button type="button" onClick={()=>{setSelected(null);onCreateCustomer?.();}}>Daftarkan customer</button> <button type="button" onClick={()=>{setSelected(null);onManageProducts?.();}}>Kelola produk</button></p>}
        {selected.needsConfirmation&&<label><span><input style={{width:'auto'}} type="checkbox" required checked={!!draft.confirmReview} onChange={e=>setDraft({...draft,confirmReview:e.target.checked})}/> Saya sudah memeriksa sumber dan mengonfirmasi tiket ini adalah pekerjaan layanan.</span></label>}
        {selected.status==='conflict'&&<label><span><input style={{width:'auto'}} type="checkbox" required checked={!!draft.confirmConflict} onChange={e=>setDraft({...draft,confirmConflict:e.target.checked})}/> Saya sudah memeriksa: walaupun nama/site pada tiket sumber berbeda, kode {selected.cid} milik customer yang sama dan boleh ditautkan.</span></label>}
        {differentCid&&<label><span><input style={{width:'auto'}} type="checkbox" required checked={!!draft.confirmAlias} onChange={e=>setDraft({...draft,confirmAlias:e.target.checked})}/> Saya mengonfirmasi {selected.cid} dan CID utama {getServiceCid(target)} adalah circuit yang sama. Simpan sebagai kode lama/alias.</span></label>}
        <div className={ui.footer}><button type="submit">{pending?'Menyimpan…':selected.serviceId?'Tautkan tiket ke Asset':'Simpan CID & tautkan tiket'}</button><button type="button" onClick={()=>setSelected(null)}>Batal</button></div>
      </fieldset>
    </form></dialog>}
  </section>;
}

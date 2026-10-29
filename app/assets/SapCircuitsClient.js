'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCustomerId } from '@/lib/customers/identity';
import styles from './sap-circuits.module.css';
import { getServiceCid } from '@/lib/services/cid';
import { isDarkFiber, readPairCount } from '@/lib/services/productUnits';
import { readServiceBandwidthMbps } from '@/lib/services/capacity';
import { minimumBandwidthGbps } from '@/lib/services/productBandwidth';
import CapacityInput from '@/components/CapacityInput';
import AssetCombobox from './AssetCombobox';
import ui from './assets-ui.module.css';

const labels={needs_mapping:'Belum tertaut ke layanan',ready_to_link:'Asset tersedia — tautkan tiket',linked:'Sudah tertaut',conflict:'Perlu diperiksa'};
const gbpsLabel=mbps=>mbps==null||mbps===''?'':Number((Number(mbps)/1000).toFixed(9));
const capabilityPayload=(capacity,fiber)=>{const value=capacity===''||capacity==null?null:Number(capacity);if(value===null||!Number.isFinite(value))return{};return fiber?{pairCount:value}:{bandwidthMbps:Math.round(value*1e6)/1e3};};
// Retyping the prefilled number must not count as an Inventory change.
const capacityChanged=(value,initial)=>{if(String(value)===String(initial))return false;if(initial===''||initial==null)return String(value)!=='';const next=Number(value),current=Number(initial);return !Number.isFinite(next)||!Number.isFinite(current)?true:Math.abs(next-current)>1e-9;};
export default function SapCircuitsClient({customers=[],templates=[],services=[],onMapped,onCustomerCreated,onManageProducts}) {
  const [query,setQuery]=useState(''),[q,setQ]=useState(''),[page,setPage]=useState(1),[status,setStatus]=useState('pending');
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  const [selected,setSelected]=useState(null),[draft,setDraft]=useState({}),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [mapped,setMapped]=useState(null);
  const [family,setFamily]=useState('all');
  const [companies,setCompanies]=useState([]),[customerSaving,setCustomerSaving]=useState(false);
  const [selectedCids,setSelectedCids]=useState([]),[bulkOpen,setBulkOpen]=useState(false),[bulkDraft,setBulkDraft]=useState({customerId:'',templateId:'',company:'',capacity:'',status:'Pending',confirmReview:false}),[bulkBusy,setBulkBusy]=useState(false),[bulkError,setBulkError]=useState('');
  const mappingRef=useRef(null),dialogRef=useRef(null),newCustomerRef=useRef(null),addCustomerRef=useRef(null),bulkRef=useRef(null);
  useEffect(()=>{
    let alive=true;
    fetch('/api/companies?service=1').then(response=>response.ok?response.json():null)
      .then(body=>{if(alive&&Array.isArray(body?.options)&&body.options.length)setCompanies(body.options);})
      .catch(()=>{});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{if(draft.addCustomer)newCustomerRef.current?.focus();},[draft.addCustomer]);
  useEffect(()=>{
    if(!selected||!dialogRef.current)return;
    const previous=document.activeElement,dialog=dialogRef.current;
    dialog.showModal();
    mappingRef.current?.focus();
    return ()=>{dialog.close();if(previous?.isConnected)previous.focus();};
  },[selected]);
  useEffect(()=>{setSelectedCids([]);},[q,page,status,family,reload]);
  useEffect(()=>{
    if(!bulkOpen||!bulkRef.current)return;
    const previous=document.activeElement,dialog=bulkRef.current;
    dialog.showModal();
    (dialog.querySelector('[role="combobox"]')||dialog).focus?.();
    return ()=>{dialog.close();if(previous?.isConnected)previous.focus();};
  },[bulkOpen]);
  function trapFocus(event){
    if(event.key!=='Tab')return;
    const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(e=>e.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  const target=services.find(service=>String(service.id)===String(draft.existingServiceId));
  const differentCid=!!(target&&getServiceCid(target)&&getServiceCid(target).toUpperCase()!==selected?.cid);
  const selectedTemplate=templates.find(template=>template.id===Number(draft.templateId));
  const creatingService=draft.existingServiceId==='new';
  const fiber=creatingService?isDarkFiber(selectedTemplate):isDarkFiber(target?.template);
  const fallbackCompany=target?.company&&!companies.some(option=>option.value===target.company)?[{value:target.company,label:target.company}]:[];
  const configuredCompanies=[...fallbackCompany,...companies.map(option=>({value:option.value,label:option.label}))];
  const companyOptions=configuredCompanies.length?configuredCompanies:[{value:'ION',label:'ION'},{value:'SDC',label:'SDC'}];
  const defaultCompany=companies[0]?.value||'ION';
  const rows=data?.items||[];
  const selectableRows=rows.filter(row=>row.status==='needs_mapping'||row.status==='ready_to_link');
  const selectedRows=rows.filter(row=>selectedCids.includes(row.cid));
  const allCreateRows=selectedRows.length>0&&selectedRows.every(row=>row.status==='needs_mapping');
  const allLinkRows=selectedRows.length>0&&selectedRows.every(row=>row.status==='ready_to_link');
  const needsReview=selectedRows.some(row=>row.needsConfirmation);
  const bulkTemplate=templates.find(template=>template.id===Number(bulkDraft.templateId));
  const bulkFiber=isDarkFiber(bulkTemplate);
  function toggleCid(cid){setSelectedCids(current=>current.includes(cid)?current.filter(value=>value!==cid):[...current,cid]);}
  function toggleAllCids(){setSelectedCids(current=>selectableRows.length&&current.length===selectableRows.length?[]:selectableRows.map(row=>row.cid));}
  function openBulk(){
    setBulkDraft({customerId:'',templateId:'',company:defaultCompany,capacity:'',status:'Pending',confirmReview:false});
    setBulkError('');setBulkOpen(true);
  }
  function chooseBulkCustomer(value){setBulkDraft(current=>({...current,customerId:value?Number(value):''}));}
  function chooseBulkTemplate(value){
    const template=templates.find(item=>String(item.id)===String(value));
    const capacity=!template?'':isDarkFiber(template)?1:(minimumBandwidthGbps(template)===10?10:'');
    setBulkDraft(current=>({...current,templateId:value?Number(value):'',capacity}));
  }
  async function submitBulkLink(){
    if(!selectedCids.length)return;
    if(selectedRows.some(row=>row.needsConfirmation)&&!window.confirm('Beberapa tiket ditandai perlu konfirmasi klasifikasi/format. Tautkan sebagai pekerjaan layanan?'))return;
    setBulkBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/assets/circuit-candidates/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'link',cids:selectedCids,confirmReview:true})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Bulk penautan gagal.');
      setNotice(`${result.mapped} tiket ditautkan ke Asset; ${result.failed} gagal.`);
      setSelectedCids([]);setReload(value=>value+1);await onMapped?.(result);
      if(result.failed)setError(result.results.filter(item=>!item.ok).slice(0,3).map(item=>`${item.cid}: ${item.error}`).join(' · '));
    }catch(e){setError(e.message||'Bulk penautan gagal.');}finally{setBulkBusy(false);}
  }
  async function submitBulk(event){
    event.preventDefault();
    if(!selectedCids.length)return;
    if(!bulkDraft.customerId||!bulkDraft.templateId){setBulkError('Pilih customer dan produk terlebih dahulu.');return;}
    if(bulkDraft.capacity===''){setBulkError('Isi kapasitas layanan baru.');return;}
    if(needsReview&&!bulkDraft.confirmReview){setBulkError('Centang konfirmasi pemeriksaan tiket lama terlebih dahulu.');return;}
    setBulkBusy(true);setBulkError('');
    try{
      const response=await fetch('/api/assets/circuit-candidates/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cids:selectedCids,customerId:Number(bulkDraft.customerId),templateId:Number(bulkDraft.templateId),status:bulkDraft.status,company:bulkDraft.company||undefined,...capabilityPayload(bulkDraft.capacity,bulkFiber),confirmReview:!!bulkDraft.confirmReview})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Bulk penautan gagal.');
      setNotice(`${result.mapped} CID ditautkan (${result.created} layanan dibuat, ${result.linkedTickets} tiket); ${result.failed} gagal.`);
      setMapped(null);setBulkOpen(false);setSelectedCids([]);setReload(value=>value+1);await onMapped?.(result);
      if(result.failed)setError(result.results.filter(item=>!item.ok).slice(0,3).map(item=>`${item.cid}: ${item.error}`).join(' · '));
    }catch(e){setBulkError(e.message);}finally{setBulkBusy(false);}
  }
  function openMapping(row) {
    const suggestion=row.customerSuggestion||{};
    const matchedCustomerId=suggestion.status==='matched'&&suggestion.customerId?Number(suggestion.customerId):'';
    const proposedName=suggestion.status==='new'?String(suggestion.proposedName||''):'';
    setSelected(row);
    setDraft({name:(row.sourceName||row.cid).slice(0,500),customerId:matchedCustomerId,confirmAlias:false,confirmReview:false,confirmConflict:false,templateId:'',status:'Pending',existingServiceId:'',company:matchedCustomerId?'':(row.companySuggestion||''),companySuggestion:row.companySuggestion||'',capacity:'',companyInitial:'',capacityInitial:'',addCustomer:!matchedCustomerId&&!!proposedName,newCustomerName:proposedName,newCustomerEmail:'',newCustomerPhone:''});
    setError('');setNotice('');
  }
  function chooseCustomer(value){
    setDraft(current=>({...current,customerId:value?Number(value):'',existingServiceId:'',confirmAlias:false,company:current.companySuggestion||'',capacity:'',companyInitial:'',capacityInitial:''}));
  }
  function chooseService(value){
    if(value==='new'){
      setDraft(current=>({...current,existingServiceId:'new',confirmAlias:false,templateId:'',status:'Pending',company:current.company||current.companySuggestion||defaultCompany,capacity:'',companyInitial:'',capacityInitial:''}));
      return;
    }
    const service=services.find(row=>String(row.id)===String(value));
    const capacity=service?(isDarkFiber(service.template)?(readPairCount(service)??''):gbpsLabel(readServiceBandwidthMbps(service))):'';
    setDraft(current=>({...current,existingServiceId:value?String(value):'',confirmAlias:false,company:service?.company||'',capacity,companyInitial:service?.company||'',capacityInitial:capacity,templateId:'',status:service?.status||'Pending'}));
  }
  function chooseTemplate(value){
    const template=templates.find(item=>String(item.id)===String(value));
    const capacity=!template?'':isDarkFiber(template)?1:(minimumBandwidthGbps(template)===10?10:'');
    setDraft(current=>({...current,templateId:value?Number(value):'',capacity}));
  }
  async function createCustomer(){
    const name=String(draft.newCustomerName||'').trim(),email=String(draft.newCustomerEmail||'').trim();
    if(!name){setError('Nama customer baru wajib diisi.');return;}
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setError('Format email customer tidak valid.');return;}
    setCustomerSaving(true);setError('');
    try{
      const response=await fetch('/api/assets/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,contactEmail:email,contactPhone:String(draft.newCustomerPhone||'').trim()})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Customer gagal dibuat.');
      onCustomerCreated?.(result);
      setDraft(current=>({...current,customerId:result.id,existingServiceId:'',company:'',capacity:'',companyInitial:'',capacityInitial:'',addCustomer:false,newCustomerName:'',newCustomerEmail:'',newCustomerPhone:''}));
      setNotice(`Customer ${result.name||name} ditambahkan dan dipilih.`);
      setTimeout(()=>addCustomerRef.current?.focus(),0);
    }catch(e){setError(e.message||'Customer gagal dibuat.');}
    finally{setCustomerSaving(false);}
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
    event.preventDefault();setError('');setNotice('');
    const isNewService=draft.existingServiceId==='new';
    if(!selected.serviceId){
      if(!draft.customerId){setError('Pilih customer terdaftar atau tambah customer baru terlebih dahulu.');return;}
      if(isNewService&&(!draft.templateId||!String(draft.name||'').trim())){setError('Lengkapi produk dan nama layanan baru.');return;}
      if(isNewService&&draft.capacity===''){setError('Isi kapasitas layanan baru.');return;}
      if(!isNewService&&!draft.existingServiceId){setError('Pilih layanan milik customer dari daftar.');return;}
    }
    setPending(true);
    try {
      const payload={cid:selected.cid,confirmReview:!!draft.confirmReview,confirmConflict:!!draft.confirmConflict};
      if(!selected.serviceId){
        payload.customerId=Number(draft.customerId);
        if(isNewService){
          payload.templateId=draft.templateId;payload.name=String(draft.name).trim();payload.status=draft.status;
          if(draft.company)payload.company=draft.company;
          Object.assign(payload,capabilityPayload(draft.capacity,fiber));
        }else{
          payload.existingServiceId=draft.existingServiceId;
          payload.confirmAlias=!!draft.confirmAlias;
          // Only send capacity/company that the operator actually changed, so linking alone never rewrites Inventory.
          if(draft.company&&draft.company!==draft.companyInitial)payload.company=draft.company;
          if(capacityChanged(draft.capacity,draft.capacityInitial))Object.assign(payload,capabilityPayload(draft.capacity,fiber));
        }
      }
      const response=await fetch('/api/assets/circuit-candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
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
    {notice&&!selected&&<p role="status">{notice}</p>}
    {mapped&&<p><Link href={`/assets/${mapped.serviceId}`}>Buka Asset {mapped.cid}</Link> · <Link href={`/tickets/new?workType=Trouble&serviceId=${mapped.serviceId}`}>Buat Trouble untuk CID ini</Link></p>}
    {selectedCids.length>0&&<div className={styles.bulkBar} role="status"><span>{selectedCids.length} CID dipilih</span>{allCreateRows&&<button type="button" onClick={openBulk}>Tautkan terpilih…</button>}{allLinkRows&&<button type="button" disabled={bulkBusy} onClick={submitBulkLink}>{bulkBusy?'Menautkan…':'Tautkan tiket terpilih ke Asset'}</button>}{!allCreateRows&&!allLinkRows&&<small>Pilih CID dengan jenis yang sama: semua belum tertaut, atau semua asset tersedia.</small>}<button type="button" onClick={()=>setSelectedCids([])}>Bersihkan pilihan</button></div>}
    {loading?<p role="status">Memuat CID…</p>:<>
      <div className={styles.scroll}><table><thead><tr><th scope="col"><input type="checkbox" aria-label="Pilih semua CID pada halaman" checked={selectableRows.length>0&&selectedCids.length===selectableRows.length} onChange={toggleAllCids}/></th><th scope="col">CID</th><th scope="col">Customer (saran)</th><th scope="col">Nama pada tiket sumber</th><th scope="col">Tiket</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead><tbody>{rows.map(row=><tr key={row.cid}><td><input type="checkbox" aria-label={`Pilih ${row.cid}`} disabled={row.status!=='needs_mapping'&&row.status!=='ready_to_link'} checked={selectedCids.includes(row.cid)} onChange={()=>toggleCid(row.cid)}/></td><th scope="row">{row.cid}</th><td>{row.customerSuggestion?.status==='matched'?<><strong>{formatCustomerId({id:row.customerSuggestion.customerId})}</strong><small style={{display:'block'}}>{row.customerSuggestion.customerName}</small></>:row.customerSuggestion?.status==='new'?<><span>Belum ada customer</span><small style={{display:'block'}}>Usul nama: {row.customerSuggestion.proposedName}</small></>:<span>Pilih manual</span>}{row.companySuggestion&&<small style={{display:'block'}}>Perusahaan: {row.companySuggestion}</small>}</td><td>{row.sourceName||'Belum tersedia'}{row.sourceNames.length>1&&<details><summary>Nama lain pada tiket</summary>{row.sourceNames.slice(1).map(name=><p key={name}>{name}</p>)}</details>}</td><td>{row.ticketCount}{row.tickets?.[0]&&<> · <Link href={`/tickets/${row.tickets[0].id}`}>{row.tickets[0].trackingId}</Link></>}<details><summary>Lihat sumber</summary>{row.tickets.map(ticket=><p key={ticket.id}><Link href={`/tickets/${ticket.id}`}>{ticket.trackingId}</Link> {ticket.category||"Tanpa kategori"}</p>)}</details></td><td>{labels[row.status]}{row.needsConfirmation&&<small style={{display:'block'}}>Perlu konfirmasi sumber/format</small>}{row.reasons?.map(reason=><small key={reason} style={{display:'block'}}>{reason}</small>)}</td><td>{row.serviceId&&<Link href={`/assets/${row.serviceId}`}>Buka Asset</Link>}{row.status!=='linked'&&<button type="button" disabled={pending} onClick={()=>openMapping(row)}>{row.status==='conflict'?'Tautkan dengan konfirmasi':row.serviceId?'Tautkan tiket':'Tautkan customer & layanan'}</button>}{row.status==='conflict'&&<span>Nama/site pada tiket sumber berbeda. Buka konfirmasi bila kode ini memang milik customer yang sama.</span>}</td></tr>)}</tbody></table></div>
      {!rows.length&&<p>Tidak ada kode layanan yang cocok. Pencarian mencakup CID, nomor tiket sumber, dan nama pada tiket. Subject Trouble dan teks bebas tidak menjadi sumber CID baru.</p>}
      {data&&<div className={styles.pagination}><button type="button" disabled={page<=1||pending} onClick={()=>setPage(value=>value-1)}>Sebelumnya</button><span>Halaman {page} · {data.total} hasil</span><button type="button" disabled={page*data.pageSize>=data.total||pending} onClick={()=>setPage(value=>value+1)}>Berikutnya</button></div>}
    </>}
    {selected&&<dialog ref={dialogRef} className={ui.dialog} aria-label={`Tautkan ${selected.cid}`} onKeyDown={trapFocus} onCancel={event=>{event.preventDefault();if(!pending)setSelected(null);}}><div className={ui.dialogHead}><h2>Tautkan customer & layanan</h2><button type="button" disabled={pending} onClick={()=>setSelected(null)}>Tutup</button></div><form ref={mappingRef} tabIndex={-1} className={styles.mapping} onSubmit={save} aria-label={`Tautkan ${selected.cid}`}>
      <div className={ui.source}><h3>{selected.cid}</h3><p>{selected.sourceName}</p>{selected.tickets.map(ticket=><p key={ticket.id}><Link href={`/tickets/${ticket.id}`}>Tiket sumber {ticket.trackingId}</Link></p>)}<small>Order Origin dan Executing Vendor pada tiket sumber tetap dipertahankan.</small></div>{error&&<p role="alert" className={ui.message}>{error}</p>}{notice&&<p role="status" className={ui.message}>{notice}</p>}<p>CID sudah terisi dari Subject tiket. Yang dipilih di bawah adalah customer pemilik dan layanan circuit ini.</p>
      {selected.customerSuggestion?.status==='matched'&&<p className={styles.suggestion}>Saran dari nama tiket: <strong>{formatCustomerId({id:selected.customerSuggestion.customerId})} — {selected.customerSuggestion.customerName}</strong>. Periksa sebelum menyimpan.</p>}
      {selected.customerSuggestion?.status==='new'&&<p className={styles.suggestion}>Belum ada customer yang cocok. Usul nama baru: <strong>{selected.customerSuggestion.proposedName}</strong>. Simpan customer atau pilih yang sudah terdaftar.</p>}
      {selected.companySuggestion&&<p className={styles.suggestion}>Saran perusahaan layanan dari tiket: <strong>{selected.companySuggestion}</strong>.</p>}
      <p>{selected.ticketCount} tiket sumber akan ditautkan tanpa mengubah status atau poin tiket.</p>
      <fieldset disabled={pending||customerSaving}>
        {!selected.serviceId&&<div className={ui.fields}>
          <AssetCombobox label="Customer *" required value={draft.customerId} options={customers.map(c=>({value:c.id,label:`${formatCustomerId(c)} — ${c.name}`}))} placeholder="Cari nama atau Customer ID" onChange={chooseCustomer}/>
          {!draft.addCustomer&&<div><button ref={addCustomerRef} type="button" onClick={()=>setDraft({...draft,addCustomer:true,newCustomerName:'',newCustomerEmail:'',newCustomerPhone:''})}>Tambah customer baru</button></div>}
          {draft.addCustomer&&<div className={ui.fields} role="group" aria-label="Customer baru">
            <label>Nama customer baru *<input ref={newCustomerRef} required maxLength={200} value={draft.newCustomerName} onChange={e=>setDraft({...draft,newCustomerName:e.target.value})}/></label>
            <label>Email (opsional)<input type="email" maxLength={200} value={draft.newCustomerEmail} onChange={e=>setDraft({...draft,newCustomerEmail:e.target.value})}/></label>
            <label>Telepon/NOC (opsional)<input maxLength={60} value={draft.newCustomerPhone} onChange={e=>setDraft({...draft,newCustomerPhone:e.target.value})}/></label>
            <div><button type="button" onClick={createCustomer} disabled={customerSaving}>{customerSaving?'Menyimpan customer…':'Simpan customer'}</button><button type="button" onClick={()=>{setDraft({...draft,addCustomer:false});setTimeout(()=>addCustomerRef.current?.focus(),0);}}>Batal</button></div>
            <small>Customer langsung dipilih tanpa menutup dialog atau berpindah tab.</small>
          </div>}
          <AssetCombobox label="Layanan milik customer *" required disabled={!draft.customerId} value={draft.existingServiceId} options={[...services.filter(s=>(s.customerId??s.customer?.id)===Number(draft.customerId)).map(s=>({value:String(s.id),label:`${s.name} — ${s.template?.name||'Tanpa tipe'}${getServiceCid(s)?` (${getServiceCid(s)})`:''}`})),{value:'new',label:'Buat layanan baru untuk CID ini'}]} onChange={chooseService}/>
          {creatingService&&<>
          <AssetCombobox label="Produk/Layanan *" required value={draft.templateId} options={templates.filter(t=>t.active!==false).map(t=>({value:t.id,label:t.name}))} onChange={chooseTemplate}/>
          <label>Nama layanan *<input required maxLength={500} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></label>
          <AssetCombobox label="Perusahaan layanan *" required value={draft.company} options={companyOptions} placeholder="Pilih perusahaan layanan" onChange={value=>setDraft({...draft,company:value})}/>
          <CapacityInput id="mapping-new-capacity" label="Kapasitas" unit={fiber?'pair':'Gbps'} min={fiber?1:minimumBandwidthGbps(selectedTemplate)} required value={draft.capacity} onChange={e=>setDraft({...draft,capacity:e.target.value})}/>
          <AssetCombobox label="Status layanan" value={draft.status} options={[{value:'Pending',label:'Perlu diperiksa (Pending)'},{value:'Active',label:'Active'},{value:'Suspended',label:'Suspended'},{value:'Terminated',label:'Terminated'}]} onChange={value=>setDraft({...draft,status:value})}/>
          </>}
          {draft.existingServiceId&&draft.existingServiceId!=='new'&&<>
          <p>Produk: {target?.template?.name||'—'} · Status: {target?.status||'—'}. Kapasitas dan perusahaan di bawah hanya ditulis bila diubah; kosong berarti tidak diubah.</p>
          <AssetCombobox label="Perusahaan layanan" value={draft.company} options={companyOptions} placeholder={target?.company?'Pilih perusahaan layanan':'Belum dipetakan — pilih perusahaan'} onChange={value=>setDraft({...draft,company:value})}/>
          <CapacityInput id="mapping-existing-capacity" label={fiber?'Kapasitas (pair)':'Kapasitas (Gbps)'} unit={fiber?'pair':'Gbps'} min={fiber?1:0} value={draft.capacity} onChange={e=>setDraft({...draft,capacity:e.target.value})}/>
          <small>Perubahan kapasitas/perusahaan layanan existing disimpan ke Inventory saat penautan.</small>
          </>}
        </div>}
        {!selected.serviceId&&<p>Customer tidak disimpulkan dari angka CID atau nama tiket. Pilih layanan yang sudah ada; buat baru hanya jika belum terdaftar. <button type="button" onClick={()=>{setSelected(null);onManageProducts?.();}}>Kelola produk</button></p>}
        {selected.needsConfirmation&&<label><span><input style={{width:'auto'}} type="checkbox" required checked={!!draft.confirmReview} onChange={e=>setDraft({...draft,confirmReview:e.target.checked})}/> Saya sudah memeriksa sumber dan mengonfirmasi tiket ini adalah pekerjaan layanan.</span></label>}
        {selected.status==='conflict'&&<label><span><input style={{width:'auto'}} type="checkbox" required checked={!!draft.confirmConflict} onChange={e=>setDraft({...draft,confirmConflict:e.target.checked})}/> Saya sudah memeriksa: walaupun nama/site pada tiket sumber berbeda, kode {selected.cid} milik customer yang sama dan boleh ditautkan.</span></label>}
        {differentCid&&<label><span><input style={{width:'auto'}} type="checkbox" required checked={!!draft.confirmAlias} onChange={e=>setDraft({...draft,confirmAlias:e.target.checked})}/> Saya mengonfirmasi {selected.cid} dan CID utama {getServiceCid(target)} adalah circuit yang sama. Simpan sebagai kode lama/alias.</span></label>}
        <div className={ui.footer}><button type="submit">{pending?'Menyimpan…':selected.serviceId?'Tautkan tiket ke Asset':'Simpan CID & tautkan tiket'}</button><button type="button" onClick={()=>setSelected(null)}>Batal</button></div>
      </fieldset>
    </form></dialog>}
    {bulkOpen&&<dialog ref={bulkRef} className={ui.dialog} aria-label="Tautkan beberapa CID" onCancel={event=>{event.preventDefault();if(!bulkBusy)setBulkOpen(false);}}>
      <div className={ui.dialogHead}><h2>Tautkan {selectedCids.length} CID</h2><button type="button" disabled={bulkBusy} onClick={()=>setBulkOpen(false)}>Tutup</button></div>
      <form className={styles.mapping} onSubmit={submitBulk} aria-label="Tautkan beberapa CID">
        {bulkError&&<p role="alert" className={ui.message}>{bulkError}</p>}
        <p>Satu layanan dibuat per CID; nama layanan mengikuti nama sumber tiket. Tiket sumber ditautkan tanpa mengubah status atau poin.</p>
        <fieldset disabled={bulkBusy}>
          <div className={ui.fields}>
            <AssetCombobox label="Customer *" required value={bulkDraft.customerId} options={customers.map(customer=>({value:customer.id,label:`${formatCustomerId(customer)} — ${customer.name}`}))} placeholder="Cari nama atau Customer ID" onChange={chooseBulkCustomer}/>
            <AssetCombobox label="Produk/Layanan *" required value={bulkDraft.templateId} options={templates.filter(template=>template.active!==false).map(template=>({value:template.id,label:template.name}))} onChange={chooseBulkTemplate}/>
            <AssetCombobox label="Perusahaan layanan *" required value={bulkDraft.company} options={companyOptions} placeholder="Pilih perusahaan layanan" onChange={value=>setBulkDraft({...bulkDraft,company:value})}/>
            <CapacityInput id="bulk-capacity" label="Kapasitas" unit={bulkFiber?'pair':'Gbps'} min={bulkFiber?1:minimumBandwidthGbps(bulkTemplate)} required value={bulkDraft.capacity} onChange={e=>setBulkDraft({...bulkDraft,capacity:e.target.value})}/>
            <AssetCombobox label="Status layanan" value={bulkDraft.status} options={[{value:'Pending',label:'Perlu diperiksa (Pending)'},{value:'Active',label:'Active'},{value:'Suspended',label:'Suspended'},{value:'Terminated',label:'Terminated'}]} onChange={value=>setBulkDraft({...bulkDraft,status:value})}/>
          </div>
          {needsReview&&<label><span><input style={{width:'auto'}} type="checkbox" checked={!!bulkDraft.confirmReview} onChange={e=>setBulkDraft({...bulkDraft,confirmReview:e.target.checked})}/> Saya sudah memeriksa tiket lama yang ditandai perlu konfirmasi klasifikasi/format.</span></label>}
          <div className={ui.footer}><button type="submit">{bulkBusy?'Menautkan…':`Tautkan ${selectedCids.length} CID`}</button><button type="button" disabled={bulkBusy} onClick={()=>setBulkOpen(false)}>Batal</button></div>
        </fieldset>
      </form>
    </dialog>}
  </section>;
}

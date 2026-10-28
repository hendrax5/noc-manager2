"use client";
import CapacityInput from './CapacityInput';
import {useEffect,useId,useState} from 'react';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import {isDarkFiber,isPairField,readPairCount} from '@/lib/services/productUnits.js';

import {isBandwidthField,isCircuitField,isPlaceholderField} from '@/lib/services/fields';
import {minimumBandwidthGbps} from '@/lib/services/productBandwidth';
import {TicketServicePicker} from './TicketWorkClassification';
import {readServiceBandwidthMbps} from '@/lib/services/capacity';
import {mbpsToGbps} from '@/lib/tickets/bandwidth';
import InstallationFields from './InstallationFields';
import styles from './tickets/work-form.module.css';

const HINT_KIND_LABEL={description:'config perangkat','client-name':'nama client/perangkat','rate-limit':'rate-limit CIR',text:'keterangan tiket','upgrade-target':'EWO upgrade'};
const hintMbps=value=>Number(value)>=1000?Number((Number(value)/1000).toFixed(3))+' Gbps':Number(value)+' Mbps';
const hintDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric'}).format(date);};
const hintLabel=candidate=>`${hintMbps(candidate.mbps)} — ${HINT_KIND_LABEL[candidate.kind]||'riwayat tiket'}${hintDate(candidate.source?.createdAt)?' · '+hintDate(candidate.source.createdAt):''}${candidate.source?.trackingId?' · '+candidate.source.trackingId:''}`;

export default function ServiceWorkFields({value,onChange,services=[],serviceTemplates=[],workTypes=[],canManageAssets=false}){
 const id=useId(),router=useRouter(),service=services.find(s=>Number(s.id)===Number(value.serviceIds?.[0]));
 const type=workTypes.find(t=>Number(t.id)===Number(value.serviceWorkTypeId)),operation=type?.operation||value.serviceWorkOperation;
 const r=value.serviceChange||{},update=patch=>onChange({serviceChange:{...r,...patch}});
 const termination=operation==='Terminate',bod=operation==='BOD',dataCenter=operation==='DataCenter',capacityOnly=['Upgrade','Downgrade','BOD'].includes(operation);
 const [hints,setHints]=useState(null),[hintError,setHintError]=useState(''),[hintPick,setHintPick]=useState(''),[applying,setApplying]=useState(false),[autoTarget,setAutoTarget]=useState(null);
 const hintServiceId=service?.id||null;
 useEffect(()=>{
  setHints(null);setHintError('');setHintPick('');setAutoTarget(null);
  if(!hintServiceId||!operation||operation==='Installation'||operation==='Terminate'||operation==='DataCenter')return undefined;
  let active=true;const controller=new AbortController();
  fetch(`/api/assets/services/${hintServiceId}/capacity-hints`,{signal:controller.signal})
   .then(response=>{if(!response.ok)throw new Error('hints');return response.json();})
   .then(data=>{
    if(!active)return;
    setHints(data);
    const target=data.target?.[0];
    if(target?.mbps&&['Upgrade','Downgrade','BOD'].includes(operation)&&!value.editExistingServiceWork&&r.bandwidthGbps==null&&r.bandwidthMbps==null){setAutoTarget(target);update({bandwidthGbps:mbpsToGbps(target.mbps)});}
   })
   .catch(()=>{if(active)setHintError('Riwayat kapasitas tiket tidak dapat dimuat.');});
  return()=>{active=false;controller.abort();};
 },[hintServiceId,operation]);
 if(operation==='Installation'&&!value.editExistingServiceWork)return <InstallationFields value={value} onChange={onChange} service={service} templates={serviceTemplates}/>;
 const normal=service?readServiceBandwidthMbps(service):null;
 const hintCandidates=(hints?.existing||[]).slice(0,8);
 const selectedHint=hintCandidates.find((candidate,index)=>String(index)===hintPick)||hintCandidates[0];
 const start=r.bodStartAt?Date.parse(r.bodStartAt):NaN,end=r.bodEndAt?Date.parse(r.bodEndAt):NaN;
 const local=v=>v?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' ','T'):'';
 const bandwidth=r.bandwidthGbps??(r.bandwidthMbps==null?'':mbpsToGbps(r.bandwidthMbps));
 const product=serviceTemplates.find(t=>t.id===Number(r.targetTemplateId||service?.templateId));
 const fiber=isDarkFiber(product);const fields=product?.fields;let extras=[];try{extras=typeof fields==='string'?JSON.parse(fields):fields||[];}catch{}
 async function applyCapacityHint(candidate){
  if(!service||!candidate)return;
  setApplying(true);setHintError('');
  try{
   const response=await fetch(`/api/assets/services/${service.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({customData:{...(service.customData||{}),bandwidthMbps:candidate.mbps}})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Gagal mengisi kapasitas ke Inventory.');
   toast.success(`Kapasitas Inventory diisi ${hintMbps(candidate.mbps)}.`);
   router.refresh();
  }catch(error){setHintError(error.message||'Gagal mengisi kapasitas ke Inventory.');}
  finally{setApplying(false);}
 }
 return <section className={styles.fields} aria-label="Pekerjaan layanan">
 {operation==='Installation'&&value.editExistingServiceWork?<p>Customer/CID instalasi tetap: {service?.customer?.name} / {service?.cid}. Ubah rencana bandwidth dan RFS di bawah.</p>:<TicketServicePicker services={services} selectedIds={value.serviceIds||[]} single onChange={serviceIds=>onChange({serviceIds,serviceChange:{}})}/> }
 {service&&<p className={styles.summary}>Customer: {service.customer?.name||'—'} · {isDarkFiber(service.template)?'Jumlah pair saat ini: '+(readPairCount(service)??'Belum diketahui'):'Bandwidth '+(bod?'normal':'saat ini')+': '+(normal==null?'Belum diketahui':mbpsToGbps(normal)+' Gbps')}</p>}
 {service&&normal==null&&hintCandidates.length>0&&<div role="group" aria-label="Kapasitas dari riwayat tiket">
  <p>Inventory belum punya kapasitas. Terdeteksi dari riwayat tiket — pilih yang benar lalu isi ke Inventory:</p>
  {hintCandidates.map((candidate,index)=><label key={String(index)} style={{display:'block'}}>
   <input type="radio" name={`${id}-capacity-hint`} checked={String(index)===String(hintPick===''?'0':hintPick)} onChange={()=>setHintPick(String(index))}/>{" "}
   {hintLabel(candidate)}{candidate.approximate?' (perkiraan)':''}
  </label>)}
  <button type="button" className="btn btn-secondary" disabled={applying||!canManageAssets||!selectedHint} onClick={()=>applyCapacityHint(selectedHint)}>{applying?'Menyimpan…':`Isi ${selectedHint?hintMbps(selectedHint.mbps):''} ke Inventory`}</button>
  {!canManageAssets&&<small>Mengisi Inventory membutuhkan izin pengelola Inventory (manage_assets).</small>}
  {hints?.resolution==='ambiguous'&&<small>Beberapa kandidat berbeda ditemukan; periksa sebelum memilih.</small>}
 </div>}
 {hintError&&<p role="alert">{hintError}</p>}
 {operation&&<>
 {dataCenter?<>
 <p className={styles.summary}>Perusahaan layanan: {service?.company||'Belum dipetakan'} · Pelaksana: SDC (NocDatacenter)</p>
 <label htmlFor={id+'-location'}>Lokasi Data Center</label><input id={id+'-location'} required maxLength={2000} value={r.workDetails?.location||''} onChange={e=>update({workDetails:{...r.workDetails,location:e.target.value}})}/>
 <label htmlFor={id+'-from'}>Dari rack/perangkat (opsional)</label><input id={id+'-from'} maxLength={2000} value={r.workDetails?.endpointFrom||''} onChange={e=>update({workDetails:{...r.workDetails,endpointFrom:e.target.value}})}/>
 <label htmlFor={id+'-to'}>Ke rack/perangkat (opsional)</label><input id={id+'-to'} maxLength={2000} value={r.workDetails?.endpointTo||''} onChange={e=>update({workDetails:{...r.workDetails,endpointTo:e.target.value}})}/>
 <label htmlFor={id+'-detail'}>Detail pekerjaan</label><textarea id={id+'-detail'} required maxLength={2000} value={r.workDetails?.description||''} onChange={e=>update({workDetails:{...r.workDetails,description:e.target.value}})}/>
 <label htmlFor={id+'-technical'}>Detail teknis (opsional)</label><textarea id={id+'-technical'} maxLength={2000} value={r.workDetails?.technical||''} onChange={e=>update({workDetails:{...r.workDetails,technical:e.target.value}})}/>
 <label htmlFor={id+'-date'}>RFS</label><input id={id+'-date'} type="date" required value={r.effectiveDate||''} onChange={e=>update({effectiveDate:e.target.value})}/>
 </>:<>
 {!termination&&<>
 {!capacityOnly&&<><label htmlFor={id+'-product'}>Produk/Layanan tujuan</label><select id={id+'-product'} required value={r.targetTemplateId||service?.templateId||''} onChange={e=>update({targetTemplateId:Number(e.target.value),targetCustomData:{},pairCount:1})}><option value="">Pilih produk/layanan</option>{serviceTemplates.filter(t=>t.active!==false).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></>}
 <CapacityInput id={id+'-capacity'} label={bod?'Kapasitas BOD':'Kapasitas'} unit={fiber?'pair':'Gbps'} min={fiber?1:minimumBandwidthGbps(product)} required={fiber||capacityOnly} value={fiber?r.pairCount??readPairCount(service)??1:bandwidth} onChange={e=>update(fiber?{pairCount:e.target.value===''?'':Number(e.target.value)}:{bandwidthMbps:undefined,bandwidthGbps:e.target.value===''?'':Number(e.target.value)})}/>
 {autoTarget&&!fiber&&<small>Kapasitas tujuan terisi otomatis dari riwayat tiket: {hintMbps(autoTarget.mbps)}{hintDate(autoTarget.source?.createdAt)?' ('+hintDate(autoTarget.source.createdAt)+')':''}.</small>}
 {minimumBandwidthGbps(product)===10&&<small>OPEN PORT minimal 10 Gbps.</small>}
 {!capacityOnly&&Array.isArray(extras)&&extras.filter(f=>f.required&&!isPlaceholderField(f.name)&&!isBandwidthField(f.name)&&!isCircuitField(f.name)&&!isPairField(f.name)).map((f,i)=><div key={f.name}><label htmlFor={id+'-extra-'+i}>{f.name}</label>{f.type==='select'?<select id={id+'-extra-'+i} required value={r.targetCustomData?.[f.name]??service?.customData?.[f.name]??''} onChange={e=>update({targetCustomData:{...r.targetCustomData,[f.name]:e.target.value}})}><option value="">Pilih {f.name}</option>{(Array.isArray(f.options)?f.options:String(f.options||'').split(',')).map(o=><option key={o}>{o}</option>)}</select>:<input id={id+'-extra-'+i} required value={r.targetCustomData?.[f.name]??service?.customData?.[f.name]??''} onChange={e=>update({targetCustomData:{...r.targetCustomData,[f.name]:e.target.value}})}/>}</div>)}
 </>}
 {bod?<><label htmlFor={id+'-start'}>Mulai BOD (WIB)</label><input id={id+'-start'} type="datetime-local" required value={local(r.bodStartAt)} onChange={e=>update({bodStartAt:e.target.value?e.target.value+'+07:00':''})}/>
 <label htmlFor={id+'-end'}>Selesai BOD (WIB)</label><input id={id+'-end'} type="datetime-local" required value={local(r.bodEndAt)} onChange={e=>update({bodEndAt:e.target.value?e.target.value+'+07:00':''})}/>
 {Number.isFinite(start)&&Number.isFinite(end)&&<p role="status">{end>start?'Durasi BOD: '+Number(((end-start)/3600000).toFixed(2))+' jam':'Selesai BOD harus setelah mulai.'}</p>}
 <small>Aktivasi dan pengembalian bandwidth dikonfirmasi setelah tindakan jaringan. Reminder hanya di dashboard.</small></>:<><label htmlFor={id+'-date'}>{termination?'Tanggal terminasi':'RFS'}</label><input id={id+'-date'} type="date" required value={r.effectiveDate||''} onChange={e=>update({effectiveDate:e.target.value})}/></>}
 {termination&&<><label htmlFor={id+'-reason'}>Alasan terminasi</label><textarea id={id+'-reason'} required maxLength={2000} value={r.reason||''} onChange={e=>update({reason:e.target.value})}/><small>Layanan dinonaktifkan saat Resolve. CID dan riwayat tetap tersimpan.</small></>}
 </>}
 </>}
 </section>;
}

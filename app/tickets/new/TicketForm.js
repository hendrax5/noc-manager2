"use client";
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import TicketWorkClassification from '@/components/TicketWorkClassification';
import {getServiceCid} from '@/lib/services/cid';
import {getDowntimeDuration,nowDatetimeLocal} from '@/lib/tickets/downtime';
import MasterPicker from '@/components/MasterPicker';
import {installationSubject, serviceWorkSubject} from '@/lib/tickets/subject';
import styles from '@/components/tickets/work-form.module.css';
export default function TicketForm({departments=[],users=[],services=[],serviceTemplates=[],defaultTargetDeptId,defaultWorkType='Unclassified',initialServiceId=null,initialServiceWorkType=null,canManageAssets=false}){
 const router=useRouter(),edited=useRef(false),initial=services.find(s=>s.id===initialServiceId);
 const dataCenterDepartment=departments.find(d=>String(d.name||'').replace(/[^a-z0-9]/gi,'').toLowerCase()==='nocdatacenter');
 const customerNames=services.reduce((map,service)=>{const id=Number(service.customerId??service.customer?.id),name=service.customer?.name;if(Number.isFinite(id)&&name&&!map.has(id))map.set(id,name);return map;},new Map());
 const installationTitle=(installation,typeName)=>installationSubject({typeName:typeName||'Instalasi Baru',cid:installation?.cid,name:installation?.name,customerName:installation?.newCustomerName||customerNames.get(Number(installation?.customerId))||initial?.customer?.name});
 const initialTitle=initialServiceWorkType&&initial?(initialServiceWorkType.operation==='Installation'?installationTitle({cid:getServiceCid(initial),name:initial.name,customerId:initial.customerId},initialServiceWorkType.name):serviceWorkSubject(initialServiceWorkType.name,initial,getServiceCid(initial))):'';
 const [value,setValue]=useState({workType:initialServiceWorkType?'ServiceWork':defaultWorkType,serviceWorkTypeId:initialServiceWorkType?.id||'',serviceWorkTypeLabel:initialServiceWorkType?.name||'',serviceWorkOperation:initialServiceWorkType?.operation,serviceIds:initial?[initial.id]:[],serviceChange:{},title:initialTitle,description:'',departmentId:defaultTargetDeptId||departments[0]?.id||'',assigneeId:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState(null),[outage,setOutage]=useState(false),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const errorRef=useRef(null),invalidNotified=useRef(false);
 const update=patch=>setValue(v=>({...v,...patch,...(!edited.current&&patch.installation&&v.serviceWorkOperation==='Installation'?{title:installationTitle(patch.installation,v.serviceWorkTypeLabel)}:{})}));
 function showError(message){if(!message)return;setError(message);toast.error(message);setTimeout(()=>errorRef.current?.scrollIntoView({block:'center',behavior:'smooth'}),0);}
 function handleInvalid(event){
   const field=event.target;
   field?.scrollIntoView?.({block:'center',behavior:'smooth'});
   if(invalidNotified.current)return;
   invalidNotified.current=true;
   const label=field?.labels?.[0]?.textContent?.trim()||field?.getAttribute('aria-label')||'Kolom wajib';
   toast.error(`${label}: ${field?.validationMessage||'wajib diisi.'}`);
   setTimeout(()=>{invalidNotified.current=false;},1200);
 }
 async function submit(event){
  event.preventDefault();setError('');
  try{
  if(value.workType==='Trouble'&&(!value.serviceIds.length||value.serviceIds.some(id=>!getServiceCid(services.find(s=>s.id===id)))||!value.symptomId||!value.causeId)){showError('Pilih CID, gejala, dan penyebab gangguan.');return;}
  if(value.workType==='ServiceWork'&&value.serviceWorkOperation!=='Installation'&&value.serviceIds.length!==1){showError('Pilih satu CID layanan.');return;}
  const track=value.workType==='Trouble'&&outage,duration=track?getDowntimeDuration(start,end||null,{live:!end}):null;
  if(track&&(!start||duration?.error)){showError(duration?.error||'Mulai downtime wajib diisi.');return;}
  setBusy(true);try{let attachment={};if(file){const fd=new FormData();fd.append('file',file);const r=await fetch('/api/upload',{method:'POST',body:fd});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unggah lampiran gagal.');attachment={attachmentUrl:data.url,attachmentName:data.filename};}
  const payload={...value,formVersion:'work-v2',...attachment,customData:{hasDowntime:track,startDowntime:track?start:null,endDowntime:track&&end?end:null,downtimeMinutes:track&&!duration?.ongoing?duration?.minutes||0:0}};
  delete payload.serviceWorkOperation;
  if(value.workType!=='ServiceWork'){delete payload.installation;delete payload.serviceChange;delete payload.serviceWorkTypeId;}else if(value.serviceWorkOperation!=='Installation')delete payload.installation;
  const r=await fetch('/api/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Tiket gagal dibuat (HTTP ${r.status}).`);toast.success('Tiket berhasil dibuat.');router.push('/tickets/'+data.id);router.refresh();
  }catch(e){showError(e.message||'Tiket gagal dibuat.');}finally{setBusy(false);}
  }catch(e){setBusy(false);showError(e.message||'Form gagal diproses. Muat ulang halaman lalu coba lagi.');}
 }
 return <form className={styles.form} onSubmit={submit} onInvalidCapture={handleInvalid}>
 {error&&<p role="alert" ref={errorRef} aria-live="assertive">{error}</p>}
 <TicketWorkClassification value={value} onChange={update} services={services} serviceTemplates={serviceTemplates} canManageAssets={canManageAssets} onServiceWorkTypeChange={type=>{update({...(!edited.current?{title:type.name}:{}),...(type.operation==='DataCenter'&&dataCenterDepartment?{departmentId:dataCenterDepartment.id,assigneeId:''}:{})});}}/>
 <p>Kategori dan perhitungan skor mengikuti jenis pekerjaan. Perusahaan mengikuti data customer/CID dan penugasan.</p>
 <section className={styles.details} aria-label="Detail pekerjaan"><h2>Detail pekerjaan</h2><div><label htmlFor="ticket-subject">Subject</label><input id="ticket-subject" required maxLength={500} value={value.title} onChange={e=>{edited.current=true;update({title:e.target.value});}}/></div>
 <div><label htmlFor="ticket-message">Message Content</label><textarea id="ticket-message" required value={value.description} onChange={e=>update({description:e.target.value})}/></div>
 <div className={styles.assignment}><div><label htmlFor="ticket-department">Department</label><MasterPicker id="ticket-department" value={value.departmentId} disabled={value.serviceWorkOperation==='DataCenter'} options={departments.map(d=>({value:String(d.id),label:d.name}))} onChange={next=>update({departmentId:Number(next),assigneeId:''})}/>{value.serviceWorkOperation==='DataCenter'&&<small>Pelaksana otomatis: NocDatacenter / SDC.</small>}</div>
 <div><label htmlFor="ticket-pic">PIC</label><MasterPicker id="ticket-pic" value={value.assigneeId} options={[{value:'',label:'Otomatis sesuai departemen'},...users.filter(u=>!u.departmentId||Number(u.departmentId)===Number(value.departmentId)).map(u=>({value:String(u.id),label:u.name||u.username}))]} onChange={assigneeId=>update({assigneeId})}/></div></div></section>
 {value.workType==='Trouble'&&<fieldset><legend>Waktu gangguan</legend><label><input type="checkbox" checked={outage} onChange={e=>setOutage(e.target.checked)}/> Catat downtime</label>{outage&&<div className={styles.fields}><label htmlFor="outage-start">Mulai downtime (WIB)</label><input id="outage-start" type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/><label htmlFor="outage-end">Selesai downtime (WIB)</label><input id="outage-end" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/><button type="button" onClick={()=>setEnd(nowDatetimeLocal())} disabled={!start}>Pulih sekarang</button>{start&&<p role="status">{getDowntimeDuration(start,end||null,{live:!end})?.text}</p>}</div>}</fieldset>}
 <label htmlFor="ticket-attachment">Lampiran (opsional)</label><input id="ticket-attachment" type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
 {error&&<p role="alert" aria-live="assertive" style={{color:'var(--danger-text)',fontWeight:600,margin:'0.5rem 0'}}>{error}</p>}
 <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Menyimpan…':'Create Support Ticket'}</button>
 </form>;
}

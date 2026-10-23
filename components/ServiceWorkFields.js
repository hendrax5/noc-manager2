"use client";
import CapacityInput from './CapacityInput';
import {isDarkFiber,isPairField,readPairCount} from '@/lib/services/productUnits';

import {isBandwidthField,isCircuitField,isPlaceholderField} from '@/lib/services/fields';
import {minimumBandwidthGbps} from '@/lib/services/productBandwidth';
import {useId} from 'react';
import {TicketServicePicker} from './TicketWorkClassification';
import {readServiceBandwidthMbps} from '@/lib/services/capacity';
import {mbpsToGbps} from '@/lib/tickets/bandwidth';
import InstallationFields from './InstallationFields';
import styles from './tickets/work-form.module.css';
export default function ServiceWorkFields({value,onChange,services=[],serviceTemplates=[],workTypes=[]}){
 const id=useId(),service=services.find(s=>Number(s.id)===Number(value.serviceIds?.[0]));
 const type=workTypes.find(t=>Number(t.id)===Number(value.serviceWorkTypeId)),operation=type?.operation||value.serviceWorkOperation;
 const r=value.serviceChange||{},update=patch=>onChange({serviceChange:{...r,...patch}});
 const termination=operation==='Terminate',bod=operation==='BOD',capacityOnly=['Upgrade','Downgrade','BOD'].includes(operation);
 if(operation==='Installation'&&!value.editExistingServiceWork)return <InstallationFields value={value} onChange={onChange} service={service} templates={serviceTemplates}/>;
 const normal=service?readServiceBandwidthMbps(service):null;
 const start=r.bodStartAt?Date.parse(r.bodStartAt):NaN,end=r.bodEndAt?Date.parse(r.bodEndAt):NaN;
 const local=v=>v?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' ','T'):'';
 const bandwidth=r.bandwidthGbps??(r.bandwidthMbps==null?'':mbpsToGbps(r.bandwidthMbps));
 const product=serviceTemplates.find(t=>t.id===Number(r.targetTemplateId||service?.templateId));
 const fiber=isDarkFiber(product);const fields=product?.fields;let extras=[];try{extras=typeof fields==='string'?JSON.parse(fields):fields||[];}catch{}
 return <section className={styles.fields} aria-label="Pekerjaan layanan">
 {operation==='Installation'&&value.editExistingServiceWork?<p>Customer/CID instalasi tetap: {service?.customer?.name} / {service?.cid}. Ubah rencana bandwidth dan RFS di bawah.</p>:<TicketServicePicker services={services} selectedIds={value.serviceIds||[]} single onChange={serviceIds=>onChange({serviceIds,serviceChange:{}})}/> }
 {service&&<p className={styles.summary}>Customer: {service.customer?.name||'—'} · {isDarkFiber(service.template)?'Jumlah pair saat ini: '+(readPairCount(service)??'Belum diketahui'):'Bandwidth '+(bod?'normal':'saat ini')+': '+(normal==null?'Belum diketahui':mbpsToGbps(normal)+' Gbps')}</p>}
 {operation&&<>
 {!termination&&<>
 {!capacityOnly&&<><label htmlFor={id+'-product'}>Produk/Layanan tujuan</label><select id={id+'-product'} required value={r.targetTemplateId||service?.templateId||''} onChange={e=>update({targetTemplateId:Number(e.target.value),targetCustomData:{},pairCount:1})}><option value="">Pilih produk/layanan</option>{serviceTemplates.filter(t=>t.active!==false).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></>}
 <CapacityInput id={id+'-capacity'} label={bod?'Kapasitas BOD':'Kapasitas'} unit={fiber?'pair':'Gbps'} min={fiber?1:minimumBandwidthGbps(product)} required={fiber||capacityOnly} value={fiber?r.pairCount??readPairCount(service)??1:bandwidth} onChange={e=>update(fiber?{pairCount:e.target.value===''?'':Number(e.target.value)}:{bandwidthMbps:undefined,bandwidthGbps:e.target.value===''?'':Number(e.target.value)})}/>
 {minimumBandwidthGbps(product)===10&&<small>OPEN PORT minimal 10 Gbps.</small>}
 {!capacityOnly&&Array.isArray(extras)&&extras.filter(f=>f.required&&!isPlaceholderField(f.name)&&!isBandwidthField(f.name)&&!isCircuitField(f.name)&&!isPairField(f.name)).map((f,i)=><div key={f.name}><label htmlFor={id+'-extra-'+i}>{f.name}</label>{f.type==='select'?<select id={id+'-extra-'+i} required value={r.targetCustomData?.[f.name]??service?.customData?.[f.name]??''} onChange={e=>update({targetCustomData:{...r.targetCustomData,[f.name]:e.target.value}})}><option value="">Pilih {f.name}</option>{(Array.isArray(f.options)?f.options:String(f.options||'').split(',')).map(o=><option key={o}>{o}</option>)}</select>:<input id={id+'-extra-'+i} required value={r.targetCustomData?.[f.name]??service?.customData?.[f.name]??''} onChange={e=>update({targetCustomData:{...r.targetCustomData,[f.name]:e.target.value}})}/>}</div>)}
 </>}
 {bod?<><label htmlFor={id+'-start'}>Mulai BOD (WIB)</label><input id={id+'-start'} type="datetime-local" required value={local(r.bodStartAt)} onChange={e=>update({bodStartAt:e.target.value?e.target.value+'+07:00':''})}/>
 <label htmlFor={id+'-end'}>Selesai BOD (WIB)</label><input id={id+'-end'} type="datetime-local" required value={local(r.bodEndAt)} onChange={e=>update({bodEndAt:e.target.value?e.target.value+'+07:00':''})}/>
 {Number.isFinite(start)&&Number.isFinite(end)&&<p role="status">{end>start?'Durasi BOD: '+Number(((end-start)/3600000).toFixed(2))+' jam':'Selesai BOD harus setelah mulai.'}</p>}
 <small>Aktivasi dan pengembalian bandwidth dikonfirmasi setelah tindakan jaringan. Reminder hanya di dashboard.</small></>:<><label htmlFor={id+'-date'}>{termination?'Tanggal terminasi':'RFS'}</label><input id={id+'-date'} type="date" required value={r.effectiveDate||''} onChange={e=>update({effectiveDate:e.target.value})}/></>}
 {termination&&<><label htmlFor={id+'-reason'}>Alasan terminasi</label><textarea id={id+'-reason'} required maxLength={2000} value={r.reason||''} onChange={e=>update({reason:e.target.value})}/><small>Layanan dinonaktifkan saat Resolve. CID dan riwayat tetap tersimpan.</small></>}
 </>}
 </section>;
}

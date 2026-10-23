'use client';
import {useEffect,useId,useState} from 'react';
import {formatCustomerId} from '@/lib/customers/identity';
import styles from './tickets/work-form.module.css';
export default function InstallationFields({value,onChange,service,templates=[]}){
 const id=useId(),[customers,setCustomers]=useState([]),[error,setError]=useState(''),[adding,setAdding]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/assets/customers').then(async r=>{if(!r.ok)throw new Error('Daftar customer gagal dimuat.');return r.json();}).then(b=>{if(active)setCustomers(b);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const d=value.installation||{...(service?{existingServiceId:service.id,customerId:service.customerId,cid:service.cid,name:service.name,templateId:service.templateId,bandwidthGbps:service.customData?.bandwidthMbps/1000||''}:{})};
 const template=templates.find(t=>t.id===Number(d.templateId));let extras=[];try{extras=typeof template?.fields==='string'?JSON.parse(template.fields):template?.fields||[];}catch{}
 const update=patch=>onChange({installation:{...d,...patch}});
 return <section className={styles.fields} aria-label="Instalasi Baru">
 {error&&<p role="alert">{error}</p>}
 {!adding?<><label htmlFor={id+'-customer'}>Customer ID / Nama customer</label><select id={id+'-customer'} required value={d.customerId||''} onChange={e=>update({customerId:Number(e.target.value),newCustomerName:undefined,existingServiceId:undefined})}><option value="">Pilih customer</option>{customers.map(c=><option key={c.id} value={c.id}>{formatCustomerId(c)} — {c.name}</option>)}</select><button type="button" onClick={()=>{setAdding(true);update({customerId:undefined,existingServiceId:undefined});}}>Tambah customer baru</button></>:<><label htmlFor={id+'-new'}>Nama customer baru</label><input id={id+'-new'} required maxLength={200} value={d.newCustomerName||''} onChange={e=>update({newCustomerName:e.target.value,customerId:undefined})}/><button type="button" onClick={()=>{setAdding(false);update({newCustomerName:undefined});}}>Pilih customer terdaftar</button></>}
 <label htmlFor={id+'-cid'}>CID layanan baru</label><input id={id+'-cid'} required value={d.cid||''} placeholder="SAP-C-…" onChange={e=>update({cid:e.target.value,existingServiceId:undefined})}/>
 <label htmlFor={id+'-site'}>Nama layanan/site</label><input id={id+'-site'} required maxLength={200} value={d.name||''} onChange={e=>update({name:e.target.value})}/>
 <label htmlFor={id+'-product'}>Produk/Layanan</label><select id={id+'-product'} required value={d.templateId||''} onChange={e=>update({templateId:Number(e.target.value)})}><option value="">Pilih produk/layanan</option>{templates.filter(t=>t.active!==false).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
 <label htmlFor={id+'-bandwidth'}>Bandwidth (Gbps)</label><input id={id+'-bandwidth'} required type="number" min="0.000001" step="any" value={d.bandwidthGbps??''} onChange={e=>update({bandwidthGbps:e.target.value===''?'':Number(e.target.value)})}/>
 <label htmlFor={id+'-rfs'}>RFS</label><input id={id+'-rfs'} required type="date" value={d.rfsDate||''} onChange={e=>update({rfsDate:e.target.value})}/>
 {Array.isArray(extras)&&extras.filter(f=>f.required&&!/bandwidth|kapasitas|^(cid|sid|id layanan|service id|circuit\s*id)$/i.test(f.name)).map((f,i)=><div key={f.name}><label htmlFor={id+'-extra-'+i}>{f.name}</label>{f.type==='select'?<select id={id+'-extra-'+i} required value={d.targetCustomData?.[f.name]||''} onChange={e=>update({targetCustomData:{...d.targetCustomData,[f.name]:e.target.value}})}><option value="">Pilih {f.name}</option>{(Array.isArray(f.options)?f.options:String(f.options||'').split(/[,\n]/)).map(o=><option key={o}>{o}</option>)}</select>:<input id={id+'-extra-'+i} required type={['number','date'].includes(f.type)?f.type:'text'} value={d.targetCustomData?.[f.name]||''} onChange={e=>update({targetCustomData:{...d.targetCustomData,[f.name]:e.target.value}})}/>}</div>)}
 <small>Layanan didaftarkan Pending bersama tiket dan diaktifkan setelah pekerjaan selesai.</small>
 </section>;
}

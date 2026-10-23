"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {mbpsToGbps} from '@/lib/tickets/bandwidth';
import styles from './tickets/work-form.module.css';
const date=v=>new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB';
export default function BodPanel({ticket}){
 const router=useRouter(),[data,setData]=useState(null),[error,setError]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{let active=true;fetch(`/api/tickets/${ticket.id}/bod`).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);if(active)setData(b);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[ticket.id,ticket.updatedAt]);
 const w=data?.window;
 async function action(action){setBusy(true);setError('');try{const r=await fetch(`/api/tickets/${ticket.id}/bod`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirmed,evidence})}),b=await r.json();if(!r.ok)throw new Error(b.error);setData(d=>({...d,window:b.window}));setConfirmed(false);setEvidence('');router.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className={styles.form} aria-label="Pelaksanaan BOD"><h2>Pelaksanaan BOD</h2>{error&&<p role="alert">{error}</p>}{!w?<p>Memuat jadwal BOD…</p>:<>
 <p>{date(w.startsAt)} — {date(w.endsAt)} · {Number(((new Date(w.endsAt)-new Date(w.startsAt))/3600000).toFixed(2))} jam</p>
 <p>Bandwidth normal {mbpsToGbps(w.normalBandwidthMbps)} Gbps → BOD {mbpsToGbps(w.bodBandwidthMbps)} Gbps → kembali {mbpsToGbps(w.normalBandwidthMbps)} Gbps.</p>
 <p role="status">{w.cancelledAt?'Dibatalkan':w.restoredAt?'Bandwidth normal sudah dikembalikan. Tiket dapat di-Resolve.':w.activatedAt?'BOD aktif. Kembalikan bandwidth normal sebelum Resolve.':'Menunggu konfirmasi aktivasi.'}</p>
 {w.activationEvidence&&<p>Aktivasi: {w.activationEvidence} ({date(w.activatedAt)})</p>}{w.restorationEvidence&&<p>Pengembalian: {w.restorationEvidence} ({date(w.restoredAt)})</p>}{w.cancellationReason&&<p>Alasan pembatalan: {w.cancellationReason}</p>}
 {data.canConfirm&&!w.restoredAt&&!w.cancelledAt&&<><label htmlFor={'bod-evidence-'+ticket.id}>Bukti tindakan / catatan pelaksanaan</label><textarea id={'bod-evidence-'+ticket.id} maxLength={4000} value={evidence} onChange={e=>setEvidence(e.target.value)}/><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Saya mengonfirmasi tindakan jaringan telah dilakukan; Inventory boleh diperbarui sesuai tindakan ini.</label><button type="button" disabled={busy||!confirmed||!evidence.trim()||(!w.activatedAt&&(now<new Date(w.startsAt)||now>=new Date(w.endsAt)))} onClick={()=>action(w.activatedAt?'restore':'activate')}>{w.activatedAt?'Konfirmasi kembali ke bandwidth normal':'Konfirmasi aktivasi BOD'}</button>{!w.activatedAt&&<button type="button" disabled={busy||!confirmed||!evidence.trim()} onClick={()=>action('cancel')}>Batalkan BOD (catatan wajib)</button>}</>}
 </>}</section>;
}

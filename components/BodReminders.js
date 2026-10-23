import BodRefresh from './BodRefresh';
import {prisma} from '@/lib/prisma';
import {bodReminderState,mbpsToGbps} from '@/lib/tickets/bandwidth';
import styles from './tickets/work-form.module.css';
const labels={overdue:'Terlambat dikembalikan',urgent:'Selesai dalam 1 jam',ending_soon:'Selesai dalam 24 jam',activation_due:'Aktivasi jatuh tempo',scheduled:'Terjadwal',active:'Aktif'};
const date=v=>new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB';
export default async function BodReminders({scope}){
 const now=new Date();
 const rows=await prisma.bodWindow.findMany({where:{restoredAt:null,cancelledAt:null,ticket:scope},include:{ticket:{select:{id:true,trackingId:true,assignee:{select:{name:true}}}},service:{select:{cid:true,name:true,customer:{select:{name:true}}}}},orderBy:{endsAt:'asc'},take:50});
 if(!rows.length)return null;
 return <section className={styles.form} aria-label="Reminder BOD"><BodRefresh/><h2>Reminder BOD</h2><p>Konfirmasi pengembalian bandwidth normal pada tiket untuk menghentikan reminder. Semua waktu WIB.</p><div className={styles.tableWrap}><table><thead><tr>{['CID / Customer','Jadwal','Bandwidth (Gbps)','Status / PIC','Tiket'].map(t=><th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(w=><tr key={w.id}><td>{w.service.cid}<br/>{w.service.customer.name}<br/>{w.service.name}</td><td>{date(w.startsAt)}<br/>{date(w.endsAt)}</td><td>{mbpsToGbps(w.normalBandwidthMbps)} → {mbpsToGbps(w.bodBandwidthMbps)} → {mbpsToGbps(w.normalBandwidthMbps)}</td><td>{labels[bodReminderState(w,now)]}<br/>{w.ticket.assignee?.name||'Belum ada PIC'}</td><td><a href={'/tickets/'+w.ticket.id}>{w.ticket.trackingId}</a></td></tr>)}</tbody></table></div>{rows.length===50&&<p>Menampilkan 50 jadwal terdekat. Jadwal lain tersedia melalui daftar tiket BOD.</p>}</section>;
}

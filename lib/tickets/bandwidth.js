import {ServiceWorkError} from './serviceWork.js';
export function gbpsToMbps(value){
 if(!['string','number'].includes(typeof value))throw new ServiceWorkError('Bandwidth Gbps harus angka positif.');
 const text=String(value).trim().replace(',','.');
 if(!/^\d+(\.\d{1,6})?$/.test(text)||!Number.isFinite(Number(text))||Number(text)<=0||Number(text)>1000000)throw new ServiceWorkError('Bandwidth Gbps harus angka positif, maksimal6 desimal.');
 return Math.round(Number(text)*1000000000)/1000000;
}
export function mbpsToGbps(value){return value==null?null:Number((Number(value)/1000).toFixed(9));}
export function parseBodPeriod(start,end){
 const parse=v=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw new ServiceWorkError('Jadwal BOD wajib tanggal/jam dengan timezone.');
 const day=v.slice(0,10);if(new Date(day).toISOString().slice(0,10)!==day)throw new ServiceWorkError('Tanggal BOD tidak valid.');
 return new Date(v);
 };
 const startsAt=parse(start),endsAt=parse(end);
 if(endsAt<=startsAt)throw new ServiceWorkError('Selesai BOD harus setelah mulai.');
 return {startsAt,endsAt,durationMinutes:(endsAt-startsAt)/60000};
}
export function bodReminderState(bod,now=new Date()){
 if(bod.cancelledAt)return 'cancelled';
 if(bod.restoredAt)return 'restored';
 if(now>=new Date(bod.endsAt))return 'overdue';
 if(!bod.activatedAt)return now>=new Date(bod.startsAt)?'activation_due':'scheduled';
 const remaining=new Date(bod.endsAt)-now;
 return remaining<=3600000?'urgent':remaining<=86400000?'ending_soon':'active';
}

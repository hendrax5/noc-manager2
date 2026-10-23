import {capacityCustomData} from '../services/fields.js';
import {ServiceWorkError,snapshotService} from './serviceWork.js';
import {parseBodPeriod} from './bandwidth.js';
const fail=(message,status=400)=>{throw new ServiceWorkError(message,status);};
const stable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function bandwidthData(data,mbps){
 return capacityCustomData(data,mbps);
}
export async function syncBodWindow(tx,ticket){
 if(ticket.serviceChange?.operation!=='BOD')return;
 const c=ticket.serviceChange,b=c.bod;
 if(!b||!c.before?.serviceId||!(c.before.bandwidthMbps>0)||!(c.after.bandwidthMbps>c.before.bandwidthMbps))fail('BOD membutuhkan bandwidth normal dan bandwidth sementara yang lebih besar.');
 const period=parseBodPeriod(b.startsAt,b.endsAt);
 await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${c.before.serviceId} FOR UPDATE`;
 const existing=await tx.bodWindow.findUnique({where:{ticketId:ticket.id}});
 if(existing&&existing.serviceId!==c.before.serviceId)fail('CID BOD tidak dapat diganti. Buat tiket baru.',409);
 if(existing?.activatedAt||existing?.cancelledAt)fail('BOD yang sudah diaktivasi/dibatalkan tidak dapat diubah.',409);
 const overlap=await tx.bodWindow.findFirst({where:{serviceId:c.before.serviceId,ticketId:{not:ticket.id},restoredAt:null,cancelledAt:null,OR:[{activatedAt:{not:null}},{startsAt:{lt:period.endsAt},endsAt:{gt:period.startsAt}}]}});
 if(overlap)fail('Periode BOD bertumpuk pada CID ini.',409);
 const data={startsAt:period.startsAt,endsAt:period.endsAt,normalBandwidthMbps:c.before.bandwidthMbps,bodBandwidthMbps:c.after.bandwidthMbps,normalSnapshot:c.before};
 return existing?tx.bodWindow.update({where:{id:existing.id},data}):tx.bodWindow.create({data:{...data,ticketId:ticket.id,serviceId:c.before.serviceId}});
}
export async function assertBodResolved(tx,ticketId){
 const row=await tx.bodWindow.findUnique({where:{ticketId}});
 if(!row?.restoredAt)fail('Konfirmasi pengembalian bandwidth normal sebelum Resolve BOD.',409);
 return row;
}
export function canAccessBodTicket(actor,ticket){
 return actor&&(actor.role==='Admin'||actor.permissions?.includes('view_all_tickets')||actor.permissions?.includes('manage_tickets')||Number(actor.id)===ticket.assigneeId||Number(actor.departmentId)===ticket.departmentId);
}
export async function confirmBodAction(tx,{ticketId,actor,action,confirmed,evidence,now=new Date()}){
 await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
 const ticket=await tx.ticket.findUnique({where:{id:ticketId}});
 if(!ticket||!(actor?.role==='Admin'||actor?.permissions?.includes('manage_tickets')||Number(actor?.id)===ticket.assigneeId))fail('Hanya PIC atau pengelola berizin yang dapat mengonfirmasi BOD.',403);
 if(confirmed!==true||typeof evidence!=='string'||!evidence.trim()||evidence.length>4000)fail('Konfirmasi dan bukti tindakan jaringan wajib diisi.');
 if(!['activate','restore','cancel'].includes(action))fail('Tindakan BOD tidak valid.');
 const row=await tx.bodWindow.findUnique({where:{ticketId}});
 if(!row)fail('Jadwal BOD tidak ditemukan.',404);
 if(row.cancelledAt){if(action==='cancel')return row;fail('BOD sudah dibatalkan.',409);}
 if(action==='cancel'){
 if(row.activatedAt)fail('Kembalikan bandwidth normal sebelum menutup BOD aktif.',409);
 const result=await tx.bodWindow.update({where:{id:row.id},data:{cancelledAt:now,cancelledBy:Number(actor.id),cancellationReason:evidence.trim()}});
 await tx.ticket.update({where:{id:ticketId},data:{status:'Closed',enableSla:false,nextSlaDeadline:null}});
 await tx.ticketHistory.create({data:{ticketId,actorId:Number(actor.id),action:'BOD cancelled: '+evidence.trim()}});
 return result;
 }
 if(action==='activate'&&row.activatedAt||action==='restore'&&row.restoredAt)return row;
 if(action==='activate'&&(now<new Date(row.startsAt)||now>=new Date(row.endsAt)))fail('Aktivasi hanya dapat dikonfirmasi setelah mulai dan sebelum selesai BOD.',409);
 if(action==='restore'&&!row.activatedAt)fail('BOD belum diaktivasi.',409);
 await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${row.serviceId} FOR UPDATE`;
 const service=await tx.service.findUnique({where:{id:row.serviceId},include:{template:true}});
 const expected=action==='activate'?row.normalSnapshot:row.activeSnapshot;
 if(!service||stable(snapshotService(service))!==stable(expected))fail('Inventory berubah. Tinjau konflik sebelum menerapkan BOD/pengembalian.',409);
 const changed=await tx.service.updateMany({where:{id:service.id,updatedAt:service.updatedAt},data:{customData:bandwidthData(service.customData,action==='activate'?row.bodBandwidthMbps:row.normalBandwidthMbps)}});
 if(changed.count!==1)fail('Inventory berubah bersamaan.',409);
 const updated=await tx.service.findUnique({where:{id:row.serviceId},include:{template:true}});
 const snapshot=snapshotService(updated);
 const result=await tx.bodWindow.update({where:{id:row.id},data:action==='activate'?{activatedAt:now,activatedBy:Number(actor.id),activationEvidence:evidence.trim(),activeSnapshot:snapshot}:{restoredAt:now,restoredBy:Number(actor.id),restorationEvidence:evidence.trim()}});
 await tx.ticket.update({where:{id:ticketId},data:{...(action==='activate'?{status:'In Progress'}:{}),serviceChange:{...ticket.serviceChange,...(action==='activate'?{appliedAt:now.toISOString(),appliedBy:Number(actor.id)}:{}),bod:{...ticket.serviceChange.bod,...(action==='activate'?{activatedAt:now.toISOString()}:{restoredAt:now.toISOString(),finalSnapshot:snapshot})}}}});
 await tx.ticketHistory.create({data:{ticketId,actorId:Number(actor.id),action:'BOD '+(action==='activate'?'activated':'normal bandwidth restored')+': '+evidence.trim()}});
 return result;
}

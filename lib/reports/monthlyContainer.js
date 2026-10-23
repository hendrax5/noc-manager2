import {WorkflowError} from '../workflows/policy.js';
export async function ensureMonthlyContainer(tx,{userId,monthKey}){
 if(!Number.isSafeInteger(userId)||userId<1||!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey))throw new WorkflowError('User/bulan laporan tidak valid.');
 await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
 const existing=await tx.monthlyReportContainer.findUnique({where:{userId_monthKey:{userId,monthKey}}});
 if(existing)return existing;
 const user=await tx.user.findUnique({where:{id:userId}});
 if(!user)throw new WorkflowError('User tidak ditemukan.',404);
 const ticket=await tx.ticket.create({data:{title:'Laporan '+monthKey+' — '+(user.name||'User '+userId),description:'Arsip laporan personal bulanan. Aktivitas pekerjaan ditautkan dari tiket asal.',purpose:'PersonalMonthlyReport',assigneeId:userId,departmentId:user.departmentId,workType:'Unclassified',status:'Open',enableSla:false}});
 return tx.monthlyReportContainer.create({data:{userId,monthKey,ticketId:ticket.id}});
}

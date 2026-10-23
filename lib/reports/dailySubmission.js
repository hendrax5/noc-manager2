import {createHash} from 'node:crypto';
import {WorkflowError} from '../workflows/policy.js';
import {ensureMonthlyContainer} from './monthlyContainer.js';
export function reportDayRange(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new WorkflowError('Tanggal laporan tidak valid.');
 return {gte:new Date(date+'T00:00:00+07:00'),lt:new Date(new Date(date+'T00:00:00+07:00').getTime()+86400000)};
}
export async function submitDailyReport(tx,{actorId,reportDate,manualItems=[],activityRefs=[],idempotencyKey,revision=0,state='Submitted',now=new Date()}){
 const range=reportDayRange(reportDate),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(reportDate>today)throw new WorkflowError('Tanggal laporan tidak boleh di masa depan.');
 if(!Number.isSafeInteger(actorId)||actorId<1||!Number.isSafeInteger(revision)||revision<0)throw new WorkflowError('User/revisi tidak valid.');
 if(!['Draft','Submitted'].includes(state)||typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>100)throw new WorkflowError('State/key tidak valid.');
 if(!Array.isArray(manualItems)||manualItems.length>50||!Array.isArray(activityRefs)||activityRefs.length>300)throw new WorkflowError('Maksimal50 pekerjaan manual dan300 aktivitas.');
 const clean=manualItems.map(i=>{
  if(!i||typeof i.description!=='string'||!i.description.trim()||i.description.length>2000||typeof i.result!=='string'||!i.result.trim()||i.result.length>4000||i.blocker!=null&&(typeof i.blocker!=='string'||i.blocker.length>2000))throw new WorkflowError('Pekerjaan dan hasil wajib diisi dengan panjang yang sesuai.');
  return {description:i.description.trim(),result:i.result.trim(),blocker:i.blocker?.trim()||''};
 });
 if(activityRefs.some(r=>!r||!['history','phase'].includes(r.source)||!Number.isSafeInteger(r.id)||r.id<1))throw new WorkflowError('Referensi aktivitas tidak valid.');
 const refs=[...new Map(activityRefs.map(r=>[r.source+':'+r.id,{source:r.source,id:r.id}])).values()].sort((a,b)=>a.source.localeCompare(b.source)||a.id-b.id);
 const fingerprint=createHash('sha256').update(JSON.stringify({reportDate,manualItems:clean,activityRefs:refs,state,revision})).digest('hex');
 const key=actorId+':'+idempotencyKey;
 await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actorId} FOR UPDATE`;
 const previousKey=await tx.dailyReport.findUnique({where:{idempotencyKey:key}});
 if(previousKey){if(previousKey.snapshot?.fingerprint!==fingerprint)throw new WorkflowError('Idempotency key sudah dipakai untuk data berbeda.',409);return previousKey;}
 const previous=await tx.dailyReport.findFirst({where:{userId:actorId,reportDate},orderBy:{revision:'desc'}});
 if((previous?.revision||0)!==revision)throw new WorkflowError('Revisi laporan berubah. Muat ulang.',409);
 const [history,phases]=await Promise.all([
 tx.ticketHistory.findMany({where:{id:{in:refs.filter(r=>r.source==='history').map(r=>r.id)},actorId,createdAt:range}}),
 tx.ticketPhaseExecution.findMany({where:{id:{in:refs.filter(r=>r.source==='phase').map(r=>r.id)},completedBy:actorId,completedAt:range,state:'Completed'}})
 ]);
 if(history.length+phases.length!==refs.length)throw new WorkflowError('Referensi aktivitas bukan milik Anda atau di luar tanggal laporan.');
 if(state==='Submitted'&&!clean.length&&!refs.length)throw new WorkflowError('Isi minimal satu pekerjaan atau aktivitas.');
 const container=await ensureMonthlyContainer(tx,{userId:actorId,monthKey:reportDate.slice(0,7)});
 const items=[...clean.map(i=>({...i,source:'manual'})),...history.map(h=>({source:'history',sourceId:h.id,description:h.action,result:'Aktivitas tiket tercatat',categorySnapshot:{jobCategoryId:h.jobCategoryId||null,awardedScore:h.awardedScore||0}})),...phases.map(p=>({source:'phase',sourceId:p.id,description:'Fase pekerjaan #'+p.id,result:p.evidence,categorySnapshot:p.categorySnapshot}))];
 const content=[reportDate,...items.map(i=>i.description+' — '+i.result+(i.blocker?' | Kendala: '+i.blocker:''))].join('\n');
 const comment=state==='Submitted'?await tx.comment.create({data:{ticketId:container.ticketId,authorId:actorId,isPublic:false,text:'Laporan harian '+reportDate+' (revisi '+(revision+1)+')\n'+content}}):null;
 return tx.dailyReport.create({data:{userId:actorId,reportDate,revision:revision+1,state,containerId:container.id,content,idempotencyKey:key,commentId:comment?.id,submittedAt:state==='Submitted'?now:null,snapshot:{fingerprint,manualItems:clean,activityRefs:refs},items:{create:items}}});
}

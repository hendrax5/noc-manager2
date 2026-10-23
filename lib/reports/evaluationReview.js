import {WorkflowError} from '../workflows/policy.js';
import {canReadReport} from './reportScope.js';
export async function reviewEvaluation(tx,{evaluationId,actor,scope,expectedRevision,decision,reason}){
 const initial=await tx.monthlyEvaluation.findUnique({where:{id:evaluationId}});
 if(!initial)throw new WorkflowError('Evaluasi tidak ditemukan.',404);
 await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${initial.userId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "MonthlyEvaluation" WHERE id = ${evaluationId} FOR UPDATE`;
 const row=await tx.monthlyEvaluation.findUnique({where:{id:evaluationId}});
 if(!row||!canReadReport(scope,row.userId))throw new WorkflowError('Tidak memiliki akses evaluasi.',403);
 if(!(actor.role==='Admin'||actor.role==='Manager'||actor.permissions?.includes('review_evaluations')))throw new WorkflowError('Izin review diperlukan.',403);
 if(Number(actor.id)===row.userId)throw new WorkflowError('Tidak boleh menilai laporan sendiri.',403);
 const latest=await tx.monthlyEvaluation.findFirst({where:{userId:row.userId,monthKey:row.monthKey},orderBy:{revision:'desc'}});
 if(latest?.id!==row.id)throw new WorkflowError('Revisi telah digantikan. Muat ulang.',409);
 if(row.lockedAt)throw new WorkflowError('Evaluasi terkunci. Buat revisi berizin.',409);
 if(expectedRevision!==row.revision)throw new WorkflowError('Revisi berubah.',409);
 if(!['approve','request_changes'].includes(decision)||typeof reason!=='string'||!reason.trim()||reason.length>2000)throw new WorkflowError('Keputusan dan alasan wajib valid.');
 if(row.status==='reviewed')throw new WorkflowError('Evaluasi sudah direview.',409);
 if(decision==='approve'&&row.snapshot?.status!=='ready')throw new WorkflowError('Bukti belum cukup untuk persetujuan.',409);
 const result=await tx.monthlyEvaluation.update({where:{id:row.id},data:{status:decision==='approve'?'reviewed':'changes_requested',reviewedBy:Number(actor.id),reviewedAt:new Date()}});
 await tx.evaluationReviewEvent.create({data:{evaluationId:row.id,actorId:Number(actor.id),decision,reason:reason.trim()}});
 return result;
}
export async function lockPeriod(tx,{monthKey,scope,actor,expectedEvaluationId,expectedRevision}){
 if(!(actor.role==='Admin'||actor.permissions?.includes('lock_evaluations')))throw new WorkflowError('Izin penguncian diperlukan.',403);
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(761234002)::text`;
 let rows=await tx.monthlyEvaluation.findMany({where:{monthKey,...(!scope.all?{userId:{in:scope.userIds}}:{})},orderBy:{revision:'desc'}});
 for(const userId of [...new Set(rows.map(r=>r.userId))].sort((a,b)=>a-b)) await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
 rows=await tx.monthlyEvaluation.findMany({where:{monthKey,...(!scope.all?{userId:{in:scope.userIds}}:{})},orderBy:{revision:'desc'}});
 const latest=[...new Map([...rows].reverse().map(r=>[r.userId,r])).values()];
 if(expectedEvaluationId!=null&&(!latest.some(r=>r.id===expectedEvaluationId&&r.revision===expectedRevision)))throw new WorkflowError('Revisi telah digantikan. Muat ulang.',409);
 for(const row of latest){
 if(row.lockedAt)continue;
 if(row.status!=='reviewed')throw new WorkflowError('Semua evaluasi dalam cakupan harus direview terlebih dahulu.',409);
 if(row.userId===Number(actor.id))throw new WorkflowError('Tidak boleh mengunci penilaian sendiri.',403);
 await tx.monthlyEvaluation.update({where:{id:row.id},data:{lockedAt:new Date(),status:'locked'}});
 await tx.evaluationReviewEvent.create({data:{evaluationId:row.id,actorId:Number(actor.id),decision:'lock',reason:'Period '+monthKey}});
 }
 return {locked:latest.length};
}

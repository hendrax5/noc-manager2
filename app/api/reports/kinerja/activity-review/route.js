import {prisma} from '@/lib/prisma';
import {canReadReport} from '@/lib/reports/reportScope';
import {jakartaMonthRange} from '@/lib/reports/monthPeriod';
import {WorkflowError} from '@/lib/workflows/policy';
import {kinerjaAccess,respond,failure} from '../shared';
export async function POST(req){try{
 const a=await kinerjaAccess(req);if(!(a.actor.role==='Admin'||a.actor.role==='Manager'||a.actor.permissions?.includes('review_evaluations')))throw new WorkflowError('Forbidden',403);
 const b=await req.json();if(!Number.isSafeInteger(b.id)||!['accepted','rejected'].includes(b.decision)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000)throw new WorkflowError('Keputusan dan alasan wajib.');
 const range=jakartaMonthRange(a.month);
 const record=await prisma.$transaction(async tx=>{
  const row=await tx.activityEvent.findUnique({where:{id:b.id}});
  if(!row||row.source!=='human'||!row.actorId||row.actorId===Number(a.actor.id)||!canReadReport(a.scope,row.actorId)||row.occurredAt<range.gte||row.occurredAt>=range.lt)throw new WorkflowError('Bukti tidak tersedia untuk review.',403);
  const result=await tx.activityEvent.updateMany({where:{id:row.id,validationState:'pending'},data:{validationState:b.decision,reviewedBy:Number(a.actor.id),reviewedAt:new Date(),reviewReason:b.reason.trim()}});
  if(result.count!==1)throw new WorkflowError('Bukti sudah direview. Muat ulang.',409);
  await tx.reportConfigurationAudit.create({data:{actorId:Number(a.actor.id),kind:'activity_review',recordId:row.id,payload:{decision:b.decision,reason:b.reason.trim()}}});
  return {id:row.id,decision:b.decision};
 });return respond(record);
 }catch(e){return failure(e);}}

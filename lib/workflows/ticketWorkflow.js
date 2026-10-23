import { WorkflowError } from './policy.js';
export async function initializeTicketWorkflow(tx,{ticketId,policyVersionId,actorId}) {
 await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
 if(await tx.ticketPhaseExecution.count({where:{ticketId}}))return;
 const ticket=await tx.ticket.findUnique({where:{id:ticketId}});
 const policy=await tx.workflowPolicyVersion.findUnique({where:{id:policyVersionId},include:{phases:{include:{category:true},orderBy:{ordinal:'asc'}}}});
 if(!ticket||!policy?.phases.length)throw new WorkflowError('Workflow tidak tersedia.');
 const routingSnapshot={'Order Origin':ticket.customData?.['Order Origin']||null,'Executing Vendor':ticket.customData?.['Executing Vendor']||null};
 await tx.ticketPhaseExecution.createMany({data:policy.phases.map((p,i)=>({ticketId,policyVersionId,definitionId:p.id,ordinal:i,state:i===0?'Active':'Pending',assigneeId:ticket.assigneeId,startedAt:i===0?new Date():null,categorySnapshot:{id:p.category.id,name:p.category.name,score:p.category.score},routingSnapshot}))});
 await tx.ticket.update({where:{id:ticketId},data:{jobCategoryId:policy.phases[0].jobCategoryId}});
 void actorId;
}
export async function completeTicketPhase(tx,{executionId,actor,idempotencyKey,evidence,overrideCategoryId,reason}) {
 if(typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>120)throw new WorkflowError('Idempotency key tidak valid.');
 const initial=await tx.ticketPhaseExecution.findUnique({where:{id:executionId}});
 if(!initial)throw new WorkflowError('Fase tidak ditemukan.',404);
 await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${initial.ticketId} FOR UPDATE`;
 const row=await tx.ticketPhaseExecution.findUnique({where:{id:executionId}});
 if(row.state==='Completed'){
  if(row.completionKey===idempotencyKey&&Number(row.completedBy)===Number(actor.id))return row;
  throw new WorkflowError('Fase telah selesai.',409);
 }
 const ticket=await tx.ticket.findUnique({where:{id:row.ticketId}});
 if(!ticket||['Closed','Resolved'].includes(ticket.status))throw new WorkflowError('Tiket ditutup/dibatalkan tidak dapat menyelesaikan fase.',409);
 if(row.state!=='Active'||(Number(row.assigneeId)!==Number(actor.id)&&actor.role!=='Admin'&&!actor.permissions?.includes('manage_workflows')))throw new WorkflowError('Hanya pelaksana fase atau pengelola berizin.',403);
 if(typeof evidence!=='string'||!evidence.trim()||evidence.length>4000)throw new WorkflowError('Hasil pekerjaan wajib diisi maksimal4000 karakter.');
 let category=row.categorySnapshot;
 if(overrideCategoryId){
  if(!(actor.role==='Admin'||actor.permissions?.includes('override_workflow_category'))||typeof reason!=='string'||!reason.trim())throw new WorkflowError('Override membutuhkan izin dan alasan.',403);
  const c=await tx.jobCategory.findUnique({where:{id:Number(overrideCategoryId)}});
  if(!c?.active)throw new WorkflowError('Kategori tidak aktif.');
  category={id:c.id,name:c.name,score:c.score};
 }
 const completed=await tx.ticketPhaseExecution.update({where:{id:row.id},data:{state:'Completed',completedAt:new Date(),completedBy:Number(actor.id),completionKey:idempotencyKey,evidence:evidence.trim(),categorySnapshot:category}});
 await tx.ticketHistory.create({data:{ticketId:row.ticketId,actorId:Number(actor.id),jobCategoryId:category.id,awardedScore:category.score,action:'Workflow phase completed: '+row.id+(overrideCategoryId?' | Override: '+reason:'')}});
 const next=await tx.ticketPhaseExecution.updateMany({where:{ticketId:row.ticketId,ordinal:row.ordinal+1,state:'Pending'},data:{state:'Active',startedAt:new Date()}});
 if(next.count){
  const rows=await tx.ticketPhaseExecution.findMany({where:{ticketId:row.ticketId},orderBy:{ordinal:'asc'}});
  const phase=rows.find(p=>p.ordinal===row.ordinal+1);
  await tx.ticket.update({where:{id:row.ticketId},data:{jobCategoryId:phase.categorySnapshot.id}});
 }
 return completed;
}
export async function assertWorkflowResolved(tx,ticketId){
 const phases=await tx.ticketPhaseExecution.findMany({where:{ticketId}});
 if(phases.some(p=>p.state!=='Completed'))throw new WorkflowError('Selesaikan seluruh fase sebelum Resolve.',409);
}

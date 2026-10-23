import {WorkflowError,resolveWorkflow,workflowContext} from './policy.js';
import {initializeTicketWorkflow} from './ticketWorkflow.js';
export async function assertTicketDeletionAllowed(tx,ticket){
 if(tx.bodWindow&&await tx.bodWindow.count({where:{ticketId:ticket.id}}))throw new WorkflowError('Riwayat BOD tidak boleh dihapus.',409);
 if(ticket.purpose==='PersonalMonthlyReport')throw new WorkflowError('Arsip personal tidak boleh dihapus.',409);
 if(await tx.ticketPhaseExecution.count({where:{ticketId:ticket.id}}))throw new WorkflowError('Tiket dengan fase dan bukti pekerjaan tidak boleh dihapus.',409);
}
export async function syncWorkflowAssignee(tx,ticket,actorId){
 if(await tx.ticketPhaseExecution.count({where:{ticketId:ticket.id}})){
  await tx.ticketPhaseExecution.updateMany({where:{ticketId:ticket.id,state:{not:'Completed'}},data:{assigneeId:ticket.assigneeId||null}});
 }else if(ticket.assigneeId&&!['Resolved','Closed'].includes(ticket.status)){
  const actor=await tx.user.findUnique({where:{id:ticket.assigneeId},select:{roleId:true}});
  const policies=await tx.workflowPolicyVersion.findMany({where:{publishedAt:{not:null}},include:{phases:{include:{category:true},orderBy:{ordinal:'asc'}}}});
  const workflow=resolveWorkflow({...workflowContext(ticket),roleId:actor?.roleId,policies});
  if(workflow)await initializeTicketWorkflow(tx,{ticketId:ticket.id,policyVersionId:workflow.policyVersionId,actorId});
 }
}
export async function takeTicket(tx,{ticketId,actor,enabled}){
 await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
 const current=await tx.ticket.findUnique({where:{id:ticketId}});
 if(!current)throw new WorkflowError('Tiket tidak ditemukan.',404);
 if(current.purpose==='PersonalMonthlyReport')throw new WorkflowError('Arsip personal tidak dapat diambil alih.',403);
 if(['Resolved','Closed'].includes(current.status))throw new WorkflowError('Gunakan proses reopen berizin untuk tiket selesai.',409);
 const ticket=await tx.ticket.update({where:{id:ticketId},data:{assigneeId:Number(actor.id),status:'Open'}});
 if(enabled||await tx.ticketPhaseExecution.count({where:{ticketId}}))await syncWorkflowAssignee(tx,ticket,Number(actor.id));
 await tx.ticketHistory.create({data:{ticketId,actorId:Number(actor.id),action:'Self-Assigned and Opened ticket'}});
 return ticket;
}
